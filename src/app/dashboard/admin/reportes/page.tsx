"use client";

import { useState, useMemo, useEffect } from "react";
import {
    TrendingUp, TrendingDown, Users, Award, AlertTriangle,
    Clock, CheckCircle, XCircle, BarChart3, PieChart, Calendar,
    Download, Filter, User, DollarSign, ArrowUpRight, ArrowDownRight,
    Search, ChevronRight, Activity, Zap, ShieldAlert, Target, Save, 
    Percent, Gavel, FileText, Info
} from "lucide-react";
import styles from "./reportes.module.css";
import { useAppData } from "@/lib/AppDataContext";
import { normalizeStateId, TICKET_STATES } from "@/lib/ticketStates";
import { round2 } from "@/lib/formatters";

/** Calcula horas transcurridas desde el inicio del SLA */
function calcularHoras(ticket: any): number {
    const fechaBase = ticket.fechaInicioSLA || ticket.createdAt || ticket.created_at;
    const inicio = new Date(fechaBase).getTime();
    if (isNaN(inicio)) return 0;

    // Si está cerrado, usamos la fecha de cierre para el cálculo histórico
    const fin = ticket.closure_date ? new Date(ticket.closure_date).getTime() : new Date().getTime();
    
    return Math.max(0, (fin - inicio) / (1000 * 60 * 60));
}
// COMPONENTES VISUALES PREMIUM (CUSTOM SVG)
// ─────────────────────────────────────────────────────────────────────────────

