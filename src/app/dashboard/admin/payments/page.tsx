"use client";

import React, { useState, useEffect, useCallback, useRef, memo } from "react";
import {
    Wallet, History, CheckCircle2, Clock, ArrowUpRight,
    DollarSign, CreditCard, ChevronDown, ChevronUp,
    Building2, User, Upload, Eye, X, Search, Filter,
    AlertCircle, Banknote, CalendarCheck, BarChart3, RefreshCw,
    Smartphone, Copy, ExternalLink, Camera, CheckCheck, AlertTriangle, ShieldAlert
} from "lucide-react";
import { normalizeStateId, TICKET_STATE_ORDER } from "@/lib/ticketStates";
import { ticketsAPI } from "@/lib/supabase-api";
import { supabase } from "@/lib/supabase";
import { useAppData } from "@/lib/AppDataContext";
import { round2, formatSoles } from "@/lib/formatters";
import { calculateTicketFinances, toNum } from "@/lib/calculations";
import { compressImage } from "@/lib/imageCompression";
import styles from "./payments.module.css";

// ──────────────────────────────────────────────────────────────
// UTILIDADES DE ESTABILIZACIÓN V4.5
// ──────────────────────────────────────────────────────────────

/**
 * Hook de Debounce para evitar parpadeos en inputs de valor
 * @param value - Valor a debounce
 * @param delay - Delay en ms (default: 500ms)
 */
function useDebounce<T>(value: T, delay: number = 500): T {
    const [debouncedValue, setDebouncedValue] = useState<T>(value);

    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedValue(value);
        }, delay);

        return () => {
            clearTimeout(handler);
        };
    }, [value, delay]);

    return debouncedValue;
}

/**
 * Componente de Fila de Pago con memo y debounce integrado
 * Evita renders多余的 y parpadeos durante edición rápida
 */
const PaymentRow = memo(function PaymentRow({ 
    item, 
    onConfirm, 
    onViewDetails,
    disabled 
}: { 
    item: PaymentItem; 
    onConfirm?: (item: PaymentItem) => void; 
    onViewDetails?: (item: PaymentItem) => void;
    disabled?: boolean;
}) {
    // Solo re-render si las props cambian significativamente
    const config = TIPO_CONFIG[item.tipo] || TIPO_CONFIG['Liquidación Final'];
    
    return (
        <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '12px 16px', background: config.bg, borderRadius: '10px',
            border: `1px solid ${config.color}30`, marginBottom: '8px',
            opacity: disabled ? 0.6 : 1, transition: 'all 0.2s ease'
        }}>
            <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <span style={{ 
                        fontSize: '0.75rem', fontWeight: 800, color: config.color,
                        background: 'white', padding: '2px 8px', borderRadius: '4px'
                    }}>
                        {item.tipo}
                    </span>
                    {item.isTableCost && (
                        <span style={{ fontSize: '0.65rem', color: '#6366F1', fontWeight: 600 }}>
                            📋 tabla_costs
                        </span>
                    )}
                    {item.isLegacy && (
                        <span style={{ fontSize: '0.65rem', color: '#D97706', fontWeight: 600 }}>
                            🏛️ legacy
                        </span>
                    )}
                </div>
                <div style={{ fontSize: '0.85rem', color: '#475569', fontWeight: 500 }}>
                    {item.concepto || 'Sin concepto'}
                </div>
                <div style={{ fontSize: '0.7rem', color: '#94A3B8', marginTop: '2px' }}>
                    {new Date(item.fecha).toLocaleDateString('es-PE', { 
                        day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' 
                    })}
                </div>
            </div>
            <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '1rem', fontWeight: 900, color: '#1E293B' }}>
                    S/ {formatSoles(item.monto)}
                </div>
                <div style={{ 
                    fontSize: '0.7rem', fontWeight: 700, 
                    color: item.estado === 'pagado' ? '#059669' : '#D97706',
                    marginTop: '4px'
                }}>
                    {item.estado === 'pagado' ? '✓ PAGADO' : '⏳ PENDIENTE'}
                </div>
            </div>
        </div>
    );
});

// ──────────────────────────────────────────────────────────────
// MODELO DE DATOS V3 - BANDEJA DE PAGOS
// ──────────────────────────────────────────────────────────────

interface PaymentItem {
    id: string;
    tipo: string;
    monto: number;
    estado: 'pendiente' | 'pagado' | 'requiere_aprobacion';
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
    isReference?: boolean; // Marca ítems usados como referencia histórica
    categoria?: string;    // Categoría del costo (MO, Gastos, etc)
    motivoRechazo?: string; // ★ NUEVO: Motivo de rechazo (opcional)
    gestoraId?: string;    // ★ NUEVO: ID de la gestora para notificaciones
}

interface PaymentTicketGroup {
    ticketId: string;     // ID único para la UI (puede incluir el especialista)
    realTicketId: string; // ID real en la tabla de base de datos 'tickets'
    ticketNum: string;
    cliente: string;
    sede: string;
    statusId?: string; // ★ NUEVO: estado del ticket para filtro
    isOpen?: boolean; // ★ NUEVO: si el ticket está abierto
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
    margen?: number; // Porcentaje de rentabilidad
    gastosOperativos: number; // ★ NUEVO: para desglose
    descripcion?: string;
    riesgoFinanciero?: boolean; // ★ NUEVO: indica riesgo por falta de aprobación de cliente
}

