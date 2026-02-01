"use client";

import { Building2, Store, MapPin, TrendingUp, Target } from "lucide-react";
import styles from "./statsTab.module.css";

interface StatsTabProps {
    branches: any[];
    clientColor: string;
}

export default function StatsTab({ branches, clientColor }: StatsTabProps) {
    const totalBranches = branches.length;
    const matrices = branches.filter(b => b.tipo === 'Matriz').length;
    const agencias = branches.filter(b => b.tipo === 'Agencia').length;

    const byZone = branches.reduce<{ [key: string]: number }>((acc, branch) => {
        acc[branch.zona] = (acc[branch.zona] || 0) + 1;
        return acc;
    }, {});

    const maxZoneCount = Math.max(...Object.values(byZone), 1);

    return (
        <div className={styles.container} style={{ '--client-color': clientColor } as any}>
            {/* Summary Cards */}
            <div className={styles.summaryGrid}>
                <div className={styles.statCard}>
                    <div className={styles.statIcon} style={{ background: `${clientColor}30` }}>
                        <Store size={32} color={clientColor} />
                    </div>
                    <div>
                        <div className={styles.statValue}>{totalBranches}</div>
                        <div className={styles.statLabel}>Total Sedes</div>
                    </div>
                </div>

                <div className={styles.statCard}>
                    <div className={styles.statIcon} style={{ background: 'rgba(238, 130, 238, 0.2)' }}>
                        <Building2 size={32} color="#EE82EE" />
                    </div>
                    <div>
                        <div className={styles.statValue}>{matrices}</div>
                        <div className={styles.statLabel}>Matrices</div>
                    </div>
                </div>

                <div className={styles.statCard}>
                    <div className={styles.statIcon} style={{ background: 'rgba(0, 255, 0, 0.2)' }}>
                        <Store size={32} color="var(--color-green)" />
                    </div>
                    <div>
                        <div className={styles.statValue}>{agencias}</div>
                        <div className={styles.statLabel}>Agencias</div>
                    </div>
                </div>

                <div className={styles.statCard}>
                    <div className={styles.statIcon} style={{ background: 'rgba(255, 215, 0, 0.2)' }}>
                        <MapPin size={32} color="#FFD700" />
                    </div>
                    <div>
                        <div className={styles.statValue}>{Object.keys(byZone).length}</div>
                        <div className={styles.statLabel}>Zonas Activas</div>
                    </div>
                </div>
            </div>

            {/* Distribution Chart */}
            <div className={styles.chartSection}>
                <div className={styles.chartHeader}>
                    <TrendingUp size={24} color={clientColor} />
                    <h3>Distribución por Zona</h3>
                </div>

                <div className={styles.barChart}>
                    {Object.entries(byZone)
                        .sort((a, b) => b[1] - a[1])
                        .map(([zone, count]) => (
                            <div key={zone} className={styles.barRow}>
                                <div className={styles.barLabel}>
                                    <Target size={14} color={clientColor} />
                                    {zone}
                                </div>
                                <div className={styles.barTrack}>
                                    <div
                                        className={styles.barFill}
                                        style={{
                                            width: `${(count / maxZoneCount) * 100}%`,
                                            background: `linear-gradient(90deg, ${clientColor}, ${clientColor}80)`
                                        }}
                                    >
                                        <span className={styles.barLabel}>{count}</span>
                                    </div>
                                </div>
                                <div className={styles.barValue}>{count}</div>
                            </div>
                        ))}
                </div>
            </div>
        </div>
    );
}
