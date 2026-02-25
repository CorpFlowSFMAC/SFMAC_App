"use client";

import { useState, useMemo, useEffect } from "react";
import {
    TrendingUp, TrendingDown, Users, Award, AlertTriangle,
    Clock, CheckCircle, XCircle, BarChart3, PieChart, Calendar,
    Download, Filter, User, DollarSign
} from "lucide-react";
import styles from "./reportes.module.css";
import { useAppData } from "@/lib/AppDataContext";
import { normalizeStateId, TICKET_STATES } from "@/lib/ticketStates";

// Componentes Visuales Minimalistas (SVG)
const PieChartSVG = ({ data, colors }: { data: number[], colors: string[] }) => {
    const total = data.reduce((a, b) => a + b, 0);
    let cumulativePercent = 0;

    function getCoordinatesForPercent(percent: number) {
        const x = Math.cos(2 * Math.PI * percent);
        const y = Math.sin(2 * Math.PI * percent);
        return [x, y];
    }

    return (
        <svg viewBox="-1 -1 2 2" style={{ transform: 'rotate(-90deg)', width: '100%', height: '100%' }}>
            {data.map((value, i) => {
                if (value === 0) return null;
                const [startX, startY] = getCoordinatesForPercent(cumulativePercent);
                const percent = value / total;
                cumulativePercent += percent;
                const [endX, endY] = getCoordinatesForPercent(cumulativePercent);
                const largeArcFlag = percent > 0.5 ? 1 : 0;
                const pathData = [
                    `M ${startX} ${startY}`,
                    `A 1 1 0 ${largeArcFlag} 1 ${endX} ${endY}`,
                    `L 0 0`,
                ].join(' ');
                return <path key={i} d={pathData} fill={colors[i]} />;
            })}
        </svg>
    );
};

const BarChartSVG = ({ data, labels, color }: { data: number[], labels: string[], color: string }) => {
    const max = Math.max(...data, 1);
    return (
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px', height: '120px', padding: '10px 0' }}>
            {data.map((v, i) => (
                <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                    <div
                        style={{
                            width: '100%',
                            height: `${(v / max) * 100}%`,
                            background: color,
                            borderRadius: '4px 4px 0 0',
                            minHeight: '2px',
                            transition: 'height 0.6s ease'
                        }}
                    />
                    <span style={{ fontSize: '10px', color: '#64748B', fontWeight: 600 }}>{labels[i]}</span>
                </div>
            ))}
        </div>
    );
};

