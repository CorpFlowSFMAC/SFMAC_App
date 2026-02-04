"use client";

import { useState, useEffect } from "react";
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
    CalendarDays
} from "lucide-react";
import styles from "./payments.module.css";

interface PaymentRequest {
    id: string; // Ticket ID + Type suffix
    ticketId: string;
    ticketNum: string;
    tipo: 'Adelanto' | 'Refuerzo' | 'Liquidación Final' | 'Movilidad / Visita';
    cliente: string;
    sede: string;
    tecnico: {
        nombre: string;
        banco: string;
        numeroCuenta: string;
        cci: string;
        yape?: string;
        plin?: string;
    };
    montoPactado: number;
    montoSolicitado: number;
    montoGanadoEsperado: number; // Rentabilidad esperada
    fechaSolicitud: string;
    estado: 'pendiente' | 'pagado';
    historialDepositos: any[];
}

export default function PaymentsPage() {
    const [tickets, setTickets] = useState<any[]>([]);
    const [paymentRequests, setPaymentRequests] = useState<PaymentRequest[]>([]);
    const [filter, setFilter] = useState<'todos' | 'pendiente' | 'pagado'>('todos');
    const [expandedHistory, setExpandedHistory] = useState<string | null>(null);
    const [monthlyTotals, setMonthlyTotals] = useState<{ [key: string]: number }>({});

    useEffect(() => {
        loadData();
    }, []);

    const loadData = () => {
        const allRequests: PaymentRequest[] = [];

        // Cargar todos los tickets del localStorage
        const keys = Object.keys(localStorage);
        const ticketKeys = keys.filter(k => k.startsWith('ticket_state_'));

        ticketKeys.forEach(key => {
            const saved = localStorage.getItem(key);
            if (saved) {
                try {
                    const ticket = JSON.parse(saved);
                    const ticketNum = ticket.numeroTicket || `#${ticket.id.toString().padStart(5, '0')}`;

                    // 0. Verificar Movilidad / Visita (estadoId === 'esperando_pago_visita')
                    const costoVisita = parseFloat(ticket.costoVisita || 0);
                    if (costoVisita > 0 && (ticket.estadoId === 'esperando_pago_visita' || ticket.visitPaymentConfirmed)) {
                        allRequests.push({
                            id: `${ticket.id}_movilidad`,
                            ticketId: ticket.id,
                            ticketNum: ticketNum,
                            tipo: 'Movilidad / Visita',
                            cliente: ticket.cliente?.nombre || 'MiBanco',
                            sede: ticket.sede?.nombre || 'Sede Central',
                            tecnico: {
                                nombre: `${ticket.tecnico?.nombre || ''} ${ticket.tecnico?.apellido || ''}`.trim() || 'Sin asignar',
                                banco: ticket.tecnico?.banco || 'BCP',
                                numeroCuenta: ticket.tecnico?.numeroCuenta || '---',
                                cci: ticket.tecnico?.cci || '---',
                                yape: ticket.tecnico?.yape,
                                plin: ticket.tecnico?.plin
                            },
                            montoPactado: costoVisita,
                            montoSolicitado: costoVisita,
                            montoGanadoEsperado: 0, // La visita no suele dejar ganancia directa en este cálculo
                            fechaSolicitud: ticket.fechaAsignacion || ticket.fechaCreacion,
                            estado: ticket.visitPaymentConfirmed ? 'pagado' : 'pendiente',
                            historialDepositos: ticket.historialPagosTecnico || []
                        });
                    }

                    // 1. Verificar Adelanto (Paso 5 completado -> cotizacion_aprobada)
                    if (ticket.estadoId === 'cotizacion_aprobada') {
                        const montoPactado = (parseFloat(ticket.costoManoObra || 0) + parseFloat(ticket.costoMateriales || 0));
                        const adelanto = (montoPactado * (ticket.porcentajeAdelanto || 0.5));

                        allRequests.push({
                            id: `${ticket.id}_adelanto`,
                            ticketId: ticket.id,
                            ticketNum: ticketNum,
                            tipo: 'Adelanto',
                            cliente: ticket.cliente?.nombre || 'MiBanco',
                            sede: ticket.sede?.nombre || 'Sede Central',
                            tecnico: {
                                nombre: `${ticket.tecnico?.nombre || ''} ${ticket.tecnico?.apellido || ''}`.trim() || 'Sin asignar',
                                banco: ticket.tecnico?.banco || 'BCP',
                                numeroCuenta: ticket.tecnico?.numeroCuenta || '---',
                                cci: ticket.tecnico?.cci || '---',
                                yape: ticket.tecnico?.yape,
                                plin: ticket.tecnico?.plin
                            },
                            montoPactado: montoPactado,
                            montoSolicitado: adelanto,
                            montoGanadoEsperado: (ticket.montoFinal || 0) - (montoPactado + (parseFloat(ticket.costoVisita || 0))),
                            fechaSolicitud: ticket.fechaAprobacionCotizacion || ticket.fechaCreacion,
                            estado: ticket.adelantoPagado ? 'pagado' : 'pendiente',
                            historialDepositos: ticket.historialPagosTecnico || []
                        });
                    }

                    // 2. Verificar Refuerzo Económico
                    if (ticket.solicitudAdelantoExtra) {
                        const montoPactado = (parseFloat(ticket.costoManoObra || 0) + parseFloat(ticket.costoMateriales || 0));
                        allRequests.push({
                            id: `${ticket.id}_refuerzo`,
                            ticketId: ticket.id,
                            ticketNum: ticketNum,
                            tipo: 'Refuerzo',
                            cliente: ticket.cliente?.nombre || 'MiBanco',
                            sede: ticket.sede?.nombre || 'Sede Central',
                            tecnico: {
                                nombre: `${ticket.tecnico?.nombre || ''} ${ticket.tecnico?.apellido || ''}`.trim() || 'Sin asignar',
                                banco: ticket.tecnico?.banco || 'BCP',
                                numeroCuenta: ticket.tecnico?.numeroCuenta || '---',
                                cci: ticket.tecnico?.cci || '---',
                                yape: ticket.tecnico?.yape,
                                plin: ticket.tecnico?.plin
                            },
                            montoPactado: montoPactado,
                            montoSolicitado: ticket.solicitudAdelantoExtra.monto,
                            montoGanadoEsperado: (ticket.montoFinal || 0) - (montoPactado + (parseFloat(ticket.costoVisita || 0))),
                            fechaSolicitud: ticket.solicitudAdelantoExtra.fecha,
                            estado: ticket.solicitudAdelantoExtra.pagado ? 'pagado' : 'pendiente',
                            historialDepositos: ticket.historialPagosTecnico || []
                        });
                    }

                    // 3. Verificar Liquidación Final
                    if (ticket.estadoId === 'por_liquidar' || ticket.estadoId === 'ticket_cerrado') {
                        const montoPactado = (parseFloat(ticket.costoManoObra || 0) + parseFloat(ticket.costoMateriales || 0));
                        const pagos = ticket.historialPagosTecnico || [];
                        const totalPagado = pagos.reduce((sum: number, p: any) => sum + p.monto, 0);

                        // Si está cerrado, mostramos el último pago como el monto solicitado del registro histórico
                        // Si está por liquidar, mostramos el saldo pendiente
                        const saldoPendiente = Math.max(0, montoPactado - totalPagado);
                        const isFinalPaid = ticket.estadoId === 'ticket_cerrado';

                        // Si está cerrado, recuperamos el monto de la liquidación del historial
                        let montoMostrado = saldoPendiente;
                        if (isFinalPaid) {
                            const lastPay = [...pagos].reverse().find(p => p.referencia?.includes("Liquidación") || p.tipo === "Liquidación Final");
                            montoMostrado = lastPay ? lastPay.monto : (montoPactado * 0.5); // Fallback al 50% si no se encuentra
                        }

                        if (montoMostrado > 0 || isFinalPaid) {
                            allRequests.push({
                                id: `${ticket.id}_final`,
                                ticketId: ticket.id,
                                ticketNum: ticketNum,
                                tipo: 'Liquidación Final',
                                cliente: ticket.cliente?.nombre || 'MiBanco',
                                sede: ticket.sede?.nombre || 'Sede Central',
                                tecnico: {
                                    nombre: `${ticket.tecnico?.nombre || ''} ${ticket.tecnico?.apellido || ''}`.trim() || 'Sin asignar',
                                    banco: ticket.tecnico?.banco || 'BCP',
                                    numeroCuenta: ticket.tecnico?.numeroCuenta || '---',
                                    cci: ticket.tecnico?.cci || '---',
                                    yape: ticket.tecnico?.yape,
                                    plin: ticket.tecnico?.plin
                                },
                                montoPactado: montoPactado,
                                montoSolicitado: montoMostrado,
                                montoGanadoEsperado: (ticket.montoFinal || 0) - (montoPactado + (parseFloat(ticket.costoVisita || 0))),
                                fechaSolicitud: ticket.fechaValidacionDocumental || ticket.fechaCreacion,
                                estado: isFinalPaid ? 'pagado' : 'pendiente',
                                historialDepositos: pagos
                            });
                        }
                    }

                } catch (e) {
                    console.error("Error parsing ticket for payments:", e);
                }
            }
        });

        // Ordenar por fecha de solicitud descendente
        allRequests.sort((a, b) => new Date(b.fechaSolicitud).getTime() - new Date(a.fechaSolicitud).getTime());
        setPaymentRequests(allRequests);

        // Calcular acumulados mensuales
        const totals: { [key: string]: number } = {};
        allRequests.forEach(req => {
            if (req.estado === 'pagado' || req.tipo === 'Liquidación Final') {
                const date = new Date(req.fechaSolicitud);
                const monthYear = date.toLocaleString('es-PE', { month: 'long', year: 'numeric' });
                totals[monthYear] = (totals[monthYear] || 0) + req.montoSolicitado;
            }
        });
        setMonthlyTotals(totals);
    };

    const handleConfirmPayment = (req: PaymentRequest) => {
        const confirmPay = confirm(`¿Confirmar pago de S/ ${req.montoSolicitado.toFixed(2)} al técnico ${req.tecnico.nombre}?`);
        if (!confirmPay) return;

        // Actualizar el ticket en localStorage
        const saved = localStorage.getItem(`ticket_state_${req.ticketId}`);
        if (saved) {
            const ticket = JSON.parse(saved);
            const nuevoPago = {
                id: Date.now(),
                monto: req.montoSolicitado,
                fecha: new Date().toISOString(),
                tipo: req.tipo,
                estado: 'pagado'
            };

            const historial = [...(ticket.historialPagosTecnico || []), nuevoPago];

            let updatedTicket = { ...ticket, historialPagosTecnico: historial };

            if (req.tipo === 'Adelanto') {
                updatedTicket.adelantoPagado = true;
                updatedTicket.fechaPagoAdelante = new Date().toISOString();
            } else if (req.tipo === 'Refuerzo') {
                updatedTicket.solicitudAdelantoExtra = { ...ticket.solicitudAdelantoExtra, pagado: true };
            } else if (req.tipo === 'Liquidación Final') {
                updatedTicket.estadoId = 'ticket_cerrado';
                updatedTicket.fechaPagoFinal = new Date().toISOString();
            } else if (req.tipo === 'Movilidad / Visita') {
                updatedTicket.estadoId = 'en_inspeccion';
                updatedTicket.visitPaymentConfirmed = true;
                updatedTicket.fechaPagoVisita = new Date().toISOString();
            }

            localStorage.setItem(`ticket_state_${req.ticketId}`, JSON.stringify(updatedTicket));

            // Recargar datos
            loadData();
            alert("Pago procesado correctamente.");
        }
    };

    const filteredRequests = paymentRequests.filter(req => {
        if (filter === 'todos') return true;
        return req.estado === filter;
    });

    const pendingCount = paymentRequests.filter(r => r.estado === 'pendiente').length;
    const totalPendingAmount = paymentRequests
        .filter(r => r.estado === 'pendiente')
        .reduce((sum, r) => sum + r.montoSolicitado, 0);

    return (
        <div className={styles.paymentsContainer}>
            <header className={styles.header}>
                <div className={styles.titleSection}>
                    <h1>Módulo de Pagos y Tesorería</h1>
                    <p>Centralización de transferencias bancarias a técnicos y seguimiento de rentabilidad.</p>
                </div>
            </header>

            <h2 className={styles.sectionTitle}><TrendingUp size={18} /> Resumen Acumulativo Mensual (Monto Realizado)</h2>
            <div className={styles.monthlyBreakdown}>
                {Object.keys(monthlyTotals).length === 0 ? (
                    <div className={styles.emptyState} style={{ padding: '20px', gridColumn: '1 / -1' }}>
                        <p>No hay datos acumulados para mostrar.</p>
                    </div>
                ) : (
                    Object.entries(monthlyTotals).map(([month, total]) => (
                        <div key={month} className={styles.monthCard}>
                            <span className={styles.monthName}>{month}</span>
                            <span className={styles.monthValue}>S/ {total.toLocaleString('es-PE', { minimumFractionDigits: 2 })}</span>
                            <div className={styles.monthTrend}>
                                <ArrowUpRight size={12} />
                                <span>Realizado</span>
                            </div>
                        </div>
                    ))
                )}
            </div>

            <div className={styles.statsRow}>
                <div className={styles.statCard}>
                    <div className={styles.statIcon} style={{ background: '#EFF6FF', color: '#1D4ED8' }}>
                        <Wallet size={24} />
                    </div>
                    <div className={styles.statInfo}>
                        <span className={styles.statLabel}>Pagos Pendientes</span>
                        <span className={styles.statValue}>{pendingCount}</span>
                    </div>
                </div>
                <div className={styles.statCard}>
                    <div className={styles.statIcon} style={{ background: '#ECFDF5', color: '#059669' }}>
                        <DollarSign size={24} />
                    </div>
                    <div className={styles.statInfo}>
                        <span className={styles.statLabel}>Total para Desembolso</span>
                        <span className={styles.statValue}>S/ {totalPendingAmount.toLocaleString('es-PE', { minimumFractionDigits: 2 })}</span>
                    </div>
                </div>
                <div className={styles.statCard}>
                    <div className={styles.statIcon} style={{ background: '#F5F3FF', color: '#7C3AED' }}>
                        <Calculator size={24} />
                    </div>
                    <div className={styles.statInfo}>
                        <span className={styles.statLabel}>Utilidad Proyectada</span>
                        <span className={styles.statValue}>S/ {paymentRequests.reduce((sum, r) => sum + r.montoGanadoEsperado, 0).toLocaleString('es-PE', { minimumFractionDigits: 2 })}</span>
                    </div>
                </div>
            </div>

            <div className={styles.tableCard}>
                <div className={styles.tableHeader}>
                    <h2><Clock size={18} /> Historial de Peticiones de Gestoras</h2>
                    <div className={styles.pills}>
                        <div
                            className={`${styles.pill} ${filter === 'todos' ? styles.pillActive : ''}`}
                            onClick={() => setFilter('todos')}
                        >
                            Ver Todos
                        </div>
                        <div
                            className={`${styles.pill} ${filter === 'pendiente' ? styles.pillActive : ''}`}
                            onClick={() => setFilter('pendiente')}
                        >
                            Pendientes ({pendingCount})
                        </div>
                        <div
                            className={`${styles.pill} ${filter === 'pagado' ? styles.pillActive : ''}`}
                            onClick={() => setFilter('pagado')}
                        >
                            Procesados
                        </div>
                    </div>
                </div>

                <div className={styles.tableBody}>
                    <table className={styles.paymentsTable}>
                        <thead>
                            <tr>
                                <th>TICKET / SEDE</th>
                                <th>TÉCNICO Y CUENTA</th>
                                <th>TIPO</th>
                                <th>CÁLCULO Y UTILIDAD</th>
                                <th>ACCIONES</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredRequests.length === 0 ? (
                                <tr>
                                    <td colSpan={5}>
                                        <div className={styles.emptyState}>
                                            <AlertCircle size={48} />
                                            <p>No hay peticiones de pago en esta categoría.</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                filteredRequests.map((req) => (
                                    <>
                                        <tr key={req.id}>
                                            <td>
                                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                    <span className={styles.ticketId}>{req.ticketNum}</span>
                                                    <span style={{ fontSize: '0.75rem', fontWeight: 700, marginTop: '4px' }}>{req.cliente}</span>
                                                    <span style={{ fontSize: '0.7rem', color: '#64748B' }}>{req.sede}</span>
                                                </div>
                                            </td>
                                            <td>
                                                <div className={styles.techInfo}>
                                                    <span className={styles.techName}>{req.tecnico.nombre}</span>
                                                    <div className={styles.techAccount}>
                                                        <CreditCard size={12} />
                                                        <span>{req.tecnico.banco}: {req.tecnico.numeroCuenta}</span>
                                                    </div>
                                                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                                        <span style={{ fontSize: '0.65rem', color: '#94A3B8' }}>CCI: {req.tecnico.cci}</span>
                                                        <div style={{ display: 'flex', gap: '4px' }}>
                                                            {req.tecnico.yape && <span title={`Yape: ${req.tecnico.yape}`} style={{ fontSize: '0.65rem', color: '#7C3AED', fontWeight: 800 }}>[Y]</span>}
                                                            {req.tecnico.plin && <span title={`Plin: ${req.tecnico.plin}`} style={{ fontSize: '0.65rem', color: '#00D1FF', fontWeight: 800 }}>[P]</span>}
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td>
                                                <span className={`${styles.typeBadge} ${req.tipo === 'Adelanto' ? styles.typeAdvance :
                                                    req.tipo === 'Refuerzo' ? styles.typeReinforcement :
                                                        req.tipo === 'Movilidad / Visita' ? styles.typeMobility :
                                                            styles.typeFinal
                                                    }`}>
                                                    {req.tipo}
                                                </span>
                                            </td>
                                            <td>
                                                <div className={styles.amountBox}>
                                                    <span className={styles.approvedAmount}>S/ {req.montoSolicitado.toLocaleString('es-PE', { minimumFractionDigits: 2 })}</span>
                                                    <span className={styles.expectedProfit}>Ganancia: S/ {req.montoGanadoEsperado.toLocaleString('es-PE', { minimumFractionDigits: 2 })}</span>
                                                </div>
                                            </td>
                                            <td>
                                                <div style={{ display: 'flex', gap: '8px' }}>
                                                    {req.estado === 'pendiente' ? (
                                                        <button
                                                            className={styles.actionBtn}
                                                            onClick={() => handleConfirmPayment(req)}
                                                        >
                                                            <CheckCircle2 size={16} />
                                                            PAGAR AHORA
                                                        </button>
                                                    ) : (
                                                        <div style={{ color: '#059669', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 700, fontSize: '0.8rem' }}>
                                                            <CheckCircle2 size={16} /> COMPLETADO
                                                        </div>
                                                    )}

                                                    {req.historialDepositos.length > 0 && (
                                                        <button
                                                            className={styles.historyBtn}
                                                            onClick={() => setExpandedHistory(expandedHistory === req.id ? null : req.id)}
                                                        >
                                                            <History size={14} />
                                                            {req.historialDepositos.length} {req.historialDepositos.length === 1 ? 'Depósito' : 'Depósitos'}
                                                            {expandedHistory === req.id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                        {expandedHistory === req.id && (
                                            <tr>
                                                <td colSpan={5} style={{ background: '#F8FAFC', padding: '0 20px 20px 20px' }}>
                                                    <div className={styles.historyDrawer}>
                                                        <span className={styles.historyTitle}>Desglose de Pagos del Ticket</span>
                                                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                            {req.historialDepositos.map((p: any, idx: number) => (
                                                                <div key={idx} className={styles.historyLine}>
                                                                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                                                                        <span style={{ fontSize: '0.65rem', background: '#E2E8F0', padding: '2px 6px', borderRadius: '4px' }}>#{idx + 1}</span>
                                                                        <span>{p.tipo || 'Depósito'}</span>
                                                                        <span style={{ color: '#94A3B8', fontSize: '0.75rem' }}>{new Date(p.fecha).toLocaleDateString()} {new Date(p.fecha).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                                                    </div>
                                                                    <strong style={{ color: '#111827' }}>S/ {p.monto.toLocaleString('es-PE', { minimumFractionDigits: 2 })}</strong>
                                                                </div>
                                                            ))}
                                                            <div className={styles.historyLine} style={{ borderTop: '2px solid #CBD5E1', marginTop: '10px', paddingTop: '10px' }}>
                                                                <strong>TOTAL TRANSFERIDO A LA FECHA</strong>
                                                                <strong style={{ color: '#059669', fontSize: '1rem' }}>
                                                                    S/ {req.historialDepositos.reduce((sum: number, p: any) => sum + p.monto, 0).toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                                                                </strong>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
