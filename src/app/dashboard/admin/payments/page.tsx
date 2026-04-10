"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import {
    Wallet, History, CheckCircle2, Clock, ArrowUpRight,
    DollarSign, CreditCard, ChevronDown, ChevronUp,
    Building2, User, Upload, Eye, X,
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
    tipo: 'Adelanto' | 'Refuerzo' | 'Liquidación Final' | 'Movilidad / Visita' | 'Solicitud Gestora';
    monto: number;
    estado: 'pendiente' | 'pagado';
    fecha: string;
    voucherRef?: string | null;
    concepto?: string;    // Para solicitudes de gestora
    solicitudId?: string; // ID de la solicitud original para limpiarla al pagar
}

interface PaymentTicketGroup {
    ticketId: string;
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
    const history = meta.historialPagosTecnico || [];
    const hasPaidMobility = history.some((p: any) =>
        p.tipo === 'Movilidad / Visita' ||
        (p.referencia && (p.referencia.toLowerCase().includes("visita") || p.referencia.toLowerCase().includes("movilidad")))
    );
    const hasPaidAdelanto = history.some((p: any) =>
        p.tipo === 'Adelanto' ||
        (p.referencia && p.referencia.toLowerCase().includes("adelanto"))
    );

    return {
        ...t,
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
        adelantoPagado: meta.adelantoPagado || hasPaidAdelanto || false,
        visitPaymentConfirmed: meta.visitPaymentConfirmed || hasPaidMobility || false,
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
        montoFacturado: parseFloat(t.total_quoted_amount ?? t.montoFinal ?? meta.montoFinal ?? 0),
    };
}

