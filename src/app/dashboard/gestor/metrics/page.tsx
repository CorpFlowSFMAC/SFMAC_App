"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
    Plus, Search, CheckCircle2, Zap, MapPin, TrendingUp, TrendingDown, 
    Target, BarChart2, Activity, AlertTriangle, Flame, Timer, Trophy, 
    Users, ChevronRight, Gauge, Star, Award, BarChart3, Wrench
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import GestorTurnoWidget from "@/components/GestorTurnoWidget";
import CreateTicketWizard from "@/app/dashboard/admin/tickets/CreateTicketWizard";
import TicketWindow from "@/app/dashboard/admin/tickets/TicketWindow";
import AdminTicketsPage from "@/app/dashboard/admin/tickets/page";
import { useAppData } from "@/lib/AppDataContext";
import { findGestoraByEmail } from "@/lib/useQueryHooks";
import { getServiceById, SERVICE_TYPES, SKILL_ICONS, SKILL_COLORS } from "@/lib/serviceTypes";
import { TICKET_STATES, normalizeStateId } from "@/lib/ticketStates";
import { formatSoles, round2 } from "@/lib/formatters";
import { calculateTicketFinances } from "@/lib/calculations";
import { ZONES } from "@/lib/zones";

import {
    ResponsiveContainer,
    BarChart as ReChartsBarChart,
    Bar,
    XAxis,
    YAxis,
    Tooltip as ReChartsTooltip,
    Legend as ReChartsLegend,
    CartesianGrid
} from "recharts";

// ── SLA Constants ─────────────────────────────
const SLA_HOURS = 72;
const BACKLOG_HOURS = 24;
const TEAM_BENCHMARK_MTTR = 18; // horas promedio de meta (mock)
const APPROVED_EXEC_STATES = ["cotizacion_aprobada", "en_ejecucion", "documentacion_enviada", "por_liquidar", "requiere_revision_admin", "ticket_cerrado"];

// ── Time helpers ──────────────────────────────
function hoursAgo(dateStr: string): number {
    return (Date.now() - new Date(dateStr).getTime()) / 3_600_000;
}

function formatHours(h: number): string {
    if (h < 1) return `${Math.round(h * 60)}m`;
    if (h < 24) return `${h.toFixed(1)}h`;
    return `${(h / 24).toFixed(1)}d`;
}

function getSlaStatus(createdAt: string): "ok" | "warning" | "critical" | "expired" {
    const hours = hoursAgo(createdAt);
    if (hours >= SLA_HOURS) return "expired";
    if (hours >= SLA_HOURS - 12) return "critical";
    if (hours >= SLA_HOURS - 24) return "warning";
    return "ok";
}

// ── Quote of the day ──────────────────────────
const QUOTES = [
    "El éxito es la suma de pequeños esfuerzos repetidos día tras día.",
    "La excelencia no es un acto, sino un hábito.",
    "Cada ticket resuelto es una promesa cumplida al cliente.",
    "Tu agilidad de hoy es la confianza del cliente de mañana.",
    "Los problemas son oportunidades disfrazadas de trabajo urgente."
];

// ── SLA Gauge Component (pure SVG) ────────
function SlaGauge({ pct }: { pct: number }) {
    const r = 50, cx = 70, cy = 70;
    const circumference = Math.PI * r; // half-circle
    const offset = circumference * (1 - Math.min(pct, 100) / 100);
    const color = pct >= 90 ? "#10B981" : pct >= 70 ? "#F59E0B" : "#EF4444";

    return (
        <svg width="140" height="90" viewBox="0 0 140 90">
            {/* Track */}
            <path
                d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
                fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="10" strokeLinecap="round"
            />
            {/* Fill */}
            <path
                d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
                fill="none" stroke={color} strokeWidth="10" strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={offset}
                style={{ transition: "stroke-dashoffset 1.2s ease, stroke 0.5s" }}
            />
            {/* Center text */}
            <text x={cx} y={cy - 10} textAnchor="middle" fontSize="20" fontWeight="900" fill={color}>
                {Math.round(pct)}%
            </text>
            <text x={cx} y={cy + 8} textAnchor="middle" fontSize="9" fill="rgba(255,255,255,0.5)" fontWeight="600">
                SLA Actual
            </text>
        </svg>
    );
}

// ── Utility Gauge Component ──────────────────
function UtilityGauge({ pct }: { pct: number }) {
    const r = 50, cx = 70, cy = 70;
    const circumference = Math.PI * r;
    const offset = circumference * (1 - Math.min(pct, 100) / 100);
    const color = "#10B981"; // Emerald-600

    return (
        <svg width="140" height="90" viewBox="0 0 140 90">
            {/* Track */}
            <path
                d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
                fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="10" strokeLinecap="round"
            />
            {/* Fill */}
            <path
                d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
                fill="none" stroke={color} strokeWidth="10" strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={offset}
                style={{ transition: "stroke-dashoffset 1.2s ease, stroke 0.5s" }}
            />
            {/* Center text */}
            <text x={cx} y={cy - 10} textAnchor="middle" fontSize="20" fontWeight="900" fill={color}>
                {Math.round(pct)}%
            </text>
            <text x={cx} y={cy + 8} textAnchor="middle" fontSize="9" fill="rgba(255,255,255,0.5)" fontWeight="600">
                Meta Utilidad
            </text>
        </svg>
    );
}

// ── Relative Progress Bar ─────────────────────
function RelativeBar({ value, benchmark, label, color }: { value: number; benchmark: number; label: string; color: string }) {
    const pct = Math.min((value / Math.max(benchmark * 1.5, 1)) * 100, 100);
    const benchmarkPct = Math.min((benchmark / Math.max(benchmark * 1.5, 1)) * 100, 100);
    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem" }}>
                <span style={{ color: "rgba(255,255,255,0.6)", fontWeight: 600 }}>{label}</span>
                <span style={{ color, fontWeight: 800 }}>{formatHours(value)} <span style={{ color: "rgba(255,255,255,0.4)", fontWeight: 400 }}>/ meta {formatHours(benchmark)}</span></span>
            </div>
            <div style={{ height: "8px", background: "rgba(255,255,255,0.08)", borderRadius: "999px", position: "relative", overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: "999px", transition: "width 1s ease" }} />
                {/* Benchmark marker */}
                <div style={{
                    position: "absolute", top: 0, left: `${benchmarkPct}%`,
                    width: "2px", height: "100%", background: "rgba(255,255,255,0.3)", opacity: 0.5
                }} />
            </div>
        </div>
    );
}

// ════════════════════════════════════════════════
// MAIN DASHBOARD
// ════════════════════════════════════════════════
interface GestorPageProps {
    tab?: 'dashboard' | 'tickets' | 'technicians' | 'reportes';
}

