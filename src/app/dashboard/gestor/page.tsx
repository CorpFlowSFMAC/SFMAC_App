"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
    Plus, Filter, Search, Clock, CheckCircle2, Zap, Sparkles, ArrowRight,
    MapPin, AlertCircle, TrendingUp, TrendingDown, Target, BarChart2,
    Activity, AlertTriangle, Flame, Timer, Trophy, Users, ChevronRight,
    Calendar, X, RefreshCw, Gauge, Star, Award, MessageCircle,
    LogIn, LogOut, Bell, CheckCheck
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import CreateTicketWizard from "@/app/dashboard/admin/tickets/CreateTicketWizard";
import TicketWindow from "@/app/dashboard/admin/tickets/TicketWindow";
import { useAppData } from "@/lib/AppDataContext";
import { getServiceById, SERVICE_TYPES } from "@/lib/serviceTypes";
import { TICKET_STATES, normalizeStateId } from "@/lib/ticketStates";
import styles from "./gestor.module.css";

// ── SLA Constants ─────────────────────────────
const SLA_HOURS = 72;
const BACKLOG_HOURS = 24;
const TEAM_BENCHMARK_MTTR = 18; // horas promedio del equipo (mock)

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

// ── SLA Gauge Component (pure CSS/SVG) ────────
function SlaGauge({ pct }: { pct: number }) {
    const r = 70, cx = 90, cy = 90;
    const circumference = Math.PI * r; // half-circle
    const offset = circumference * (1 - Math.min(pct, 100) / 100);
    const color = pct >= 90 ? "#10B981" : pct >= 70 ? "#F59E0B" : "#EF4444";

    return (
        <svg width="180" height="110" viewBox="0 0 180 110">
            {/* Track */}
            <path
                d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
                fill="none" stroke="#e2e8f0" strokeWidth="14" strokeLinecap="round"
            />
            {/* Fill */}
            <path
                d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
                fill="none" stroke={color} strokeWidth="14" strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={offset}
                style={{ transition: "stroke-dashoffset 1.2s ease, stroke 0.5s" }}
            />
            {/* Center text */}
            <text x={cx} y={cy - 10} textAnchor="middle" fontSize="26" fontWeight="900" fill={color}>
                {Math.round(pct)}%
            </text>
            <text x={cx} y={cy + 12} textAnchor="middle" fontSize="11" fill="#64748B" fontWeight="600">
                SLA Actual
            </text>
            {/* Labels */}
            <text x={cx - r} y={cy + 18} textAnchor="middle" fontSize="9" fill="#94A3B8">0%</text>
            <text x={cx + r} y={cy + 18} textAnchor="middle" fontSize="9" fill="#94A3B8">100%</text>
        </svg>
    );
}

// ── Mini Bar Chart (CSS) ──────────────────────
function BarChart({ data }: { data: { label: string; open: number; closed: number }[] }) {
    const maxVal = Math.max(...data.flatMap(d => [d.open, d.closed]), 1);
    return (
        <div style={{ display: "flex", gap: "6px", alignItems: "flex-end", height: "120px", padding: "0 4px" }}>
            {data.map((d, i) => (
                <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: "3px" }}>
                    <div style={{ display: "flex", alignItems: "flex-end", gap: "2px", height: "96px" }}>
                        <div
                            title={`Abiertos: ${d.open}`}
                            style={{
                                width: "11px", borderRadius: "4px 4px 0 0",
                                background: "linear-gradient(180deg,#EF4444,#FCA5A5)",
                                height: `${(d.open / maxVal) * 96}px`,
                                minHeight: d.open ? "4px" : "0",
                                transition: "height 0.8s ease"
                            }}
                        />
                        <div
                            title={`Cerrados: ${d.closed}`}
                            style={{
                                width: "11px", borderRadius: "4px 4px 0 0",
                                background: "linear-gradient(180deg,#10B981,#6EE7B7)",
                                height: `${(d.closed / maxVal) * 96}px`,
                                minHeight: d.closed ? "4px" : "0",
                                transition: "height 0.8s ease"
                            }}
                        />
                    </div>
                    <span style={{ fontSize: "9px", color: "#94A3B8", fontWeight: 600, textAlign: "center" }}>{d.label}</span>
                </div>
            ))}
        </div>
    );
}

