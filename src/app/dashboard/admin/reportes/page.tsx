"use client";

import { useState, useMemo, useEffect } from "react";
import {
    TrendingUp, TrendingDown, Users, Award, AlertTriangle,
    Clock, CheckCircle, XCircle, BarChart3, PieChart, Calendar,
    Download, Filter, User, DollarSign, ArrowUpRight, ArrowDownRight,
    Search, ChevronRight, Activity, Zap, ShieldAlert, Target, Save, 
    Percent, Gavel, FileText, Info, RefreshCcw, Layers, Map
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

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENTES VISUALES PREMIUM (CUSTOM SVG)
// ─────────────────────────────────────────────────────────────────────────────

// 🎯 Funnel Chart (Embudo de Productividad) - Re-diseñado para ser más elegante
const FunnelChart = ({ data }: { data: { label: string, value: number, color: string }[] }) => {
    const max = Math.max(...data.map(d => d.value), 1);
    
    return (
        <div className={styles.funnelContainerExtended}>
            {data.map((item, i) => {
                const width = (item.value / max) * 100;
                const nextWidth = data[i+1] ? (data[i+1].value / max) * 100 : width * 0.8;
                
                return (
                    <div key={i} className={styles.funnelStageExtended} style={{ opacity: 1 - i * 0.05 }}>
                        <div className={styles.funnelShapes}>
                            <svg viewBox="0 0 200 60" preserveAspectRatio="none" className={styles.funnelSvg}>
                                <path 
                                    d={`M ${(200-width*2)/2} 0 L ${(200+width*2)/2} 0 L ${(200+nextWidth*2)/2} 60 L ${(200-nextWidth*2)/2} 60 Z`} 
                                    fill={item.color}
                                />
                            </svg>
                            <div className={styles.funnelLabelExtended}>
                                <div className={styles.funnelNameExt}>{item.label}</div>
                                <div className={styles.funnelValueExt}>{item.value} <small>Tickets</small></div>
                            </div>
                        </div>
                        {i < data.length - 1 && (
                            <div className={styles.funnelDropIcon}>
                                <TrendingDown size={14} />
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
};

// 🎯 Termómetro de Metas (Bonus Progress) - Diseño "Premium"
const GoalThermometer = ({ current, target, label }: { current: number, target: number, label: string }) => {
    const percent = Math.min((current / (target || 1)) * 100, 120);
    const isOverTarget = percent >= 100;
    
    return (
        <div className={styles.premiumThermometer}>
            <div className={styles.thermTitle}>
                <div className={styles.thermInfo}>
                    <h4>{label}</h4>
                    <span className={isOverTarget ? styles.thermSuccess : styles.thermRunning}>
                        {isOverTarget ? "Fase Bonus Activa" : "En camino"}
                    </span>
                </div>
                <div className={styles.thermPercent}>{Math.round(percent)}%</div>
            </div>
            <div className={styles.thermTrack}>
                <div 
                    className={isOverTarget ? styles.thermFillDone : styles.thermFillProcess} 
                    style={{ width: `${percent}%` }}
                >
                    <div className={styles.thermGlow} />
                </div>
                <div className={styles.thermGoalLine} style={{ left: '100%' }}><span>META</span></div>
            </div>
            <div className={styles.thermLegend}>
                <span>S/ {current.toLocaleString()}</span>
                <span>Objetivo: S/ {target.toLocaleString()}</span>
            </div>
        </div>
    );
};

// 🎯 Scatter Plot (Rentabilidad vs Inversión)
const ScatterPlot = ({ data }: { data: { x: number, y: number, label: string }[] }) => {
    const maxX = Math.max(...data.map(d => d.x), 1);
    const maxY = Math.max(...data.map(d => d.y), 1);

    return (
        <div className={styles.scatterBox}>
            <div className={styles.scatterYAxisTitle}>Costos Especialistas (Inversión)</div>
            <div className={styles.scatterPlotArea}>
                <svg viewBox="0 0 100 100" className={styles.scatterSvgCanvas}>
                    {/* Grid */}
                    <line x1="0" y1="25" x2="100" y2="25" stroke="#F1F5F9" strokeWidth="0.5" />
                    <line x1="0" y1="50" x2="100" y2="50" stroke="#F1F5F9" strokeWidth="0.5" />
                    <line x1="0" y1="75" x2="100" y2="75" stroke="#F1F5F9" strokeWidth="0.5" />
                    <line x1="25" y1="0" x2="25" y2="100" stroke="#F1F5F9" strokeWidth="0.5" />
                    <line x1="50" y1="0" x2="50" y2="100" stroke="#F1F5F9" strokeWidth="0.5" />
                    <line x1="75" y1="0" x2="75" y2="100" stroke="#F1F5F9" strokeWidth="0.5" />
                    
                    {/* Quadrant lines */}
                    <line x1="50" y1="0" x2="50" y2="100" stroke="#E2E8F0" strokeWidth="1" strokeDasharray="4" />
                    <line x1="0" y1="50" x2="100" y2="50" stroke="#E2E8F0" strokeWidth="1" strokeDasharray="4" />

                    {data.map((d, i) => {
                        const cx = (d.x / maxX) * 100;
                        const cy = 100 - (d.y / maxY) * 100;
                        return (
                            <g key={i} className={styles.scatterPointGroup}>
                                <circle 
                                    cx={cx} 
                                    cy={cy} 
                                    r="3" 
                                    fill={cx > 50 && cy < 50 ? "#10B981" : cx < 50 && cy > 50 ? "#EF4444" : "#3B82F6"} 
                                    className={styles.scatterPoint}
                                />
                                <text 
                                    x={cx + 4} 
                                    y={cy + 1} 
                                    fontSize="3.5" 
                                    fill="#475569" 
                                    fontWeight="700"
                                >
                                    {d.label.split(' ')[0]}
                                </text>
                            </g>
                        );
                    })}
                </svg>
            </div>
            <div className={styles.scatterXAxisTitle}>Rentabilidad Neta (S/)</div>
            <div className={styles.scatterLegend}>
                <div className={styles.sLegendItem}><span className={styles.sDotHigh} /> Alta Eficiencia</div>
                <div className={styles.sLegendItem}><span className={styles.sDotLow} /> Revisión Crítica</div>
            </div>
        </div>
    );
};

// 🎯 Speedometer Gauge (Velocidad de Respuesta) - Tamaño Elegante
const VelocityGauge = ({ value, label, max = 72 }: { value: number, label: string, max?: number }) => {
    const clampedValue = Math.min(value, max);
    const percent = (clampedValue / max) * 100;
    const angle = (percent / 100) * 180 - 180;
    
    const getColor = (v: number) => {
        if (v < 24) return "#10B981"; 
        if (v < 48) return "#F59E0B"; 
        return "#EF4444"; 
    };

    return (
        <div className={styles.premiumGauge}>
            <div className={styles.gaugeCanvas}>
                <svg viewBox="0 0 100 60" className={styles.gaugeSvg}>
                    <defs>
                        <linearGradient id="gaugeGradient" x1="0" y1="0" x2="1" y2="0">
                            <stop offset="0%" stopColor="#10B981" />
                            <stop offset="50%" stopColor="#F59E0B" />
                            <stop offset="100%" stopColor="#EF4444" />
                        </linearGradient>
                    </defs>
                    <path d="M 10 50 A 40 40 0 0 1 90 50" fill="none" stroke="#F1F5F9" strokeWidth="12" strokeLinecap="round" />
                    <path 
                        d="M 10 50 A 40 40 0 0 1 90 50" 
                        fill="none" 
                        stroke="url(#gaugeGradient)" 
                        strokeWidth="12" 
                        strokeLinecap="round"
                        strokeDasharray="125.6"
                        strokeDashoffset={125.6 * (1 - percent/100)}
                        className={styles.gaugeFill}
                    />
                    <circle cx="50" cy="50" r="4" fill="#1E293B" />
                    <line 
                        x1="50" y1="50" 
                        x2={50 + 32 * Math.cos((angle * Math.PI) / 180)} 
                        y2={50 + 32 * Math.sin((angle * Math.PI) / 180)} 
                        stroke="#1E293B" strokeWidth="3" strokeLinecap="round"
                        className={styles.gaugeNeedle}
                    />
                </svg>
                <div className={styles.gaugeLabelCenter}>
                    <div className={styles.gVal}>{Math.round(value)}<small>h</small></div>
                    <div className={styles.gSub}>PROM.</div>
                </div>
            </div>
            <h5 className={styles.gaugeManagerName}>{label}</h5>
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
    const [selectedTab, setSelectedTab] = useState<"productivity" | "bonuses" | "profitability" | "admin" | "risk">("productivity");
    const [editingTarget, setEditingTarget] = useState<Record<string, number>>({});
    const [isSaving, setIsSaving] = useState(false);

    // Mes actual formateado como KEY (YYYY-MM)
    const currentMonthKey = useMemo(() => {
        const d = new Date();
        if (selectedPeriod === "previous") d.setMonth(d.getMonth() - 1);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    }, [selectedPeriod]);

    // 🎯 Filtrar datos por el período seleccionado (Sincronización Total con Tickets)
    const filteredTickets = useMemo(() => {
        const now = new Date();
        // Obtener el inicio y fin del mes seleccionado
        let targetMonth = now.getMonth();
        let targetYear = now.getFullYear();
        
        if (selectedPeriod === "previous") {
            if (targetMonth === 0) {
                targetMonth = 11;
                targetYear--;
            } else {
                targetMonth--;
            }
        }
        
        const startOfMonth = new Date(targetYear, targetMonth, 1, 0, 0, 0);
        const endOfMonth = new Date(targetYear, targetMonth + 1, 0, 23, 59, 59);
        
        return tickets.filter(t => {
            const dateStr = t.createdAt || t.created_at || t.fechaCreacion;
            if (!dateStr) return false;
            const date = new Date(dateStr);
            return date >= startOfMonth && date <= endOfMonth;
        });
    }, [tickets, selectedPeriod]);

    // 🎯 Productividad por Gestor Expandida
    const productivityByGestor = useMemo(() => {
        const map: any = {};
        
        // Inicializar con todas las gestoras (para asegurar que los nombres aparezcan aunque no tengan tickets)
        gestoras.forEach(g => {
            const targetObj = gestorasTargets.find(t => t.gestora_id === g.id && t.month_key === currentMonthKey);
            // IMPORTANTE: g.name o g.nombre según lo que devuelva la API
            const finalName = g.name || g.nombre || g.full_name || "Gestora sin Nombre";
            
            map[g.id] = {
                id: g.id,
                nombre: finalName,
                nuevos: 0,
                proceso: 0,
                cerrados: 0,
                vencidos: 0,
                inversion: 0,
                facturacion: 0,
                costoLaboral: g.costo_laboral_mensual || 1800,
                activos: g.activos_mensuales_valor || 0,
                sstCompliance: g.sst_compliance_status ?? true,
                targetAmount: targetObj?.target_amount || 35000,
                bonusMultiplier: targetObj?.bonus_multiplier || 0.1,
                horasCierre: []
            };
        });

        filteredTickets.forEach(t => {
            const gid = t.gestora_id;
            if (!gid || !map[gid]) return;
            
            const sid = normalizeStateId(t.estadoId);
            
            // Lógica exacta de estados sincronizada con Kanban
            if (['nuevo', 'asignado_a_tecnico', 'cotizando'].includes(sid)) map[gid].nuevos++;
            else if (['enviada', 'trabajo_en_curso', 'documentacion_enviada'].includes(sid)) map[gid].proceso++;
            else if (['por_liquidar', 'liquidado', 'ticket_cerrado'].includes(sid)) map[gid].cerrados++;

            const horas = calcularHoras(t);
            // Sincronización de umbral 72h
            if (horas > 72 && sid !== 'ticket_cerrado') map[gid].vencidos++;
            if (sid === 'ticket_cerrado') map[gid].horasCierre.push(horas);

            // Montos Financieros
            map[gid].facturacion += parseFloat(t.total_quoted_amount || t.montoFinal || 0);
            const pagos = (t.metadata?.historialPagosTecnico || []).reduce((sum: number, p: any) => sum + p.monto, 0);
            map[gid].inversion += pagos;
        });

        return Object.values(map).map((g: any) => {
            const totalCerrados = g.horasCierre.length;
            const avgTime = totalCerrados > 0 ? g.horasCierre.reduce((a: any, b: any) => a + b, 0) / totalCerrados : 0;
            const rentabilidad = g.facturacion - g.inversion - g.costoLaboral - g.activos;
            const totalTickets = g.nuevos + g.proceso + g.cerrados;
            const ratioVencidos = totalTickets > 0 ? (g.vencidos / totalTickets) * 100 : 0;
            
            // Lógica de Bono Variable Condicionada
            let bonoValido = g.sstCompliance && ratioVencidos < 5;
            let percentMeta = (rentabilidad / (g.targetAmount || 1)) * 100;
            let bonoProyectado = 0;
            
            if (bonoValido && percentMeta >= 80) {
                bonoProyectado = (rentabilidad / g.targetAmount) * (g.costoLaboral * g.bonusMultiplier);
            }

            return { ...g, avgTime, rentabilidad, ratioVencidos, bonoValido, bonoProyectado, percentMeta, totalTickets };
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
            map[cid].billing += parseFloat(t.total_quoted_amount || t.montoFinal || 0);
            const pagos = (t.metadata?.historialPagosTecnico || []).reduce((sum: number, p: any) => sum + p.monto, 0);
            map[cid].costs += pagos;
        });

        return Object.values(map).map((c: any) => {
            c.profit = c.billing - c.costs;
            c.margin = c.billing > 0 ? (c.profit / c.billing) * 100 : 0;
            return c;
        }).filter(c => c.billing > 0).sort((a,b) => b.profit - a.profit);
    }, [filteredTickets, clients]);

    // 🎯 Alertas de Desviación 
    const alerts = useMemo(() => {
        const now = new Date();
        const alertsList: any[] = [];
        
        productivityByGestor.forEach(g => {
            if (now.getDate() >= 15 && g.percentMeta < 50) {
                alertsList.push({ 
                    type: 'DANGER', 
                    message: `ADMIN: ${g.nombre} está bajo el 50% de la meta al día ${now.getDate()}.`,
                    severity: 'critical' 
                });
            }
            if (g.ratioVencidos >= 5) {
                alertsList.push({ 
                    type: 'QUALITY', 
                    message: `CALIDAD: Bono de ${g.nombre} bloqueado por Tickets Vencidos (${Math.round(g.ratioVencidos)}%).`,
                    severity: 'error' 
                });
            }
        });
        
        return alertsList;
    }, [productivityByGestor]);

    const handleSaveTargets = async () => {
        setIsSaving(true);
        try {
            for (const [gid, amount] of Object.entries(editingTarget)) {
                await setTarget(gid, currentMonthKey, { target_amount: amount });
            }
            setEditingTarget({});
            alert("Metas sincronizadas con éxito.");
        } catch (err) {
            alert("Error al actualizar metas.");
        } finally {
            setIsSaving(false);
        }
    };

    if (loadingTickets || loadingClients || loadingGestoras || loadingTargets) {
        return (
            <div className={styles.loadingContainer}>
                <RefreshCcw className={styles.spinIcon} size={48} />
                <h3>Sincronizando Módulos de Eficiencia...</h3>
            </div>
        );
    }

    return (
        <div className={styles.premiumContainer}>
            {/* Header "Corporate Glass" */}
            <header className={styles.premiumHeader}>
                <div className={styles.headerInfo}>
                    <div className={styles.headerIconBox}><Layers size={24} /></div>
                    <div>
                        <h1 className={styles.hTitle}>Efficiency Intelligence</h1>
                        <p className={styles.hSubtitle}>Periodo Actual: {currentMonthKey}</p>
                    </div>
                </div>
                <div className={styles.headerControls}>
                    <div className={styles.navSegments}>
                        <button 
                            className={selectedPeriod === 'current' ? styles.segActive : styles.seg} 
                            onClick={() => setSelectedPeriod('current')}
                        >
                            Ciclo Vivo
                        </button>
                        <button 
                            className={selectedPeriod === 'previous' ? styles.segActive : styles.seg} 
                            onClick={() => setSelectedPeriod('previous')}
                        >
                            Histórico
                        </button>
                    </div>
                    <button className={styles.actionBtnPrimary}><Download size={18} /> Exportar Reporte</button>
                </div>
            </header>

            {/* Top KPI Ribbon */}
            <div className={styles.kpiRibbon}>
                <div className={styles.kpiCardExt}>
                    <div className={styles.kpiIconExt} style={{ background: '#E0F2FE' }}><DollarSign size={20} color="#0369A1" /></div>
                    <div className={styles.kpiContentExt}>
                        <label>Facturación Total</label>
                        <strong>S/ {profitabilityByClient.reduce((s,c)=>s+c.billing, 0).toLocaleString()}</strong>
                    </div>
                </div>
                <div className={styles.kpiCardExt}>
                    <div className={styles.kpiIconExt} style={{ background: '#DCFCE7' }}><Activity size={20} color="#15803D" /></div>
                    <div className={styles.kpiContentExt}>
                        <label>Rentabilidad Neta</label>
                        <strong>S/ {profitabilityByClient.reduce((s,c)=>s+c.profit, 0).toLocaleString()}</strong>
                    </div>
                </div>
                <div className={styles.kpiCardExt}>
                    <div className={styles.kpiIconExt} style={{ background: '#F0F9FF' }}><Target size={20} color="#0EA5E9" /></div>
                    <div className={styles.kpiContentExt}>
                        <label>Efectividad</label>
                        <strong>{Math.round((productivityByGestor.reduce((s,g)=>s+g.cerrados,0) / (filteredTickets.length||1)) * 100)}%</strong>
                    </div>
                </div>
                <div className={styles.kpiCardExt}>
                    <div className={styles.kpiIconExt} style={{ background: '#FEF2F2' }}><ShieldAlert size={20} color="#DC2626" /></div>
                    <div className={styles.kpiContentExt}>
                        <label>Riesgo SLA</label>
                        <strong>{Math.round((productivityByGestor.reduce((s,g)=>s+g.vencidos,0) / (filteredTickets.length||1)) * 100)}%</strong>
                    </div>
                </div>
            </div>

            {/* Main Tabs UI */}
            <nav className={styles.modernTabNav}>
                <button className={selectedTab === 'productivity' ? styles.mTabActive : styles.mTab} onClick={() => setSelectedTab('productivity')}>
                    <Layers size={18} /> Control Operativo
                </button>
                <button className={selectedTab === 'bonuses' ? styles.mTabActive : styles.mTab} onClick={() => setSelectedTab('bonuses')}>
                    <Award size={18} /> Bonos Variables
                </button>
                <button className={selectedTab === 'profitability' ? styles.mTabActive : styles.mTab} onClick={() => setSelectedTab('profitability')}>
                    <Map size={18} /> Rentabilidad & Scatter
                </button>
                <button className={selectedTab === 'admin' ? styles.mTabActive : styles.mTab} onClick={() => setSelectedTab('admin')}>
                    <SettingsIcon size={18} /> Configurar Metas
                </button>
                <button className={selectedTab === 'risk' ? styles.mTabActive : styles.mTab} onClick={() => setSelectedTab('risk')}>
                    <AlertTriangle size={18} /> Auditoría {alerts.length > 0 && <span className={styles.badgeCount}>{alerts.length}</span>}
                </button>
            </nav>

            <div className={styles.dashboardContainer}>
                
                {selectedTab === 'productivity' && (
                    <div className={styles.productivityLayout}>
                        <div className={styles.mainInsights}>
                            <div className={styles.elegantCard}>
                                <div className={styles.cardHeaderExt}>
                                    <div>
                                        <h3>Embudo de Conversión Operativa</h3>
                                        <p>Flujo desde asignación hasta cierre efectivo</p>
                                    </div>
                                </div>
                                <FunnelChart data={[
                                    { label: 'Ingresados', value: filteredTickets.length, color: '#3B82F6' },
                                    { label: 'En Ejecución', value: filteredTickets.length - productivityByGestor.reduce((s,g)=>s+g.cerrados,0), color: '#F59E0B' },
                                    { label: 'Cerrados OK', value: productivityByGestor.reduce((s,g)=>s+g.cerrados,0), color: '#10B981' },
                                ]} />
                            </div>

                            <div className={styles.elegantCard}>
                                <div className={styles.cardHeaderExt}>
                                    <div>
                                        <h3>Velocidad de Respuesta</h3>
                                        <p>Tiempo promedio de cierre por gestora</p>
                                    </div>
                                </div>
                                <div className={styles.gaugesContainer}>
                                    {productivityByGestor.slice(0, 4).map((g, i) => (
                                        <VelocityGauge key={i} value={g.avgTime} label={g.nombre} />
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className={styles.fullStatsTableCard}>
                            <div className={styles.cardHeaderExt}>
                                <h3>Ranking General de Eficiencia</h3>
                            </div>
                            <table className={styles.premiumTable}>
                                <thead>
                                    <tr>
                                        <th>Gestora</th>
                                        <th>Tickets</th>
                                        <th>Vencidos</th>
                                        <th>Salud SLA</th>
                                        <th>SST</th>
                                        <th>Meta</th>
                                        <th>Beneficio</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {productivityByGestor.map((g, i) => (
                                        <tr key={i}>
                                            <td className={styles.managerCell}>
                                                <div className={styles.avatarMini}>{g.nombre.charAt(0)}</div>
                                                <strong>{g.nombre}</strong>
                                            </td>
                                            <td>{g.totalTickets}</td>
                                            <td className={g.vencidos > 0 ? styles.textDanger : ""}>{g.vencidos}</td>
                                            <td>
                                                <div className={styles.statusBubble} style={{ background: g.ratioVencidos < 5 ? '#DCFCE7' : '#FEF2F2', color: g.ratioVencidos < 5 ? '#15803D' : '#DC2626' }}>
                                                    {Math.round(g.ratioVencidos)}% Venc.
                                                </div>
                                            </td>
                                            <td>{g.sstCompliance ? <CheckCircle color="#10B981" size={16} /> : <XCircle color="#DC2626" size={16} />}</td>
                                            <td>
                                                <div className={styles.progressThin}>
                                                    <div className={styles.progressFill} style={{ width: `${Math.min(g.percentMeta, 100)}%`, background: g.percentMeta >= 100 ? '#10B981' : '#3B82F6' }} />
                                                </div>
                                            </td>
                                            <td>
                                                <span className={g.bonoValido ? styles.bonusFlagOn : styles.bonusFlagOff}>
                                                    {g.bonoValido ? "BONO OK" : "NO APTO"}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {selectedTab === 'bonuses' && (
                    <div className={styles.bonusesView}>
                        <div className={styles.gridThree}>
                            {productivityByGestor.map((g, i) => (
                                <GoalThermometer key={i} current={g.rentabilidad} target={g.targetAmount} label={g.nombre} />
                            ))}
                        </div>
                        <div className={styles.bonusStats}>
                            <div className={styles.elegantCard}>
                                <h3>Resumen de Planilla Variable</h3>
                                <div className={styles.bonusSummaryList}>
                                    {productivityByGestor.map((g, i) => (
                                        <div key={i} className={styles.bonusItemRow}>
                                            <div className={styles.bMngr}>
                                                <strong>{g.nombre}</strong>
                                                <span>Sueldo Base: S/ {g.costoLaboral}</span>
                                            </div>
                                            <div className={styles.bCalc}>
                                                <label>Bono Proyectado</label>
                                                <strong>S/ {Math.round(g.bonoProyectado).toLocaleString()}</strong>
                                            </div>
                                            <div className={styles.bStatus}>
                                                {g.bonoValido ? <CheckCircle size={20} color="#10B981" /> : <AlertTriangle size={20} color="#F59E0B" />}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {selectedTab === 'profitability' && (
                    <div className={styles.profitView}>
                        <div className={styles.mainGrid}>
                            <div className={styles.elegantCard}>
                                <div className={styles.cardHeaderExt}>
                                    <h3>Análisis de Dispersión</h3>
                                    <p>Rentabilidad Neta vs Inversión en Especialistas</p>
                                </div>
                                <ScatterPlot data={profitabilityByClient.map(c => ({
                                    x: c.profit,
                                    y: c.costs,
                                    label: c.nombre
                                }))} />
                            </div>
                            
                            <div className={styles.elegantCard}>
                                <div className={styles.cardHeaderExt}>
                                    <h3>Top Clientes ORO</h3>
                                </div>
                                <div className={styles.oroList}>
                                    {profitabilityByClient.slice(0, 5).map((c, i) => (
                                        <div key={i} className={styles.oroCard}>
                                            <div className={styles.oroRank}>#{i+1}</div>
                                            <div className={styles.oroName}>{c.nombre}</div>
                                            <div className={styles.oroVal}>S/ {c.profit.toLocaleString()}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className={styles.fullStatsTableCard}>
                            <div className={styles.cardHeaderExt}>
                                <h3>P&L Detallado por Cliente</h3>
                            </div>
                            <table className={styles.premiumTable}>
                                <thead>
                                    <tr>
                                        <th>Cliente</th>
                                        <th>Facturación</th>
                                        <th>Inversión</th>
                                        <th>Utilidad</th>
                                        <th>Margen %</th>
                                        <th>Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {profitabilityByClient.map((c, i) => (
                                        <tr key={i}>
                                            <td>
                                                <div className={styles.clientCell}>
                                                    {i < 3 && <span className={styles.badgeOroSmall}>ORO</span>}
                                                    <strong>{c.nombre}</strong>
                                                </div>
                                            </td>
                                            <td>S/ {c.billing.toLocaleString()}</td>
                                            <td>S/ {c.costs.toLocaleString()}</td>
                                            <td className={styles.textSuccess}>S/ {c.profit.toLocaleString()}</td>
                                            <td><strong>{Math.round(c.margin)}%</strong></td>
                                            <td>
                                                <span className={styles.healthDot} style={{ background: c.margin > 20 ? '#10B981' : c.margin > 10 ? '#F59E0B' : '#EF4444' }} />
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {selectedTab === 'admin' && (
                    <div className={styles.fullStatsTableCard}>
                        <div className={styles.cardHeaderExt}>
                            <h3>Configuración Central de Metas Mensuales</h3>
                            <p>Periodo de evaluación: {currentMonthKey}</p>
                        </div>
                        <table className={styles.premiumTable}>
                            <thead>
                                <tr>
                                    <th>Identificación Gestora</th>
                                    <th>Costo Laboral Base</th>
                                    <th>Meta Rentabilidad Bruta (S/)</th>
                                    <th>Bono Base (%)</th>
                                    <th>Acciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                {productivityByGestor.map((g, i) => (
                                    <tr key={i}>
                                        <td className={styles.managerCell}>
                                            <div className={styles.avatarMini}>{g.nombre.charAt(0)}</div>
                                            <div>
                                                <strong>{g.nombre}</strong>
                                                <small style={{display:'block', color:'#94A3B8'}}>{g.id.substring(0,8)}</small>
                                            </div>
                                        </td>
                                        <td>S/ {g.costoLaboral}</td>
                                        <td>
                                            <input 
                                                type="number" 
                                                className={styles.elegantInput}
                                                defaultValue={g.targetAmount}
                                                onChange={(e) => setEditingTarget({ ...editingTarget, [g.id]: parseFloat(e.target.value) })}
                                            />
                                        </td>
                                        <td><strong>{g.bonusMultiplier * 100}%</strong></td>
                                        <td>
                                            <button className={styles.btnIconOnly} onClick={() => alert("Historial de metas no disponible")}>
                                                <Calendar size={16} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        <div className={styles.adminFooterActions}>
                            <button 
                                className={styles.btnPrimaryLarge} 
                                onClick={handleSaveTargets}
                                disabled={isSaving || Object.keys(editingTarget).length === 0}
                            >
                                {isSaving ? "Sincronizando..." : "Sincronizar Todas las Metas"}
                            </button>
                        </div>
                    </div>
                )}

                {selectedTab === 'risk' && (
                    <div className={styles.auditView}>
                        <div className={styles.cardHeaderExt}>
                            <h3>Panel de Auditoría y Auditoría SST</h3>
                        </div>
                        {alerts.length === 0 ? (
                            <div className={styles.auditEmpty}>
                                <CheckCircle size={64} color="#10B981" />
                                <h2>Nivel de Riesgo Óptimo</h2>
                                <p>Todos los KPIs se encuentran dentro de los márgenes estratégicos de la compañía.</p>
                            </div>
                        ) : (
                            <div className={styles.alertsGridExtended}>
                                {alerts.map((a, i) => (
                                    <div key={i} className={a.severity === 'critical' ? styles.alertCardCritical : styles.alertCardWarningExt}>
                                        <div className={styles.alertIconExt}>
                                            {a.severity === 'critical' ? <ShieldAlert size={32} /> : <AlertTriangle size={32} />}
                                        </div>
                                        <div className={styles.alertContentExt}>
                                            <h4>{a.type}</h4>
                                            <p>{a.message}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

            </div>
        </div>
    );
}

function SettingsIcon(props: any) {
    return <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.1a2 2 0 0 1-1-1.72v-.51a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>;
}
