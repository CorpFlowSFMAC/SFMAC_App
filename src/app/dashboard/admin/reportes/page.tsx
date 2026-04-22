"use client";

import { useState, useMemo, useEffect } from "react";
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
    Line, ComposedChart, ScatterChart, Scatter, ZAxis, Cell
} from 'recharts';
import { 
    TrendingUp, TrendingDown, Users, Award, AlertTriangle,
    Clock, CheckCircle, XCircle, BarChart3, PieChart, Calendar,
    Download, Filter, User, DollarSign, ArrowUpRight, ArrowDownRight,
    Search, ChevronRight, Activity, Zap, ShieldAlert, Target, Save, 
    Percent, Gavel, FileText, Info, RefreshCcw, Layers, Map, Settings
} from "lucide-react";
import styles from "./reportes.module.css";
import { useAppData } from "@/lib/AppDataContext";
import { normalizeStateId, TICKET_STATES } from "@/lib/ticketStates";
import { round2 } from "@/lib/formatters";
import TicketWindow from "../tickets/TicketWindow";

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
// COMPONENTES DE DASHBOARD CORPORATIVO (RECHARTS)
// ─────────────────────────────────────────────────────────────────────────────

// 📊 Gráfico Principal: Facturación y Volumen por Gestor
const RevenueVolumeChart = ({ data }: { data: any[] }) => (
    <div style={{ width: '100%', height: 350 }}>
        <ResponsiveContainer>
            <ComposedChart data={data} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
                <defs>
                    <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#002A8F" stopOpacity={1} />
                        <stop offset="100%" stopColor="#001F6B" stopOpacity={1} />
                    </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                <XAxis 
                    dataKey="nombre" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: '#64748B', fontSize: 12, fontWeight: 700 }}
                    dy={10}
                />
                <YAxis 
                    yAxisId="left"
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: '#64748B', fontSize: 11 }}
                    tickFormatter={(val) => `S/ ${val.toLocaleString()}`}
                />
                <YAxis 
                    yAxisId="right" 
                    orientation="right" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: '#64748B', fontSize: 11 }}
                />
                <Tooltip 
                    contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)', padding: '1rem' }}
                    cursor={{ fill: '#F8FAFC' }}
                    formatter={(value: any, name: any) => [
                        name?.includes('S/') ? `S/ ${Math.round(value).toLocaleString()}` : value,
                        name
                    ]}
                />
                <Legend verticalAlign="top" align="right" iconType="circle" iconSize={8} wrapperStyle={{ paddingBottom: 25 }} />
                <Bar yAxisId="left" dataKey="facturacion" name="Facturación (S/)" fill="url(#barGradient)" radius={[6, 6, 0, 0]} barSize={45} />
                <Bar yAxisId="left" dataKey="rentabilidad" name="Utilidad (S/)" fill="#10B981" radius={[6, 6, 0, 0]} barSize={15} />
                <Line yAxisId="right" type="monotone" dataKey="cerrados" name="Tickets Cerrados" stroke="#3B82F6" strokeWidth={4} dot={{ r: 6, fill: '#3B82F6', strokeWidth: 3, stroke: '#fff' }} />
            </ComposedChart>
        </ResponsiveContainer>
    </div>
);

