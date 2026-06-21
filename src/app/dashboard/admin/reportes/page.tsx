"use client";

import { useState, useMemo, useEffect } from "react";
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
    Line, ComposedChart, ScatterChart, Scatter, ZAxis, Cell, AreaChart, Area
} from 'recharts';
import { 
    TrendingUp, TrendingDown, Users, Award, AlertTriangle,
    Clock, CheckCircle, XCircle, BarChart3, PieChart, Calendar,
    Download, Filter, User, DollarSign, ArrowUpRight, ArrowDownRight,
    Search, ChevronRight, Activity, Zap, ShieldAlert, Target, Save, 
    Percent, Gavel, FileText, Info, RefreshCcw, Layers, Map, Settings,
    Wallet, Receipt, Timer
} from "lucide-react";
import styles from "./reportes.module.css";
import { useAppData } from "@/lib/AppDataContext";
import { normalizeStateId, TICKET_STATES } from "@/lib/ticketStates";
import { round2 } from "@/lib/formatters";
import { calculateTicketFinances } from "@/lib/calculations";
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

// 📊 Gráfico Principal: Generado vs Gasto Operativo
const GeneratedVsExpenseChart = ({ data, type = "bar" }: { data: any[], type?: "bar" | "area" | "line" }) => {
    const renderChartContent = () => {
        const genStroke = "#6366f1"; // Indigo
        const expStroke = "#10B981"; // Emerald/Success

        if (type === "area") {
            return (
                <AreaChart data={data} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
                    <defs>
                        <linearGradient id="genGradientArea" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#6366f1" stopOpacity={0.4} />
                            <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="expGradientArea" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#10B981" stopOpacity={0.4} />
                            <stop offset="100%" stopColor="#10B981" stopOpacity={0} />
                        </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(226, 232, 240, 0.4)" />
                    <XAxis 
                        dataKey="nombre" 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fill: '#64748B', fontSize: 10, fontWeight: 700 }}
                        dy={10}
                    />
                    <YAxis 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fill: '#64748B', fontSize: 11 }}
                        tickFormatter={(val) => `S/ ${val.toLocaleString()}`}
                    />
                    <Tooltip 
                        contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)', padding: '1rem', fontFamily: 'Inter, sans-serif' }}
                        formatter={(value: any, name: any) => [
                            `S/ ${Math.round(value).toLocaleString()}`,
                            name
                        ]}
                    />
                    <Legend verticalAlign="top" align="right" iconType="circle" iconSize={8} wrapperStyle={{ paddingBottom: 25 }} />
                    <Area type="monotone" dataKey="facturacion" name="Generado (S/)" fill="url(#genGradientArea)" stroke={genStroke} strokeWidth={2.5} />
                    <Area type="monotone" dataKey="inversion" name="Gasto Operativo (S/)" fill="url(#expGradientArea)" stroke={expStroke} strokeWidth={2.5} />
                </AreaChart>
            );
        }

        if (type === "line") {
            return (
                <ComposedChart data={data} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(226, 232, 240, 0.4)" />
                    <XAxis 
                        dataKey="nombre" 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fill: '#64748B', fontSize: 10, fontWeight: 700 }}
                        dy={10}
                    />
                    <YAxis 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fill: '#64748B', fontSize: 11 }}
                        tickFormatter={(val) => `S/ ${val.toLocaleString()}`}
                    />
                    <Tooltip 
                        contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)', padding: '1rem', fontFamily: 'Inter, sans-serif' }}
                        formatter={(value: any, name: any) => [
                            `S/ ${Math.round(value).toLocaleString()}`,
                            name
                        ]}
                    />
                    <Legend verticalAlign="top" align="right" iconType="circle" iconSize={8} wrapperStyle={{ paddingBottom: 25 }} />
                    <Line type="monotone" dataKey="facturacion" name="Generado (S/)" stroke={genStroke} strokeWidth={3} activeDot={{ r: 6 }} />
                    <Line type="monotone" dataKey="inversion" name="Gasto Operativo (S/)" stroke={expStroke} strokeWidth={3} activeDot={{ r: 6 }} />
                </ComposedChart>
            );
        }

        // Default: bar
        return (
            <BarChart data={data} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
                <defs>
                    <linearGradient id="genGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#4F46E5" stopOpacity={1} />
                        <stop offset="100%" stopColor="#312E81" stopOpacity={1} />
                    </linearGradient>
                    <linearGradient id="expGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#10B981" stopOpacity={1} />
                        <stop offset="100%" stopColor="#059669" stopOpacity={1} />
                    </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(226, 232, 240, 0.4)" />
                <XAxis 
                    dataKey="nombre" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: '#64748B', fontSize: 10, fontWeight: 700 }}
                    dy={10}
                />
                <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: '#64748B', fontSize: 11 }}
                    tickFormatter={(val) => `S/ ${val.toLocaleString()}`}
                />
                <Tooltip 
                    contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)', padding: '1rem', fontFamily: 'Inter, sans-serif' }}
                    cursor={{ fill: 'rgba(99, 102, 241, 0.04)' }}
                    formatter={(value: any, name: any) => [
                        `S/ ${Math.round(value).toLocaleString()}`,
                        name
                    ]}
                />
                <Legend verticalAlign="top" align="right" iconType="circle" iconSize={8} wrapperStyle={{ paddingBottom: 25 }} />
                <Bar dataKey="facturacion" name="Generado (S/)" fill="url(#genGradient)" radius={[6, 6, 0, 0]} barSize={35} />
                <Bar dataKey="inversion" name="Gasto Operativo (S/)" fill="url(#expGradient)" radius={[6, 6, 0, 0]} barSize={35} />
            </BarChart>
        );
    };

    return (
        <div style={{ width: '100%', height: 350 }}>
            <ResponsiveContainer>
                {renderChartContent()}
            </ResponsiveContainer>
        </div>
    );
};