// 🎯 Funnel Chart (Embudo de Productividad)
const FunnelChart = ({ data }: { data: { label: string, value: number, color: string }[] }) => {
    const max = Math.max(...data.map(d => d.value), 1);
    
    return (
        <div className={styles.funnelContainer}>
            {data.map((item, i) => {
                const width = (item.value / max) * 100;
                const nextWidth = data[i+1] ? (data[i+1].value / max) * 100 : width * 0.8;
                
                return (
                    <div key={i} className={styles.funnelStage} style={{ opacity: 1 - i * 0.1 }}>
                        <div className={styles.funnelShapes}>
                            <svg viewBox="0 0 100 40" preserveAspectRatio="none" className={styles.funnelSvg}>
                                <path 
                                    d={`M ${(100-width)/2} 0 L ${(100+width)/2} 0 L ${(100+nextWidth)/2} 40 L ${(100-nextWidth)/2} 40 Z`} 
                                    fill={item.color}
                                />
                            </svg>
                            <div className={styles.funnelLabel}>
                                <span className={styles.funnelName}>{item.label}</span>
                                <span className={styles.funnelValue}>{item.value}</span>
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

// 🎯 Termómetro de Metas (Bonus Progress)
const GoalThermometer = ({ current, target, label }: { current: number, target: number, label: string }) => {
    const percent = Math.min((current / (target || 1)) * 100, 120);
    const isSuccess = percent >= 100;
    
    return (
        <div className={styles.thermometerWrapper}>
            <div className={styles.thermometerLabel}>
                <span>{label}</span>
                <strong>{Math.round(percent)}%</strong>
            </div>
            <div className={styles.thermometerTrack}>
                <div 
                    className={percent >= 100 ? styles.thermometerFillSuccess : styles.thermometerFill} 
                    style={{ width: `${percent}%` }}
                >
                    {percent > 20 && <span className={styles.thermometerValue}>S/ {Math.round(current/1000)}k</span>}
                </div>
                <div className={styles.thermometerMarkers}>
                    <div className={styles.marker} style={{ left: '80%' }}><span>80%</span></div>
                    <div className={styles.marker} style={{ left: '100%', borderColor: '#10B981' }}><span>100%</span></div>
                </div>
            </div>
            <div className={styles.thermometerFooter}>
                Meta: S/ {target.toLocaleString()}
            </div>
        </div>
    );
};

// 🎯 Scatter Plot (Rentabilidad vs Inversión)
const ScatterPlot = ({ data }: { data: { x: number, y: number, label: string }[] }) => {
    const maxX = Math.max(...data.map(d => d.x), 1);
    const maxY = Math.max(...data.map(d => d.y), 1);

    return (
        <div className={styles.scatterWrapper}>
            <div className={styles.scatterYAxis}>Inversión (S/)</div>
            <div className={styles.scatterContent}>
                <svg viewBox="0 0 100 100" className={styles.scatterSvg}>
                    {/* Grid Lines */}
                    <line x1="0" y1="50" x2="100" y2="50" stroke="#E2E8F0" strokeWidth="0.5" strokeDasharray="2" />
                    <line x1="50" y1="0" x2="50" y2="100" stroke="#E2E8F0" strokeWidth="0.5" strokeDasharray="2" />
                    
                    {data.map((d, i) => (
                        <g key={i}>
                            <circle 
                                cx={(d.x / maxX) * 100} 
                                cy={100 - (d.y / maxY) * 100} 
                                r="2.5" 
                                fill="#002A8F" 
                                opacity="0.6"
                            >
                                <title>{d.label}: Rel S/ {d.x} / Inv S/ {d.y}</title>
                            </circle>
                            <text 
                                x={(d.x / maxX) * 100 + 3} 
                                y={100 - (d.y / maxY) * 100} 
                                fontSize="3" 
                                fill="#64748B"
                            >{d.label.split(' ')[0]}</text>
                        </g>
                    ))}
                </svg>
            </div>
            <div className={styles.scatterXAxis}>Rentabilidad (S/)</div>
        </div>
    );
};

// 🎯 Speedometer Gauge (Velocidad de Respuesta)
const VelocityGauge = ({ value, label, max = 72 }: { value: number, label: string, max?: number }) => {
    const clampedValue = Math.min(value, max);
    const percent = (clampedValue / max) * 100;
    const angle = (percent / 100) * 180 - 180;
    
    const getColor = (v: number) => {
        if (v < 24) return "#10B981"; 
        if (v < 48) return "#F59E0B"; 
        return "#DC2626"; 
    };

    return (
        <div className={styles.gaugeWrapper}>
            <div className={styles.gaugeContainer}>
                <svg viewBox="0 0 100 50" className={styles.gaugeSvg}>
                    <path d="M 10 50 A 40 40 0 0 1 90 50" fill="none" stroke="#E2E8F0" strokeWidth="8" strokeLinecap="round" />
                    <path 
                        d="M 10 50 A 40 40 0 0 1 90 50" 
                        fill="none" 
                        stroke={getColor(value)} 
                        strokeWidth="8" 
                        strokeLinecap="round"
                        strokeDasharray="125.6"
                        strokeDashoffset={125.6 * (1 - percent/100)}
                        style={{ transition: 'stroke-dashoffset 1.5s ease-out' }}
                    />
                    <line 
                        x1="50" y1="50" 
                        x2={50 + 35 * Math.cos((angle * Math.PI) / 180)} 
                        y2={50 + 35 * Math.sin((angle * Math.PI) / 180)} 
                        stroke="#1E293B" strokeWidth="3" strokeLinecap="round"
                    />
                    <circle cx="50" cy="50" r="4" fill="#1E293B" />
                </svg>
                <div className={styles.gaugeContent}>
                    <div className={styles.gaugeValue}>{Math.round(value)}h</div>
                    <div className={styles.gaugeLabel}>{label}</div>
                </div>
            </div>
        </div>
    );
};

// ─────────────────────────────────────────────────────────────────────────────
// PAGE COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export default function ReportesEficienciaPage() {
    const { 
        tickets, clients, gestoras, gestorasTargets, setTarget, 
        loadingTickets, loadingClients, loadingGestoras, loadingTargets 
    } = useAppData();
    
    const [selectedPeriod, setSelectedPeriod] = useState<"current" | "previous">("current");
    const [selectedTab, setSelectedTab] = useState<"productivity" | "profitability" | "bonuses" | "admin" | "risk">("productivity");
    const [editingTarget, setEditingTarget] = useState<Record<string, number>>({});
    const [isSaving, setIsSaving] = useState(false);

    // Mes actual formateado como KEY (YYYY-MM)
    const currentMonthKey = useMemo(() => {
        const d = new Date();
        if (selectedPeriod === "previous") d.setMonth(d.getMonth() - 1);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    }, [selectedPeriod]);

    // 🎯 Filtrar datos por el período seleccionado
    const filteredTickets = useMemo(() => {
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth() - (selectedPeriod === "previous" ? 1 : 0), 1);
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() - (selectedPeriod === "previous" ? 1 : -1), 0);
        
        return tickets.filter(t => {
            const date = new Date(t.createdAt || t.created_at);
            return date >= startOfMonth && date <= endOfMonth;
        });
    }, [tickets, selectedPeriod]);

    // 🎯 Productividad por Gestor Expandida
    const productivityByGestor = useMemo(() => {
        const map: any = {};
        gestoras.forEach(g => {
            const targetObj = gestorasTargets.find(t => t.gestora_id === g.id && t.month_key === currentMonthKey);
            map[g.id] = {
                id: g.id,
                nombre: g.name,
                nuevos: 0,
                proceso: 0,
                cerrados: 0,
                vencidos: 0,
                inversion: 0,
                facturacion: 0,
                costoLaboral: g.costo_laboral_mensual || 1800,
                activos: g.activos_mensuales_valor || 0,
                sstCompliance: g.sst_compliance_status ?? true,
                targetAmount: targetObj?.target_amount || 35000, // Defecto si no hay meta
                bonusMultiplier: targetObj?.bonus_multiplier || 0.1,
                horasCierre: []
            };
        });

        filteredTickets.forEach(t => {
            const gid = t.gestora_id;
            if (!gid || !map[gid]) return;
            
            const sid = normalizeStateId(t.estadoId);
            if (['nuevo', 'asignado_a_tecnico', 'cotizando'].includes(sid)) map[gid].nuevos++;
            else if (['enviada', 'trabajo_en_curso', 'documentacion_enviada'].includes(sid)) map[gid].proceso++;
            else if (['por_liquidar', 'liquidado', 'ticket_cerrado'].includes(sid)) map[gid].cerrados++;

            const horas = calcularHoras(t);
            if (horas > 72 && sid !== 'ticket_cerrado') map[gid].vencidos++;
            if (sid === 'ticket_cerrado') map[gid].horasCierre.push(horas);

            map[gid].facturacion += parseFloat(t.total_quoted_amount || 0);
            const pagos = (t.metadata?.historialPagosTecnico || []).reduce((sum: number, p: any) => sum + p.monto, 0);
            map[gid].inversion += pagos;
        });

        return Object.values(map).map((g: any) => {
            const totalCerrados = g.horasCierre.length;
            const avgTime = totalCerrados > 0 ? g.horasCierre.reduce((a: any, b: any) => a + b, 0) / totalCerrados : 0;
            const rentabilidad = g.facturacion - g.inversion - g.costoLaboral - g.activos;
            const totalTickets = g.nuevos + g.proceso + g.cerrados;
            const ratioVencidos = totalTickets > 0 ? (g.vencidos / totalTickets) * 100 : 0;
            
            // Lógica de Bono Variable
            let bonoValido = g.sstCompliance && ratioVencidos < 5;
            let percentMeta = (rentabilidad / (g.targetAmount || 1)) * 100;
            let bonoProyectado = 0;
            
            if (bonoValido && percentMeta >= 80) {
                // Bono escalable: 80% meta -> bono proporcional
                bonoProyectado = (rentabilidad / g.targetAmount) * (g.costoLaboral * g.bonusMultiplier);
            }

            return { ...g, avgTime, rentabilidad, ratioVencidos, bonoValido, bonoProyectado, percentMeta };
        }).sort((a: any, b: any) => b.rentabilidad - a.rentabilidad);
    }, [filteredTickets, gestoras, gestorasTargets, currentMonthKey]);

    // 🎯 Rentabilidad por Cliente
    const profitabilityByClient = useMemo(() => {
        const map: any = {};
        clients.forEach(c => {
            map[c.id] = { id: c.id, nombre: c.name, billing: 0, costs: 0, profit: 0, margin: 0 };
        });

        filteredTickets.forEach(t => {
            const cid = t.client_id;
            if (!cid || !map[cid]) return;
            map[cid].billing += parseFloat(t.total_quoted_amount || 0);
            const pagos = (t.metadata?.historialPagosTecnico || []).reduce((sum: number, p: any) => sum + p.monto, 0);
            map[cid].costs += pagos;
        });

        return Object.values(map).map((c: any) => {
            c.profit = c.billing - c.costs;
            c.margin = c.billing > 0 ? (c.profit / c.billing) * 100 : 0;
            return c;
        }).filter(c => c.billing > 0).sort((a,b) => b.profit - a.profit);
    }, [filteredTickets, clients]);

    // 🎯 Alertas de Desviación (Admin)
    const deviationAlerts = useMemo(() => {
        const now = new Date();
        const midMonth = now.getDate() >= 15;
        const alerts: any[] = [];

        productivityByGestor.forEach(g => {
            if (midMonth && g.percentMeta < 50) {
                alerts.push({ 
                    type: 'DEVIATION', 
                    severity: 'error', 
                    message: `ALERTA ADMIN: ${g.nombre} está por debajo del 50% de la meta mensual (A fecha día ${now.getDate()})` 
                });
            }
            if (g.ratioVencidos >= 5) {
                alerts.push({ 
                    type: 'QUALITY', 
                    severity: 'critical', 
                    message: `BONO BLOQUEADO: ${g.nombre} supera el 5% de tickets vencidos (${Math.round(g.ratioVencidos)}%)` 
                });
            }
        });
        return alerts;
    }, [productivityByGestor]);

    // ─────────────────────────────────────────────
    // ACCIONES ADMIN
    // ─────────────────────────────────────────────
    const handleSaveTargets = async () => {
        setIsSaving(true);
        try {
            for (const [gid, amount] of Object.entries(editingTarget)) {
                await setTarget(gid, currentMonthKey, { target_amount: amount });
            }
            setEditingTarget({});
            alert("Metas actualizadas correctamente.");
        } catch (err) {
            console.error(err);
            alert("Error al guardar metas.");
        } finally {
            setIsSaving(false);
        }
    };

    function calcularHoras(ticket: any): number {
        const ahora = new Date().getTime();
        const fechaBase = ticket.fechaInicioSLA || ticket.createdAt || ticket.created_at;
        const inicio = new Date(fechaBase).getTime();
        if (isNaN(inicio)) return 0;
        return Math.max(0, (ahora - inicio) / (1000 * 60 * 60));
    }

    if (loadingTickets || loadingClients || loadingGestoras || loadingTargets) {
        return <div className={styles.loading}>Sincronizando Sistema de BI y Bonos...</div>;
    }

    return (
        <div className={styles.container}>
            {/* Header Glassmorphism */}
            <div className={styles.header}>
                <div className={styles.headerLeft}>
                    <div className={styles.headerTitleRow}>
                        <div className={styles.logoIcon}><Gavel size={28} /></div>
                        <div>
                            <h1 className={styles.title}>Controller & Variable Bonus</h1>
                            <p className={styles.subtitle}>Gestión Estratégica de Rentabilidad</p>
                        </div>
                    </div>
                </div>
                <div className={styles.headerRight}>
                    <div className={styles.periodSwitcher}>
                        <button 
                            className={selectedPeriod === 'current' ? styles.periodBtnActive : styles.periodBtn}
                            onClick={() => setSelectedPeriod('current')}
                        >
                            Ciclo Actual
                        </button>
                        <button 
                            className={selectedPeriod === 'previous' ? styles.periodBtnActive : styles.periodBtn}
                            onClick={() => setSelectedPeriod('previous')}
                        >
                            Cerrado: {currentMonthKey}
                        </button>
                    </div>
                    <button className={styles.exportBtn}><FileText size={18} /> Planilla de Bonos</button>
                </div>
            </div>

            {/* Tabs de Navegación Expandidos */}
            <div className={styles.tabContainer}>
                <button className={selectedTab === 'productivity' ? styles.tabActive : styles.tab} onClick={() => setSelectedTab('productivity')}>
                    <Target size={18} /> Eficiencia
                </button>
                <button className={selectedTab === 'bonuses' ? styles.tabActive : styles.tab} onClick={() => setSelectedTab('bonuses')}>
                    <Zap size={18} /> Bonos Variables
                </button>
                <button className={selectedTab === 'profitability' ? styles.tabActive : styles.tab} onClick={() => setSelectedTab('profitability')}>
                    <DollarSign size={18} /> Clientes/Scatter
                </button>
                <button className={selectedTab === 'admin' ? styles.tabActive : styles.tab} onClick={() => setSelectedTab('admin')}>
                    <Save size={18} /> Conf. Metas
                </button>
                <button className={selectedTab === 'risk' ? styles.tabActive : styles.tab} onClick={() => setSelectedTab('risk')}>
                    <ShieldAlert size={18} /> Control Interno {deviationAlerts.length > 0 && <span className={styles.alertDot}>{deviationAlerts.length}</span>}
                </button>
            </div>

            <div className={styles.dashboardGrid}>
                
                {selectedTab === 'productivity' && (
                    <>
                        <div className={styles.card}>
                            <div className={styles.cardHeader}>
                                <h2><Activity size={20} /> Embudo Operativo</h2>
                                <p>Progreso de tickets este mes</p>
                            </div>
                            <FunnelChart data={[
                                { label: 'Recibidos', value: filteredTickets.length, color: '#3B82F6' },
                                { label: 'En Gestion', value: filteredTickets.length - (productivityByGestor.reduce((s,g)=>s+g.cerrados,0)), color: '#F59E0B' },
                                { label: 'Cerrados/OK', value: productivityByGestor.reduce((s,g)=>s+g.cerrados,0), color: '#10B981' },
                            ]} />
                        </div>

                        <div className={styles.card}>
                            <div className={styles.cardHeader}>
                                <h2><Clock size={20} /> SLAs por Gestora</h2>
                                <p>Cumplimiento del umbral 72h</p>
                            </div>
                            <div className={styles.gaugesGrid}>
                                {productivityByGestor.slice(0, 3).map((g: any, i: number) => (
                                    <VelocityGauge key={i} value={g.avgTime} label={g.nombre} />
                                ))}
                            </div>
                        </div>

                        <div className={styles.fullWidthCard}>
                            <div className={styles.cardHeader}>
                                <h2><Users size={20} /> Ranking de Productividad y Margen</h2>
                            </div>
                            <table className={styles.masterTable}>
                                <thead>
                                    <tr>
                                        <th>Gestora</th>
                                        <th>Tickets</th>
                                        <th>Vencidos (%)</th>
                                        <th>SST</th>
                                        <th>Rentabilidad Bruta</th>
                                        <th>Alcance Meta</th>
                                        <th>Status Bonus</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {productivityByGestor.map((g: any, i: number) => (
                                        <tr key={i}>
                                            <td><strong>{g.nombre}</strong></td>
                                            <td>{g.nuevos+g.proceso+g.cerrados}</td>
                                            <td>
                                                <span className={g.ratioVencidos < 5 ? styles.badgeGreen : styles.badgeRed}>
                                                    {Math.round(g.ratioVencidos)}%
                                                </span>
                                            </td>
                                            <td>{g.sstCompliance ? <ShieldAlert size={16} color="#10B981" /> : <XCircle size={16} color="#DC2626" />}</td>
                                            <td className={styles.positiveValue}>S/ {g.rentabilidad.toLocaleString()}</td>
                                            <td>
                                                <div className={styles.rankingBarMini}>
                                                    <div className={styles.rankingFillMini} style={{ width: `${g.percentMeta}%`, background: g.percentMeta >= 100 ? '#10B981' : '#F59E0B' }} />
                                                </div>
                                            </td>
                                            <td>
                                                <span className={g.bonoValido ? styles.bonusTagOn : styles.bonusTagOff}>
                                                    {g.bonoValido ? 'ELEGIBLE' : 'BLOQUEADO'}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </>
                )}

                {selectedTab === 'bonuses' && (
                    <div className={styles.fullWidthCard}>
                        <div className={styles.cardHeader}>
                            <h2><Zap size={20} /> Proyección de Bonos Variables</h2>
                            <p>Cálculo basado en (Rentabilidad Real / Meta) * Bono Base</p>
                        </div>
                        <div className={styles.thermometersGrid}>
                            {productivityByGestor.map((g: any, i: number) => (
                                <div key={i} className={styles.bonusPanelCard}>
                                    <GoalThermometer current={g.rentabilidad} target={g.targetAmount} label={g.nombre} />
                                    <div className={styles.bonusResultRow}>
                                        <div className={styles.bonusMetric}>
                                            <span>Bono Proyectado</span>
                                            <div className={styles.bonusValue}>S/ {Math.round(g.bonoProyectado).toLocaleString()}</div>
                                        </div>
                                        <div className={styles.bonusConditions}>
                                            <div className={g.ratioVencidos < 5 ? styles.condOK : styles.condFail}>
                                                {g.ratioVencidos < 5 ? <CheckCircle size={14} /> : <AlertTriangle size={14} />} SLA {Math.round(g.ratioVencidos)}%
                                            </div>
                                            <div className={g.sstCompliance ? styles.condOK : styles.condFail}>
                                                {g.sstCompliance ? <CheckCircle size={14} /> : <AlertTriangle size={14} />} Normas SST
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {selectedTab === 'profitability' && (
                    <>
                        <div className={styles.card}>
                            <div className={styles.cardHeader}>
                                <h2><BarChart3 size={20} /> Scatter: Inversión vs Margen</h2>
                                <p>Identificación de ineficiencias críticas</p>
                            </div>
                            <ScatterPlot data={profitabilityByClient.map(c => ({
                                x: c.profit,
                                y: c.costs,
                                label: c.nombre
                            }))} />
                        </div>

                        <div className={styles.card}>
                            <div className={styles.cardHeader}>
                                <h2><TrendingUp size={20} /> Clientes más Rentables</h2>
                                <p>Top contribución al margen neto</p>
                            </div>
                            <div className={styles.goldClientsList}>
                                {profitabilityByClient.slice(0, 5).map((c, i) => (
                                    <div key={i} className={styles.clientMiniRow}>
                                        <span>{c.nombre}</span>
                                        <strong>S/ {c.profit.toLocaleString()}</strong>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className={styles.fullWidthCard}>
                            <div className={styles.cardHeaderRow}>
                                <h2><DollarSign size={20} /> P&L por Cliente</h2>
                                <button className={styles.smallExportBtn}>Bajar Excel</button>
                            </div>
                            <table className={styles.masterTable}>
                                <thead>
                                    <tr>
                                        <th>Cliente</th>
                                        <th>Facturación Bruta</th>
                                        <th>Costos Especialista</th>
                                        <th>Margen Contribución</th>
                                        <th>% Margen</th>
                                        <th>Salud Cuenta</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {profitabilityByClient.map((c, i) => (
                                        <tr key={i}>
                                            <td>
                                                <div className={styles.clientCell}>
                                                    {i < 3 && <span className={styles.oroBadge}>ORO</span>}
                                                    <strong>{c.nombre}</strong>
                                                </div>
                                            </td>
                                            <td>S/ {c.billing.toLocaleString()}</td>
                                            <td>S/ {c.costs.toLocaleString()}</td>
                                            <td className={styles.positiveValue}>S/ {c.profit.toLocaleString()}</td>
                                            <td>{Math.round(c.margin)}%</td>
                                            <td>
                                                <div className={styles.statusDot} style={{ background: c.margin > 20 ? '#10B981' : c.margin > 10 ? '#F59E0B' : '#DC2626' }} />
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </>
                )}

                {selectedTab === 'admin' && (
                    <div className={styles.fullWidthCard}>
                        <div className={styles.cardHeader}>
                            <h2><Settings size={20} /> Configuración de Metas Mensuales</h2>
                            <p>Asigna la meta de rentabilidad bruta para el ciclo: {currentMonthKey}</p>
                        </div>
                        <div className={styles.adminConfigTable}>
                            <table className={styles.masterTable}>
                                <thead>
                                    <tr>
                                        <th>Gestora</th>
                                        <th>Sueldo Base</th>
                                        <th>Meta Rentabilidad (S/)</th>
                                        <th>Bono Base (%)</th>
                                        <th>Acción</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {productivityByGestor.map((g: any, i: number) => (
                                        <tr key={i}>
                                            <td>{g.nombre}</td>
                                            <td>S/ {g.costoLaboral}</td>
                                            <td>
                                                <input 
                                                    type="number" 
                                                    className={styles.adminInput}
                                                    defaultValue={g.targetAmount}
                                                    onChange={(e) => setEditingTarget({ ...editingTarget, [g.id]: parseFloat(e.target.value) })}
                                                />
                                            </td>
                                            <td>{g.bonusMultiplier * 100}%</td>
                                            <td>
                                                <button 
                                                    className={styles.miniSaveBtn}
                                                    onClick={() => setEditingTarget({ ...editingTarget, [g.id]: g.targetAmount })}
                                                >
                                                    Reset
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            <div className={styles.adminActions}>
                                <button 
                                    className={styles.saveAllBtn} 
                                    onClick={handleSaveTargets}
                                    disabled={isSaving || Object.keys(editingTarget).length === 0}
                                >
                                    {isSaving ? 'Guardando...' : 'Guardar Todas las Metas'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {selectedTab === 'risk' && (
                    <div className={styles.fullWidthCard}>
                        <div className={styles.cardHeader}>
                            <h2><ShieldAlert size={20} /> Centro de Desviaciones y SST</h2>
                        </div>
                        <div className={styles.alertsContainer}>
                            {deviationAlerts.length === 0 ? (
                                <div className={styles.emptyAlerts}>
                                    <CheckCircle size={48} color="#10B981" />
                                    <h3>Niveles de Servicio Óptimos</h3>
                                    <p>No se detectan bloqueos de bonos ni desviaciones críticas.</p>
                                </div>
                            ) : (
                                <div className={styles.alertsGrid}>
                                    {deviationAlerts.map((alert: any, i: number) => (
                                        <div key={i} className={alert.severity === 'critical' ? styles.alertCardCritical : styles.alertCardError}>
                                            <div className={styles.alertIcon}>
                                                {alert.severity === 'critical' ? <ShieldAlert size={32} /> : <AlertTriangle size={32} />}
                                            </div>
                                            <div className={styles.alertBody}>
                                                <h4>{alert.type === 'QUALITY' ? 'INCUMPLIMIENTO DE CALIDAD' : 'DESVIACIÓN ESTRATÉGICA'}</h4>
                                                <p>{alert.message}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}

            </div>
        </div>
    );
}

function Settings(props: any) {
    return <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.1a2 2 0 0 1-1-1.72v-.51a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>;
}