// 🎯 Gráfico Secundario: Eficiencia de Cierre (Horas) vs SLA
const EfficiencySLAChart = ({ data }: { data: any[] }) => (
    <div style={{ width: '100%', height: 350 }}>
        <ResponsiveContainer>
            <ScatterChart margin={{ top: 20, right: 30, bottom: 20, left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                <XAxis 
                    type="number" 
                    dataKey="tiempoPromedio" 
                    name="Tiempo Promedio" 
                    unit="h" 
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#64748B', fontSize: 11 }}
                />
                <YAxis 
                    type="number" 
                    dataKey="cumplimientoSLA" 
                    name="SLA" 
                    unit="%" 
                    domain={[0, 100]}
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#64748B', fontSize: 11 }}
                />
                <ZAxis type="number" dataKey="totalTickets" range={[100, 800]} name="Tickets" />
                <Tooltip 
                    cursor={{ strokeDasharray: '3 3' }}
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                    formatter={(value: any, name: any) => [
                        name === 'SLA' ? `${Math.round(value)}%` : name === 'Tiempo Promedio' ? `${Math.round(value)}h` : value,
                        name
                    ]}
                />
                <Legend verticalAlign="top" align="right" iconType="circle" />
                <Scatter name="Gestores" data={data}>
                    {data.map((entry, index) => (
                        <Cell 
                            key={`cell-${index}`} 
                            fill={entry.cumplimientoSLA > 90 ? '#10B981' : entry.cumplimientoSLA > 70 ? '#F59E0B' : '#EF4444'} 
                            fillOpacity={0.8}
                            strokeWidth={2}
                            stroke="#fff"
                        />
                    ))}
                </Scatter>
            </ScatterChart>
        </ResponsiveContainer>
    </div>
);

// 💰 Gráfico Financiero: Rentabilidad vs Inversión (Scatter)
const FinancialScatterChart = ({ data }: { data: any[] }) => (
    <div style={{ width: '100%', height: 350 }}>
        <ResponsiveContainer>
            <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis 
                    type="number" 
                    dataKey="x" 
                    name="Rentabilidad" 
                    unit="S/" 
                    axisLine={false}
                    tickLine={false}
                    label={{ value: 'Rentabilidad Neta (S/)', position: 'bottom', fontSize: 11, offset: 0 }}
                />
                <YAxis 
                    type="number" 
                    dataKey="y" 
                    name="Inversión" 
                    unit="S/" 
                    axisLine={false}
                    tickLine={false}
                    label={{ value: 'Inversión (S/)', angle: -90, position: 'insideLeft', fontSize: 11 }}
                />
                <Tooltip cursor={{ strokeDasharray: '3 3' }} />
                <Scatter name="Clientes" data={data} fill="#002A8F">
                    {data.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.x > 0 ? '#10B981' : '#EF4444'} />
                    ))}
                </Scatter>
            </ScatterChart>
        </ResponsiveContainer>
    </div>
);

