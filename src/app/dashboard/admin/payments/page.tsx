"use client";

import React, { useState, useEffect } from "react";
import {
    Wallet,
    Search,
    Filter,
    History,
    CheckCircle2,
    Clock,
    ArrowUpRight,
    DollarSign,
    CreditCard,
    ChevronDown,
    ChevronUp,
    FileText,
    Calculator,
    AlertCircle,
    TrendingUp,
    CalendarDays,
    Building2,
    User,
    Smartphone,
    Upload,
    Eye,
    X
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
    montoAdelantado: number; // Total Pagado
    saldoPendiente: number;
    items: PaymentItem[];
    historialDepositos: any[];
    costoVisita?: number;
    voucherVisita?: string | null;
}

// ─────────────────────────────────────────────────────────
// Helper: extrae campos de pago del metadata y del ticket
// ─────────────────────────────────────────────────────────
function flattenTicketForPayments(t: any) {
    if (!t) return t;
    // metadata puede tener anidamiento doble (bug conocido de migración)
    let meta = t.metadata || {};
    while (meta.metadata && typeof meta.metadata === "object") {
        meta = { ...meta, ...meta.metadata };
        delete meta.metadata;
    }
    return {
        ...t,
        // Exponer campos de pago al nivel raíz del objeto
        estadoId: normalizeStateId(t.status_id || meta.estadoId || "nuevo"),
        numeroTicketCliente: t.client_ticket_number || meta.numeroTicketCliente || "",
        costoManoObra: parseFloat(t.labor_cost ?? meta.costoManoObra ?? 0),
        costoMateriales: parseFloat(t.materials_cost ?? meta.costoMateriales ?? 0),
        costoVisita: parseFloat(t.visit_cost ?? meta.costoVisita ?? meta.costoPasaje ?? 0),
        // Campos que viven SOLO en metadata:
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
        cliente: {
            nombre: t.clients?.name || meta.cliente?.nombre || 'Cliente',
        },
        sede: {
            nombre: t.branch_offices?.name || meta.sede?.nombre || 'Sede',
        },
    };
}