// ── Relative Progress Bar ─────────────────────
function RelativeBar({ value, benchmark, label, color }: { value: number; benchmark: number; label: string; color: string }) {
    const pct = Math.min((value / Math.max(benchmark * 1.5, 1)) * 100, 100);
    const benchmarkPct = Math.min((benchmark / Math.max(benchmark * 1.5, 1)) * 100, 100);
    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem" }}>
                <span style={{ color: "#64748B", fontWeight: 600 }}>{label}</span>
                <span style={{ color, fontWeight: 800 }}>{formatHours(value)} <span style={{ color: "#94A3B8", fontWeight: 400 }}>/ equipo {formatHours(benchmark)}</span></span>
            </div>
            <div style={{ height: "8px", background: "#F1F5F9", borderRadius: "999px", position: "relative", overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: "999px", transition: "width 1s ease" }} />
                {/* Benchmark marker */}
                <div style={{
                    position: "absolute", top: 0, left: `${benchmarkPct}%`,
                    width: "2px", height: "100%", background: "#64748B", opacity: 0.5
                }} />
            </div>
        </div>
    );
}

// ════════════════════════════════════════════════
// MAIN DASHBOARD
// ════════════════════════════════════════════════
export default function GestorDashboard() {
    const { tickets, loadingTickets: loading, createTicket, updateTicket } = useAppData();
    const [showWizard, setShowWizard] = useState(false);
    const [openTicketIds, setOpenTicketIds] = useState<string[]>([]);
    const [activeView, setActiveView] = useState<"dashboard" | "tickets">("dashboard");

    // ── Filters ──
    const [dateFilter, setDateFilter] = useState<"today" | "week" | "month" | "all">("week");
    const [priorityFilter, setPriorityFilter] = useState<"" | "Alta" | "Media" | "Baja">("");
    const [serviceFilter, setServiceFilter] = useState("");
    const [searchTerm, setSearchTerm] = useState("");
    const [showFilters, setShowFilters] = useState(false);

    const quote = useMemo(() => QUOTES[new Date().getDay() % QUOTES.length], []);
    const now = useMemo(() => new Date(), []);

    // ── GESTORA RESOLUTION Y ROLES ─────────────────────────────
    const [myGestoraId, setMyGestoraId] = useState<string | null>(null);
    const [isAdmin, setIsAdmin] = useState<boolean>(false);

    useEffect(() => {
        const fetchGestora = async () => {
            const email = localStorage.getItem('userEmail');
            if (!email) return;

            // Verificar rol de administrador
            const userRole = localStorage.getItem('userRole');
            if (userRole === 'SUPERADMIN' || userRole === 'ADMIN') {
                setIsAdmin(true);
            }

            // Primero buscar en gestoras (tabla heredada o directa) tolerando mayúsculas/minúsculas
            const { data: g } = await supabase.from('gestoras').select('id').ilike('email', email).maybeSingle();
            if (g?.id) {
                setMyGestoraId(g.id);
                return;
            }
            
            // Fallback a tabla perfiles (creando el vínculo) tolerando mayúsculas/minúsculas
            const { data: p } = await supabase.from('perfiles').select('id, rol').ilike('email', email).maybeSingle();
            if (p) {
                if (p.id) setMyGestoraId(p.id);
                if (p.rol === 'SUPERADMIN' || p.rol === 'ADMIN') setIsAdmin(true);
            }
        };
        fetchGestora();
    }, []);

    // ── CONTROL DE ASISTENCIA ──────────────────────────────────
    const [turnoActivo, setTurnoActivo] = useState<{id:string; hora_ingreso:string} | null>(null);
    const [turnoLoading, setTurnoLoading] = useState(false);
    const [bannerDesc, setBannerDesc] = useState(false); // banner descartado
    const [showBanner6PM, setShowBanner6PM] = useState(false);
    const [turnoTickle, setTurnoTickle] = useState(0); // tick para actualizar horas

    // Cargar turno activo al montar
    useEffect(() => {
        const email = typeof window !== 'undefined' ? localStorage.getItem('userEmail') : null;
        if (!email) return;
        supabase
            .from('turnos')
            .select('id, hora_ingreso')
            .eq('usuario_email', email)
            .eq('estado', 'EN_CURSO')
            .maybeSingle()
            .then(({ data }) => {
                if (data) setTurnoActivo({ id: data.id, hora_ingreso: data.hora_ingreso });
            });
    }, []);

    // Verificar banner 6PM cada minuto
    useEffect(() => {
        const checkBanner = () => {
            const dismissed = localStorage.getItem('banner6pm_dismissed_' + new Date().toDateString());
            if (dismissed) { setBannerDesc(true); return; }
            const h = new Date().getHours();
            if (h >= 18 && turnoActivo) setShowBanner6PM(true);
            else if (h < 18) setShowBanner6PM(false);
        };
        checkBanner();
        const interval = setInterval(() => {
            checkBanner();
            setTurnoTickle(t => t + 1);
        }, 60_000);
        return () => clearInterval(interval);
    }, [turnoActivo]);

    const handleBannerDismiss = () => {
        localStorage.setItem('banner6pm_dismissed_' + new Date().toDateString(), '1');
        setBannerDesc(true);
        setShowBanner6PM(false);
    };

    const handleIngreso = async () => {
        setTurnoLoading(true);
        const email = localStorage.getItem('userEmail') || '';
        const nombre = localStorage.getItem('userName') || '';
        const { data, error } = await supabase
            .from('turnos')
            .insert({ usuario_email: email, usuario_nombre: nombre, fecha: new Date().toISOString().split('T')[0] })
            .select('id, hora_ingreso')
            .single();
        if (!error && data) setTurnoActivo({ id: data.id, hora_ingreso: data.hora_ingreso });
        setTurnoLoading(false);
    };

    const handleSalida = async () => {
        if (!turnoActivo) return;
        setTurnoLoading(true);
        await supabase
            .from('turnos')
            .update({ hora_salida: new Date().toISOString(), estado: 'CERRADO' })
            .eq('id', turnoActivo.id);
        setTurnoActivo(null);
        setShowBanner6PM(false);
        setTurnoLoading(false);
    };

    function horasTranscurridas(ingreso: string): string {
        const h = (Date.now() - new Date(ingreso).getTime()) / 3_600_000;
        const hrs = Math.floor(h);
        const mins = Math.round((h - hrs) * 60);
        return `${hrs}h ${mins}m`;
    }

    const handleCreateTicket = async (ticketData: any) => {
        try {
            await createTicket(ticketData);
            setShowWizard(false);
        } catch (err) {
            alert("Error al crear el ticket en la nube.");
        }
    };

    // ── Date and Gestora filter ──
    const isVisibleForMe = useCallback((t: any) => {
        // La regla: Los tickets asignados SOLO deben mostrarse a la gestora asignada y a Admin.
        if (isAdmin) return true; // Si es ADMIN o SUPERADMIN lo ve todo en cualquier lado.
        
        // Si el ticket no tiene gestora asignada, entra a flujo de Triaje normal donde las gestoras pueden tomarlo.
        const isAssignedToMe = t.gestora_id === myGestoraId || t.gestora_asignada_id === myGestoraId || t.metadata?.gestora_id === myGestoraId;
        const isUnassigned = !t.gestora_id && !t.gestora_asignada_id && !t.metadata?.gestora_id;
        return isAssignedToMe || isUnassigned;
    }, [myGestoraId, isAdmin]);

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
        tickets.filter((t: any) => isVisibleForMe(t) && isInDateRange(t.createdAt || t.created_at || now.toISOString())),
        [tickets, isVisibleForMe, isInDateRange, now]
    );

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
    const barData = useMemo(() => {
        const days = Array.from({ length: 7 }, (_, i) => {
            const d = new Date(now);
            d.setDate(d.getDate() - (6 - i));
            return d;
        });
        return days.map(day => {
            const label = day.toLocaleDateString("es-PE", { weekday: "short" });
            const open = tickets.filter((t: any) => {
                const c = new Date(t.createdAt || t.created_at || "");
                return isVisibleForMe(t) && c.toDateString() === day.toDateString() &&
                    !["ticket_cerrado", "ticket_rechazado", "ticket_cancelado"].includes(normalizeStateId(t.estadoId));
            }).length;
            const closed = tickets.filter((t: any) => {
                const c = new Date(t.createdAt || t.created_at || "");
                return isVisibleForMe(t) && c.toDateString() === day.toDateString() &&
                    normalizeStateId(t.estadoId) === "ticket_cerrado";
            }).length;
            return { label, open, closed };
        });
    }, [tickets, isVisibleForMe, now]);

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

    return (
        <div style={{ padding: "1.5rem 2rem", minHeight: "100vh", background: "#F8FAFC", fontFamily: "Inter, system-ui, sans-serif" }}>

            {/* ── BANNER 6PM (descartable) ─────────────────────── */}
            {showBanner6PM && !bannerDesc && (
                <div style={{
                    position: 'fixed', top: 20, left: '50%', transform: 'translateX(-50%)',
                    zIndex: 9999, background: 'linear-gradient(135deg,#FFFBEB,#FEF3C7)',
                    border: '1px solid #FCD34D', borderRadius: '14px', padding: '12px 20px',
                    display: 'flex', alignItems: 'center', gap: '12px',
                    boxShadow: '0 8px 32px rgba(251,191,36,0.3)', maxWidth: '520px', width: '90%'
                }}>
                    <Bell size={20} color="#D97706" style={{ flexShrink: 0 }} />
                    <p style={{ margin: 0, fontSize: '0.85rem', fontWeight: 600, color: '#92400E', flex: 1 }}>
                        ⏰ Tu jornada regular ha terminado. Recuerda marcar tu salida cuando termines.
                    </p>
                    <button
                        onClick={handleBannerDismiss}
                        style={{
                            display: 'flex', alignItems: 'center', gap: '5px',
                            background: '#F59E0B', color: 'white', border: 'none',
                            borderRadius: '8px', padding: '6px 12px', cursor: 'pointer',
                            fontSize: '0.75rem', fontWeight: 800, flexShrink: 0, whiteSpace: 'nowrap'
                        }}
                    >
                        <CheckCheck size={13} />
                        Entendido, sigo trabajando
                    </button>
                    <button onClick={handleBannerDismiss} style={{
                        background: 'transparent', border: 'none', cursor: 'pointer',
                        color: '#D97706', padding: '4px', borderRadius: '6px', display: 'flex'
                    }}>
                        <X size={16} />
                    </button>
                </div>
            )}

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
                    </div>
                    <button
                        onClick={() => setShowWizard(true)}
                        style={{
                            background: "linear-gradient(135deg,#FF6600,#FF8533)", color: "white",
                            border: "none", borderRadius: "10px", padding: "0.55rem 1.2rem",
                            cursor: "pointer", fontSize: "0.85rem", fontWeight: 700,
                            display: "flex", alignItems: "center", gap: "0.4rem",
                            boxShadow: "0 4px 15px rgba(255,102,0,0.4)"
                        }}
                    >
                        <Plus size={16} /> Nuevo Ticket
                    </button>
                </div>
            </div>

            {/* ── WIDGET: CONTROL DE TURNO ──────────── */}
            <div style={{
                background: 'white', borderRadius: '14px', border: '1px solid #E2E8F0',
                padding: '1rem 1.5rem', marginBottom: '1.25rem',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{
                        width: 40, height: 40, borderRadius: '12px',
                        background: turnoActivo ? '#DCFCE7' : '#F1F5F9',
                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}>
                        <Clock size={20} color={turnoActivo ? '#15803D' : '#94A3B8'} />
                    </div>
                    <div>
                        <div style={{ fontSize: '0.8rem', fontWeight: 800, color: '#1E293B' }}>
                            {turnoActivo ? '🟢 Turno en curso' : '⚪ Sin turno activo'}
                        </div>
                        <div style={{ fontSize: '0.72rem', color: '#64748B' }}>
                            {turnoActivo
                                ? `Ingresaste a las ${new Date(turnoActivo.hora_ingreso).toLocaleTimeString('es-PE',{hour:'2-digit',minute:'2-digit',hour12:true})} · ${horasTranscurridas(turnoActivo.hora_ingreso)} trabajados`
                                : 'Presiona "Marcar Ingreso" para iniciar tu jornada'}
                        </div>
                    </div>
                </div>
                <div>
                    {!turnoActivo ? (
                        <button
                            onClick={handleIngreso}
                            disabled={turnoLoading}
                            style={{
                                display: 'flex', alignItems: 'center', gap: '6px',
                                background: 'linear-gradient(135deg,#059669,#047857)',
                                color: 'white', border: 'none', borderRadius: '10px',
                                padding: '0.55rem 1.25rem', cursor: 'pointer',
                                fontSize: '0.85rem', fontWeight: 800,
                                boxShadow: '0 4px 14px rgba(5,150,105,0.35)',
                                opacity: turnoLoading ? 0.7 : 1, transition: 'all 0.2s'
                            }}
                        >
                            <LogIn size={15} />
                            {turnoLoading ? 'Registrando...' : 'Marcar Ingreso'}
                        </button>
                    ) : (
                        <button
                            onClick={handleSalida}
                            disabled={turnoLoading}
                            style={{
                                display: 'flex', alignItems: 'center', gap: '6px',
                                background: 'linear-gradient(135deg,#EF4444,#DC2626)',
                                color: 'white', border: 'none', borderRadius: '10px',
                                padding: '0.55rem 1.25rem', cursor: 'pointer',
                                fontSize: '0.85rem', fontWeight: 800,
                                boxShadow: '0 4px 14px rgba(239,68,68,0.35)',
                                opacity: turnoLoading ? 0.7 : 1, transition: 'all 0.2s'
                            }}
                        >
                            <LogOut size={15} />
                            {turnoLoading ? 'Registrando...' : 'Registrar Salida'}
                        </button>
                    )}
                </div>
            </div>

            {/* ── DATE/FILTER BAR ───────────────────── */}
            <div style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                background: "white", borderRadius: "12px", padding: "0.65rem 1.25rem",
                marginBottom: "1.25rem", border: "1px solid #E2E8F0",
                boxShadow: "0 2px 8px rgba(0,0,0,0.04)"
            }}>
                <div style={{ display: "flex", gap: "0.35rem" }}>
                    {(["today", "week", "month", "all"] as const).map(f => (
                        <button key={f} onClick={() => setDateFilter(f)} style={{
                            padding: "0.35rem 0.9rem", borderRadius: "8px", border: "none", cursor: "pointer",
                            fontSize: "0.78rem", fontWeight: 700,
                            background: dateFilter === f ? "#4338CA" : "#F1F5F9",
                            color: dateFilter === f ? "white" : "#64748B",
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
                            padding: "0.35rem 0.8rem", borderRadius: "8px", border: "1px solid #E2E8F0",
                            fontSize: "0.78rem", cursor: "pointer", background: "white",
                            color: "#475569", fontWeight: 600
                        }}
                    >
                        <option value="">Todas las prioridades</option>
                        <option value="Alta">🔴 Alta (SLA en riesgo)</option>
                        <option value="Media">🟡 Media</option>
                        <option value="Baja">🟢 Baja</option>
                    </select>

                    {/* Service filter */}
                    <select
                        value={serviceFilter}
                        onChange={e => setServiceFilter(e.target.value)}
                        style={{
                            padding: "0.35rem 0.8rem", borderRadius: "8px", border: "1px solid #E2E8F0",
                            fontSize: "0.78rem", cursor: "pointer", background: "white",
                            color: "#475569", fontWeight: 600
                        }}
                    >
                        <option value="">Todos los servicios</option>
                        {SERVICE_TYPES.map(s => (
                            <option key={s.id} value={s.id}>{s.nombreCorto}</option>
                        ))}
                    </select>

                    <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", background: "#F1F5F9", borderRadius: "8px", padding: "0.35rem 0.8rem" }}>
                        <Search size={13} color="#94A3B8" />
                        <input
                            type="text" placeholder="Buscar ticket..." value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            style={{ background: "transparent", border: "none", outline: "none", fontSize: "0.78rem", color: "#475569", width: "130px" }}
                        />
                    </div>
                </div>
            </div>

            {/* ════════════════════════════════════════
                DASHBOARD VIEW
            ════════════════════════════════════════ */}
            {activeView === "dashboard" && (
                <>
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
                            sub={`Promedio equipo: 4h`}
                            trend={kpis.frtHours > 0 && kpis.frtHours < 4 ? "up" : kpis.frtHours >= 8 ? "down" : null}
                        />
                        {/* 4. MTTR */}
                        <KpiCard
                            label="MTTR (Resolución)"
                            value={kpis.mttrHours > 0 ? formatHours(kpis.mttrHours) : "—"}
                            icon={<Gauge size={18} color={mttrBetter ? "#10B981" : "#EF4444"} />}
                            iconBg={mttrBetter ? "#ECFDF5" : "#FEF2F2"}
                            sub={`Benchmark: ${formatHours(TEAM_BENCHMARK_MTTR)}`}
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
                            background: "white", borderRadius: "16px", padding: "1.5rem",
                            border: "1px solid #E2E8F0", boxShadow: "0 2px 8px rgba(0,0,0,0.04)"
                        }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
                                <h3 style={{ margin: 0, fontSize: "0.9rem", fontWeight: 800, color: "#1E293B", display: "flex", alignItems: "center", gap: "0.4rem" }}>
                                    <BarChart2 size={16} color="#4338CA" /> Tickets Últimos 7 Días
                                </h3>
                                <div style={{ display: "flex", gap: "0.75rem", fontSize: "0.72rem", fontWeight: 700 }}>
                                    <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                                        <span style={{ width: "10px", height: "10px", borderRadius: "3px", background: "#EF4444", display: "inline-block" }} />
                                        Abiertos
                                    </span>
                                    <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                                        <span style={{ width: "10px", height: "10px", borderRadius: "3px", background: "#10B981", display: "inline-block" }} />
                                        Cerrados
                                    </span>
                                </div>
                            </div>
                            <BarChart data={barData} />
                        </div>

                        {/* SLA Gauge */}
                        <div style={{
                            background: "white", borderRadius: "16px", padding: "1.5rem",
                            border: "1px solid #E2E8F0", boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
                            display: "flex", flexDirection: "column", alignItems: "center"
                        }}>
                            <h3 style={{ margin: "0 0 1rem", fontSize: "0.9rem", fontWeight: 800, color: "#1E293B", display: "flex", alignItems: "center", gap: "0.4rem", width: "100%" }}>
                                <Target size={16} color="#4338CA" /> Cumplimiento SLA
                            </h3>
                            <SlaGauge pct={kpis.slaCompliance} />
                            <div style={{ marginTop: "0.5rem", display: "flex", gap: "0.5rem", flexDirection: "column", width: "100%" }}>
                                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem", padding: "0.4rem 0.75rem", borderRadius: "8px", background: "#FEF2F2" }}>
                                    <span style={{ color: "#64748B" }}>🔴 Críticos</span>
                                    <span style={{ fontWeight: 800, color: "#EF4444" }}>{kpis.critical.length}</span>
                                </div>
                                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem", padding: "0.4rem 0.75rem", borderRadius: "8px", background: "#FFF7ED" }}>
                                    <span style={{ color: "#64748B" }}>🟡 En alerta</span>
                                    <span style={{ fontWeight: 800, color: "#F59E0B" }}>{kpis.warning.length}</span>
                                </div>
                            </div>
                        </div>

                        {/* Productividad relativa */}
                        <div style={{
                            background: "white", borderRadius: "16px", padding: "1.5rem",
                            border: "1px solid #E2E8F0", boxShadow: "0 2px 8px rgba(0,0,0,0.04)"
                        }}>
                            <h3 style={{ margin: "0 0 1.25rem", fontSize: "0.9rem", fontWeight: 800, color: "#1E293B", display: "flex", alignItems: "center", gap: "0.4rem" }}>
                                <Trophy size={16} color="#F59E0B" /> Productividad Relativa
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
                                    color="#4338CA"
                                />
                            </div>
                            <div style={{
                                marginTop: "1.25rem", padding: "0.6rem 0.9rem",
                                background: mttrBetter ? "#ECFDF5" : "#FEF2F2",
                                borderRadius: "10px", fontSize: "0.75rem",
                                color: mttrBetter ? "#059669" : "#DC2626", fontWeight: 700,
                                display: "flex", gap: "0.4rem", alignItems: "center"
                            }}>
                                <Award size={14} />
                                {mttrBetter
                                    ? "¡Por encima del promedio del equipo! 🏆"
                                    : kpis.mttrHours === 0
                                        ? "Sin tickets cerrados aún — ¡a por ellos!"
                                        : "Por debajo del promedio — hay oportunidad de mejora"}
                            </div>
                        </div>
                    </div>

                    {/* ── TOP 5 URGENT + PIPELINE ──────────── */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.25rem" }}>

                        {/* Top 5 urgentes */}
                        <div style={{
                            background: "white", borderRadius: "16px", padding: "1.5rem",
                            border: "1px solid #E2E8F0", boxShadow: "0 2px 8px rgba(0,0,0,0.04)"
                        }}>
                            <h3 style={{ margin: "0 0 1rem", fontSize: "0.9rem", fontWeight: 800, color: "#1E293B", display: "flex", alignItems: "center", gap: "0.4rem" }}>
                                <Flame size={16} color="#EF4444" /> Top 5 Tickets más Urgentes
                            </h3>
                            {top5Urgent.length === 0 ? (
                                <div style={{ textAlign: "center", padding: "2rem", color: "#94A3B8" }}>
                                    <CheckCircle2 size={32} style={{ margin: "0 auto 0.5rem" }} />
                                    <p style={{ margin: 0, fontSize: "0.85rem" }}>¡Sin urgencias! Excelente trabajo.</p>
                                </div>
                            ) : (
                                <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
                                    {top5Urgent.map((t: any, idx: number) => {
                                        const sla = t._sla as "ok" | "warning" | "critical" | "expired";
                                        const slaColors = { ok: "#10B981", warning: "#F59E0B", critical: "#EF4444", expired: "#7F1D1D" };
                                        const slaBg = { ok: "#ECFDF5", warning: "#FFF7ED", critical: "#FEF2F2", expired: "#FFF1F2" };
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
                                                    <div style={{ fontSize: "0.8rem", fontWeight: 700, color: "#1E293B", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                                        {t.cliente?.nombre || t.branch_offices?.clients?.name || "Sin cliente"}
                                                        {t.numeroTicketCliente && <span style={{ fontSize: "0.7rem", color: "#94A3B8", marginLeft: "6px" }}>#{t.numeroTicketCliente}</span>}
                                                    </div>
                                                    <div style={{ fontSize: "0.72rem", color: "#64748B" }}>
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
                                                <ChevronRight size={14} color="#94A3B8" />
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        {/* Pipeline por estado */}
                        <div style={{
                            background: "white", borderRadius: "16px", padding: "1.5rem",
                            border: "1px solid #E2E8F0", boxShadow: "0 2px 8px rgba(0,0,0,0.04)"
                        }}>
                            <h3 style={{ margin: "0 0 1rem", fontSize: "0.9rem", fontWeight: 800, color: "#1E293B", display: "flex", alignItems: "center", gap: "0.4rem" }}>
                                <Activity size={16} color="#4338CA" /> Pipeline Operativo
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
                                                <div style={{ fontSize: "0.76rem", fontWeight: 600, color: "#475569", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                                    {estado.nombreCorto}
                                                </div>
                                                <div style={{ height: "5px", background: "#F1F5F9", borderRadius: "999px", marginTop: "3px", overflow: "hidden" }}>
                                                    <div style={{
                                                        height: "100%", width: `${(count / maxCount) * 100}%`,
                                                        background: estado.color, borderRadius: "999px",
                                                        transition: "width 0.8s ease"
                                                    }} />
                                                </div>
                                            </div>
                                            <span style={{
                                                fontSize: "0.82rem", fontWeight: 900, color: count > 0 ? estado.color : "#CBD5E1",
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
                TICKETS LIST VIEW
            ════════════════════════════════════════ */}
            {activeView === "tickets" && (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
                    {filteredTickets.length === 0 ? (
                        <div style={{ textAlign: "center", padding: "4rem", color: "#94A3B8" }}>
                            <Sparkles size={40} style={{ margin: "0 auto 1rem", opacity: 0.5 }} />
                            <p style={{ margin: 0, fontSize: "1rem", fontWeight: 600 }}>Sin tickets activos que coincidan con los filtros</p>
                        </div>
                    ) : (
                        filteredTickets.map((ticket: any) => {
                            const sla = getSlaStatus(ticket.createdAt || ticket.created_at || now.toISOString());
                            const slaColors = { ok: "#10B981", warning: "#F59E0B", critical: "#EF4444", expired: "#7F1D1D" };
                            const slaBg = { ok: "#ECFDF5", warning: "#FFF7ED", critical: "#FFF1F2", expired: "#fff5f5" };
                            const service = getServiceById(ticket.tipoServicio);
                            const estado = TICKET_STATES.find(s => s.id === normalizeStateId(ticket.estadoId));
                            const Icon = estado?.icon || Activity;

                            return (
                                <div
                                    key={ticket.id}
                                    onClick={() => { if (!openTicketIds.includes(ticket.id)) setOpenTicketIds([...openTicketIds, ticket.id]); }}
                                    style={{
                                        background: "white", borderRadius: "12px", padding: "0.9rem 1.25rem",
                                        border: `1px solid ${sla !== "ok" ? slaColors[sla] + "40" : "#E2E8F0"}`,
                                        display: "flex", alignItems: "center", gap: "1rem", cursor: "pointer",
                                        boxShadow: sla === "expired" || sla === "critical" ? `0 0 0 2px ${slaColors[sla]}20` : "0 1px 4px rgba(0,0,0,0.04)",
                                        transition: "all 0.2s"
                                    }}
                                >
                                    {/* SLA indicator */}
                                    {sla !== "ok" && (
                                        <div style={{ width: "4px", height: "42px", borderRadius: "999px", background: slaColors[sla], flexShrink: 0 }} />
                                    )}

                                    <div style={{
                                        width: "38px", height: "38px", borderRadius: "10px",
                                        background: `${estado?.color || "#8B5CF6"}15`,
                                        display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0
                                    }}>
                                        <Icon size={17} color={estado?.color || "#8B5CF6"} />
                                    </div>

                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ display: "flex", alignItems: "baseline", gap: "0.5rem", flexWrap: "wrap" }}>
                                            <span style={{ fontWeight: 800, fontSize: "0.88rem", color: "#1E293B" }}>
                                                {ticket.cliente?.nombre || "Sin cliente"}
                                            </span>
                                            {ticket.numeroTicketCliente && (
                                                <span style={{ fontSize: "0.73rem", color: "#94A3B8" }}>#{ticket.numeroTicketCliente}</span>
                                            )}
                                        </div>
                                        <div style={{ fontSize: "0.76rem", color: "#64748B", marginTop: "2px" }}>
                                            {ticket.sede?.nombre || ticket.branch_offices?.name || "—"} · {estado?.nombreCorto}
                                        </div>
                                    </div>

                                    {service && (
                                        <span style={{
                                            fontSize: "0.72rem", fontWeight: 700, padding: "3px 10px",
                                            borderRadius: "999px", background: `${service.color}15`, color: service.color,
                                            border: `1px solid ${service.color}30`, whiteSpace: "nowrap", flexShrink: 0
                                        }}>
                                            {service.nombreCorto}
                                        </span>
                                    )}

                                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                                        <div style={{ fontSize: "0.72rem", fontWeight: 800, color: slaColors[sla] }}>
                                            {sla === "expired" ? "⚠ VENCIDO" : sla === "critical" ? "🔴 CRÍTICO" : sla === "warning" ? "🟡 ALERTA" : "✅ OK"}
                                        </div>
                                        <div style={{ fontSize: "0.7rem", color: "#94A3B8" }}>
                                            {formatHours(hoursAgo(ticket.createdAt || ticket.created_at || now.toISOString()))} ago
                                        </div>
                                    </div>

                                    <ChevronRight size={16} color="#CBD5E1" />
                                </div>
                            );
                        })
                    )}
                </div>
            )}

            {/* Modals */}
            {showWizard && (
                <CreateTicketWizard
                    onClose={() => setShowWizard(false)}
                    onCreateTicket={handleCreateTicket}
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
        </div>
    );
}

// ── KPI Card Component ────────────────────────
function KpiCard({ label, value, icon, iconBg, sub, trend, alert = false }: {
    label: string; value: any; icon: React.ReactNode;
    iconBg: string; sub: string; trend: "up" | "down" | null; alert?: boolean;
}) {
    return (
        <div style={{
            background: "white", borderRadius: "14px", padding: "1.1rem 1.25rem",
            border: `1px solid ${alert ? "#FCA5A550" : "#E2E8F0"}`,
            boxShadow: alert ? "0 0 0 2px #FCA5A530" : "0 2px 8px rgba(0,0,0,0.04)",
            display: "flex", flexDirection: "column", gap: "0.5rem",
            transition: "transform 0.2s, box-shadow 0.2s",
            cursor: "default"
        }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)"; (e.currentTarget as HTMLElement).style.boxShadow = "0 8px 25px rgba(0,0,0,0.08)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = ""; (e.currentTarget as HTMLElement).style.boxShadow = alert ? "0 0 0 2px #FCA5A530" : "0 2px 8px rgba(0,0,0,0.04)"; }}
        >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div style={{ width: "36px", height: "36px", borderRadius: "10px", background: iconBg, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {icon}
                </div>
                {trend && (
                    <span style={{ fontSize: "0.7rem", fontWeight: 800, color: trend === "up" ? "#10B981" : "#EF4444", display: "flex", alignItems: "center", gap: "2px" }}>
                        {trend === "up" ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                        {trend === "up" ? "Bien" : "Atención"}
                    </span>
                )}
            </div>
            <div>
                <div style={{ fontSize: "1.6rem", fontWeight: 900, color: alert ? "#EF4444" : "#1E293B", lineHeight: 1 }}>{value}</div>
                <div style={{ fontSize: "0.73rem", fontWeight: 700, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.5px", marginTop: "4px" }}>{label}</div>
            </div>
            <div style={{ fontSize: "0.71rem", color: "#94A3B8" }}>{sub}</div>
        </div>
    );
}