// 🎯 Goal Target Card (Admin View)
const GoalThermometer = ({ current, target, label }: { current: number, target: number, label: string }) => {
    const percent = Math.min((current / (target || 1)) * 100, 120);
    const isOverTarget = percent >= 100;
    
    return (
        <div className={styles.premiumThermometer}>
            <div className={styles.thermTitle}>
                <div className={styles.thermInfo}>
                    <h4>{label}</h4>
                    <span className={isOverTarget ? styles.thermSuccess : styles.thermRunning}>
                        {isOverTarget ? "Meta Superada" : "En camino"}
                    </span>
                </div>
                <div className={styles.thermPercent}>{Math.round(percent)}%</div>
            </div>
            <div className={styles.thermTrack}>
                <div 
                    className={isOverTarget ? styles.thermFillDone : styles.thermFillProcess} 
                    style={{ width: `${Math.min(percent, 100)}%` }}
                />
                <div className={styles.thermGoalLine} style={{ left: '100%' }}><span>META</span></div>
            </div>
            <div className={styles.thermLegend}>
                <span>S/ {Math.round(current).toLocaleString()}</span>
                <span>Objetivo: S/ {Math.round(target).toLocaleString()}</span>
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
    const [selectedTab, setSelectedTab] = useState<"productivity" | "bonuses" | "profitability" | "admin" | "risk">("productivity");
    const [selectedGestoraId, setSelectedGestoraId] = useState<string>("global");
    const [editingTarget, setEditingTarget] = useState<Record<string, number>>({});
    const [activeTicket, setActiveTicket] = useState<any>(null);
    const [isSaving, setIsSaving] = useState(false);

    // Estado para ordenamiento de la tabla
    const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' }>({ key: 'rentabilidad', direction: 'desc' });

    // 🎯 Filtrar Gestoras: Solo corporativas (@sinfimac.com) o Administradores
    const filteredGestoras = useMemo(() => {
        return gestoras.filter(g => {
            const email = (g.email || g.correo || "").toLowerCase();
            const role = (g.role || "").toLowerCase();
            const isAdmin = role === 'admin' || g.is_admin || g.id === 'admin';
            const isCorporate = email.endsWith('@sinfimac.com');
            return isAdmin || isCorporate;
        });
    }, [gestoras]);

    const handleSort = (key: string) => {
        let direction: 'asc' | 'desc' = 'desc';
        if (sortConfig.key === key && sortConfig.direction === 'desc') {
            direction = 'asc';
        }
        setSortConfig({ key, direction });
    };

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
            const isInPeriod = date >= startOfMonth && date <= endOfMonth;
            
            if (!isInPeriod) return false;
            
            // Filtro por Gestora
            if (selectedGestoraId !== "global") {
                return t.gestora_id === selectedGestoraId;
            }
            
            return true;
        });
    }, [tickets, selectedPeriod, selectedGestoraId]);

    // 🎯 Auditoría de Rentabilidad Negativa (Console Tracking)
    useEffect(() => {
        if (filteredTickets.length > 0) {
            const negativeTickets = filteredTickets.filter(t => {
                const billingGross = parseFloat(t.total_quoted_amount || t.montoFinal || 0);
                const billingNet = billingGross / 1.18;
                
                // Inversión: Mano de Obra + Materiales + Viáticos (Sin IGV)
                const inversion = (t.metadata?.historialPagosTecnico || []).reduce((sum: number, p: any) => sum + p.monto, 0);
                
                return (billingNet - inversion) < -1; // Tolerancia de 1 sol
            });

            if (negativeTickets.length > 0) {
                console.group("🚨 AUDITORÍA: TICKETS CON RENTABILIDAD NEGATIVA");
                negativeTickets.forEach(t => {
                    const gross = parseFloat(t.total_quoted_amount || t.montoFinal || 0);
                    const net = gross / 1.18;
                    const inv = (t.metadata?.historialPagosTecnico || []).reduce((sum: number, p: any) => sum + p.monto, 0);
                    console.warn(`Ticket: ${t.numeroTicketCliente || t.id} | Neto: S/ ${net.toFixed(2)} | Inversión: S/ ${inv.toFixed(2)} | ROI: S/ ${(net - inv).toFixed(2)}`);
                });
                console.groupEnd();
            }
        }
    }, [filteredTickets]);

    // 🎯 Productividad por Gestor Expandida
    const productivityByGestor = useMemo(() => {
        const map: any = {};
        
        // Inicializar con todas las gestoras (para asegurar que los nombres aparezcan aunque no tengan tickets)
        filteredGestoras.forEach(g => {
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
                costoLaboral: Number(g.costo_laboral_mensual || 0),
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

            // Montos Financieros - APLICANDO REGLA "NETO SIN IGV"
            if (['por_liquidar', 'liquidado', 'ticket_cerrado'].includes(sid)) {
                // Si el monto ya es neto lo usamos, si no, dividimos entre 1.18
                const gross = parseFloat(t.total_quoted_amount || t.montoFinal || 0);
                map[gid].facturacion += gross / 1.18;
            }
            
            const pagos = (t.metadata?.historialPagosTecnico || []).reduce((sum: number, p: any) => sum + p.monto, 0);
            map[gid].inversion += pagos;
        });

        const baseList = Object.values(map).map((g: any) => {
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
        });

        // Aplicar ordenamiento dinámico
        return [...baseList].sort((a: any, b: any) => {
            const valA = a[sortConfig.key];
            const valB = b[sortConfig.key];
            
            if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
            if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });
    }, [filteredTickets, filteredGestoras, gestorasTargets, currentMonthKey, sortConfig]);

    // 🎯 Rentabilidad por Cliente
    const profitabilityByClient = useMemo(() => {
        const map: any = {};
        clients.forEach(c => {
            map[c.id] = { id: c.id, nombre: c.name, billing: 0, costs: 0, profit: 0, margin: 0 };
        });

        filteredTickets.forEach(t => {
            const cid = t.client_id;
            if (!cid || !map[cid]) return;
            const sid = normalizeStateId(t.status_id || t.estadoId);
            
            // Sincronización: Facturación NETA (Sin IGV)
            if (['por_liquidar', 'liquidado', 'ticket_cerrado'].includes(sid)) {
                const gross = parseFloat(t.total_quoted_amount || t.montoFinal || 0);
                map[cid].billing += gross / 1.18;
            }
            
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
                    <div className={styles.gestoraFilterBox}>
                        <User size={16} className={styles.filterIcon} />
                        <select 
                            value={selectedGestoraId}
                            onChange={(e) => setSelectedGestoraId(e.target.value)}
                            className={styles.gestoraSelect}
                        >
                            <option value="global">VISTA GLOBAL (Todos)</option>
                            {filteredGestoras.map(g => (
                                <option key={g.id} value={g.id}>
                                    {g.name || g.nombre || "Sin nombre"}
                                </option>
                            ))}
                        </select>
                    </div>

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

            {/* Dashboard Container starts directly after tabs to avoid redundancy */}

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
                    <Settings size={18} /> Configurar Metas
                </button>
                <button className={selectedTab === 'risk' ? styles.mTabActive : styles.mTab} onClick={() => setSelectedTab('risk')}>
                    <AlertTriangle size={18} /> Auditoría {alerts.length > 0 && <span className={styles.badgeCount}>{alerts.length}</span>}
                </button>
            </nav>

            <div className={styles.dashboardContainer}>
                
                {selectedTab === 'productivity' && (
                    <div className={styles.productivityAnalyticsLayout}>
                        {/* 💎 KPI Ribbon Minimalista */}
                        <div className={styles.kpiAnalyticalGrid}>
                            <div className={styles.kpiAnalyticalCard}>
                                <div className={styles.kpiAIcon}><DollarSign size={20} /></div>
                                <div className={styles.kpiAContent}>
                                    <label>Facturación Neta</label>
                                    <strong>S/ {Math.round(profitabilityByClient.reduce((s,c)=>s+c.billing, 0)).toLocaleString()}</strong>
                                </div>
                            </div>
                            <div className={styles.kpiAnalyticalCard}>
                                <div className={styles.kpiAIcon} style={{ background: '#DCFCE7', color: '#15803D' }}><TrendingUp size={20} /></div>
                                <div className={styles.kpiAContent}>
                                    <label>Utilidad</label>
                                    <strong>S/ {Math.round(profitabilityByClient.reduce((s,c)=>s+c.profit, 0)).toLocaleString()}</strong>
                                </div>
                            </div>
                            <div className={styles.kpiAnalyticalCard}>
                                <div className={styles.kpiAIcon} style={{ background: '#E0F2FE', color: '#002A8F' }}><Clock size={20} /></div>
                                <div className={styles.kpiAContent}>
                                    <label>Tiempo Promedio Global</label>
                                    <strong>{Math.round(productivityByGestor.reduce((s,g)=>s+g.avgTime,0)/ (productivityByGestor.length||1))}h</strong>
                                </div>
                            </div>
                            <div className={styles.kpiAnalyticalCard}>
                                <div className={styles.kpiAIcon} style={{ background: '#FEF3C7', color: '#B45309' }}><ShieldAlert size={20} /></div>
                                <div className={styles.kpiAContent}>
                                    <label>Efectividad SLA</label>
                                    <strong className={productivityByGestor.some(g=>g.ratioVencidos > 10) ? styles.textDanger : ""}>
                                        {Math.round(100 - (productivityByGestor.reduce((s,g)=>s+g.ratioVencidos,0)/ (productivityByGestor.length||1)))}%
                                    </strong>
                                </div>
                            </div>
                        </div>

                        {/* 👥 Gestoras Quick View Grid - DINÁMICO */}
                        <div className={styles.gestorasOverviewSection}>
                            <div className={styles.sectionHeaderExt}>
                                <h3>Rendimiento Individual de Gestoras</h3>
                                <p>Distribución de carga y efectividad por responsable</p>
                            </div>
                            <div className={styles.gestorasGridPermanent}>
                                {productivityByGestor.map((g, i) => (
                                    <div key={i} className={styles.gestoraActionCard} onClick={() => setSelectedGestoraId(g.id)}>
                                        <div className={styles.gestoraCardHeader}>
                                            <div className={styles.gestoraAvatar}>{g.nombre.charAt(0)}</div>
                                            <div className={styles.gestoraNameInfo}>
                                                <div className={styles.gName}>{g.nombre}</div>
                                                <div className={styles.gStatus}>{g.cerrados} de {g.totalTickets} tickets cerrados</div>
                                            </div>
                                            <div className={styles.gProfileBtn}><ChevronRight size={16} /></div>
                                        </div>
                                        <div className={styles.gestoraMiniFunnel}>
                                            <div className={styles.miniFunnelLabels}>
                                                <span>Pendientes</span>
                                                <span>{Math.round((g.cerrados / (g.totalTickets || 1)) * 100)}%</span>
                                            </div>
                                            <div className={styles.miniBarTrack}>
                                                <div className={styles.miniBarProceso} style={{ width: `${(g.totalTickets - g.cerrados) / (g.totalTickets || 1) * 100}%` }} />
                                                <div className={styles.miniBarCerrado} style={{ width: `${g.cerrados / (g.totalTickets || 1) * 100}%` }} />
                                            </div>
                                        </div>
                                        <div className={styles.gestoraKpisMini}>
                                            <div className={styles.miniKpi}>
                                                <label>Facturación</label>
                                                <strong>S/ {Math.round(g.facturacion).toLocaleString()}</strong>
                                            </div>
                                            <div className={styles.miniKpi}>
                                                <label>SLA</label>
                                                <strong style={{ color: (100 - g.ratioVencidos) > 90 ? '#10B981' : '#EF4444' }}>
                                                    {Math.round(100 - g.ratioVencidos)}%
                                                </strong>
                                            </div>
                                            <div className={styles.miniKpi}>
                                                <label>Promedio</label>
                                                <strong>{Math.round(g.avgTime)}h</strong>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* 📈 Gráficos de Gestión Gerencial */}
                        <div className={styles.analyticsVisualGrid}>
                            <div className={styles.analyticsMainCard}>
                                <div className={styles.chartHeader}>
                                    <h3>Productividad Comparativa por Gestor</h3>
                                    <p>Relación entre facturación y tickets resueltos</p>
                                </div>
                                <RevenueVolumeChart data={productivityByGestor} />
                            </div>
                            <div className={styles.analyticsSecondaryCard}>
                                <div className={styles.chartHeader}>
                                    <h3>Eficiencia vs SLA</h3>
                                    <p>Tiempos de respuesta y % de cumplimiento</p>
                                </div>
                                <EfficiencySLAChart data={productivityByGestor.map(g => ({
                                    ...g,
                                    tiempoPromedio: g.avgTime,
                                    cumplimientoSLA: 100 - g.ratioVencidos,
                                    totalTickets: g.totalTickets
                                }))} />
                            </div>
                        </div>

                        {/* 📑 Data Grid Detallado */}
                        <div className={styles.fullStatsTableCard}>
                            <div className={styles.cardHeaderExt}>
                                <div>
                                    <h3>Data Grid: Rendimiento Gerencial</h3>
                                    <p>Análisis exhaustivo del rendimiento individual de los gestores</p>
                                </div>
                                <div className={styles.tableFilterBadge}>{productivityByGestor.length} Gestoras Activas</div>
                            </div>
                            <div className={styles.tableResponsiveScroll}>
                                <table className={styles.premiumTableAnalytical}>
                                    <thead>
                                        <tr>
                                            <th onClick={() => handleSort('nombre')} className={styles.sortableHeader}>
                                                Gestor {sortConfig.key === 'nombre' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                                            </th>
                                            <th onClick={() => handleSort('totalTickets')} className={styles.sortableHeader}>
                                                Asignados {sortConfig.key === 'totalTickets' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                                            </th>
                                            <th onClick={() => handleSort('cerrados')} className={styles.sortableHeader}>
                                                Cerrados {sortConfig.key === 'cerrados' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                                            </th>
                                            <th onClick={() => handleSort('facturacion')} className={styles.sortableHeader}>
                                                Facturación (S/) {sortConfig.key === 'facturacion' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                                            </th>
                                            <th onClick={() => handleSort('rentabilidad')} className={styles.sortableHeader}>
                                                Utilidad (S/) {sortConfig.key === 'rentabilidad' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                                            </th>
                                            <th onClick={() => handleSort('avgTime')} className={styles.sortableHeader}>
                                                Tiempo Prom. {sortConfig.key === 'avgTime' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                                            </th>
                                            <th onClick={() => handleSort('ratioVencidos')} className={styles.sortableHeader}>
                                                % SLA {sortConfig.key === 'ratioVencidos' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {productivityByGestor.map((g, i) => (
                                            <tr key={i} className={styles.clickableAnalyticalRow} onClick={() => setSelectedGestoraId(g.id)}>
                                                <td className={styles.managerAnalyticalCell}>
                                                    <div className={styles.avatarMini} style={{ background: '#002A8F', color: 'white' }}>{g.nombre.charAt(0)}</div>
                                                    <strong>{g.nombre}</strong>
                                                </td>
                                                <td>{g.totalTickets}</td>
                                                <td>{g.cerrados}</td>
                                                <td>S/ {Math.round(g.facturacion).toLocaleString()}</td>
                                                <td className={g.rentabilidad < 0 ? styles.textDanger : styles.textSuccess}>
                                                    <strong>S/ {Math.round(g.rentabilidad).toLocaleString()}</strong>
                                                </td>
                                                <td>{Math.round(g.avgTime)}h</td>
                                                <td className={Math.round(100 - g.ratioVencidos) >= 90 ? styles.textSuccess : styles.textDanger}>
                                                    <div className={styles.slaMiniContainer}>
                                                        <div className={styles.slaValueText}>{Math.round(100 - g.ratioVencidos)}%</div>
                                                        <div className={styles.slaProgressBars}>
                                                            <div className={styles.slaBarTrack}>
                                                                <div className={styles.slaBarFill} style={{ 
                                                                    width: `${Math.round(100 - g.ratioVencidos)}%`,
                                                                    background: (100 - g.ratioVencidos) > 90 ? '#10B981' : (100 - g.ratioVencidos) > 70 ? '#F59E0B' : '#EF4444'
                                                                }} />
                                                            </div>
                                                        </div>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
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
                                <FinancialScatterChart data={profitabilityByClient.map(c => ({
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
