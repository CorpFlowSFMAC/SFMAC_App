"use client";

import { useState, useMemo, useEffect } from "react";
import {
    Users, Ticket, AlertTriangle, TrendingUp,
    ArrowRight, Clock, CheckCircle2, DollarSign,
    Zap, Sparkles, BarChart3
} from "lucide-react";
import Link from "next/link";
import styles from "./admin.module.css";
import { normalizeStateId } from "@/lib/ticketStates";
import SyncToSupabaseButton from "@/components/SyncToSupabaseButton";
import { useTickets, useTechnicians } from "@/hooks/useSupabaseData";

export default function AdminDashboard() {
    // Usar hooks de Supabase en lugar de localStorage
    const { tickets, loading: loadingTickets } = useTickets();
    const { technicians, loading: loadingTechs } = useTechnicians();
    const [isMounted, setIsMounted] = useState(false);
    const [userRole, setUserRole] = useState<string | null>(null);

    useEffect(() => {
        setIsMounted(true);
        if (typeof window !== 'undefined') {
            setUserRole(localStorage.getItem("userRole"));
        }
    }, []);

    // 📊 Quick Stats
    const stats = useMemo(() => {
        const total = tickets.length;
        const critical = tickets.filter((t: any) => {
            const start = new Date(t.fechaInicioSLA || t.createdAt).getTime();
            const now = new Date().getTime();
            const hours = (now - start) / (1000 * 60 * 60);
            return hours >= 60 && normalizeStateId(t.estadoId) !== "ticket_cerrado";
        }).length;

        const income = tickets.reduce((acc, t) => {
            if (normalizeStateId(t.estadoId) === "ticket_cerrado") {
                return acc + (parseFloat(t.costoManoObra || 0) + parseFloat(t.costoMateriales || 0));
            }
            return acc;
        }, 0);

        return { total, critical, income, technicians: technicians.length };
    }, [tickets, technicians]);

    return (
        <div className={styles.dashboardContainer} style={{ padding: '2rem' }}>
            {/* Hero Header */}
            <div className={styles.heroHeader}>
                <div className={styles.heroContent}>
                    <div className={styles.badge}>
                        <Sparkles size={14} />
                        <span>Resumen Ejecutivo</span>
                    </div>
                    <h1>Bienvenido, Administrador</h1>
                    <p>Monitoreo en tiempo real de la operación SINFIMAC.</p>
                </div>
                <div className={styles.heroActions}>
                    <Link href="/dashboard/admin/reportes" className={styles.primaryLink}>
                        <BarChart3 size={18} />
                        Ver Reportes Detallados
                    </Link>
                </div>
            </div>

            {/* Stats Grid */}
            <div className={styles.statsGrid}>
                <div className={styles.statCard} style={{ '--accent': '#8B5CF6' } as any}>
                    <div className={styles.statIcon}><Ticket size={24} /></div>
                    <div className={styles.statData}>
                        <span className={styles.statLabel}>Tickets Activos</span>
                        <span className={styles.statValue}>{stats.total}</span>
                    </div>
                </div>

                <div className={styles.statCard} style={{ '--accent': '#EF4444' } as any}>
                    <div className={styles.statIcon}><AlertTriangle size={24} /></div>
                    <div className={styles.statData}>
                        <span className={styles.statLabel}>Riesgo Crítico</span>
                        <span className={styles.statValue}>{stats.critical}</span>
                    </div>
                </div>

                <div className={styles.statCard} style={{ '--accent': '#10B981' } as any}>
                    <div className={styles.statIcon}><DollarSign size={24} /></div>
                    <div className={styles.statData}>
                        <span className={styles.statLabel}>Ingresos Liquidados</span>
                        <span className={styles.statValue}>S/ {stats.income.toLocaleString()}</span>
                    </div>
                </div>

                <div className={styles.statCard} style={{ '--accent': '#3B82F6' } as any}>
                    <div className={styles.statIcon}><Users size={24} /></div>
                    <div className={styles.statData}>
                        <span className={styles.statLabel}>Técnicos Activos</span>
                        <span className={styles.statValue}>{stats.technicians}</span>
                    </div>
                </div>
            </div>

            {/* Quick Access Grid */}
            <div className={styles.quickAccess}>
                <h2 className={styles.sectionTitle}>Gestión de Módulos</h2>
                <div className={styles.accessGrid}>
                    <Link href="/dashboard/admin/tickets" className={styles.accessCard}>
                        <div className={styles.accessIcon}><Zap size={20} /></div>
                        <div className={styles.accessInfo}>
                            <h3>Sistema de Tickets</h3>
                            <p>Control de Kanban y flujo operativo.</p>
                        </div>
                        <ArrowRight size={20} className={styles.arrow} />
                    </Link>

                    {isMounted && userRole === 'admin' && (
                        <Link href="/dashboard/admin/payments" className={styles.accessCard}>
                            <div className={styles.accessIcon} style={{ background: '#F59E0B20', color: '#F59E0B' }}><DollarSign size={20} /></div>
                            <div className={styles.accessInfo}>
                                <h3>Tesorería</h3>
                                <p>Pagos a técnicos y liquidaciones.</p>
                            </div>
                            <ArrowRight size={20} className={styles.arrow} />
                        </Link>
                    )}

                    <Link href="/dashboard/admin/technicians" className={styles.accessCard}>
                        <div className={styles.accessIcon} style={{ background: '#3B82F620', color: '#3B82F6' }}><Users size={20} /></div>
                        <div className={styles.accessInfo}>
                            <h3>Especialistas</h3>
                            <p>Directorio de técnicos y perfiles.</p>
                        </div>
                        <ArrowRight size={20} className={styles.arrow} />
                    </Link>
                </div>
            </div>

            {/* Botón de sincronización con Supabase */}
            <SyncToSupabaseButton />
        </div>
    );
}
