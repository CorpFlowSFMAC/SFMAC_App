"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import {
    Wallet, History, CheckCircle2, Clock, ArrowUpRight,
    DollarSign, CreditCard, ChevronDown, ChevronUp,
    Building2, User, Upload, Eye, X, Search, Filter,
    AlertCircle, Banknote, CalendarCheck, BarChart3, RefreshCw,
    Smartphone, Copy, ExternalLink, Camera, CheckCheck
} from "lucide-react";
import { normalizeStateId } from "@/lib/ticketStates";
import { ticketsAPI } from "@/lib/supabase-api";
import { supabase } from "@/lib/supabase";
import { useAppData } from "@/lib/AppDataContext";
import { round2, formatSoles } from "@/lib/formatters";
import styles from "./payments.module.css";

interface PaymentItem {
    id: string;
    tipo: string;
    monto: number;
    estado: 'pendiente' | 'pagado';
    fecha: string;
    voucherRef?: string | null;
    concepto?: string;    // Para solicitudes de gestora
    solicitudId?: string; // ID de la solicitud original para limpiarla al pagar
    isTableCost?: boolean;
    costId?: string;
    isLegacy?: boolean;   // Marca pagos que vienen de metadata
    specialistName?: string; // Nombre del técnico vinculado al costo
    specialistBanco?: string;
    specialistCuenta?: string;
    specialistCCI?: string;
    specialistYape?: string;
    specialistPlin?: string;
    hasVoucher?: boolean; // Flag para carga diferida de base64
}

interface PaymentTicketGroup {
    ticketId: string;     // ID único para la UI (puede incluir el especialista)
    realTicketId: string; // ID real en la tabla de base de datos 'tickets'
    ticketNum: string;
    cliente: string;
    sede: string;
    tecnico: {
        nombre: string;
        id?: string;
        banco: string;
        numeroCuenta: string;
        cci: string;
        yape?: string;
        plin?: string;
    };
    montoPactado: number;
    montoAdelantado: number;
    saldoPendiente: number;
    items: PaymentItem[];
    historialDepositos: any[];
    costoVisita?: number;
    voucherVisita?: string | null;
    montoFacturado: number;
    utilidad: number;
    descripcion?: string;
}

// ─────────────────────────────────────────────────────────
// Helper: normaliza la clave de mes en formato "YYYY-MM" para
// evitar inconsistencias de toLocaleString entre entornos/navegadores
// ─────────────────────────────────────────────────────────
function getMonthKey(dateStr: string): string {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return 'invalido';
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
}

// Formatea clave YYYY-MM como "Febrero 2026" en español
function formatMonthKey(key: string): string {
    const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
        'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    const [y, m] = key.split('-');
    const idx = parseInt(m, 10) - 1;
    return `${MONTHS[idx] || m} ${y}`;
}

function getCurrentMonthKey(): string {
    return getMonthKey(new Date().toISOString());
}

// ─────────────────────────────────────────────────────────
// Helper: extrae campos de pago del metadata y del ticket
// ─────────────────────────────────────────────────────────
function flattenTicketForPayments(t: any) {
    if (!t) return t;
    let meta = t.metadata || {};
    while (meta.metadata && typeof meta.metadata === "object") {
        meta = { ...meta, ...meta.metadata };
        delete meta.metadata;
    }
    
    // Unificar historial y asegurar que adelantos/visitas clásicos sean contados
    const rawHistory = [
        ...(meta.historialPagosTecnico || []),
        ...(t.historialPagosTecnico || [])
    ];
    
    // Deduplicar por ID para evitar doble contabilidad si el mismo pago viene de dos fuentes
    const seenIds = new Set();
    const history = rawHistory.filter(p => {
        if (!p || !p.monto || p.monto <= 0 || p.estado === 'anulado') return false;
        if (p.id) {
            if (seenIds.has(p.id)) return false;
            seenIds.add(p.id);
        }
        return true;
    });

    const hasPaidMobility = history.some((p: any) =>
        p.tipo === 'Movilidad / Visita' ||
        (p.referencia && (p.referencia.toLowerCase().includes("visita") || p.referencia.toLowerCase().includes("movilidad")))
    );
    const hasPaidAdelanto = history.some((p: any) =>
        p.tipo === 'Adelanto' ||
        (p.referencia && p.referencia.toLowerCase().includes("adelanto"))
    );

    // Inyectar pagos clásicos si no están en historial (Evita descuadres por pagos registrados en el flujo antiguo)
    const hasVisitVoucher = !!(meta.voucherVisita || t.visit_voucher || history.some((p: any) => p.tipo === 'Movilidad / Visita'));
    const isVisitConfirmed = !!(meta.visitPaymentConfirmed || meta.fechaPagoVisita || t.visit_payment_confirmed);

    if ((isVisitConfirmed || hasVisitVoucher) && !hasPaidMobility) {
        const amount = parseFloat(meta.costoVisita || meta.costoPasaje || t.visit_cost || 0);
        if (amount > 0) {
            history.push({
                tipo: 'Movilidad / Visita', monto: amount,
                fecha: meta.fechaPagoVisita || new Date().toISOString(),
                referencia: 'Pago registrado vía sistema (Visita/Pasajes)', estado: 'pagado'
            });
        }
    }
    if (meta.adelantoPagado && !hasPaidAdelanto) {
        const amount = parseFloat(meta.montoAdelanto || 0);
        if (amount > 0) {
            history.push({
                tipo: 'Adelanto', monto: amount,
                fecha: meta.fechaAprobacion || meta.fechaAsignacion || new Date().toISOString(),
                referencia: 'Pago registrado vía sistema (Adelanto)', estado: 'pagado'
            });
        }
    }

    return {
        ...t,
        metadata: meta, // Aseguramos que el metadata del objeto retornado esté aplanado
        descripcionServicio: meta.descripcion || meta.titulo || t.description || "", 
        estadoId: normalizeStateId(t.status_id || meta.estadoId || "nuevo"),
        numeroTicketCliente: t.client_ticket_number || meta.numeroTicketCliente || "",
        costoManoObra: parseFloat(t.labor_cost ?? meta.costoManoObra ?? 0),
        costoMateriales: parseFloat(t.materials_cost ?? meta.costoMateriales ?? 0),
        costoVisita: parseFloat(t.visit_cost ?? meta.costoVisita ?? meta.costoPasaje ?? 0),
        solicitudAdelanto: meta.solicitudAdelanto ?? null,
        solicitudAdelantoExtra: meta.solicitudAdelantoExtra ?? null,
        solicitudLiquidacion: meta.solicitudLiquidacion ?? null,
        solicitudPagoVisita: meta.solicitudPagoVisita ?? null,
        // ✅ Solicitudes de depósito creadas por la Gestora (pendientes de aprobación del Admin)
        solicitudesDeposito: (meta.solicitudesDeposito || []).filter((s: any) => s.estado === 'pendiente'),
        historialPagosTecnico: history,
        montoAdelanto: parseFloat(meta.montoAdelanto || 0),
        adelantoPagado: meta.adelantoPagado || history.some((p: any) => p.tipo === 'Adelanto'),
        visitPaymentConfirmed: meta.visitPaymentConfirmed || history.some((p: any) => p.tipo === 'Movilidad / Visita'),
        porcentajeAdelanto: meta.porcentajeAdelanto ?? meta.solicitudAdelanto?.porcentaje ?? 0.5,
        fechaAprobacion: meta.fechaAprobacion ?? meta.fechaAprobacionCotizacion ?? null,
        fechaValidacionDocumental: meta.fechaValidacionDocumental ?? null,
        fechaPagoFinal: meta.fechaPagoFinal ?? null,
        fechaAsignacion: meta.fechaAsignacion ?? null,
        costoPasaje: meta.costoPasaje ?? 0,
        tecnico: {
            id: t.technicians?.id || meta.tecnico?.id,
            nombre: t.technicians?.name ||
                (t.technicians?.first_name && t.technicians?.last_name
                    ? `${t.technicians.first_name} ${t.technicians.last_name}`.trim()
                    : t.technicians?.first_name || t.technicians?.last_name) ||
                meta.tecnico?.nombre || 'Sin asignar',
            banco: t.technicians?.bank_name || meta.tecnico?.banco || '---',
            numeroCuenta: t.technicians?.account_number || meta.tecnico?.numeroCuenta || '---',
            cci: t.technicians?.cci || meta.tecnico?.cci || '---',
            yape: t.technicians?.yape_number || meta.tecnico?.yape,
            plin: t.technicians?.plin_number || meta.tecnico?.plin,
        },
        cliente: { nombre: t.clients?.name || meta.cliente?.nombre || 'Cliente' },
        sede: { nombre: t.branch_offices?.name || meta.sede?.nombre || 'Sede' },
        montoFacturado: parseFloat(t.total_quoted_amount || t.montoFinal || meta.montoFinal || 0),
    };
}