export default function PaymentsPage() {
    const [tickets, setTickets] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchPaymentTickets = React.useCallback(async () => {
        try {
            setLoading(true);
            const data = await ticketsAPI.getForPayments();
            setTickets((data || []).map(flattenTicketForPayments));
        } catch (err) {
            console.error('[Payments] Error fetching tickets:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchPaymentTickets(); }, [fetchPaymentTickets]);

    useEffect(() => {
        const channel = supabase
            .channel('payments:tickets_realtime')
            .on('postgres_changes',
                { event: '*', schema: 'public', table: 'tickets' },
                () => { fetchPaymentTickets(); }
            )
            .subscribe();
        return () => { supabase.removeChannel(channel); };
    }, [fetchPaymentTickets]);

    const refresh = fetchPaymentTickets;

    const updateTicket = React.useCallback(async (id: string, updates: any) => {
        const updated = await ticketsAPI.update(id, updates);
        return updated;
    }, []);

    const [paymentGroups, setPaymentGroups] = useState<PaymentTicketGroup[]>([]);
    const [filter, setFilter] = useState<'todos' | 'pendiente' | 'pagado'>('todos');
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
        // Los OS modernos ignoran window.location si el scheme no está instalado;
        // en ese caso el admin simplemente cambia de app manualmente.
        await new Promise(r => setTimeout(r, 300)); // pequeño delay para que el toast sea visible
        const deepLinks: Record<string, string> = {
            yape: 'yape://',
            plin: 'plin://',
            banco: 'https://www.bcp.com.pe',
        };
        try {
            // Un pequeño delay para que el portapapeles se asiente y luego lanzamos el link
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

                const pagos = ticket.historialPagosTecnico || [];
                const totalPagadoArray = round2(pagos.reduce((sum: number, p: any) => sum + round2(p.monto || 0), 0));

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

                // Solo procesamos solicitudes si hay saldo pendiente y el ticket no está cerrado
                if (saldoReal > 0.01 && ticket.estadoId !== 'ticket_cerrado') {
                    const jobCostBase = round2(costoManoObra + costoMateriales);

                    // 1. Adelanto (SOLO SI HAY SOLICITUD PENDIENTE Y NO ESTÁ PAGADO)
                    if (ticket.solicitudAdelanto && !ticket.adelantoPagado) {
                        const pct = ticket.solicitudAdelanto.porcentaje || 0.5;
                        const adelantoMonto = round2(ticket.solicitudAdelanto.monto || (jobCostBase * pct));
                        if (adelantoMonto > 0) {
                            items.push({
                                id: `${ticket.id}_adelanto`,
                                tipo: 'Adelanto',
                                monto: adelantoMonto,
                                estado: 'pendiente',
                                fecha: ticket.solicitudAdelanto.fecha || new Date().toISOString()
                            });
                        }
                    }

                    // 2. Refuerzo (Extra)
                    if (ticket.solicitudAdelantoExtra && !ticket.solicitudAdelantoExtra.pagado) {
                        items.push({
                            id: `${ticket.id}_refuerzo`,
                            tipo: 'Refuerzo',
                            monto: ticket.solicitudAdelantoExtra.monto,
                            estado: 'pendiente',
                            fecha: ticket.solicitudAdelantoExtra.fecha
                        });
                    }

                    // 3. Solicitudes de depósito de Gestora (Pendientes)
                    if (ticket.solicitudesDeposito && ticket.solicitudesDeposito.length > 0) {
                        ticket.solicitudesDeposito.forEach((sol: any) => {
                            if (sol.estado === 'pendiente') {
                                items.push({
                                    id: `${ticket.id}_solicitud_${sol.id}`,
                                    tipo: 'Solicitud Gestora',
                                    monto: sol.monto,
                                    estado: 'pendiente',
                                    fecha: sol.fecha,
                                    concepto: sol.concepto,
                                    solicitudId: sol.id
                                });
                            }
                        });
                    }

                    // 4. Liquidación Final (SOLO SI HAY SOLICITUD PENDIENTE)
                    if (ticket.solicitudLiquidacion) {
                        items.push({
                            id: `${ticket.id}_final`,
                            tipo: 'Liquidación Final',
                            monto: round2(ticket.solicitudLiquidacion.monto || saldoReal),
                            estado: 'pendiente',
                            fecha: ticket.solicitudLiquidacion.fecha || new Date().toISOString()
                        });
                    }

                    // 5. Movilidad / Visita (SOLO SI HAY SOLICITUD PENDIENTE)
                    if (ticket.solicitudPagoVisita && !ticket.visitPaymentConfirmed) {
                        items.push({
                            id: `${ticket.id}_visita`,
                            tipo: 'Movilidad / Visita',
                            monto: round2(ticket.solicitudPagoVisita.monto || visitCost),
                            estado: 'pendiente',
                            fecha: ticket.solicitudPagoVisita.fecha || new Date().toISOString()
                        });
                    }
                }

                if (items.length > 0 || pagos.length > 0) {
                    allGroups.push({
                        ticketId: ticket.id,
                        ticketNum,
                        cliente: ticket.cliente?.nombre || 'Cliente',
                        sede: ticket.sede?.nombre || 'Sede',
                        tecnico: techData,
                        montoPactado: totalPactadoInclVisita,
                        montoAdelantado: totalPagadoArray,
                        saldoPendiente: totalPactadoInclVisita - totalPagadoArray,
                        items: items.filter(i => i.estado === 'pendiente'), // Doble filtro de seguridad
                        historialDepositos: pagos,
                        costoVisita: visitCost,
                        voucherVisita: pagos.find((p: any) => p.tipo === 'Movilidad / Visita' || p.referencia?.toLowerCase().includes("visita"))?.voucherRef,
                        montoFacturado: ticket.montoFacturado,
                        utilidad: Math.max(0, ticket.montoFacturado - (totalPactadoInclVisita + visitCost)),
                    });
                }
            } catch (e) {
                console.error("Error processing ticket for payments:", e);
            }
        });

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

        // 1. Optimistic Update — Desaparece de inmediato de la UI local
        setPaymentGroups(prev => 
            prev.map(g => {
                if (g.ticketId === group.ticketId) {
                    return { ...g, items: g.items.filter(i => i.id !== item.id) };
                }
                return g;
            })
        );

        try {
            // 2. Fetch fresh metadata
            const { data: currentTicket } = await (supabase as any)
                .from('tickets')
                .select('metadata')
                .eq('id', group.ticketId)
                .single();

            if (!currentTicket?.metadata) return;
            
            // Clonar metadata para limpieza profunda
            const meta = JSON.parse(JSON.stringify(currentTicket.metadata));

            // Limpiar según tipo (cubrir todas las variantes posibles de nombres de campo)
            if (item.tipo === 'Solicitud Gestora' && item.solicitudId) {
                meta.solicitudesDeposito = (meta.solicitudesDeposito || []).filter((s: any) => s.id !== item.solicitudId);
            } else if (item.tipo === 'Adelanto') {
                meta.solicitudAdelanto = null;
                meta.montoAdelanto = 0; // Limpiar monto persistente si existe
            } else if (item.tipo === 'Refuerzo') {
                meta.solicitudAdelantoExtra = null;
            } else if (item.tipo === 'Liquidación Final') {
                meta.solicitudLiquidacion = null;
            } else if (item.tipo === 'Movilidad / Visita') {
                meta.solicitudPagoVisita = null;
            }

            // Guardar en DB
            await (supabase as any)
                .from('tickets')
                .update({ metadata: meta })
                .eq('id', group.ticketId);

            showToast('✅ Solicitud denegada y eliminada');
            
            // 3. Refresh data for safety
            setTimeout(() => refresh(), 500);
        } catch (err) {
            console.error('[Payments] Error denying payment:', err);
            alert('Error al sincronizar la denegación. Por favor actualice la página.');
            refresh(); // Revertir si hay error
        }
    };

    const handleConfirmPayment = async (group: PaymentTicketGroup, item: PaymentItem, voucherBase64?: string | null) => {
        // Generar un ID único y determinista para el pago
        const pagoId = `pago_${group.ticketId}_${item.tipo.replace(/\s/g, '_')}_${Date.now()}`;

        const nuevoPago = {
            id: pagoId,
            monto: item.monto,
            fecha: new Date().toISOString(),
            tipo: item.tipo,
            estado: 'pagado',
            referencia: `Transferencia Web - ${item.tipo}`,
            voucherRef: voucherBase64 || null,
        };

        const additionalUpdates: any = { metadataFields: {} };

        // ✅ SOLICITUD GESTORA: Cuando el admin confirma el pago de una solicitud de la gestora,
        // se mueve del arreglo "solicitudesDeposito" (pendientes) al "historialPagosTecnico" (ejecutados)
        if (item.tipo === 'Solicitud Gestora' && item.solicitudId) {
            additionalUpdates.metadataFields = {
                // Añadir al historial como pago confirmado
                historialPagosTecnico_append: {
                    id: `pago_${group.ticketId}_${item.solicitudId}_${Date.now()}`,
                    fecha: new Date().toISOString(),
                    monto: item.monto,
                    tipo: 'Adelanto',
                    estado: 'pagado',
                    referencia: `Pago Autorizado: ${item.concepto || 'Solicitud Gestora'}`,
                    voucherRef: voucherBase64 || null,
                },
                // Marcar la solicitud como pagada (para que no re-aparezca)
                solicitudesDeposito_markPaid: item.solicitudId
            };
            // Usar función especial de actualización para este caso
            try {
                const { data: currentTicket } = await (supabase as any)
                    .from('tickets')
                    .select('metadata')
                    .eq('id', group.ticketId)
                    .single();

                if (currentTicket?.metadata) {
                    const meta = currentTicket.metadata;
                    // Añadir al historial de pagos
                    const historialActual = meta.historialPagosTecnico || [];
                    const nuevoPago = {
                        id: `pago_${item.solicitudId}_${Date.now()}`,
                        fecha: new Date().toISOString(),
                        monto: item.monto,
                        tipo: 'Adelanto',
                        estado: 'pagado',
                        referencia: `Pago Autorizado Admin: ${item.concepto || 'Solicitud Gestora'}`,
                        voucherRef: voucherBase64 || null,
                    };
                    // Marcar la solicitud como pagada en solicitudesDeposito
                    const solicitudesActualizadas = (meta.solicitudesDeposito || []).map((s: any) =>
                        s.id === item.solicitudId ? { ...s, estado: 'pagado', fechaPago: new Date().toISOString() } : s
                    );
                    const newMeta = {
                        ...meta,
                        historialPagosTecnico: [...historialActual, nuevoPago],
                        solicitudesDeposito: solicitudesActualizadas
                    };
                    await (supabase as any)
                        .from('tickets')
                        .update({ metadata: newMeta })
                        .eq('id', group.ticketId);
                    await refresh();
                    return; // Salir temprano — ya procesamos
                }
            } catch (err) {
                console.error('[Payments] Error confirmando solicitud gestora:', err);
                alert('Error al procesar el pago. Por favor intente de nuevo.');
            }
            return;
        }

        if (item.tipo === 'Adelanto') {
            additionalUpdates.status_id = 'en_ejecucion';
            additionalUpdates.execution_date = new Date().toISOString();
            additionalUpdates.metadataFields = {
                estadoId: 'en_ejecucion',
                fechaInicioEjecucion: additionalUpdates.execution_date,
                adelantoPagado: true,
                fechaPagoAdelanto: additionalUpdates.execution_date,
                solicitudAdelanto: null,
            };
        } else if (item.tipo === 'Refuerzo') {
            additionalUpdates.metadataFields = {
                solicitudAdelantoExtra: null,
            };
        } else if (item.tipo === 'Liquidación Final') {
            additionalUpdates.status_id = 'ticket_cerrado';
            additionalUpdates.closure_date = new Date().toISOString();
            additionalUpdates.metadataFields = {
                estadoId: 'ticket_cerrado',
                fechaPagoFinal: additionalUpdates.closure_date,
                solicitudLiquidacion: null,
            };
        } else if (item.tipo === 'Movilidad / Visita') {
            try {
                const { data: currentRow } = await (supabase as any)
                    .from('tickets')
                    .select('status_id')
                    .eq('id', group.ticketId)
                    .single();
                const preInspectionStates = ['nuevo', 'asignado', 'esperando_pago_visita', 'borrador', 'tecnico_asignado'];
                if (currentRow && preInspectionStates.includes(currentRow.status_id)) {
                    additionalUpdates.status_id = 'en_inspeccion';
                }
            } catch (_) { /* bypass */ }
            additionalUpdates.metadataFields = {
                visitPaymentConfirmed: true,
                fechaPagoVisita: new Date().toISOString(),
                solicitudPagoVisita: null,
            };
        }

        try {
            // USAMOS EL MÉTODO DEL CONTEXTO (AppDataContext)
            // Esto actualiza la caché de TanStack Query inmediatamente para el Dashboard
            await updatePaymentSafe(group.ticketId, nuevoPago, additionalUpdates);
            await refresh();
        } catch (err) {
            console.error('[Payments] Error confirming payment:', err);
            alert('Error al procesar el pago. Por favor intente de nuevo.');
        }
    };

    const getVoucherSrc = (ref?: string | null) => {
        if (!ref) return "";
        if (ref.startsWith("data:image")) return ref;
        return localStorage.getItem(ref) || "";
    };

    // ─── Métricas ──────────────────────────────────────────────
    const currentMonthKey = getCurrentMonthKey();
    const egresosEsteMes = round2(monthlyTotals[currentMonthKey] || 0);
    const totalPagadoHistorico = round2(Object.values(monthlyTotals).reduce((s, v) => s + v, 0));

    const pendingCount = paymentGroups.reduce((acc, g) => acc + g.items.filter(i => i.estado === 'pendiente').length, 0);
    const totalPendingAmount = round2(paymentGroups.reduce((acc, g) =>
        acc + g.items.filter(i => i.estado === 'pendiente').reduce((s, i) => s + i.monto, 0), 0));

    const filteredGroups = paymentGroups.filter(g => {
        if (filter === 'todos') return true;
        if (filter === 'pendiente') return g.items.some(i => i.estado === 'pendiente');
        if (filter === 'pagado') return g.items.some(i => i.estado === 'pagado') || g.historialDepositos.length > 0;
        return false;
    });

    const TIPO_CONFIG: Record<string, { color: string; bg: string; label: string }> = {
        'Adelanto': { color: '#2563EB', bg: '#EFF6FF', label: 'Adelanto' },
        'Refuerzo': { color: '#B45309', bg: '#FEF3C7', label: 'Refuerzo' },
        'Liquidación Final': { color: '#047857', bg: '#ECFDF5', label: 'Liquidación' },
        'Movilidad / Visita': { color: '#7C3AED', bg: '#F5F3FF', label: 'Movilidad' },
        'Solicitud Gestora': { color: '#DC2626', bg: '#FEF2F2', label: '🔔 Solicitado' },
    };

    return (
        <div className={styles.paymentsContainer}>

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
                        <span style={{ fontSize: '0.6rem', color: '#B45309', background: '#FEF3C7', padding: '2px 8px', borderRadius: '6px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.05em', border: '1px solid #FCD34D' }}>
                            SINFIMAC CORP - TESORERÍA v2.0
                        </span>
                        Peticiones de Fondos
                        <span style={{ background: pendingCount > 0 ? '#FEE2E2' : '#F0FDF4', color: pendingCount > 0 ? '#DC2626' : '#059669', fontSize: '0.75rem', fontWeight: 800, padding: '2px 10px', borderRadius: '20px' }}>
                            {filteredGroups.length} {filteredGroups.length === 1 ? 'registro' : 'registros'}
                        </span>
                    </h2>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        {(['todos', 'pendiente', 'pagado'] as const).map(f => (
                            <button key={f} onClick={() => setFilter(f)}
                                style={{
                                    padding: '7px 16px', borderRadius: '20px', border: 'none', cursor: 'pointer',
                                    fontWeight: 700, fontSize: '0.8rem', transition: 'all 0.2s',
                                    background: filter === f ? '#3B82F6' : '#F1F5F9',
                                    color: filter === f ? 'white' : '#64748B',
                                    boxShadow: filter === f ? '0 4px 10px rgba(59,130,246,0.3)' : 'none'
                                }}>
                                {f.charAt(0).toUpperCase() + f.slice(1)}
                            </button>
                        ))}
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
                                            <div className={styles.emptyState} style={{ padding: '60px 20px' }}>
                                                <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#F8FAFC', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                    <CheckCircle2 size={32} color="#10B981" />
                                                </div>
                                                <p style={{ color: '#64748B', fontWeight: 600 }}>No hay solicitudes en esta categoría.</p>
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
                                                        <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '7px 9px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                                <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.78rem', fontWeight: 700, color: '#475569' }}>
                                                                    <CreditCard size={11} />
                                                                    {group.tecnico.banco}
                                                                </div>
                                                                <div style={{ display: 'flex', gap: '4px' }}>
                                                                    {group.tecnico.yape && <span style={{ background: '#7C3AED', color: 'white', fontSize: '0.65rem', fontWeight: 800, padding: '2px 6px', borderRadius: '8px' }}>Yape {group.tecnico.yape}</span>}
                                                                    {group.tecnico.plin && <span style={{ background: '#0EA5E9', color: 'white', fontSize: '0.65rem', fontWeight: 800, padding: '2px 6px', borderRadius: '8px' }}>Plin {group.tecnico.plin}</span>}
                                                                </div>
                                                            </div>
                                                            <div style={{ fontFamily: 'monospace', fontSize: '0.72rem', color: '#64748B' }}>
                                                                <div>CTA: {group.tecnico.numeroCuenta}</div>
                                                                {group.tecnico.cci && group.tecnico.cci !== '---' && <div>CCI: {group.tecnico.cci}</div>}
                                                            </div>
                                                            {group.costoVisita && group.costoVisita > 0 && (
                                                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.73rem', color: '#7C3AED', fontWeight: 700, borderTop: '1px dashed #E2E8F0', paddingTop: '4px' }}>
                                                                    <ArrowUpRight size={11} />
                                                                    Visita: S/ {formatSoles(group.costoVisita)}
                                                                    {group.voucherVisita && (
                                                                        <button onClick={() => setShowVoucher(getVoucherSrc(group.voucherVisita))}
                                                                            style={{ marginLeft: '4px', background: '#EDE9FE', border: 'none', borderRadius: '4px', cursor: 'pointer', padding: '2px 5px', display: 'flex', alignItems: 'center', gap: '3px', color: '#7C3AED', fontSize: '0.65rem' }}>
                                                                            <Eye size={10} /> Ver
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </div>
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
                                                        {group.items.filter(i => i.estado === 'pendiente').map((item) => {
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
                                                            return (
                                                                <div key={`action-${item.id}`} className={styles.zeroFeeActions}>
                                                                    {/* Botón YAPE — Deep Link */}
                                                                    {hasYape && (
                                                                        <button
                                                                            className={styles.btnYape}
                                                                            onClick={() => handleDeepLinkPayment(group, item, 'yape')}
                                                                            title={`Copiar ${group.tecnico.yape} y abrir Yape`}
                                                                        >
                                                                            <span className={styles.walletEmoji}>💜</span>
                                                                            <span>Yape</span>
                                                                            <span className={styles.walletNum}>{group.tecnico.yape}</span>
                                                                            <Copy size={10} style={{ opacity: 0.7 }} />
                                                                        </button>
                                                                    )}
                                                                    {/* Botón PLIN — Deep Link */}
                                                                    {hasPlin && (
                                                                        <button
                                                                            className={styles.btnPlin}
                                                                            onClick={() => handleDeepLinkPayment(group, item, 'plin')}
                                                                            title={`Copiar ${group.tecnico.plin} y abrir Plin`}
                                                                        >
                                                                            <span className={styles.walletEmoji}>🔵</span>
                                                                            <span>Plin</span>
                                                                            <span className={styles.walletNum}>{group.tecnico.plin}</span>
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
                                                        {group.items.every(i => i.estado === 'pagado') && (
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
                                                                            <span style={{ fontSize: '0.78rem', color: '#475569' }}>{dep.tipo || 'Depósito'}</span>
                                                                            <strong style={{ fontSize: '1.05rem', color: '#1E293B', fontFamily: 'monospace' }}>S/ {formatSoles(dep.monto)}</strong>
                                                                            {dep.voucherRef && (
                                                                                <button onClick={() => {
                                                                                    const src = dep.voucherRef?.startsWith('data:image')
                                                                                        ? dep.voucherRef
                                                                                        : localStorage.getItem(dep.voucherRef) || dep.voucherRef || '';
                                                                                    if (src) setShowVoucher(src);
                                                                                }}
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