// 📈 Gráfico Secundario: Utilidad Neta (Productividad Real)
const NetProfitChart = ({ data }: { data: any[] }) => (
    <div style={{ width: '100%', height: 350 }}>
        <ResponsiveContainer>
            <BarChart data={data} margin={{ top: 20, right: 30, bottom: 20, left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                <XAxis 
                    dataKey="nombre" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: '#64748B', fontSize: 10, fontWeight: 700 }}
                />
                <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: '#64748B', fontSize: 11 }}
                    tickFormatter={(val) => `S/ ${val.toLocaleString()}`}
                />
                <Tooltip 
                    contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)', padding: '1rem', fontFamily: 'Inter, sans-serif' }}
                    formatter={(value: any) => [`S/ ${Math.round(value).toLocaleString()}`, "Utilidad Neta"]}
                />
                <Legend verticalAlign="top" align="right" iconType="circle" />
                <Bar dataKey="rentabilidad" name="Utilidad Neta (S/)" radius={[6, 6, 0, 0]} barSize={45}>
                    {data.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.rentabilidad > 0 ? '#10B981' : '#EF4444'} />
                    ))}
                </Bar>
            </BarChart>
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
                <Scatter name="Clientes" data={data} fill="#0A1E5E">
                    {data.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.x > 0 ? '#10B981' : '#EF4444'} />
                    ))}
                </Scatter>
            </ScatterChart>
        </ResponsiveContainer>
    </div>
);

// Helper to get pastel colors for gestoras
const getPastelColor = (name: string) => {
    const lower = name.toLowerCase();
    if (lower.includes('francen') || lower.includes('valderrama')) {
        return '#A7F3D0'; // Verde menta pastel
    }
    if (lower.includes('janeth') || lower.includes('portocarrero')) {
        return '#BAE6FD'; // Azul cielo suave pastel
    }
    return '#E2E8F0'; // Default gray pastel
};