export default function PaymentsPage() {
    // ⚡ FUENTE PROPIA CON METADATA: el contexto global usa getSummaryAll() sin metadata.
    // El módulo de pagos necesita metadata completa (solicitudes, historiales de pago).
    // Por eso tiene su propio fetch + canal Realtime independiente.
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

    // Carga inicial
    useEffect(() => { fetchPaymentTickets(); }, [fetchPaymentTickets]);

    // ⚡ Suscripción Realtime propia del módulo de pagos
    // Cuando la Gestora guarda una solicitud de pago, el metadata del ticket cambia
    // en Supabase → el canal dispara → refetch con metadata → aparece en pantalla.
    useEffect(() => {
        const channel = supabase
            .channel('payments:tickets_realtime')
            .on('postgres_changes',
                { event: '*', schema: 'public', table: 'tickets' },
                () => {
                    // Re-fetch completo para obtener metadata actualizado
                    fetchPaymentTickets();
                }
            )
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [fetchPaymentTickets]);

    const refresh = fetchPaymentTickets;

    // Función de actualización local: actualiza Supabase y re-fetcha
    const updateTicket = React.useCallback(async (id: string, updates: any) => {
        const updated = await ticketsAPI.update(id, updates);
        // El canal Realtime disparará el re-fetch automáticamente
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
    const [monthlyTotals, setMonthlyTotals] = useState<{ [key: string]: number }>({});
    const [showVoucher, setShowVoucher] = useState<string | null>(null);

    const [userRole, setUserRole] = useState<string | null>(null);

    useEffect(() => {
        const role = localStorage.getItem("userRole");
        setUserRole(role);
    }, []);

    // 🔄 Procesar tickets a grupos de pago cuando cambia la lista
    useEffect(() => {
        if (tickets.length > 0) {
            processTicketsToGroups(tickets);
        } else if (!loading) {
            setPaymentGroups([]);
        }
    }, [tickets, loading]);

    if (userRole && userRole !== 'admin') {
        return (
            <div className={styles.emptyState} style={{ height: '80vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
                <AlertCircle size={64} color="#EF4444" />
                <h1 style={{ marginTop: '1rem', color: '#1E293B' }}>Acceso Restringido</h1>
                <p style={{ color: '#64748B', maxWidth: '400px', textAlign: 'center', marginTop: '0.5rem' }}>
                    Lo sentimos, este módulo de Tesorería es de uso exclusivo para el Administrador de SINFIMAC.
                </p>
                <button
                    onClick={() => window.location.href = '/dashboard/gestor'}
                    style={{ marginTop: '2rem', padding: '12px 24px', background: '#3B82F6', color: 'white', borderRadius: '12px', border: 'none', fontWeight: 800, cursor: 'pointer' }}
                >
                    Volver al Panel Operativo
                </button>
            </div>
        );
    }

    const calculateMonthlyTotalsFromTickets = (allTickets: any[]) => {
        const totals: { [key: string]: number } = {};
        allTickets.forEach(ticket => {
            (ticket.historialPagosTecnico || []).forEach((p: any) => {
                if (p.monto && p.fecha && p.estado !== 'anulado') {
                    const date = new Date(p.fecha);
                    const k = date.toLocaleString('es-PE', { month: 'long', year: 'numeric' });
                    const formattedKey = k.charAt(0).toUpperCase() + k.slice(1);
                    totals[formattedKey] = (totals[formattedKey] || 0) + p.monto;
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

                // ★ FIX: El monto pactado total debe incluir MO + MATERIALES + VISITA/PASAJES
                const montoPactadoBase = costoManoObra + costoMateriales + visitCost;

                const pagos = ticket.historialPagosTecnico || [];
                const totalPagado = pagos.reduce((sum: number, p: any) => sum + (parseFloat(p.monto) || 0), 0);

                const voucherVisita = pagos.find((p: any) => {
                    const tipo = (p.tipo || "").toLowerCase();
                    const ref = (p.referencia || "").toLowerCase();
                    return tipo === 'movilidad / visita' || ref.includes("movilidad") || ref.includes("visita") || ref.includes("pasaje");
                })?.voucherRef;

                // techData ya está normalizado por flattenTicketForPayments al nivel raíz
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
                    const adelantoRealizado = ticket.adelantoPagado;

                    if (adelantoMonto > 0 || adelantoRealizado) {
                        items.push({
                            id: `${ticket.id}_adelanto`,
                            tipo: 'Adelanto',
                            monto: adelantoMonto,
                            estado: adelantoRealizado ? 'pagado' : 'pendiente',
                            fecha: ticket.solicitudAdelanto?.fecha || ticket.fechaAprobacion || ticket.fechaAprobacionCotizacion || new Date().toISOString()
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
                            fecha: ticket.solicitudLiquidacion?.fecha || ticket.fechaValidacionDocumental || ticket.fechaPagoFinal || new Date().toISOString()
                        });
                    }
                }

                // 4. Pago de Visita / Movilidad
                if (ticket.solicitudPagoVisita || ticket.visitPaymentConfirmed || ticket.costoPasaje) {
                    const montoVisita = parseFloat(ticket.solicitudPagoVisita?.monto || ticket.costoVisita || ticket.costoPasaje || 0);
                    const itemVisita = {
                        id: `${ticket.id}_visita`,
                        tipo: 'Movilidad / Visita' as const,
                        monto: montoVisita,
                        estado: ticket.visitPaymentConfirmed ? 'pagado' : 'pendiente' as 'pendiente' | 'pagado',
                        fecha: ticket.solicitudPagoVisita?.fecha || ticket.fechaPagoVisita || ticket.fechaAsignacion || new Date().toISOString()
                    };

                    if (itemVisita.monto > 0) {
                        items.push(itemVisita);
                    }
                }

                // Siempre incluir si hay items O si hay historial de depósitos (para no perder el registro)
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
                        items: items,
                        historialDepositos: pagos,
                        costoVisita: visitCost,
                        voucherVisita: voucherVisita
                    });
                }

            } catch (e) {
                console.error("Error processing ticket for payments:", e);
            }
        });

        // Ordenar
        allGroups.sort((a, b) => {
            const hasPendingA = a.items.some(i => i.estado === 'pendiente');
            const hasPendingB = b.items.some(i => i.estado === 'pendiente');
            if (hasPendingA !== hasPendingB) return hasPendingA ? -1 : 1;
            const lastDateA = a.items.reduce((max, i) => i.fecha > max ? i.fecha : max, "");
            const lastDateB = b.items.reduce((max, i) => i.fecha > max ? i.fecha : max, "");
            return new Date(lastDateB).getTime() - new Date(lastDateA).getTime();
        });

        setPaymentGroups(allGroups);
        calculateMonthlyTotalsFromTickets(allTickets);
    };

    const handleConfirmPayment = async (group: PaymentTicketGroup, item: PaymentItem, voucherBase64?: string | null) => {
        let freshTicket: any;
        try {
            // 🛡️ FRESH FETCH: Obtener datos frescos de la BD para evitar sobreescrituras pÓstumas
            freshTicket = await ticketsAPI.getById(group.ticketId);
        } catch (err) {
            console.error("Error fetching fresh ticket for payment:", err);
            // Fallback al estado local si falla la red (riesgoso pero necesario)
            freshTicket = tickets.find(t => t.id === group.ticketId);
        }

        if (!freshTicket) return;

        // Base metadata from source of truth
        const baseMetadata = freshTicket.metadata || {};

        const paymentId = Date.now().toString();
        const nuevoPago = {
            id: paymentId,
            monto: item.monto,
            fecha: new Date().toISOString(),
            tipo: item.tipo,
            estado: 'pagado',
            referencia: `Transferencia Web - ${item.tipo}`,
            voucherRef: voucherBase64
        };

        // Actualizar historial en metadata
        const historialPagosTecnico = [...(baseMetadata.historialPagosTecnico || []), nuevoPago];

        // Construir nuevo metadata preservando TODO lo que ya existía (Merge Strategy)
        const newMetadata = {
            ...baseMetadata,
            historialPagosTecnico
        };

        const updates: any = {
            metadata: newMetadata
        };

        if (item.tipo === 'Adelanto') {
            updates.status_id = 'en_ejecucion';
            newMetadata.estadoId = 'en_ejecucion';
            updates.execution_date = new Date().toISOString();
            newMetadata.fechaInicioEjecucion = updates.execution_date;

            // 🔥 CRÍTICO: Bandera explícita
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
            // ★ FIX: Avanzar a en_inspeccion desde CUALQUIER estado pre-inspección
            const preInspectionStates = ['nuevo', 'asignado', 'esperando_pago_visita', 'borrador'];
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
            console.error("Error confirming payment in Supabase:", err);
            alert("Error al procesar el pago. Por favor intente de nuevo.");
        }
    };

    const getVoucherSrc = (ref?: string | null) => {
        if (!ref) return "";
        if (ref.startsWith("data:image")) return ref;
        return localStorage.getItem(ref) || "";
    };

    const filteredGroups = paymentGroups.filter(g => {
        if (filter === 'todos') return true;
        if (filter === 'pendiente') {
            return g.items.some(i => i.estado === 'pendiente');
        }
        if (filter === 'pagado') {
            // Un grupo se considera pagado si tiene items pagados O si tiene historial de depósitos
            return g.items.some(i => i.estado === 'pagado') || g.historialDepositos.length > 0;
        }
        return false;
    });

    const pendingCount = paymentGroups.reduce((acc, g) => acc + g.items.filter(i => i.estado === 'pendiente').length, 0);
    const totalPendingAmount = paymentGroups.reduce((acc, g) => acc + g.items.filter(i => i.estado === 'pendiente').reduce((sum, i) => sum + i.monto, 0), 0);

    return (
        <div className={styles.paymentsContainer}>
            <header className={styles.header}>
                <div className={styles.titleSection}>
                    <h1>Módulo de Pagos y Tesorería</h1>
                    <p>Gestión centralizada de transferencias y control financiero.</p>
                </div>
            </header>

            <div className={styles.statsRow}>
                <div className={styles.statCard}>
                    <div className={`${styles.statIcon} ${styles.blueIcon}`}><Wallet size={24} /></div>
                    <div className={styles.statInfo}>
                        <span className={styles.statLabel}>Pendientes de Pago</span>
                        <span className={styles.statValue}>{pendingCount}</span>
                    </div>
                </div>
                <div className={styles.statCard}>
                    <div className={`${styles.statIcon} ${styles.greenIcon}`}><DollarSign size={24} /></div>
                    <div className={styles.statInfo}>
                        <span className={styles.statLabel}>Monto por Desembolsar</span>
                        <span className={styles.statValue}>S/ {totalPendingAmount.toLocaleString('es-PE', { minimumFractionDigits: 2 })}</span>
                    </div>
                </div>
                <div className={styles.statCard}>
                    <div className={`${styles.statIcon} ${styles.purpleIcon}`}><TrendingUp size={24} /></div>
                    <div className={styles.statInfo}>
                        <span className={styles.statLabel}>Egresos del Mes</span>
                        <span className={styles.statValue}>
                            S/ {(monthlyTotals[new Date().toLocaleString('es-PE', { month: 'long', year: 'numeric' }).charAt(0).toUpperCase() + new Date().toLocaleString('es-PE', { month: 'long', year: 'numeric' }).slice(1)] || 0).toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                        </span>
                    </div>
                </div>
            </div>

            <div className={styles.tableCard}>
                <div className={styles.tableHeader}>
                    <h2><Clock size={18} /> Peticiones de Fondos</h2>
                    <div className={styles.pills}>
                        <div className={`${styles.pill} ${filter === 'todos' ? styles.pillActive : ''}`} onClick={() => setFilter('todos')}>Todos</div>
                        <div className={`${styles.pill} ${filter === 'pendiente' ? styles.pillActive : ''}`} onClick={() => setFilter('pendiente')}>Pendientes</div>
                        <div className={`${styles.pill} ${filter === 'pagado' ? styles.pillActive : ''}`} onClick={() => setFilter('pagado')}>Pagados</div>
                    </div>
                </div>

                <div className={styles.tableBody}>
                    {loading ? (
                        <div className={styles.emptyState}>
                            <Clock size={48} className={styles.pulseAnimation} />
                            <p>Cargando peticiones de fondos desde la nube...</p>
                        </div>
                    ) : (
                        <table className={styles.paymentsTable}>
                            <thead>
                                <tr>
                                    <th style={{ width: '20%' }}># TICKET CLIENTE / SEDE</th>
                                    <th style={{ width: '25%' }}>BENEFICIARIO (TÉCNICO)</th>
                                    <th style={{ width: '20%' }}>ESTADO FINANCIERO</th>
                                    <th style={{ width: '25%' }}>SOLICITUD ACTUAL</th>
                                    <th style={{ width: '10%' }}>ACCIONES</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredGroups.length === 0 ? (
                                    <tr>
                                        <td colSpan={5}>
                                            <div className={styles.emptyState}>
                                                <AlertCircle size={48} />
                                                <p>No hay solicitudes en esta categoría.</p>
                                            </div>
                                        </td>
                                    </tr>
                                ) : (
                                    filteredGroups.map((group) => (
                                        <React.Fragment key={group.ticketId}>
                                            <tr className={`${styles.paymentRow} ${group.items.some(i => i.estado === 'pendiente') ? styles.rowPending : styles.rowPaid}`}>
                                                <td>
                                                    <div className={styles.ticketCell}>
                                                        <span className={styles.ticketId}>{group.ticketNum}</span>
                                                        <div className={styles.clientInfo}>
                                                            <Building2 size={12} />
                                                            <strong>{group.cliente}</strong>
                                                            <span className={styles.sedeText}>({group.sede})</span>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td>
                                                    <div className={styles.techCell}>
                                                        <div className={styles.techNameRow}>
                                                            <User size={14} />
                                                            <span>{group.tecnico.nombre}</span>
                                                        </div>
                                                        <div className={styles.bankDetailBox}>
                                                            <div className={styles.bankRow} style={{ justifyContent: 'space-between', width: '100%' }}>
                                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                                    <CreditCard size={12} />
                                                                    <span className={styles.bankName}>{group.tecnico.banco}</span>
                                                                </div>
                                                                {(group.tecnico.yape || group.tecnico.plin) && (
                                                                    <div className={styles.walletRow} style={{ gap: '4px' }}>
                                                                        {group.tecnico.yape && <span className={styles.walletBadgeYape}><Smartphone size={10} /> {group.tecnico.yape}</span>}
                                                                        {group.tecnico.plin && <span className={styles.walletBadgePlin}><Smartphone size={10} /> {group.tecnico.plin}</span>}
                                                                    </div>
                                                                )}
                                                            </div>
                                                            <div className={styles.accountNumbers}>
                                                                <span>CTA: {group.tecnico.numeroCuenta || '---'}</span>
                                                                {group.tecnico.cci && <span>CCI: {group.tecnico.cci}</span>}
                                                            </div>

                                                            {/* Visualización de Costo de Visita y Voucher */}
                                                            {group.costoVisita && group.costoVisita > 0 && (
                                                                <div className={styles.visitCostRow}>
                                                                    <div className={styles.visitLabelRow}>
                                                                        <ArrowUpRight size={12} />
                                                                        <span>Costo Visita: <strong>S/ {group.costoVisita.toFixed(2)}</strong></span>
                                                                    </div>
                                                                    {group.voucherVisita && (
                                                                        <div className={styles.voucherThumbBox}>
                                                                            <img
                                                                                src={getVoucherSrc(group.voucherVisita)}
                                                                                alt="Voucher Visita"
                                                                                className={styles.miniVoucher}
                                                                                onClick={() => setShowVoucher(getVoucherSrc(group.voucherVisita))}
                                                                            />
                                                                            <div className={styles.zoomPulse}></div>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </td>
                                                <td>
                                                    <div className={styles.financialGridCompact}>
                                                        <div className={styles.finRowCompact}>
                                                            <span className={styles.finLabelCompact}>PACTADO TOTAL</span>
                                                            <span className={styles.finValueCompact} style={{ color: '#0F172A' }}>S/ {group.montoPactado.toFixed(2)}</span>
                                                        </div>
                                                        <div className={styles.finRowCompact}>
                                                            <span className={styles.finLabelCompact}>PAGADO PREVIO</span>
                                                            <span className={styles.finValueCompact} style={{ color: '#059669' }}>- S/ {group.montoAdelantado.toFixed(2)}</span>
                                                        </div>
                                                        <div className={`${styles.finRowCompact} ${styles.finRowTotal}`}>
                                                            <span className={styles.finLabelCompact}>SALDO PENDIENTE</span>
                                                            <span className={styles.finValueCompact} style={{ color: group.saldoPendiente < 0 ? '#DC2626' : '#2563EB' }}>
                                                                S/ {group.saldoPendiente.toFixed(2)}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td>
                                                    <div className={styles.requestsContainer}>
                                                        {group.items.map((item) => (
                                                            <div key={item.id} className={styles.requestItemRow} style={{ marginBottom: '8px', padding: '6px', border: '1px solid #E2E8F0', borderRadius: '6px', background: item.estado === 'pendiente' ? '#FEF3C7' : '#F0FDF4' }}>
                                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                                                                    <span className={`${styles.typeBadge} ${item.tipo === 'Adelanto' ? styles.typeAdvance : item.tipo === 'Refuerzo' ? styles.typeReinforcement : styles.typeFinal}`}>
                                                                        {item.tipo}
                                                                    </span>
                                                                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#0F172A' }}>S/ {item.monto.toFixed(2)}</span>
                                                                </div>
                                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                                    <span style={{ fontSize: '0.65rem', color: '#64748B' }}>{new Date(item.fecha).toLocaleDateString('es-PE')}</span>
                                                                    <span style={{ fontSize: '0.65rem', fontWeight: 700, color: item.estado === 'pendiente' ? '#D97706' : '#166534' }}>
                                                                        {item.estado === 'pendiente' ? 'PENDIENTE' : 'PAGADO'}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </td>
                                                <td>
                                                    <div className={styles.actionsCell}>
                                                        {group.items.filter(i => i.estado === 'pendiente').map((item) => (
                                                            <div key={`action-${item.id}`} style={{ marginBottom: '8px' }}>
                                                                <label className={styles.uploadVoucherBtn} style={{ background: '#3B82F6', color: 'white', padding: '6px 10px', borderRadius: '6px', fontSize: '0.7rem', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', marginBottom: '4px', justifyContent: 'center' }}>
                                                                    <Upload size={14} />
                                                                    <span>PAGAR: {item.tipo.split(' ')[0]}</span>
                                                                    <input
                                                                        type="file"
                                                                        accept="image/*"
                                                                        style={{ display: 'none' }}
                                                                        onChange={(e) => {
                                                                            if (e.target.files && e.target.files[0]) {
                                                                                const file = e.target.files[0];
                                                                                const reader = new FileReader();
                                                                                reader.onloadend = () => {
                                                                                    setPendingConfirmation({
                                                                                        group,
                                                                                        item,
                                                                                        voucher: reader.result as string,
                                                                                        message: `¿Confirmar depÓsito de S/ ${item.monto.toFixed(2)} para ${item.tipo} y procesar voucher?`
                                                                                    });
                                                                                };
                                                                                reader.readAsDataURL(file);
                                                                            }
                                                                        }}
                                                                    />
                                                                </label>
                                                                <button
                                                                    style={{ border: '1px solid #E2E8F0', background: 'white', color: '#64748B', padding: '4px 8px', borderRadius: '6px', fontSize: '0.7rem', cursor: 'pointer', width: '100%' }}
                                                                    onClick={() => {
                                                                        setPendingConfirmation({
                                                                            group,
                                                                            item,
                                                                            message: `¿Confirmar transferencia directa de S/ ${item.monto.toFixed(2)} a ${group.tecnico.nombre}?`
                                                                        });
                                                                    }}
                                                                >
                                                                    Pagar directo
                                                                </button>
                                                            </div>
                                                        ))}
                                                        {group.items.every(i => i.estado === 'pagado') && (
                                                            <div style={{ textAlign: 'center', padding: '8px' }}>
                                                                <CheckCircle2 size={20} color="#22C55E" style={{ margin: '0 auto' }} />
                                                                <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#15803D', display: 'block' }}>COMPLETADO</span>
                                                                {group.historialDepositos.length > 0 && (
                                                                    <button
                                                                        className={styles.historyToggle}
                                                                        style={{ marginTop: '4px' }}
                                                                        onClick={() => setExpandedHistory(expandedHistory === group.ticketId ? null : group.ticketId)}
                                                                    >
                                                                        {expandedHistory === group.ticketId ? <ChevronUp size={16} /> : <History size={16} />}
                                                                    </button>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                            {expandedHistory === group.ticketId && (
                                                <tr className={styles.historyRow}>
                                                    <td colSpan={5}>
                                                        <div className={styles.historyContainer}>
                                                            <h4>Historial de Transferencias - Ticket {group.ticketNum}</h4>
                                                            <div className={styles.historyGrid}>
                                                                {group.historialDepositos.map((dep, idx) => (
                                                                    <div key={idx} className={styles.historyCard}>
                                                                        <div className={styles.historyHeader}>
                                                                            <span className={styles.historyIndex}>#{idx + 1}</span>
                                                                            <span className={styles.historyDate}>{new Date(dep.fecha).toLocaleString()}</span>
                                                                        </div>
                                                                        <div className={styles.historyBody}>
                                                                            <span>{dep.tipo || 'DepÓsito'}</span>
                                                                            <strong>S/ {parseFloat(dep.monto).toFixed(2)}</strong>
                                                                            {dep.voucherRef && (
                                                                                <button
                                                                                    className={styles.viewVoucherBtn}
                                                                                    style={{
                                                                                        marginTop: '8px',
                                                                                        display: 'flex',
                                                                                        alignItems: 'center',
                                                                                        gap: '4px',
                                                                                        padding: '4px 8px',
                                                                                        background: '#F1F5F9',
                                                                                        border: '1px solid #E2E8F0',
                                                                                        borderRadius: '4px',
                                                                                        fontSize: '0.7rem',
                                                                                        cursor: 'pointer',
                                                                                        color: '#475569'
                                                                                    }}
                                                                                    onClick={() => setShowVoucher(dep.voucherRef)}
                                                                                >
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

            {showVoucher && (
                <div
                    style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.8)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'zoom-out' }}
                    onClick={() => setShowVoucher(null)}
                >
                    <div style={{ position: 'relative', maxWidth: '90%', maxHeight: '90%' }}>
                        <img src={showVoucher} alt="Voucher" style={{ width: '100%', height: 'auto', borderRadius: '8px' }} />
                        <button
                            style={{ position: 'absolute', top: '-15px', right: '-15px', background: 'white', border: 'none', borderRadius: '50%', width: '30px', height: '30px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 10px rgba(0,0,0,0.3)' }}
                            onClick={() => setShowVoucher(null)}
                        >
                            <X size={20} />
                        </button>
                    </div>
                </div>
            )}

            {/* Confirmation Modal */}
            {pendingConfirmation && (
                <div className={styles.modalOverlay}>
                    <div className={styles.modalContent}>
                        <div className={styles.modalHeader}>
                            <div className={styles.modalIcon}>
                                <CreditCard size={32} />
                            </div>
                            <h3>Confirmar Transacción</h3>
                        </div>
                        <div className={styles.modalBody}>
                            <p className={styles.modalText}>
                                {pendingConfirmation.message}
                            </p>

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
                                <button
                                    className={styles.cancelBtn}
                                    onClick={() => setPendingConfirmation(null)}
                                >
                                    CANCELAR
                                </button>
                                <button
                                    className={styles.confirmBtn}
                                    onClick={() => {
                                        handleConfirmPayment(
                                            pendingConfirmation.group,
                                            pendingConfirmation.item,
                                            pendingConfirmation.voucher
                                        );
                                        setPendingConfirmation(null);
                                    }}
                                >
                                    CONFIRMAR PAGO
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
