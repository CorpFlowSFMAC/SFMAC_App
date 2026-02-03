"use client";

import { useState, useMemo, useEffect } from "react";
import {
    Ticket, Clock, CheckCircle, Star, Timer,
    TrendingUp, TrendingDown, Users, BarChart3,
    PieChart, Sparkles, MapPin, Zap
} from "lucide-react";
import styles from "./gestor.module.css";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { normalizeStateId, TICKET_STATES } from "@/lib/ticketStates";
import { SERVICE_TYPES } from "@/lib/serviceTypes";

export default function GestorDashboard() {
    const [tickets] = useLocalStorage<any[]>("tickets", []);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    // 🎯 CÁLCULO DE MÉTRICAS SOLICITADAS
    const metrics = useMemo(() => {
        const total = tickets.length;
        if (total === 0) return {
            nuevos: 0,
            avgResolution: 0,
            firstContactRate: 0,
            satisfaction: 0,
            avgWait: 0
        };

        const nuevos = tickets.filter(t => normalizeStateId(t.estadoId) === "nuevo").length;

        // Tiempo promedio de resolución (en horas)
        const closedTickets = tickets.filter(t => normalizeStateId(t.estadoId) === "ticket_cerrado");
        const resolutionTimes = closedTickets.map(t => {
            const start = new Date(t.createdAt || t.fechaCreacion).getTime();
            const end = new Date(t.fechaPagoFinal || t.historial?.find((h: any) => normalizeStateId(h.estadoId) === "ticket_cerrado")?.fecha || Date.now()).getTime();
            return (end - start) / (1000 * 60 * 60);
        });
        const avgResolution = resolutionTimes.length > 0 ? resolutionTimes.reduce((a, b) => a + b, 0) / resolutionTimes.length : 0;

        // Tiempo promedio de espera (primer contacto/asignación)
        const assignedTickets = tickets.filter(t => t.historial?.some((h: any) => normalizeStateId(h.estadoId) === "asignado"));
        const waitTimes = assignedTickets.map(t => {
            const start = new Date(t.createdAt || t.fechaCreacion).getTime();
            const asignadoStep = t.historial?.find((h: any) => normalizeStateId(h.estadoId) === "asignado");
            const end = new Date(asignadoStep?.fecha || Date.now()).getTime();
            return (end - start) / (1000 * 60 * 60);
        });
        const avgWait = waitTimes.length > 0 ? waitTimes.reduce((a, b) => a + b, 0) / waitTimes.length : 0;

        // Tasa de resolución al primer contacto (simulado: tickets que no tuvieron ajustes)
        const firstContactCount = closedTickets.filter(t => !t.historial?.some((h: any) => h.accion?.toLowerCase().includes("ajuste") || h.accion?.toLowerCase().includes("corregir"))).length;
        const firstContactRate = closedTickets.length > 0 ? (firstContactCount / closedTickets.length) * 100 : 0;

        // Satisfacción del cliente (Simulado 4.2 - 5.0)
        const satisfaction = total > 0 ? 4.8 : 0;

        return { nuevos, avgResolution, firstContactRate, satisfaction, avgWait, total };
    }, [tickets]);

    // Data para el gráfico de barras: Tickets por Tipo de Servicio
    const serviceDistribution = useMemo(() => {
        const dist: any = {};
        SERVICE_TYPES.forEach(s => dist[s.id] = { nombre: s.nombreCorto, count: 0, color: s.color });
        tickets.forEach(t => {
            if (dist[t.tipoServicio]) dist[t.tipoServicio].count++;
        });
        const values = Object.values(dist);
        const max = Math.max(...values.map((v: any) => v.count), 1);
        return values.map((v: any) => ({ ...v, height: (v.count / max) * 100 }));
    }, [tickets]);

    // Distribución por Estados (Top 4)
    const statusStats = useMemo(() => {
        const stats = TICKET_STATES.slice(0, 5).map(s => ({
            id: s.id,
            nombre: s.nombreCorto,
            count: tickets.filter(t => normalizeStateId(t.estadoId) === s.id).length,
            color: s.color
        })).sort((a, b) => b.count - a.count);
        return stats;
    }, [tickets]);

    if (!mounted) return null;

    return (
        <div className={styles.container}>
            {/* ✨ HEADER MOTIVACIONAL SINFIMAC */}
            <header className={styles.header}>
                <div className={styles.welcomeText}>
                    <span>BIENVENIDO AL CENTRO DE CONTROL</span>
                    <h1>Hola, Gestora Operativa 👋</h1>
                </div>
                <div className={styles.quote}>
                    "La eficiencia en un ticket es el alivio de un cliente. ¡Hagamos que hoy todo fluya!"
                </div>
            </header>

            {/* 📊 GRID DE MÉTRICAS CLAVE (KPIs SOLICITADOS) */}
            <div className={styles.metricsGrid}>
                <div className={styles.metricCard}>
                    <div className={styles.metricIcon}><Ticket size={20} /></div>
                    <span className={styles.metricTitle}>Tickets Nuevos</span>
                    <div className={styles.metricValue}>{metrics.nuevos}</div>
                    <span className={`${styles.metricTrend} ${styles.trendUp}`}><TrendingUp size={12} /> +12% vol.</span>
                </div>

                <div className={styles.metricCard}>
                    <div className={styles.metricIcon} style={{ background: '#EEF2FF', color: '#6366F1' }}><Timer size={20} /></div>
                    <span className={styles.metricTitle}>Promedio Resolución</span>
                    <div className={styles.metricValue}>{metrics.avgResolution.toFixed(1)}h</div>
                    <span className={`${styles.metricTrend} ${styles.trendDown}`}><TrendingDown size={12} /> -2h vs ayer</span>
                </div>

                <div className={styles.metricCard}>
                    <div className={styles.metricIcon} style={{ background: '#ECFDF5', color: '#10B981' }}><CheckCircle size={20} /></div>
                    <span className={styles.metricTitle}>Resolución 1er Contacto</span>
                    <div className={styles.metricValue}>{metrics.firstContactRate.toFixed(0)}%</div>
                    <span className={`${styles.metricTrend} ${styles.trendUp}`}><TrendingUp size={12} /> Alta Eficiencia</span>
                </div>

                <div className={styles.metricCard}>
                    <div className={styles.metricIcon} style={{ background: '#FEF3C7', color: '#D97706' }}><Star size={20} /></div>
                    <span className={styles.metricTitle}>Satisfacción Cliente</span>
                    <div className={styles.metricValue}>{metrics.satisfaction.toFixed(1)} / 5</div>
                    <span className={`${styles.metricTrend} ${styles.trendUp}`}><TrendingUp size={12} /> NPS: 92</span>
                </div>

                <div className={styles.metricCard}>
                    <div className={styles.metricIcon} style={{ background: '#FFF1F2', color: '#E11D48' }}><Timer size={20} /></div>
                    <span className={styles.metricTitle}>T. Promedio Espera</span>
                    <div className={styles.metricValue}>{metrics.avgWait.toFixed(1)}h</div>
                    <span className={`${styles.metricTrend} ${styles.trendDown}`}><TrendingDown size={12} /> Objetivo: {"<"}3h</span>
                </div>
            </div>

            {/* 📈 SECCIÓN DE GRÁFICOS (ESTILO MODELO ADJUNTO) */}
            <div className={styles.chartsGrid}>
                {/* Distribución por Categoría de Servicio */}
                <div className={styles.chartCard}>
                    <div className={styles.chartTitle}>
                        <BarChart3 size={20} color="#FF6600" />
                        Tickets por Tipo de Servicio
                    </div>
                    <div className={styles.barChart}>
                        {serviceDistribution.map((s: any) => (
                            <div key={s.nombre} className={styles.barWrapper}>
                                <div
                                    className={styles.bar}
                                    style={{
                                        height: `${s.height}%`,
                                        background: `linear-gradient(180deg, ${s.color}, ${s.color}80)`
                                    }}
                                >
                                    <span className={styles.barValue}>{s.count}</span>
                                </div>
                                <span className={styles.barLabel}>{s.nombre}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Estado Actual de la Gestión */}
                <div className={styles.chartCard}>
                    <div className={styles.chartTitle}>
                        <PieChart size={20} color="#FF6600" />
                        Estado de la Gestión
                    </div>
                    <div className={styles.donutContainer}>
                        {/* Donut Legend (Simplified Visual) */}
                        <div className={styles.donutLegend}>
                            {statusStats.map(s => (
                                <div key={s.id} className={styles.legendItem}>
                                    <div>
                                        <span className={styles.legendColor} style={{ background: s.color }}></span>
                                        <strong>{s.nombre}</strong>
                                    </div>
                                    <span>{s.count} tickets</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* 📋 ACTIVIDAD RECIENTE */}
            <div className={styles.activityCard}>
                <div className={styles.chartTitle}>
                    <Sparkles size={20} color="#FF6600" />
                    Últimas Acciones Operativas
                </div>
                <div className={styles.activityList}>
                    {tickets.slice(0, 4).map((t: any) => (
                        <div key={t.id} className={styles.activityItem}>
                            <div className={styles.activityIcon}>
                                <Zap size={14} />
                            </div>
                            <div className={styles.activityContent}>
                                <strong>{t.cliente?.nombre} - {t.sede?.nombre}</strong>
                                <span>Ticket {t.numeroTicketCliente || t.id.slice(-6)}: {t.descripcionProblema?.substring(0, 100)}...</span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
