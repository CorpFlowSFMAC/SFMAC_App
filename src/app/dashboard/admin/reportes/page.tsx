"use client";

import { useState, useMemo } from "react";
import {
    TrendingUp, TrendingDown, Users, Award, AlertTriangle,
    Clock, CheckCircle, XCircle, BarChart3, PieChart, Calendar,
    Download, Filter, User
} from "lucide-react";
import styles from "./reportes.module.css";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { normalizeStateId, TICKET_STATES } from "@/lib/ticketStates";

export default function ReportesPage() {
    const [tickets] = useLocalStorage("tickets", []);
    const [technicians] = useLocalStorage("technicians", []);
    const [selectedPeriod, setSelectedPeriod] = useState<"week" | "month" | "all">("month");
    const [selectedMetric, setSelectedMetric] = useState<"sla" | "volume" | "efficiency">("sla");

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
            if (!ticket.tecnicoNombre) return;

            const tecnico = ticket.tecnicoNombre;

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

    function calcularHorasTranscurridas(ticket: any): number {
        const ahora = new Date().getTime();
        const inicio = new Date(ticket.fechaInicioSLA).getTime();
        const horasReales = (ahora - inicio) / (1000 * 60 * 60);
        return horasReales - (ticket.horasPausadas || 0);
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
                    Eficiencia SLA
                </button>
                <button
                    className={`${styles.metricBtn} ${selectedMetric === 'volume' ? styles.metricBtnActive : ''}`}
                    onClick={() => setSelectedMetric('volume')}
                >
                    <BarChart3 size={18} />
                    Volumen de Trabajo
                </button>
                <button
                    className={`${styles.metricBtn} ${selectedMetric === 'efficiency' ? styles.metricBtnActive : ''}`}
                    onClick={() => setSelectedMetric('efficiency')}
                >
                    <TrendingUp size={18} />
                    Rendimiento Global
                </button>
            </div>

            {/* Contenido Principal */}
            <div className={styles.contentGrid}>
                {/* Ranking de Gestoras */}
                <div className={styles.section}>
                    <div className={styles.sectionHeader}>
                        <h2>
                            <Users size={20} />
                            Ranking de Gestoras
                        </h2>
                    </div>

                    <div className={styles.rankingList}>
                        {gestoras.map((gestora: any, index: number) => (
                            <div key={gestora.nombre} className={styles.rankingItem}>
                                <div className={styles.rankingPosition}>
                                    {index === 0 && <Award size={24} color="#FFD700" />}
                                    {index === 1 && <Award size={24} color="#C0C0C0" />}
                                    {index === 2 && <Award size={24} color="#CD7F32" />}
                                    {index > 2 && <span className={styles.positionNumber}>#{index + 1}</span>}
                                </div>

                                <div className={styles.rankingInfo}>
                                    <div className={styles.rankingName}>{gestora.nombre}</div>
                                    <div className={styles.rankingStats}>
                                        {gestora.totalTickets} tickets • {gestora.cerrados} cerrados • {gestora.enRiesgo} en riesgo
                                    </div>
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

                                <div className={styles.rankingScore}>
                                    <div
                                        className={styles.scoreValue}
                                        style={{ color: getEficienciaColor(gestora.eficiencia) }}
                                    >
                                        {gestora.eficiencia}%
                                    </div>
                                    <div className={styles.scoreLabel}>Eficiencia</div>
                                </div>

                                <div className={styles.rankingMetrics}>
                                    <div className={styles.miniMetric}>
                                        <Clock size={14} />
                                        {Math.round(gestora.promedioHoras)}h
                                    </div>
                                    <div className={styles.miniMetric}>
                                        <CheckCircle size={14} />
                                        {Math.round(gestora.tasaCierre)}%
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Ranking de Técnicos */}
                <div className={styles.section}>
                    <div className={styles.sectionHeader}>
                        <h2>
                            <User size={20} />
                            Ranking de Técnicos
                        </h2>
                    </div>

                    <div className={styles.rankingList}>
                        {tecnicos.slice(0, 10).map((tecnico: any, index: number) => (
                            <div key={tecnico.nombre} className={styles.rankingItem}>
                                <div className={styles.rankingPosition}>
                                    {index === 0 && <Award size={24} color="#FFD700" />}
                                    {index === 1 && <Award size={24} color="#C0C0C0" />}
                                    {index === 2 && <Award size={24} color="#CD7F32" />}
                                    {index > 2 && <span className={styles.positionNumber}>#{index + 1}</span>}
                                </div>

                                <div className={styles.rankingInfo}>
                                    <div className={styles.rankingName}>{tecnico.nombre}</div>
                                    <div className={styles.rankingStats}>
                                        {tecnico.totalTickets} tickets • {tecnico.completados} completados
                                    </div>
                                    <div className={styles.rankingBar}>
                                        <div
                                            className={styles.rankingFill}
                                            style={{
                                                width: `${tecnico.eficiencia}%`,
                                                background: getEficienciaColor(tecnico.eficiencia)
                                            }}
                                        />
                                    </div>
                                </div>

                                <div className={styles.rankingScore}>
                                    <div
                                        className={styles.scoreValue}
                                        style={{ color: getEficienciaColor(tecnico.eficiencia) }}
                                    >
                                        {tecnico.eficiencia}%
                                    </div>
                                    <div className={styles.scoreLabel}>Eficiencia</div>
                                </div>

                                <div className={styles.rankingMetrics}>
                                    <div className={styles.miniMetric}>
                                        <Clock size={14} />
                                        {Math.round(tecnico.promedioHoras)}h
                                    </div>
                                    <div className={styles.miniMetric}>
                                        <CheckCircle size={14} />
                                        {Math.round(tecnico.tasaComplecion)}%
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Tickets en Riesgo Crítico */}
            <div className={styles.alertSection}>
                <div className={styles.sectionHeader}>
                    <h2>
                        <AlertTriangle size={20} />
                        Tickets en Riesgo Crítico (60h+)
                    </h2>
                    <span className={styles.alertBadge}>{ticketsRiesgo.length}</span>
                </div>

                {ticketsRiesgo.length === 0 ? (
                    <div className={styles.noAlerts}>
                        <CheckCircle size={48} color="#10B981" />
                        <p>¡Excelente! No hay tickets en riesgo crítico</p>
                    </div>
                ) : (
                    <div className={styles.alertsList}>
                        {ticketsRiesgo.map((ticket: any) => {
                            const horas = calcularHorasTranscurridas(ticket);
                            const estado = TICKET_STATES.find(s => s.id === ticket.estadoId);

                            return (
                                <div key={ticket.id} className={styles.alertItem}>
                                    <div className={styles.alertHeader}>
                                        <span className={styles.alertId}>{ticket.id}</span>
                                        <span className={styles.alertTime} style={{ color: '#DC2626' }}>
                                            <Clock size={16} />
                                            {Math.floor(horas)}h / 72h
                                        </span>
                                    </div>
                                    <div className={styles.alertContent}>
                                        <strong>{ticket.clienteNombre}</strong> - {ticket.asunto}
                                    </div>
                                    <div className={styles.alertFooter}>
                                        <span className={styles.alertEstado} style={{ background: estado?.color }}>
                                            {estado?.nombre}
                                        </span>
                                        <span className={styles.alertGestora}>
                                            Gestora: {ticket.historial?.[0]?.usuario || "Sin asignar"}
                                        </span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
