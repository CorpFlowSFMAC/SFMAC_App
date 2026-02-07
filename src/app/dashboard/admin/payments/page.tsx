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
    Eye
} from "lucide-react";
import styles from "./payments.module.css";

interface PaymentItem {
    id: string;
    tipo: 'Adelanto' | 'Refuerzo' | 'Liquidación Final' | 'Movilidad / Visita';
    monto: number;
    estado: 'pendiente' | 'pagado';
    fecha: string;
}

interface PaymentTicketGroup {
    ticketId: string;
    ticketNum: string;
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
    montoAdelantado: number; // Total Pagado
    saldoPendiente: number;
    items: PaymentItem[];
    historialDepositos: any[];
}

export default function PaymentsPage() {
    const [paymentGroups, setPaymentGroups] = useState<PaymentTicketGroup[]>([]);
    const [filter, setFilter] = useState<'todos' | 'pendiente' | 'pagado'>('todos');
    const [expandedHistory, setExpandedHistory] = useState<string | null>(null);
    const [monthlyTotals, setMonthlyTotals] = useState<{ [key: string]: number }>({});

    useEffect(() => {
        loadData();
        const handleStorageChange = () => loadData();
        window.addEventListener('storage', handleStorageChange);
        window.addEventListener('local-storage-update', handleStorageChange);
        return () => {
            window.removeEventListener('storage', handleStorageChange);
            window.removeEventListener('local-storage-update', handleStorageChange);
        };
    }, []);

    const calculateMonthlyTotals = (keys: string[]) => {
        const totals: { [key: string]: number } = {};
        keys.forEach(key => {
            const saved = localStorage.getItem(key);
            if (!saved) return;
            try {
                const ticket = JSON.parse(saved);
                (ticket.historialPagosTecnico || []).forEach((p: any) => {
                    if (p.monto && p.fecha && p.estado !== 'anulado') {
                        const date = new Date(p.fecha);
                        const k = date.toLocaleString('es-PE', { month: 'long', year: 'numeric' });
                        const formattedKey = k.charAt(0).toUpperCase() + k.slice(1);
                        totals[formattedKey] = (totals[formattedKey] || 0) + p.monto;
                    }
                });
            } catch (e) { }
        });
        setMonthlyTotals(totals);
    };

    const loadData = () => {
        const allGroups: PaymentTicketGroup[] = [];
        const keys = Object.keys(localStorage);
        const ticketKeys = keys.filter(k => k.startsWith('ticket_state_'));

        ticketKeys.forEach(key => {
            const saved = localStorage.getItem(key);
            if (saved) {
                try {
                    const ticket = JSON.parse(saved);
                    const ticketNum = ticket.numeroTicket || `#${ticket.id.toString().slice(-6).toUpperCase()}`;

                    const costoManoObra = parseFloat(ticket.costoManoObra || 0);
                    const costoMateriales = parseFloat(ticket.costoMateriales || 0);
                    const montoPactadoBase = costoManoObra + costoMateriales;

                    const pagos = ticket.historialPagosTecnico || [];
                    const totalPagado = pagos.reduce((sum: number, p: any) => sum + (parseFloat(p.monto) || 0), 0);

                    const techData = {
                        nombre: `${ticket.tecnico?.nombre || ''} ${ticket.tecnico?.apellido || ''}`.trim() || 'Sin asignar',
                        banco: ticket.tecnico?.banco || '---',
                        numeroCuenta: ticket.tecnico?.numeroCuenta || '---',
                        cci: ticket.tecnico?.cci || '---',
                        yape: ticket.tecnico?.yape,
                        plin: ticket.tecnico?.plin
                    };

                    const items: PaymentItem[] = [];

                    // 1. Adelanto
                    if (ticket.estadoId === 'cotizacion_aprobada' || ticket.adelantoPagado) {
                        const pct = ticket.porcentajeAdelanto || 0.5;
                        const adelantoMonto = montoPactadoBase * pct;
                        const adelantoRealizado = ticket.adelantoPagado;

                        // Solo mostrar si es relevante (pagado o pendiente si corresponde)
                        // Aquí asumimos siempre mostrar si existe la "intención"
                        items.push({
                            id: `${ticket.id}_adelanto`,
                            tipo: 'Adelanto',
                            monto: adelantoMonto,
                            estado: adelantoRealizado ? 'pagado' : 'pendiente',
                            fecha: ticket.fechaAprobacionCotizacion || new Date().toISOString()
                        });
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

                    // 3. Liquidación
                    if (ticket.estadoId === 'por_liquidar' || ticket.estadoId === 'ticket_cerrado') {
                        const saldoReal = montoPactadoBase - totalPagado;
                        const pagoFinal = pagos.find((p: any) => p.referencia?.includes("Liquidación") || p.tipo === "Liquidación Final");
                        const montoSolicitadoFinal = ticket.estadoId === 'ticket_cerrado' ? (pagoFinal?.monto || 0) : saldoReal;

                        if (montoSolicitadoFinal > 0 || ticket.estadoId === 'ticket_cerrado') {
                            items.push({
                                id: `${ticket.id}_final`,
                                tipo: 'Liquidación Final',
                                monto: montoSolicitadoFinal,
                                estado: ticket.estadoId === 'ticket_cerrado' ? 'pagado' : 'pendiente',
                                fecha: ticket.fechaValidacionDocumental || ticket.fechaPagoFinal || new Date().toISOString()
                            });
                        }
                    }

                    // Only add group if there are items to show
                    if (items.length > 0) {
                        allGroups.push({
                            ticketId: ticket.id,
                            ticketNum,
                            cliente: ticket.cliente?.nombre || 'MiBanco',
                            sede: ticket.sede?.nombre || 'Sede Central',
                            tecnico: techData,
                            montoPactado: montoPactadoBase,
                            montoAdelantado: totalPagado, // Total Pagado Histórico
                            saldoPendiente: montoPactadoBase - totalPagado,
                            items: items,
                            historialDepositos: pagos
                        });
                    }

                } catch (e) {
                    console.error("Error parsing ticket:", e);
                }
            }
        });

        // Ordenar: Grupos con pendientes primero, luego por fecha más reciente (usando el item más nuevo)
        allGroups.sort((a, b) => {
            const hasPendingA = a.items.some(i => i.estado === 'pendiente');
            const hasPendingB = b.items.some(i => i.estado === 'pendiente');

            if (hasPendingA !== hasPendingB) return hasPendingA ? -1 : 1;

            // Si ambos son iguales, ordenar por fecha del último item
            const lastDateA = a.items.reduce((max, i) => i.fecha > max ? i.fecha : max, "");
            const lastDateB = b.items.reduce((max, i) => i.fecha > max ? i.fecha : max, "");

            return new Date(lastDateB).getTime() - new Date(lastDateA).getTime();
        });

        setPaymentGroups(allGroups);
        calculateMonthlyTotals(ticketKeys);
    };
    const handleConfirmPayment = (group: PaymentTicketGroup, item: PaymentItem, voucherBase64?: string | null) => {
        const saved = localStorage.getItem(`ticket_state_${group.ticketId}`);
        if (!saved) return;

        const ticket = JSON.parse(saved);
        const paymentId = Date.now().toString();

        let voucherRef = null;
        if (voucherBase64) {
            try {
                const vKey = `payment_voucher_${paymentId}`;
                localStorage.setItem(vKey, voucherBase64);
                voucherRef = vKey;
            } catch (e) {
                console.error("Error saving voucher image:", e);
                alert("No se pudo guardar la imagen del voucher. El pago se registrará sin imagen.");
            }
        }

        const nuevoPago = {
            id: paymentId,
            monto: item.monto,
            fecha: new Date().toISOString(),
            tipo: item.tipo,
            estado: 'pagado',
            referencia: `Transferencia Web - ${item.tipo}`,
            voucherRef
        };

        const updatedTicket = { ...ticket, historialPagosTecnico: [...(ticket.historialPagosTecnico || []), nuevoPago] };

        if (item.tipo === 'Adelanto') {
            updatedTicket.adelantoPagado = true;
            updatedTicket.fechaPagoAdelanto = new Date().toISOString();
        } else if (item.tipo === 'Refuerzo') {
            updatedTicket.solicitudAdelantoExtra = { ...ticket.solicitudAdelantoExtra, pagado: true };
        } else if (item.tipo === 'Liquidación Final') {
            updatedTicket.estadoId = 'ticket_cerrado';
            updatedTicket.fechaPagoFinal = new Date().toISOString();
        } else if (item.tipo === 'Movilidad / Visita') {
            if (updatedTicket.estadoId === 'esperando_pago_visita') updatedTicket.estadoId = 'en_inspeccion';
            updatedTicket.visitPaymentConfirmed = true;
            updatedTicket.fechaPagoVisita = new Date().toISOString();
        }

        try {
            localStorage.setItem(`ticket_state_${group.ticketId}`, JSON.stringify(updatedTicket));
        } catch (e) {
            alert("Error al guardar estado del ticket. Limpie el historial.");
            return;
        }

        window.dispatchEvent(new Event('local-storage-update'));
        loadData();
    };

    const filteredGroups = paymentGroups.filter(g => {
        if (filter === 'todos') return true;
        return g.items.some(i => i.estado === filter);
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
                        <span className={styles.statValue}>S/ {(Object.values(monthlyTotals)[0] || 0).toLocaleString('es-PE', { minimumFractionDigits: 2 })}</span>
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
                    <table className={styles.paymentsTable}>
                        <thead>
                            <tr>
                                <th style={{ width: '20%' }}>TICKET / CLIENTE / SEDE</th>
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
                                                            <span>CTA: {group.tecnico.numeroCuenta}</span>
                                                            {group.tecnico.cci && <span>CCI: {group.tecnico.cci}</span>}
                                                        </div>
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
                                                            {/* Actions for this specific item inside the cell? Or put actions in next column? */}
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
                                                                                if (confirm(`¿Confirmar pago de S/ ${item.monto} para ${item.tipo} y subir voucher?`)) {
                                                                                    handleConfirmPayment(group, item, reader.result as string);
                                                                                }
                                                                            };
                                                                            reader.readAsDataURL(file);
                                                                        }
                                                                    }}
                                                                />
                                                            </label>
                                                            <button
                                                                style={{ border: '1px solid #E2E8F0', background: 'white', color: '#64748B', padding: '4px 8px', borderRadius: '6px', fontSize: '0.7rem', cursor: 'pointer', width: '100%' }}
                                                                onClick={() => {
                                                                    if (confirm(`¿Confirmar transferencia de S/ ${item.monto.toFixed(2)} a ${group.tecnico.nombre}?`)) {
                                                                        handleConfirmPayment(group, item);
                                                                    }
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
                                                                        <span>{dep.tipo || 'Depósito'}</span>
                                                                        <strong>S/ {parseFloat(dep.monto).toFixed(2)}</strong>
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
                </div>
            </div>
        </div>
    );
}