export default function GestorDashboard({ tab }: GestorPageProps) {
    const {
        tickets: rawTickets,
        loadingTickets: loading,
        createTicket,
        updateTicket,
        gestoras,
        gestorasTargets,
        technicians,
        userEmail,
        activeGestora,
        isAdmin
    } = useAppData();

    const myGestoraId = activeGestora?.id || null;
    const myGestoraNombre = activeGestora?.name || activeGestora?.nombre || null;
    const authEmail = userEmail;

    const [showWizard, setShowWizard] = useState(false);
    const [openTicketIds, setOpenTicketIds] = useState<string[]>([]);
    const [activeView, setActiveView] = useState<"dashboard" | "tickets" | "technicians" | "reportes">(() => { return (tab as any) || "dashboard"; });
    const [mounted, setMounted] = useState(false);

    // Control de montaje para Recharts
    useEffect(() => {
        setMounted(true);
    }, []);

    // Leer parámetro de vista desde URL
    useEffect(() => {
        if (typeof window !== 'undefined') {
            const params = new URLSearchParams(window.location.search);
            const view = params.get('view');
            if (view === 'tickets' || view === 'reportes' || view === 'technicians') {
                setActiveView(view);
            }
        }
    }, []);

    // Cambiar vista según parámetro
    const switchView = (view: "dashboard" | "tickets" | "technicians" | "reportes") => {
        setActiveView(view);
        if (typeof window !== 'undefined') {
            const url = new URL(window.location.href);
            url.searchParams.set('view', view);
            window.history.pushState({}, '', url.toString());
        }
    };

    // ── Filters ──
    const [dateFilter, setDateFilter] = useState<"today" | "week" | "month" | "all">("week");
    const [priorityFilter, setPriorityFilter] = useState<"" | "Alta" | "Media" | "Baja">("");
    const [serviceFilter, setServiceFilter] = useState("");
    const [searchTerm, setSearchTerm] = useState("");

    const quote = useMemo(() => QUOTES[new Date().getDay() % QUOTES.length], []);
    const now = useMemo(() => new Date(), []);


    const handleCreateTicket = async (ticketData: any) => {
        try {
            await createTicket(ticketData);
            setShowWizard(false);
        } catch (err) {
            alert("Error al crear el ticket en la nube.");
        }
    };

    // ── Filter raw tickets by active gestor ──
    const tickets = useMemo(() => {
        if (!rawTickets || rawTickets.length === 0) return [];
        
        // Si el usuario es administrador, ve todos los tickets
        if (isAdmin) {
            return rawTickets;
        }

        if (!authEmail) return [];

        const emailLower = authEmail.toLowerCase().trim();

        // Buscar gestora en el listado de gestoras con lógica fuzzy
        const myGestora = findGestoraByEmail(gestoras, authEmail);
        const myGestoraId = myGestora?.id;

        return rawTickets.filter((t: any) => {
            const tGestoraEmail = t.gestora?.email || t.gestoras?.email || '';
            const matchDirectEmail = tGestoraEmail.toLowerCase().trim() === emailLower;
            const matchFuzzyEmail = myGestora && tGestoraEmail.toLowerCase().includes('portocarrero') && emailLower.includes('portocarrero');
            const matchFuzzyEmailMarin = myGestora && tGestoraEmail.toLowerCase().includes('marin') && emailLower.includes('marin');
            
            if (matchDirectEmail || matchFuzzyEmail || matchFuzzyEmailMarin) {
                return true;
            }

            // 2. Coincidencia por ID de gestora asignada si lo tenemos
            if (myGestoraId) {
                const assignedGestoraId = t.gestora_id || t.metadata?.gestora_id;
                if (assignedGestoraId && assignedGestoraId === myGestoraId) {
                    return true;
                }

                // 3. Cascada (Sede / Zona / Cliente)
                if (t.branch_offices?.gestora_asignada_id === myGestoraId) return true;
                if (t.branch_offices?.zonas?.gestora_asignada_id === myGestoraId) return true;
                if (t.clients?.gestora_asignada_id === myGestoraId ||
                    t.branch_offices?.clients?.gestora_asignada_id === myGestoraId) {
                    return true;
                }
            }

            return false;
        });
    }, [rawTickets, authEmail, gestoras, isAdmin]);

    const isVisibleForMe = useCallback((t: any) => {
        return true; // Already pre-filtered at root
    }, []);

    const toNum = (val: any): number => {
        if (typeof val === "number") return val;
        if (typeof val === "string") return parseFloat(val.replace(/[^0-9.-]/g, "")) || 0;
        return 0;
    };

    const isInDateRange = useCallback((dateStr: string) => {
        const d = new Date(dateStr);
        const diff = (now.getTime() - d.getTime()) / 86_400_000;
        if (dateFilter === "today") return diff < 1;
        if (dateFilter === "week") return diff < 7;
        if (dateFilter === "month") return diff < 30;
        return true;
    }, [dateFilter, now]);

    // ── Filtered tickets for the period ──
    const periodTickets = useMemo(() =>
        tickets.filter((t: any) => isInDateRange(t.createdAt || t.created_at || now.toISOString())),
        [tickets, isInDateRange, now]
    );

    // ── Financial Metrics Calculation ──
    const financialMetrics = useMemo(() => {
        let totalInversion = 0;
        let totalFacturacion = 0;
        let totalUtilidad = 0;

        // Evaluamos TODOS los tickets del gestor, no solo los creados en el periodo (periodTickets),
        // porque queremos depósitos hechos hoy (aunque el ticket sea viejo) y tickets cerrados hoy (aunque el ticket sea viejo).
        tickets.forEach((t: any) => {
            const finances = calculateTicketFinances(t, t.costos || []);
            
            // Inversión: Sumamos únicamente los costos (depósitos confirmados) cuya fecha cae dentro del rango
            const confirmedCosts = [...finances.laborItems, ...finances.operatingItems];
            confirmedCosts.forEach((c: any) => {
                const cDate = c.fecha_pago || c.fecha || c.date || c.created_at || t.createdAt || t.created_at;
                if (isInDateRange(cDate || now.toISOString())) {
                    totalInversion += c.monto;
                }
            });

            // Facturación y Utilidad: Solo para tickets cerrados cuya FECHA DE CIERRE cae en el periodo
            const state = normalizeStateId(t.estadoId || t.status_id);
            if (state === "ticket_cerrado") {
                const closureDate = t.fechaPagoFinal || t.closure_date || t.updated_at || t.createdAt || t.created_at;
                if (isInDateRange(closureDate || now.toISOString())) {
                    totalFacturacion += finances.netIncome;
                    totalUtilidad += finances.realProfitability;
                }
            }
        });

        return {
            inversion: totalInversion,
            facturacion: totalFacturacion,
            utilidad: totalUtilidad
        };
    }, [tickets, isInDateRange, now]);

    // ── Month Utility Target Percent ──
    const utilityTargetPercent = useMemo(() => {
        const activeGestoraId = myGestoraId || findGestoraByEmail(gestoras, authEmail)?.id || null;
        if (!activeGestoraId) return 0;
        const now2 = new Date();
        const month = now2.getMonth();
        const year = now2.getFullYear();
        const monthKey2 = `${year}-${String(month + 1).padStart(2, '0')}`;
        const startOfMonth = new Date(year, month, 1);
        const endOfMonth = new Date(year, month + 1, 0, 23, 59, 59);
        const gestoraObj = gestoras.find(g => g.id === activeGestoraId);
        const targetObj = gestorasTargets.find(tg => tg.gestora_id === activeGestoraId && tg.month_key === monthKey2);
        const targetUtility = parseFloat(targetObj?.target_amount || gestoraObj?.meta_mensual_utilidad || "35000");

        const achievedTickets = tickets.filter(t => {
            if (!t.closure_date) return false;
            const d = new Date(t.closure_date);
            return d >= startOfMonth && d <= endOfMonth;
        });

        const utilityTotal = achievedTickets.reduce((a, t) => {
            const finances = calculateTicketFinances(t, t.costos || []);
            return a + Math.max(0, finances.realProfitability);
        }, 0);

        return targetUtility > 0 ? Math.min((utilityTotal / targetUtility) * 100, 100) : 0;
    }, [tickets, myGestoraId, authEmail, gestoras, gestorasTargets]);

    // ── Core KPI calculations ──
    const kpis = useMemo(() => {
        const closed = periodTickets.filter((t: any) =>
            normalizeStateId(t.estadoId) === "ticket_cerrado"
        );
        const open = periodTickets.filter((t: any) =>
            !["ticket_cerrado", "ticket_rechazado", "ticket_cancelado"].includes(normalizeStateId(t.estadoId))
        );
        const total = periodTickets.length;

        // FRT: Average time from creation to first state advance (tecnico_asignado)
        // Simulate from available data
        const frtHours = open.length > 0
            ? open.reduce((s: number, t: any) => s + Math.min(hoursAgo(t.createdAt || t.created_at || now.toISOString()), 48), 0) / open.length
            : 0;

        // MTTR: Average resolution time for closed tickets
        const mttrHours = closed.length > 0
            ? closed.reduce((s: number, t: any) => {
                const created = t.createdAt || t.created_at;
                const closed_at = t.fechaPagoFinal || t.closure_date || t.updated_at;
                if (!created || !closed_at) return s;
                return s + Math.abs((new Date(closed_at).getTime() - new Date(created).getTime()) / 3_600_000);
            }, 0) / closed.length
            : 0;

        // SLA compliance
        const expiredOpen = open.filter((t: any) =>
            getSlaStatus(t.createdAt || t.created_at || now.toISOString()) === "expired"
        );
        const slaCompliance = total > 0
            ? ((total - expiredOpen.length) / total) * 100
            : 100;

        // Backlog (>24h without closed status)
        const backlog = open.filter((t: any) =>
            hoursAgo(t.createdAt || t.created_at || now.toISOString()) >= BACKLOG_HOURS
        );

        // Urgency breakdown
        const critical = open.filter((t: any) => getSlaStatus(t.createdAt || t.created_at || now.toISOString()) === "critical");
        const warning = open.filter((t: any) => getSlaStatus(t.createdAt || t.created_at || now.toISOString()) === "warning");

        return { closed, open, total, frtHours, mttrHours, slaCompliance, backlog, critical, warning, expiredOpen };
    }, [periodTickets, now]);

    // ── Top 5 Urgent tickets ──
    const top5Urgent = useMemo(() => {
        return tickets
            .filter((t: any) => isVisibleForMe(t) && !["ticket_cerrado", "ticket_rechazado", "ticket_cancelado"].includes(normalizeStateId(t.estadoId)))
            .map((t: any) => {
                const ageH = hoursAgo(t.createdAt || t.created_at || now.toISOString());
                const sla = getSlaStatus(t.createdAt || t.created_at || now.toISOString());
                return { ...t, _ageH: ageH, _sla: sla };
            })
            .sort((a: any, b: any) => b._ageH - a._ageH)
            .slice(0, 5);
    }, [tickets, isVisibleForMe, now]);

    // ── 7-day bar chart data ──
    const financialBarData = useMemo(() => {
        const days = Array.from({ length: 7 }, (_, i) => {
            const d = new Date(now);
            d.setDate(d.getDate() - (6 - i));
            return d;
        });
        return days.map(day => {
            const label = day.toLocaleDateString("es-PE", { weekday: "short", day: "numeric" });
            const dayTickets = tickets.filter((t: any) => {
                const c = new Date(t.createdAt || t.created_at || "");
                return c.toDateString() === day.toDateString();
            });

            let billing = 0;
            let profit = 0;

            dayTickets.forEach((t: any) => {
                const state = normalizeStateId(t.estadoId);
                const finances = calculateTicketFinances(t, t.costos || []);
                // Facturación y Utilidad generada solo sobre tickets cerrados
                if (state === "ticket_cerrado") {
                    billing += finances.netIncome;
                    profit += finances.realProfitability;
                }
            });

            return {
                label,
                "Facturación": round2(billing),
                "Utilidad": round2(profit)
            };
        });
    }, [tickets, now]);

    // ── Filtered tickets for list view ──
    const filteredTickets = useMemo(() => {
        const search = searchTerm.toLowerCase();
        return tickets.filter((t: any) => {
            if (!isVisibleForMe(t)) return false;

            const sid = normalizeStateId(t.estadoId);
            const isActive = !["ticket_cerrado", "ticket_rechazado", "ticket_cancelado"].includes(sid);

            const matchSearch =
                (t.cliente?.nombre || "").toLowerCase().includes(search) ||
                (t.descripcionProblema || "").toLowerCase().includes(search) ||
                (t.numeroTicketCliente || "").toLowerCase().includes(search);

            const matchPriority = !priorityFilter ||
                (priorityFilter === "Alta" && getSlaStatus(t.createdAt || now.toISOString()) !== "ok") ||
                priorityFilter === "Media" || priorityFilter === "Baja";

            const matchService = !serviceFilter || t.tipoServicio === serviceFilter;

            return isActive && matchSearch && matchPriority && matchService;
        });
    }, [tickets, searchTerm, priorityFilter, serviceFilter, isVisibleForMe, now]);

    const slaColor = kpis.slaCompliance >= 90 ? "#10B981" : kpis.slaCompliance >= 70 ? "#F59E0B" : "#EF4444";
    const mttrBetter = kpis.mttrHours > 0 && kpis.mttrHours < TEAM_BENCHMARK_MTTR;

    if (loading) {
        return (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100vh", background: "transparent", fontFamily: "Inter, system-ui, sans-serif" }}>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "1rem" }}>
                    <div style={{ width: 40, height: 40, border: "4px solid #ff6600", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
                    <p style={{ color: "rgba(255,255,255,0.6)", fontSize: "0.9rem", fontWeight: 600 }}>Cargando panel de rendimiento...</p>
                </div>
            </div>
        );
    }

    return (
        <div style={{ padding: "1.5rem 2rem", minHeight: "100vh", background: "transparent", fontFamily: "Inter, system-ui, sans-serif" }}>

            <GestorTurnoWidget />

            {/* ── HEADER ─────────────────────────────── */}
            <div style={{
                background: "linear-gradient(135deg, #1E1B4B 0%, #312E81 40%, #4338CA 100%)",
                borderRadius: "20px", padding: "1.5rem 2rem", marginBottom: "1.5rem",
                display: "flex", justifyContent: "space-between", alignItems: "center",
                boxShadow: "0 10px 40px rgba(67,56,202,0.3)"
            }}>
                <div style={{ display: "flex", gap: "1.25rem", alignItems: "center" }}>
                    <div style={{
                        width: "52px", height: "52px", borderRadius: "14px",
                        background: "rgba(255,255,255,0.12)", display: "flex",
                        alignItems: "center", justifyContent: "center", backdropFilter: "blur(4px)"
                    }}>
                        <Gauge size={26} color="white" />
                    </div>
                    <div>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                            <h1 style={{ color: "white", fontWeight: 900, fontSize: "1.4rem", margin: 0 }}>
                                Mi Dashboard de Rendimiento
                            </h1>
                            <span style={{
                                background: "rgba(255,255,255,0.15)", color: "white",
                                fontSize: "0.7rem", fontWeight: 700, padding: "2px 10px",
                                borderRadius: "999px", border: "1px solid rgba(255,255,255,0.2)"
                            }}>GESTORA</span>
                        </div>
                        <p style={{ color: "rgba(255,255,255,0.65)", fontSize: "0.82rem", margin: "4px 0 0", fontStyle: "italic" }}>
                            "{quote}"
                        </p>
                    </div>
                </div>

                {/* Header actions */}
                <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
                    <div style={{ display: "flex", background: "rgba(255,255,255,0.1)", borderRadius: "10px", padding: "3px" }}>
                        <button onClick={() => setActiveView("dashboard")} style={{
                            padding: "0.45rem 1rem", borderRadius: "8px", border: "none", cursor: "pointer", fontSize: "0.82rem", fontWeight: 700,
                            background: activeView === "dashboard" ? "rgba(255,255,255,0.9)" : "transparent",
                            color: activeView === "dashboard" ? "#4338CA" : "rgba(255,255,255,0.7)",
                            transition: "all 0.2s"
                        }}>
                            <BarChart2 size={13} style={{ marginRight: "0.3rem", verticalAlign: "middle" }} />
                            Métricas
                        </button>
                        <button onClick={() => setActiveView("tickets")} style={{
                            padding: "0.45rem 1rem", borderRadius: "8px", border: "none", cursor: "pointer", fontSize: "0.82rem", fontWeight: 700,
                            background: activeView === "tickets" ? "rgba(255,255,255,0.9)" : "transparent",
                            color: activeView === "tickets" ? "#4338CA" : "rgba(255,255,255,0.7)",
                            transition: "all 0.2s"
                        }}>
                            <Activity size={13} style={{ marginRight: "0.3rem", verticalAlign: "middle" }} />
                            Tickets ({filteredTickets.length})
                        </button>
                        <button onClick={() => setActiveView("technicians")} style={{
                            padding: "0.45rem 1rem", borderRadius: "8px", border: "none", cursor: "pointer", fontSize: "0.82rem", fontWeight: 700,
                            background: activeView === "technicians" ? "rgba(255,255,255,0.9)" : "transparent",
                            color: activeView === "technicians" ? "#4338CA" : "rgba(255,255,255,0.7)",
                            transition: "all 0.2s"
                        }}>
                            <Users size={13} style={{ marginRight: "0.3rem", verticalAlign: "middle" }} />
                            Técnicos ({technicians?.length || 0})
                        </button>
                        <button onClick={() => setActiveView("reportes")} style={{
                            padding: "0.45rem 1rem", borderRadius: "8px", border: "none", cursor: "pointer", fontSize: "0.82rem", fontWeight: 700,
                            background: activeView === "reportes" ? "rgba(255,255,255,0.9)" : "transparent",
                            color: activeView === "reportes" ? "#4338CA" : "rgba(255,255,255,0.7)",
                            transition: "all 0.2s"
                        }}>
                            <BarChart3 size={13} style={{ marginRight: "0.3rem", verticalAlign: "middle" }} />
                            Reportes
                        </button>
                    </div>
                    <button
                        onClick={() => setShowWizard(true)}
                        title="Crear nuevo ticket"
                        style={{
                            background: "linear-gradient(135deg,#FF6600,#FF8533)",
                            color: "white",
                            border: "none", borderRadius: "10px", padding: "0.55rem 1.2rem",
                            cursor: "pointer",
                            fontSize: "0.85rem", fontWeight: 700,
                            display: "flex", alignItems: "center", gap: "0.4rem",
                            boxShadow: "0 4px 15px rgba(255,102,0,0.4)",
                            transition: "all 0.2s"
                        }}
                    >
                        <Plus size={16} /> Nuevo Ticket
                    </button>
                </div>
            </div>

            {/* ── DATE/FILTER BAR ─ solo para dashboard view ─ */}
            {activeView === "dashboard" && (
            <div style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                background: "linear-gradient(135deg,rgba(255,255,255,0.04) 0%,rgba(255,255,255,0.01) 100%)",
                borderRadius: "12px", padding: "0.65rem 1.25rem",
                marginBottom: "1.25rem", border: "1px solid rgba(255,255,255,0.08)",
                boxShadow: "0 4px 20px rgba(0,0,0,0.25)"
            }}>
                <div style={{ display: "flex", gap: "0.35rem" }}>
                    {(["today", "week", "month", "all"] as const).map(f => (
                        <button key={f} onClick={() => setDateFilter(f)} style={{
                            padding: "0.35rem 0.9rem", borderRadius: "8px", border: "none", cursor: "pointer",
                            fontSize: "0.78rem", fontWeight: 700,
                            background: dateFilter === f ? "#ff6600" : "rgba(255,255,255,0.04)",
                            color: dateFilter === f ? "white" : "rgba(255,255,255,0.6)",
                            transition: "all 0.2s"
                        }}>
                            {{ today: "Hoy", week: "7 días", month: "30 días", all: "Todo" }[f]}
                        </button>
                    ))}
                </div>

                <div style={{ display: "flex", gap: "0.6rem", alignItems: "center" }}>
                    {/* Priority filter */}
                    <select
                        value={priorityFilter}
                        onChange={e => setPriorityFilter(e.target.value as any)}
                        style={{
                            padding: "0.35rem 0.8rem", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.08)",
                            fontSize: "0.78rem", cursor: "pointer", background: "rgba(255,255,255,0.05)",
                            color: "white", fontWeight: 600, outline: "none"
                        }}
                    >
                        <option value="" style={{ backgroundColor: "#020C1F", color: "white" }}>Todas las prioridades</option>
                        <option value="Alta" style={{ backgroundColor: "#020C1F", color: "white" }}>🔴 Alta (SLA en riesgo)</option>
                        <option value="Media" style={{ backgroundColor: "#020C1F", color: "white" }}>🟡 Media</option>
                        <option value="Baja" style={{ backgroundColor: "#020C1F", color: "white" }}>🟢 Baja</option>
                    </select>

                    {/* Service filter */}
                    <select
                        value={serviceFilter}
                        onChange={e => setServiceFilter(e.target.value)}
                        style={{
                            padding: "0.35rem 0.8rem", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.08)",
                            fontSize: "0.78rem", cursor: "pointer", background: "rgba(255,255,255,0.05)",
                            color: "white", fontWeight: 600, outline: "none"
                        }}
                    >
                        <option value="" style={{ backgroundColor: "#020C1F", color: "white" }}>Todos los servicios</option>
                        {SERVICE_TYPES.map(s => (
                            <option key={s.id} value={s.id} style={{ backgroundColor: "#020C1F", color: "white" }}>{s.nombreCorto}</option>
                        ))}
                    </select>

                    <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "8px", padding: "0.35rem 0.8rem" }}>
                        <Search size={13} color="rgba(255,255,255,0.4)" />
                        <input
                            type="text" placeholder="Buscar ticket..." value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            style={{ background: "transparent", border: "none", outline: "none", fontSize: "0.78rem", color: "white", width: "130px" }}
                        />
                    </div>
                </div>
            </div>
            )}

            {/* ════════════════════════════════════════
                DASHBOARD VIEW
            ════════════════════════════════════════ */}
            {activeView === "dashboard" && (
                <>
                    {/* ── METRICAS FINANCIERAS PRINCIPALES (Estilo Energético) ── */}
                    <div style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(3, 1fr)",
                        gap: "1.25rem",
                        marginBottom: "1.25rem"
                    }}>
                        {/* INVERSIÓN */}
                        <div style={{
                            background: "linear-gradient(135deg,rgba(255,255,255,0.04) 0%,rgba(255,255,255,0.01) 100%)",
                            borderRadius: "16px",
                            padding: "1.25rem 1.5rem",
                            borderLeft: "6px solid #F59E0B", // Amber-500 Naranja Enérgico
                            borderTop: "1px solid rgba(255,255,255,0.08)",
                            borderRight: "1px solid rgba(255,255,255,0.08)",
                            borderBottom: "1px solid rgba(255,255,255,0.08)",
                            boxShadow: "0 4px 20px rgba(0,0,0,0.25)",
                            display: "flex",
                            flexDirection: "column",
                            justifyContent: "space-between",
                            minHeight: "115px",
                            transition: "transform 0.2s",
                            cursor: "default"
                        }}
                            onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-3px)"; }}
                            onMouseLeave={e => { e.currentTarget.style.transform = ""; }}
                        >
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <span style={{ fontSize: "0.75rem", fontWeight: 800, color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                                    Inversión Ejecutada
                                </span>
                                <span style={{ background: "rgba(245,158,11,0.15)", color: "#F59E0B", padding: "2px 8px", borderRadius: "6px", fontSize: "0.68rem", fontWeight: 700, border: "1px solid rgba(245,158,11,0.2)" }}>
                                    Costos + Gastos
                                </span>
                            </div>
                            <div>
                                <div style={{ fontSize: "1.8rem", fontWeight: 900, color: "white", lineHeight: 1.1 }}>
                                    S/ {formatSoles(financialMetrics.inversion)}
                                </div>
                                <p style={{ fontSize: "0.7rem", color: "rgba(255,255,255,0.4)", margin: "4px 0 0" }}>
                                    Total de depósitos realizados
                                </p>
                            </div>
                        </div>

                        {/* FACTURACIÓN */}
                        <div style={{
                            background: "linear-gradient(135deg,rgba(255,255,255,0.04) 0%,rgba(255,255,255,0.01) 100%)",
                            borderRadius: "16px",
                            padding: "1.25rem 1.5rem",
                            borderLeft: "6px solid #4F46E5", // Indigo-600 Azul Eléctrico
                            borderTop: "1px solid rgba(255,255,255,0.08)",
                            borderRight: "1px solid rgba(255,255,255,0.08)",
                            borderBottom: "1px solid rgba(255,255,255,0.08)",
                            boxShadow: "0 4px 20px rgba(0,0,0,0.25)",
                            display: "flex",
                            flexDirection: "column",
                            justifyContent: "space-between",
                            minHeight: "115px",
                            transition: "transform 0.2s",
                            cursor: "default"
                        }}
                            onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-3px)"; }}
                            onMouseLeave={e => { e.currentTarget.style.transform = ""; }}
                        >
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <span style={{ fontSize: "0.75rem", fontWeight: 800, color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                                    Facturación Generada (Neto)
                                </span>
                                <span style={{ background: "rgba(79,70,229,0.15)", color: "#818CF8", padding: "2px 8px", borderRadius: "6px", fontSize: "0.68rem", fontWeight: 700, border: "1px solid rgba(79,70,229,0.2)" }}>
                                    Tickets Cerrados
                                </span>
                            </div>
                            <div>
                                <div style={{ fontSize: "1.8rem", fontWeight: 900, color: "white", lineHeight: 1.1 }}>
                                    S/ {formatSoles(financialMetrics.facturacion)}
                                </div>
                                <p style={{ fontSize: "0.7rem", color: "rgba(255,255,255,0.4)", margin: "4px 0 0" }}>
                                    Facturación de tickets finalizados
                                </p>
                            </div>
                        </div>

                        {/* UTILIDAD */}
                        <div style={{
                            background: "linear-gradient(135deg,rgba(255,255,255,0.04) 0%,rgba(255,255,255,0.01) 100%)",
                            borderRadius: "16px",
                            padding: "1.25rem 1.5rem",
                            borderLeft: "6px solid #10B981", // Emerald-500 Verde Esmeralda
                            borderTop: "1px solid rgba(255,255,255,0.08)",
                            borderRight: "1px solid rgba(255,255,255,0.08)",
                            borderBottom: "1px solid rgba(255,255,255,0.08)",
                            boxShadow: "0 4px 20px rgba(0,0,0,0.25)",
                            display: "flex",
                            flexDirection: "column",
                            justifyContent: "space-between",
                            minHeight: "115px",
                            transition: "transform 0.2s",
                            cursor: "default"
                        }}
                            onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-3px)"; }}
                            onMouseLeave={e => { e.currentTarget.style.transform = ""; }}
                        >
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <span style={{ fontSize: "0.75rem", fontWeight: 800, color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                                    Utilidad Real
                                </span>
                                {financialMetrics.utilidad >= 0 ? (
                                    <span style={{ background: "rgba(16,185,129,0.15)", color: "#10B981", padding: "2px 8px", borderRadius: "999px", fontSize: "0.65rem", fontWeight: 800, display: "flex", alignItems: "center", gap: "2px", border: "1px solid rgba(16,185,129,0.2)" }}>
                                        Margen Positivo <TrendingUp size={10} />
                                    </span>
                                ) : (
                                    <span style={{ background: "rgba(239,68,68,0.15)", color: "#EF4444", padding: "2px 8px", borderRadius: "999px", fontSize: "0.65rem", fontWeight: 800, display: "flex", alignItems: "center", gap: "2px", border: "1px solid rgba(239,68,68,0.2)" }}>
                                        Margen Negativo <TrendingDown size={10} />
                                    </span>
                                )}
                            </div>
                            <div>
                                <div style={{ fontSize: "1.8rem", fontWeight: 900, color: "#10B981", lineHeight: 1.1 }}>
                                    S/ {formatSoles(financialMetrics.utilidad)}
                                </div>
                                <p style={{ fontSize: "0.7rem", color: "rgba(255,255,255,0.4)", margin: "4px 0 0" }}>
                                    Retorno neto del gestor
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* ── KPI CARDS ───────────────────────── */}
                    <div style={{
                        display: "grid", gridTemplateColumns: "repeat(5, 1fr)",
                        gap: "1rem", marginBottom: "1.25rem"
                    }}>
                        {/* 1. Abiertos */}
                        <KpiCard
                            label="Tickets Activos"
                            value={kpis.open.length}
                            icon={<Activity size={18} color="#4338CA" />}
                            iconBg="#EEF2FF"
                            sub={`${kpis.total} en período`}
                            trend={null}
                        />
                        {/* 2. Cerrados hoy */}
                        <KpiCard
                            label="Cerrados (período)"
                            value={kpis.closed.length}
                            icon={<CheckCircle2 size={18} color="#10B981" />}
                            iconBg="#ECFDF5"
                            sub={`Resolución activa`}
                            trend={kpis.closed.length > 0 ? "up" : null}
                        />
                        {/* 3. FRT */}
                        <KpiCard
                            label="Tiempo 1ª Respuesta"
                            value={kpis.frtHours > 0 ? formatHours(kpis.frtHours) : "—"}
                            icon={<Timer size={18} color="#F59E0B" />}
                            iconBg="#FFF7ED"
                            sub={`Meta individual: 4h`}
                            trend={kpis.frtHours > 0 && kpis.frtHours < 4 ? "up" : kpis.frtHours >= 8 ? "down" : null}
                        />
                        {/* 4. MTTR */}
                        <KpiCard
                            label="MTTR (Resolución)"
                            value={kpis.mttrHours > 0 ? formatHours(kpis.mttrHours) : "—"}
                            icon={<Gauge size={18} color={mttrBetter ? "#10B981" : "#EF4444"} />}
                            iconBg={mttrBetter ? "#ECFDF5" : "#FEF2F2"}
                            sub={`Meta individual: ${formatHours(TEAM_BENCHMARK_MTTR)}`}
                            trend={mttrBetter ? "up" : kpis.mttrHours >= TEAM_BENCHMARK_MTTR ? "down" : null}
                        />
                        {/* 5. Backlog */}
                        <KpiCard
                            label="Backlog (+24h)"
                            value={kpis.backlog.length}
                            icon={<AlertTriangle size={18} color={kpis.backlog.length > 3 ? "#EF4444" : "#F59E0B"} />}
                            iconBg={kpis.backlog.length > 3 ? "#FEF2F2" : "#FFF7ED"}
                            sub={`${kpis.expiredOpen.length} SLA vencidos`}
                            trend={kpis.backlog.length > 3 ? "down" : kpis.backlog.length === 0 ? "up" : null}
                            alert={kpis.backlog.length > 3}
                        />
                    </div>

                    {/* ── CHARTS ROW ───────────────────────── */}
                    <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr 1fr", gap: "1.25rem", marginBottom: "1.25rem" }}>

                        {/* Bar Chart: Tickets por día */}
                        <div style={{
                            background: "linear-gradient(135deg,rgba(255,255,255,0.04) 0%,rgba(255,255,255,0.01) 100%)",
                            borderRadius: "16px", padding: "1.5rem",
                            border: "1px solid rgba(255,255,255,0.08)", boxShadow: "0 4px 20px rgba(0,0,0,0.25)"
                        }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
                                <h3 style={{ margin: 0, fontSize: "0.9rem", fontWeight: 800, color: "white", display: "flex", alignItems: "center", gap: "0.4rem" }}>
                                    <BarChart2 size={16} color="#ff6600" /> Rendimiento Financiero Reciente
                                </h3>
                                <div style={{ display: "flex", gap: "0.75rem", fontSize: "0.72rem", fontWeight: 700, color: "rgba(255,255,255,0.7)" }}>
                                    <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                                        <span style={{ width: "10px", height: "10px", borderRadius: "3px", background: "#ff6600", display: "inline-block" }} />
                                        Facturación Neto
                                    </span>
                                    <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                                        <span style={{ width: "10px", height: "10px", borderRadius: "3px", background: "#10B981", display: "inline-block" }} />
                                        Utilidad Real
                                    </span>
                                </div>
                            </div>
                            <div style={{ width: "100%", height: 300, minHeight: 300, position: "relative" }}>
                                {mounted && (
                                    <ResponsiveContainer width="100%" height="100%">
                                        <ReChartsBarChart data={financialBarData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.08)" />
                                            <XAxis dataKey="label" stroke="rgba(255,255,255,0.4)" fontSize={10} tickLine={false} />
                                            <YAxis stroke="rgba(255,255,255,0.4)" fontSize={10} tickLine={false} axisLine={false} />
                                            <ReChartsTooltip contentStyle={{ backgroundColor: "rgba(15, 23, 42, 0.95)", borderColor: "rgba(255,255,255,0.12)", borderRadius: "8px", color: "white" }} formatter={(value: any) => [`S/ ${formatSoles(Number(value))}`]} />
                                            <Bar dataKey="Facturación" fill="#ff6600" radius={[4, 4, 0, 0]} barSize={12} />
                                            <Bar dataKey="Utilidad" fill="#10B981" radius={[4, 4, 0, 0]} barSize={12} />
                                        </ReChartsBarChart>
                                    </ResponsiveContainer>
                                )}
                            </div>
                        </div>

                        {/* SLA & Meta Gauges */}
                        <div style={{
                            background: "linear-gradient(135deg,rgba(255,255,255,0.04) 0%,rgba(255,255,255,0.01) 100%)",
                            borderRadius: "16px", padding: "1.5rem",
                            border: "1px solid rgba(255,255,255,0.08)", boxShadow: "0 4px 20px rgba(0,0,0,0.25)",
                            display: "flex", flexDirection: "column", alignItems: "center"
                        }}>
                            <h3 style={{ margin: "0 0 1rem", fontSize: "0.9rem", fontWeight: 800, color: "white", display: "flex", alignItems: "center", gap: "0.4rem", width: "100%" }}>
                                <Target size={16} color="#ff6600" /> Eficiencia & Meta Financiera
                            </h3>
                            <div style={{ display: "flex", justifyContent: "space-around", width: "100%", gap: "10px" }}>
                                <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                                    <SlaGauge pct={kpis.slaCompliance} />
                                </div>
                                <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                                    <UtilityGauge pct={utilityTargetPercent} />
                                </div>
                            </div>
                            <div style={{ marginTop: "0.5rem", display: "flex", gap: "0.5rem", flexDirection: "row", width: "100%" }}>
                                <div style={{ flex: 1, display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.72rem", padding: "0.4rem 0.5rem", borderRadius: "8px", background: "rgba(239, 68, 68, 0.15)", border: "1px solid rgba(239, 68, 68, 0.2)" }}>
                                    <span style={{ color: "rgba(255,255,255,0.7)" }}>🔴 Críticos</span>
                                    <span style={{ fontWeight: 800, color: "#EF4444" }}>{kpis.critical.length}</span>
                                </div>
                                <div style={{ flex: 1, display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.72rem", padding: "0.4rem 0.5rem", borderRadius: "8px", background: "rgba(245, 158, 11, 0.15)", border: "1px solid rgba(245, 158, 11, 0.2)" }}>
                                    <span style={{ color: "rgba(255,255,255,0.7)" }}>🟡 Alerta</span>
                                    <span style={{ fontWeight: 800, color: "#F59E0B" }}>{kpis.warning.length}</span>
                                </div>
                            </div>
                        </div>

                        {/* Productividad relativa */}
                        <div style={{
                            background: "linear-gradient(135deg,rgba(255,255,255,0.04) 0%,rgba(255,255,255,0.01) 100%)",
                            borderRadius: "16px", padding: "1.5rem",
                            border: "1px solid rgba(255,255,255,0.08)", boxShadow: "0 4px 20px rgba(0,0,0,0.25)"
                        }}>
                            <h3 style={{ margin: "0 0 1.25rem", fontSize: "0.9rem", fontWeight: 800, color: "white", display: "flex", alignItems: "center", gap: "0.4rem" }}>
                                <Trophy size={16} color="#F59E0B" /> Objetivos de Rendimiento
                            </h3>
                            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                                <RelativeBar
                                    label="MTTR (menor = mejor)"
                                    value={kpis.mttrHours || 0}
                                    benchmark={TEAM_BENCHMARK_MTTR}
                                    color={mttrBetter ? "#10B981" : "#EF4444"}
                                />
                                <RelativeBar
                                    label="Backlog acumulado"
                                    value={kpis.backlog.length}
                                    benchmark={3}
                                    color={kpis.backlog.length <= 3 ? "#10B981" : "#EF4444"}
                                />
                                <RelativeBar
                                    label="Tickets cerrados"
                                    value={kpis.closed.length}
                                    benchmark={Math.max(kpis.total * 0.5, 1)}
                                    color="#ff6600"
                                />
                            </div>
                            <div style={{
                                marginTop: "1.25rem", padding: "0.6rem 0.9rem",
                                background: mttrBetter ? "rgba(16,185,129,0.15)" : "rgba(239,68,68,0.15)",
                                border: mttrBetter ? "1px solid rgba(16,185,129,0.25)" : "1px solid rgba(239,68,68,0.25)",
                                borderRadius: "10px", fontSize: "0.75rem",
                                color: mttrBetter ? "#10B981" : "#EF4444", fontWeight: 700,
                                display: "flex", gap: "0.4rem", alignItems: "center"
                            }}>
                                <Award size={14} />
                                {mttrBetter
                                    ? "¡Objetivo individual logrado! 🏆"
                                    : kpis.mttrHours === 0
                                        ? "Sin tickets cerrados aún — ¡a por ellos!"
                                        : "Por debajo del objetivo — hay oportunidad de mejora"}
                            </div>
                        </div>
                    </div>


                    {/* ── GOAL TRACKER ──────────────────────── */}
                    {myGestoraId && (() => {
                        const now2 = new Date();
                        const month = now2.getMonth();
                        const year = now2.getFullYear();
                        const monthKey2 = `${year}-${String(month + 1).padStart(2, '0')}`;
                        const startOfMonth = new Date(year, month, 1);
                        const endOfMonth = new Date(year, month + 1, 0, 23, 59, 59);
                        const daysLeft = endOfMonth.getDate() - now2.getDate();
                        const gestoraObj = gestoras.find(g => g.id === myGestoraId);
                        const targetObj = gestorasTargets.find(tg => tg.gestora_id === myGestoraId && tg.month_key === monthKey2);
                        const metaBono = parseFloat(targetObj?.meta_bono || gestoraObj?.meta_mensual_bono || "1500");
                        const targetUtility = parseFloat(targetObj?.target_amount || gestoraObj?.meta_mensual_utilidad || "35000");
                        const multiplier = parseFloat(targetObj?.bonus_multiplier || "0.1");
                        const baseLaboral = parseFloat(gestoraObj?.costo_laboral_mensual || "0");

                        const TRANSIT_S = ["cotizacion_aprobada", "en_ejecucion", "documentacion_enviada", "por_liquidar"];
                        const myNetUtil = (t: any) => {
                            return Math.max(0, calculateTicketFinances(t, t.costos || []).realProfitability);
                        };

                        const achievedTickets = tickets.filter(t => {
                            if (t.gestora_id !== myGestoraId) return false;
                            if (!t.closure_date) return false;
                            const d = new Date(t.closure_date);
                            return d >= startOfMonth && d <= endOfMonth;
                        });

                        const utilityTotal = achievedTickets.reduce((a, t) => a + myNetUtil(t), 0);
                        const percentAchieved = targetUtility > 0 ? Math.min((utilityTotal / targetUtility) * 100, 100) : 0;
                        const bonusEarned = percentAchieved >= 80 ? (utilityTotal / targetUtility) * (baseLaboral * multiplier) : 0;
                        const faltante = Math.max(0, metaBono - bonusEarned);

                        const impulsoTickets = tickets
                            .filter(t => t.gestora_id === myGestoraId && TRANSIT_S.includes(normalizeStateId(t.estadoId)) && !t.closure_date)
                            .map(t => ({ ...t, _utility: myNetUtil(t) }))
                            .sort((a: any, b: any) => b._utility - a._utility)
                            .slice(0, 5);

                        const barColor = percentAchieved >= 100 ? '#10B981' : percentAchieved >= 80 ? '#22C55E' : percentAchieved >= 50 ? '#F59E0B' : '#EF4444';

                        return (
                            <div style={{ marginBottom: '1.25rem', background: 'linear-gradient(135deg,rgba(255,255,255,0.04) 0%,rgba(255,255,255,0.01) 100%)', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 4px 20px rgba(0,0,0,0.25)', overflow: 'hidden' }}>
                                <div style={{ padding: '1rem 1.5rem', background: 'linear-gradient(135deg,#1E1B4B,#312E81)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                        <Target size={18} color="#A78BFA" />
                                        <span style={{ color: 'white', fontWeight: 800, fontSize: '0.9rem' }}>🎯 Meta del Mes — {monthKey2}</span>
                                    </div>
                                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                        {daysLeft <= 5 && (
                                            <span style={{ background: '#EF4444', color: 'white', fontSize: '0.72rem', fontWeight: 900, padding: '3px 10px', borderRadius: '99px', animation: 'pulse 2s infinite' }}>
                                                ⏰ {daysLeft}d restantes!
                                            </span>
                                        )}
                                        <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.75rem' }}>{Math.round(percentAchieved)}% logrado</span>
                                    </div>
                                </div>

                                <div style={{ padding: '1rem 1.5rem' }}>
                                    {/* Main progress bar */}
                                    <div style={{ marginBottom: '0.5rem', display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem' }}>
                                        <span style={{ color: 'rgba(255,255,255,0.7)', fontWeight: 600 }}>Progreso hacia bono de S/ {formatSoles(metaBono)}</span>
                                        <span style={{ color: barColor, fontWeight: 900 }}>S/ {formatSoles(bonusEarned)} ganado</span>
                                    </div>
                                    <div style={{ height: '10px', background: 'rgba(255,255,255,0.08)', borderRadius: '5px', overflow: 'hidden', marginBottom: '0.5rem', position: 'relative' }}>
                                        <div style={{ width: `${percentAchieved}%`, height: '100%', background: `linear-gradient(90deg,${barColor},${barColor}99)`, borderRadius: '5px', transition: 'width 1s ease' }} />
                                        <div style={{ position: 'absolute', top: 0, left: '80%', width: '2px', height: '100%', background: 'rgba(255,255,255,0.3)', opacity: 0.7 }} title="Mínimo 80% para bono" />
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: 'rgba(255,255,255,0.4)', marginBottom: '0.75rem' }}>
                                        <span>Utilidad neta lograda: S/ {formatSoles(utilityTotal)}</span>
                                        <span>↑ 80% min. para activar bono</span>
                                        <span>Meta: S/ {formatSoles(targetUtility)}</span>
                                    </div>

                                    {/* KPI row */}
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '0.75rem', marginBottom: faltante > 0 && impulsoTickets.length > 0 ? '0.75rem' : '0' }}>
                                        {[
                                            { label: 'Tickets Cerrados', val: achievedTickets.length, color: '#10B981' },
                                            { label: 'Bono Ganado', val: `S/ ${formatSoles(bonusEarned)}`, color: '#8B5CF6' },
                                            { label: faltante > 0 ? 'Faltante para meta' : '🎉 Meta Superada', val: faltante > 0 ? `S/ ${formatSoles(faltante)}` : `S/ ${formatSoles(metaBono)}`, color: faltante > 0 ? '#F59E0B' : '#10B981' }
                                        ].map((s, i) => (
                                            <div key={i} style={{ background: 'rgba(255,255,255,0.02)', borderRadius: '10px', padding: '0.6rem 0.9rem', border: '1px solid rgba(255,255,255,0.05)' }}>
                                                <div style={{ fontSize: '1rem', fontWeight: 900, color: s.color }}>{s.val}</div>
                                                <div style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.4)', fontWeight: 600, marginTop: '2px' }}>{s.label}</div>
                                            </div>
                                        ))}
                                    </div>

                                    {/* IMPULSO FINAL */}
                                    {faltante > 0 && impulsoTickets.length > 0 && (
                                        <div style={{ background: 'linear-gradient(135deg,rgba(139,92,246,0.15) 0%,rgba(109,40,217,0.05) 100%)', border: '1px solid rgba(139,92,246,0.3)', borderRadius: '12px', padding: '0.9rem 1rem' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                                                <Zap size={14} color="#A78BFA" />
                                                <span style={{ color: '#A78BFA', fontWeight: 900, fontSize: '0.82rem' }}>
                                                    IMPULSO FINAL — Cierra estos tickets para asegurar tu bono de S/ {formatSoles(metaBono)}
                                                </span>
                                            </div>
                                            {impulsoTickets.map((t: any, j: number) => (
                                                <div
                                                    key={j}
                                                    onClick={() => { if (!openTicketIds.includes(t.id)) setOpenTicketIds([...openTicketIds, t.id]); }}
                                                    style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 8px', background: 'rgba(255,255,255,0.04)', borderRadius: '8px', marginBottom: '4px', cursor: 'pointer', border: '1px solid rgba(255,255,255,0.08)' }}
                                                >
                                                    <div>
                                                        <span style={{ color: 'white', fontWeight: 700, fontSize: '0.8rem' }}>{t.numeroTicketCliente || t.id?.slice(0,8)}</span>
                                                        <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.72rem', marginLeft: '8px' }}>{normalizeStateId(t.estadoId).replace(/_/g,' ')}</span>
                                                    </div>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                        <span style={{ color: '#10B981', fontWeight: 900, fontSize: '0.82rem' }}>+S/ {formatSoles(t._utility)}</span>
                                                        <ChevronRight size={13} color="rgba(255,255,255,0.4)" />
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {faltante <= 0 && percentAchieved > 0 && (
                                        <div style={{ background: 'linear-gradient(135deg,rgba(16,185,129,0.15) 0%,rgba(4,120,87,0.05) 100%)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: '12px', padding: '0.75rem 1rem', textAlign: 'center' }}>
                                            <span style={{ color: '#10B981', fontWeight: 800, fontSize: '0.85rem' }}>🎉 ¡Felicidades! Tu bono de S/ {formatSoles(bonusEarned)} ha sido confirmado.</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })()}

                    {/* ── TOP 5 URGENT + PIPELINE ──────────── */}

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.25rem" }}>

                        {/* Top 5 urgentes */}
                        <div style={{
                            background: "linear-gradient(135deg,rgba(255,255,255,0.04) 0%,rgba(255,255,255,0.01) 100%)",
                            borderRadius: "16px", padding: "1.5rem",
                            border: "1px solid rgba(255,255,255,0.08)", boxShadow: "0 4px 20px rgba(0,0,0,0.25)"
                        }}>
                            <h3 style={{ margin: "0 0 1rem", fontSize: "0.9rem", fontWeight: 800, color: "white", display: "flex", alignItems: "center", gap: "0.4rem" }}>
                                <Flame size={16} color="#EF4444" /> Top 5 Tickets más Urgentes
                            </h3>
                            {top5Urgent.length === 0 ? (
                                <div style={{ textAlign: "center", padding: "2rem", color: "rgba(255,255,255,0.4)" }}>
                                    <CheckCircle2 size={32} style={{ margin: "0 auto 0.5rem" }} />
                                    <p style={{ margin: 0, fontSize: "0.85rem" }}>¡Sin urgencias! Excelente trabajo.</p>
                                </div>
                            ) : (
                                <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
                                    {top5Urgent.map((t: any, idx: number) => {
                                        const sla = t._sla as "ok" | "warning" | "critical" | "expired";
                                        const slaColors = { ok: "#10B981", warning: "#F59E0B", critical: "#EF4444", expired: "#7F1D1D" };
                                        const slaBg = { ok: "rgba(16,185,129,0.1)", warning: "rgba(245,158,11,0.1)", critical: "rgba(239,68,68,0.1)", expired: "rgba(127,29,29,0.2)" };
                                        const service = getServiceById(t.tipoServicio);
                                        return (
                                            <div
                                                key={t.id}
                                                onClick={() => { if (!openTicketIds.includes(t.id)) setOpenTicketIds([...openTicketIds, t.id]); }}
                                                style={{
                                                    display: "flex", alignItems: "center", gap: "0.75rem",
                                                    padding: "0.65rem 0.9rem", borderRadius: "10px", cursor: "pointer",
                                                    background: slaBg[sla], border: `1px solid ${slaColors[sla]}30`,
                                                    transition: "all 0.2s"
                                                }}
                                            >
                                                <span style={{
                                                    width: "24px", height: "24px", borderRadius: "50%",
                                                    background: slaColors[sla], color: "white",
                                                    display: "flex", alignItems: "center", justifyContent: "center",
                                                    fontSize: "0.7rem", fontWeight: 900, flexShrink: 0
                                                }}>{idx + 1}</span>
                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                    <div style={{ fontSize: "0.8rem", fontWeight: 700, color: "white", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                                        {t.cliente?.nombre || t.branch_offices?.clients?.name || "Sin cliente"}
                                                        {t.numeroTicketCliente && <span style={{ fontSize: "0.7rem", color: "rgba(255,255,255,0.4)", marginLeft: "6px" }}>#{t.numeroTicketCliente}</span>}
                                                    </div>
                                                    <div style={{ fontSize: "0.72rem", color: "rgba(255,255,255,0.5)" }}>
                                                        {service?.nombreCorto || "—"} · {formatHours(t._ageH)} transcurrido
                                                    </div>
                                                </div>
                                                <span style={{
                                                    fontSize: "0.68rem", fontWeight: 800, padding: "2px 8px",
                                                    borderRadius: "999px", background: slaColors[sla], color: "white",
                                                    whiteSpace: "nowrap", flexShrink: 0
                                                }}>
                                                    {sla === "expired" ? "VENCIDO" : sla === "critical" ? "CRÍTICO" : sla === "warning" ? "ALERTA" : "OK"}
                                                </span>
                                                <ChevronRight size={14} color="rgba(255,255,255,0.4)" />
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        {/* Pipeline por estado */}
                        <div style={{
                            background: "linear-gradient(135deg,rgba(255,255,255,0.04) 0%,rgba(255,255,255,0.01) 100%)",
                            borderRadius: "16px", padding: "1.5rem",
                            border: "1px solid rgba(255,255,255,0.08)", boxShadow: "0 4px 20px rgba(0,0,0,0.25)"
                        }}>
                            <h3 style={{ margin: "0 0 1rem", fontSize: "0.9rem", fontWeight: 800, color: "white", display: "flex", alignItems: "center", gap: "0.4rem" }}>
                                <Activity size={16} color="#ff6600" /> Pipeline Operativo
                            </h3>
                            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                                {TICKET_STATES.filter(s => s.order >= 1 && s.order <= 11).map(estado => {
                                    const count = tickets.filter((t: any) => isVisibleForMe(t) && normalizeStateId(t.estadoId) === estado.id).length;
                                    const maxCount = Math.max(...TICKET_STATES.map(s =>
                                        tickets.filter((t: any) => isVisibleForMe(t) && normalizeStateId(t.estadoId) === s.id).length
                                    ), 1);
                                    const Icon = estado.icon;
                                    return (
                                        <div key={estado.id} style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                                            <div style={{
                                                width: "28px", height: "28px", borderRadius: "8px",
                                                background: `${estado.color}15`, display: "flex",
                                                alignItems: "center", justifyContent: "center", flexShrink: 0
                                            }}>
                                                <Icon size={13} color={estado.color} />
                                            </div>
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div style={{ fontSize: "0.76rem", fontWeight: 600, color: "rgba(255,255,255,0.8)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                                    {estado.nombreCorto}
                                                </div>
                                                <div style={{ height: "5px", background: "rgba(255,255,255,0.08)", borderRadius: "999px", marginTop: "3px", overflow: "hidden" }}>
                                                    <div style={{
                                                        height: "100%", width: `${(count / maxCount) * 100}%`,
                                                        background: estado.color, borderRadius: "999px",
                                                        transition: "width 0.8s ease"
                                                    }} />
                                                </div>
                                            </div>
                                            <span style={{
                                                fontSize: "0.82rem", fontWeight: 900, color: count > 0 ? estado.color : "rgba(255,255,255,0.2)",
                                                minWidth: "20px", textAlign: "right"
                                            }}>{count}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </>
            )}

            {/* ════════════════════════════════════════
                TICKETS LIST VIEW — Reutiliza el mismo formato visual
                que la bandeja del admin (cards en grid, kanban, search global,
                triage/activos/cerrados). El filtrado por gestora se aplica dentro
                del propio componente vía isVisibleForMe.
            ════════════════════════════════════════ */}
            {activeView === "tickets" && (
                <AdminTicketsPage />
            )}

            {/* Modals */}
            {showWizard && (
                    <CreateTicketWizard
                        onClose={() => setShowWizard(false)}
                        onCreateTicket={handleCreateTicket}
                        creatorRole={isAdmin ? 'ADMIN' : 'GESTORA'}
                        creatorGestoraId={myGestoraId}
                        creatorGestoraNombre={myGestoraNombre}
                    />
            )}

            {openTicketIds.map((ticketId, index) => {
                const liveTicket = tickets.find((t: any) => t.id === ticketId);
                if (!liveTicket) return null;
                return (
                    <TicketWindow
                        key={ticketId}
                        ticket={liveTicket}
                        index={index}
                        onUpdate={updateTicket}
                        onClose={() => setOpenTicketIds(openTicketIds.filter(id => id !== ticketId))}
                    />
                );
            })}

            {/* REPORTES VIEW */}
            {activeView === "technicians" && (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
                    {/* Header de técnicos */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
                        <h2 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 700, color: "white" }}>
                            {technicians?.length || 0} Técnicos Activos
                        </h2>
                    </div>
                    
                    {loading ? (
                        <div style={{ textAlign: "center", padding: "4rem", color: "rgba(255,255,255,0.4)" }}>
                            <div style={{ width: 40, height: 40, border: "4px solid #f97316", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 1s linear infinite", margin: "0 auto 1rem" }} />
                            <p style={{ margin: 0, fontSize: "1rem", fontWeight: 600 }}>Cargando técnicos...</p>
                        </div>
                    ) : !technicians || technicians.length === 0 ? (
                        <div style={{ textAlign: "center", padding: "4rem", color: "rgba(255,255,255,0.4)" }}>
                            <Users size={40} style={{ margin: "0 auto 1rem", opacity: 0.5 }} />
                            <p style={{ margin: 0, fontSize: "1rem", fontWeight: 600 }}>No hay técnicos registrados</p>
                        </div>
                    ) : (
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "1rem" }}>
                            {technicians.map((tech: any) => {
                                const fullName = tech.nombre || tech.name || tech.first_name || "Técnico sin nombre";
                                const specialties = tech.especialidades || tech.specialties || [];
                                const phone = tech.celular || tech.phone || tech.yape_number || tech.plin_number || "Sin teléfono";
                                const docNumber = tech.numeroDoc || tech.document_number || "---";
                                const docType = tech.tipoDoc || tech.document_type || "DNI";
                                const rating = tech.calificacion || tech.rating || 5;
                                const techZones = tech.zone ? [tech.zone] : (tech.zonas || []);
                                
                                return (
                                <div key={tech.id} style={{
                                    background: "linear-gradient(135deg,rgba(255,255,255,0.04) 0%,rgba(255,255,255,0.01) 100%)",
                                    borderRadius: "14px", padding: "1rem",
                                    border: "1px solid rgba(255,255,255,0.08)",
                                    boxShadow: "0 4px 20px rgba(0,0,0,0.25)",
                                    transition: "all 0.2s"
                                }}>
                                    {/* Header con foto y estado */}
                                    <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.75rem" }}>
                                        <div style={{
                                            width: 52, height: 52, borderRadius: "50%",
                                            background: tech.estado === 'ACTIVO' ? "linear-gradient(135deg, #10B981, #059669)" : "#94A3B8",
                                            display: "flex", alignItems: "center", justifyContent: "center",
                                            color: "white", fontWeight: 800, fontSize: "1.2rem",
                                            boxShadow: "0 2px 8px rgba(16, 185, 129, 0.3)"
                                        }}>
                                            {fullName.charAt(0).toUpperCase()}
                                        </div>
                                        <div style={{ flex: 1 }}>
                                            <p style={{ margin: 0, fontWeight: 700, fontSize: "0.95rem", color: "white" }}>
                                                {fullName}
                                            </p>
                                            <p style={{ margin: "0.2rem 0 0", fontSize: "0.75rem", color: "rgba(255,255,255,0.5)" }}>
                                                {docType}: {docNumber}
                                            </p>
                                            {/* Rating */}
                                            <div style={{ display: "flex", gap: "2px", marginTop: "0.25rem" }}>
                                                {[1,2,3,4,5].map(s => (
                                                    <Star key={s} size={12} fill={s <= rating ? "#F59E0B" : "transparent"} color={s <= rating ? "#F59E0B" : "rgba(255,255,255,0.2)"} />
                                                ))}
                                            </div>
                                        </div>
                                        <div style={{
                                            padding: "0.3rem 0.6rem", borderRadius: "20px",
                                            background: tech.estado === 'ACTIVO' ? "rgba(16,185,129,0.15)" : "rgba(255,255,255,0.08)",
                                            color: tech.estado === 'ACTIVO' ? "#10B981" : "rgba(255,255,255,0.5)",
                                            fontSize: "0.7rem", fontWeight: 700,
                                            textTransform: "uppercase"
                                        }}>
                                            {tech.estado || "ACTIVO"}
                                        </div>
                                    </div>
                                    
                                    {/* Teléfono en recuadro verde */}
                                    <div style={{
                                        background: "rgba(16,185,129,0.1)", borderRadius: "8px", padding: "0.5rem 0.75rem",
                                        display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.75rem",
                                        border: "1px solid rgba(16,185,129,0.2)"
                                    }}>
                                        <span style={{ fontSize: "0.8rem", color: "#10B981" }}>📱</span>
                                        <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "#10B981" }}>{phone}</span>
                                    </div>
                                    
                                    {/* Especialidades */}
                                    <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem", marginBottom: "0.75rem" }}>
                                        {specialties.slice(0, 4).map((skill: string) => {
                                            const color = SKILL_COLORS[skill] || "#64748B";
                                            const Icon = SKILL_ICONS[skill] || Wrench;
                                            return (
                                                <div key={skill} style={{
                                                    display: "flex", alignItems: "center", gap: "0.3rem",
                                                    padding: "0.25rem 0.5rem", borderRadius: "20px",
                                                    background: `${color}15`, border: `1px solid ${color}40`
                                                }}>
                                                    <Icon size={10} color={color} />
                                                    <span style={{ fontSize: "0.7rem", fontWeight: 600, color }}>{skill}</span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                    
                                    {/* Zonas */}
                                    {techZones.length > 0 && (
                                        <div style={{ display: "flex", gap: "0.4rem" }}>
                                            {techZones.slice(0, 2).map((z: string) => {
                                                const zone = ZONES.find(zona => zona.id === z);
                                                return (
                                                    <div key={z} style={{
                                                        display: "flex", alignItems: "center", gap: "0.3rem",
                                                        padding: "0.2rem 0.4rem", borderRadius: "6px",
                                                        background: zone?.color ? `${zone.color}25` : "rgba(255,255,255,0.08)",
                                                        fontSize: "0.65rem", fontWeight: 600,
                                                        color: zone?.color ? "white" : "rgba(255,255,255,0.7)"
                                                    }}>
                                                        <MapPin size={10} />
                                                        {z}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {activeView === "reportes" && (
                <div style={{ padding: "1rem" }}>
                    <div style={{
                        textAlign: "center", padding: "3rem",
                        background: "linear-gradient(135deg,rgba(255,255,255,0.04) 0%,rgba(255,255,255,0.01) 100%)",
                        borderRadius: "16px", border: "1px solid rgba(255,255,255,0.08)",
                        boxShadow: "0 4px 20px rgba(0,0,0,0.25)"
                    }}>
                        <BarChart3 size={48} style={{ margin: "0 auto 1rem", color: "#ff6600" }} />
                        <h2 style={{ margin: "0 0 0.5rem", color: "white", fontSize: "1.25rem" }}>Reportes de Eficiencia</h2>
                        <p style={{ margin: 0, color: "rgba(255,255,255,0.5)" }}>
                            Período: {dateFilter === "today" ? "Hoy" : dateFilter === "week" ? "Esta Semana" : dateFilter === "month" ? "Este Mes" : "Todos"}
                        </p>
                        
                        {/* KPI Summary */}
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1rem", marginTop: "2rem" }}>
                            <div style={{ padding: "1rem", background: "rgba(255,255,255,0.03)", borderRadius: "10px", border: "1px solid rgba(255,255,255,0.05)" }}>
                                <div style={{ fontSize: "1.5rem", fontWeight: 900, color: "#8B5CF6" }}>{kpis.total}</div>
                                <div style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.5)" }}>Total Tickets</div>
                            </div>
                            <div style={{ padding: "1rem", background: "rgba(255,255,255,0.03)", borderRadius: "10px", border: "1px solid rgba(255,255,255,0.05)" }}>
                                <div style={{ fontSize: "1.5rem", fontWeight: 900, color: "#10B981" }}>{kpis.closed.length}</div>
                                <div style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.5)" }}>Cerrados</div>
                            </div>
                            <div style={{ padding: "1rem", background: "rgba(255,255,255,0.03)", borderRadius: "10px", border: "1px solid rgba(255,255,255,0.05)" }}>
                                <div style={{ fontSize: "1.5rem", fontWeight: 900, color: "#F59E0B" }}>{kpis.backlog.length}</div>
                                <div style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.5)" }}>En Proceso</div>
                            </div>
                        </div>
                        
                        {/* Stats detailed */}
                        <div style={{
                            marginTop: "1.5rem", textAlign: "left", padding: "1.2rem",
                            background: "linear-gradient(135deg,rgba(255,255,255,0.04) 0%,rgba(255,255,255,0.01) 100%)",
                            borderRadius: "12px", border: "1px solid rgba(255,255,255,0.08)"
                        }}>
                            <h3 style={{ margin: "0 0 0.75rem", fontSize: "0.9rem", color: "#ff6600", fontWeight: 800 }}>Métricas Detalladas</h3>
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem", fontSize: "0.85rem", color: "rgba(255,255,255,0.8)" }}>
                                <div>SLA Cumplimiento:</div>
                                <div style={{ fontWeight: 700, color: "white" }}>{kpis.slaCompliance}%</div>
                                <div>MTTR Promedio:</div>
                                <div style={{ fontWeight: 700, color: "white" }}>{kpis.mttrHours > 0 ? formatHours(kpis.mttrHours) : "-"}</div>
                                <div>SLA Vencidos:</div>
                                <div style={{ fontWeight: 700, color: kpis.expiredOpen.length > 0 ? "#EF4444" : "#10B981" }}>{kpis.expiredOpen.length}</div>
                                <div>Backlog:</div>
                                <div style={{ fontWeight: 700, color: kpis.backlog.length > 3 ? "#EF4444" : "#10B981" }}>{kpis.backlog.length}</div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// ── KPI Card Component ────────────────────────
interface KpiCardProps {
    label: string;
    value: string | number;
    icon: React.ReactNode;
    iconBg: string;
    sub?: string;
    trend?: "up" | "down" | null;
    alert?: boolean;
}

function KpiCard({ label, value, icon, iconBg, sub, trend, alert = false }: KpiCardProps) {
    const displayValue = (value === null || value === undefined) ? "0" : String(value);
    const isZero = displayValue === "0" || displayValue === "0.0";
    
    const borderColor = alert 
        ? "rgba(239, 68, 68, 0.4)" 
        : trend === "up" 
            ? "rgba(16, 185, 129, 0.2)" 
            : trend === "down" 
                ? "rgba(245, 158, 11, 0.2)" 
                : "rgba(255, 255, 255, 0.08)";
    const shadowColor = alert 
        ? "rgba(239, 68, 68, 0.05)" 
        : trend === "up" 
            ? "rgba(16, 185, 129, 0.03)" 
            : "rgba(255, 255, 255, 0.02)";

    return (
        <div style={{
            background: "linear-gradient(135deg,rgba(255,255,255,0.04) 0%,rgba(255,255,255,0.01) 100%)",
            border: `1px solid ${borderColor}`,
            borderRadius: "16px",
            padding: "1.25rem 1.4rem",
            display: "flex",
            flexDirection: "column",
            gap: "0.5rem",
            boxShadow: `0 4px 20px ${shadowColor}`,
            position: "relative",
            overflow: "hidden",
            transition: "all 0.2s ease-in-out",
            cursor: "default"
        }}
            onMouseEnter={e => {
                e.currentTarget.style.transform = "translateY(-2px)";
                e.currentTarget.style.background = "linear-gradient(135deg,rgba(255,255,255,0.06) 0%,rgba(255,255,255,0.02) 100%)";
            }}
            onMouseLeave={e => {
                e.currentTarget.style.transform = "";
                e.currentTarget.style.background = "linear-gradient(135deg,rgba(255,255,255,0.04) 0%,rgba(255,255,255,0.01) 100%)";
            }}
        >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "0.72rem", fontWeight: 700, color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                    {label}
                </span>
                <div style={{
                    width: "32px",
                    height: "32px",
                    borderRadius: "8px",
                    background: "rgba(255,255,255,0.08)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    backdropFilter: "blur(4px)"
                }}>
                    {icon}
                </div>
            </div>
            <div>
                <div style={{ fontSize: "1.6rem", fontWeight: 900, color: isZero ? "rgba(255,255,255,0.4)" : alert ? "#EF4444" : "white", lineHeight: 1.1 }}>
                    {displayValue}
                </div>
                {sub && (
                    <p style={{ fontSize: "0.7rem", color: alert ? "#EF4444" : "rgba(255,255,255,0.4)", margin: "4px 0 0", fontWeight: alert ? 600 : 400 }}>
                        {sub}
                    </p>
                )}
            </div>
        </div>
    );
}

