"use client";

export const dynamic = "force-dynamic";

import { useState, useMemo, useEffect, useRef } from "react";

import {
    DollarSign, TrendingUp, AlertTriangle, Users, CheckCircle2,
    Zap, ArrowRight, BarChart3, Target, Activity, Shield,
    ChevronRight, AlertCircle, Star, Layers,
    BanknoteIcon, Award
} from "lucide-react";
import {
    ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
    PieChart, Pie, Cell, LabelList
} from 'recharts';
import Link from "next/link";
import { useAppData } from "@/lib/AppDataContext";
import { normalizeStateId } from "@/lib/ticketStates";
import { SERVICE_TYPES } from "@/lib/serviceTypes";
import { supabase } from "@/lib/supabase";
import TicketWindow from "./tickets/TicketWindow";
import { calculateTicketFinances, calculateAccountsReceivable, calculateWIP, calculateEBITDA } from "@/lib/calculations";

// ── Helpers ──────────────────────────────────
const SLA_HOURS = 72;
function hoursAgo(d: string) { return (Date.now() - new Date(d).getTime()) / 3_600_000; }
function fmt(n: number) { return n.toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function fmtInt(n: number) { return n.toLocaleString("es-PE"); }
const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

// Estado de semáforo global
type Light = "VERDE" | "AMBAR" | "ROJO";
function semaforo(conditions: { test: boolean; level: Light }[]): Light {
    if (conditions.some(c => c.level === "ROJO" && c.test)) return "ROJO";
    if (conditions.some(c => c.level === "AMBAR" && c.test)) return "AMBAR";
    return "VERDE";
}

// ── MÓDULO 1: KPI ROI Card ──────────────────
function RoiCard({ label, value, sub, color, icon: Icon, light, onClick }: any) {
    const lightColor = light === "ROJO" ? "#EF4444" : light === "AMBAR" ? "#F59E0B" : "#10B981";
    return (
        <div 
            onClick={onClick}
            style={{
                background: "linear-gradient(135deg,rgba(255,255,255,0.04) 0%,rgba(255,255,255,0.01) 100%)",
                border: `1px solid ${lightColor}30`,
                borderRadius: "16px", padding: "1.4rem 1.5rem",
                display: "flex", flexDirection: "column", gap: "0.5rem",
                boxShadow: `0 4px 20px ${lightColor}10`,
                position: "relative", overflow: "hidden",
                cursor: onClick ? "pointer" : "default",
                transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
            }}
            onMouseEnter={e => {
                if (onClick) {
                    e.currentTarget.style.transform = "translateY(-4px)";
                    e.currentTarget.style.background = "linear-gradient(135deg,rgba(255,255,255,0.08) 0%,rgba(255,255,255,0.02) 100%)";
                    e.currentTarget.style.borderColor = `${lightColor}60`;
                    e.currentTarget.style.boxShadow = `0 8px 30px ${lightColor}20`;
                }
            }}
            onMouseLeave={e => {
                if (onClick) {
                    e.currentTarget.style.transform = "translateY(0)";
                    e.currentTarget.style.background = "linear-gradient(135deg,rgba(255,255,255,0.04) 0%,rgba(255,255,255,0.01) 100%)";
                    e.currentTarget.style.borderColor = `${lightColor}30`;
                    e.currentTarget.style.boxShadow = `0 4px 20px ${lightColor}10`;
                }
            }}
        >
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "3px", background: lightColor }} />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div style={{ width: "38px", height: "38px", borderRadius: "10px", background: `${color}18`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Icon size={18} color={color} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                    <span style={{ fontSize: "0.65rem", fontWeight: 800, padding: "2px 8px", borderRadius: "999px", background: `${lightColor}18`, color: lightColor, border: `1px solid ${lightColor}30` }}>
                        {light}
                    </span>
                    {onClick && <span style={{ fontSize: '0.55rem', fontWeight: 800, color: 'rgba(255,255,255,0.2)', letterSpacing: '0.05em' }}>VER MÁS</span>}
                </div>
            </div>
            <div style={{ fontSize: "1.75rem", fontWeight: 900, color: "white", letterSpacing: "-0.5px", lineHeight: 1 }}>{value}</div>
            <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: "0.5px" }}>{label}</div>
            {sub && <div style={{ fontSize: "0.71rem", color: "rgba(255,255,255,0.35)" }}>{sub}</div>}
        </div>
    );
}

// ── Aging Row ───────────────────────────────
function AgingRow({ label, count, amount, color, onClick }: { label: string; count: number; amount: number; color: string; onClick?: () => void }) {
    return (
        <div 
            onClick={onClick}
            style={{ 
                display: "flex", alignItems: "center", gap: "0.75rem", padding: "0.6rem 0.9rem", borderRadius: "10px", 
                background: `${color}08`, border: `1px solid ${color}20`,
                cursor: onClick ? "pointer" : "default", transition: "all 0.2s"
            }}
            onMouseEnter={e => { if (onClick) { (e.currentTarget as HTMLElement).style.background = `${color}15`; (e.currentTarget as HTMLElement).style.borderColor = `${color}45`; } }}
            onMouseLeave={e => { if (onClick) { (e.currentTarget as HTMLElement).style.background = `${color}08`; (e.currentTarget as HTMLElement).style.borderColor = `${color}20`; } }}
        >
            <span style={{ width: "10px", height: "10px", borderRadius: "50%", background: color, flexShrink: 0, display: "block" }} />
            <span style={{ flex: 1, fontSize: "0.8rem", color: "rgba(255,255,255,0.7)", fontWeight: 600 }}>{label}</span>
            <span style={{ fontSize: "0.78rem", fontWeight: 800, color, minWidth: "24px", textAlign: "right" }}>{count}</span>
            <span style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.4)" }}>S/ {fmt(amount)}</span>
        </div>
    );
}

// ── Gauge Semi-circle (SVG puro) ────────────
function GaugeMini({ pct, label }: { pct: number; label: string }) {
    const r = 48, cx = 60, cy = 60;
    const circ = Math.PI * r;
    const offset = circ * (1 - Math.min(pct, 100) / 100);
    const col = pct >= 85 ? "#10B981" : pct >= 70 ? "#F59E0B" : "#EF4444";
    return (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.25rem" }}>
            <svg width="120" height="72" viewBox="0 0 120 72">
                <path d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="10" strokeLinecap="round" />
                <path d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`} fill="none" stroke={col} strokeWidth="10" strokeLinecap="round"
                    strokeDasharray={circ} strokeDashoffset={offset} style={{ transition: "stroke-dashoffset 1.2s ease" }} />
                <text x={cx} y={cy - 4} textAnchor="middle" fontSize="18" fontWeight="900" fill={col}>{Math.round(pct)}%</text>
            </svg>
            <span style={{ fontSize: "0.7rem", color: "rgba(255,255,255,0.45)", fontWeight: 600, textTransform: "uppercase" }}>{label}</span>
        </div>
    );
}

// ── Carga por gestora bar ────────────────────
function GestoraBar({ name, count, max, color }: any) {
    const pct = max > 0 ? (count / max) * 100 : 0;
    const stress = count > 8 ? "#EF4444" : count > 5 ? "#F59E0B" : "#10B981";
    return (
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <div style={{ width: "30px", height: "30px", borderRadius: "50%", background: "linear-gradient(135deg,#8B5CF6,#6366F1)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.72rem", fontWeight: 800, color: "white", flexShrink: 0 }}>
                {(name || "?")[0].toUpperCase()}
            </div>
            <div style={{ flex: 1 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.76rem", marginBottom: "3px" }}>
                    <span style={{ fontWeight: 600, color: "rgba(255,255,255,0.8)" }}>{name}</span>
                    <span style={{ fontWeight: 800, color: stress }}>{count} tickets</span>
                </div>
                <div style={{ height: "6px", background: "rgba(255,255,255,0.07)", borderRadius: "999px", overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${pct}%`, background: stress, borderRadius: "999px", transition: "width 0.8s ease" }} />
                </div>
            </div>
        </div>
    );
}

