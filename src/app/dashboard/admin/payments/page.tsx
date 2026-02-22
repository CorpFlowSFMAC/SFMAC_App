"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
    Wallet, History, CheckCircle2, Clock, ArrowUpRight,
    DollarSign, CreditCard, ChevronDown, ChevronUp,
    TrendingUp, Building2, User, Smartphone, Upload, Eye, X,
    AlertCircle, Banknote, CalendarCheck, BarChart3, RefreshCw
} from "lucide-react";
import { normalizeStateId } from "@/lib/ticketStates";
import { ticketsAPI } from "@/lib/supabase-api";
import { supabase } from "@/lib/supabase";
import styles from "./payments.module.css";

interface PaymentItem {
    id: string;
    tipo: 'Adelanto' | 'Refuerzo' | 'Liquidación Final' | 'Movilidad / Visita';
    monto: number;
    estado: 'pendiente' | 'pagado';
    fecha: string;
    voucherRef?: string | null;
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
        historialPagosTecnico: meta.historialPagosTecnico ?? [],
        adelantoPagado: meta.adelantoPagado ?? false,
        visitPaymentConfirmed: meta.visitPaymentConfirmed ?? false,
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
                    totals[key] = (totals[key] || 0) + parseFloat(p.monto);
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

                const costoManoObra = parseFloat(ticket.costoManoObra || 0);
                const costoMateriales = parseFloat(ticket.costoMateriales || 0);
                const visitCost = parseFloat(ticket.costoVisita || ticket.costoPasaje || ticket.solicitudPagoVisita?.monto || 0);
                const montoPactadoBase = costoManoObra + costoMateriales + visitCost;

                const pagos = ticket.historialPagosTecnico || [];
                const totalPagado = pagos.reduce((sum: number, p: any) => sum + (parseFloat(p.monto) || 0), 0);

                const voucherVisita = pagos.find((p: any) => {
                    const tipo = (p.tipo || "").toLowerCase();
                    const ref = (p.referencia || "").toLowerCase();
                    return tipo === 'movilidad / visita' || ref.includes("movilidad") || ref.includes("visita") || ref.includes("pasaje");
                })?.voucherRef;

                const techData = {
                    id: ticket.tecnico?.id,
                    nombre: ticket.tecnico?.nombre || 'Sin asignar',
                    banco: ticket.tecnico?.banco || '---',
                    numeroCuenta: ticket.tecnico?.numeroCuenta || '---',
                    cci: ticket.tecnico?.cci || '---',
                    yape: ticket.tecnico?.yape,
                    plin: ticket.tecnico?.plin
                };

                const items: PaymentItem[] = [];

                // 1. Adelanto
                const isRelevantForAdelanto = ['cotizacion_aprobada', 'en_ejecucion', 'documentacion_enviada', 'por_liquidar'].includes(ticket.estadoId);
                if (isRelevantForAdelanto || ticket.adelantoPagado || ticket.solicitudAdelanto) {
                    const pct = ticket.solicitudAdelanto?.porcentaje || ticket.porcentajeAdelanto || 0.5;
                    const adelantoMonto = ticket.solicitudAdelanto?.monto || (montoPactadoBase * pct);
                    if (adelantoMonto > 0 || ticket.adelantoPagado) {
                        items.push({
                            id: `${ticket.id}_adelanto`,
                            tipo: 'Adelanto',
                            monto: adelantoMonto,
                            estado: ticket.adelantoPagado ? 'pagado' : 'pendiente',
                            fecha: ticket.solicitudAdelanto?.fecha || ticket.fechaAprobacion || new Date().toISOString()
                        });
                    }
                }

                // 2. Refuerzo
                if (ticket.solicitudAdelantoExtra) {
                    items.push({
                        id: `${ticket.id}_refuerzo`,
                        tipo: 'Refuerzo',
                        monto: ticket.solicitudAdelantoExtra.monto,
                        estado: ticket.solicitudAdelantoExtra.pagado ? 'pagado' : 'pendiente',
                        fecha: ticket.solicitudAdelantoExtra.fecha
                    });
                }

                // 3. Liquidación Final
                const hasSolicitudLiquidacion = !!ticket.solicitudLiquidacion;
                const isRelevantForFinal = ['documentacion_enviada', 'por_liquidar', 'ticket_cerrado'].includes(ticket.estadoId);
                if (isRelevantForFinal || hasSolicitudLiquidacion) {
                    const saldoReal = montoPactadoBase - totalPagado;
                    const pagoFinal = pagos.find((p: any) => p.referencia?.includes("Liquidación") || p.tipo === "Liquidación Final");
                    const montoSolicitadoFinal = ticket.solicitudLiquidacion?.monto || (ticket.estadoId === 'ticket_cerrado' ? (pagoFinal?.monto || 0) : saldoReal);
                    if (montoSolicitadoFinal > 0 || ticket.estadoId === 'ticket_cerrado' || hasSolicitudLiquidacion) {
                        items.push({
                            id: `${ticket.id}_final`,
                            tipo: 'Liquidación Final',
                            monto: montoSolicitadoFinal,
                            estado: ticket.estadoId === 'ticket_cerrado' ? 'pagado' : 'pendiente',
                            fecha: ticket.solicitudLiquidacion?.fecha || ticket.fechaValidacionDocumental || new Date().toISOString()
                        });
                    }
                }