// 🎯 Goal Target Card (Admin View)
const GoalThermometer = ({ current, target, label }: { current: number, target: number, label: string }) => {
    const percent = Math.min((current / (target || 1)) * 100, 120);
    const isOverTarget = percent >= 100;
    const barColor = getPastelColor(label);
    
    return (
        <div className={styles.premiumThermometer} style={{
            background: '#FFFFFF',
            borderRadius: '1rem',
            border: '1px solid #E2E8F0',
            boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05), 0 2px 4px -1px rgba(0,0,0,0.035)',
            padding: '1.5rem',
            transition: 'all 0.3s ease'
        }}>
            <div className={styles.thermTitle}>
                <div className={styles.thermInfo}>
                    <h4 style={{ fontWeight: 800, color: '#0F172A' }}>{label}</h4>
                    <span className={isOverTarget ? styles.thermSuccess : styles.thermRunning}>
                        {isOverTarget ? "Meta Superada" : "En camino"}
                    </span>
                </div>
                <div className={styles.thermPercent} style={{ fontSize: '1.35rem', fontWeight: 900, color: '#0F172A' }}>{Math.round(percent)}%</div>
            </div>
            <div className={styles.thermTrack} style={{ background: '#F1F5F9', borderRadius: '20px', height: '10px', overflow: 'hidden' }}>
                <div 
                    style={{ 
                        width: `${Math.min(percent, 100)}%`, 
                        background: barColor, 
                        height: '100%',
                        borderRadius: '20px',
                        transition: 'width 0.8s cubic-bezier(0.4, 0, 0.2, 1)'
                    }} 
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
    const [adminChartType, setAdminChartType] = useState<"bar" | "area" | "line">("bar");

    // Estado para ordenamiento de la tabla
    const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' }>({ key: 'rentabilidad', direction: 'desc' });

    // 🎯 Filtrar Gestoras: Solo corporativas (@sinfimac.com) o Administradores
    const filteredGestoras = useMemo(() => {
        return gestoras.filter(g => {
            const email = (g.email || g.correo || "").toLowerCase();
            const role = (g.role || "").toLowerCase();
            const isAdmin = role === 'admin' || g.is_admin || g.id === 'admin';
            const isCorporate = email.endsWith('@sinfimac.pe');
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
                const finances = calculateTicketFinances(t, []); // En reporte masivo no tenemos costs individuales cargados aún, pero usamos la lógica unificada
                const billingGross = parseFloat(t.total_quoted_amount || t.montoFinal || 0);
                const billingNet = billingGross / 1.18;
                const inversion = (finances.totalLaborConfirmed + finances.totalOpConfirmed);
                
                return (billingNet - inversion) < -1;
            });

            if (negativeTickets.length > 0) {
                console.group("🚨 AUDITORÍA: TICKETS CON RENTABILIDAD NEGATIVA");
                negativeTickets.forEach(t => {
                    const finances = calculateTicketFinances(t, []);
                    const billingGross = parseFloat(t.total_quoted_amount || t.montoFinal || 0);
                    const billingNet = billingGross / 1.18;
                    const inversion = (finances.totalLaborConfirmed + finances.totalOpConfirmed);
                    console.warn(`Ticket: ${t.numeroTicketCliente || t.id} | Neto: S/ ${billingNet.toFixed(2)} | Inversión: S/ ${inversion.toFixed(2)} | ROI: S/ ${(billingNet - inversion).toFixed(2)}`);
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

            const finances = calculateTicketFinances(t, []); // Usar lógica centralizada
            
            // Montos Financieros - PRODUCTIVIDAD BRUTA CON 18% IGV (Tickets activos y cerrados, excepto cancelados/rechazados)
            if (sid !== 'ticket_cancelado' && sid !== 'ticket_rechazado') {
                const ingresoBruto = parseFloat(t.total_quoted_amount || t.montoFinal || 0);
                map[gid].facturacion += ingresoBruto;
            }
            map[gid].inversion += (finances.totalLaborConfirmed + finances.totalOpConfirmed);
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
                const ingresoNeto = parseFloat(t.ingresos_reales || 0) || (parseFloat(t.total_quoted_amount || t.montoFinal || 0) / 1.18);
                map[cid].billing += ingresoNeto;
            }
            
            const finances = calculateTicketFinances(t, []);
            map[cid].costs += (finances.totalLaborConfirmed + finances.totalOpConfirmed);
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

    // Computed KPI values — sourced from productivityByGestor for full consistency
    // (includes inversion + costoLaboral + activos, not just ticket-level costs)
    const totalFacturacion = productivityByGestor.reduce((s, g) => s + g.facturacion, 0);
    const totalInversion = productivityByGestor.reduce((s, g) => s + g.inversion, 0);
    const totalCostoLaboral = productivityByGestor.reduce((s, g) => s + g.costoLaboral, 0);
    const totalActivos = productivityByGestor.reduce((s, g) => s + g.activos, 0);
    const totalCostos = totalInversion + totalCostoLaboral + totalActivos;
    const totalUtilidad = totalFacturacion - totalCostos;
    const marginPercent = totalFacturacion > 0 ? Math.round((totalUtilidad / totalFacturacion) * 100) : 0;
    const avgTimeGlobal = Math.round(productivityByGestor.reduce((s, g) => s + g.avgTime, 0) / (productivityByGestor.length || 1));
    const totalTicketsGlobal = productivityByGestor.reduce((s, g) => s + g.totalTickets, 0);
    const totalCerradosGlobal = productivityByGestor.reduce((s, g) => s + g.cerrados, 0);
    const slaEffectiveness = Math.round(100 - (productivityByGestor.reduce((s, g) => s + g.ratioVencidos, 0) / (productivityByGestor.length || 1)));

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
                    <div className={styles.headerIconBox}><Layers size={22} /></div>
                    <div>
                        <h1 className={styles.hTitle}>Efficiency Intelligence</h1>
                        <p className={styles.hSubtitle}>Periodo: {currentMonthKey} — Vista Gerencial</p>
                    </div>
                </div>
                <div className={styles.headerControls}>
                    <div className={styles.gestoraFilterBox}>
                        <User size={15} className={styles.filterIcon} />
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
                    <button className={styles.actionBtnPrimary}><Download size={16} /> Exportar</button>
                </div>
            </header>

            {/* ═══ PASO 1: BARRA DE PESTAÑAS OPERATIVA ═══ */}
            <nav className={styles.modernTabNav}>
                <button className={selectedTab === 'productivity' ? styles.mTabActive : styles.mTab} onClick={() => setSelectedTab('productivity')}>
                    <Layers size={16} /> Control Operativo
                </button>
                <button className={selectedTab === 'bonuses' ? styles.mTabActive : styles.mTab} onClick={() => setSelectedTab('bonuses')}>
                    <Award size={16} /> Bonos Variables
                </button>
                <button className={selectedTab === 'profitability' ? styles.mTabActive : styles.mTab} onClick={() => setSelectedTab('profitability')}>
                    <Map size={16} /> Rentabilidad & Scatter
                </button>
                <button className={selectedTab === 'admin' ? styles.mTabActive : styles.mTab} onClick={() => setSelectedTab('admin')}>
                    <Settings size={16} /> Configurar Metas
                </button>
                <button className={selectedTab === 'risk' ? styles.mTabActive : styles.mTab} onClick={() => setSelectedTab('risk')}>
                    <AlertTriangle size={16} /> Auditoría {alerts.length > 0 && <span className={styles.badgeCount}>{alerts.length}</span>}
                </button>
            </nav>

            <div className={styles.dashboardContainer}>
                
                {selectedTab === 'productivity' && (
                    <div className={styles.productivityAnalyticsLayout}>
                        {/* ═══ PANEL EJECUTIVO DE KPIs — VISUAL RICO ═══ */}
                        <div className={styles.kpiExecutivePanel}>

                            {/* ── Tarjeta 1: FACTURACIÓN BRUTA (Hero Card) ── */}
                            <div className={styles.kpiHeroCard}>
                                <div className={styles.kpiHeroTop}>
                                    <div className={styles.kpiHeroIconWrap} style={{ background: 'linear-gradient(135deg, #0A1E5E, #1E3A8A)' }}>
                                        <DollarSign size={24} color="#fff" />
                                    </div>
                                    <div className={styles.kpiHeroLabel}>Facturación Bruta</div>
                                </div>
                                <div className={styles.kpiHeroValue}>S/ {Math.round(totalFacturacion).toLocaleString()}</div>
                                <div className={styles.kpiHeroSub}>Ingreso neto sin IGV del período</div>
                                {/* Visual: Distribución de tickets */}
                                <div className={styles.kpiHeroBar}>
                                    <div className={styles.kpiHeroBarLabels}>
                                        <span>{totalCerradosGlobal} cerrados</span>
                                        <span>{totalTicketsGlobal} total</span>
                                    </div>
                                    <div className={styles.kpiHeroBarTrack}>
                                        <div className={styles.kpiHeroBarFill} style={{ width: `${totalTicketsGlobal > 0 ? (totalCerradosGlobal / totalTicketsGlobal) * 100 : 0}%` }} />
                                    </div>
                                </div>
                            </div>

                            {/* ── Tarjeta 2: COSTO OPERATIVO (Desglose Visual) ── */}
                            <div className={styles.kpiCostCard}>
                                <div className={styles.kpiCostHeader}>
                                    <div className={styles.kpiHeroIconWrap} style={{ background: 'linear-gradient(135deg, #DC2626, #F87171)' }}>
                                        <Receipt size={24} color="#fff" />
                                    </div>
                                    <div>
                                        <div className={styles.kpiCostLabel}>Costo Operativo Total</div>
                                        <div className={styles.kpiCostValue}>S/ {Math.round(totalCostos).toLocaleString()}</div>
                                    </div>
                                </div>
                                {/* Desglose gráfico de costos */}
                                <div className={styles.kpiCostBreakdown}>
                                    <div className={styles.kpiCostRow}>
                                        <div className={styles.kpiCostRowInfo}>
                                            <span className={styles.kpiCostDot} style={{ background: '#EF4444' }} />
                                            <span>Inversión en Tickets</span>
                                        </div>
                                        <strong>S/ {Math.round(totalInversion).toLocaleString()}</strong>
                                    </div>
                                    <div className={styles.kpiCostBarMini}>
                                        <div style={{ width: `${totalCostos > 0 ? (totalInversion / totalCostos) * 100 : 0}%`, background: '#EF4444' }} />
                                    </div>
                                    <div className={styles.kpiCostRow}>
                                        <div className={styles.kpiCostRowInfo}>
                                            <span className={styles.kpiCostDot} style={{ background: '#F59E0B' }} />
                                            <span>Costo Laboral</span>
                                        </div>
                                        <strong>S/ {Math.round(totalCostoLaboral).toLocaleString()}</strong>
                                    </div>
                                    <div className={styles.kpiCostBarMini}>
                                        <div style={{ width: `${totalCostos > 0 ? (totalCostoLaboral / totalCostos) * 100 : 0}%`, background: '#F59E0B' }} />
                                    </div>
                                    <div className={styles.kpiCostRow}>
                                        <div className={styles.kpiCostRowInfo}>
                                            <span className={styles.kpiCostDot} style={{ background: '#94A3B8' }} />
                                            <span>Activos Asignados</span>
                                        </div>
                                        <strong>S/ {Math.round(totalActivos).toLocaleString()}</strong>
                                    </div>
                                    <div className={styles.kpiCostBarMini}>
                                        <div style={{ width: `${totalCostos > 0 ? (totalActivos / totalCostos) * 100 : 0}%`, background: '#94A3B8' }} />
                                    </div>
                                </div>
                            </div>

                            {/* ── Tarjeta 3: MARGEN DE UTILIDAD REAL (Gauge Circular) ── */}
                            <div className={styles.kpiGaugeCard}>
                                <div className={styles.kpiGaugeHeader}>Margen de Utilidad Real</div>
                                <div className={styles.kpiGaugeBody}>
                                    {/* SVG Circular Gauge */}
                                    <div className={styles.kpiGaugeRing}>
                                        <svg viewBox="0 0 120 120" className={styles.kpiGaugeSvg}>
                                            <circle cx="60" cy="60" r="52" fill="none" stroke="#F1F5F9" strokeWidth="10" />
                                            <circle 
                                                cx="60" cy="60" r="52" fill="none" 
                                                stroke={totalUtilidad >= 0 ? '#10B981' : '#EF4444'}
                                                strokeWidth="10" 
                                                strokeLinecap="round"
                                                strokeDasharray={`${Math.min(Math.abs(marginPercent), 100) * 3.267} 326.7`}
                                                transform="rotate(-90 60 60)"
                                                className={styles.kpiGaugeArc}
                                            />
                                        </svg>
                                        <div className={styles.kpiGaugeCenterText}>
                                            <span className={styles.kpiGaugePercent} style={{ color: totalUtilidad >= 0 ? '#059669' : '#DC2626' }}>
                                                {marginPercent}%
                                            </span>
                                            <span className={styles.kpiGaugeSubtext}>margen</span>
                                        </div>
                                    </div>
                                    <div className={styles.kpiGaugeDetails}>
                                        <div className={styles.kpiGaugeDetailRow}>
                                            <span>Utilidad Neta</span>
                                            <strong style={{ color: totalUtilidad >= 0 ? '#059669' : '#DC2626' }}>
                                                S/ {Math.round(totalUtilidad).toLocaleString()}
                                            </strong>
                                        </div>
                                        <div className={styles.kpiGaugeDivider} />
                                        <div className={styles.kpiGaugeDetailRow}>
                                            <span>Facturación</span>
                                            <strong>S/ {Math.round(totalFacturacion).toLocaleString()}</strong>
                                        </div>
                                        <div className={styles.kpiGaugeDetailRow}>
                                            <span>(-) Costos</span>
                                            <strong style={{ color: '#DC2626' }}>S/ {Math.round(totalCostos).toLocaleString()}</strong>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* ── Tarjeta 4: TIEMPO & SLA (Doble Indicador) ── */}
                            <div className={styles.kpiTimeCard}>
                                <div className={styles.kpiTimeSection}>
                                    <div className={styles.kpiTimeIcon}>
                                        <Timer size={20} />
                                    </div>
                                    <div className={styles.kpiTimeInfo}>
                                        <label>Tiempo Promedio</label>
                                        <strong style={{ color: avgTimeGlobal <= 48 ? '#059669' : avgTimeGlobal <= 72 ? '#B45309' : '#DC2626' }}>
                                            {avgTimeGlobal}h
                                        </strong>
                                    </div>
                                    <div className={styles.kpiTimeBadge} style={{ 
                                        background: avgTimeGlobal <= 48 ? '#ECFDF5' : avgTimeGlobal <= 72 ? '#FFFBEB' : '#FEF2F2',
                                        color: avgTimeGlobal <= 48 ? '#059669' : avgTimeGlobal <= 72 ? '#B45309' : '#DC2626'
                                    }}>
                                        {avgTimeGlobal <= 48 ? 'Óptimo' : avgTimeGlobal <= 72 ? 'Alerta' : 'Crítico'}
                                    </div>
                                </div>
                                <div className={styles.kpiTimeDivider} />
                                <div className={styles.kpiTimeSection}>
                                    <div className={styles.kpiTimeIcon} style={{ background: slaEffectiveness >= 90 ? '#ECFDF5' : '#FEF2F2', color: slaEffectiveness >= 90 ? '#059669' : '#DC2626' }}>
                                        <ShieldAlert size={20} />
                                    </div>
                                    <div className={styles.kpiTimeInfo}>
                                        <label>Efectividad SLA</label>
                                        <strong style={{ color: slaEffectiveness >= 90 ? '#059669' : slaEffectiveness >= 70 ? '#B45309' : '#DC2626' }}>
                                            {slaEffectiveness}%
                                        </strong>
                                    </div>
                                </div>
                                {/* Visual: SLA bar */}
                                <div className={styles.kpiSlaVisualBar}>
                                    <div className={styles.kpiSlaBarTrack}>
                                        <div className={styles.kpiSlaBarFill} style={{ 
                                            width: `${slaEffectiveness}%`,
                                            background: slaEffectiveness >= 90 ? 'linear-gradient(90deg, #10B981, #34D399)' : slaEffectiveness >= 70 ? 'linear-gradient(90deg, #F59E0B, #FBBF24)' : 'linear-gradient(90deg, #EF4444, #F87171)'
                                        }} />
                                        <div className={styles.kpiSlaTarget} />
                                    </div>
                                    <div className={styles.kpiSlaLabels}>
                                        <span>0%</span>
                                        <span style={{ color: '#0A1E5E', fontWeight: 800 }}>Meta: 90%</span>
                                        <span>100%</span>
                                    </div>
                                </div>
                            </div>

                        </div>

                        {/* ═══ PASO 3: RENDIMIENTO INDIVIDUAL DE GESTORAS ═══ */}
                        <div className={styles.gestorasOverviewSection}>
                            <div className={styles.sectionHeaderExt}>
                                <h3>Rendimiento Individual de Gestoras</h3>
                                <p>Distribución de carga y efectividad por responsable</p>
                            </div>
                            <div className={styles.gestorasGridPermanent}>
                                {productivityByGestor.map((g, i) => {
                                    const progressColor = getPastelColor(g.nombre);
                                    const isBonusUnlocked = g.bonoValido && g.percentMeta >= 80;
                                    return (
                                        <div 
                                            key={i} 
                                            className={styles.gestoraActionCard} 
                                            onClick={() => setSelectedGestoraId(g.id)}
                                            style={{
                                                background: '#FFFFFF',
                                                borderRadius: '1rem',
                                                border: '1px solid #E2E8F0',
                                                boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05), 0 2px 4px -1px rgba(0,0,0,0.035)',
                                                padding: '1.25rem 1.5rem',
                                                transition: 'all 0.3s ease',
                                                display: 'flex',
                                                flexDirection: 'column',
                                                gap: '1rem',
                                                position: 'relative'
                                            }}
                                        >
                                            <div className={styles.gestoraCardHeader}>
                                                <div className={styles.gestoraAvatar} style={{ background: progressColor, color: '#1E293B' }}>{g.nombre.charAt(0)}</div>
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
                                                <div className={styles.miniBarTrack} style={{ background: '#F1F5F9', height: '8px', borderRadius: '20px' }}>
                                                    <div style={{
                                                        width: `${g.cerrados / (g.totalTickets || 1) * 100}%`,
                                                        background: progressColor,
                                                        height: '100%',
                                                        borderRadius: '20px',
                                                        transition: 'width 0.6s ease'
                                                    }} />
                                                </div>
                                            </div>
                                            <div className={styles.gestoraKpisMini}>
                                                <div className={styles.miniKpi}>
                                                    <label>Facturación</label>
                                                    <strong>S/ {Math.round(g.facturacion).toLocaleString()}</strong>
                                                </div>
                                                <div className={styles.miniKpi}>
                                                    <label>Velocidad</label>
                                                    <strong style={{ color: g.avgTime <= 48 ? '#10B981' : g.avgTime <= 72 ? '#F59E0B' : '#EF4444' }}>
                                                        {Math.round(g.avgTime)}h
                                                    </strong>
                                                </div>
                                                <div className={styles.miniKpi}>
                                                    <label>Utilidad</label>
                                                    <strong style={{ color: g.rentabilidad >= 0 ? '#10B981' : '#EF4444' }}>
                                                        S/ {Math.round(g.rentabilidad).toLocaleString()}
                                                    </strong>
                                                </div>
                                            </div>
                                            {/* Elegant Bono Proyectado badge at card bottom */}
                                            <div style={{
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                alignItems: 'center',
                                                paddingTop: '0.75rem',
                                                borderTop: '1px solid #F1F5F9',
                                                fontSize: '0.8rem'
                                            }}>
                                                <span style={{ color: '#64748B', fontWeight: 600 }}>Bono Proyectado:</span>
                                                <span style={isBonusUnlocked ? {
                                                    color: '#10B981',
                                                    fontWeight: 800,
                                                    background: 'rgba(16, 185, 129, 0.08)',
                                                    border: '1px solid rgba(16, 185, 129, 0.15)',
                                                    padding: '2px 8px',
                                                    borderRadius: '6px'
                                                } : {
                                                    color: '#94A3B8',
                                                    fontWeight: 600,
                                                    background: '#F1F5F9',
                                                    padding: '2px 8px',
                                                    borderRadius: '6px'
                                                }}>
                                                    S/ {Math.round(g.bonoProyectado).toLocaleString()}
                                                </span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* 📈 Gráficos de Gestión Gerencial */}
                        <div className={styles.analyticsVisualGrid}>
                            <div className={styles.analyticsMainCard}>
                                <div className={styles.chartHeader} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                                    <div>
                                        <h3>Generado vs Gasto Operativo por Gestora</h3>
                                        <p>Comparativa de facturación neta vs inversión en tickets</p>
                                    </div>
                                    <div style={{ display: 'flex', background: 'var(--ei-background)', padding: '4px', borderRadius: '10px', border: '1px solid var(--ei-border)' }}>
                                        {(["bar", "area", "line"] as const).map((t) => (
                                            <button
                                                key={t}
                                                onClick={() => setAdminChartType(t)}
                                                style={{
                                                    padding: '0.4rem 0.8rem',
                                                    borderRadius: '8px',
                                                    border: 'none',
                                                    cursor: 'pointer',
                                                    fontSize: '0.75rem',
                                                    fontWeight: 700,
                                                    transition: 'all 0.2s',
                                                    background: adminChartType === t ? 'var(--ei-surface)' : 'transparent',
                                                    color: adminChartType === t ? 'var(--ei-primary-light)' : 'var(--ei-text-muted)',
                                                    boxShadow: adminChartType === t ? 'var(--ei-shadow-sm)' : 'none'
                                                }}
                                            >
                                                {t === "bar" ? "Barras" : t === "area" ? "Área" : "Líneas"}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <GeneratedVsExpenseChart data={productivityByGestor} type={adminChartType} />
                            </div>
                            <div className={styles.analyticsSecondaryCard}>
                                <div className={styles.chartHeader}>
                                    <h3>Productividad Neta (Margen Real)</h3>
                                    <p>Utilidad generada tras descontar inversión operativa</p>
                                </div>
                                <NetProfitChart data={productivityByGestor} />
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
                                                Velocidad {sortConfig.key === 'avgTime' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
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
                                                    <div className={styles.avatarMini}>{g.nombre.charAt(0)}</div>
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
                                    {productivityByGestor.map((g, i) => {
                                        const isBonusUnlocked = g.bonoValido && g.percentMeta >= 80;
                                        return (
                                            <div key={i} className={styles.bonusItemRow} style={{
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                alignItems: 'center',
                                                padding: '1rem',
                                                background: isBonusUnlocked ? 'rgba(16, 185, 129, 0.04)' : '#F9FAFB',
                                                border: isBonusUnlocked ? '1px solid rgba(16, 185, 129, 0.15)' : '1px solid #E2E8F0',
                                                borderRadius: '12px',
                                                marginBottom: '0.75rem',
                                                transition: 'all 0.3s ease'
                                            }}>
                                                <div className={styles.bMngr}>
                                                    <strong style={{ display: 'block', color: '#0F172A', fontWeight: 700 }}>{g.nombre}</strong>
                                                    <span style={{ fontSize: '0.75rem', color: '#64748B' }}>Sueldo Base: S/ {g.costoLaboral}</span>
                                                </div>
                                                <div className={styles.bCalc} style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                                                    <label style={{ fontSize: '0.7rem', color: '#64748B', textTransform: 'uppercase', fontWeight: 600 }}>Bono Proyectado</label>
                                                    <strong style={{ fontSize: '1.1rem', color: isBonusUnlocked ? '#10B981' : '#0F172A', fontWeight: 800 }}>
                                                        S/ {Math.round(g.bonoProyectado).toLocaleString()}
                                                    </strong>
                                                </div>
                                                <div className={styles.bStatus} style={{ display: 'flex', alignItems: 'center' }}>
                                                    {g.bonoValido ? <CheckCircle size={20} color="#10B981" /> : <AlertTriangle size={20} color="#F59E0B" />}
                                                </div>
                                            </div>
                                        );
                                    })}
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
                                    <div>
                                        <h3>Análisis de Dispersión</h3>
                                        <p>Rentabilidad Neta vs Inversión en Especialistas</p>
                                    </div>
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
                            <div>
                                <h3>Configuración Central de Metas Mensuales</h3>
                                <p>Periodo de evaluación: {currentMonthKey}</p>
                            </div>
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
                                                <small style={{display:'block', color:'#94A3B8', fontSize:'0.75rem'}}>{g.id.substring(0,8)}</small>
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
                                            {a.severity === 'critical' ? <ShieldAlert size={28} /> : <AlertTriangle size={28} />}
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