// ════════════════════════════════════════════
// MAIN EXECUTIVE DASHBOARD
// ════════════════════════════════════════════
export default function AdminDashboard() {
    const { tickets = [], loadingTickets, technicians, gestoras = [], updateTicket, refreshTickets } = useAppData();
    const [dateRange, setDateRange] = useState<"today" | "week" | "month" | "all">("month");
    const [now] = useState(() => new Date());
    const [isMounted, setIsMounted] = useState(false);
    const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
    const [toast, setToast] = useState<{ title: string; desc: string } | null>(null);
    const [realtimeOverrides, setRealtimeOverrides] = useState<Record<string, any>>({});
    
    // CFO Metrics State
    const [invoices, setInvoices] = useState<any[]>([]);
    const [expenses, setExpenses] = useState<any[]>([]);
    const [showOpexForm, setShowOpexForm] = useState(false);
    const [newOpex, setNewOpex] = useState({ category: 'ALQUILER', amount: '', description: '' });

    const triggerToast = (title: string, desc: string) => {
        setToast({ title, desc });
        setTimeout(() => {
            setToast(null);
        }, 6000);
    };

    const activeTickets = useMemo(() => {
        if (Object.keys(realtimeOverrides).length === 0) return tickets;
        return tickets.map((t: any) => {
            const ovr = Object.entries(realtimeOverrides).find(([key]) => 
                t.id === key || t.client_ticket_number === key || t.codigo === key
            );
            if (ovr) {
                return { ...t, ...ovr[1] };
            }
            return t;
        });
    }, [tickets, realtimeOverrides]);

    useEffect(() => {
        if (!isMounted) return;

        const channel = supabase.channel('realtime:dashboard_metrics');

        channel.on('broadcast', { event: 'ticket_closed_balance_zero' }, (payload: any) => {
            const data = payload.payload;
            if (!data) return;

            const ticketId = data.id || data.codigo_ticket;
            setRealtimeOverrides(prev => ({
                ...prev,
                [ticketId]: {
                    status_id: 'ticket_cerrado',
                    estadoId: 'ticket_cerrado',
                    fechaCierre: new Date().toISOString(),
                    saldo_tecnico: 0,
                    metadata: {
                        saldo_tecnico: 0,
                        netLaborBalance: 0
                    }
                }
            }));

            triggerToast(
                "💻 CORPFLOW VIGILANCIA",
                `¡Ticket ${data.codigo_ticket} Auditado y Cerrado! El Dashboard global se ha actualizado con los nuevos montos en deuda cero de forma consistente y real.`
            );
        });

        channel.subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [isMounted]);

    // Hydration guard
    useEffect(() => { setIsMounted(true); }, []);

    // Fetch CFO Data
    useEffect(() => {
        if (!isMounted) return;
        const fetchCFOData = async () => {
            const { data: invData } = await supabase.from('invoices').select('*');
            const { data: expData } = await supabase.from('company_expenses').select('*').eq('is_active', true);
            if (invData) setInvoices(invData);
            if (expData) setExpenses(expData);
        };
        fetchCFOData();
    }, [isMounted, lastRefresh]);

    // ⚡ FIX (2026-06-13): Estabilizar la referencia de refreshTickets con useRef
    // para cortar el bucle de invalidaciones cruzadas en el Dashboard Estratégico.
    //
    // DIAGNÓSTICO DE CAUSA RAÍZ:
    //   refreshTickets() se recrea en cada render de AppDataContext.tsx.
    //   Al incluirlo como dependencia del useEffect del intervalo, cada re-render
    //   del contexto limpia y recrea el setInterval, disparando una llamada
    //   prematura a refreshTickets() que invalida summary + payments, lo que
    //   provoca GETs en cascada a vw_tickets_strategic y /api/v3/ticket-costs.
    //
    // SOLUCIÓN: useRef estable → el intervalo NO se recrea cuando cambia la referencia.
    const refreshTicketsRef = useRef(refreshTickets);
    useEffect(() => { refreshTicketsRef.current = refreshTickets; }, [refreshTickets]);

    useEffect(() => {
        if (!isMounted) return;
        const interval = setInterval(async () => {
            try {
                // Llamar vía ref estable: el intervalo no se recrea al cambiar la referencia
                await refreshTicketsRef.current();
                setLastRefresh(new Date());
            } catch (e) {
                // silent retry next cycle
            }
        }, 60_000); // 60 segundos — backup solo para reconexiones/edge cases
        return () => clearInterval(interval);
    // ⚡ SOLO isMounted: el intervalo se crea UNA vez al montar y no se vuelve a crear.
    // refreshTickets siempre se lee fresco desde refreshTicketsRef.current.
    }, [isMounted]);
    
    // Proteger gestoras contra undefined
    const safeGestoras = Array.isArray(gestoras) ? gestoras : [];
    const gestorasMap = new Map(safeGestoras.map((g: any) => [g.id, g]));
    


    // Estados para el Modal de Seguimiento (General)
    const [showListModal, setShowListModal] = useState(false);
    const [modalTitle, setModalTitle] = useState("");
    const [modalTickets, setModalTickets] = useState<any[]>([]);

    // Estado para el Modal de Capital Expuesto
    const [showCapitalModal, setShowCapitalModal] = useState(false);
    const [selectedTicket, setSelectedTicket] = useState<any>(null);

    // Handler para actualizar tickets desde el modal (Dashboard Admin)
    const handleUpdateTicket = async (id: string, updates: any) => {
        try {
            const result = await updateTicket(id, updates);
            return result;
        } catch (err) {
            console.error("Error updating ticket from dashboard:", err);
            throw err;
        }
    };

    const handleAddExpense = async (e: React.FormEvent) => {
        e.preventDefault();
        const amt = parseFloat(newOpex.amount);
        if (isNaN(amt) || amt <= 0) return;
        
        try {
            const { data, error } = await supabase.from('company_expenses').insert([{
                category: newOpex.category,
                amount: amt,
                description: newOpex.description,
                is_active: true
            }]).select('*');
            if (error) throw error;
            if (data && data.length > 0) {
                setExpenses(prev => [...prev, data[0]]);
                setNewOpex({ category: 'ALQUILER', amount: '', description: '' });
                setShowOpexForm(false);
                triggerToast("OPEX Registrado", `Gasto de S/ ${amt} añadido a ${newOpex.category}.`);
            }
        } catch (error) {
            console.error("Error adding expense:", error);
            triggerToast("Error", "No se pudo registrar el gasto.");
        }
    };

    // ── Rango de Fechas para Métricas Globales (Cash Flow) ──
    const rangeDates = useMemo(() => {
        const end = new Date();
        const start = new Date();
        if (dateRange === "today") {
            start.setHours(0, 0, 0, 0);
        } else if (dateRange === "week") {
            const day = start.getDay() || 7;
            start.setDate(start.getDate() - (day - 1));
            start.setHours(0, 0, 0, 0);
        } else if (dateRange === "month") {
            start.setDate(1);
            start.setHours(0, 0, 0, 0);
        } else {
            start.setFullYear(2020);
        }
        return { start: start.toISOString(), end: end.toISOString() };
    }, [dateRange]);


    const getStartOfPeriod = (range: string, baseDate: Date): Date => {
        if (range === "today") {
            return new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate());
        }
        if (range === "week") {
            const startOfWeek = new Date(baseDate);
            const day = startOfWeek.getDay() || 7;
            startOfWeek.setDate(startOfWeek.getDate() - (day - 1));
            startOfWeek.setHours(0, 0, 0, 0);
            return startOfWeek;
        }
        if (range === "month") {
            return new Date(baseDate.getFullYear(), baseDate.getMonth(), 1);
        }
        return new Date(2020, 0, 1);
    };

    const startOfPeriod = useMemo(() => getStartOfPeriod(dateRange, now), [dateRange, now]);

    const isInRange = (dateStr: string | null | undefined) => {
        if (!dateStr) return false;
        if (dateRange === "all") return true;
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return false;
        return d >= startOfPeriod;
    };

    // ─── Helper puro: inversión confirmada de un ticket ──────────────────────
    // Fuente: Motor Financiero V3 (ticket_costs). Fallback a vista SQL si costos vacíos.
    const ticketInversion = (t: any): number => {
        const costs: any[] = Array.isArray(t.costos) ? t.costos : [];
        if (costs.length === 0)
            return parseFloat(t.inversion_ejecutada ?? t.total_costs_agg ?? 0);
        // Retorna el Cash Out Real
        return calculateTicketFinances(t, costs).totalExpenses;
    };

    const ticketUtilidad = (t: any): number => {
        const costs: any[] = Array.isArray(t.costos) ? t.costos : [];
        if (costs.length === 0)
            return parseFloat(t.rentabilidad ?? 0);
        // Retorna el Accrual Basis (Toma en cuenta la deuda con el técnico)
        return calculateTicketFinances(t, costs).realProfitability;
    };

    // Identificar si un ticket es de arrastre (abierto de periodos anteriores)
    const isRolledOver = (t: any) => {
        const sid = normalizeStateId(t.status_id ?? t.estadoId);
        const isClosed = ["ticket_cerrado", "ticket_rechazado", "ticket_cancelado"].includes(sid);
        if (isClosed) return false;

        const created = t.original_created_at ?? t.created_at ?? t.createdAt ?? t.fechaCreacion;
        if (!created) return false;
        
        const origDate = new Date(created);
        return origDate < startOfPeriod;
    };

    // Filtro de periodo robusto que incluye los tickets en rango y los arrastrados
    const isTicketInPeriod = (t: any) => {
        if (isInRange(t.created_at ?? t.createdAt ?? t.fechaCreacion)) return true;
        if (t.closure_date && isInRange(t.closure_date)) return true;
        return isRolledOver(t);
    };

    // ── MÓDULO 1: Rentabilidad / ROI (SIN IGV) ───────────────────────────────
    const roi = useMemo(() => {
        const inPeriod = activeTickets.filter((t: any) => isTicketInPeriod(t));

        let ingresosSum = 0;
        let inversionSum = 0;
        let utilidadSum = 0;
        let costosArrastradosSum = 0;
        
        const closed: any[] = [];
        const arrastradoItems: any[] = [];

        inPeriod.forEach((t: any) => {
            const inv = ticketInversion(t);
            inversionSum += inv;

            const isClosed = normalizeStateId(t.status_id ?? t.estadoId) === "ticket_cerrado";
            if (isClosed) {
                closed.push(t);
                ingresosSum += parseFloat(t.ingresos_reales ?? 0);
                utilidadSum += ticketUtilidad(t);
            }

            if (isRolledOver(t)) {
                arrastradoItems.push(t);
                costosArrastradosSum += inv;
            }
        });

        const ingresos = round2(ingresosSum);
        const inversion = round2(inversionSum);
        const utilidad = round2(utilidadSum);
        const margen = ingresos > 0 ? (utilidad / ingresos) * 100 : 0;
        const ratio = inversion > 0 ? utilidad / inversion : 0;
        const costosArrastrados = round2(costosArrastradosSum);

        const byService = SERVICE_TYPES
            .map(s => {
                const stTotal = inPeriod.filter((t: any) => t.service_type === s.id || t.tipoServicio === s.id);
                const stClosed = closed.filter((t: any) => t.service_type === s.id || t.tipoServicio === s.id);
                const ing  = stClosed.reduce((a, t) => a + parseFloat(t.ingresos_reales ?? 0), 0);
                const cost = stTotal.reduce((a, t) => a + ticketInversion(t), 0);
                const util = stClosed.reduce((a, t) => a + ticketUtilidad(t), 0);
                return { ...s, tickets: stTotal.length, ingresos: ing, margen: ing > 0 ? (util / ing) * 100 : 0 };
            })
            .filter(s => s.tickets > 0)
            .sort((a, b) => b.ingresos - a.ingresos);

        const ingresosItems = closed
            .filter(t => parseFloat(t.ingresos_reales ?? 0) > 0)
            .sort((a, b) =>
                new Date(b.closure_date ?? b.updated_at ?? b.created_at ?? 0).getTime() -
                new Date(a.closure_date ?? a.updated_at ?? a.created_at ?? 0).getTime()
            );

        const inversionItems = inPeriod
            .filter(t => ticketInversion(t) > 0)
            .map(t => ({ ...t, _investmentTotalReal: round2(ticketInversion(t)) }))
            .sort((a, b) => b._investmentTotalReal - a._investmentTotalReal);

        return { inversion, ingresos, utilidad, margen, ratio,
                 closed: closed.length, total: inPeriod.length,
                 byService, inversionItems, ingresosItems,
                 costosArrastrados, arrastradoItems };
    }, [activeTickets, dateRange, now]);

    // ── MÓDULO ADICIONAL: Datos de Gráficos (Pipeline Aprobado, Clientes y Depósitos) ──
    const pipelineApprovedData = useMemo(() => {
        let aprobadas = 0;
        let enEjecucion = 0;
        let arrastrados = 0;
        
        const approvedStates = ["cotizacion_aprobada", "en_ejecucion", "documentacion_enviada", "por_liquidar", "requiere_revision_admin"];

        activeTickets.forEach((t: any) => {
            if (!isTicketInPeriod(t)) return;
            const sid = normalizeStateId(t.status_id || t.estadoId);
            if (!approvedStates.includes(sid)) return;

            const val = parseFloat(t.ingresos_reales || 0) || (parseFloat(t.total_quoted_amount || t.montoFinal || 0) / 1.18);
            
            if (isRolledOver(t)) {
                arrastrados += val;
            } else {
                if (sid === 'cotizacion_aprobada') {
                    aprobadas += val;
                } else {
                    enEjecucion += val;
                }
            }
        });

        return [
            { name: "Aprobada", value: round2(aprobadas), color: "#10B981" },
            { name: "En Ejecución", value: round2(enEjecucion), color: "#8B5CF6" },
            { name: "Carga Arrastrada", value: round2(arrastrados), color: "#EF4444" }
        ].filter(item => item.value > 0);
    }, [activeTickets, dateRange, now]);

    const clientBillingData = useMemo(() => {
        const clientMap: Record<string, { id: string, name: string, billing: number, color: string }> = {};
        activeTickets.forEach((t: any) => {
            if (!isTicketInPeriod(t)) return;
            
            // Regla de Negocio: Solo mostrar facturación de tickets liquidados (cerrados)
            const isClosed = normalizeStateId(t.status_id ?? t.estadoId) === "ticket_cerrado";
            if (!isClosed) return;

            const clientName = t.cliente?.nombre || t.clients?.name || t.cliente?.name || t.metadata?.cliente?.nombre || "Otros";
            const clientId = t.client_id || "otros";
            const clientColor = t.cliente?.color || t.clients?.color_aura || "#3B82F6";
            
            // Regla de Negocio: Montos CON IGV liquidados
            const billingAmount = parseFloat(t.total_quoted_amount ?? t.montoFinal ?? t.monto_presupuesto ?? String(parseFloat(t.ingresos_reales ?? 0) * 1.18));
            if (billingAmount <= 0) return;

            if (!clientMap[clientId]) {
                clientMap[clientId] = { id: clientId, name: clientName, billing: 0, color: clientColor };
            }
            clientMap[clientId].billing += billingAmount;
        });
        return Object.values(clientMap)
            .map(c => ({ ...c, billing: round2(c.billing) }))
            .sort((a, b) => b.billing - a.billing)
            .slice(0, 5); // Top 5
    }, [activeTickets, dateRange, now]);

    const advancesTesoreria = useMemo(() => {
        let totalAdvances = 0;
        let totalBudget = 0;

        activeTickets.forEach((t: any) => {
            if (!isTicketInPeriod(t)) return;
            totalAdvances += parseFloat(t.adelantos_flujo_b || t.metadata?.adelantos_flujo_b || 0);
            totalBudget += parseFloat(t.ingresos_reales || 0);
        });

        return {
            totalAdvances: round2(totalAdvances),
            totalBudget: round2(totalBudget),
            percent: totalBudget > 0 ? round2((totalAdvances / totalBudget) * 100) : 0
        };
    }, [activeTickets, dateRange, now]);


    // ── MÓDULO 2: Tesorería / Pendientes (Lectura Inmutable Backend) ───────
    const tesoreria = useMemo(() => {
        const inPeriod = activeTickets.filter((t: any) => isTicketInPeriod(t));

        // Pipeline: Cotizaciones en curso
        const pipelineStates = ["en_cotizacion", "cotizacion_enviada", "borrador", "nuevo", "pendiente", "visitado"];
        const pipelineTickets = inPeriod.filter((t: any) => pipelineStates.includes(normalizeStateId(t.status_id || t.estadoId)));
        const totalPipelineNeto = pipelineTickets.reduce((s, t) => s + (parseFloat(t.ingresos_reales || 0) || (parseFloat(t.total_quoted_amount || t.montoFinal || 0) / 1.18)), 0);

        // Presupuestos Aprobados: En ejecución o por liquidar
        const approvedStates = ["cotizacion_aprobada", "en_ejecucion", "documentacion_enviada", "por_liquidar", "requiere_revision_admin"];
        const approvedTickets = inPeriod.filter((t: any) => approvedStates.includes(normalizeStateId(t.status_id || t.estadoId)));
        const totalAprobados = approvedTickets.reduce((s, t) => s + (parseFloat(t.ingresos_reales || 0) || (parseFloat(t.total_quoted_amount || t.montoFinal || 0) / 1.18)), 0);

        // Lucro Cesante: dinero que la empresa deja de percibir por
        // inoperatividad, retrasos técnicos o penalizaciones SLA en
        // tickets bloqueados más de 48 horas sin avance.
        const bloqueados48h = [...pipelineTickets, ...approvedTickets].filter((t: any) =>
            hoursAgo(t.updated_at || t.createdAt || t.created_at || "") >= 48
        );
        const lucroReal = bloqueados48h.reduce((s, t) => {
            const ingresos = parseFloat(t.ingresos_reales || 0) || (parseFloat(t.total_quoted_amount || t.montoFinal || 0) / 1.18);
            const costos = parseFloat(t.labor_cost || 0) + parseFloat(t.materials_cost || 0) + parseFloat(t.visit_cost || 0);
            const utilidadPerdida = Math.max(0, ingresos - costos);
            return s + utilidadPerdida;
        }, 0);

        // Aging
        const todosPendientes = [...pipelineTickets, ...approvedTickets];
        const aging = {
            "0-24h": todosPendientes.filter((t: any) => hoursAgo(t.updated_at || t.createdAt || t.created_at || "") < 24),
            "24-48h": todosPendientes.filter((t: any) => { const h = hoursAgo(t.updated_at || t.createdAt || t.created_at || ""); return h >= 24 && h < 48; }),
            "+48h": todosPendientes.filter((t: any) => hoursAgo(t.updated_at || t.createdAt || t.created_at || "") >= 48),
        };

        const calcAmountNeto = (arr: any[]) => round2(arr.reduce((s: number, t: any) => {
            const ingresoNeto = parseFloat(t.ingresos_reales || 0) || (parseFloat(t.total_quoted_amount || t.montoFinal || 0) / 1.18);
            return s + ingresoNeto;
        }, 0));

        const addMonto = (arr: any[]) => arr.map(t => ({
            ...t,
            _monto: parseFloat(t.ingresos_reales || 0) || (parseFloat(t.total_quoted_amount || t.montoFinal || 0) / 1.18)
        }));

        // Cuellos de botella detallados
        const espCot = pipelineTickets.filter(t => ["nuevo", "asignado_a_tecnico", "en_inspeccion", "borrador"].includes(normalizeStateId(t.status_id || t.estadoId)));
        const espApro = pipelineTickets.filter(t => ["cotizacion_enviada"].includes(normalizeStateId(t.status_id || t.estadoId)));
        const espAde = approvedTickets.filter(t => ["cotizacion_aprobada"].includes(normalizeStateId(t.status_id || t.estadoId)) && calculateTicketFinances(t, t.costos || []).totalExpenses <= 0);
        const enEjec = approvedTickets.filter(t => normalizeStateId(t.status_id || t.estadoId) === "en_ejecucion");
        const penLiq = approvedTickets.filter(t => ["por_liquidar", "documentacion_enviada", "liquidado", "requiere_revision_admin"].includes(normalizeStateId(t.status_id || t.estadoId)));

        return {
            tickets: [...todosPendientes],
            pipelineTickets: [...pipelineTickets],
            approvedTickets: [...approvedTickets],
            bloqueados48hTickets: [...bloqueados48h],
            total: todosPendientes.length,
            totalPipeline: round2(totalPipelineNeto),
            totalAprobados: round2(totalAprobados),
            lucro: round2(lucroReal),
            aging: [
                { label: "0 – 24 horas", count: aging["0-24h"].length, amount: calcAmountNeto(aging["0-24h"]), tickets: addMonto(aging["0-24h"]), color: "#10B981" },
                { label: "24 – 48 horas", count: aging["24-48h"].length, amount: calcAmountNeto(aging["24-48h"]), tickets: addMonto(aging["24-48h"]), color: "#F59E0B" },
                { label: "+ 48 horas (alerta)", count: aging["+48h"].length, amount: calcAmountNeto(aging["+48h"]), tickets: addMonto(aging["+48h"]), color: "#EF4444" },
            ],
            bloqueados48: aging["+48h"].length,
            bottlenecks: [
                { label: "Esperando Cotización", count: espCot.length, tickets: addMonto(espCot), color: "#8B5CF6" },
                { label: "Esperando Aprobación", count: espApro.length, tickets: addMonto(espApro), color: "#3B82F6" },
                { label: "Esperando Adelanto", count: espAde.length, tickets: addMonto(espAde), color: "#F59E0B" },
                { label: "En Ejecución", count: enEjec.length, tickets: addMonto(enEjec), color: "#10B981" },
                { label: "Pendiente Liquidar", count: penLiq.length, tickets: addMonto(penLiq), color: "#64748B" },
            ].filter(b => b.count > 0).sort((a,b) => b.count - a.count)
        };
    }, [activeTickets, dateRange, now]);

    // ── CAPITAL EXPUESTO / ADELANTADO (Pagos a Técnicos en tickets activos) ────────
    // Estados activos previos a ejecución/cierre donde aún hay capital en riesgo
    const ESTADOS_RIESGO_CAPITAL = ["en_cotizacion", "cotizacion_enviada", "cotizacion_aprobada", "por_liquidar", "nuevo", "asignado_a_tecnico", "en_inspeccion", "visitado"];

    const capitalExpuesto = useMemo(() => {
        const ticketsConAdelantos = activeTickets
            .filter((t: any) => {
                if (!isTicketInPeriod(t)) return false;
                const sid = normalizeStateId(t.estadoId);
                const isActive = !["ticket_cerrado", "ticket_rechazado", "ticket_cancelado"].includes(sid);
                const totalPagado = calculateTicketFinances(t, t.costos || []).totalExpenses;
                return isActive && totalPagado > 0;
            })
            .map((t: any) => {
                const costs = t.costos || [];
                const totalAdelantado = calculateTicketFinances(t, costs).totalExpenses;

                // Resolver nombre de gestora
                const gestoraId = t.gestora_id || t.metadata?.gestora_id;
                const gestoraObj = safeGestoras.find((g: any) => g.id === gestoraId);
                const gestoraName = gestoraObj
                    ? (gestoraObj.name || gestoraObj.nombre || gestoraObj.full_name || "Gestora")
                    : (t.gestora?.nombre || t.gestora?.name || "Sin asignar");

                const especialista = t.tecnico?.nombre || costs[0]?.technicians?.name || costs[0]?.proveedor || t.metadata?.tecnicoAsignado?.name || t.metadata?.tecnico_nombre || "Sin especialista";

                // Sede
                const sede = t.sede?.nombre || t.cliente?.nombre || "Sin sede";

                // Aging
                const ageH = hoursAgo(t.createdAt || t.created_at || "");
                const isRiesgo = ageH >= 48; // +48h = riesgo financiero

                return {
                    ...t,
                    _totalAdelantado: totalAdelantado,
                    _gestoraName: gestoraName,
                    _especialista: especialista,
                    _sede: sede,
                    _ageH: ageH,
                    _isRiesgo: isRiesgo,
                    _pagos: costs,
                };
            })
            .sort((a: any, b: any) => b._totalAdelantado - a._totalAdelantado);

        const totalCapital = round2(ticketsConAdelantos.reduce((s: number, t: any) => s + t._totalAdelantado, 0));
        const enRiesgo = ticketsConAdelantos.filter((t: any) => t._isRiesgo);
        const totalEnRiesgo = round2(enRiesgo.reduce((s: number, t: any) => s + t._totalAdelantado, 0));

        return { tickets: ticketsConAdelantos, total: totalCapital, enRiesgo: enRiesgo.length, totalEnRiesgo };
    }, [activeTickets, gestoras, dateRange, now]);

    // ── CFO METRICS (STANDARD) ──────────────────────────────────────────
    const cfoAccountsReceivable = useMemo(() => calculateAccountsReceivable(invoices), [invoices]);
    const cfoWip = useMemo(() => calculateWIP(activeTickets), [activeTickets]);
    // Usa la utilidad del ROI para el EBITDA, ya que el ROI tiene el cálculo correcto considerando periodos
    const cfoEbitda = useMemo(() => calculateEBITDA(roi.utilidad, expenses), [roi.utilidad, expenses]);

    // ── MÓDULO 3: RRHH / Productividad — Alineado con Módulo de Tickets ────────
    const NUEVOS_STATES_RRHH = ["nuevo", "pendiente", "asignado_a_tecnico", "borrador"];
    const EN_PROCESO_STATES_RRHH = ["en_inspeccion", "en_cotizacion", "cotizacion_enviada", "cotizacion_aprobada", "en_ejecucion", "documentacion_enviada", "por_liquidar", "liquidado", "visitado", "requiere_revision_admin"];

    const rrhh = useMemo(() => {
        const inPeriod = activeTickets.filter((t: any) => isTicketInPeriod(t));
        const active = inPeriod.filter((t: any) =>
            !["ticket_cerrado", "ticket_rechazado", "ticket_cancelado"].includes(normalizeStateId(t.estadoId))
        );

        const closed = inPeriod.filter((t: any) => normalizeStateId(t.estadoId) === "ticket_cerrado");
        const total = inPeriod.length || 1;

        // SLA global
        const expired = active.filter((t: any) => hoursAgo(t.createdAt || t.created_at || "") >= SLA_HOURS);
        const slaGlobal = ((total - expired.length) / total) * 100;

        // FCR: tickets cerrados que nunca fueron reabiertos (sin campo de reopen, 100% si hay cerrados)
        const fcrPct = closed.length > 0
            ? (closed.filter((t: any) => !t.reopen_count || t.reopen_count === 0).length / closed.length) * 100
            : 0;

        // NPS: calculado desde valoración real del cliente (si existe); 0 si no hay datos
        const withRating = closed.filter((t: any) => typeof t.client_rating === 'number' && t.client_rating > 0);
        const npsPct = withRating.length > 0
            ? Math.round(withRating.reduce((s: number, t: any) => s + t.client_rating, 0) / withRating.length)
            : 0;

        // Distribución por gestora REAL (matching por gestora_id)
        const gestorasData = safeGestoras.map((g: any) => {
            const nombre = g.name || g.nombre || g.full_name || "Gestora";
            const ticketsGestora = active.filter((t: any) => {
                const tGestoraId = t.gestora_id || t.metadata?.gestora_id;
                return tGestoraId === g.id;
            });

            const nuevos = ticketsGestora.filter((t: any) => NUEVOS_STATES_RRHH.includes(normalizeStateId(t.estadoId))).length;
            const enProceso = ticketsGestora.filter((t: any) => EN_PROCESO_STATES_RRHH.includes(normalizeStateId(t.estadoId))).length;
            const vencidos = ticketsGestora.filter((t: any) => hoursAgo(t.createdAt || t.created_at || "") >= SLA_HOURS).length;

            return { id: g.id, nombre, count: ticketsGestora.length, nuevos, enProceso, vencidos, tickets: ticketsGestora };
        }).sort((a: any, b: any) => b.count - a.count);

        // Tickets SIN gestora asignada
        const sinGestora = active.filter((t: any) => {
            const tGestoraId = t.gestora_id || t.metadata?.gestora_id;
            return !tGestoraId || !safeGestoras.find((g: any) => g.id === tGestoraId);
        });
        if (sinGestora.length > 0) {
            const sinGestoraEnProceso = sinGestora.filter((t: any) => EN_PROCESO_STATES_RRHH.includes(normalizeStateId(t.estadoId))).length;
            const sinGestoraNuevos = sinGestora.filter((t: any) => NUEVOS_STATES_RRHH.includes(normalizeStateId(t.estadoId))).length;
            gestorasData.push({ id: 'sin_asignar', nombre: 'Sin Gestora', count: sinGestora.length, nuevos: sinGestoraNuevos, enProceso: sinGestoraEnProceso, vencidos: 0, tickets: sinGestora });
        }

        const maxLoad = Math.max(...gestorasData.map((g: any) => g.count), 1);

        return { slaGlobal, fcrPct, npsPct, gestoras: gestorasData, maxLoad, expired: expired.length };
    }, [activeTickets, gestoras]);


    // ── PRODUCTIVIDAD EN SOLES POR GESTOR DESDE BASE DE DATOS ─────────
    const PRODUCTIVITY_COLORS = ["#8B5CF6", "#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#EC4899", "#14B8A6"];
    const productivityData = useMemo(() => {
        const inPeriod = activeTickets.filter((t: any) => isTicketInPeriod(t));
        const validTickets = inPeriod.filter((t: any) => {
            const state = normalizeStateId(t.estadoId ?? t.status_id);
            return state !== "ticket_cancelado" && state !== "ticket_rechazado";
        });

        const totalsMap: { [key: string]: { name: string; value: number } } = {};

        validTickets.forEach((t: any) => {
            const gestoraId = t.gestora_id || t.metadata?.gestora_id;
            let gestoraName = "Sin asignar";

            if (gestoraId) {
                const g = gestorasMap.get(gestoraId);
                if (g) {
                    gestoraName = g.name || g.nombre || g.full_name || "Gestora";
                }
            }

            if (gestoraName === "Sin asignar") {
                const directName = t.gestora?.name || t.gestora?.nombre || t.gestora?.full_name;
                if (directName) {
                    gestoraName = directName;
                }
            }

            if (gestoraName === "Sin asignar" || gestoraName === "Sin Gestora") {
                return;
            }

            const amount = parseFloat(t.total_quoted_amount ?? t.montoFinal ?? t.monto_presupuesto ?? 0);
            if (amount > 0) {
                if (!totalsMap[gestoraName]) {
                    totalsMap[gestoraName] = { name: gestoraName, value: 0 };
                }
                totalsMap[gestoraName].value += amount;
            }
        });

        return Object.values(totalsMap).map((item: any) => ({
            name: item.name,
            value: round2(item.value)
        })).filter((item: any) => item.value > 0);
    }, [activeTickets, gestoras, dateRange]);

    const stackedProductivityData = useMemo(() => {
        const inPeriod = activeTickets.filter((t: any) => isTicketInPeriod(t));
        const gestoresMapData: { [key: string]: { gestor: string; netoCerrado: number; igvCerrado: number; montoActivos: number } } = {};

        inPeriod.forEach((t: any) => {
            const state = normalizeStateId(t.estadoId ?? t.status_id);
            if (state === "ticket_cancelado" || state === "ticket_rechazado") {
                return;
            }

            const gestoraId = t.gestora_id || t.metadata?.gestora_id;
            let gestoraName = "Sin asignar";

            if (gestoraId) {
                const g = gestorasMap.get(gestoraId);
                if (g) {
                    gestoraName = g.name || g.nombre || g.full_name || "Gestora";
                }
            }

            if (gestoraName === "Sin asignar") {
                const directName = t.gestora?.name || t.gestora?.nombre || t.gestora?.full_name;
                if (directName) {
                    gestoraName = directName;
                }
            }

            if (gestoraName === "Sin asignar" || gestoraName === "Sin Gestora") {
                return;
            }

            const amount = parseFloat(t.total_quoted_amount ?? t.montoFinal ?? t.monto_presupuesto ?? 0);
            if (amount <= 0) return;

            if (!gestoresMapData[gestoraName]) {
                gestoresMapData[gestoraName] = { gestor: gestoraName, netoCerrado: 0, igvCerrado: 0, montoActivos: 0 };
            }

            if (state === "ticket_cerrado") {
                const neto = amount / 1.18;
                const igv = amount - neto;
                gestoresMapData[gestoraName].netoCerrado += neto;
                gestoresMapData[gestoraName].igvCerrado += igv;
            } else {
                gestoresMapData[gestoraName].montoActivos += amount;
            }
        });

        return Object.values(gestoresMapData).map((g: any) => ({
            gestor: g.gestor,
            netoCerrado: round2(g.netoCerrado),
            igvCerrado: round2(g.igvCerrado),
            montoActivos: round2(g.montoActivos)
        })).filter((g: any) => (g.netoCerrado + g.igvCerrado + g.montoActivos) > 0);
    }, [activeTickets, gestoras, dateRange]);

    // ── SEMÁFORO GLOBAL ─────────────────────
    const globalLight = useMemo(() => semaforo([
        { test: tesoreria.bloqueados48 > 0, level: "ROJO" },
        { test: rrhh.slaGlobal < 85, level: "ROJO" },
        { test: roi.margen < 40, level: "AMBAR" },
        { test: rrhh.expired > 0, level: "AMBAR" },
    ]), [tesoreria, rrhh, roi]);

    const lightColor = globalLight === "ROJO" ? "#EF4444" : globalLight === "AMBAR" ? "#F59E0B" : "#10B981";
    const lightBg = globalLight === "ROJO" ? "rgba(239,68,68,0.12)" : globalLight === "AMBAR" ? "rgba(245,158,11,0.12)" : "rgba(16,185,129,0.1)";

    if (!isMounted) {
        return (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh" }}>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "1rem" }}>
                    <div style={{ width: "40px", height: "40px", border: "3px solid rgba(255,255,255,0.1)", borderTopColor: "#10B981", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
                    <span style={{ color: "rgba(255,255,255,0.4)", fontSize: "0.85rem", fontWeight: 600 }}>Cargando datos en tiempo real…</span>
                    <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
                </div>
            </div>
        );
    }

    return (
        <div style={{ padding: "1.5rem 2rem", minHeight: "100vh", fontFamily: "Inter,system-ui,sans-serif" }}>
            {toast && (
                <div style={{
                    position: "fixed",
                    top: "20px",
                    right: "20px",
                    zIndex: 9999,
                    background: "rgba(17, 24, 39, 0.95)",
                    border: "1px solid rgba(16, 185, 129, 0.4)",
                    boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.5)",
                    backdropFilter: "blur(12px)",
                    borderRadius: "12px",
                    padding: "1rem 1.25rem",
                    display: "flex",
                    flexDirection: "column",
                    gap: "4px",
                    maxWidth: "350px",
                    transition: "all 0.3s ease-out"
                }}>
                    <div style={{ fontSize: "0.82rem", fontWeight: 800, color: "#10B981", display: "flex", alignItems: "center", gap: "8px" }}>
                        <span>{toast.title}</span>
                    </div>
                    <div style={{ fontSize: "0.72rem", color: "rgba(255, 255, 255, 0.8)", lineHeight: "1.3" }}>
                        {toast.desc}
                    </div>
                </div>
            )}

            {/* ── EXECUTIVE HEADER ─────────────── */}
            <div style={{
                background: "linear-gradient(135deg,#0F0F1A 0%,#1A1035 50%,#0D1B2A 100%)",
                border: `1px solid ${lightColor}30`,
                borderRadius: "20px", padding: "1.5rem 2rem", marginBottom: "1.25rem",
                display: "flex", justifyContent: "space-between", alignItems: "center",
                boxShadow: `0 8px 40px ${lightColor}15`
            }}>
                <div style={{ display: "flex", gap: "1.25rem", alignItems: "center" }}>
                    <div style={{ width: "52px", height: "52px", borderRadius: "14px", background: "rgba(255,255,255,0.05)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <BarChart3 size={26} color={lightColor} />
                    </div>
                    <div>
                        <div style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
                            <div style={{ display: "flex", gap: "0.6rem", alignItems: "center" }}>
                                <h1 style={{ color: "white", fontWeight: 900, fontSize: "1.35rem", margin: 0 }}>
                                    Dashboard Estratégico — Alta Gerencia
                                </h1>
                                <span style={{ fontSize: "0.65rem", fontWeight: 800, padding: "2px 10px", borderRadius: "999px", background: `${lightColor}20`, color: lightColor, border: `1px solid ${lightColor}40`, letterSpacing: "0.1em" }}>
                                    ESTADO: {globalLight}
                                </span>
                            </div>
                            
                            {/* Live indicator — auto-refresh every 15s */}
                            <span style={{
                                display: "flex", alignItems: "center", gap: "6px",
                                fontSize: "0.68rem", fontWeight: 700, color: "#10B981",
                                padding: "3px 10px", borderRadius: "999px",
                                background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.25)"
                            }}>
                                <span style={{
                                    width: "7px", height: "7px", borderRadius: "50%",
                                    background: "#10B981",
                                    animation: "livePulse 2s ease-in-out infinite",
                                    boxShadow: "0 0 6px #10B981"
                                }} />
                                EN VIVO
                            </span>
                            <style>{`@keyframes livePulse { 0%,100%{opacity:1} 50%{opacity:.3} }`}</style>
                        </div>
                        <p style={{ color: "rgba(255,255,255,0.45)", fontSize: "0.8rem", margin: "4px 0 0" }}>
                            {new Date().toLocaleDateString("es-PE", { weekday: "long", year: "numeric", month: "long", day: "numeric" })} · Tiempo real
                        </p>
                    </div>
                </div>

                {/* Date range */}
                <div style={{ display: "flex", gap: "0.3rem", background: "rgba(255,255,255,0.04)", borderRadius: "10px", padding: "4px" }}>
                    {(["today", "week", "month", "all"] as const).map(f => (
                        <button key={f} onClick={() => setDateRange(f)} style={{
                            padding: "0.4rem 0.9rem", borderRadius: "7px", border: "none", cursor: "pointer",
                            fontSize: "0.75rem", fontWeight: 700,
                            background: dateRange === f ? lightColor : "transparent",
                            color: dateRange === f ? "white" : "rgba(255,255,255,0.5)",
                            transition: "all 0.2s"
                        }}>
                            {{ today: "Hoy", week: "7d", month: "30d", all: "Total" }[f]}
                        </button>
                    ))}
                </div>
            </div>

            {/* ── ALERT BANNER ────────────────── */}
            {globalLight !== "VERDE" && (
                <div style={{
                    background: lightBg, border: `1px solid ${lightColor}40`,
                    borderRadius: "12px", padding: "0.8rem 1.2rem", marginBottom: "1.25rem",
                    display: "flex", alignItems: "center", gap: "0.75rem"
                }}>
                    <AlertCircle size={18} color={lightColor} />
                    <div style={{ flex: 1 }}>
                        <span style={{ fontWeight: 800, color: lightColor, fontSize: "0.82rem" }}>ALERTA OPERATIVA </span>
                        <span style={{ color: "rgba(255,255,255,0.6)", fontSize: "0.8rem" }}>
                            {tesoreria.bloqueados48 > 0 && `${tesoreria.bloqueados48} ticket(s) bloqueados >48h sin pago · `}
                            {rrhh.slaGlobal < 85 && `SLA global en ${Math.round(rrhh.slaGlobal)}% (mínimo 85%) · `}
                            {roi.margen < 40 && `Margen operativo en ${Math.round(roi.margen)}% (objetivo 40%)`}
                        </span>
                    </div>
                </div>
            )}

            {/* ══════════════════════════════════
                MÓDULO 1: RENTABILIDAD & ROI
            ══════════════════════════════════ */}
            <SectionHeader icon={<TrendingUp size={16} />} title="Rentabilidad & ROI" color="#10B981" />
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: "1rem", marginBottom: "1.25rem" }}>
                <RoiCard label="Inversión Ejecutada" value={`S/ ${fmt(roi.inversion)}`}
                    sub="Costos confirmados (mano de obra + gastos) sin IGV" color="#3B82F6"
                    icon={BanknoteIcon}
                    light={roi.inversion > 0 ? "VERDE" : "AMBAR"}
                    onClick={() => {
                        setModalTitle("Inversión Ejecutada: Pagos confirmados (ticket_costs)");
                        setModalTickets(roi.inversionItems.map((t: any) => ({
                            ...t,
                            servicio: t.service_type || t.tipo_servicio,
                            cliente: t.cliente?.nombre || t.clients?.name || t.clienteNombre || 'Cliente',
                            _monto: t._investmentTotalReal,
                        })));
                        setShowListModal(true);
                    }}
                />
                <RoiCard label="Ingresos Generados" value={`S/ ${fmt(roi.ingresos)}`}
                    sub="Presupuestos aprobados y facturación (sin IGV)" color="#10B981"
                    icon={DollarSign}
                    light={roi.ingresos > 0 ? "VERDE" : "AMBAR"}
                    onClick={() => {
                        setModalTitle("Ingresos Generados: Aprobados & Facturados (SIN IGV)");
                        setModalTickets(roi.ingresosItems.map((t: any) => {
                            const ingresoReal = parseFloat(t.ingresos_reales || 0);
                            return {
                                ...t,
                                cliente: t.cliente?.nombre || t.clients?.name || 'Cliente',
                                sede: t.branch_offices?.name || t.sede?.nombre || 'Sede',
                                statusId: t.status_id,
                                _monto: ingresoReal,
                                _fechaCierre: t.closure_date || t.updated_at,
                                _ticketNumber: t.client_ticket_number || t.ticket_number || 'N/A'
                            };
                        }));
                        setShowListModal(true);
                    }}
                />
                <RoiCard label="Carga Financiera Arrastrada" value={`S/ ${fmt(roi.costosArrastrados)}`}
                    sub="Costos acumulados de tickets abiertos de meses anteriores" color="#EF4444"
                    icon={Layers}
                    light={roi.costosArrastrados > 0 ? "ROJO" : "VERDE"}
                    onClick={() => {
                        setModalTitle("Carga Financiera Arrastrada: Tickets abiertos de meses anteriores");
                        setModalTickets(roi.arrastradoItems.map((t: any) => ({
                            ...t,
                            servicio: t.service_type || t.tipo_servicio,
                            cliente: t.cliente?.nombre || t.clients?.name || t.clienteNombre || 'Cliente',
                            _monto: ticketInversion(t),
                            _fecha: t.original_created_at ?? t.created_at ?? t.createdAt ?? t.fechaCreacion,
                        })));
                        setShowListModal(true);
                    }}
                />
                <RoiCard label="Utilidad Neta" value={`S/ ${fmt(roi.utilidad)}`}
                    sub={`Margen neto real: ${Math.round(roi.margen)}%`} color="#8B5CF6"
                    icon={TrendingUp}
                    light={roi.margen >= 35 ? "VERDE" : roi.margen >= 20 ? "AMBAR" : "ROJO"}
                    onClick={() => {
                        setModalTitle("Análisis de Utilidad Neta (Profitability) - SIN IGV");
                        setModalTickets(roi.ingresosItems.map(t => {
                            const ing  = parseFloat(t.ingresos_reales ?? 0);
                            const cost = ticketInversion(t);
                            const util = ticketUtilidad(t);
                            return { ...t,
                                cliente: t.cliente?.nombre ?? t.clients?.name ?? 'Cliente',
                                _viewMode: 'utilidad',
                                _utilityAmount: util,
                                _monto: util,
                            };
                        }));
                        setShowListModal(true);
                    }}
                />
                <RoiCard label="Ratio de Eficiencia" value={`${roi.ratio.toFixed(2)}x`}
                    sub="Ganancia neta por S/ invertido" color="#F59E0B"
                    icon={Target}
                    light={roi.ratio >= 1.5 ? "VERDE" : roi.ratio >= 1 ? "AMBAR" : "ROJO"}
                    onClick={() => {
                        setModalTitle("Eficiencia Operativa / ROI");
                        setModalTickets(roi.ingresosItems.map(t => {
                            const ing  = parseFloat(t.ingresos_reales ?? 0);
                            const cost = ticketInversion(t);
                            const util = ticketUtilidad(t);
                            return { ...t,
                                cliente: t.cliente?.nombre ?? t.clients?.name ?? 'Cliente',
                                _viewMode: 'ratio',
                                _monto: cost > 0 ? util / cost : 0,
                            };
                        }));
                        setShowListModal(true);
                    }}
                />
            </div>

            {/* ROI por servicio */}
            {roi.byService.length > 0 && (
                <div style={{
                    background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)",
                    borderRadius: "14px", padding: "1.25rem 1.5rem", marginBottom: "1.25rem"
                }}>
                    <div style={{ fontSize: "0.78rem", fontWeight: 800, color: "rgba(255,255,255,0.5)", textTransform: "uppercase", marginBottom: "1rem", letterSpacing: "0.05em" }}>
                        Margen por Tipo de Servicio
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(180px,1fr))", gap: "0.75rem" }}>
                        {roi.byService.map(s => {
                            const Icon = s.icon;
                            const mc = s.margen >= 40 ? "#10B981" : s.margen >= 25 ? "#F59E0B" : "#EF4444";
                            return (
                                <div key={s.id} style={{ background: `${s.color}08`, border: `1px solid ${s.color}20`, borderRadius: "10px", padding: "0.75rem 1rem" }}>
                                    <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", marginBottom: "0.4rem" }}>
                                        <Icon size={13} color={s.color} />
                                        <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "rgba(255,255,255,0.7)" }}>{s.nombreCorto}</span>
                                    </div>
                                    <div style={{ fontSize: "1.1rem", fontWeight: 900, color: mc }}>{Math.round(s.margen)}%</div>
                                    <div style={{ fontSize: "0.68rem", color: "rgba(255,255,255,0.35)" }}>S/ {fmt(s.ingresos)} · {s.tickets} tickets</div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* ══════════════════════════════════
                MÓDULO CFO: MÉTRICAS FINANCIERAS
            ══════════════════════════════════ */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
                <SectionHeader icon={<Activity size={16} />} title="Métricas CFO & Flujo de Caja (Cuentas por Cobrar & EBITDA)" color="#3B82F6" />
                <button 
                    onClick={() => setShowOpexForm(!showOpexForm)}
                    style={{
                        background: "rgba(59,130,246,0.1)", color: "#3B82F6", border: "1px solid rgba(59,130,246,0.2)",
                        padding: "0.4rem 1rem", borderRadius: "8px", fontSize: "0.8rem", fontWeight: 700,
                        cursor: "pointer", transition: "all 0.2s"
                    }}>
                    {showOpexForm ? "Ocultar Formulario OPEX" : "+ Registrar Gasto (OPEX)"}
                </button>
            </div>
            
            {showOpexForm && (
                <div style={{
                    background: "linear-gradient(135deg,rgba(255,255,255,0.05) 0%,rgba(255,255,255,0.01) 100%)",
                    border: "1px solid rgba(255,255,255,0.1)", borderRadius: "12px", padding: "1.25rem",
                    marginBottom: "1.25rem", display: "flex", gap: "1rem", alignItems: "flex-end"
                }}>
                    <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                        <label style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.6)" }}>Categoría</label>
                        <select 
                            value={newOpex.category} onChange={e => setNewOpex({...newOpex, category: e.target.value})}
                            style={{ padding: "0.6rem", borderRadius: "8px", background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.1)", color: "#FFF", fontSize: "0.9rem" }}>
                            <option value="ALQUILER">Alquiler / Oficina</option>
                            <option value="NOMINA_ADMIN">Nómina Administrativa</option>
                            <option value="SOFTWARE">Suscripciones / Software</option>
                            <option value="MARKETING">Marketing / Ventas</option>
                            <option value="OTROS">Otros Gastos Fijos</option>
                        </select>
                    </div>
                    <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                        <label style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.6)" }}>Descripción</label>
                        <input type="text" placeholder="Ej. Alquiler Mayo 2026"
                            value={newOpex.description} onChange={e => setNewOpex({...newOpex, description: e.target.value})}
                            style={{ padding: "0.6rem", borderRadius: "8px", background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.1)", color: "#FFF", fontSize: "0.9rem" }} />
                    </div>
                    <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                        <label style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.6)" }}>Monto (S/)</label>
                        <input type="number" placeholder="Ej. 1500" min="0" step="0.01"
                            value={newOpex.amount} onChange={e => setNewOpex({...newOpex, amount: e.target.value})}
                            style={{ padding: "0.6rem", borderRadius: "8px", background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.1)", color: "#FFF", fontSize: "0.9rem" }} />
                    </div>
                    <button onClick={handleAddExpense}
                        style={{
                            background: "#3B82F6", color: "#FFF", border: "none",
                            padding: "0.6rem 1.25rem", borderRadius: "8px", fontSize: "0.9rem", fontWeight: 700,
                            cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center"
                        }}>
                        Guardar OPEX
                    </button>
                </div>
            )}

            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "1rem", marginBottom: "1.25rem" }}>
                <RoiCard label="Cuentas por Cobrar" value={`S/ ${fmt(cfoAccountsReceivable.totalDeuda)}`}
                    sub={`Cash-In: S/ ${fmt(cfoAccountsReceivable.cashIn)} (${Math.round(cfoAccountsReceivable.percentageCashIn)}%)`} color="#EF4444"
                    icon={BanknoteIcon}
                    light={cfoAccountsReceivable.percentageCashIn >= 80 ? "VERDE" : cfoAccountsReceivable.percentageCashIn >= 50 ? "AMBAR" : "ROJO"}
                />
                <RoiCard label="Facturación Emitida" value={`S/ ${fmt(cfoAccountsReceivable.totalEmitido)}`}
                    sub="Monto total de facturas emitidas" color="#10B981"
                    icon={DollarSign}
                    light="VERDE"
                />
                <RoiCard label="Capital Inmovilizado (WIP)" value={`S/ ${fmt(cfoWip.totalInmovilizado)}`}
                    sub={`${cfoWip.ticketsInmovilizados} tickets en proceso / estancados`} color="#F59E0B"
                    icon={Layers}
                    light={cfoWip.totalInmovilizado > 5000 ? "ROJO" : "AMBAR"}
                />
                <RoiCard label="EBITDA" value={`S/ ${fmt(cfoEbitda.ebitda)}`}
                    sub={`Punto de Equilibrio: S/ ${fmt(cfoEbitda.puntoEquilibrio)}`} color="#8B5CF6"
                    icon={TrendingUp}
                    light={cfoEbitda.isProfitable ? "VERDE" : "ROJO"}
                />
            </div>

            <SectionHeader icon={<Layers size={16} />} title="Tesorería & Flujo de Caja" color="#F59E0B" />

            {/* 📈 NUEVOS GRÁFICOS FINANCIEROS GERENCIALES (RECHARTS + AURA LIST) ─────────── */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "1rem", marginBottom: "1.25rem" }}>
                
                {/* 1. Pipeline de Presupuestos Aprobados */}
                <div style={{ 
                    background: "linear-gradient(135deg,rgba(255,255,255,0.03) 0%,rgba(255,255,255,0.01) 100%)", 
                    border: "1px solid rgba(255,255,255,0.06)", 
                    borderRadius: "16px", padding: "1.4rem",
                    display: "flex", flexDirection: "column", gap: "1rem", minHeight: "260px"
                }}>
                    <div style={{ fontSize: "0.72rem", fontWeight: 800, color: "rgba(255,255,255,0.55)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                        📊 Pipeline de Presupuestos Aprobados (Sin IGV)
                    </div>
                    {pipelineApprovedData.length === 0 ? (
                        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.76rem", color: "rgba(255,255,255,0.3)" }}>
                            Sin ejecuciones en este periodo
                        </div>
                    ) : (
                        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem" }}>
                            <div style={{ position: "relative", width: "130px", height: "130px" }}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={pipelineApprovedData}
                                            cx="50%"
                                            cy="50%"
                                            innerRadius={38}
                                            outerRadius={55}
                                            paddingAngle={4}
                                            dataKey="value"
                                        >
                                            {pipelineApprovedData.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={entry.color} />
                                            ))}
                                        </Pie>
                                        <Tooltip
                                            contentStyle={{
                                                background: "rgba(17, 24, 39, 0.95)",
                                                border: "1px solid rgba(255, 255, 255, 0.1)",
                                                borderRadius: "8px",
                                                fontSize: "0.7rem",
                                                color: "#fff"
                                            }}
                                            itemStyle={{ color: "#fff" }}
                                            formatter={(value: any) => [`S/. ${fmt(value)}`, "Monto"]}
                                        />
                                    </PieChart>
                                </ResponsiveContainer>
                                <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", textAlign: "center", pointerEvents: "none", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                                    <span style={{ fontSize: "0.52rem", color: "rgba(255,255,255,0.4)", textTransform: "uppercase", fontWeight: 700, letterSpacing: "0.05em" }}>Total</span>
                                    <div style={{ fontSize: "0.78rem", fontWeight: 900, color: "white", marginTop: "1px" }}>
                                        S/. {fmt(pipelineApprovedData.reduce((sum, item) => sum + item.value, 0))}
                                    </div>
                                </div>
                            </div>
                            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", flex: 1 }}>
                                {pipelineApprovedData.map(item => (
                                    <div key={item.name} style={{ display: "flex", flexDirection: "column" }}>
                                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                                            <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: item.color }} />
                                            <span style={{ fontSize: "0.7rem", fontWeight: 700, color: "rgba(255,255,255,0.6)" }}>{item.name}</span>
                                        </div>
                                        <span style={{ fontSize: "0.95rem", fontWeight: 900, color: "white", paddingLeft: "14px" }}>S/ {fmt(item.value)}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* 2. Facturación por Cliente */}
                <div style={{ 
                    background: "linear-gradient(135deg,rgba(255,255,255,0.03) 0%,rgba(255,255,255,0.01) 100%)", 
                    border: "1px solid rgba(255,255,255,0.06)", 
                    borderRadius: "16px", padding: "1.4rem",
                    display: "flex", flexDirection: "column", gap: "0.75rem", minHeight: "260px"
                }}>
                    <div style={{ fontSize: "0.72rem", fontWeight: 800, color: "rgba(255,255,255,0.55)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                        💼 Facturación por Cliente (Top 5 con IGV)
                    </div>
                    {clientBillingData.length === 0 ? (
                        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.76rem", color: "rgba(255,255,255,0.3)" }}>
                            Sin ingresos facturados en este periodo
                        </div>
                    ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem", flex: 1, justifyContent: "center" }}>
                            {clientBillingData.map((c, idx) => {
                                const maxBilling = Math.max(...clientBillingData.map(item => item.billing), 1);
                                const pct = (c.billing / maxBilling) * 100;
                                return (
                                    <div key={c.id} style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.72rem", fontWeight: 700 }}>
                                            <span style={{ color: "rgba(255,255,255,0.75)", display: "flex", alignItems: "center", gap: "4px" }}>
                                                <span style={{ fontSize: "0.6rem", fontWeight: 900, background: `${c.color}20`, color: c.color, padding: "1px 5px", borderRadius: "3px" }}>#{idx + 1}</span>
                                                {c.name}
                                            </span>
                                            <span style={{ color: "white", fontWeight: 900 }}>S/ {fmt(c.billing)}</span>
                                        </div>
                                        <div style={{ height: "4px", background: "rgba(255,255,255,0.05)", borderRadius: "999px", overflow: "hidden" }}>
                                            <div style={{ height: "100%", width: `${pct}%`, background: c.color, borderRadius: "999px" }} />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* 3. Avances de Depósitos / Tesorería */}
                <div style={{ 
                    background: "linear-gradient(135deg,rgba(255,255,255,0.03) 0%,rgba(255,255,255,0.01) 100%)", 
                    border: "1px solid rgba(255,255,255,0.06)", 
                    borderRadius: "16px", padding: "1.4rem",
                    display: "flex", flexDirection: "column", gap: "1rem", minHeight: "260px"
                }}>
                    <div style={{ fontSize: "0.72rem", fontWeight: 800, color: "rgba(255,255,255,0.55)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                        🪙 Avances de Depósitos / Tesorería
                    </div>
                    <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", gap: "1.1rem" }}>
                        <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                                <span style={{ fontSize: "0.68rem", color: "rgba(255,255,255,0.45)", fontWeight: 700 }}>ADELANTOS CONFIRMADOS</span>
                                <span style={{ fontSize: "1.1rem", fontWeight: 900, color: "#F59E0B" }}>S/ {fmt(advancesTesoreria.totalAdvances)}</span>
                            </div>
                            <div style={{ fontSize: "0.6rem", color: "rgba(255,255,255,0.3)" }}>Suma de Mano de Obra y Viáticos dispersados (sin IGV)</div>
                        </div>

                        <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                                <span style={{ fontSize: "0.68rem", color: "rgba(255,255,255,0.45)", fontWeight: 700 }}>PRESUPUESTO TOTAL ASIGNADO</span>
                                <span style={{ fontSize: "1.1rem", fontWeight: 900, color: "#10B981" }}>S/ {fmt(advancesTesoreria.totalBudget)}</span>
                            </div>
                            <div style={{ fontSize: "0.6rem", color: "rgba(255,255,255,0.3)" }}>Total neto de tickets aprobados/ejecución (sin IGV)</div>
                        </div>

                        <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.7rem", fontWeight: 800 }}>
                                <span style={{ color: "rgba(255,255,255,0.5)" }}>AVANCE DE FLUJO</span>
                                <span style={{ color: "#F59E0B" }}>{advancesTesoreria.percent}%</span>
                            </div>
                            <div style={{ height: "6px", background: "rgba(255,255,255,0.05)", borderRadius: "999px", overflow: "hidden" }}>
                                <div style={{ height: "100%", width: `${Math.min(advancesTesoreria.percent, 100)}%`, background: "linear-gradient(90deg, #F59E0B 0%, #10B981 100%)", borderRadius: "999px" }} />
                            </div>
                        </div>
                    </div>
                </div>

            </div>

            {/* 📋 LISTADO DE AGING Y DETALLE DE CAJA (Original) ─────────── */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1.4fr 1fr", gap: "1rem", marginBottom: "1.25rem" }}>

                {/* Col 1: Gestión de Ingresos y Pipeline */}
                <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "14px", padding: "1.4rem" }}>
                    
                    {/* Presupuestos Aprobados — CLICKABLE */}
                    <div 
                        onClick={() => {
                            setModalTitle("Presupuestos Aprobados (Trabajos en curso)");
                            setModalTickets(tesoreria.approvedTickets.map((t: any) => ({
                                ...t,
                                _monto: parseFloat(t.ingresos_reales || 0) || (parseFloat(t.total_quoted_amount || t.montoFinal || 0) / 1.18)
                            })));
                            setShowListModal(true);
                        }}
                        style={{ padding: "0.5rem", margin: "-0.5rem -0.5rem 10px -0.5rem", borderRadius: "10px", cursor: "pointer", transition: "background 0.2s" }}
                        onMouseEnter={e => e.currentTarget.style.background = "rgba(34,197,94,0.08)"}
                        onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                    >
                        <div style={{ fontSize: "0.72rem", fontWeight: 800, color: "rgba(34,197,94,0.7)", textTransform: "uppercase", marginBottom: "0.25rem", display: "flex", alignItems: "center", gap: "6px" }}>
                            ✅ Presupuestos Aprobados <ChevronRight size={12} />
                        </div>
                        <div style={{ fontSize: "1.8rem", fontWeight: 900, color: "#22C55E" }}>S/ {fmt(tesoreria.totalAprobados)}</div>
                        <div style={{ fontSize: "0.78rem", color: "rgba(255,255,255,0.45)", marginTop: "0.25rem" }}>{tesoreria.approvedTickets.length} ejecuciones activas</div>
                    </div>

                    {/* Pipeline Pendiente — CLICKABLE */}
                    <div 
                        onClick={() => {
                            setModalTitle("Pipeline Pendiente (Cotizaciones en curso)");
                            setModalTickets(tesoreria.pipelineTickets.map((t: any) => ({
                                ...t,
                                _monto: parseFloat(t.ingresos_reales || 0) || (parseFloat(t.total_quoted_amount || t.montoFinal || 0) / 1.18)
                            })));
                            setShowListModal(true);
                        }}
                        style={{
                            padding: "0.5rem", margin: "0 -0.5rem 15px -0.5rem", borderRadius: "10px", 
                            cursor: "pointer", transition: "background 0.2s",
                            border: "1px solid rgba(255,255,255,0.05)"
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = "rgba(245,158,11,0.06)"}
                        onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                    >
                        <div style={{ fontSize: "0.7rem", fontWeight: 800, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", marginBottom: "0.25rem", display: "flex", alignItems: "center", gap: "6px" }}>
                            ⏱️ Pipeline en Cotización <ChevronRight size={12} />
                        </div>
                        <div style={{ fontSize: "1.4rem", fontWeight: 900, color: "#F59E0B" }}>S/ {fmt(tesoreria.totalPipeline)}</div>
                    </div>

                    <div 
                        onClick={() => {
                            setModalTitle("Lucro Cesante: Tickets bloqueados >48h");
                            setModalTickets(tesoreria.bloqueados48hTickets.map(t => {
                                const ingresoNeto = parseFloat(t.ingresos_reales || 0) || (parseFloat(t.total_quoted_amount || t.montoFinal || 0) / 1.18);
                                const costos = parseFloat(t.labor_cost || 0) + parseFloat(t.materials_cost || 0) + parseFloat(t.visit_cost || 0);
                                const utilidadPerdida = Math.max(0, ingresoNeto - costos);
                                const horasBloqueo = hoursAgo(t.updated_at || t.createdAt || t.created_at || "");
                                return {
                                    ...t,
                                    servicio: t.service_type || t.tipo_servicio,
                                    cliente: t.clients?.name || t.clienteNombre || 'Cliente',
                                    _ingresosProyectados: ingresoNeto,
                                    _costosProyectados: costos,
                                    _utilidadPendiente: utilidadPerdida,
                                    _horasBloqueo: Math.floor(horasBloqueo)
                                };
                            }));
                            setShowListModal(true);
                        }}
                        style={{ padding: "0.65rem 0.9rem", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)", borderRadius: "10px", marginBottom: "0.85rem", cursor: "pointer" }}
                    >
                        <div style={{ fontSize: "0.7rem", fontWeight: 700, color: "#EF4444", marginBottom: "2px" }}>⚡ Lucro Cesante (bloqueados &gt;48h)</div>
                        <div style={{ fontSize: "1.4rem", fontWeight: 900, color: "#EF4444" }}>S/ {fmt(tesoreria.lucro)}</div>
                        <div style={{ fontSize: "0.68rem", color: "rgba(239,68,68,0.7)" }}>{tesoreria.bloqueados48hTickets.length} ticket(s) — inoperatividad / bloqueados</div>
                    </div>

                    {/* Capital Expuesto — CLICKABLE */}
                    <div
                        onClick={() => setShowCapitalModal(true)}
                        style={{
                            padding: "0.75rem 0.9rem",
                            background: capitalExpuesto.total > 0 ? "rgba(239,68,68,0.08)" : "rgba(16,185,129,0.08)",
                            border: capitalExpuesto.total > 0 ? "1px solid rgba(239,68,68,0.3)" : "1px solid rgba(16,185,129,0.2)",
                            borderRadius: "10px", cursor: capitalExpuesto.total > 0 ? "pointer" : "default",
                            transition: "all 0.2s"
                        }}
                        onMouseEnter={e => { if (capitalExpuesto.total > 0) { e.currentTarget.style.background = "rgba(239,68,68,0.15)"; e.currentTarget.style.borderColor = "rgba(239,68,68,0.5)"; } }}
                        onMouseLeave={e => { if (capitalExpuesto.total > 0) { e.currentTarget.style.background = "rgba(239,68,68,0.08)"; e.currentTarget.style.borderColor = "rgba(239,68,68,0.3)"; } }}
                    >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                            <div style={{ fontSize: "0.7rem", fontWeight: 700, color: capitalExpuesto.total > 0 ? "#EF4444" : "#10B981" }}>
                                💸 Capital Expuesto
                            </div>
                            {capitalExpuesto.total > 0 && (
                                <span style={{ fontSize: "0.6rem", fontWeight: 800, color: "#EF4444", display: "flex", alignItems: "center", gap: "3px" }}>
                                    VER DETALLE <ChevronRight size={11} />
                                </span>
                            )}
                        </div>
                        <div style={{ fontSize: "1.2rem", fontWeight: 900, color: capitalExpuesto.total > 0 ? "#EF4444" : "#10B981", lineHeight: 1 }}>
                            S/ {fmt(capitalExpuesto.total)}
                        </div>
                        <div style={{ fontSize: "0.62rem", marginTop: "3px", color: capitalExpuesto.total > 0 ? "rgba(239,68,68,0.7)" : "rgba(16,185,129,0.7)" }}>
                            {capitalExpuesto.tickets.length} adelantes en tickets activos
                        </div>
                    </div>
                </div>

                {/* Col 2: Aging */}
                <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "14px", padding: "1.4rem" }}>
                    <div style={{ fontSize: "0.72rem", fontWeight: 800, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", marginBottom: "0.75rem" }}>Aging de Bloqueo</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                        {tesoreria.aging.map(a => (
                            <AgingRow 
                                key={a.label} 
                                {...a} 
                                onClick={() => { 
                                    setModalTitle(`Tickets en Aging: ${a.label}`); 
                                    setModalTickets(a.tickets || []); 
                                    setShowListModal(true); 
                                }} 
                            />
                        ))}
                    </div>
                </div>

                {/* Col 3: Causa raíz DINÁMICA */}
                <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "14px", padding: "1.4rem" }}>
                    <div style={{ fontSize: "0.72rem", fontWeight: 800, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", marginBottom: "0.75rem" }}>Cuellos de Botella (Tickets)</div>
                    {tesoreria.bottlenecks.length === 0 ? (
                        <div style={{ padding: '2rem', textAlign: 'center', color: 'rgba(255,255,255,0.2)', fontSize: '0.8rem' }}>Sin cuellos de botella detectados</div>
                    ) : (
                        tesoreria.bottlenecks.map(c => {
                            const pct = (c.count / (tesoreria.total || 1)) * 100;
                            return (
                                <div 
                                    key={c.label} 
                                    onClick={() => { setModalTitle(c.label); setModalTickets(c.tickets || []); setShowListModal(true); }}
                                    style={{ 
                                        marginBottom: "0.6rem", padding: "0.4rem 0.6rem", borderRadius: "8px", 
                                        cursor: "pointer", transition: "all 0.2s" 
                                    }}
                                    onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.05)"; }}
                                    onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
                                >
                                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.73rem", marginBottom: "3px" }}>
                                        <span style={{ color: "rgba(255,255,255,0.6)" }}>{c.label}</span>
                                        <span style={{ fontWeight: 800, color: c.color }}>{c.count}</span>
                                    </div>
                                    <div style={{ height: "5px", background: "rgba(255,255,255,0.06)", borderRadius: "999px", overflow: "hidden" }}>
                                        <div style={{ height: "100%", width: `${pct}%`, background: c.color, borderRadius: "999px", transition: "width 0.8s ease" }} />
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>

            {/* ══════════════════════════════════
                MÓDULO 3: PRODUCTIVIDAD RRHH
            ══════════════════════════════════ */}
            <SectionHeader icon={<Users size={16} />} title="Productividad & Clima Laboral (RRHH)" color="#8B5CF6" />
            <div style={{ display: "grid", gridTemplateColumns: "1.05fr 1.35fr 0.6fr", gap: "1rem", marginBottom: "1.25rem" }}>

                {/* Gráfico de Pastel de Productividad por Gestor */}
                <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "14px", padding: "1.4rem", display: "flex", flexDirection: "column" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.8rem" }}>
                        <div style={{ fontSize: "0.72rem", fontWeight: 800, color: "rgba(255,255,255,0.4)", textTransform: "uppercase" }}>Productividad por Gestor</div>
                        <div style={{ fontSize: "0.65rem", color: "rgba(255,255,255,0.25)", fontWeight: 600 }}>Soles Acumulados</div>
                    </div>
                    {productivityData.length === 0 ? (
                        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.76rem", color: "rgba(255,255,255,0.3)", minHeight: "200px" }}>
                            Sin datos de facturación en este periodo
                        </div>
                    ) : (
                        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "1rem" }}>
                            {/* Wrapper relativo para centrar el total */}
                            <div style={{ position: "relative", width: "100%", height: "180px" }}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={productivityData}
                                            cx="50%"
                                            cy="50%"
                                            innerRadius={55}
                                            outerRadius={75}
                                            paddingAngle={4}
                                            dataKey="value"
                                        >
                                            {productivityData.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={PRODUCTIVITY_COLORS[index % PRODUCTIVITY_COLORS.length]} />
                                            ))}
                                        </Pie>
                                        <Tooltip
                                            contentStyle={{
                                                background: "rgba(17, 24, 39, 0.95)",
                                                border: "1px solid rgba(255, 255, 255, 0.1)",
                                                borderRadius: "8px",
                                                fontSize: "0.7rem",
                                                color: "#fff"
                                            }}
                                            itemStyle={{ color: "#fff" }}
                                            formatter={(value: any) => [`S/. ${fmt(value)}`, "Productividad"]}
                                        />
                                    </PieChart>
                                </ResponsiveContainer>
                                <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", textAlign: "center", pointerEvents: "none", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                                    <span style={{ fontSize: "0.6rem", color: "rgba(255,255,255,0.4)", textTransform: "uppercase", fontWeight: 700, letterSpacing: "0.05em" }}>Total</span>
                                    <div style={{ fontSize: "1.05rem", fontWeight: 900, color: "white", marginTop: "1px" }}>
                                        S/. {fmt(productivityData.reduce((sum, item) => sum + item.value, 0))}
                                    </div>
                                </div>
                            </div>
                            {/* Nombres posicionados abajo */}
                            <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "0.5rem", borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: "0.8rem" }}>
                                {productivityData.map((item, index) => {
                                    const color = PRODUCTIVITY_COLORS[index % PRODUCTIVITY_COLORS.length];
                                    return (
                                        <div key={item.name} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", minWidth: 0 }}>
                                            <div style={{ display: "flex", alignItems: "center", gap: "6px", minWidth: 0 }}>
                                                <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: color, flexShrink: 0 }} />
                                                <span style={{ fontSize: "0.72rem", fontWeight: 700, color: "rgba(255,255,255,0.65)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{item.name}</span>
                                            </div>
                                            <span style={{ fontSize: "0.85rem", fontWeight: 900, color: "white", flexShrink: 0 }}>S/. {fmt(item.value)}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>

                {/* Gráfico de Barras Horizontales Agrupadas (Vigilancia de Productividad & Flujo) */}
                <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "14px", padding: "1.4rem", display: "flex", flexDirection: "column" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.8rem" }}>
                        <div style={{ fontSize: "0.72rem", fontWeight: 800, color: "rgba(255,255,255,0.4)", textTransform: "uppercase" }}>Vigilancia de Productividad</div>
                        <div style={{ fontSize: "0.65rem", color: "rgba(255,255,255,0.25)", fontWeight: 600 }}>Detalle Neto, IGV & Activos (Clic para ver)</div>
                    </div>
                    {stackedProductivityData.length === 0 ? (
                        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.76rem", color: "rgba(255,255,255,0.3)", minHeight: "200px" }}>
                            Sin datos de productividad en este periodo
                        </div>
                    ) : (
                        <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
                            <div style={{ width: "100%", height: "265px" }}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={stackedProductivityData} layout="vertical" margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#222" horizontal={false} />
                                        <XAxis 
                                            type="number" 
                                            stroke="rgba(255,255,255,0.3)" 
                                            fontSize={10} 
                                            tickLine={false} 
                                            tickFormatter={(v: any) => v >= 1000 ? `S/. ${(v/1000).toFixed(0)}k` : `S/. ${v}`}
                                        />
                                        <YAxis 
                                            dataKey="gestor" 
                                            type="category" 
                                            width={110} 
                                            stroke="rgba(255,255,255,0.3)" 
                                            fontSize={11} 
                                            tickLine={false} 
                                            style={{ fill: "#fff", fontWeight: 700 }}
                                            tickFormatter={(v: string) => v.split(" ")[0]}
                                        />
                                        <Tooltip
                                            content={({ active, payload, label }: any) => {
                                                if (active && payload && payload.length) {
                                                    const data = payload[0].payload;
                                                    const total = (data.netoCerrado || 0) + (data.igvCerrado || 0) + (data.montoActivos || 0);
                                                    return (
                                                        <div style={{
                                                            background: "rgba(17, 24, 39, 0.95)",
                                                            border: "1px solid rgba(255, 255, 255, 0.1)",
                                                            borderRadius: "8px",
                                                            padding: "0.8rem",
                                                            fontSize: "0.72rem",
                                                            color: "#fff",
                                                            boxShadow: "0 10px 15px -3px rgba(0,0,0,0.5)"
                                                        }}>
                                                            <div style={{ fontWeight: 800, marginBottom: "0.4rem", color: "#8B5CF6", textTransform: "uppercase" }}>{label}</div>
                                                            <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                                                                <div style={{ display: "flex", justifyContent: "space-between", gap: "1.5rem" }}>
                                                                    <span style={{ color: "rgba(255,255,255,0.6)" }}>Neto Cerrado:</span>
                                                                    <span style={{ fontWeight: 700, color: "#10B981" }}>S/. {fmt(data.netoCerrado || 0)}</span>
                                                                </div>
                                                                <div style={{ display: "flex", justifyContent: "space-between", gap: "1.5rem" }}>
                                                                    <span style={{ color: "rgba(255,255,255,0.6)" }}>IGV Cerrado (18%):</span>
                                                                    <span style={{ fontWeight: 700, color: "#3B82F6" }}>S/. {fmt(data.igvCerrado || 0)}</span>
                                                                </div>
                                                                <div style={{ display: "flex", justifyContent: "space-between", gap: "1.5rem" }}>
                                                                    <span style={{ color: "rgba(255,255,255,0.6)" }}>Activos / Ejecución:</span>
                                                                    <span style={{ fontWeight: 700, color: "#F59E0B" }}>S/. {fmt(data.montoActivos || 0)}</span>
                                                                </div>
                                                                <div style={{ borderTop: "1px solid rgba(255,255,255,0.1)", marginTop: "0.4rem", paddingTop: "0.4rem", display: "flex", justifyContent: "space-between", gap: "1.5rem" }}>
                                                                    <span style={{ fontWeight: 800, color: "#fff" }}>Total Bruto:</span>
                                                                    <span style={{ fontWeight: 900, color: "#fff" }}>S/. {fmt(total)}</span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                }
                                                return null;
                                            }}
                                        />
                                        <Legend verticalAlign="bottom" height={36} wrapperStyle={{ fontSize: '9px', paddingTop: '10px' }} />
                                        <Bar dataKey="netoCerrado" fill="#10B981" name="Neto Cerrado (S/.)">
                                            {stackedProductivityData.map((entry: any, index: number) => (
                                                <Cell 
                                                    key={`cell-${index}`} 
                                                    style={{ cursor: 'pointer' }}
                                                    onClick={() => {
                                                        const matchingGestora = rrhh.gestoras.find((x: any) => x.nombre === entry.gestor);
                                                        if (matchingGestora) {
                                                            setModalTitle(`Tickets de ${matchingGestora.nombre}`);
                                                            setModalTickets(matchingGestora.tickets || []);
                                                            setShowListModal(true);
                                                        }
                                                    }} 
                                                />
                                            ))}
                                            <LabelList dataKey="netoCerrado" position="insideLeft" fill="#fff" formatter={(v: any) => v > 0 ? `S/. ${fmt(v)}` : ''} style={{ fontSize: '9px', fontWeight: 900 }} />
                                        </Bar>
                                        <Bar dataKey="igvCerrado" fill="#3B82F6" name="IGV Cerrado (18%)">
                                            {stackedProductivityData.map((entry: any, index: number) => (
                                                <Cell 
                                                    key={`cell-${index}`} 
                                                    style={{ cursor: 'pointer' }}
                                                    onClick={() => {
                                                        const matchingGestora = rrhh.gestoras.find((x: any) => x.nombre === entry.gestor);
                                                        if (matchingGestora) {
                                                            setModalTitle(`Tickets de ${matchingGestora.nombre}`);
                                                            setModalTickets(matchingGestora.tickets || []);
                                                            setShowListModal(true);
                                                        }
                                                    }} 
                                                />
                                            ))}
                                            <LabelList dataKey="igvCerrado" position="insideLeft" fill="#fff" formatter={(v: any) => v > 0 ? `S/. ${fmt(v)}` : ''} style={{ fontSize: '9px', fontWeight: 900 }} />
                                        </Bar>
                                        <Bar dataKey="montoActivos" fill="#F59E0B" name="En Ejecución / Activos (S/.)">
                                            {stackedProductivityData.map((entry: any, index: number) => (
                                                <Cell 
                                                    key={`cell-${index}`} 
                                                    style={{ cursor: 'pointer' }}
                                                    onClick={() => {
                                                        const matchingGestora = rrhh.gestoras.find((x: any) => x.nombre === entry.gestor);
                                                        if (matchingGestora) {
                                                            setModalTitle(`Tickets de ${matchingGestora.nombre}`);
                                                            setModalTickets(matchingGestora.tickets || []);
                                                            setShowListModal(true);
                                                        }
                                                    }} 
                                                />
                                            ))}
                                            <LabelList dataKey="montoActivos" position="insideLeft" fill="#fff" formatter={(v: any) => v > 0 ? `S/. ${fmt(v)}` : ''} style={{ fontSize: '9px', fontWeight: 900 }} />
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    )}
                </div>

                {/* Gráfico de Distribución de Carga */}
                <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "14px", padding: "1.4rem", display: "flex", flexDirection: "column" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.8rem" }}>
                        <div style={{ fontSize: "0.72rem", fontWeight: 800, color: "rgba(255,255,255,0.4)", textTransform: "uppercase" }}>Distribución de Carga</div>
                        <div style={{ fontSize: "0.62rem", color: "rgba(255,255,255,0.25)", fontWeight: 600 }}>Clic en barras</div>
                    </div>
                    {rrhh.gestoras.length === 0 ? (
                        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.76rem", color: "rgba(255,255,255,0.3)", minHeight: "200px" }}>
                            Sin datos de asignación
                        </div>
                    ) : (
                        <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
                            <div style={{ width: "100%", height: "200px" }}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={rrhh.gestoras} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                                        <XAxis dataKey="nombre" stroke="rgba(255,255,255,0.3)" fontSize={9} tickLine={false} tickFormatter={(v: string) => v.split(" ")[0]} />
                                        <YAxis stroke="rgba(255,255,255,0.3)" fontSize={10} tickLine={false} />
                                        <Tooltip
                                            contentStyle={{
                                                background: "rgba(17, 24, 39, 0.95)",
                                                border: "1px solid rgba(255, 255, 255, 0.1)",
                                                borderRadius: "8px",
                                                fontSize: "0.72rem",
                                                color: "#fff"
                                            }}
                                            itemStyle={{ color: "#fff" }}
                                            cursor={{ fill: "rgba(255,255,255,0.05)" }}
                                        />
                                        <Legend verticalAlign="bottom" height={36} wrapperStyle={{ fontSize: '9px', paddingTop: '10px' }} />
                                        <Bar dataKey="nuevos" stackId="workload" fill="#EC4899" name="Nuevos">
                                            {rrhh.gestoras.map((entry: any, index: number) => (
                                                <Cell 
                                                    key={`cell-${index}`} 
                                                    style={{ cursor: 'pointer' }}
                                                    onClick={() => { setModalTitle(`Tickets de ${entry.nombre}`); setModalTickets(entry.tickets || []); setShowListModal(true); }} 
                                                />
                                            ))}
                                            <LabelList dataKey="nuevos" position="center" fill="#fff" formatter={(v: any) => v > 0 ? String(v) : ''} style={{ fontSize: '11px', fontWeight: 900 }} />
                                        </Bar>
                                        <Bar dataKey="enProceso" stackId="workload" fill="#00E396" name="En Proceso">
                                            {rrhh.gestoras.map((entry: any, index: number) => (
                                                <Cell 
                                                    key={`cell-${index}`} 
                                                    style={{ cursor: 'pointer' }}
                                                    onClick={() => { setModalTitle(`Tickets de ${entry.nombre}`); setModalTickets(entry.tickets || []); setShowListModal(true); }} 
                                                />
                                            ))}
                                            <LabelList dataKey="enProceso" position="center" fill="#fff" formatter={(v: any) => v > 0 ? String(v) : ''} style={{ fontSize: '11px', fontWeight: 900 }} />
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* ── MODAL DE LISTADO DE TICKETS (DRILL-DOWN) ── */}
            {showListModal && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(10px)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    zIndex: 10000, padding: '2rem'
                }} onClick={() => setShowListModal(false)}>
                    <div style={{
                        background: '#0F0F1A', border: '1px solid rgba(255,255,255,0.1)',
                        width: '100%', maxWidth: '900px', maxHeight: '85vh',
                        borderRadius: '24px', display: 'flex', flexDirection: 'column',
                        overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
                        position: 'relative'
                    }} onClick={e => e.stopPropagation()}>
                        
                        <div style={{ padding: '1.5rem 2rem', background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                                <h3 style={{ margin: 0, color: 'white', fontWeight: 900, fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <Activity size={20} color="#8B5CF6" /> {modalTitle}
                                </h3>
                                <div style={{ display: 'flex', gap: '1.5rem', marginTop: '6px' }}>
                                    <p style={{ margin: 0, fontSize: '0.8rem', color: 'rgba(255,255,255,0.4)', fontWeight: 600 }}>Total: {modalTickets.length} registros</p>
                                    <p style={{ margin: 0, fontSize: '0.8rem', color: '#10B981', fontWeight: 900 }}>
                                        SUMA TOTAL (NETO): S/ {fmt(modalTickets.reduce((acc, t) => acc + (t._monto || t._investmentTotalNet || t._utilityAmount || t._utilidadPendiente || 0), 0))}
                                    </p>
                                </div>
                            </div>
                            <button onClick={() => setShowListModal(false)} style={{ background: 'rgba(255,255,255,0.05)', border: 'none', color: 'white', width: '32px', height: '32px', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <ArrowRight size={18} style={{ transform: 'rotate(45deg)' }} />
                            </button>
                        </div>

                        <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem 2rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
                                <button
                                    onClick={() => {
                                        // Exportar a Excel/CSV
                                        const csvData = modalTickets.map((t: any) => {
                                            return {
                                                'N° Ticket': t.client_ticket_number || t.numeroTicketCliente || t.ticket_number || t.numeroTicket || t.ticketNum || (t.id ? String(t.id).substring(0, 8).toUpperCase() : 'N/A'),
                                                'Cliente': t.cliente?.nombre || t.cliente?.name || (typeof t.cliente === 'string' ? t.cliente : null) || t.clients?.name || t.client_name || t.clienteNombre || '',
                                                'Servicio': t.servicio || t.service_type || t.tipo_servicio || '',
                                                'Monto (S/)': t._monto || t._investmentTotalReal || t._utilidadPendiente || t.amount || 0,
                                                'Fecha': t._fecha || t.created_at || t.createdAt || t.updated_at || '',
                                            };
                                        });
                                        
                                        const headers = Object.keys(csvData[0] || {});
                                        const csvRows = [
                                            headers.join(';'),
                                            ...csvData.map(row => headers.map(h => `"${(row as any)[h]}"`).join(';'))
                                        ];
                                        const csvContent = csvRows.join('\n');
                                        const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
                                        const url = URL.createObjectURL(blob);
                                        const link = document.createElement('a');
                                        link.href = url;
                                        const tipoExport = modalTitle.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 30).toLowerCase() || 'reporte';
                                        link.download = `${tipoExport}_${new Date().toISOString().split('T')[0]}.csv`;
                                        link.click();
                                        URL.revokeObjectURL(url);
                                    }}
                                    style={{
                                        background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
                                        border: 'none', color: 'white', padding: '0.6rem 1.2rem',
                                        borderRadius: '10px', cursor: 'pointer', fontSize: '0.75rem',
                                        fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px',
                                        transition: 'all 0.2s'
                                    }}
                                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'}
                                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.transform = 'translateY(0)'}
                                >
                                    📊 Exportar CSV
                                </button>
                            </div>
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr style={{ textAlign: 'left', borderBottom: '2px solid rgba(255,255,255,0.05)' }}>
                                        <th style={{ padding: '12px 10px', fontSize: '0.75rem', fontWeight: 800, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase' }}>N° Ticket</th>
                                        <th style={{ padding: '12px 10px', fontSize: '0.75rem', fontWeight: 800, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase' }}>Cliente</th>
                                        <th style={{ padding: '12px 10px', fontSize: '0.75rem', fontWeight: 800, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase' }}>Servicio</th>
                                        <th style={{ padding: '12px 10px', fontSize: '0.75rem', fontWeight: 800, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase' }}>Monto (S/)</th>
                                        <th style={{ padding: '12px 10px', fontSize: '0.75rem', fontWeight: 800, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase' }}>Fecha</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {modalTickets.map((t: any, idx: number) => {
                                        const ticketNum = t.client_ticket_number || t.numeroTicketCliente || t.ticket_number || t.numeroTicket || t.ticketNum || (t.id ? String(t.id).substring(0, 8).toUpperCase() : 'N/A');
                                        const clientName = t.cliente?.nombre || t.cliente?.name || (typeof t.cliente === 'string' ? t.cliente : null) || t.clients?.name || t.client_name || t.clienteNombre || 'N/A';
                                        const servicio = t.servicio || t.service_type || t.tipo_servicio || 'N/A';
                                        const fecha = t._fecha || t.created_at || t.createdAt || t.updated_at || '';
                                        const monto = t._monto || t._investmentTotalReal || t._utilidadPendiente || t.amount || 0;
                                        
                                        return (
                                            <tr 
                                                key={(t.id || idx) + '-' + idx} 
                                                style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', transition: 'background 0.2s' }}
                                                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}
                                                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                            >
                                                <td style={{ padding: '14px 10px' }}>
                                                    <div style={{ color: 'white', fontWeight: 800, fontSize: '0.85rem', fontFamily: 'monospace' }}>
                                                        {ticketNum}
                                                    </div>
                                                </td>
                                                <td style={{ padding: '14px 10px' }}>
                                                    <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: '0.8rem', fontWeight: 600 }}>
                                                        {clientName}
                                                    </div>
                                                </td>
                                                <td style={{ padding: '14px 10px' }}>
                                                    <span style={{ 
                                                        padding: '4px 8px', borderRadius: '6px', fontSize: '0.65rem', fontWeight: 800, 
                                                        background: 'rgba(139,92,246,0.15)', 
                                                        color: '#A78BFA', 
                                                        border: '1px solid rgba(139,92,246,0.3)'
                                                    }}>
                                                        {servicio.toUpperCase()}
                                                    </span>
                                                </td>
                                                <td style={{ padding: '14px 10px' }}>
                                                    <div style={{ color: '#60A5FA', fontWeight: 900, fontSize: '0.9rem' }}>
                                                        S/ {fmt(monto)}
                                                    </div>
                                                </td>
                                                <td style={{ padding: '14px 10px' }}>
                                                    <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.75rem' }}>
                                                        {fecha ? new Date(fecha).toLocaleDateString('es-PE') : 'N/A'}
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* -- MODAL DE CAPITAL EXPUESTO / ADELANTADO -- */}
            {showCapitalModal && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(0,0,0,0.88)', backdropFilter: 'blur(12px)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    zIndex: 10001, padding: '1.5rem'
                }} onClick={() => setShowCapitalModal(false)}>
                    <div style={{
                        background: 'linear-gradient(135deg,#0F0F1A 0%,#1A0F2A 100%)',
                        border: '1px solid rgba(239,68,68,0.25)',
                        width: '100%', maxWidth: '1100px', maxHeight: '88vh',
                        borderRadius: '24px', display: 'flex', flexDirection: 'column',
                        overflow: 'hidden', boxShadow: '0 25px 60px rgba(239,68,68,0.15)'
                    }} onClick={e => e.stopPropagation()}>
                        <div style={{ padding: '1.5rem 2rem', background: 'rgba(239,68,68,0.06)', borderBottom: '1px solid rgba(239,68,68,0.15)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                                <h3 style={{ margin: 0, color: 'white', fontWeight: 900, fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <BanknoteIcon size={22} color="#EF4444" /> Capital Expuesto -- Adelantos a Especialistas
                                </h3>
                                <p style={{ margin: '6px 0 0', fontSize: '0.8rem', color: 'rgba(255,255,255,0.4)', fontWeight: 600 }}>
                                    {capitalExpuesto.tickets.length} ticket{capitalExpuesto.tickets.length !== 1 ? 's' : ''} con capital adelantado - Total S/ {fmt(capitalExpuesto.total)}
                                </p>
                            </div>
                            <button onClick={() => setShowCapitalModal(false)} style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', width: '36px', height: '36px', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem' }}>X</button>
                        </div>
                        {capitalExpuesto.enRiesgo > 0 && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.8rem 2rem', background: 'rgba(245,158,11,0.08)', borderBottom: '1px solid rgba(245,158,11,0.2)' }}>
                                <AlertTriangle size={16} color="#F59E0B" />
                                <span style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.7)', fontWeight: 600 }}>
                                    <strong style={{ color: '#F59E0B' }}>{capitalExpuesto.enRiesgo} ticket{capitalExpuesto.enRiesgo !== 1 ? 's' : ''}</strong> con +48h representan <strong style={{ color: '#EF4444' }}>S/ {fmt(capitalExpuesto.totalEnRiesgo)}</strong> en zona critica.
                                </span>
                            </div>
                        )}
                        <div style={{ flex: 1, overflowY: 'auto', padding: '0 0 1rem' }}>
                            {capitalExpuesto.tickets.length === 0 ? (
                                <div style={{ padding: '3rem', textAlign: 'center', color: 'rgba(255,255,255,0.3)' }}>
                                    <CheckCircle2 size={40} color="#10B981" style={{ margin: '0 auto 1rem', display: 'block' }} />
                                    <div style={{ fontSize: '1rem', fontWeight: 700, color: '#10B981' }}>Sin capital expuesto</div>
                                    <div style={{ fontSize: '0.8rem', marginTop: '0.3rem' }}>No hay adelantos en tickets activos.</div>
                                </div>
                            ) : (
                                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                    <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
                                        <tr style={{ background: '#0F0F1A', borderBottom: '2px solid rgba(255,255,255,0.05)' }}>
                                            {['ID Ticket', 'Gestora', 'Agencia / Sede', 'Especialista', 'Monto Adelantado', 'Estado', 'Aging'].map(h => (
                                                <th key={h} style={{ padding: '14px 12px', fontSize: '0.7rem', fontWeight: 800, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', textAlign: 'left', letterSpacing: '0.05em' }}>{h}</th>
                                            ))}
                                            <th style={{ padding: '14px 4px' }}></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {capitalExpuesto.tickets.map((t: any) => {
                                            const agingHours = Math.floor(t._ageH);
                                            const agingDays = Math.floor(t._ageH / 24);
                                            const agingLabel = agingDays >= 1 ? `${agingDays}d ${agingHours % 24}h` : `${agingHours}h`;
                                            const agingCol = t._ageH >= 72 ? '#EF4444' : t._ageH >= 48 ? '#F59E0B' : '#10B981';
                                            const rowBg = t._isRiesgo ? 'rgba(239,68,68,0.04)' : 'transparent';
                                            const rowBorder = t._isRiesgo ? 'rgba(239,68,68,0.12)' : 'rgba(255,255,255,0.03)';
                                            const estadoLabel = (t.estadoId || 'nuevo').replace(/_/g, ' ').toUpperCase();
                                            return (
                                                <tr 
                                                    key={t.id} 
                                                    onClick={() => setSelectedTicket(t)}
                                                    style={{ borderBottom: `1px solid ${rowBorder}`, background: rowBg, cursor: 'pointer' }}
                                                    onMouseEnter={e => e.currentTarget.style.background = t._isRiesgo ? 'rgba(239,68,68,0.08)' : 'rgba(255,255,255,0.02)'}
                                                    onMouseLeave={e => e.currentTarget.style.background = rowBg}
                                                >
                                                    <td style={{ padding: '14px 12px' }}>
                                                        <div style={{ fontWeight: 800, fontSize: '0.82rem', color: t._isRiesgo ? '#FCA5A5' : 'white', fontFamily: 'monospace' }}>
                                                            {t.numeroTicketCliente || String(t.id || '').substring(0, 8).toUpperCase()}
                                                        </div>
                                                        <div style={{ fontSize: '0.62rem', color: 'rgba(255,255,255,0.3)', marginTop: '2px' }}>
                                                            {new Date(t.createdAt || t.created_at).toLocaleDateString('es-PE')}
                                                        </div>
                                                    </td>
                                                    <td style={{ padding: '14px 12px' }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                            <div style={{ width: '26px', height: '26px', borderRadius: '50%', background: 'linear-gradient(135deg,#8B5CF6,#6366F1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.65rem', fontWeight: 900, color: 'white', flexShrink: 0 }}>
                                                                {(t._gestoraName || '?').substring(0, 2).toUpperCase()}
                                                            </div>
                                                            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'rgba(255,255,255,0.85)' }}>{t._gestoraName}</span>
                                                        </div>
                                                    </td>
                                                    <td style={{ padding: '14px 12px' }}>
                                                        <div style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.8)', fontWeight: 600 }}>{t.cliente?.nombre || String.fromCharCode(8212)}</div>
                                                        <div style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.35)', marginTop: '2px' }}>{t._sede}</div>
                                                    </td>
                                                    <td style={{ padding: '14px 12px' }}>
                                                        <span style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.7)', fontWeight: 600 }}>{t._especialista}</span>
                                                    </td>
                                                    <td style={{ padding: '14px 12px' }}>
                                                        <div style={{ fontSize: '1rem', fontWeight: 900, color: t._isRiesgo ? '#EF4444' : '#F59E0B' }}>S/ {fmt(t._totalAdelantado)}</div>
                                                        <div style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.3)', marginTop: '2px' }}>{t._pagos.length} pago{t._pagos.length !== 1 ? 's' : ''}</div>
                                                    </td>
                                                    <td style={{ padding: '14px 12px' }}>
                                                        <span style={{ padding: '3px 8px', borderRadius: '6px', fontSize: '0.62rem', fontWeight: 800, background: t._isRiesgo ? 'rgba(239,68,68,0.15)' : 'rgba(255,255,255,0.05)', color: t._isRiesgo ? '#FCA5A5' : 'rgba(255,255,255,0.6)', border: t._isRiesgo ? '1px solid rgba(239,68,68,0.3)' : '1px solid rgba(255,255,255,0.08)', whiteSpace: 'nowrap' }}>
                                                            {estadoLabel}
                                                        </span>
                                                    </td>
                                                    <td style={{ padding: '14px 12px' }}>
                                                        <div style={{ fontWeight: 900, fontSize: '0.88rem', color: agingCol }}>{agingLabel}</div>
                                                        <div style={{ width: '50px', height: '3px', background: 'rgba(255,255,255,0.05)', borderRadius: '2px', marginTop: '4px' }}>
                                                            <div style={{ width: `${Math.min(t._ageH / 72 * 100, 100)}%`, height: '100%', background: agingCol, borderRadius: '2px' }} />
                                                        </div>
                                                    </td>
                                                    <td style={{ padding: '14px 8px' }}>
                                                        <Link prefetch={false} href={`/dashboard/admin/tickets?ticketId=${t.id}`} onClick={() => setShowCapitalModal(false)}
                                                            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '30px', height: '30px', borderRadius: '8px', background: 'rgba(255,255,255,0.05)', color: 'white', transition: 'all 0.2s' }}
                                                            onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.2)'}
                                                            onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)'}
                                                        >
                                                            <ChevronRight size={14} />
                                                        </Link>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </div>
                </div>
            )}

            <SectionHeader icon={<Zap size={16} />} title="Acceso Rápido a Módulos" color="#FF6600" />
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(200px,1fr))", gap: "0.75rem", marginBottom: '2rem' }}>
                {[
                    { href: "/dashboard/admin/tickets", label: "Tickets", sub: "Control operativo", icon: Activity, color: "#8B5CF6" },
                    { href: "/dashboard/admin/payments", label: "Tesorería", sub: "Pagos & liquidaciones", icon: DollarSign, color: "#10B981" },
                    { href: "/dashboard/admin/technicians", label: "Especialistas", sub: "Directorio de técnicos", icon: Users, color: "#3B82F6" },
                    { href: "/dashboard/admin/routing", label: "Enrutamiento", sub: "Asignación de gestoras", icon: Target, color: "#F59E0B" },
                    { href: "/dashboard/admin/reportes", label: "Reportes", sub: "Análisis detallado", icon: BarChart3, color: "#EF4444" },
                    { href: "/dashboard/admin/clients", label: "Clientes", sub: "Directorio corporativo", icon: CheckCircle2, color: "#06B6D4" },
                        ].map(item => {
                    const Icon = item.icon;
                    return (
                        <Link key={item.href} prefetch={false} href={item.href} style={{
                            background: `${item.color}08`, border: `1px solid ${item.color}20`,
                            borderRadius: "12px", padding: "1rem 1.1rem",
                            display: "flex", alignItems: "center", gap: "0.75rem",
                            textDecoration: "none", transition: "all 0.2s",
                            color: "inherit"
                        }}
                            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = `${item.color}15`; (e.currentTarget as HTMLElement).style.borderColor = `${item.color}40`; }}
                            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = `${item.color}08`; (e.currentTarget as HTMLElement).style.borderColor = `${item.color}20`; }}
                        >
                            <div style={{ width: "38px", height: "38px", borderRadius: "10px", background: `${item.color}18`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                                <Icon size={17} color={item.color} />
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: "0.85rem", fontWeight: 700, color: "white" }}>{item.label}</div>
                                <div style={{ fontSize: "0.72rem", color: "rgba(255,255,255,0.4)" }}>{item.sub}</div>
                            </div>
                            <ArrowRight size={14} color="rgba(255,255,255,0.25)" />
                        </Link>
                    );
                })}
            </div>

            {/* ── MODAL FLOTANTE DE DETALLE DE TICKET ── */}
            {selectedTicket && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 11000, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }}>
                     <TicketWindow 
                        ticket={selectedTicket} 
                        onClose={() => setSelectedTicket(null)} 
                        onUpdate={handleUpdateTicket}
                    />
                </div>
            )}
        </div>
    );
}

function SectionHeader({ icon, title, color }: { icon: React.ReactNode; title: string; color: string }) {
    return (
        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginBottom: "0.75rem", marginTop: "0.25rem" }}>
            <div style={{ width: "28px", height: "28px", borderRadius: "8px", background: `${color}18`, display: "flex", alignItems: "center", justifyContent: "center", color }}>
                {icon}
            </div>
            <span style={{ fontSize: "0.82rem", fontWeight: 800, color: "rgba(255,255,255,0.6)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{title}</span>
            <div style={{ flex: 1, height: "1px", background: "rgba(255,255,255,0.05)" }} />
        </div>
    );
}