                // 4. Movilidad / Visita
                if (ticket.solicitudPagoVisita || ticket.visitPaymentConfirmed || ticket.costoPasaje) {
                    const montoVisita = parseFloat(ticket.solicitudPagoVisita?.monto || ticket.costoVisita || ticket.costoPasaje || 0);
                    if (montoVisita > 0) {
                        items.push({
                            id: `${ticket.id}_visita`,
                            tipo: 'Movilidad / Visita' as const,
                            monto: montoVisita,
                            estado: ticket.visitPaymentConfirmed ? 'pagado' : 'pendiente' as 'pendiente' | 'pagado',
                            fecha: ticket.solicitudPagoVisita?.fecha || ticket.fechaPagoVisita || ticket.fechaAsignacion || new Date().toISOString()
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
                        montoPactado: montoPactadoBase,
                        montoAdelantado: totalPagado,
                        saldoPendiente: montoPactadoBase - totalPagado,
                        items,
                        historialDepositos: pagos,
                        costoVisita: visitCost,
                        voucherVisita
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

    const handleConfirmPayment = async (group: PaymentTicketGroup, item: PaymentItem, voucherBase64?: string | null) => {
        let freshTicket: any;
        try {
            freshTicket = await ticketsAPI.getById(group.ticketId);
        } catch (err) {
            freshTicket = tickets.find(t => t.id === group.ticketId);
        }
        if (!freshTicket) return;

        const baseMetadata = freshTicket.metadata || {};
        const nuevoPago = {
            id: Date.now().toString(),
            monto: item.monto,
            fecha: new Date().toISOString(),
            tipo: item.tipo,
            estado: 'pagado',
            referencia: `Transferencia Web - ${item.tipo}`,
            voucherRef: voucherBase64
        };

        const historialPagosTecnico = [...(baseMetadata.historialPagosTecnico || []), nuevoPago];
        const newMetadata: any = { ...baseMetadata, historialPagosTecnico };
        const updates: any = { metadata: newMetadata };

        if (item.tipo === 'Adelanto') {
            updates.status_id = 'en_ejecucion';
            newMetadata.estadoId = 'en_ejecucion';
            updates.execution_date = new Date().toISOString();
            newMetadata.fechaInicioEjecucion = updates.execution_date;
            newMetadata.adelantoPagado = true;
            newMetadata.fechaPagoAdelanto = updates.execution_date;
            newMetadata.solicitudAdelanto = null;
        } else if (item.tipo === 'Refuerzo') {
            newMetadata.solicitudAdelantoExtra = null;
        } else if (item.tipo === 'Liquidación Final') {
            updates.status_id = 'ticket_cerrado';
            newMetadata.estadoId = 'ticket_cerrado';
            updates.closure_date = new Date().toISOString();
            newMetadata.fechaPagoFinal = updates.closure_date;
            newMetadata.solicitudLiquidacion = null;
        } else if (item.tipo === 'Movilidad / Visita') {
            const preInspectionStates = ['nuevo', 'asignado', 'esperando_pago_visita', 'borrador', 'tecnico_asignado'];
            if (preInspectionStates.includes(freshTicket.status_id)) {
                updates.status_id = 'en_inspeccion';
                newMetadata.estadoId = 'en_inspeccion';
            }
            newMetadata.visitPaymentConfirmed = true;
            newMetadata.fechaPagoVisita = new Date().toISOString();
            newMetadata.solicitudPagoVisita = null;
        }

        try {
            await updateTicket(group.ticketId, updates);
            await refresh();
        } catch (err) {
            console.error("Error confirming payment:", err);
            alert("Error al procesar el pago. Por favor intente de nuevo.");
        }
    };

    const getVoucherSrc = (ref?: string | null) => {
        if (!ref) return "";
        if (ref.startsWith("data:image")) return ref;
        return localStorage.getItem(ref) || "";
    };

    // ─── Métricas ──────────────────────────────────────────────
    const currentMonthKey = getCurrentMonthKey();
    const egresosEsteMes = monthlyTotals[currentMonthKey] || 0;
    const totalPagadoHistorico = Object.values(monthlyTotals).reduce((s, v) => s + v, 0);

    const pendingCount = paymentGroups.reduce((acc, g) => acc + g.items.filter(i => i.estado === 'pendiente').length, 0);
    const totalPendingAmount = paymentGroups.reduce((acc, g) =>
        acc + g.items.filter(i => i.estado === 'pendiente').reduce((s, i) => s + i.monto, 0), 0);

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
                            S/ {totalPendingAmount.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
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
                            S/ {egresosEsteMes.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
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
                            S/ {totalPagadoHistorico.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
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
                        Peticiones de Fondos
                        <span style={{ background: pendingCount > 0 ? '#FEE2E2' : '#F0FDF4', color: pendingCount > 0 ? '#DC2626' : '#059669', fontSize: '0.75rem', fontWeight: 800, padding: '2px 10px', borderRadius: '20px' }}>
                            {filteredGroups.length} registros
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
                                                                    Visita: S/ {group.costoVisita.toFixed(2)}
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

                                                {/* Col 3: Estado Financiero */}
                                                <td>
                                                    <div style={{ background: 'white', border: '1px solid #E2E8F0', borderRadius: '10px', padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: '5px' }}>
                                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem' }}>
                                                            <span style={{ color: '#64748B', fontWeight: 600, textTransform: 'uppercase', fontSize: '0.68rem' }}>Pactado Total</span>
                                                            <span style={{ fontWeight: 800, color: '#0F172A', fontFamily: 'monospace' }}>S/ {group.montoPactado.toFixed(2)}</span>
                                                        </div>
                                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem' }}>
                                                            <span style={{ color: '#64748B', fontWeight: 600, textTransform: 'uppercase', fontSize: '0.68rem' }}>Pagado Previo</span>
                                                            <span style={{ fontWeight: 800, color: '#059669', fontFamily: 'monospace' }}>- S/ {group.montoAdelantado.toFixed(2)}</span>
                                                        </div>
                                                        <div style={{ borderTop: '2px dashed #CBD5E1', paddingTop: '5px', display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem' }}>
                                                            <span style={{ color: '#64748B', fontWeight: 700, textTransform: 'uppercase', fontSize: '0.68rem' }}>Saldo Pendiente</span>
                                                            <span style={{ fontWeight: 900, color: group.saldoPendiente <= 0 ? '#059669' : '#2563EB', fontFamily: 'monospace' }}>
                                                                S/ {group.saldoPendiente.toFixed(2)}
                                                            </span>
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
                                                                    background: item.estado === 'pendiente' ? '#FFFBEB' : '#F0FDF4',
                                                                    border: `1px solid ${item.estado === 'pendiente' ? '#FCD34D' : '#86EFAC'}`,
                                                                    borderRadius: '8px', padding: '7px 9px'
                                                                }}>
                                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3px' }}>
                                                                        <span style={{ background: cfg.bg, color: cfg.color, fontSize: '0.65rem', fontWeight: 800, padding: '2px 7px', borderRadius: '5px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                                                            {cfg.label}
                                                                        </span>
                                                                        <span style={{ fontSize: '0.8rem', fontWeight: 900, color: '#0F172A', fontFamily: 'monospace' }}>
                                                                            S/ {item.monto.toFixed(2)}
                                                                        </span>
                                                                    </div>
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

                                                {/* Col 5: Acciones */}
                                                <td>
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'stretch' }}>
                                                        {group.items.filter(i => i.estado === 'pendiente').map((item) => (
                                                            <div key={`action-${item.id}`} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                                <label style={{
                                                                    background: 'linear-gradient(135deg, #3B82F6, #2563EB)',
                                                                    color: 'white', padding: '7px 10px', borderRadius: '8px',
                                                                    fontSize: '0.7rem', display: 'flex', alignItems: 'center',
                                                                    gap: '5px', cursor: 'pointer', justifyContent: 'center',
                                                                    fontWeight: 800, boxShadow: '0 4px 10px rgba(37,99,235,0.25)'
                                                                }}>
                                                                    <Upload size={12} />
                                                                    Con Voucher
                                                                    <input type="file" accept="image/*" style={{ display: 'none' }}
                                                                        onChange={(e) => {
                                                                            if (e.target.files?.[0]) {
                                                                                const reader = new FileReader();
                                                                                reader.onloadend = () => setPendingConfirmation({
                                                                                    group, item,
                                                                                    voucher: reader.result as string,
                                                                                    message: `¿Confirmar depósito de S/ ${item.monto.toFixed(2)} para ${item.tipo} y procesar voucher?`
                                                                                });
                                                                                reader.readAsDataURL(e.target.files[0]);
                                                                            }
                                                                        }} />
                                                                </label>
                                                                <button onClick={() => setPendingConfirmation({
                                                                    group, item,
                                                                    message: `¿Confirmar transferencia directa de S/ ${item.monto.toFixed(2)} a ${group.tecnico.nombre}?`
                                                                })}
                                                                    style={{
                                                                        border: '1px solid #E2E8F0', background: 'white',
                                                                        color: '#475569', padding: '5px 8px', borderRadius: '7px',
                                                                        fontSize: '0.7rem', cursor: 'pointer', fontWeight: 700,
                                                                        transition: 'all 0.2s'
                                                                    }}>
                                                                    Pagar Directo
                                                                </button>
                                                            </div>
                                                        ))}
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
                                                                            <strong style={{ fontSize: '1.05rem', color: '#1E293B', fontFamily: 'monospace' }}>S/ {parseFloat(dep.monto).toFixed(2)}</strong>
                                                                            {dep.voucherRef && (
                                                                                <button onClick={() => setShowVoucher(dep.voucherRef)}
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
                                        S/ {pendingConfirmation.item.monto.toFixed(2)}
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

            <style>{`@keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} } @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }`}</style>
        </div>
    );
}