export default function PaymentsPage() {
    const [tickets, setTickets] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [fetchError, setFetchError] = useState<string | null>(null);
    const fetchTimerRef = useRef<NodeJS.Timeout | null>(null);

    const fetchPaymentTickets = React.useCallback(async (isSilent = false) => {
        try {
            if (!isSilent) setLoading(true);
            setFetchError(null);

            // Timeout extendido a 30s; con conexión lenta 15s no alcanzaba.
            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Timeout de conexión')), 30000)
            );

            const fetchPromise = (async () => {
                // 🚀 Paso 1: tickets vía RPC (filtra por estados de pago server-side).
                const data = await ticketsAPI.getForPayments();
                const ticketIds = (data || []).filter(Boolean).map((t: any) => t.id);

                // 🚀 Paso 2: dos queries desacopladas y rápidas a ticket_costs.
                // (a) PENDIENTES + REQUIERE_APROBACION — set chico (solo lo no pagado).
                //     Sin filtro por ticket_id → captura solicitudes "huérfanas" cuyo
                //     ticket no devolvió el RPC.
                // (b) HISTORIAL — scoped a ticketIds del RPC, con estados pagados.
                // Antes era una sola query .or() o select(*) que en producción excedía
                // 15 segundos por:
                //   - join nested a `technicians` con muchas columnas
                //   - sin .limit()
                //   - sin filtro estricto de estado
                // Ahora: columnas mínimas, .limit(), estado bien filtrado.
                const COST_COLS = 'id, ticket_id, monto, estado_pago, categoria, concepto, fecha_pago, created_at, url_comprobante, specialist_id';

                const pendingPromise = supabase
                    .from('ticket_costs')
                    .select(COST_COLS)
                    .in('estado_pago', ['pendiente', 'REQUIERE_APROBACION_ADMIN'])
                    .order('created_at', { ascending: false })
                    .limit(500);

                const historyPromise = ticketIds.length > 0
                    ? supabase
                        .from('ticket_costs')
                        .select(COST_COLS)
                        .in('ticket_id', ticketIds)
                        .in('estado_pago', ['pagado', 'adelanto'])
                        .order('created_at', { ascending: false })
                        .limit(1000)
                    : Promise.resolve({ data: [], error: null } as any);

                const [pendingRes, historyRes] = await Promise.all([pendingPromise, historyPromise]);
                if (pendingRes.error) throw pendingRes.error;
                if (historyRes.error) throw historyRes.error;

                // Unión por id (defensivo) — pendiente nunca debe colisionar con pagado,
                // pero si la BD tuviera un ID duplicado preferimos el pendiente.
                const costMap = new Map<string, any>();
                for (const c of (historyRes.data || [])) costMap.set(c.id, c);
                for (const c of (pendingRes.data || [])) costMap.set(c.id, c);
                const rawCosts = Array.from(costMap.values());

                // 🚀 Paso 3: hidratar `technicians` con UNA query liviana
                // (el RPC original hacía nested join — lento + pesado en payload).
                const specialistIds = Array.from(new Set(
                    rawCosts.map((c: any) => c.specialist_id).filter(Boolean)
                ));
                let techniciansById: Record<string, any> = {};
                if (specialistIds.length > 0) {
                    const { data: techData, error: techErr } = await supabase
                        .from('technicians')
                        .select('id, name, first_name, last_name, bank_name, account_number, cci, yape_number, plin_number')
                        .in('id', specialistIds);
                    if (techErr) throw techErr;
                    techniciansById = Object.fromEntries((techData || []).map((t: any) => [t.id, t]));
                }
                const costs = rawCosts.map((c: any) => ({
                    ...c,
                    technicians: c.specialist_id ? techniciansById[c.specialist_id] || null : null,
                }));

                // 🚀 Paso 4: tickets "huérfanos" — solicitudes pendientes cuyo ticket
                // no fue devuelto por el RPC (porque su status_id está fuera del
                // filtro server-side, ej. cotizacion_enviada).
                const orphanIds = Array.from(new Set(
                    (pendingRes.data || [])
                        .map((c: any) => c.ticket_id)
                        .filter((id: string) => id && !ticketIds.includes(id))
                ));
                let orphanTickets: any[] = [];
                if (orphanIds.length > 0) {
                    const { data: orphanData, error: orphanErr } = await supabase
                        .from('tickets')
                        .select('id, status_id, service_type, description, client_ticket_number, created_at, labor_cost, materials_cost, visit_cost, total_quoted_amount, technician_id, gestora_id, metadata, clients(id, name, ruc), branch_offices(id, name, address), technicians(id, name, first_name, last_name, bank_name, account_number, cci, yape_number, plin_number), gestora:gestoras(id, name)')
                        .in('id', orphanIds)
                        .limit(200);
                    if (orphanErr) throw orphanErr;
                    orphanTickets = orphanData || [];
                }

                const fullData = [...(data || []), ...orphanTickets];
                return { data: fullData, costs };
            })();

            const { data, costs } = await Promise.race([fetchPromise, timeoutPromise]) as any;

            // 🚀 Pre-indexar costs por ticket_id para evitar O(N×M) en el filtrado posterior.
            const costsByTicket = new Map<string, any[]>();
            for (const c of (costs || [])) {
                if (!c?.ticket_id) continue;
                const arr = costsByTicket.get(c.ticket_id);
                if (arr) arr.push(c); else costsByTicket.set(c.ticket_id, [c]);
            }

            const processed = (data || []).filter(Boolean).map((t: any) => {
                try {
                    const flat = flattenTicketForPayments(t);
                    const relatedCosts = costsByTicket.get(t.id) || [];

                    flat.pendingCosts = relatedCosts.filter((c: any) => c.estado_pago === 'pendiente');
                    flat.paidCosts = relatedCosts.filter((c: any) => c.estado_pago === 'pagado' || c.estado_pago === 'adelanto');
                    flat.exceedanceRequests = relatedCosts.filter((c: any) => c.estado_pago === 'REQUIERE_APROBACION_ADMIN');

                    return flat;
                } catch (e) {
                    console.error('[Payments] Error processing ticket:', t.id, e);
                    return null;
                }
            }).filter(Boolean);
            
            setTickets(processed);
        } catch (err: any) {
            console.error('[Payments] Fetch Error:', err);
            setFetchError(err.message || "Error de conexión");
        } finally {
            setLoading(false);
        }
    }, []);

    // Debounced fetch for realtime events
    const debouncedFetch = React.useCallback(() => {
        if (fetchTimerRef.current) clearTimeout(fetchTimerRef.current);
        fetchTimerRef.current = setTimeout(() => {
            fetchPaymentTickets(true); // Refresco silencioso en segundo plano
        }, 1000);
    }, [fetchPaymentTickets]);

    const handleApproveExceedance = async (costId: string) => {
        try {
            const { error } = await supabase
                .from('ticket_costs')
                .update({ estado_pago: 'pendiente' })
                .eq('id', costId);
            
            if (error) throw error;
            fetchPaymentTickets();
        } catch (err) {
            console.error('Error approving exceedance:', err);
            alert('Error al aprobar el excedente');
        }
    };

    const handleRejectExceedance = async (costId: string) => {
        try {
            const { error } = await supabase
                .from('ticket_costs')
                .update({ estado_pago: 'RECHAZADO' })
                .eq('id', costId);
            
            if (error) throw error;
            fetchPaymentTickets();
        } catch (err) {
            console.error('Error rejecting exceedance:', err);
            alert('Error al rechazar el excedente');
        }
    };

    useEffect(() => { fetchPaymentTickets(); }, [fetchPaymentTickets]);

    useEffect(() => {
        const channel = supabase
            .channel('payments:realtime_sync')
            .on('postgres_changes',
                { event: '*', schema: 'public', table: 'tickets' },
                () => { debouncedFetch(); }
            )
            .on('postgres_changes',
                { event: '*', schema: 'public', table: 'ticket_costs' },
                () => { debouncedFetch(); }
            )
            .subscribe();
        return () => { 
            if (fetchTimerRef.current) clearTimeout(fetchTimerRef.current);
            supabase.removeChannel(channel); 
        };
    }, [debouncedFetch]);

    const refresh = fetchPaymentTickets;

    const updateTicket = React.useCallback(async (id: string, updates: any) => {
        const updated = await ticketsAPI.update(id, updates);
        return updated;
    }, []);

    const [paymentGroups, setPaymentGroups] = useState<PaymentTicketGroup[]>([]);
    const [filter, setFilter] = useState<'todos' | 'pendiente' | 'pagado'>('pendiente');
    const [searchTerm, setSearchTerm] = useState('');

    // Función para ver voucher con carga diferida (lazy loading)
    const handleViewVoucher = async (ticketId: string, voucherRef?: string | null, hasVoucher?: boolean) => {
        if (!hasVoucher && !voucherRef) return;

        // Si ya tenemos el base64, lo mostramos
        if (voucherRef?.startsWith('data:image')) {
            setShowVoucher(voucherRef);
            return;
        }

        // Si no lo tenemos pero sabemos que existe, lo bajamos de la DB (On-demand)
        if (hasVoucher || voucherRef) {
            try {
                // Notificar al usuario que se está descargando
                setLoading(true);
                const fullTicket = await ticketsAPI.getById(ticketId);
                const meta = fullTicket.metadata || {};
                const history = meta.historialPagosTecnico || [];
                
                // Buscar el pago que tenga el voucher base64
                // A veces el voucher está en meta.voucherVisita o en el historial
                const found = history.find((p: any) => p.voucherRef && p.voucherRef.startsWith('data:image'));
                
                if (found?.voucherRef) {
                    setShowVoucher(found.voucherRef);
                } else if (meta.voucherVisita && meta.voucherVisita.startsWith('data:image')) {
                    setShowVoucher(meta.voucherVisita);
                } else {
                    alert("No se pudo recuperar la imagen original. Verifique en los detalles del ticket.");
                }
            } catch (err) {
                console.error("Error fetching voucher on demand:", err);
            } finally {
                setLoading(false);
            }
        }
    };
    const [expandedHistory, setExpandedHistory] = useState<string | null>(null);
    const [pendingConfirmation, setPendingConfirmation] = useState<{
        group: PaymentTicketGroup;
        item: PaymentItem;
        voucher?: string | null;
        message: string;
    } | null>(null);
    const [showVoucher, setShowVoucher] = useState<string | null>(null);
    const [refreshing, setRefreshing] = useState(false);

    // ── ZERO-FEE DEEP LINK STATE ─────────────────────────────────
    // waitingVoucher: después del deep link, espera que el admin vuelva y suba el voucher
    const [waitingVoucher, setWaitingVoucher] = useState<{
        group: PaymentTicketGroup;
        item: PaymentItem;
        wallet: 'yape' | 'plin' | 'banco';
        numero: string;
    } | null>(null);

    // Toast flash (1s) para confirmar que el número fue copiado
    const [toast, setToast] = useState<{ msg: string; visible: boolean }>({ msg: '', visible: false });
    const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    const showToast = useCallback((msg: string) => {
        if (toastTimer.current) clearTimeout(toastTimer.current);
        setToast({ msg, visible: true });
        toastTimer.current = setTimeout(() => setToast({ msg: '', visible: false }), 2200);
    }, []);

    // Función principal del flujo Zero-Fee
    const handleDeepLinkPayment = useCallback(async (
        group: PaymentTicketGroup,
        item: PaymentItem,
        wallet: 'yape' | 'plin' | 'banco'
    ) => {
        // Al haber separado los grupos por beneficiario, group.tecnico ya contiene los datos correctos del destinatario
        const numero = wallet === 'yape'
            ? group.tecnico.yape
            : wallet === 'plin'
                ? group.tecnico.plin
                : group.tecnico.numeroCuenta;

        if (!numero) return;

        // PASO A: Copiar número al portapapeles
        try {
            await navigator.clipboard.writeText(numero);
        } catch {
            // Fallback para contextos sin permiso de clipboard (HTTP)
            const ta = document.createElement('textarea');
            ta.value = numero;
            ta.style.position = 'fixed';
            ta.style.opacity = '0';
            document.body.appendChild(ta);
            ta.focus();
            ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);
        }

        // PASO B: Toast flash
        showToast(`✅ Número copiado. Pegue el monto: S/ ${formatSoles(item.monto)}`);

        // Marcar como "esperando voucher" ANTES de salir de la app
        setWaitingVoucher({ group, item, wallet, numero });

        // PASO C: Deep Link — intentar abrir la app bancaria vía scheme URI
        await new Promise(r => setTimeout(r, 300));
        const deepLinks: Record<string, string> = {
            yape: 'yape://',
            plin: 'plin://',
            banco: 'https://www.bcp.com.pe',
        };
        try {
            window.location.assign(deepLinks[wallet]);
        } catch { /* silencioso */ }
    }, [showToast]);

    // ★ FIX: monthlyTotals usa claves YYYY-MM (no locale) para evitar inconsistencias
    const [monthlyTotals, setMonthlyTotals] = useState<{ [key: string]: number }>({});

    const [userRole, setUserRole] = useState<string | null>(() => {
        if (typeof window !== 'undefined') return localStorage.getItem('userRole');
        return null;
    });

    useEffect(() => {
        if (tickets.length > 0) {
            processTicketsToGroups(tickets);
        } else if (!loading) {
            setPaymentGroups([]);
            setMonthlyTotals({});
        }
    }, [tickets, loading]);

    if (userRole && userRole !== 'admin') {
        return (
            <div style={{ height: '80vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: '1rem' }}>
                <AlertCircle size={64} color="#EF4444" />
                <h1 style={{ color: '#1E293B' }}>Acceso Restringido</h1>
                <p style={{ color: '#64748B', maxWidth: '400px', textAlign: 'center' }}>
                    Este módulo de Tesorería es de uso exclusivo para el Administrador de SINFIMAC.
                </p>
                <button onClick={() => window.location.href = '/dashboard/gestor'}
                    style={{ padding: '12px 24px', background: '#3B82F6', color: 'white', borderRadius: '12px', border: 'none', fontWeight: 800, cursor: 'pointer' }}>
                    Volver al Panel Operativo
                </button>
            </div>
        );
    }

    // ★ FIX CORE: Calcula totales mensuales usando claves YYYY-MM
    const calculateMonthlyTotalsFromTickets = (allTickets: any[]) => {
        const totals: { [key: string]: number } = {};
        allTickets.forEach(ticket => {
            (ticket.historialPagosTecnico || []).forEach((p: any) => {
                if (p.monto && p.fecha && p.estado !== 'anulado') {
                    const key = getMonthKey(p.fecha);
                    totals[key] = round2((totals[key] || 0) + round2(p.monto));
                }
            });
        });
        setMonthlyTotals(totals);
    };

    const processTicketsToGroups = (allTickets: any[]) => {
        const allGroups: PaymentTicketGroup[] = [];

        allTickets.forEach(ticket => {
            try {
                const ticketNum = ticket.numeroTicketCliente || ticket.numeroTicket || `#${ticket.id.toString().slice(-6).toUpperCase()}`;

                const costoManoObra = round2(ticket.costoManoObra || 0);
                const costoMateriales = round2(ticket.costoMateriales || 0);
                const visitCost = round2(ticket.costoVisita || ticket.costoPasaje || ticket.solicitudPagoVisita?.monto || 0);

                // ★ FIX: El total pactado (Costo Operativo) es lo acordado para el trabajo (MO + Mat).
                // Si hay trabajo, el pactado es jobCostBase. Si solo es visita, el pactado es visitCost.
                // Esto evita inflar el costo con la visita si el presupuesto de obra ya la contempla.
                const jobCostBase = round2(costoManoObra + costoMateriales);
                const totalPactadoInclVisita = jobCostBase > 0 ? jobCostBase : visitCost;

                const pagosLegacy = ticket.historialPagosTecnico || [];
                
                // ✅ UNIFICACIÓN: Incluir pagos de ticket_costs que no estén en legacy metadata
                // Esto asegura que pagos realizados vía "Gastos/Compras" aparezcan en el historial de Tesorería.
                const paidCostsArr = ticket.paidCosts || [];
                const costsAsHistory = paidCostsArr.map((c: any) => ({
                    id: c.id,
                    monto: c.monto,
                    fecha: c.fecha_pago || c.created_at,
                    tipo: c.categoria,
                    estado: 'pagado',
                    referencia: c.concepto,
                    voucherRef: c.url_comprobante,
                    isTableCost: true
                }));

                const uniqueHistory = [...pagosLegacy];
                costsAsHistory.forEach((costPayment: any) => {
                    const alreadyPresent = uniqueHistory.some((p: any) => 
                        // Deduplicación por ID (Si usamos el UUID del costo en la metadata)
                        p.id === costPayment.id || 
                        // Deduplicación por Monto + Tipo + Fecha (Tolerancia de 1 hora para compensar desfases de servidor/cliente)
                        (Math.abs(p.monto - costPayment.monto) < 0.01 && 
                         (p.tipo || '').toLowerCase() === (costPayment.tipo || '').toLowerCase() &&
                         Math.abs(new Date(p.fecha).getTime() - new Date(costPayment.fecha).getTime()) < 3600000)
                    );
                    if (!alreadyPresent) uniqueHistory.push(costPayment);
                });

                const totalPagadoArray = round2(uniqueHistory.reduce((sum: number, p: any) => sum + round2(p.monto || 0), 0));
                const allHistory = [...uniqueHistory].sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());

                const techData = {
                    id: ticket.tecnico?.id,
                    nombre: ticket.tecnico?.nombre || 'Sin asignar',
                    banco: ticket.tecnico?.banco || '---',
                    numeroCuenta: ticket.tecnico?.numeroCuenta || '---',
                    cci: ticket.tecnico?.cci || '---',
                    yape: ticket.tecnico?.yape,
                    plin: ticket.tecnico?.plin
                };

                // 2026-04-10 13:20 - Treasury Fix: Solo mostrar solicitudes pendientes reales
                const items: PaymentItem[] = [];
                const saldoReal = round2(totalPactadoInclVisita - totalPagadoArray);

                // Relaxed condition: Process tickets that are not closed, even if formal saldo is 0
                // (This allows material requests and early advances to show up before the quote is approved)
                if (ticket.estadoId !== 'ticket_cerrado') {
                    const jobCostBase = round2(costoManoObra + costoMateriales);

                    // 1. Adelanto (Metadata Legacy)
                    const hasAdelantoPaid = !!(ticket.adelantoPagado || pagosLegacy.some((p: any) => p.tipo === 'Adelanto'));
                    const adelantoRef = ticket.solicitudAdelanto || pagosLegacy.find((p: any) => p.tipo === 'Adelanto');
                    if (!hasAdelantoPaid && adelantoRef) {
                        const adelantoMonto = round2(adelantoRef?.monto || ticket.montoAdelanto || 0);
                        if (adelantoMonto > 0.01) {
                            items.push({
                                id: `${ticket.id}_adelanto`,
                                tipo: 'Adelanto',
                                monto: adelantoMonto,
                                estado: 'pendiente',
                                fecha: adelantoRef?.fecha || ticket.fechaPagoAdelanto || ticket.created_at
                            });
                        }
                    }

                    // 2. Refuerzo (Extra)
                    if (ticket.solicitudAdelantoExtra && !ticket.solicitudAdelantoExtra.pagado) {
                        const refuerzoMonto = round2(ticket.solicitudAdelantoExtra.monto || 0);
                        if (refuerzoMonto > 0.01) {
                            items.push({
                                id: `${ticket.id}_refuerzo`,
                                tipo: 'Refuerzo',
                                monto: refuerzoMonto,
                                estado: 'pendiente',
                                fecha: ticket.solicitudAdelantoExtra.fecha || new Date().toISOString()
                            });
                        }
                    }

                    // 3. Solicitudes de depósito de Gestora (Pendientes - Legacy Metadata)
                    if (ticket.solicitudesDeposito && ticket.solicitudesDeposito.length > 0) {
                        ticket.solicitudesDeposito.forEach((sol: any) => {
                            if (sol.estado === 'pendiente') {
                                items.push({
                                    id: `${ticket.id}_solicitud_${sol.id}`,
                                    tipo: sol.tipo || 'Solicitud Gestora (M)',
                                    monto: sol.monto,
                                    estado: 'pendiente',
                                    fecha: sol.fecha,
                                    concepto: sol.concepto,
                                    solicitudId: sol.id,
                                    isLegacy: true
                                });
                            }
                        });
                    }

                    // 3b. NUEVO: Costos y Egresos (Tabla ticket_costs) — agrupados por especialista
                    if (ticket.pendingCosts && ticket.pendingCosts.length > 0) {
                        ticket.pendingCosts.forEach((c: any) => {
                            const tech = c.technicians;
                            const specialistName = tech
                                ? (tech.name || `${tech.first_name || ''} ${tech.last_name || ''}`.trim())
                                : undefined;
                            items.push({
                                id: c.id,
                                tipo: `Gasto: ${c.categoria}`,
                                monto: c.monto,
                                estado: 'pendiente',
                                fecha: c.created_at,
                                concepto: specialistName ? `${c.concepto} · ${specialistName}` : c.concepto,
                                isTableCost: true,
                                costId: c.id,
                                specialistName: (tech && tech.id !== ticket.tecnico?.id) ? specialistName : undefined,
                                specialistBanco: tech?.bank_name,
                                specialistCuenta: tech?.account_number,
                                specialistCCI: tech?.cci,
                                specialistYape: tech?.yape_number,
                                specialistPlin: tech?.plin_number,
                            });
                        });
                    }

                    // 4. Liquidación Final
                    const hasFinalPaid = !!(ticket.fechaPagoFinal || pagosLegacy.some((p: any) => p.tipo === 'Liquidación Final' || p.tipo === 'Saldo Pendiente (Auto)'));
                    const finalRef = ticket.solicitudLiquidacion || pagosLegacy.find((p: any) => p.tipo === 'Liquidación Final' || p.tipo === 'Saldo Pendiente (Auto)');
                    
                    if (!hasFinalPaid && (finalRef || ticket.estadoId === 'por_liquidar')) {
                        const liqMonto = round2(finalRef?.monto ?? Math.max(0, saldoReal));
                        
                        if (liqMonto > 0.01) {
                            items.push({
                                id: `${ticket.id}_final`,
                                tipo: (finalRef?.tipo || 'Liquidación Final'),
                                monto: liqMonto,
                                estado: 'pendiente',
                                fecha: finalRef?.fecha || ticket.fechaPagoFinal || new Date().toISOString(),
                                concepto: (!finalRef) ? "Saldo detectado por el sistema" : undefined
                            });
                        }
                    }

                    // 5. Movilidad / Visita
                    // ★ FIX: Si hay costo de visita y no está pagado, mostrar siempre como pendiente,
                    // incluso si la gestora no ha pulsado "Solicitar Pago" explícitamente.
                    const hasVisitaPaid = !!(ticket.visitPaymentConfirmed || allHistory.some((p: any) => p.tipo === 'Movilidad / Visita' || p.tipo === 'Viáticos / Movilidad'));
                    const visitaRef = ticket.solicitudPagoVisita || allHistory.find((p: any) => p.tipo === 'Movilidad / Visita' || p.tipo === 'Viáticos / Movilidad');
                    if (!hasVisitaPaid && (visitaRef || visitCost > 0)) {
                        const visitaMonto = round2(visitaRef?.monto || visitCost);
                        if (visitaMonto > 0.01) {
                            items.push({
                                id: `${ticket.id}_visita`,
                                tipo: 'Movilidad / Visita',
                                monto: visitaMonto,
                                estado: 'pendiente',
                                fecha: visitaRef?.fecha || ticket.fechaPagoVisita || new Date().toISOString()
                            });
                        }
                    }
                }

                // Separar items por beneficiario para crear filas independientes
                const techItems = items.filter(i => !i.specialistName);
                const specialistGroups: { [name: string]: PaymentItem[] } = {};
                items.forEach(i => {
                    if (i.specialistName) {
                        if (!specialistGroups[i.specialistName]) specialistGroups[i.specialistName] = [];
                        specialistGroups[i.specialistName].push(i);
                    }
                });

                // A: Añadir fila del Técnico Principal (si tiene items o historial)
                if (techItems.length > 0 || (allHistory.length > 0 && techItems.length === 0 && pagasParaEsteBeneficiario(allHistory, 'técnico'))) {
                    allGroups.push({
                        ticketId: ticket.id,
                        realTicketId: ticket.id,
                        ticketNum,
                        cliente: ticket.cliente?.nombre || 'Cliente',
                        sede: ticket.sede?.nombre || 'Sede',
                        tecnico: techData,
                        montoPactado: totalPactadoInclVisita,
                        montoAdelantado: totalPagadoArray,
                        saldoPendiente: Math.max(0, round2(totalPactadoInclVisita - totalPagadoArray)),
                        items: techItems,
                        historialDepositos: allHistory,
                        costoVisita: visitCost,
                        voucherVisita: allHistory.find((p: any) => p.tipo === 'Movilidad / Visita' || p.referencia?.toLowerCase().includes("visita"))?.voucherRef,
                        montoFacturado: ticket.montoFacturado,
                        utilidad: Math.max(0, (ticket.montoFacturado || 0) - (totalPactadoInclVisita + visitCost)),
                        descripcion: ticket.descripcionServicio || '',
                    });
                }

                // B: Añadir filas para cada Especialista (Gestora/Tercero)
                Object.keys(specialistGroups).forEach(name => {
                    const sItems = specialistGroups[name];
                    const first = sItems[0];
                    const specData = {
                        id: undefined,
                        nombre: name,
                        banco: first.specialistBanco || '---',
                        numeroCuenta: first.specialistCuenta || '---',
                        cci: first.specialistCCI || '---',
                        yape: first.specialistYape,
                        plin: first.specialistPlin
                    };

                    allGroups.push({
                        ticketId: `${ticket.id}_${name}`, // ID único para el grupo de UI
                        realTicketId: ticket.id,         // ID real para actualizaciones de base de datos
                        ticketNum,
                        cliente: ticket.cliente?.nombre || 'Cliente',
                        sede: ticket.sede?.nombre || 'Sede',
                        tecnico: specData,
                        montoPactado: 0, // Especialistas no tienen pactado total del ticket
                        montoAdelantado: 0,
                        saldoPendiente: 0,
                        items: sItems,
                        historialDepositos: [], // El historial principal es del técnico
                        costoVisita: 0,
                        montoFacturado: 0,
                        utilidad: 0,
                        descripcion: ticket.descripcionServicio || '',
                    });
                });

            } catch (e) {
                console.error("Error processing ticket for payments:", e);
            }
        });

        // Helper para filtrar historial (opcional, para limpieza futura)
        function pagasParaEsteBeneficiario(historial: any[], tipo: string) {
            return true; // Por ahora mostramos el historial en la fila del técnico
        }

        allGroups.sort((a, b) => {
            const hasPendingA = a.items.some(i => i.estado === 'pendiente');
            const hasPendingB = b.items.some(i => i.estado === 'pendiente');
            if (hasPendingA !== hasPendingB) return hasPendingA ? -1 : 1;
            return 0;
        });

        setPaymentGroups(allGroups);
        calculateMonthlyTotalsFromTickets(allTickets);
    };

    // ★ USAMOS CONTEXTO PARA ACTUALIZACIÓN INMEDIATA EN DASHBOARD
    const { updatePaymentSafe } = useAppData();

    const handleDenyPayment = async (group: PaymentTicketGroup, item: PaymentItem) => {
        if (!confirm(`¿Está seguro que desea denegar este pago de S/ ${formatSoles(item.monto)}? Esta acción cancelará la solicitud permanentemente.`)) {
            return;
        }

        try {
            // 0. DETERMINAR SI REVERTIMOS ESTADO
            let newStatusId = null;
            if (group.items.some(i => i.tipo === 'Movilidad / Visita' || i.id === `${group.realTicketId}_visita`)) {
                // Si denegamos pago de visita, el ticket regresa a técnico asignado
                if (item.id === `${group.realTicketId}_visita` || item.tipo === 'Movilidad / Visita') {
                    newStatusId = 'tecnico_asignado';
                }
            } else if (item.tipo === 'Liquidación Final' || item.tipo === 'Saldo Pendiente (Auto)') {
                // Si denegamos liquidación, regresa a documentación enviada
                newStatusId = 'documentacion_enviada';
            }

            // 1. SI ES COSTO DE TABLA (NUEVO)
            if (item.isTableCost && item.costId) {
                const { error: delErr } = await supabase
                    .from('ticket_costs')
                    .delete()
                    .eq('id', item.costId);

                if (delErr) throw delErr;

                // Si era una movilidad/viático vía tabla, también revisamos estado
                if (item.tipo?.toLowerCase().includes('movilidad') || item.tipo?.toLowerCase().includes('viático')) {
                    const { data: t } = await supabase.from('tickets').select('status_id').eq('id', group.realTicketId).single();
                    if (t?.status_id === 'esperando_pago_visita') {
                        const { error: updErr } = await supabase.from('tickets').update({ status_id: 'tecnico_asignado' }).eq('id', group.realTicketId);
                        if (updErr) throw updErr;
                    }
                }

                showToast('✅ Registro de costo eliminado y solicitud denegada');
                refresh();
                return;
            }

            // 2. FETCH FRESH METADATA (PARA LEGACY)
            const { data: currentTicket, error: fetchErr } = await supabase
                .from('tickets')
                .select('metadata, status_id')
                .eq('id', group.realTicketId)
                .single();

            if (fetchErr || !currentTicket?.metadata) return;
            
            const meta = { ...currentTicket.metadata };
            const currentStatus = currentTicket.status_id;

            if (item.solicitudId) {
                meta.solicitudesDeposito = (meta.solicitudesDeposito || []).filter((s: any) => s.id !== item.solicitudId);
            } else if (item.tipo === 'Adelanto') {
                meta.solicitudAdelanto = null;
            } else if (item.tipo === 'Refuerzo') {
                meta.solicitudAdelantoExtra = null;
            } else if (item.tipo === 'Liquidación Final' || item.tipo === 'Saldo Pendiente (Auto)') {
                meta.solicitudLiquidacion = null;
                if (currentStatus === 'por_liquidar') newStatusId = 'documentacion_enviada';
            } else if (item.tipo === 'Movilidad / Visita') {
                meta.solicitudPagoVisita = null;
                if (currentStatus === 'esperando_pago_visita') newStatusId = 'tecnico_asignado';
            }

            const dbUpdates: any = { 
                metadata: {
                    ...meta,
                    pagoRechazado: {
                        fecha: new Date().toISOString(),
                        monto: item.monto,
                        tipo: item.tipo,
                        concepto: item.concepto || 'No especificado'
                    }
                } 
            };
            if (newStatusId) {
                dbUpdates.status_id = newStatusId;
                dbUpdates.metadata.estadoId = newStatusId; 
            }

            const { error: finalUpdErr } = await supabase
                .from('tickets')
                .update(dbUpdates)
                .eq('id', group.realTicketId);
            
            if (finalUpdErr) throw finalUpdErr;

            showToast(`✅ Pago denegado y registrado como Rechazado.`);
            refresh();
        } catch (err) {
            console.error('[Payments] Error denying payment:', err);
            alert('Error al denegar el pago.');
        }
    };

    const handleDeleteHistoryItem = async (group: PaymentTicketGroup, dep: any) => {
        if (!confirm(`¿ESTÁ SEGURO DE ELIMINAR ESTE REGISTRO DE PAGO?\n⚠️ Esta acción es irreversible y afectará el balance del técnico.`)) {
            return;
        }

        try {
            const { data: currentTicket } = await supabase
                .from('tickets')
                .select('metadata')
                .eq('id', group.realTicketId)
                .single();

            if (!currentTicket?.metadata) return;
            
            const meta = { ...currentTicket.metadata };
            const historial = meta.historialPagosTecnico || [];
            
            const nuevoHistorial = historial.filter((p: any) => p.id !== dep.id);
            const nuevoTotal = nuevoHistorial.reduce((sum: number, p: any) => sum + (p.monto || 0), 0);

            meta.historialPagosTecnico = nuevoHistorial;
            meta.montoAdelanto = nuevoTotal;

            const { error } = await supabase
                .from('tickets')
                .update({ metadata: meta })
                .eq('id', group.realTicketId);

            if (error) throw error;

            showToast('🗑️ Registro de pago eliminado');
            refresh();
        } catch (err) {
            console.error('[Payments] Error deleting history item:', err);
            alert('Error al eliminar el registro.');
        }
    };

    const handleConfirmPayment = async (group: PaymentTicketGroup, item: PaymentItem, voucherBase64?: string | null) => {
        // ★ FIX: Si es un costo de la tabla ticket_costs, usamos su UUID real como ID en la metadata.
        // Esto permite que el motor de unificación (deduplicación) sepa que son el mismo registro.
        const pagoId = (item.isTableCost && item.costId) ? item.costId : `pago_${group.realTicketId}_${Date.now()}`;
        const nuevoPago = {
            id: pagoId,
            monto: item.monto,
            fecha: new Date().toISOString(),
            tipo: item.tipo,
            estado: 'pagado',
            referencia: `Autorizado Admin: ${item.concepto || item.tipo}`,
            voucherRef: voucherBase64 || null,
        };

        try {
            if (item.isTableCost && item.costId) {
                const additionalUpdates: any = { metadataFields: {} };
                const isAdvance = item.concepto?.toLowerCase().includes('adelanto');
                const isFinal = item.concepto?.toLowerCase().includes('liquidación final');

                if (isAdvance) {
                    additionalUpdates.status_id = 'en_ejecucion';
                    additionalUpdates.metadataFields.adelantoPagado = true;
                    additionalUpdates.metadataFields.fechaPagoAdelanto = new Date().toISOString();
                    additionalUpdates.metadataFields.solicitudAdelanto = null;
                } else if (isFinal) {
                    additionalUpdates.status_id = 'ticket_cerrado';
                    additionalUpdates.metadataFields.fechaPagoFinal = new Date().toISOString();
                    additionalUpdates.metadataFields.solicitudLiquidacion = null;
                }

                const { error: costErr } = await supabase
                    .from('ticket_costs')
                    .update({ 
                        estado_pago: 'pagado', 
                        url_comprobante: voucherBase64 || null,
                        fecha_pago: new Date().toISOString()
                    })
                    .eq('id', item.costId);
                
                if (costErr) throw costErr;
                
                await ticketsAPI.updatePaymentSafe(group.realTicketId, nuevoPago, additionalUpdates);
                showToast('✅ Pago de costo registrado');
                refresh();
                return;
            }

            const { data: currentTicket } = await supabase
                .from('tickets')
                .select('metadata, status_id')
                .eq('id', group.realTicketId)
                .single();

            if (!currentTicket) return;
            const meta = { ...currentTicket.metadata };
            const additionalUpdates: any = { metadataFields: {} };

            if (item.id === `${group.realTicketId}_adelanto`) {
                additionalUpdates.status_id = 'en_ejecucion';
                additionalUpdates.execution_date = new Date().toISOString();
                meta.adelantoPagado = true;
                meta.fechaPagoAdelanto = additionalUpdates.execution_date;
                meta.solicitudAdelanto = null;
            } else if (item.id === `${group.realTicketId}_refuerzo`) {
                meta.solicitudAdelantoExtra = null;
            } else if (item.id === `${group.realTicketId}_final`) {
                additionalUpdates.status_id = 'ticket_cerrado';
                additionalUpdates.closure_date = new Date().toISOString();
                meta.fechaPagoFinal = additionalUpdates.closure_date;
                meta.solicitudLiquidacion = null;
            } else if (item.id === `${group.realTicketId}_visita`) {
                const preInspectionStates = ['nuevo', 'asignado', 'esperando_pago_visita', 'borrador', 'tecnico_asignado'];
                if (preInspectionStates.includes(currentTicket.status_id)) {
                    additionalUpdates.status_id = 'en_inspeccion';
                }
                meta.visitPaymentConfirmed = true;
                meta.fechaPagoVisita = new Date().toISOString();
                meta.solicitudPagoVisita = null;
            } else if (item.solicitudId) {
                meta.solicitudesDeposito = (meta.solicitudesDeposito || []).map((s: any) =>
                    s.id === item.solicitudId ? { ...s, estado: 'pagado', fechaPago: new Date().toISOString() } : s
                );
            }

            additionalUpdates.metadataFields = meta;
            await updatePaymentSafe(group.realTicketId, nuevoPago, additionalUpdates);
            showToast('✅ Pago confirmado exitosamente');
            refresh();
        } catch (err) {
            console.error('[Payments] Error confirming payment:', err);
            alert('Error al procesar el pago.');
        }
    };

    const getVoucherSrc = (ref?: string | null) => {
        if (!ref) return "";
        if (ref.startsWith("data:image")) return ref;
        return localStorage.getItem(ref) || "";
    };

    const currentMonthKey = getCurrentMonthKey();
    const egresosEsteMes = round2(monthlyTotals[currentMonthKey] || 0);
    const totalPagadoHistorico = round2(Object.values(monthlyTotals).reduce((s: any, v: any) => s + v, 0) as number);

    const pendingCount = paymentGroups.reduce((acc, g) => acc + g.items.filter(i => i.estado === 'pendiente' && i.monto > 0).length, 0);
    const totalPendingAmount = round2(paymentGroups.reduce((acc, g) =>
        acc + g.items.filter(i => i.estado === 'pendiente' && i.monto > 0).reduce((s, i) => s + i.monto, 0), 0));

    const filteredGroups = paymentGroups.filter(g => {
        const lowerSearch = searchTerm.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        const match = (val: string) => (val || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").includes(lowerSearch);
        
        const matchesSearch = !searchTerm || 
            match(g.ticketNum) ||
            match(g.cliente) ||
            match(g.sede) ||
            match(g.tecnico?.nombre) ||
            match(g.descripcion || "");

        // ★ UX FIX: Si el usuario está buscando, ignoramos el filtro de estado
        if (searchTerm && matchesSearch) return true;

        const matchesStatus = filter === 'todos' ||
                            (filter === 'pendiente' && g.items.some(i => i.estado === 'pendiente')) ||
                            (filter === 'pagado' && g.historialDepositos.length > 0);
        
        return matchesSearch && matchesStatus;
    });

    const TIPO_CONFIG: Record<string, { color: string; bg: string; label: string }> = {
        'Adelanto': { color: '#2563EB', bg: '#EFF6FF', label: 'Adelanto' },
        'Refuerzo': { color: '#B45309', bg: '#FEF3C7', label: 'Refuerzo' },
        'Liquidación Final': { color: '#047857', bg: '#ECFDF5', label: 'Liquidación' },
        'Movilidad / Visita': { color: '#7C3AED', bg: '#F5F3FF', label: 'Movilidad' },
        'Solicitud Gestora': { color: '#DC2626', bg: '#FEF2F2', label: '🔔 Solicitado' },
    };


    // Obtener todos los excedentes pendientes de todos los tickets
    const allExceedanceRequests = tickets.flatMap(t => (t.exceedanceRequests || []).map((r: any) => ({ ...r, ticket: t })));

    return (
        <div className={styles.paymentsContainer}>
            
            {/* 🚨 SECCIÓN DE ALERTAS: EXCEDENTES PENDIENTES DE APROBACIÓN */}
            {allExceedanceRequests.length > 0 && (
                <div style={{
                    marginBottom: '24px', background: '#FEF2F2', border: '2px solid #EF4444',
                    borderRadius: '16px', padding: '20px', boxShadow: '0 10px 15px -3px rgba(239, 68, 68, 0.1)'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '15px' }}>
                        <AlertCircle size={24} color="#EF4444" />
                        <h3 style={{ margin: 0, color: '#991B1B', fontSize: '1.1rem', fontWeight: 900 }}>
                            Solicitudes de Rescate por Excedente Pendientes ({allExceedanceRequests.length})
                        </h3>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '12px' }}>
                        {allExceedanceRequests.map((req: any) => (
                            <div key={req.id} style={{ background: 'white', border: '1px solid #FEE2E2', borderRadius: '12px', padding: '15px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                    <div>
                                        <p style={{ margin: 0, fontSize: '0.7rem', color: '#94A3B8', fontWeight: 800 }}>TICKET: {req.ticket?.numeroTicketCliente || req.ticket?.id.slice(-6)}</p>
                                        <p style={{ margin: '2px 0 0', fontSize: '0.85rem', fontWeight: 700, color: '#1E293B' }}>{req.ticket?.tecnico?.nombre}</p>
                                    </div>
                                    <div style={{ fontSize: '1.1rem', fontWeight: 900, color: '#EF4444' }}>
                                        {formatSoles(req.monto)}
                                    </div>
                                </div>
                                <div style={{ background: '#F8FAFC', padding: '8px 12px', borderRadius: '8px', fontSize: '0.75rem', color: '#475569', borderLeft: '3px solid #64748B' }}>
                                    <strong>Justificación:</strong> {req.motivo || 'No se proporcionó motivo.'}
                                </div>
                                <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                                    <button 
                                        onClick={() => handleApproveExceedance(req.id)}
                                        style={{ flex: 1, background: '#10B981', color: 'white', border: 'none', borderRadius: '8px', padding: '8px', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
                                    >
                                        <CheckCircle2 size={14} /> APROBAR
                                    </button>
                                    <button 
                                        onClick={() => handleRejectExceedance(req.id)}
                                        style={{ flex: 1, background: '#EF4444', color: 'white', border: 'none', borderRadius: '8px', padding: '8px', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
                                    >
                                        <X size={14} /> RECHAZAR
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* ─── HEADER PREMIUM ──────────────────────────────── */}
            <header style={{
                background: 'linear-gradient(135deg, #0F172A 0%, #1E3A5F 50%, #0EA5E9 100%)',
                borderRadius: '20px',
                padding: '28px 32px',
                marginBottom: '28px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                boxShadow: '0 20px 40px -12px rgba(14,165,233,0.35)'
            }}>
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '6px' }}>
                        <div style={{ width: 42, height: 42, background: 'rgba(255,255,255,0.15)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Banknote size={22} color="white" />
                        </div>
                        <h1 style={{ margin: 0, fontSize: '1.7rem', fontWeight: 900, color: 'white', letterSpacing: '-0.02em' }}>
                            Módulo de Pagos y Tesorería
                        </h1>
                    </div>
                    <p style={{ margin: 0, color: 'rgba(255,255,255,0.65)', fontSize: '0.92rem' }}>
                        Gestión centralizada de transferencias · Control financiero en tiempo real
                    </p>
                </div>
                <button
                    onClick={async () => { setRefreshing(true); await refresh(); setRefreshing(false); }}
                    style={{
                        background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)',
                        borderRadius: '12px', padding: '10px 18px', color: 'white', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, fontSize: '0.85rem',
                        backdropFilter: 'blur(8px)', transition: 'all 0.2s'
                    }}
                >
                    <RefreshCw size={16} style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
                    Actualizar
                </button>
            </header>

            {fetchError && (
                <div style={{
                    background: '#FEF2F2', border: '1px solid #FCA5A5', color: '#B91C1C',
                    padding: '12px 20px', borderRadius: '12px', marginBottom: '20px',
                    display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.85rem', fontWeight: 600,
                    animation: 'slideDown 0.3s ease'
                }}>
                    <AlertCircle size={18} />
                    <span style={{ flex: 1 }}>Error de conexión: {fetchError}. Los datos podrían no estar actualizados.</span>
                    <button 
                        onClick={() => refresh()} 
                        style={{ 
                            background: 'white', border: '1px solid #FCA5A5', padding: '6px 12px', 
                            borderRadius: '8px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 700,
                            color: '#B91C1C', transition: 'all 0.2s'
                        }}
                    >
                        Reintentar ahora
                    </button>
                </div>
            )}

            {/* ─── STAT CARDS ──────────────────────────────────── */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: '16px',
                marginBottom: '28px'
            }}>
                {/* Pendientes de Pago */}
                <div style={{
                    background: 'white', borderRadius: '16px', padding: '20px 24px',
                    border: '1px solid #FEE2E2', boxShadow: '0 4px 12px rgba(239,68,68,0.08)',
                    display: 'flex', alignItems: 'center', gap: '16px'
                }}>
                    <div style={{ width: 50, height: 50, borderRadius: '14px', background: 'linear-gradient(135deg,#FEE2E2,#FECACA)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Clock size={22} color="#DC2626" />
                    </div>
                    <div>
                        <p style={{ margin: 0, fontSize: '0.75rem', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Pendientes de Pago</p>
                        <p style={{ margin: '4px 0 0', fontSize: '2rem', fontWeight: 900, color: '#DC2626', lineHeight: 1 }}>{pendingCount}</p>
                        <p style={{ margin: '2px 0 0', fontSize: '0.75rem', color: '#94A3B8' }}>solicitudes activas</p>
                    </div>
                </div>

                {/* Monto por Desembolsar */}
                <div style={{
                    background: 'white', borderRadius: '16px', padding: '20px 24px',
                    border: '1px solid #DBEAFE', boxShadow: '0 4px 12px rgba(37,99,235,0.08)',
                    display: 'flex', alignItems: 'center', gap: '16px'
                }}>
                    <div style={{ width: 50, height: 50, borderRadius: '14px', background: 'linear-gradient(135deg,#DBEAFE,#BFDBFE)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <DollarSign size={22} color="#2563EB" />
                    </div>
                    <div>
                        <p style={{ margin: 0, fontSize: '0.75rem', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Por Desembolsar</p>
                        <p style={{ margin: '4px 0 0', fontSize: '1.5rem', fontWeight: 900, color: '#2563EB', lineHeight: 1 }}>
                            S/ {formatSoles(totalPendingAmount)}
                        </p>
                        <p style={{ margin: '2px 0 0', fontSize: '0.75rem', color: '#94A3B8' }}>monto pendiente total</p>
                    </div>
                </div>

                {/* Egresos del Mes ACTUAL — ★ FIX: usa clave YYYY-MM */}
                <div style={{
                    background: 'white', borderRadius: '16px', padding: '20px 24px',
                    border: '1px solid #D1FAE5', boxShadow: '0 4px 12px rgba(5,150,105,0.08)',
                    display: 'flex', alignItems: 'center', gap: '16px'
                }}>
                    <div style={{ width: 50, height: 50, borderRadius: '14px', background: 'linear-gradient(135deg,#D1FAE5,#A7F3D0)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <CalendarCheck size={22} color="#059669" />
                    </div>
                    <div>
                        <p style={{ margin: 0, fontSize: '0.75rem', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            Egresos {formatMonthKey(currentMonthKey)}
                        </p>
                        <p style={{ margin: '4px 0 0', fontSize: '1.5rem', fontWeight: 900, color: '#059669', lineHeight: 1 }}>
                            S/ {formatSoles(egresosEsteMes)}
                        </p>
                        <p style={{ margin: '2px 0 0', fontSize: '0.75rem', color: '#94A3B8' }}>pagado al técnico este mes</p>
                    </div>
                </div>

                {/* Total Histórico */}
                <div style={{
                    background: 'white', borderRadius: '16px', padding: '20px 24px',
                    border: '1px solid #EDE9FE', boxShadow: '0 4px 12px rgba(124,58,237,0.08)',
                    display: 'flex', alignItems: 'center', gap: '16px'
                }}>
                    <div style={{ width: 50, height: 50, borderRadius: '14px', background: 'linear-gradient(135deg,#EDE9FE,#DDD6FE)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <BarChart3 size={22} color="#7C3AED" />
                    </div>
                    <div>
                        <p style={{ margin: 0, fontSize: '0.75rem', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Histórico</p>
                        <p style={{ margin: '4px 0 0', fontSize: '1.5rem', fontWeight: 900, color: '#7C3AED', lineHeight: 1 }}>
                            S/ {formatSoles(totalPagadoHistorico)}
                        </p>
                        <p style={{ margin: '2px 0 0', fontSize: '0.75rem', color: '#94A3B8' }}>acumulado total de pagos</p>
                    </div>
                </div>
            </div>

            {/* ─── TABLA PRINCIPAL ─────────────────────────────── */}
            <div className={styles.tableCard}>
                <div className={styles.tableHeader}>
                    <h2 style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#1E293B' }}>
                        <Wallet size={18} color="#3B82F6" />
                        <span style={{ 
                                background: 'linear-gradient(135deg, #1E293B, #0F172A)', 
                                color: 'white', 
                                padding: '4px 12px', 
                                borderRadius: '20px', 
                                fontSize: '0.65rem', 
                                fontWeight: 900,
                                border: '1px solid rgba(255,255,255,0.1)',
                                boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                                letterSpacing: '0.05em'
                            }}>
                                SINFIMAC CORP - TESORERÍA v2.3
                            </span>
                        Peticiones de Fondos
                        <span style={{ background: pendingCount > 0 ? '#FEE2E2' : '#F0FDF4', color: pendingCount > 0 ? '#DC2626' : '#059669', fontSize: '0.75rem', fontWeight: 800, padding: '2px 10px', borderRadius: '20px' }}>
                            {filteredGroups.length} {filteredGroups.length === 1 ? 'registro' : 'registros'}
                        </span>
                    </h2>
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                        {/* 🔍 MULTIBUSCADOR */}
                        <div style={{ 
                            position: 'relative', 
                            display: 'flex', 
                            alignItems: 'center',
                            background: '#F1F5F9',
                            borderRadius: '12px',
                            padding: '4px 12px',
                            border: '1px solid #E2E8F0',
                            width: '300px'
                        }}>
                            <Search size={16} color="#64748B" style={{ marginRight: '8px' }} />
                            <input 
                                type="text"
                                placeholder="Buscar ticket, técnico o cliente..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                style={{
                                    border: 'none',
                                    background: 'transparent',
                                    fontSize: '0.85rem',
                                    color: '#1E293B',
                                    fontWeight: 500,
                                    outline: 'none',
                                    width: '100%',
                                    padding: '6px 0'
                                }}
                            />
                            {searchTerm && (
                                <X 
                                    size={14} 
                                    color="#94A3B8" 
                                    style={{ cursor: 'pointer', marginLeft: '6px' }} 
                                    onClick={() => setSearchTerm('')} 
                                />
                            )}
                        </div>

                        <div style={{ display: 'flex', gap: '8px', padding: '4px', background: '#F1F5F9', borderRadius: '14px' }}>
                            {(['todos', 'pendiente', 'pagado'] as const).map(f => (
                                <button key={f} onClick={() => setFilter(f)}
                                    style={{
                                        padding: '7px 16px', borderRadius: '10px', border: 'none', cursor: 'pointer',
                                        fontWeight: 800, fontSize: '0.75rem', transition: 'all 0.2s',
                                        background: filter === f ? 'white' : 'transparent',
                                        color: filter === f ? '#2563EB' : '#64748B',
                                        boxShadow: filter === f ? '0 2px 8px rgba(0,0,0,0.08)' : 'none'
                                    }}>
                                    {f === 'todos' ? 'Todos' : f === 'pendiente' ? '⏳ Pendientes' : '✅ Pagados'}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                <div className={styles.tableBody}>
                    {loading ? (
                        <div className={styles.emptyState} style={{ padding: '60px 20px' }}>
                            <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center', animation: 'pulse 1.5s ease-in-out infinite' }}>
                                <Clock size={28} color="#3B82F6" />
                            </div>
                            <p style={{ color: '#64748B', fontWeight: 600 }}>Cargando datos desde Supabase...</p>
                        </div>
                    ) : (
                        <table className={styles.paymentsTable}>
                            <thead>
                                <tr>
                                    <th style={{ width: '20%' }}># Ticket / Sede</th>
                                    <th style={{ width: '25%' }}>Beneficiario (Técnico)</th>
                                    <th style={{ width: '20%' }}>Estado Financiero</th>
                                    <th style={{ width: '25%' }}>Solicitud Actual</th>
                                    <th style={{ width: '10%', textAlign: 'center' }}>Acción</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredGroups.length === 0 ? (
                                    <tr>
                                        <td colSpan={5}>
                                            <div className={styles.emptyState} style={{ padding: '80px 20px', textAlign: 'center' }}>
                                                <div style={{ 
                                                    width: '80px', height: '80px', borderRadius: '50%', background: '#F1F5F9',
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px'
                                                }}>
                                                    <Search size={32} color="#94A3B8" />
                                                </div>
                                                <h3 style={{ margin: '0 0 8px', color: '#1E293B', fontWeight: 700 }}>No hay solicitudes</h3>
                                                <p style={{ color: '#64748B', maxWidth: '340px', margin: '0 auto', fontSize: '0.9rem' }}>
                                                    {searchTerm 
                                                        ? `No se encontraron resultados para "${searchTerm}". Intenta con otros términos.`
                                                        : filter === 'todos' 
                                                            ? 'Actualmente no hay solicitudes de pago registradas en el sistema.'
                                                            : `No se encontraron solicitudes con el filtro "${filter}".`}
                                                </p>
                                                {(searchTerm || filter !== 'todos') && (
                                                    <button 
                                                        onClick={() => { setSearchTerm(''); setFilter('todos'); }}
                                                        style={{ marginTop: '20px', color: '#2563EB', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.9rem' }}
                                                    >
                                                        Limpiar filtros
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ) : (
                                    filteredGroups.map((group) => (
                                        <React.Fragment key={group.ticketId}>
                                            <tr className={`${styles.paymentRow} ${group.items.some(i => i.estado === 'pendiente') ? styles.rowPending : styles.rowPaid}`}>

                                                {/* Col 1: Ticket */}
                                                <td>
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                                        <span style={{ fontFamily: 'monospace', fontWeight: 900, color: '#2563EB', background: '#EFF6FF', padding: '3px 10px', borderRadius: '6px', fontSize: '0.85rem', width: 'fit-content' }}>
                                                            {group.ticketNum}
                                                        </span>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.82rem' }}>
                                                            <Building2 size={11} color="#3B82F6" />
                                                            <strong style={{ color: '#1E293B' }}>{group.cliente}</strong>
                                                        </div>
                                                        <span style={{ color: '#64748B', fontSize: '0.78rem', paddingLeft: '16px' }}>{group.sede}</span>
                                                    </div>
                                                </td>

                                                {/* Col 2: Técnico */}
                                                <td>
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 800, color: '#1F2937', fontSize: '0.88rem' }}>
                                                            <User size={13} color="#7C3AED" />
                                                            {group.tecnico.nombre}
                                                        </div>
                                                        <div style={{ background: '#FDFCFB', border: '1px solid #F1F5F9', borderRadius: '10px', padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: '5px', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
                                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                                <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.78rem', fontWeight: 800, color: '#334155' }}>
                                                                    <CreditCard size={11} color="#64748B" />
                                                                    {group.tecnico.banco}
                                                                </div>
                                                                <div style={{ display: 'flex', gap: '4px' }}>
                                                                    {group.tecnico.yape && <span style={{ background: '#7C3AED', color: 'white', fontSize: '0.62rem', fontWeight: 900, padding: '2px 6px', borderRadius: '6px' }}>💜 YAPE</span>}
                                                                    {group.tecnico.plin && <span style={{ background: '#0EA5E9', color: 'white', fontSize: '0.62rem', fontWeight: 900, padding: '2px 6px', borderRadius: '6px' }}>🔵 PLIN</span>}
                                                                </div>
                                                            </div>
                                                            
                                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                                                                <div className={styles.bankDetailRow} onClick={() => { navigator.clipboard.writeText(group.tecnico.numeroCuenta); showToast('Cuenta copiada'); }} title="Click para copiar" style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', padding: '2px 4px', borderRadius: '4px', background: '#F8FAFC' }}>
                                                                    <span style={{ fontSize: '0.65rem', color: '#94A3B8', fontWeight: 700 }}>CTA:</span>
                                                                    <span style={{ fontFamily: 'monospace', fontSize: '0.72rem', color: '#475569', fontWeight: 600 }}>{group.tecnico.numeroCuenta}</span>
                                                                    <Copy size={10} style={{ opacity: 0.5 }} />
                                                                </div>
                                                                {group.tecnico.cci && group.tecnico.cci !== '---' && (
                                                                    <div className={styles.bankDetailRow} onClick={() => { navigator.clipboard.writeText(group.tecnico.cci); showToast('CCI copiado'); }} title="Click para copiar" style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', padding: '2px 4px', borderRadius: '4px', background: '#F8FAFC' }}>
                                                                        <span style={{ fontSize: '0.65rem', color: '#94A3B8', fontWeight: 700 }}>CCI:</span>
                                                                        <span style={{ fontFamily: 'monospace', fontSize: '0.72rem', color: '#475569', fontWeight: 600 }}>{group.tecnico.cci}</span>
                                                                        <Copy size={10} style={{ opacity: 0.5 }} />
                                                                    </div>
                                                                )}
                                                            </div>

                                                            {group.costoVisita && group.costoVisita > 0 && (
                                                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.72rem', color: '#7C3AED', fontWeight: 700, borderTop: '1px dashed #E2E8F0', paddingTop: '5px', marginTop: '2px' }}>
                                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                                        <ArrowUpRight size={11} />
                                                                        Visita: S/ {formatSoles(group.costoVisita)}
                                                                    </div>
                                                                    {group.voucherVisita && (
                                                                        <button onClick={() => setShowVoucher(group.voucherVisita || null)}
                                                                            style={{ background: '#EDE9FE', border: 'none', borderRadius: '4px', cursor: 'pointer', padding: '2px 6px', color: '#7C3AED', fontSize: '0.62rem', fontWeight: 800 }}>
                                                                            VOUCHER
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </div>
                                                        {group.descripcion && (
                                                            <div style={{ 
                                                                fontSize: '0.68rem', 
                                                                color: '#64748B', 
                                                                fontStyle: 'italic', 
                                                                lineHeight: 1.3, 
                                                                padding: '6px 8px',
                                                                background: '#F8FAFC',
                                                                borderRadius: '6px',
                                                                borderLeft: '2px solid #E2E8F0',
                                                                marginTop: '8px',
                                                                whiteSpace: 'pre-wrap',
                                                                maxHeight: '40px',
                                                                overflow: 'hidden',
                                                                textOverflow: 'ellipsis',
                                                                display: '-webkit-box',
                                                                WebkitLineClamp: 2,
                                                                WebkitBoxOrient: 'vertical'
                                                            }}>
                                                                {group.descripcion}
                                                            </div>
                                                        )}
                                                    </div>
                                                </td>

                                                {/* Col 3: Estado Financiero - Con Presupuesto y Rentabilidad */}
                                                <td>
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                        {/* Presupuesto Aprobado (BLUE) */}
                                                        <div className={styles.quotedRow}>
                                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                                <span className={styles.quotedLabel}>Presupuesto Cliente</span>
                                                                <span className={styles.quotedValue}>S/ {formatSoles(group.montoFacturado)}</span>
                                                            </div>
                                                        </div>

                                                        {/* Desglose de Pago al Técnico */}
                                                        <div className={styles.financialGridCompact}>
                                                            <div className={styles.finRowCompact}>
                                                                <span className={styles.finLabelCompact}>Pactado Trabajo</span>
                                                                <span className={styles.finValueCompact}>S/ {formatSoles(group.montoPactado)}</span>
                                                            </div>
                                                            <div className={styles.finRowCompact}>
                                                                <span className={styles.finLabelCompact}>Pagado Previo</span>
                                                                <span className={styles.finValueCompact} style={{ color: '#059669' }}>- S/ {formatSoles(group.montoAdelantado)}</span>
                                                            </div>
                                                            <div className={styles.finRowTotal}>
                                                                <div className={styles.finRowCompact}>
                                                                    <span style={{ fontWeight: 800, color: '#64748B', fontSize: '0.65rem' }}>SALDO PENDIENTE</span>
                                                                    <span style={{ fontWeight: 900, color: group.saldoPendiente > 0 ? '#2563EB' : '#059669', fontSize: '0.85rem' }}>
                                                                        S/ {formatSoles(group.saldoPendiente)}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        </div>

                                                        {/* Rentabilidad (GREEN/RED) */}
                                                        <div className={group.utilidad > 0 ? styles.finRowProfit : styles.finRowLoss}>
                                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                                <span className={styles.profitLabel}>Rentabilidad Bruta</span>
                                                                <span className={styles.profitValue}>S/ {formatSoles(group.utilidad)}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </td>

                                                {/* Col 4: Solicitud Actual */}
                                                <td>
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                                        {group.items.map((item) => {
                                                            const cfg = TIPO_CONFIG[item.tipo] || { color: '#64748B', bg: '#F8FAFC', label: item.tipo };
                                                            return (
                                                                <div key={item.id} style={{
                                                                    background: item.tipo === 'Solicitud Gestora' ? '#FEF2F2' : (item.estado === 'pendiente' ? '#FFFBEB' : '#F0FDF4'),
                                                                    border: `1px solid ${item.tipo === 'Solicitud Gestora' ? '#FECACA' : (item.estado === 'pendiente' ? '#FCD34D' : '#86EFAC')}`,
                                                                    borderRadius: '8px', padding: '7px 9px'
                                                                }}>
                                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3px' }}>
                                                                        <span style={{ background: cfg.bg, color: cfg.color, fontSize: '0.65rem', fontWeight: 800, padding: '2px 7px', borderRadius: '5px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                                                            {cfg.label}
                                                                        </span>
                                                                        <span style={{ fontSize: '0.8rem', fontWeight: 900, color: '#0F172A', fontFamily: 'monospace' }}>
                                                                            S/ {formatSoles(item.monto)}
                                                                        </span>
                                                                    </div>
                                                                    {item.concepto && (
                                                                        <div style={{ fontSize: '0.68rem', color: '#7F1D1D', fontWeight: 600, marginBottom: '3px', fontStyle: 'italic' }}>
                                                                            "{item.concepto}"
                                                                        </div>
                                                                    )}
                                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                                        <span style={{ fontSize: '0.65rem', color: '#94A3B8' }}>
                                                                            {new Date(item.fecha).toLocaleDateString('es-PE')}
                                                                        </span>
                                                                        <span style={{
                                                                            fontSize: '0.62rem', fontWeight: 800,
                                                                            color: item.estado === 'pendiente' ? '#D97706' : '#166534',
                                                                            background: item.estado === 'pendiente' ? '#FEF3C7' : '#DCFCE7',
                                                                            padding: '1px 6px', borderRadius: '4px'
                                                                        }}>
                                                                            {item.estado === 'pendiente' ? '⏳ PENDIENTE' : '✓ PAGADO'}
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </td>

                                                {/* Col 5: Acciones — Zero-Fee Deep Link */}
                                                <td>
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'stretch' }}>
                                                        {group.items.filter(i => i.estado === 'pendiente').map((item) => {
                                                            const hasYape = !!group.tecnico.yape;
                                                            const hasPlin = !!group.tecnico.plin;
                                                            const hasBanco = group.tecnico.numeroCuenta && group.tecnico.numeroCuenta !== '---';
                                                            const beneficiaryName = group.tecnico.nombre;
                                                            const yapeNum = group.tecnico.yape;
                                                            const plinNum = group.tecnico.plin;

                                                            return (
                                                                <div key={`action-${item.id}`} className={styles.zeroFeeActions}>
                                                                    {/* Botón YAPE — Deep Link */}
                                                                    {hasYape && (
                                                                        <button
                                                                            className={styles.btnYape}
                                                                            onClick={() => handleDeepLinkPayment(group, item, 'yape')}
                                                                            title={`Copiar ${yapeNum} y abrir Yape (Beneficiario: ${beneficiaryName})`}
                                                                        >
                                                                            <span className={styles.walletEmoji}>💜</span>
                                                                            <span>Yape</span>
                                                                            <span className={styles.walletNum}>{yapeNum}</span>
                                                                            <Copy size={10} style={{ opacity: 0.7 }} />
                                                                        </button>
                                                                    )}
                                                                    {/* Botón PLIN — Deep Link */}
                                                                    {hasPlin && (
                                                                        <button
                                                                            className={styles.btnPlin}
                                                                            onClick={() => handleDeepLinkPayment(group, item, 'plin')}
                                                                            title={`Copiar ${plinNum} y abrir Plin (Beneficiario: ${beneficiaryName})`}
                                                                        >
                                                                            <span className={styles.walletEmoji}>🔵</span>
                                                                            <span>Plin</span>
                                                                            <span className={styles.walletNum}>{plinNum}</span>
                                                                            <Copy size={10} style={{ opacity: 0.7 }} />
                                                                        </button>
                                                                    )}
                                                                    {/* Botón BANCO — Solo portapapeles, sin deep link */}
                                                                    {!hasYape && !hasPlin && hasBanco && (
                                                                        <button
                                                                            className={styles.btnBanco}
                                                                            onClick={() => handleDeepLinkPayment(group, item, 'banco')}
                                                                        >
                                                                            <span>🏦</span>
                                                                            <span>Transferir</span>
                                                                            <Copy size={10} style={{ opacity: 0.7 }} />
                                                                        </button>
                                                                    )}
                                                                    {/* Botón clásico con voucher */}
                                                                    <label className={styles.btnVoucherClassic}>
                                                                        <Upload size={11} />
                                                                        Ya pagué · Subir voucher
                                                                        <input type="file" accept="image/*" style={{ display: 'none' }}
                                                                            onChange={(e) => {
                                                                                if (e.target.files?.[0]) {
                                                                                    const reader = new FileReader();
                                                                                    reader.onloadend = () => setPendingConfirmation({
                                                                                        group, item,
                                                                                        voucher: reader.result as string,
                                                                                        message: `¿Confirmar depósito de S/ ${formatSoles(item.monto)} para ${item.tipo}?`
                                                                                    });
                                                                                    reader.readAsDataURL(e.target.files[0]);
                                                                                }
                                                                            }} />
                                                                    </label>

                                                                    {/* Botón DENEGAR PAGO */}
                                                                    <button
                                                                        className={styles.btnDeny}
                                                                        onClick={() => handleDenyPayment(group, item)}
                                                                        title="Denegar y cancelar solicitud"
                                                                    >
                                                                        <X size={12} />
                                                                        Denegar Pago
                                                                    </button>
                                                                </div>
                                                            );
                                                        })}
                                                        {group.items.length > 0 ? (
                                                            group.items.every(i => i.estado === 'pagado') && (
                                                                <div style={{ textAlign: 'center', padding: '8px 4px' }}>
                                                                    <div style={{ width: 32, height: 32, background: '#DCFCE7', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 4px' }}>
                                                                        <CheckCircle2 size={18} color="#22C55E" />
                                                                    </div>
                                                                    <span style={{ fontSize: '0.65rem', fontWeight: 800, color: '#15803D', display: 'block' }}>COMPLETADO</span>
                                                                    {group.historialDepositos.length > 0 && (
                                                                        <button className={styles.historyToggle}
                                                                            style={{ marginTop: '6px', width: '100%' }}
                                                                            onClick={() => setExpandedHistory(expandedHistory === group.ticketId ? null : group.ticketId)}>
                                                                            {expandedHistory === group.ticketId ? <ChevronUp size={14} /> : <History size={14} />}
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            )
                                                        ) : (
                                                            round2(group.montoPactado - group.montoAdelantado) <= 0.01 && (
                                                                <div style={{ textAlign: 'center', padding: '8px 4px' }}>
                                                                    <div style={{ width: 32, height: 32, background: '#DCFCE7', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 4px' }}>
                                                                        <CheckCircle2 size={18} color="#22C55E" />
                                                                    </div>
                                                                    <span style={{ fontSize: '0.65rem', fontWeight: 800, color: '#15803D', display: 'block' }}>COMPLETADO</span>
                                                                    {group.historialDepositos.length > 0 && (
                                                                        <button className={styles.historyToggle}
                                                                            style={{ marginTop: '6px', width: '100%' }}
                                                                            onClick={() => setExpandedHistory(expandedHistory === group.ticketId ? null : group.ticketId)}>
                                                                            {expandedHistory === group.ticketId ? <ChevronUp size={14} /> : <History size={14} />}
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            )
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>

                                            {/* Historial expandido */}
                                            {expandedHistory === group.ticketId && (
                                                <tr className={styles.historyRow}>
                                                    <td colSpan={5}>
                                                        <div className={styles.historyContainer}>
                                                            <h4 style={{ margin: '0 0 16px', color: '#475569', fontSize: '0.85rem', textTransform: 'uppercase', fontWeight: 800 }}>
                                                                📋 Historial de Transferencias — Ticket {group.ticketNum}
                                                            </h4>
                                                            <div className={styles.historyGrid}>
                                                                {group.historialDepositos.map((dep, idx) => (
                                                                    <div key={idx} className={styles.historyCard}>
                                                                        <div className={styles.historyHeader}>
                                                                            <span className={styles.historyIndex}>#{idx + 1}</span>
                                                                            <span className={styles.historyDate}>{new Date(dep.fecha).toLocaleString('es-PE')}</span>
                                                                        </div>
                                                                        <div className={styles.historyBody}>
                                                                            <strong style={{ fontSize: '1.05rem', color: '#1E293B', fontFamily: 'monospace' }}>S/ {formatSoles(dep.monto)}</strong>
                                                                            {(dep.hasVoucher || dep.voucherRef) && (
                                                                                <button onClick={() => handleViewVoucher(group.realTicketId, dep.voucherRef, dep.hasVoucher)}
                                                                                    className={styles.viewVoucherBtn}
                                                                                    style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 10px', background: '#F1F5F9', border: '1px solid #E2E8F0', borderRadius: '6px', fontSize: '0.72rem', cursor: 'pointer', color: '#475569', fontWeight: 600 }}>
                                                                                    <Eye size={12} /> Ver Voucher
                                                                                </button>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </React.Fragment>
                                    ))
                                )}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>

            {/* ─── TOAST ZERO-FEE ──────────────────────────────── */}
            <div className={`${styles.toastZeroFee} ${toast.visible ? styles.toastVisible : ''}`}>
                <CheckCheck size={16} />
                {toast.msg}
            </div>

            {/* ─── MODAL: ESPERANDO VOUCHER (post-deep-link) ───── */}
            {waitingVoucher && (
                <div className={styles.modalOverlay}>
                    <div className={styles.modalContent} style={{ maxWidth: 460 }}>
                        <div className={styles.modalHeader}>
                            <div className={styles.modalIcon} style={{ background: 'linear-gradient(135deg,#F5F3FF,#EDE9FE)', color: '#7C3AED' }}>
                                {waitingVoucher.wallet === 'yape' ? '💜' : waitingVoucher.wallet === 'plin' ? '🔵' : '🏦'}
                                <span style={{ fontSize: '2rem' }}></span>
                            </div>
                            <h3 style={{ fontSize: '1.2rem' }}>¿Transferencia realizada?</h3>
                        </div>
                        <div className={styles.modalBody}>
                            {/* Resumen */}
                            <div className={styles.confirmationDetails} style={{ marginBottom: 20 }}>
                                <div className={styles.detailRow}>
                                    <span className={styles.detailLabel}>Técnico:</span>
                                    <span className={styles.detailValue}>{waitingVoucher.group.tecnico.nombre}</span>
                                </div>
                                <div className={styles.detailRow}>
                                    <span className={styles.detailLabel}>Número {waitingVoucher.wallet === 'yape' ? 'Yape' : waitingVoucher.wallet === 'plin' ? 'Plin' : 'Cuenta'}:</span>
                                    <span className={styles.detailValue} style={{ fontFamily: 'monospace', letterSpacing: '0.05em' }}>{waitingVoucher.numero}</span>
                                </div>
                                <div className={styles.detailRow}>
                                    <span className={styles.detailLabel}>Concepto:</span>
                                    <span className={styles.detailValue}>{waitingVoucher.item.tipo}</span>
                                </div>
                                <div className={styles.detailRow}>
                                    <span className={styles.detailLabel}>Monto transferido:</span>
                                    <span className={`${styles.detailValue} ${styles.popAmount}`}>S/ {formatSoles(waitingVoucher.item.monto)}</span>
                                </div>
                            </div>

                            {/* CTA: Subir captura de pantalla */}
                            <div className={styles.voucherCaptureArea}>
                                <Camera size={28} color="#7C3AED" />
                                <p style={{ margin: '8px 0 4px', fontWeight: 700, color: '#1E293B', fontSize: '0.95rem' }}>
                                    Sube la captura de tu {waitingVoucher.wallet === 'yape' ? 'Yape' : waitingVoucher.wallet === 'plin' ? 'Plin' : 'banco'}
                                </p>
                                <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748B', marginBottom: '16px' }}>
                                    La galería se abrirá directamente en tus capturas recientes
                                </p>
                                <a 
                                    href={waitingVoucher.wallet === 'yape' ? 'yape://' : waitingVoucher.wallet === 'plin' ? 'plin://' : 'https://www.bcp.com.pe'}
                                    className={styles.uploadScreenshotBtn}
                                    style={{ 
                                        background: '#F8FAFC', 
                                        color: '#1E293B', 
                                        border: '1px solid #E2E8F0', 
                                        marginBottom: '12px',
                                        textDecoration: 'none',
                                        display: 'flex',
                                        justifyContent: 'center'
                                    }}
                                >
                                    <ExternalLink size={16} />
                                    Abrir Billetera Manualmente
                                </a>
                                <label className={styles.uploadScreenshotBtn}>
                                    <Camera size={16} />
                                    Seleccionar captura de pantalla
                                    <input
                                        type="file"
                                        accept="image/*"
                                        style={{ display: 'none' }}
                                        onChange={(e) => {
                                            if (e.target.files?.[0]) {
                                                const reader = new FileReader();
                                                reader.onloadend = () => {
                                                    const capturedWaiting = waitingVoucher!;
                                                    setWaitingVoucher(null);
                                                    handleConfirmPayment(
                                                        capturedWaiting.group,
                                                        capturedWaiting.item,
                                                        reader.result as string
                                                    );
                                                    showToast('🎉 ¡Pago registrado y cerrado!');
                                                };
                                                reader.readAsDataURL(e.target.files[0]);
                                            }
                                        }}
                                    />
                                </label>
                            </div>

                            <div className={styles.modalFooter} style={{ marginTop: 20 }}>
                                <button className={styles.cancelBtn} onClick={() => setWaitingVoucher(null)}>
                                    Cancelar
                                </button>
                                <button
                                    className={styles.confirmBtn}
                                    style={{ background: 'linear-gradient(135deg,#7C3AED,#6D28D9)' }}
                                    onClick={() => {
                                        const capturedWaiting = waitingVoucher!;
                                        setWaitingVoucher(null);
                                        handleConfirmPayment(capturedWaiting.group, capturedWaiting.item, undefined);
                                        showToast('✅ Pago confirmado sin voucher');
                                    }}
                                >
                                    ✓ Confirmar sin voucher
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Voucher Lightbox */}
            {showVoucher && (
                <div onClick={() => setShowVoucher(null)}
                    style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'zoom-out' }}>
                    <div style={{ position: 'relative', maxWidth: '90%', maxHeight: '90%' }}>
                        <img src={showVoucher} alt="Voucher" style={{ width: '100%', height: 'auto', borderRadius: '12px', boxShadow: '0 25px 50px rgba(0,0,0,0.5)' }} />
                        <button onClick={() => setShowVoucher(null)}
                            style={{ position: 'absolute', top: '-14px', right: '-14px', width: 32, height: 32, borderRadius: '50%', background: 'white', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(0,0,0,0.3)' }}>
                            <X size={18} />
                        </button>
                    </div>
                </div>
            )}

            {/* Confirmation Modal */}
            {pendingConfirmation && (
                <div className={styles.modalOverlay}>
                    <div className={styles.modalContent}>
                        <div className={styles.modalHeader}>
                            <div className={styles.modalIcon}><CreditCard size={32} /></div>
                            <h3>Confirmar Transacción</h3>
                        </div>
                        <div className={styles.modalBody}>
                            <p className={styles.modalText}>{pendingConfirmation.message}</p>
                            <div className={styles.confirmationDetails}>
                                <div className={styles.detailRow}>
                                    <span className={styles.detailLabel}>Ticket:</span>
                                    <span className={styles.detailValue}>{pendingConfirmation.group.ticketNum}</span>
                                </div>
                                <div className={styles.detailRow}>
                                    <span className={styles.detailLabel}>Técnico:</span>
                                    <span className={styles.detailValue}>{pendingConfirmation.group.tecnico.nombre}</span>
                                </div>
                                <div className={styles.detailRow}>
                                    <span className={styles.detailLabel}>Concepto:</span>
                                    <span className={styles.detailValue}>{pendingConfirmation.item.tipo}</span>
                                </div>
                                <div className={styles.detailRow}>
                                    <span className={styles.detailLabel}>Monto a transferir:</span>
                                    <span className={`${styles.detailValue} ${styles.popAmount}`}>
                                        S/ {formatSoles(pendingConfirmation.item.monto)}
                                    </span>
                                </div>
                            </div>
                            <div className={styles.modalFooter}>
                                <button className={styles.cancelBtn} onClick={() => setPendingConfirmation(null)}>CANCELAR</button>
                                <button className={styles.confirmBtn} onClick={() => {
                                    handleConfirmPayment(pendingConfirmation.group, pendingConfirmation.item, pendingConfirmation.voucher);
                                    setPendingConfirmation(null);
                                }}>
                                    CONFIRMAR PAGO
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <style>{`
                @keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
                @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }
                @keyframes toastSlideIn { from{transform:translateX(120%);opacity:0} to{transform:translateX(0);opacity:1} }
                @keyframes toastSlideOut { from{transform:translateX(0);opacity:1} to{transform:translateX(120%);opacity:0} }
                @keyframes walletPulse { 0%,100%{box-shadow:0 4px 14px rgba(124,58,237,0.4)} 50%{box-shadow:0 4px 24px rgba(124,58,237,0.7)} }
            `}</style>
        </div>
    );
}