// ─────────────────────────────────────────────────────────
// Helper: normaliza la clave de mes en formato "YYYY-MM" para
// evitar inconsistencias de toLocaleString entre entornos/navegadores
// ─────────────────────────────────────────────────────────
function getMonthKey(dateStr: string): string {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return 'invalido';
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
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
// CONFIGURACIÓN DE TIPOS DE PAGO
// ─────────────────────────────────────────────────────────
const TIPO_CONFIG: { [key: string]: { color: string; bg: string; label: string } } = {
    'Adelanto': { color: '#7C3AED', bg: '#F5F3FF', label: '🟣 Adelanto' },
    'Refuerzo': { color: '#2563EB', bg: '#EFF6FF', label: '🔵 Refuerzo' },
    'Liquidación Final': { color: '#059669', bg: '#ECFDF5', label: '🟢 Liquidación' },
    'Saldo Pendiente (Auto)': { color: '#059669', bg: '#ECFDF5', label: '🟢 Liquidación' },
    'Movilidad / Visita': { color: '#D97706', bg: '#FFF7ED', label: '🟠 Movilidad' },
    'Viáticos / Movilidad': { color: '#D97706', bg: '#FFF7ED', label: '🟠 Viáticos' }
};

function flattenTicketForPayments(t: any) {
    if (!t) return t;
    let meta = t.metadata || {};
    let iterations = 0;
    while (meta.metadata && typeof meta.metadata === "object" && iterations < 5) {
        meta = { ...meta, ...meta.metadata };
        delete meta.metadata;
        iterations++;
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
        numeroTicketCliente: t.client_ticket_number || meta.numeroTicketCliente || (t.id ? `TK-${t.id.slice(-8).toUpperCase()}` : ""),
        costoManoObra: parseFloat(t.labor_cost ?? meta.costoManoObra ?? 0),
        costoMateriales: parseFloat(t.materials_cost ?? meta.costoMateriales ?? 0),
        costoVisita: parseFloat(t.visit_cost ?? meta.costoVisita ?? meta.costoPasaje ?? 0),
        solicitudAdelanto: meta.solicitudAdelanto ?? null,
        solicitudAdelantoExtra: meta.solicitudAdelantoExtra ?? null,
        solicitudLiquidacion: meta.solicitudLiquidacion ?? null,
        solicitudPago: meta.solicitudPago ?? null,
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
            id: t.technician_id || t.technicians?.id || meta.tecnico?.id,
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
        riesgoFinanciero: !!meta.riesgoFinanciero || (meta.solicitudAdelanto?.riesgoFinanciero === true)
    };
}

export default function PaymentsPage() {
    const [tickets, setTickets] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [fetchError, setFetchError] = useState<string | null>(null);
    const fetchTimerRef = useRef<NodeJS.Timeout | null>(null);
    const pendingPaymentsRef = useRef<Map<string, number>>(new Map());

    const fetchPaymentTickets = React.useCallback(async (isSilent = false) => {
        try {
            if (!isSilent) setLoading(true);
            setFetchError(null);

            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Timeout de conexión')), 60000)
            );

            const fetchPromise = (async () => {
                const data = await ticketsAPI.getForPayments();
                return data || [];
            })();

            const data = await Promise.race([fetchPromise, timeoutPromise]) as any[];
            
            const processed = (data || []).filter(Boolean).map((t: any) => {
                try {
                    const flat = flattenTicketForPayments(t);
                    const relatedCosts = t.costos || [];
                    flat.pendingCosts = relatedCosts.filter((c: any) => c.estado_pago === 'pendiente');
                    flat.paidCosts = relatedCosts.filter((c: any) => c.estado_pago === 'pagado' || c.estado_pago === 'adelanto');
                    flat.exceedanceRequests = relatedCosts.filter((c: any) => (c.estado_pago || '').toUpperCase() === 'REQUIERE_APROBACION_ADMIN');

                    flat.isOpen = !['ticket_cerrado', 'ticket_cancelado', 'ticket_rechazado'].includes(t.status_id);
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
        }, 300);
    }, [fetchPaymentTickets]);

    const handleApproveExceedance = async (costId: string) => {
        try {
            const { error } = await supabase
                .from('ticket_costs')
                .update({ estado_pago: 'pendiente' })
                .eq('id', costId);
            
            if (error) throw error;
            showToast('✅ Solicitud aprobada y enviada a Tesorería');
            refresh();
        } catch (err) {
            console.error('[Payments] Error approving exceedance:', err);
            alert('No se pudo aprobar la solicitud.');
        }
    };

    const handleRejectExceedance = async (costId: string) => {
        if (!confirm('¿Desea denegar permanentemente esta solicitud de excedente?')) return;
        try {
            const { error } = await supabase
                .from('ticket_costs')
                .update({ estado_pago: 'RECHAZADO' })
                .eq('id', costId);
            
            if (error) throw error;
            showToast('❌ Solicitud denegada');
            refresh();
        } catch (err) {
            console.error('[Payments] Error rejecting exceedance:', err);
            alert('No se pudo denegar la solicitud.');
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
    const [depositDate, setDepositDate] = useState<string>(new Date().toISOString().split('T')[0]);

    // ── ZERO-FEE DEEP LINK STATE ─────────────────────────────────
    // waitingVoucher: después del deep link, espera que el admin vuelva y suba el voucher
    const [waitingVoucher, setWaitingVoucher] = useState<{
        group: PaymentTicketGroup;
        item: PaymentItem;
        wallet: 'yape' | 'plin' | 'banco';
        numero: string;
        stage6Warning?: boolean;
    } | null>(null);

    // Toast flash (1s) para confirmar que el número fue copiado
    const [toast, setToast] = useState<{ msg: string; visible: boolean }>({ msg: '', visible: false });
    const [processingPayment, setProcessingPayment] = useState<string | null>(null); // ID del pago procesándose
    const [riskAlert, setRiskAlert] = useState<{ show: boolean, title: string, message: string, onConfirm: () => void }>({
        show: false,
        title: "",
        message: "",
        onConfirm: () => {}
    });
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

        // ⚠️ ADVERTENCIA RIESGO FINANCIERO (ETAPA 6)
        const isStage6 = group.statusId === 'cotizacion_enviada';

        // Marcar como "esperando voucher" ANTES de salir de la app
        setWaitingVoucher({ 
            group, 
            item, 
            wallet, 
            numero,
            stage6Warning: isStage6
        });

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

    const calculateMonthlyTotalsFromGroups = (groups: PaymentTicketGroup[]) => {
        const totals: { [key: string]: number } = {};
        const countedPaymentIds = new Set<string>();
        
        groups.forEach(group => {
            (group.historialDepositos || []).forEach((p: any) => {
                // Generar ID único robusto para evitar doble contabilidad
                const pId = p.id || `fallback_${group.realTicketId}_${p.monto}_${p.fecha || 'nodate'}_${p.tipo || 'notype'}`;
                
                if (!countedPaymentIds.has(pId)) {
                    const montoVal = p.monto; // Ya es número por normalizePayment
                    if (montoVal > 0 && p.estado !== 'anulado') {
                        // Usar la fecha normalizada del motor financiero
                        const key = getMonthKey(p.fecha);
                        totals[key] = round2((totals[key] || 0) + montoVal);
                        countedPaymentIds.add(pId);
                    }
                }
            });
        });
        setMonthlyTotals(totals);
    };

    const processTicketsToGroups = (allTickets: any[]) => {
        const allGroups: PaymentTicketGroup[] = [];

        allTickets.forEach(t => {
            try {
                const ticketNum = (t.numeroTicketCliente || t.client_ticket_number || (t.id ? `TK-${t.id.slice(-8).toUpperCase()}` : "S/N")).toUpperCase();
                const meta = t.metadata || {};
                
                // 🚀 MOTOR FINANCIERO V3: Fuente de Verdad Inmutable
                const finances = calculateTicketFinances(t, t.costos);
                const {
                    pactedMO,
                    totalLaborConfirmed,
                    totalOpConfirmed,
                    netLaborBalance,
                    laborItems,
                    operatingItems,
                    realProfitability,
                    margenReal
                } = finances;

                const allConfirmedHistory = [...laborItems, ...operatingItems].sort((a, b) => 
                    new Date(b.fecha || b.created_at || 0).getTime() - new Date(a.fecha || a.created_at || 0).getTime()
                );

                const techData = {
                    id: t.technician_id || t.technicians?.id || meta.tecnico?.id,
                    nombre: t.technicians?.name || meta.tecnico?.nombre || 'Sin asignar',
                    banco: t.technicians?.bank_name || meta.tecnico?.banco || '---',
                    numeroCuenta: t.technicians?.account_number || meta.tecnico?.numeroCuenta || '---',
                    cci: t.technicians?.cci || meta.tecnico?.cci || '---',
                    yape: t.technicians?.yape_number || meta.tecnico?.yape,
                    plin: t.technicians?.plin_number || meta.tecnico?.plin
                };

                const pendingItems: PaymentItem[] = [];

                // 1. Identificar ítems PENDIENTES (No están en finances.laborItems ni finances.operatingItems porque no están confirmados)
                
                // A. Costos de Tabla Pendientes
                (t.costos || []).forEach((c: any) => {
                    const st = (c.estado_pago || '').toUpperCase();
                    if (st === 'PENDIENTE' || st === 'REQUIERE_APROBACION_ADMIN') {
                        const isSpecialist = c.specialist_id && c.specialist_id !== t.technician_id;
                        const specialistName = isSpecialist ? (c.technicians?.name || c.proveedor || 'Especialista') : undefined;

                        pendingItems.push({
                            id: c.id,
                            tipo: `Gasto: ${c.categoria}`,
                            monto: c.monto,
                            estado: st === 'REQUIERE_APROBACION_ADMIN' ? 'requiere_aprobacion' : 'pendiente',
                            fecha: c.created_at,
                            concepto: c.concepto,
                            isTableCost: true,
                            costId: c.id,
                            specialistName,
                            specialistBanco: c.technicians?.bank_name,
                            specialistCuenta: c.technicians?.account_number,
                            specialistCCI: c.technicians?.cci,
                            specialistYape: c.technicians?.yape_number,
                            specialistPlin: c.technicians?.plin_number,
                            categoria: c.categoria,
                        });
                    }
                });

                // B. Solicitudes en Metadata (Adelanto/Liquidación/Visita)
                // ★ MEJORA 2026-05-12: Validar si la solicitud ya está en el historial (evita zombies)
                const adelantoMonto = meta.solicitudAdelanto?.monto || 0;
                const adelantoInHistory = adelantoMonto > 0 && laborItems.some(i => i.tipo?.toLowerCase().includes('adelanto') && Math.abs(i.monto - adelantoMonto) < 1);
                
                const pagoMonto = meta.solicitudPago?.monto || 0;
                const pagoInHistory = pagoMonto > 0 && laborItems.some(i => i.tipo?.toLowerCase().includes('visita') && Math.abs(i.monto - pagoMonto) < 1);

                if (meta.solicitudAdelanto && !adelantoInHistory) {
                    pendingItems.push({
                        id: `${t.id}_adelanto`,
                        tipo: 'Adelanto',
                        monto: round2(adelantoMonto),
                        estado: 'pendiente',
                        fecha: meta.solicitudAdelanto.fecha || t.created_at
                    });
                }

                if (meta.solicitudPago && !pagoInHistory) {
                    pendingItems.push({
                        id: `${t.id}_visita`,
                        tipo: 'Pago de Visita',
                        monto: round2(pagoMonto),
                        estado: 'pendiente',
                        fecha: meta.solicitudPago.fecha || t.created_at
                    });
                }

                if (meta.solicitudLiquidacion) {
                    pendingItems.push({
                        id: `${t.id}_liquidacion_manual`,
                        tipo: 'Liquidación Final',
                        monto: round2(meta.solicitudLiquidacion.monto || 0),
                        estado: 'pendiente',
                        fecha: meta.solicitudLiquidacion.fecha || t.created_at,
                        concepto: meta.solicitudLiquidacion.concepto || "Saldo Solicitado"
                    });
                }

                const isPorLiquidar = ['por_liquidar', 'requiere_revision_admin', 'esperando_pago_final'].includes(t.status_id);
                
                const liqMonto = meta.solicitudLiquidacion?.monto || 0;
                const liqInHistory = liqMonto > 0 && laborItems.some(i => i.tipo?.toLowerCase().includes('liquidación') && Math.abs(i.monto - liqMonto) < 1);

                const hasPendingRequests = (meta.solicitudAdelanto && !adelantoInHistory) || 
                                          (meta.solicitudPago && !pagoInHistory) || 
                                          (meta.solicitudLiquidacion && !liqInHistory);

                const hasLiquidacionPaid = laborItems.some(i => i.tipo?.toLowerCase().includes('liquidación'));
                // ★ MEJORA: No mostrar liquidación automática si hay solicitudes pendientes de excedentes/rescates
                if (isPorLiquidar && !hasLiquidacionPaid && !hasPendingRequests) {
                    // 🚀 V3: La liquidación debe ser el saldo real de mano de obra (Pactado - Pagado)
                    // Solo mostrar si NO hay solicitudes pendientes de aprobación
                    const autoLiqMonto = round2(netLaborBalance);
                    if (autoLiqMonto > 0.01) {
                        pendingItems.push({
                            id: `${t.id}_final`,
                            tipo: 'Liquidación Final',
                            monto: autoLiqMonto,
                            estado: 'pendiente',
                            fecha: new Date().toISOString(),
                            concepto: "Saldo de Mano de Obra"
                        });
                    }
                }

                // C. Solicitudes de Depósito (Sustituido por ticket_costs en V3)

                // 2. Separar ítems por beneficiario
                const techItems = pendingItems.filter(i => !i.specialistName);
                const specialistGroups: { [name: string]: PaymentItem[] } = {};
                pendingItems.forEach(i => {
                    if (i.specialistName) {
                        if (!specialistGroups[i.specialistName]) specialistGroups[i.specialistName] = [];
                        specialistGroups[i.specialistName].push(i);
                    }
                });

                // A: Grupo del Técnico Principal
                if (techItems.length > 0 || allConfirmedHistory.length > 0) {
                    // Si no hay pendientes pero hay historial, mostrar el último como referencia
                    if (techItems.length === 0 && allConfirmedHistory.length > 0) {
                        const lastP = allConfirmedHistory[0];
                        techItems.push({
                            id: `${t.id}_ref`,
                            tipo: `Último Pago: ${lastP.tipo || lastP.categoria}`,
                            monto: lastP.monto,
                            estado: 'pagado',
                            fecha: lastP.fecha,
                            isReference: true
                        });
                    }

                    allGroups.push({
                        ticketId: t.id,
                        realTicketId: t.id,
                        ticketNum,
                        cliente: t.clients?.name || 'Cliente',
                        sede: t.branch_offices?.name || 'Sede',
                        statusId: t.status_id,
                        isOpen: !['ticket_cerrado', 'ticket_cancelado', 'ticket_rechazado'].includes(t.status_id),
                        tecnico: techData,
                        montoPactado: pactedMO,
                        montoAdelantado: totalLaborConfirmed + totalOpConfirmed,
                        saldoPendiente: netLaborBalance,
                        items: techItems,
                        historialDepositos: allConfirmedHistory,
                        montoFacturado: t.total_quoted_amount || 0,
                        utilidad: realProfitability,
                        margen: margenReal,
                        gastosOperativos: totalOpConfirmed,
                        descripcion: t.description || '',
                    });
                }

                // B: Grupos de Especialistas Externos
                Object.keys(specialistGroups).forEach(name => {
                    const sItems = specialistGroups[name];
                    const first = sItems[0];
                    allGroups.push({
                        ticketId: `${t.id}_${name}`,
                        realTicketId: t.id,
                        ticketNum,
                        cliente: t.clients?.name || 'Cliente',
                        sede: t.branch_offices?.name || 'Sede',
                        statusId: t.status_id,
                        isOpen: true,
                        tecnico: {
                            nombre: name,
                            banco: first.specialistBanco || '---',
                            numeroCuenta: first.specialistCuenta || '---',
                            cci: first.specialistCCI || '---',
                            yape: first.specialistYape,
                            plin: first.specialistPlin
                        },
                        montoPactado: 0,
                        montoAdelantado: 0,
                        saldoPendiente: 0,
                        items: sItems,
                        historialDepositos: [],
                        montoFacturado: 0,
                        utilidad: 0,
                        gastosOperativos: 0,
                    });
                });

            } catch (e) {
                console.error("Error processing ticket for treasury:", t.id, e);
            }
        });

        // Ordenar: Pendientes primero, luego por fecha
        allGroups.sort((a, b) => {
            const pendingA = a.items.some(i => i.estado === 'pendiente');
            const pendingB = b.items.some(i => i.estado === 'pendiente');
            if (pendingA !== pendingB) return pendingA ? -1 : 1;
            return new Date(b.items[0]?.fecha || 0).getTime() - new Date(a.items[0]?.fecha || 0).getTime();
        });

        setPaymentGroups(allGroups);
        calculateMonthlyTotalsFromGroups(allGroups);
    };

    // ★ USAMOS CONTEXTO PARA ACTUALIZACIÓN INMEDIATA EN DASHBOARD
    // ★ V3 CORE: No usamos updatePaymentSafe - solo ticket_costs
    const denyPaymentRef = useRef(false);

    const handleDenyPayment = async (group: PaymentTicketGroup, item: PaymentItem) => {
        const motivoRechazo = prompt(`¿Está seguro que desea denegar este pago de S/ ${formatSoles(item.monto)}?\n\nIngrese el motivo del rechazo:`, "No cumple con los requisitos");
        
        if (motivoRechazo === null) return; // Cancelado por el usuario

        if (denyPaymentRef.current) return;
        denyPaymentRef.current = true;

        try {
            let newStatusId = null;
            
            // Determinar reversión de estado basada en el tipo de pago
            const isVisita = item.tipo?.toLowerCase().includes('movilidad') || item.tipo?.toLowerCase().includes('visita') || (item.categoria || '').toLowerCase().includes('viático') || (item.categoria || '').toLowerCase().includes('movilidad');
            const isFinal = item.tipo?.toLowerCase().includes('liquidación') || item.tipo?.toLowerCase().includes('final') || (item.categoria || '').toLowerCase().includes('mano de obra') || (item.categoria || '').toLowerCase().includes('pago mo');
            const isAdelanto = item.tipo?.toLowerCase().includes('adelanto') || (item.categoria || '').toLowerCase().includes('adelanto');

            if (isVisita) newStatusId = 'tecnico_asignado';
            else if (isFinal) newStatusId = 'documentacion_enviada';
            else if (isAdelanto) newStatusId = 'cotizacion_aprobada';

            // 1. SI ES COSTO DE TABLA (ticket_costs)
            // 1. DENEGAR COSTO DE TABLA (V3 / Canal 2 / Specialists)
            if (item.isTableCost && item.costId) {
                // Actualizar el costo individual
                await supabase
                    .from('ticket_costs')
                    .update({ 
                        estado_pago: 'RECHAZADO',
                        fecha_pago: new Date().toISOString() 
                    })
                    .eq('id', item.costId);

                // Reversión de estado del Ticket si el costo es crítico
                const { data: ticketRef } = await supabase
                    .from('tickets')
                    .select('status_id, metadata')
                    .eq('id', group.realTicketId)
                    .single();

                if (ticketRef) {
                    let nextStatus = null;
                    const cat = (item.categoria || '').toUpperCase();
                    const currentId = ticketRef.status_id;
                    const meta = ticketRef.metadata || {};

                    if ((cat.includes('VISITA') || cat.includes('MOVILIDAD') || cat.includes('VIÁTICO')) && currentId === 'esperando_pago_visita') {
                        nextStatus = 'tecnico_asignado';
                    } else if ((cat.includes('MANO DE OBRA') || cat.includes('PAGO MO') || cat.includes('LIQUIDACIÓN') || cat.includes('RESCATE')) && 
                             ['por_liquidar', 'esperando_pago_final', 'requiere_revision_admin', 'documentacion_enviada'].includes(currentId)) {
                        nextStatus = 'documentacion_enviada';
                    }

                    if (nextStatus) {
                        // ★ FIX: Limpiar todas las solicitudes de pago al denegar
                        // Esto evita que la solicitud reaparezca después de la denegación
                        const newMeta = { 
                            ...meta, 
                            estadoId: nextStatus,
                            // Limpiar solicitudes de pago al denegar
                            solicitudLiquidacion: nextStatus === 'documentacion_enviada' ? null : meta.solicitudLiquidacion,
                            solicitudPago: nextStatus === 'tecnico_asignado' ? null : meta.solicitudPago,
                            solicitudAdelanto: null, 
                            // Registrar rechazo
                            pagoRechazado: {
                                fecha: new Date().toISOString(),
                                monto: item.monto,
                                tipo: item.tipo,
                                concepto: item.concepto || 'Denegado por Tesorería'
                            },
                            // Guardar en historial
                            historialRechazos: [...(meta.historialRechazos || []), {
                                fecha: new Date().toISOString(),
                                monto: item.monto,
                                tipo: item.tipo,
                                categoria: item.categoria,
                                concepto: item.concepto || 'Denegado por Tesorería'
                            }]
                        };
                        await supabase.from('tickets').update({ 
                            status_id: nextStatus,
                            metadata: newMeta
                        }).eq('id', group.realTicketId);
                    }
                }
                
                showToast('❌ Pago denegado y estado del ticket revertido.');
                refresh();
                return;
            }

            // 2. LOGICA PARA METADATA (LEGACY / SOLICITUDES GESTORA)
            const { data: currentTicket, error: fetchErr } = await supabase
                .from('tickets')
                .select('metadata, status_id, labor_cost, total_quoted_amount, technician_id, materials_cost, visit_cost')
                .eq('id', group.realTicketId)
                .single();

            if (fetchErr) throw fetchErr;
            if (!currentTicket) throw new Error("Ticket no encontrado");
            
            const meta = { ...currentTicket.metadata };
            const currentStatus = currentTicket.status_id;
            newStatusId = null; // Reiniciar para este bloque

            // ★ V4: DENEGACIÓN ROBUSTA - Eliminar de pendientes y mover a históricos
            const rechazoBase = {
                ...item,
                fechaRechazo: new Date().toISOString(),
                estado: 'rechazado',
                motivo: motivoRechazo || item.concepto || 'Denegado por Tesorería'
            };

            if (item.solicitudId) {
                const found = (meta.solicitudesDeposito || []).find((s: any) => s.id === item.solicitudId);
                meta.solicitudesRechazadas = [...(meta.solicitudesRechazadas || []), { ...(found || item), ...rechazoBase }];
                meta.solicitudesDeposito = (meta.solicitudesDeposito || []).filter((s: any) => s.id !== item.solicitudId);
            } else if (item.id === `${group.realTicketId}_adelanto` || item.tipo === 'Adelanto' || isAdelanto) {
                meta.historialRechazosAdelanto = [...(meta.historialRechazosAdelanto || []), { ...(meta.solicitudAdelanto || item), ...rechazoBase }];
                meta.solicitudAdelanto = null;
                meta.adelantoRechazado = true;
                if (currentStatus === 'en_ejecucion') {
                    newStatusId = 'cotizacion_aprobada';
                }
            } else if (item.id === `${group.realTicketId}_refuerzo` || item.tipo === 'Refuerzo') {
                meta.solicitudAdelantoExtra = null;
                meta.historialRechazosAdelanto = [...(meta.historialRechazosAdelanto || []), { ...rechazoBase, tipo: 'Refuerzo' }];
            } else if (isFinal) {
                meta.historialRechazosLiquidacion = [...(meta.historialRechazosLiquidacion || []), { ...(meta.solicitudLiquidacion || item), ...rechazoBase }];
                meta.solicitudLiquidacion = null;
                if (['por_liquidar', 'esperando_pago_final', 'requiere_revision_admin'].includes(currentStatus)) {
                    newStatusId = 'documentacion_enviada';
                }
            } else if (isVisita) {
                meta.historialRechazosVisita = [...(meta.historialRechazosVisita || []), { ...(meta.solicitudPago || item), ...rechazoBase }];
                meta.solicitudPago = null;
                if (currentStatus === 'esperando_pago_visita') {
                    newStatusId = 'tecnico_asignado';
                }
            }

            const dbUpdates: any = { 
                metadata: {
                    ...meta,
                    pagoRechazado: {
                        fecha: new Date().toISOString(),
                        monto: item.monto,
                        tipo: item.tipo,
                        concepto: item.concepto || 'Denegado por Tesorería',
                        mensajeRechazo: motivoRechazo || 'Pago denegado por Tesorería'
                    }
                } 
            };

            if (newStatusId) {
                dbUpdates.status_id = newStatusId;
                dbUpdates.metadata.estadoId = newStatusId;
            }

            // ★ NUEVO: Guardar notificación para la gestora
            const notificacionGestora = {
                id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                tipo: 'SOLICITUD_DENEGADA',
                titulo: '❌ Solicitud de Pago Denegada',
                mensaje: `Tu solicitud de ${item.tipo || 'pago'} por S/ ${formatSoles(item.monto)} ha sido denegada. Motivo: ${motivoRechazo}`,
                ticketId: group.realTicketId,
                ticketNum: group.ticketNum,
                fecha: new Date().toISOString(),
                leida: false,
                prioridad: 'alta'
            };
            dbUpdates.metadata.notificacionesGestora = [...(meta.notificacionesGestora || []), notificacionGestora];

            const { error: finalUpdErr } = await supabase
                .from('tickets')
                .update(dbUpdates)
                .eq('id', group.realTicketId);
            
            if (finalUpdErr) throw finalUpdErr;

            // ★ NUEVO: Notificación Realtime para la gestora
            showToast(`❌ Solicitud de pago denegada. El ticket ha vuelto a su estado anterior.`);
            refresh();
        } catch (err: any) {
            console.error('[Payments] Error detallado al denegar pago:', err);
            alert(`Error al denegar el pago: ${err.message || 'Error desconocido'}`);
        } finally {
            denyPaymentRef.current = false;
        }
    };

    const handleDeleteHistoryItem = async (group: PaymentTicketGroup, dep: any) => {
        if (!confirm(`¿ESTÁ SEGURO DE ELIMINAR ESTE REGISTRO DE PAGO?\n⚠️ Esta acción es irreversible y afectará el balance del técnico.`)) {
            return;
        }

        try {
            const { data: currentTicket } = await supabase
                .from('tickets')
                .select('metadata, status_id, labor_cost, total_quoted_amount, technician_id, materials_cost, visit_cost')
                .eq('id', group.realTicketId)
                .single();

            if (!currentTicket?.metadata) return;
            
            const meta = { ...currentTicket.metadata };
            const historial = meta.historialPagosTecnico || [];
            
            const nuevoHistorial = historial.filter((p: any) => p.id !== dep.id);
            const nuevoTotal = nuevoHistorial.reduce((sum: number, p: any) => sum + (p.monto || 0), 0);

            // FIX: Guardar en AMBAS variantes para consistencia cross-módulos
            meta.historialPagosTecnico = nuevoHistorial;
            meta.historialPagosTécnico = nuevoHistorial;
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

    // ─────────────────────────────────────────────────────────
    // SMART PAYMENT FLOW: Yape / Plin / Transferencia
    // ─────────────────────────────────────────────────────────
    const handleSmartPayment = (group: PaymentTicketGroup, item: PaymentItem) => {
        setDepositDate(new Date().toISOString().split('T')[0]); // Reset a hoy
        const montoStr = formatSoles(item.monto);
        const phone = group.tecnico.plin || group.tecnico.yape || "";
        
        // ⚠️ ADVERTENCIA RIESGO FINANCIERO (ANTES DE APROBACIÓN - ETAPA < 7)
        // Se excluyen los pagos de visita (Stage 4) que son normales antes de cotizar.
        const currentOrder = TICKET_STATE_ORDER[normalizeStateId(group.statusId)] || 0;
        const isPreApproved = currentOrder < 7;
        const isVisitPayment = item.tipo?.toLowerCase().includes('visita') || item.concepto?.toLowerCase().includes('visita');
        
        if (isPreApproved && !isVisitPayment) {
            setRiskAlert({
                show: true,
                title: "⚠️ ALERTA DE RIESGO FINANCIERO",
                message: `El ticket ${group.ticketNum} de ${group.cliente} aún no ha sido aprobado por el cliente. Realizar abonos en esta etapa representa un riesgo financiero. ¿Desea proceder con la operación?`,
                onConfirm: () => {
                    setRiskAlert(prev => ({ ...prev, show: false }));
                    executeSmartPayment(group, item, phone);
                }
            });
            return;
        }

        executeSmartPayment(group, item, phone);
    };

    const executeSmartPayment = (group: PaymentTicketGroup, item: PaymentItem, phone: string) => {
        const montoStr = formatSoles(item.monto);

        // Si el técnico tiene Yape o Plin, intentamos Deep Link
        if (phone && (group.tecnico.yape || group.tecnico.plin)) {
            const wallet = group.tecnico.yape ? 'yape' : 'plin';
            const deepLink = wallet === 'yape' 
                ? `yape://pay?number=${phone}&amount=${item.monto}`
                : `plin://pay?number=${phone}&amount=${item.monto}`;

            // Abrimos la app y mostramos el modal de espera
            window.location.href = deepLink;
            
            setWaitingVoucher({
                group,
                item,
                wallet,
                numero: phone
            });
            return;
        }

        // Si no tiene billetera móvil, vamos a confirmación directa
        setPendingConfirmation({
            group,
            item,
            message: `¿Desea registrar el pago de S/ ${montoStr} para ${group.tecnico.nombre}?`,
            voucher: null
        });
    };

    const handleConfirmPayment = useCallback(async (group: PaymentTicketGroup, item: PaymentItem, voucherBase64?: string | null, forcedDate?: string) => {
        // ─────────────────────────────────────────────────────────────────────────────
        // V3 CORE ABSOLUTO: Sin metadata, solo ticket_costs
        // Bloquea cualquier intento de pago duplicado en un intervalo de 2 segundos
        // ─────────────────────────────────────────────────────────────────────────────
        const paymentKey = `${group.realTicketId}_${item.id || item.costId}`;
        const now = Date.now();
        
        if (pendingPaymentsRef.current.has(paymentKey)) {
            showToast('⏳ Hay una operación de pago en progreso. Espere un momento...');
            return;
        }

        // ★ UI BLINDAJE: Desactivar botón inmediatamente
        setProcessingPayment(item.costId || item.id);
        
        // Marcar como en proceso
        pendingPaymentsRef.current.set(paymentKey, now);
        
        // Cleanup después de 2 segundos
        setTimeout(() => {
            pendingPaymentsRef.current.delete(paymentKey);
        }, 2000);

        const finalDate = (forcedDate && forcedDate.trim() !== "") 
            ? new Date(forcedDate + "T12:00:00").toISOString() 
            : new Date().toISOString();

        // ★ V3 CORE: Generar hash único para bloqueo en DB
        // Hash = ticket_id + monto + concepto (para detectar duplicados)
        const hashUnico = `${group.realTicketId}_${item.monto}_${(item.concepto || item.tipo).replace(/\s/g, '_')}`;
        
        try {
            // ─────────────────────────────────────────────────────────────────────────
            // FLUJO V3 CORE: Solo insertamos en ticket_costs, jamás en metadata
            // ─────────────────────────────────────────────────────────────────────────
            
            // SI Ya existe un costo confirmado con mismo hash,bloqueamos
            if (item.isTableCost && item.costId) {
                // Caso 1: Actualizar costo existente en ticket_costs (ya tiene ID)
                const { error: costErr } = await supabase
                    .from('ticket_costs')
                    .update({ 
                        estado_pago: 'pagado', 
                        url_comprobante: voucherBase64 || null,
                        fecha_pago: finalDate
                    })
                    .eq('id', item.costId);
                
                if (costErr) throw costErr;
                
                showToast('✅ Pago de costo registrado en ticket_costs');
                refresh();
                return;
            }
            
            // Caso 2: Crear nuevo registro en ticket_costs (sin ID previo = solicitud de metadata migrada)
            // Verificar si ya existe un registro con mismo hash para evitar duplicados
            const { data: existingCosts } = await supabase
                .from('ticket_costs')
                .select('id, estado_pago, monto, concepto')
                .eq('ticket_id', group.realTicketId)
                .eq('estado_pago', 'pagado')
                .eq('monto', item.monto)
                .limit(1);
            
            // Si ya existe un pago confirmado con mismo monto,bloqueamos
            if (existingCosts && existingCosts.length > 0) {
                showToast('⚠️ Ya existe un pago confirmado por este monto');
                return;
            }
            
            // Insertar nuevo costo en ticket_costs
            const nuevoCosto = {
                ticket_id: group.realTicketId,
                technician_id: group.tecnico?.id || null,
                categoria: item.tipo, // Adelanto,Refuerzo,Liquidación,etc
                concepto: item.concepto || item.tipo,
                monto: item.monto,
                estado_pago: 'pagado',
                url_comprobante: voucherBase64 || null,
                fecha_pago: finalDate,
                created_at: finalDate,
                // Campos adicionales para trazabilidad
                approved_by: 'admin',
                approval_date: finalDate
            };
            
            const { error: insertErr } = await supabase
                .from('ticket_costs')
                .insert(nuevoCosto);
            
            if (insertErr) {
                // Si hay error de unique constraint,el DB ya bloquería
                if (insertErr.code === '23505') {
                    showToast('⚠️ Este pago ya fue confirmado por otro usuario');
                    return;
                }
                throw insertErr;
            }
            
            showToast('✅ Pago confirmado en ticket_costs (V3 Core)');
            refresh();
        } catch (err) {
            console.error('[Payments V3] Error confirming payment:', err);
            alert('Error al procesar el pago.');
        }
    }, [refresh, showToast, supabase, pendingPaymentsRef]);

    const getVoucherSrc = (ref?: string | null) => {
        if (!ref) return "";
        if (ref.startsWith("data:image")) return ref;
        return localStorage.getItem(ref) || "";
    };

    const currentMonthKey = getCurrentMonthKey();
    const egresosEsteMes = round2(monthlyTotals[currentMonthKey] || 0);
    const totalPagadoHistorico = round2(Object.values(monthlyTotals).reduce((s: any, v: any) => s + v, 0) as number);

    const pendingCount = paymentGroups.reduce((acc, g) => {
        const isClosed = ['ticket_cerrado', 'ticket_cancelado', 'ticket_rechazado'].includes(g.statusId || '');
        if (isClosed) return acc;
        return acc + g.items.filter(i => (i.estado === 'pendiente' || i.estado === 'requiere_aprobacion') && i.monto > 0 && !i.isReference).length;
    }, 0);

    const totalPendingAmount = round2(paymentGroups.reduce((acc, g) => {
        const isClosed = ['ticket_cerrado', 'ticket_cancelado', 'ticket_rechazado'].includes(g.statusId || '');
        if (isClosed) return acc;
        return acc + g.items.filter(i => (i.estado === 'pendiente' || i.estado === 'requiere_aprobacion') && i.monto > 0 && !i.isReference).reduce((s, i) => s + i.monto, 0);
    }, 0));

    const filteredGroups = paymentGroups.filter(g => {
        const lowerSearch = searchTerm.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        const match = (val: string) => (val || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").includes(lowerSearch);
        
        const matchesSearch = !searchTerm || 
            match(g.ticketNum) ||
            match(g.cliente) ||
            match(g.sede) ||
            match(g.tecnico?.nombre) ||
            match(g.descripcion || "");



        const isTicketClosed = g.statusId === 'ticket_cerrado' || g.statusId === 'ticket_cancelado' || g.statusId === 'ticket_rechazado';
        
        // 1. Identificar si hay ítems realmente pendientes (no históricos/referencia)
        const hasPendingItems = g.items.some(i => (i.estado === 'pendiente' || i.estado === 'requiere_aprobacion') && !i.isReference);
        
        // 2. Identificar si tiene historial de pagos (o ítems ya marcados como pagados)
        const hasPaidItems = g.items.some(i => i.estado === 'pagado' && !i.isReference) || (g.historialDepositos || []).length > 0;

        let matchesStatus = false;
        if (filter === 'todos') {
            matchesStatus = true;
        } else if (filter === 'pendiente') {
            // Bandeja PENDIENTE: Tickets no cerrados que tienen solicitudes de pago activas
            matchesStatus = hasPendingItems && !isTicketClosed;
        } else if (filter === 'pagado') {
            // Bandeja PAGADOS: Tickets (abiertos o cerrados) donde todo lo solicitado ya se pagó
            // Incluimos referencias históricas para que el Admin pueda ver qué se pagó recientemente.
            matchesStatus = (!hasPendingItems || isTicketClosed) && (hasPaidItems || g.items.some(i => i.isReference));
        }
        
        return matchesSearch && matchesStatus;
    });



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
                            Aprobaciones de Gasto y Rescate por Excedente ({allExceedanceRequests.length})
                        </h3>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '12px' }}>
                        {allExceedanceRequests.map((req: any) => (
                            <div key={req.id} style={{ background: 'white', border: '1px solid #FEE2E2', borderRadius: '12px', padding: '15px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                    <div>
                                        <p style={{ margin: 0, fontSize: '0.7rem', color: '#94A3B8', fontWeight: 800 }}>
                                            TICKET: {req.ticket?.numeroTicketCliente || (req.ticket?.id ? `TK-${req.ticket.id.slice(-8).toUpperCase()}` : 'S/N')}
                                        </p>
                                        <p style={{ margin: '2px 0 0', fontSize: '0.85rem', fontWeight: 700, color: '#1E293B' }}>
                                            {req.categoria === 'Rescate Financiero' ? 'RESCATE PARA: ' : 'GASTO PARA: '}
                                            <span style={{ color: '#3B82F6' }}>
                                                {req.technicians?.name || req.proveedor || req.ticket?.tecnico?.nombre || 'Especialista'}
                                            </span>
                                        </p>
                                    </div>
                                    <div style={{ textAlign: 'right' }}>
                                        <div style={{ fontSize: '0.6rem', fontWeight: 900, color: '#94A3B8', textTransform: 'uppercase', marginBottom: '2px' }}>
                                            {req.categoria}
                                        </div>
                                        <div style={{ fontSize: '1.1rem', fontWeight: 900, color: '#EF4444' }}>
                                            {formatSoles(req.monto)}
                                        </div>
                                    </div>
                                </div>
                                <div style={{ background: '#F8FAFC', padding: '8px 12px', borderRadius: '8px', fontSize: '0.75rem', color: '#475569', borderLeft: '3px solid #EF4444' }}>
                                    <div style={{ fontWeight: 800, color: '#1E293B', marginBottom: '2px', fontSize: '0.65rem', textTransform: 'uppercase' }}>Detalle de la Solicitud:</div>
                                    {req.concepto || req.motivo || 'Gasto operativo por excedente de presupuesto.'}
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
            {/* ─── HEADER COMPACTO & MINIMALISTA ────────────────────────── */}
            <header style={{
                background: '#FFFFFF',
                borderRadius: '16px',
                padding: '16px 24px',
                marginBottom: '24px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                boxShadow: '0 4px 20px rgba(0,0,0,0.04)',
                border: '1px solid #E2E8F0'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div style={{ 
                        width: 40, height: 40, 
                        background: 'linear-gradient(135deg, #0F172A 0%, #334155 100%)', 
                        borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        boxShadow: '0 4px 10px rgba(15,23,42,0.2)'
                    }}>
                        <Banknote size={20} color="white" />
                    </div>
                    <div>
                        <h1 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: '#0F172A', letterSpacing: '-0.02em' }}>
                            Tesorería y Pagos
                        </h1>
                        <p style={{ margin: 0, color: '#64748B', fontSize: '0.8rem', fontWeight: 500 }}>
                            Control financiero operativo en tiempo real
                        </p>
                    </div>
                </div>
                <button
                    onClick={async () => { setRefreshing(true); await refresh(); setRefreshing(false); }}
                    style={{
                        background: '#F8FAFC', border: '1px solid #E2E8F0',
                        borderRadius: '10px', padding: '8px 16px', color: '#0F172A', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, fontSize: '0.8rem',
                        transition: 'all 0.2s'
                    }}
                >
                    <RefreshCw size={14} style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
                    Sincronizar
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
            {/* ─── STAT CARDS MINIMALISTAS ────────────────────────── */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '20px',
                marginBottom: '24px'
            }}>
                {/* Pendientes de Pago */}
                <div style={{
                    background: 'white', borderRadius: '14px', padding: '16px 20px',
                    border: '1px solid #E2E8F0', borderLeft: '4px solid #EF4444',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.02)',
                    display: 'flex', flexDirection: 'column', gap: '4px'
                }}>
                    <p style={{ margin: 0, fontSize: '0.65rem', fontWeight: 800, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.08em' }}>SOLICITUDES</p>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                        <p style={{ margin: 0, fontSize: '1.75rem', fontWeight: 900, color: '#0F172A', lineHeight: 1 }}>{pendingCount}</p>
                        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#EF4444', background: '#FEF2F2', padding: '2px 8px', borderRadius: '6px' }}>Pendientes</span>
                    </div>
                </div>

                {/* Monto por Desembolsar */}
                <div style={{
                    background: 'white', borderRadius: '14px', padding: '16px 20px',
                    border: '1px solid #E2E8F0', borderLeft: '4px solid #3B82F6',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.02)',
                    display: 'flex', flexDirection: 'column', gap: '4px'
                }}>
                    <p style={{ margin: 0, fontSize: '0.65rem', fontWeight: 800, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.08em' }}>POR DESEMBOLSAR</p>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                        <span style={{ fontSize: '0.9rem', fontWeight: 800, color: '#3B82F6' }}>S/</span>
                        <p style={{ margin: 0, fontSize: '1.75rem', fontWeight: 900, color: '#0F172A', lineHeight: 1 }}>{formatSoles(totalPendingAmount)}</p>
                    </div>
                </div>

                {/* Egresos del Mes ACTUAL */}
                <div style={{
                    background: 'white', borderRadius: '14px', padding: '16px 20px',
                    border: '1px solid #E2E8F0', borderLeft: '4px solid #10B981',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.02)',
                    display: 'flex', flexDirection: 'column', gap: '4px'
                }}>
                    <p style={{ margin: 0, fontSize: '0.65rem', fontWeight: 800, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                        GASTO {formatMonthKey(currentMonthKey)}
                    </p>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                        <span style={{ fontSize: '0.9rem', fontWeight: 800, color: '#10B981' }}>S/</span>
                        <p style={{ margin: 0, fontSize: '1.75rem', fontWeight: 900, color: '#0F172A', lineHeight: 1 }}>{formatSoles(egresosEsteMes)}</p>
                    </div>
                </div>

                {/* Total Histórico */}
                <div style={{
                    background: 'white', borderRadius: '14px', padding: '16px 20px',
                    border: '1px solid #E2E8F0', borderLeft: '4px solid #8B5CF6',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.02)',
                    display: 'flex', flexDirection: 'column', gap: '4px'
                }}>
                    <p style={{ margin: 0, fontSize: '0.65rem', fontWeight: 800, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.08em' }}>HISTÓRICO TOTAL</p>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                        <span style={{ fontSize: '0.9rem', fontWeight: 800, color: '#8B5CF6' }}>S/</span>
                        <p style={{ margin: 0, fontSize: '1.75rem', fontWeight: 900, color: '#0F172A', lineHeight: 1 }}>{formatSoles(totalPagadoHistorico)}</p>
                    </div>
                </div>
            </div>

            {/* ─── TABLA PRINCIPAL ─────────────────────────────── */}
            <div className={styles.tableCard}>
                <div className={styles.tableHeader}>
                    <h2 style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#1E293B' }}>
                        <Wallet size={18} color="#3B82F6" />
                        Peticiones de Fondos
                        <span style={{ background: pendingCount > 0 ? '#FEF2F2' : '#F0FDF4', color: pendingCount > 0 ? '#DC2626' : '#059669', fontSize: '0.75rem', fontWeight: 800, padding: '2px 10px', borderRadius: '20px' }}>
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
                                        color: filter === f 
                                            ? (f === 'pendiente' ? '#D97706' : f === 'pagado' ? '#059669' : '#2563EB') 
                                            : '#64748B',
                                        boxShadow: filter === f ? '0 2px 8px rgba(0,0,0,0.08)' : 'none',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '6px'
                                    }}>
                                    {f === 'todos' ? '📁 Todos' : f === 'pendiente' ? '⏳ Pendientes' : '✅ Pagados'}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                <div className={styles.tableBody} style={{ padding: '24px' }}>
                    {loading ? (
                        <div className={styles.emptyState} style={{ padding: '60px 20px' }}>
                            <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center', animation: 'pulse 1.5s ease-in-out infinite' }}>
                                <Clock size={28} color="#3B82F6" />
                            </div>
                            <p style={{ color: '#64748B', fontWeight: 600 }}>Cargando solicitudes...</p>
                        </div>
                    ) : filteredGroups.length === 0 ? (
                        <div style={{ 
                            background: 'white', borderRadius: '20px', padding: '80px 20px', 
                            textAlign: 'center', border: '1px solid #E2E8F0',
                            boxShadow: '0 4px 6px rgba(0,0,0,0.02)'
                        }}>
                            <div style={{ 
                                width: '80px', height: '80px', borderRadius: '50%', background: '#F1F5F9',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px'
                            }}>
                                <Search size={32} color="#94A3B8" />
                            </div>
                            <h3 style={{ margin: '0 0 8px', color: '#1E293B', fontWeight: 700 }}>No hay solicitudes</h3>
                            <p style={{ color: '#64748B', maxWidth: '340px', margin: '0 auto', fontSize: '0.9rem' }}>
                                {searchTerm 
                                    ? `No se encontraron resultados para "${searchTerm}".`
                                    : filter === 'todos' 
                                        ? 'Actualmente no hay solicitudes registradas.'
                                        : `No se encontraron registros con el filtro "${filter}".`}
                            </p>
                            {(searchTerm || filter !== 'todos') && (
                                <button 
                                    onClick={() => { setSearchTerm(''); setFilter('todos'); }}
                                    style={{ marginTop: '20px', color: '#3B82F6', fontWeight: 700, background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.9rem' }}
                                >
                                    Ver todos los registros
                                </button>
                            )}
                        </div>
                    ) : (
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
                            gap: '24px'
                        }}>
                            {filteredGroups.map((group) => {
                                const hasPending = group.items.some(i => i.estado === 'pendiente');
                                const cardAccentColor = hasPending ? '#F59E0B' : '#10B981';
                                
                                return (
                                    <div key={group.ticketId} style={{
                                        background: 'white',
                                        borderRadius: '20px',
                                        border: '1px solid #E2E8F0',
                                        borderTop: `6px solid ${cardAccentColor}`,
                                        boxShadow: '0 10px 15px -3px rgba(0,0,0,0.04)',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        overflow: 'hidden',
                                        transition: 'transform 0.2s, box-shadow 0.2s',
                                        position: 'relative'
                                    }}>
                                        {/* HEADER CARD */}
                                        <div style={{ padding: '20px', borderBottom: '1px solid #F1F5F9' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                    <span style={{ 
                                                        fontFamily: 'monospace', fontWeight: 900, color: '#2563EB', 
                                                        background: '#EFF6FF', padding: '4px 10px', borderRadius: '8px', 
                                                        fontSize: '0.9rem', width: 'fit-content' 
                                                    }}>
                                                     <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                        {group.ticketNum}
                                                        {group.riesgoFinanciero && (
                                                            <div 
                                                                title="ALERTA: Solicitud de pago prematura (Presupuesto NO aprobado)"
                                                                style={{ 
                                                                    display: 'flex', alignItems: 'center', gap: '4px',
                                                                    background: '#FEF2F2', color: '#EF4444', 
                                                                    padding: '4px 10px', borderRadius: '8px',
                                                                    fontSize: '0.75rem', fontWeight: 800, border: '1px solid #FEE2E2'
                                                                }}
                                                            >
                                                                <ShieldAlert size={14} />
                                                                <span>RIESGO</span>
                                                            </div>
                                                        )}
                                                     </div>
                                                    </span>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
                                                        <Building2 size={14} color="#64748B" />
                                                        <strong style={{ color: '#0F172A', fontSize: '1rem' }}>{group.cliente}</strong>
                                                    </div>
                                                    <p style={{ margin: 0, fontSize: '0.85rem', color: '#94A3B8', fontWeight: 500 }}>{group.sede}</p>
                                                </div>
                                                <div style={{ 
                                                    padding: '4px 12px', borderRadius: '20px', 
                                                    fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase',
                                                    background: hasPending ? '#FEF3C7' : '#D1FAE5',
                                                    color: hasPending ? '#D97706' : '#059669'
                                                }}>
                                                    {hasPending ? '⏳ Pendiente' : '✅ Pagado'}
                                                </div>
                                            </div>
                                            
                                            {/* BENEFICIARIO */}
                                            <div style={{ 
                                                background: '#F8FAFC', padding: '12px', borderRadius: '12px', 
                                                border: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', gap: '12px' 
                                            }}>
                                                <div style={{ 
                                                    width: 40, height: 40, borderRadius: '50%', background: '#7C3AED', 
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' 
                                                }}>
                                                    <User size={20} />
                                                </div>
                                                <div style={{ flex: 1 }}>
                                                    <p style={{ margin: 0, fontSize: '0.9rem', fontWeight: 800, color: '#1E293B' }}>{group.tecnico.nombre}</p>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.75rem', color: '#64748B', fontWeight: 600 }}>
                                                        <CreditCard size={12} />
                                                        {group.tecnico.banco}
                                                        <div style={{ display: 'flex', gap: '4px', marginLeft: '4px' }}>
                                                            {group.tecnico.yape && <span style={{ color: '#7C3AED' }}>YAPE</span>}
                                                            {group.tecnico.plin && <span style={{ color: '#0EA5E9' }}>PLIN</span>}
                                                        </div>
                                                    </div>
                                                </div>
                                                <button onClick={() => { navigator.clipboard.writeText(group.tecnico.numeroCuenta); showToast('Cuenta copiada'); }}
                                                    style={{ background: 'white', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '6px', cursor: 'pointer' }}>
                                                    <Copy size={14} color="#64748B" />
                                                </button>
                                            </div>
                                        </div>

                                        {/* RESUMEN FINANCIERO COMPACTO */}
                                        <div style={{ 
                                            padding: '12px 20px', background: '#FAFAFA', 
                                            display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1.2fr', gap: '8px',
                                            borderBottom: '1px solid #F1F5F9',
                                            alignItems: 'center'
                                        }}>
                                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                <span style={{ fontSize: '0.6rem', color: '#64748B', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.02em' }}>Pactado MO</span>
                                                <span style={{ fontSize: '0.9rem', fontWeight: 900, color: '#1E293B' }}>S/ {formatSoles(group.montoPactado)}</span>
                                            </div>
                                            <div style={{ display: 'flex', flexDirection: 'column', textAlign: 'center', borderLeft: '1px solid #E2E8F0', paddingLeft: '8px' }}>
                                                <span style={{ fontSize: '0.6rem', color: '#64748B', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.02em' }}>Pagado Tech</span>
                                                <span style={{ fontSize: '0.9rem', fontWeight: 900, color: '#059669' }}>S/ {formatSoles(group.montoAdelantado - group.gastosOperativos)}</span>
                                            </div>
                                            <div style={{ display: 'flex', flexDirection: 'column', textAlign: 'center', borderLeft: '1px solid #E2E8F0', paddingLeft: '8px' }}>
                                                <span style={{ fontSize: '0.6rem', color: '#64748B', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.02em' }}>Gastos Oper.</span>
                                                <span style={{ fontSize: '0.9rem', fontWeight: 900, color: '#DB2777' }}>S/ {formatSoles(group.gastosOperativos)}</span>
                                            </div>
                                            <div style={{ display: 'flex', flexDirection: 'column', textAlign: 'right', borderLeft: '1px solid #E2E8F0', paddingLeft: '8px' }}>
                                                <span style={{ fontSize: '0.6rem', color: '#64748B', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.02em' }}>Utilidad Est.</span>
                                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                                                    <span style={{ fontSize: '1rem', fontWeight: 950, color: group.utilidad > 0 ? '#2563EB' : '#DC2626' }}>
                                                        S/ {formatSoles(group.utilidad)}
                                                    </span>
                                                    <span style={{ fontSize: '8px', color: '#94A3B8', fontWeight: 600 }}>
                                                        ({formatSoles(group.montoFacturado)} Venta - {formatSoles(group.montoAdelantado)} Gasto Real)
                                                    </span>
                                                    {group.margen !== undefined && (
                                                        <span style={{ fontSize: '0.65rem', fontWeight: 800, color: group.margen > 20 ? '#059669' : '#D97706', background: group.margen > 20 ? '#ECFDF5' : '#FFFBEB', padding: '0 4px', borderRadius: '4px', marginTop: '2px' }}>
                                                            {group.margen}% Margen
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        {/* PÍLDORA DE SALDO (Solo si hay saldo) */}
                                        {group.saldoPendiente > 0 && (
                                            <div style={{ 
                                                margin: '8px 20px 0', padding: '6px 12px', 
                                                background: '#FEF2F2', borderRadius: '10px', 
                                                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                                border: '1px solid #FEE2E2'
                                            }}>
                                                <span style={{ fontSize: '0.65rem', fontWeight: 800, color: '#991B1B' }}>SALDO PENDIENTE (TÉCNICO)</span>
                                                <span style={{ fontSize: '0.95rem', fontWeight: 950, color: '#DC2626' }}>S/ {formatSoles(group.saldoPendiente)}</span>
                                            </div>
                                        )}

                                        {/* SOLICITUDES ACTUALES */}
                                        <div style={{ padding: '20px', flex: 1, display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                            {group.items.length === 0 ? (
                                                <p style={{ margin: 0, fontSize: '0.8rem', color: '#94A3B8', fontStyle: 'italic', textAlign: 'center' }}>No hay solicitudes de pago actuales</p>
                                            ) : (
                                                group.items.map((item, idx) => {
                                                    const isPending = item.estado === 'pendiente';
                                                    const typeCfg = TIPO_CONFIG[item.tipo] || { color: '#64748B', bg: '#F1F5F9', label: item.tipo };
                                                    
                                                    return (
                                                        <div key={idx} style={{ 
                                                            background: isPending ? '#FFFBEB' : '#FFFFFF',
                                                            border: isPending ? '2px solid #F59E0B' : '1px solid #F1F5F9',
                                                            borderRadius: '14px', padding: '12px',
                                                            display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                                                        }}>
                                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                                <span style={{ 
                                                                    fontSize: '0.65rem', fontWeight: 900, padding: '2px 8px', borderRadius: '6px',
                                                                    background: typeCfg.bg, color: typeCfg.color, width: 'fit-content'
                                                                }}>
                                                                    {typeCfg.label}
                                                                </span>
                                                                <span style={{ fontSize: '1.25rem', fontWeight: 950, color: '#1E293B' }}>S/ {formatSoles(item.monto)}</span>
                                                                {item.concepto && <span style={{ fontSize: '0.75rem', color: '#64748B', fontStyle: 'italic' }}>{item.concepto}</span>}
                                                            </div>
                                                            
                                                            <div style={{ display: 'flex', gap: '8px' }}>
                                                                {isPending ? (
                                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                                                        <button 
                                                                            onClick={() => handleSmartPayment(group, item)}
                                                                            style={{ 
                                                                                background: '#10B981', color: 'white', border: 'none', 
                                                                                borderRadius: '10px', padding: '10px 16px', fontWeight: 800,
                                                                                fontSize: '0.85rem', cursor: 'pointer', boxShadow: '0 4px 10px rgba(16,185,129,0.2)'
                                                                            }}
                                                                        >
                                                                            PAGAR
                                                                        </button>
                                                                        <button 
                                                                            onClick={() => handleDenyPayment(group, item)}
                                                                            style={{ 
                                                                                background: '#FEF2F2', color: '#DC2626', border: 'none', 
                                                                                borderRadius: '8px', padding: '6px', fontWeight: 700,
                                                                                fontSize: '0.7rem', cursor: 'pointer'
                                                                            }}
                                                                        >
                                                                            DENEGAR
                                                                        </button>
                                                                    </div>
                                                                ) : (
                                                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                                                                        <div style={{ background: '#DCFCE7', borderRadius: '50%', padding: '6px', color: '#10B981' }}>
                                                                            <CheckCircle2 size={18} />
                                                                        </div>
                                                                        <span style={{ fontSize: '0.65rem', fontWeight: 800, color: '#059669' }}>ABONADO</span>
                                                                        {item.voucherRef && (
                                                                            <button onClick={() => setShowVoucher(item.voucherRef || null)}
                                                                                style={{ fontSize: '0.65rem', color: '#3B82F6', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700, textDecoration: 'underline' }}>
                                                                                VOUCHER
                                                                            </button>
                                                                        )}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    );
                                                })
                                            )}
                                        </div>

                                        {/* FOOTER - HISTORIAL RÁPIDO */}
                                        <div style={{ 
                                            padding: '12px 20px', background: '#F8FAFC', 
                                            borderTop: '1px solid #F1F5F9', display: 'flex', 
                                            justifyContent: 'space-between', alignItems: 'center' 
                                        }}>
                                            <button 
                                                onClick={() => setExpandedHistory(expandedHistory === group.ticketId ? null : group.ticketId)}
                                                style={{ background: 'none', border: 'none', color: '#64748B', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                                            >
                                                <History size={14} />
                                                {expandedHistory === group.ticketId ? 'Ocultar historial' : 'Ver historial'}
                                            </button>
                                        </div>
                                        
                                        {/* EXPANDED HISTORY (Sub-card style) */}
                                        {expandedHistory === group.ticketId && (
                                            <div style={{ padding: '16px', background: '#F1F5F9', borderTop: '1px solid #E2E8F0' }}>
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                    {group.historialDepositos.map((h: any, i: number) => (
                                                        <div key={i} style={{ background: 'white', padding: '10px', borderRadius: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem' }}>
                                                            <div>
                                                                <span style={{ fontWeight: 800, color: '#334155' }}>{h.tipo || h.referencia}</span>
                                                                <p style={{ margin: 0, color: '#94A3B8', fontSize: '0.65rem' }}>{new Date(h.fecha).toLocaleDateString()}</p>
                                                            </div>
                                                            <span style={{ fontWeight: 900, color: '#0F172A' }}>S/ {formatSoles(h.monto)}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>



            {/* --- MODAL DE ALERTA DE RIESGO (PROFESIONAL) --- */}
            {riskAlert.show && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
                    background: 'rgba(15, 23, 42, 0.75)', backdropFilter: 'blur(4px)',
                    zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px'
                }}>
                    <div style={{
                        background: 'white', borderRadius: '24px', width: '100%', maxWidth: '450px',
                        boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', border: '1px solid #E2E8F0', overflow: 'hidden'
                    }}>
                        <div style={{
                            background: 'linear-gradient(135deg, #F59E0B, #D97706)', padding: '24px',
                            display: 'flex', alignItems: 'center', gap: '16px', color: 'white'
                        }}>
                            <div style={{ background: 'rgba(255,255,255,0.2)', padding: '10px', borderRadius: '12px' }}>
                                <AlertTriangle size={24} />
                            </div>
                            <div>
                                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>{riskAlert.title}</h3>
                                <p style={{ margin: '4px 0 0', fontSize: '13px', opacity: 0.9 }}>Control de Autorización Crítica</p>
                            </div>
                        </div>

                        <div style={{ padding: '24px' }}>
                            <p style={{ margin: 0, fontSize: '15px', color: '#475569', lineHeight: 1.6, fontWeight: 500 }}>
                                {riskAlert.message}
                            </p>
                            <div style={{
                                marginTop: '20px', padding: '16px', background: '#FFF7ED',
                                borderRadius: '16px', border: '1px solid #FFEDD5', display: 'flex', gap: '12px'
                            }}>
                                <Clock size={20} color="#D97706" style={{ flexShrink: 0 }} />
                                <p style={{ margin: 0, fontSize: '12px', color: '#9A3412', lineHeight: 1.5 }}>
                                    Esta acción será auditada y vinculada a su perfil de administrador para trazabilidad financiera.
                                </p>
                            </div>
                        </div>

                        <div style={{ padding: '16px 24px 24px', display: 'flex', gap: '12px' }}>
                            <button
                                onClick={() => setRiskAlert(prev => ({ ...prev, show: false }))}
                                style={{
                                    flex: 1, padding: '12px', borderRadius: '14px', border: '1.5px solid #E2E8F0',
                                    background: 'white', color: '#64748B', fontWeight: 600, cursor: 'pointer'
                                }}
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={riskAlert.onConfirm}
                                style={{
                                    flex: 2, padding: '12px', borderRadius: '14px', border: 'none',
                                    background: 'linear-gradient(135deg, #F59E0B, #D97706)', color: 'white',
                                    fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center',
                                    justifyContent: 'center', gap: '8px'
                                }}
                            >
                                <CheckCircle2 size={18} />
                                Confirmar y Proceder
                            </button>
                        </div>
                    </div>
                </div>
            )}

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
                            {/* ⚠️ AVISO DE RIESGO ETAPA 6 */}
                            {waitingVoucher.stage6Warning && (
                                <div style={{ 
                                    background: '#FFFBEB', border: '1px solid #F59E0B', borderRadius: '12px', 
                                    padding: '12px', marginBottom: '16px', display: 'flex', gap: '10px', alignItems: 'flex-start' 
                                }}>
                                    <AlertCircle size={20} color="#D97706" style={{ flexShrink: 0, marginTop: '2px' }} />
                                    <p style={{ margin: 0, fontSize: '0.8rem', color: '#92400E', fontWeight: 700, lineHeight: 1.4 }}>
                                        Atención: Esta cotización aún no ha sido aprobada por el cliente. Gasto bajo riesgo de la empresa.
                                    </p>
                                </div>
                            )}

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
                                <div className={styles.detailRow} style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #F1F5F9' }}>
                                    <span className={styles.detailLabel} style={{ color: '#3B82F6', fontWeight: 800 }}>Fecha de Depósito:</span>
                                    <input 
                                        type="date" 
                                        value={depositDate}
                                        onChange={(e) => setDepositDate(e.target.value)}
                                        style={{ 
                                            padding: '4px 8px', borderRadius: '8px', border: '1px solid #3B82F6',
                                            fontSize: '0.85rem', fontWeight: 700, color: '#1E293B', outline: 'none'
                                        }}
                                    />
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
                                        onChange={async (e) => {
                                            const file = e.target.files?.[0];
                                            if (file) {
                                                const compressed = await compressImage(file);
                                                const reader = new FileReader();
                                                reader.onloadend = () => {
                                                    const capturedWaiting = waitingVoucher!;
                                                    setWaitingVoucher(null);
                                                    handleConfirmPayment(
                                                        capturedWaiting.group,
                                                        capturedWaiting.item,
                                                        reader.result as string,
                                                        depositDate
                                                    );
                                                    showToast('🎉 ¡Pago registrado y cerrado!');
                                                };
                                                reader.readAsDataURL(compressed);
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
                                        handleConfirmPayment(capturedWaiting.group, capturedWaiting.item, undefined, depositDate);
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
                            {pendingConfirmation.group.statusId === 'cotizacion_enviada' ? (
                                <div style={{ 
                                    background: '#FFFBEB', border: '2px solid #F59E0B', borderRadius: '12px', 
                                    padding: '16px', marginBottom: '20px', display: 'flex', gap: '12px', alignItems: 'center' 
                                }}>
                                    <AlertCircle size={24} color="#D97706" />
                                    <p style={{ margin: 0, fontSize: '0.85rem', color: '#92400E', fontWeight: 800, lineHeight: 1.4 }}>
                                        ⚠️ ATENCIÓN: Esta cotización aún no ha sido aprobada por el cliente. ¿Desea proceder con el gasto bajo riesgo de la empresa?
                                    </p>
                                </div>
                            ) : (
                                <p className={styles.modalText}>{pendingConfirmation.message}</p>
                            )}
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
                                <div className={styles.detailRow} style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #F1F5F9' }}>
                                    <span className={styles.detailLabel} style={{ color: '#3B82F6', fontWeight: 800 }}>Fecha de Depósito:</span>
                                    <input 
                                        type="date" 
                                        value={depositDate}
                                        onChange={(e) => setDepositDate(e.target.value)}
                                        style={{ 
                                            padding: '4px 8px', borderRadius: '8px', border: '1px solid #3B82F6',
                                            fontSize: '0.85rem', fontWeight: 700, color: '#1E293B', outline: 'none'
                                        }}
                                    />
                                </div>

                                {/* CTA: Subir comprobante (Para transferencias) */}
                                <div style={{ marginTop: '20px', background: '#F8FAFC', padding: '16px', borderRadius: '14px', border: '1.5px dashed #CBD5E1', textAlign: 'center' }}>
                                    <Camera size={24} color="#6366F1" style={{ marginBottom: '8px' }} />
                                    <p style={{ margin: '0 0 10px', fontWeight: 800, color: '#1E293B', fontSize: '0.85rem' }}>
                                        {pendingConfirmation.voucher ? '✅ COMPROBANTE LISTO' : 'SUBIR VOUCHER (OPCIONAL)'}
                                    </p>
                                    <label style={{ 
                                        display: 'inline-flex', alignItems: 'center', gap: '8px',
                                        padding: '10px 20px', borderRadius: '10px',
                                        background: pendingConfirmation.voucher ? '#10B981' : '#6366F1',
                                        color: 'white', fontWeight: 700, fontSize: '0.8rem',
                                        cursor: 'pointer', transition: 'all 0.2s',
                                        boxShadow: '0 4px 6px rgba(99, 102, 241, 0.2)'
                                    }}>
                                        <Upload size={14} />
                                        {pendingConfirmation.voucher ? 'CAMBIAR IMAGEN' : 'SELECCIONAR ARCHIVO'}
                                        <input
                                            type="file"
                                            accept="image/*"
                                            style={{ display: 'none' }}
                                            onChange={async (e) => {
                                                const file = e.target.files?.[0];
                                                if (file) {
                                                    const compressed = await compressImage(file);
                                                    const reader = new FileReader();
                                                    reader.onloadend = () => {
                                                        setPendingConfirmation(prev => prev ? { ...prev, voucher: reader.result as string } : null);
                                                        showToast('📸 Comprobante cargado correctamente');
                                                    };
                                                    reader.readAsDataURL(compressed);
                                                }
                                            }}
                                        />
                                    </label>
                                    {pendingConfirmation.voucher && (
                                        <p style={{ margin: '8px 0 0', fontSize: '0.7rem', color: '#059669', fontWeight: 700 }}>
                                            ✓ La imagen se guardará al confirmar el pago
                                        </p>
                                    )}
                                </div>
                            </div>
                            <div className={styles.modalFooter}>
                                <button className={styles.cancelBtn} onClick={() => setPendingConfirmation(null)}>CANCELAR</button>
                                <button className={styles.confirmBtn} onClick={() => {
                                    handleConfirmPayment(pendingConfirmation.group, pendingConfirmation.item, pendingConfirmation.voucher, depositDate);
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