export default function ReportesPage() {
    const { tickets, technicians } = useAppData();
    const [selectedPeriod, setSelectedPeriod] = useState<"week" | "month" | "all">("month");
    const [selectedMetric, setSelectedMetric] = useState<"sla" | "volume" | "efficiency" | "finance">("sla");

    // 🎯 Calcular Eficiencia por Gestora
    const gestoras = useMemo(() => {
        const gestorasMap: any = {};

        tickets.forEach((ticket: any) => {
            // Asumimos que el último usuario del historial es la gestora asignada
            const gestora = ticket.historial?.[0]?.usuario || "Sin Asignar";

            if (!gestorasMap[gestora]) {
                gestorasMap[gestora] = {
                    nombre: gestora,
                    totalTickets: 0,
                    cerrados: 0,
                    enRiesgo: 0,
                    promedioHoras: 0,
                    ticketsAnalizados: []
                };
            }

            gestorasMap[gestora].totalTickets++;
            gestorasMap[gestora].ticketsAnalizados.push(ticket);

            if (normalizeStateId(ticket.estadoId) === "ticket_cerrado") {
                gestorasMap[gestora].cerrados++;
            }

            // Calcular si estuvo en riesgo
            const horasTranscurridas = calcularHorasTranscurridas(ticket);
            if (horasTranscurridas >= 60 && normalizeStateId(ticket.estadoId) !== "ticket_cerrado") {
                gestorasMap[gestora].enRiesgo++;
            }

            gestorasMap[gestora].promedioHoras += horasTranscurridas;
        });

        // Calcular promedios y eficiencia
        return Object.values(gestorasMap).map((g: any) => {
            const promedio = g.promedioHoras / g.totalTickets;
            const tasaCierre = (g.cerrados / g.totalTickets) * 100;
            const eficiencia = Math.max(0, 100 - (promedio / 72 * 100) - (g.enRiesgo / g.totalTickets * 50));

            return {
                ...g,
                promedioHoras: promedio,
                tasaCierre,
                eficiencia: Math.round(eficiencia)
            };
        }).sort((a, b) => b.eficiencia - a.eficiencia);
    }, [tickets]);

    // 🎯 Calcular Eficiencia por Técnico
    const tecnicos = useMemo(() => {
        const tecnicosMap: any = {};

        tickets.forEach((ticket: any) => {
            const tecnico = ticket.tecnico?.nombre;
            if (!tecnico) return;

            if (!tecnicosMap[tecnico]) {
                tecnicosMap[tecnico] = {
                    nombre: tecnico,
                    totalTickets: 0,
                    completados: 0,
                    promedioHoras: 0,
                    enRiesgo: 0
                };
            }

            tecnicosMap[tecnico].totalTickets++;

            if (["documentacion_enviada", "por_liquidar", "ticket_cerrado"].includes(normalizeStateId(ticket.estadoId))) { // Completado o superior
                tecnicosMap[tecnico].completados++;
            }

            const horasTranscurridas = calcularHorasTranscurridas(ticket);
            if (horasTranscurridas >= 60 && normalizeStateId(ticket.estadoId) !== "ticket_cerrado") {
                tecnicosMap[tecnico].enRiesgo++;
            }

            tecnicosMap[tecnico].promedioHoras += horasTranscurridas;
        });

        return Object.values(tecnicosMap).map((t: any) => {
            const promedio = t.promedioHoras / t.totalTickets;
            const tasaComplecion = (t.completados / t.totalTickets) * 100;
            const eficiencia = Math.max(0, 100 - (promedio / 72 * 100) - (t.enRiesgo / t.totalTickets * 30));

            return {
                ...t,
                promedioHoras: promedio,
                tasaComplecion,
                eficiencia: Math.round(eficiencia)
            };
        }).sort((a, b) => b.eficiencia - a.eficiencia);
    }, [tickets]);

    // 🎯 Tickets en Riesgo Crítico
    const ticketsRiesgo = useMemo(() => {
        return tickets
            .filter((t: any) => {
                const horas = calcularHorasTranscurridas(t);
                return horas >= 60 && normalizeStateId(t.estadoId) !== "ticket_cerrado";
            })
            .sort((a: any, b: any) => {
                return calcularHorasTranscurridas(b) - calcularHorasTranscurridas(a);
            });
    }, [tickets]);

    // 🎯 KPIs Generales
    const kpis = useMemo(() => {
        const total = tickets.length;
        const cerrados = tickets.filter((t: any) => normalizeStateId(t.estadoId) === "ticket_cerrado").length;
        const enRiesgo = ticketsRiesgo.length;
        const promedioGeneral = tickets.reduce((acc: number, t: any) => {
            return acc + calcularHorasTranscurridas(t);
        }, 0) / total || 0;

        const cumplimientoSLA = ((total - enRiesgo) / total) * 100 || 0;

        return {
            total,
            cerrados,
            enRiesgo,
            promedioHoras: Math.round(promedioGeneral),
            cumplimientoSLA: Math.round(cumplimientoSLA),
            tasaCierre: Math.round((cerrados / total) * 100) || 0
        };
    }, [tickets, ticketsRiesgo]);

    // 🎯 Métricas Financieras (Rentabilidad y Flujo)
    const finanzas = useMemo(() => {
        let ingresosTotales = 0;
        let costosTotales = 0;
        let montosPedidos = 0;
        let ticketsCerradosCount = 0;

        tickets.forEach((t: any) => {
            const sid = normalizeStateId(t.estadoId);
            const ingreso = (parseFloat(t.costoManoObra || 0) + parseFloat(t.costoMateriales || 0));
            const pagado = (t.historialPagosTecnico || t.metadata?.historialPagosTecnico || []).reduce((sum: number, p: any) => sum + p.monto, 0);

            // Montos que "pide" la gestora (basado en solicitudes en metadata)
            const pedido = (t.solicitudAdelanto?.monto || 0) + (t.solicitudPagoVisita ? parseFloat(t.costoVisita || 0) : 0) + (t.solicitudLiquidacion?.monto || 0);
            montosPedidos += pedido;

            if (sid === "ticket_cerrado") {
                ticketsCerradosCount++;
                ingresosTotales += ingreso;
                costosTotales += pagado;
            } else if (pagado > 0) {
                // También contar costos de tickets en proceso
                costosTotales += pagado;
            }
        });

        const utilidad = ingresosTotales - costosTotales;
        const margen = ingresosTotales > 0 ? (utilidad / ingresosTotales) * 100 : 0;

        return { ingresosTotales, costosTotales, montosPedidos, utilidad, margen, ticketsCerradosCount };
    }, [tickets]);

    // 🎯 Datos para Históricos (meses)
    const historicoMensual = useMemo(() => {
        const meses = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
        const data = new Array(12).fill(0);
        const pagos = new Array(12).fill(0);

        tickets.forEach((t: any) => {
            const date = new Date(t.createdAt || t.created_at);
            const mes = date.getMonth();
            data[mes]++;

            const pagado = (t.historialPagosTecnico || t.metadata?.historialPagosTecnico || []).reduce((sum: number, p: any) => sum + p.monto, 0);
            pagos[mes] += pagado;
        });

        // Solo mostrar meses con actividad
        return {
            labels: meses,
            tickets: data,
            pagos: pagos
        };
    }, [tickets]);

    const [userRole, setUserRole] = useState<string | null>(null);
    useEffect(() => {
        if (typeof window !== "undefined") {
            setUserRole(localStorage.getItem("userRole"));
        }
    }, []);

    function calcularHorasTranscurridas(ticket: any): number {
        const ahora = new Date().getTime();
        const fechaBase = ticket.fechaInicioSLA || ticket.createdAt || ticket.created_at;
        const inicio = new Date(fechaBase).getTime();
        if (isNaN(inicio)) return 0;
        const horasReales = (ahora - inicio) / (1000 * 60 * 60);
        return Math.max(0, horasReales - (ticket.horasPausadas || 0));
    }

    function getEficienciaColor(eficiencia: number): string {
        if (eficiencia >= 80) return "#10B981"; // Verde
        if (eficiencia >= 60) return "#F59E0B"; // Amarillo
        return "#DC2626"; // Rojo
    }

    function exportarReporte() {
        alert("📊 Función de exportación a Excel/PDF en desarrollo");
        // TODO: Implementar exportación
    }

    return (
        <div className={styles.container}>
            {/* Header */}
            <div className={styles.pageHeader}>
                <div className={styles.headerContent}>
                    <div className={styles.titleGroup}>
                        <div className={styles.headerIcon}>
                            <BarChart3 size={32} />
                        </div>
                        <div>
                            <h1 className={styles.pageTitle}>Reportes de Eficiencia</h1>
                            <p className={styles.pageSubtitle}>Análisis de Rendimiento SLA 72h</p>
                        </div>
                    </div>
                    <div className={styles.headerActions}>
                        <select
                            className={styles.periodSelector}
                            value={selectedPeriod}
                            onChange={(e) => setSelectedPeriod(e.target.value as any)}
                        >
                            <option value="week">Esta Semana</option>
                            <option value="month">Este Mes</option>
                            <option value="all">Todo el Tiempo</option>
                        </select>
                        <button className={styles.exportButton} onClick={exportarReporte}>
                            <Download size={20} />
                            Exportar
                        </button>
                    </div>
                </div>
            </div>

            {/* KPIs Globales */}
            <div className={styles.kpisGrid}>
                <div className={styles.kpiCard}>
                    <div className={styles.kpiIcon} style={{ background: 'linear-gradient(135deg, #3B82F6, #60A5FA)' }}>
                        <TrendingUp size={24} />
                    </div>
                    <div className={styles.kpiContent}>
                        <div className={styles.kpiValue}>{kpis.total}</div>
                        <div className={styles.kpiLabel}>Total Tickets</div>
                    </div>
                </div>

                <div className={styles.kpiCard}>
                    <div className={styles.kpiIcon} style={{ background: 'linear-gradient(135deg, #10B981, #34D399)' }}>
                        <CheckCircle size={24} />
                    </div>
                    <div className={styles.kpiContent}>
                        <div className={styles.kpiValue}>{kpis.cumplimientoSLA}%</div>
                        <div className={styles.kpiLabel}>Cumplimiento SLA</div>
                    </div>
                </div>

                <div className={styles.kpiCard}>
                    <div className={styles.kpiIcon} style={{ background: 'linear-gradient(135deg, #F59E0B, #FBBF24)' }}>
                        <Clock size={24} />
                    </div>
                    <div className={styles.kpiContent}>
                        <div className={styles.kpiValue}>{kpis.promedioHoras}h</div>
                        <div className={styles.kpiLabel}>Promedio Cierre</div>
                    </div>
                </div>

                <div className={styles.kpiCard}>
                    <div className={styles.kpiIcon} style={{ background: 'linear-gradient(135deg, #DC2626, #EF4444)' }}>
                        <AlertTriangle size={24} />
                    </div>
                    <div className={styles.kpiContent}>
                        <div className={styles.kpiValue}>{kpis.enRiesgo}</div>
                        <div className={styles.kpiLabel}>En Riesgo Crítico</div>
                    </div>
                </div>
            </div>

            {/* Tabs de Métricas */}
            <div className={styles.metricsTab}>
                <button
                    className={`${styles.metricBtn} ${selectedMetric === 'sla' ? styles.metricBtnActive : ''}`}
                    onClick={() => setSelectedMetric('sla')}
                >
                    <Clock size={18} />
                    Cumplimiento SLA
                </button>
                <button
                    className={`${styles.metricBtn} ${selectedMetric === 'volume' ? styles.metricBtnActive : ''}`}
                    onClick={() => setSelectedMetric('volume')}
                >
                    <Calendar size={18} />
                    Histórico Mensual
                </button>
                <button
                    className={`${styles.metricBtn} ${selectedMetric === 'efficiency' ? styles.metricBtnActive : ''}`}
                    onClick={() => setSelectedMetric('efficiency')}
                >
                    <Award size={18} />
                    Ranking Eficiencia
                </button>
                {userRole === 'admin' && (
                    <button
                        className={`${styles.metricBtn} ${selectedMetric === 'finance' ? styles.metricBtnActive : ''}`}
                        onClick={() => setSelectedMetric('finance')}
                    >
                        <DollarSign size={18} />
                        Flujo Financiero
                    </button>
                )}
            </div>

            {/* Contenido Principal */}
            <div className={styles.contentGrid}>
                {selectedMetric === 'sla' && (
                    <div className={styles.chartSection}>
                        <div className={styles.sectionHeader}>
                            <h2><PieChart size={20} /> Distribución de Estados</h2>
                        </div>
                        <div className={styles.chartContent}>
                            <div className={styles.chartWrapper}>
                                <PieChartSVG
                                    data={[kpis.cerrados, kpis.enRiesgo, kpis.total - kpis.cerrados - kpis.enRiesgo]}
                                    colors={['#10B981', '#DC2626', '#3B82F6']}
                                />
                            </div>
                            <div className={styles.chartLegend}>
                                <div className={styles.legendItem}><span style={{ background: '#10B981' }} /> Cerrados ({kpis.cerrados})</div>
                                <div className={styles.legendItem}><span style={{ background: '#DC2626' }} /> En Riesgo ({kpis.enRiesgo})</div>
                                <div className={styles.legendItem}><span style={{ background: '#3B82F6' }} /> En Proceso ({kpis.total - kpis.cerrados - kpis.enRiesgo})</div>
                            </div>
                        </div>
                    </div>
                )}

                {selectedMetric === 'volume' && (
                    <div className={styles.chartSection}>
                        <div className={styles.sectionHeader}>
                            <h2><BarChart3 size={20} /> Tickets por Mes</h2>
                        </div>
                        <BarChartSVG
                            data={historicoMensual.tickets}
                            labels={historicoMensual.labels}
                            color="#3B82F6"
                        />
                    </div>
                )}

                {selectedMetric === 'finance' && (
                    <div className={styles.financeFullSection}>
                        <div className={styles.financeSummaryGrid}>
                            <div className={styles.financeCard}>
                                <div className={styles.finLabel}>SOLICITADO POR GESTORA</div>
                                <div className={styles.finValue} style={{ color: '#3B82F6' }}>
                                    S/ {finanzas.montosPedidos.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                                </div>
                                <div className={styles.finSub}>Total solicitudes de adelanto/visita</div>
                            </div>
                            <div className={styles.financeCard}>
                                <div className={styles.finLabel}>TOTAL PAGADO (REAL)</div>
                                <div className={styles.finValue} style={{ color: '#10B981' }}>
                                    S/ {finanzas.costosTotales.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                                </div>
                                <div className={styles.finSub}>Efectuado en historial de pagos</div>
                            </div>
                            <div className={styles.financeCard} style={{ background: '#F0FDFA', borderColor: '#10B981' }}>
                                <div className={styles.finLabel} style={{ color: '#0F766E' }}>UTILIDAD PROYECTADA</div>
                                <div className={styles.finValue} style={{ color: '#059669' }}>
                                    S/ {finanzas.utilidad.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                                </div>
                                <div className={styles.finMarginBadge}>Margen ROI: {Math.round(finanzas.margen)}%</div>
                            </div>
                        </div>

                        <div className={styles.section} style={{ marginTop: '2rem' }}>
                            <div className={styles.sectionHeader}>
                                <h2><TrendingUp size={20} /> Histórico de Egresos</h2>
                            </div>
                            <BarChartSVG
                                data={historicoMensual.pagos}
                                labels={historicoMensual.labels}
                                color="#10B981"
                            />
                        </div>
                    </div>
                )}

                {(selectedMetric === 'efficiency' || selectedMetric === 'sla' || selectedMetric === 'volume') && (
                    <>
                        {/* Ranking de Gestoras */}
                        <div className={styles.section}>
                            <div className={styles.sectionHeader}>
                                <h2><Users size={20} /> Eficiencia Gestoras</h2>
                            </div>
                            <div className={styles.rankingList}>
                                {gestoras.map((gestora: any, index: number) => (
                                    <div key={gestora.nombre} className={styles.rankingItem}>
                                        <div className={styles.rankingInfo}>
                                            <div className={styles.rankingName}>{gestora.nombre}</div>
                                            <div className={styles.rankingBar}>
                                                <div
                                                    className={styles.rankingFill}
                                                    style={{
                                                        width: `${gestora.eficiencia}%`,
                                                        background: getEficienciaColor(gestora.eficiencia)
                                                    }}
                                                />
                                            </div>
                                        </div>
                                        <div className={styles.rankingScore} style={{ color: getEficienciaColor(gestora.eficiencia) }}>
                                            {gestora.eficiencia}%
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Ranking de Técnicos */}
                        <div className={styles.section}>
                            <div className={styles.sectionHeader}>
                                <h2><User size={20} /> Técnicos Top Performance</h2>
                            </div>
                            <div className={styles.rankingList}>
                                {tecnicos.slice(0, 5).map((tecnico: any) => (
                                    <div key={tecnico.nombre} className={styles.rankingItem}>
                                        <div className={styles.rankingInfo}>
                                            <div className={styles.rankingName}>{tecnico.nombre}</div>
                                            <div className={styles.rankingStats}>{tecnico.completados} serv. / {tecnico.totalTickets} total</div>
                                        </div>
                                        <div className={styles.rankingScore} style={{ color: getEficienciaColor(tecnico.eficiencia) }}>
                                            {tecnico.eficiencia}%
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </>
                )}
            </div>

            {/* Tickets en Riesgo Crítico */}
            {ticketsRiesgo.length > 0 && (
                <div className={styles.alertSection}>
                    <div className={styles.sectionHeader}>
                        <h2><AlertTriangle size={20} /> Alerta SLA: Riesgo Crítico (60h+)</h2>
                        <span className={styles.alertCount}>{ticketsRiesgo.length}</span>
                    </div>
                    <div className={styles.alertsList}>
                        {ticketsRiesgo.slice(0, 3).map((t: any) => (
                            <div key={t.id} className={styles.alertItem}>
                                <strong>{t.cliente?.nombre} ({t.numeroTicketCliente})</strong>
                                <span>{Math.floor(calcularHorasTranscurridas(t))}h transcurridas</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
