"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
    Plus, Filter, Search, Clock, CheckCircle2, Zap, Sparkles, ArrowRight,
    MapPin, AlertCircle, TrendingUp, TrendingDown, Target, BarChart2,
    Activity, AlertTriangle, Flame, Timer, Trophy, Users, ChevronRight,
    Calendar, X, RefreshCw, Gauge, Star, Award, MessageCircle,
    LogIn, LogOut, Bell, CheckCheck, BarChart3, Wrench, Coins
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import CreateTicketWizard from "@/app/dashboard/admin/tickets/CreateTicketWizard";
import TicketWindow from "@/app/dashboard/admin/tickets/TicketWindow";
import AdminTicketsPage from "@/app/dashboard/admin/tickets/page";
import { useAppData } from "@/lib/AppDataContext";
import { getServiceById, SERVICE_TYPES, SKILL_ICONS, SKILL_COLORS } from "@/lib/serviceTypes";
import { TICKET_STATES, normalizeStateId } from "@/lib/ticketStates";
import { formatSoles } from "@/lib/formatters";
import { calculateTicketFinances } from "@/lib/calculations";
import { ZONES } from "@/lib/zones";
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
interface GestorPageProps {
    tab?: 'dashboard' | 'tickets' | 'technicians' | 'reportes';
}

export default function GestorDashboard({ tab }: GestorPageProps) {
    const { tickets, loadingTickets: loading, createTicket, updateTicket, gestoras, gestorasTargets, technicians } = useAppData();
    const [showWizard, setShowWizard] = useState(false);
    const [openTicketIds, setOpenTicketIds] = useState<string[]>([]);
    const [activeView, setActiveView] = useState<"dashboard" | "tickets" | "technicians" | "reportes">(() => { return (tab as any) || "dashboard"; });

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
    const [showFilters, setShowFilters] = useState(false);

    const quote = useMemo(() => QUOTES[new Date().getDay() % QUOTES.length], []);
    const now = useMemo(() => new Date(), []);

    // ── GESTORA RESOLUTION Y ROLES ─────────────────────────────
    const [myGestoraId, setMyGestoraId] = useState<string | null>(null);
    const [myGestoraNombre, setMyGestoraNombre] = useState<string | null>(null);
    const [isAdmin, setIsAdmin] = useState<boolean>(false);

    const fetchGestora = useCallback(async () => {
        try {
            // Leer email desde cookies de Azure AD
            let email = localStorage.getItem('userEmail');
            
            if (!email) {
                // Fallback: intentar cookie
                const cookies = document.cookie.split(';').reduce((acc, c) => {
                    const [k, v] = c.trim().split('=');
                    acc[k] = v;
                    return acc;
                }, {} as Record<string, string>);
                email = cookies['userEmail'];
            }

            if (!email) {
                console.warn("[Gestor] Sin email de usuario");
                return;
            }

            const userRole = (localStorage.getItem('userRole') || (() => {
                const m = document.cookie.match(/userRole=([^;]+)/);
                return m ? decodeURIComponent(m[1]) : '';
            })()).toUpperCase();
            if (userRole === 'ADMIN' || userRole === 'SUPERADMIN') {
                setIsAdmin(true);
            }

            // Buscar gestora por email
            const { data: g } = await supabase.from('gestoras').select('id, name').ilike('email', email).maybeSingle();
            if (g?.id) {
                setMyGestoraId(g.id);
                setMyGestoraNombre(g.name || null);
            } else {
                // Buscar en perfiles (dos pasos para evitar error 400)
                const { data: p } = await supabase.from('perfiles').select('id').ilike('email', email).maybeSingle();
                if (p) {
                    const { data: perfilData } = await supabase.from('perfiles').select('rol,nombre').eq('id', p.id).maybeSingle();
                    if (p.id) setMyGestoraId(p.id);
                    if (perfilData?.nombre) setMyGestoraNombre(perfilData.nombre);
                    const normalizedRole = perfilData?.rol?.toUpperCase();
                    if (normalizedRole === 'ADMIN') setIsAdmin(true);
                } else {
                    // Si es ADMIN pero no tiene gestora, usar null para ver todo
                    if (userRole === 'ADMIN') {
                        console.log("[Gestor] Admin sin gestora asignada - mostrar todo");
                    }
                }
            }
        } catch (error) {
            console.error("Error fetching gestora context:", error);
        }
    }, []);

    useEffect(() => {
        fetchGestora();
    }, [fetchGestora]);

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
        
        // Intentar endpoint V3 primero (usa service role key)
        try {
            const response = await fetch('/api/v3/gestor', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'ingreso', email, nombre })
            });
            const result = await response.json();
            if (result.success && result.turno) {
                setTurnoActivo({ id: result.turno.id, hora_ingreso: result.turno.hora_ingreso });
                setTurnoLoading(false);
                return;
            }
        } catch (e) {
            console.log('[Gestor] V3 ingreso failed, trying client:', e);
        }
        
        // Fallback: cliente anónimo
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
        
        // Intentar endpoint V3 primero (usa service role key)
        try {
            const response = await fetch('/api/v3/gestor', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'salida', turnoId: turnoActivo.id })
            });
            const result = await response.json();
            if (result.success) {
                setTurnoActivo(null);
                setShowBanner6PM(false);
                setTurnoLoading(false);
                return;
            }
        } catch (e) {
            console.log('[Gestor] V3 salida failed, trying client:', e);
        }
        
        // Fallback: cliente anónimo
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
    // 🔒 La gestora solo debe ver tickets asignados a ella (directamente o vía cascada
    // sede/zona/cliente). Si no se ha resuelto su identidad aún, no mostramos nada
    // hasta que esté lista — así evitamos fugas de tickets ajenos.
    const isVisibleForMe = useCallback((t: any) => {
        // REGLA 0: Admin ve TODO
        if (isAdmin) return true;

        // REGLA 1: Identidad requerida - sin ID, NO mostrar (evita fuga)
        if (!myGestoraId) return false;

        // EXCLUSIVIDAD: Si el ticket tiene una GESTORA DIRECTA ya asignada
        const assignedGestoraId = t.gestora_id || t.metadata?.gestora_id;
        if (assignedGestoraId) {
            return assignedGestoraId === myGestoraId;
        }

        // CASCADA (Solo si no hay gestora directa): ¿A quién le toca tomarlo?
        // 1. Asignación por Sede (Branch)
        if (t.branch_offices?.gestora_asignada_id === myGestoraId) return true;

        // 2. Asignación por Zona (Cascada 1)
        if (t.branch_offices?.zonas?.gestora_asignada_id === myGestoraId) return true;

        // 3. Asignación por Cliente o Sede-Cliente (Cascada 2)
        if (t.clients?.gestora_asignada_id === myGestoraId ||
            t.branch_offices?.clients?.gestora_asignada_id === myGestoraId) {
            return true;
        }

        // Sin match → ticket ajeno, NO mostrar
        return false;
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

            {/* ── DATE/FILTER BAR ─ solo para dashboard view ─ */}
            {activeView === "dashboard" && (
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
            )}

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

                    {/* ── FINANCIAL SUMMARY ROW ─────────── */}
                    {myGestoraId && (() => {
                        // Calculate financial KPIs for the filtered tickets
                        const myTickets = tickets.filter(t => isVisibleForMe(t));
                        const activeTickets = myTickets.filter(t => 
                            !["ticket_cerrado", "ticket_rechazado", "ticket_cancelado"].includes(normalizeStateId(t.estadoId))
                        );
                        const closedTickets = myTickets.filter(t => 
                            normalizeStateId(t.estadoId) === "ticket_cerrado"
                        );
                        
                        const calcFinances = (t: any) => calculateTicketFinances(t, t.costos || []);
                        
                        // Active tickets financial data
                        const activeRevenue = activeTickets.reduce((sum, t) => sum + calcFinances(t).totalVenta, 0);
                        const activeCosts = activeTickets.reduce((sum, t) => sum + calcFinances(t).totalCosts, 0);
                        const activeProfit = activeTickets.reduce((sum, t) => sum + Math.max(0, calcFinances(t).realProfitability), 0);
                        
                        // Closed tickets (this month)
                        const now3 = new Date();
                        const startOfMonth = new Date(now3.getFullYear(), now3.getMonth(), 1);
                        const closedThisMonth = closedTickets.filter(t => {
                            const d = new Date(t.closure_date || t.updated_at);
                            return d >= startOfMonth;
                        });
                        const closedRevenue = closedThisMonth.reduce((sum, t) => sum + calcFinances(t).totalVenta, 0);
                        const closedCosts = closedThisMonth.reduce((sum, t) => sum + calcFinances(t).totalCosts, 0);
                        const closedProfit = closedThisMonth.reduce((sum, t) => sum + Math.max(0, calcFinances(t).realProfitability), 0);
                        
                        const totalRevenue = closedRevenue + (activeTickets.length > 0 ? activeRevenue * 0.5 : 0);
                        const totalCosts = closedCosts + (activeTickets.length > 0 ? activeCosts * 0.5 : 0);
                        const netProfit = closedProfit + (activeTickets.length > 0 ? activeProfit * 0.5 : 0);
                        const marginPct = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

                        return (
                            <div style={{
                                display: "grid", gridTemplateColumns: "repeat(4, 1fr)",
                                gap: "1rem", marginBottom: "1.25rem"
                            }}>
                                {/* Ingresos Totales */}
                                <div style={{
                                    background: "linear-gradient(135deg, #1E293B, #334155)",
                                    borderRadius: "14px", padding: "1rem 1.25rem",
                                    boxShadow: "0 4px 12px rgba(0,0,0,0.15)"
                                }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "0.5rem" }}>
                                        <TrendingUp size={16} color="#34D399" />
                                        <span style={{ color: "rgba(255,255,255,0.7)", fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase" }}>Ingresos Totales</span>
                                    </div>
                                    <div style={{ color: "white", fontSize: "1.5rem", fontWeight: 900 }}>
                                        S/ {formatSoles(totalRevenue)}
                                    </div>
                                    <div style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.68rem", marginTop: "4px" }}>
                                        Cerrados: S/ {formatSoles(closedRevenue)} + Proyección: S/ {formatSoles(activeRevenue * 0.5)}
                                    </div>
                                </div>

                                {/* Costos Totales */}
                                <div style={{
                                    background: "linear-gradient(135deg, #7C2D12, #9A3412)",
                                    borderRadius: "14px", padding: "1rem 1.25rem",
                                    boxShadow: "0 4px 12px rgba(0,0,0,0.15)"
                                }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "0.5rem" }}>
                                        <TrendingDown size={16} color="#FCA5A5" />
                                        <span style={{ color: "rgba(255,255,255,0.7)", fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase" }}>Costos Totales</span>
                                    </div>
                                    <div style={{ color: "white", fontSize: "1.5rem", fontWeight: 900 }}>
                                        S/ {formatSoles(totalCosts)}
                                    </div>
                                    <div style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.68rem", marginTop: "4px" }}>
                                        MO + Materiales + Viáticos
                                    </div>
                                </div>

                                {/* Utilidad Neta (Rentabilidad) */}
                                <div style={{
                                    background: "linear-gradient(135deg, #166534, #15803D)",
                                    borderRadius: "14px", padding: "1rem 1.25rem",
                                    boxShadow: "0 4px 12px rgba(0,0,0,0.15)"
                                }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "0.5rem" }}>
                                        <Coins size={16} color="#6EE7B7" />
                                        <span style={{ color: "rgba(255,255,255,0.7)", fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase" }}>Utilidad Neta</span>
                                    </div>
                                    <div style={{ color: "white", fontSize: "1.5rem", fontWeight: 900 }}>
                                        S/ {formatSoles(netProfit)}
                                    </div>
                                    <div style={{ display: "flex", alignItems: "center", gap: "4px", marginTop: "4px" }}>
                                        <span style={{
                                            background: "rgba(255,255,255,0.15)",
                                            color: "white", fontSize: "0.68rem", fontWeight: 800,
                                            padding: "2px 8px", borderRadius: "4px"
                                        }}>
                                            {marginPct.toFixed(1)}% margen
                                        </span>
                                        <span style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.65rem" }}>
                                            {closedThisMonth.length} tickets cerrados
                                        </span>
                                    </div>
                                </div>

                                {/* Tickets Activos con Proyección */}
                                <div style={{
                                    background: "linear-gradient(135deg, #4C1D95, #6D28D9)",
                                    borderRadius: "14px", padding: "1rem 1.25rem",
                                    boxShadow: "0 4px 12px rgba(0,0,0,0.15)"
                                }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "0.5rem" }}>
                                        <Wrench size={16} color="#C4B5FD" />
                                        <span style={{ color: "rgba(255,255,255,0.7)", fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase" }}>Tickets en Proceso</span>
                                    </div>
                                    <div style={{ color: "white", fontSize: "1.5rem", fontWeight: 900 }}>
                                        {activeTickets.length}
                                    </div>
                                    <div style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.68rem", marginTop: "4px" }}>
                                        Proyección util: S/ {formatSoles(activeProfit * 0.5)}
                                    </div>
                                </div>
                            </div>
                        );
                    })()}

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
                            <div style={{ marginBottom: '1.25rem', background: 'white', borderRadius: '16px', border: '1px solid #E2E8F0', boxShadow: '0 2px 8px rgba(0,0,0,0.04)', overflow: 'hidden' }}>
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
                                        <span style={{ color: '#64748B', fontWeight: 600 }}>Progreso hacia bono de S/ {formatSoles(metaBono)}</span>
                                        <span style={{ color: barColor, fontWeight: 900 }}>S/ {formatSoles(bonusEarned)} ganado</span>
                                    </div>
                                    <div style={{ height: '10px', background: '#F1F5F9', borderRadius: '5px', overflow: 'hidden', marginBottom: '0.5rem', position: 'relative' }}>
                                        <div style={{ width: `${percentAchieved}%`, height: '100%', background: `linear-gradient(90deg,${barColor},${barColor}99)`, borderRadius: '5px', transition: 'width 1s ease' }} />
                                        <div style={{ position: 'absolute', top: 0, left: '80%', width: '2px', height: '100%', background: '#94A3B8', opacity: 0.7 }} title="Mínimo 80% para bono" />
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: '#94A3B8', marginBottom: '0.75rem' }}>
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
                                            <div key={i} style={{ background: '#F8FAFC', borderRadius: '10px', padding: '0.6rem 0.9rem', border: '1px solid #F1F5F9' }}>
                                                <div style={{ fontSize: '1rem', fontWeight: 900, color: s.color }}>{s.val}</div>
                                                <div style={{ fontSize: '0.68rem', color: '#94A3B8', fontWeight: 600, marginTop: '2px' }}>{s.label}</div>
                                            </div>
                                        ))}
                                    </div>

                                    {/* IMPULSO FINAL */}
                                    {faltante > 0 && impulsoTickets.length > 0 && (
                                        <div style={{ background: 'linear-gradient(135deg,#F5F3FF,#EDE9FE)', border: '1px solid #C4B5FD', borderRadius: '12px', padding: '0.9rem 1rem' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                                                <Zap size={14} color="#7C3AED" />
                                                <span style={{ color: '#7C3AED', fontWeight: 900, fontSize: '0.82rem' }}>
                                                    IMPULSO FINAL — Cierra estos tickets para asegurar tu bono de S/ {formatSoles(metaBono)}
                                                </span>
                                            </div>
                                            {impulsoTickets.map((t: any, j: number) => (
                                                <div
                                                    key={j}
                                                    onClick={() => { if (!openTicketIds.includes(t.id)) setOpenTicketIds([...openTicketIds, t.id]); }}
                                                    style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 8px', background: 'white', borderRadius: '8px', marginBottom: '4px', cursor: 'pointer', border: '1px solid #DDD6FE' }}
                                                >
                                                    <div>
                                                        <span style={{ color: '#1E293B', fontWeight: 700, fontSize: '0.8rem' }}>{t.numeroTicketCliente || t.id?.slice(0,8)}</span>
                                                        <span style={{ color: '#94A3B8', fontSize: '0.72rem', marginLeft: '8px' }}>{normalizeStateId(t.estadoId).replace(/_/g,' ')}</span>
                                                    </div>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                        <span style={{ color: '#059669', fontWeight: 900, fontSize: '0.82rem' }}>+S/ {formatSoles(t._utility)}</span>
                                                        <ChevronRight size={13} color="#94A3B8" />
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {faltante <= 0 && percentAchieved > 0 && (
                                        <div style={{ background: 'linear-gradient(135deg,#ECFDF5,#D1FAE5)', border: '1px solid #6EE7B7', borderRadius: '12px', padding: '0.75rem 1rem', textAlign: 'center' }}>
                                            <span style={{ color: '#059669', fontWeight: 800, fontSize: '0.85rem' }}>🎉 ¡Felicidades! Tu bono de S/ {formatSoles(bonusEarned)} ha sido confirmado.</span>
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
                        <h2 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 700, color: "#1E293B" }}>
                            {technicians?.length || 0} Técnicos Activos
                        </h2>
                    </div>
                    
                    {loading ? (
                        <div style={{ textAlign: "center", padding: "4rem", color: "#94A3B8" }}>
                            <div style={{ width: 40, height: 40, border: "4px solid #f97316", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 1s linear infinite", margin: "0 auto 1rem" }} />
                            <p style={{ margin: 0, fontSize: "1rem", fontWeight: 600 }}>Cargando técnicos...</p>
                        </div>
                    ) : !technicians || technicians.length === 0 ? (
                        <div style={{ textAlign: "center", padding: "4rem", color: "#94A3B8" }}>
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
                                    background: "white", borderRadius: "14px", padding: "1rem",
                                    border: "1px solid #E2E8F0",
                                    boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
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
                                            <p style={{ margin: 0, fontWeight: 700, fontSize: "0.95rem", color: "#1E293B" }}>
                                                {fullName}
                                            </p>
                                            <p style={{ margin: "0.2rem 0 0", fontSize: "0.75rem", color: "#64748B" }}>
                                                {docType}: {docNumber}
                                            </p>
                                            {/* Rating */}
                                            <div style={{ display: "flex", gap: "2px", marginTop: "0.25rem" }}>
                                                {[1,2,3,4,5].map(s => (
                                                    <Star key={s} size={12} fill={s <= rating ? "#F59E0B" : "transparent"} color={s <= rating ? "#F59E0B" : "#CBD5E1"} />
                                                ))}
                                            </div>
                                        </div>
                                        <div style={{
                                            padding: "0.3rem 0.6rem", borderRadius: "20px",
                                            background: tech.estado === 'ACTIVO' ? "#ECFDF5" : "#F1F5F9",
                                            color: tech.estado === 'ACTIVO' ? "#059669" : "#64748B",
                                            fontSize: "0.7rem", fontWeight: 700,
                                            textTransform: "uppercase"
                                        }}>
                                            {tech.estado || "ACTIVO"}
                                        </div>
                                    </div>
                                    
                                    {/* Teléfono en recuadro verde */}
                                    <div style={{
                                        background: "#ECFDF5", borderRadius: "8px", padding: "0.5rem 0.75rem",
                                        display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.75rem"
                                    }}>
                                        <span style={{ fontSize: "0.8rem", color: "#059669" }}>📱</span>
                                        <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "#047857" }}>{phone}</span>
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
                                                        background: zone?.color ? `${zone.color}15` : "#F1F5F9",
                                                        fontSize: "0.65rem", fontWeight: 600,
                                                        color: zone?.color ? "#1E293B" : "#64748B"
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
                    <div style={{ textAlign: "center", padding: "3rem", background: "white", borderRadius: "12px", border: "1px solid #E2E8F0" }}>
                        <BarChart3 size={48} style={{ margin: "0 auto 1rem", color: "#4338CA" }} />
                        <h2 style={{ margin: "0 0 0.5rem", color: "#1E293B", fontSize: "1.25rem" }}>Reportes de Eficiencia</h2>
                        <p style={{ margin: 0, color: "#64748B" }}>
                            Período: {dateFilter === "today" ? "Hoy" : dateFilter === "week" ? "Esta Semana" : dateFilter === "month" ? "Este Mes" : "Todos"}
                        </p>
                        
                        {/* KPI Summary */}
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1rem", marginTop: "2rem" }}>
                            <div style={{ padding: "1rem", background: "#F8FAFC", borderRadius: "8px" }}>
                                <div style={{ fontSize: "1.5rem", fontWeight: 900, color: "#4338CA" }}>{kpis.total}</div>
                                <div style={{ fontSize: "0.75rem", color: "#64748B" }}>Total Tickets</div>
                            </div>
                            <div style={{ padding: "1rem", background: "#F8FAFC", borderRadius: "8px" }}>
                                <div style={{ fontSize: "1.5rem", fontWeight: 900, color: "#10B981" }}>{kpis.closed.length}</div>
                                <div style={{ fontSize: "0.75rem", color: "#64748B" }}>Cerrados</div>
                            </div>
                            <div style={{ padding: "1rem", background: "#F8FAFC", borderRadius: "8px" }}>
                                <div style={{ fontSize: "1.5rem", fontWeight: 900, color: "#F59E0B" }}>{kpis.backlog.length}</div>
                                <div style={{ fontSize: "0.75rem", color: "#64748B" }}>En Proceso</div>
                            </div>
                        </div>
                        
                        {/* Stats detailed */}
                        <div style={{ marginTop: "1.5rem", textAlign: "left", padding: "1rem", background: "#EEF2FF", borderRadius: "8px" }}>
                            <h3 style={{ margin: "0 0 0.75rem", fontSize: "0.9rem", color: "#4338CA" }}>Metricas Detalladas</h3>
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem", fontSize: "0.85rem" }}>
                                <div>SLA Cumplimiento:</div>
                                <div style={{ fontWeight: 700 }}>{kpis.slaCompliance}%</div>
                                <div>MTTR Promedio:</div>
                                <div style={{ fontWeight: 700 }}>{kpis.mttrHours > 0 ? formatHours(kpis.mttrHours) : "-"}</div>
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
function KpiCard({ label, value, icon, iconBg, sub, trend, alert = false }: {
    label: string; value: any; icon: React.ReactNode;
    iconBg: string; sub: string; trend: "up" | "down" | null; alert?: boolean;
}) {
    // Normalizar valor: mostrar "-" o "0" si es null/undefined
    const displayValue = (value === null || value === undefined) ? "0" : String(value);
    const isZero = displayValue === "0" || displayValue === "0.0";
    
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
                <div style={{ fontSize: "1.6rem", fontWeight: 900, color: isZero ? "#94A3B8" : alert ? "#EF4444" : "#1E293B", lineHeight: 1 }}>{displayValue}</div>
                <div style={{ fontSize: "0.73rem", fontWeight: 700, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.5px", marginTop: "4px" }}>{label}</div>
            </div>
            <div style={{ fontSize: "0.71rem", color: "#94A3B8" }}>{sub}</div>
        </div>
    );
<style>{`
@keyframes spin { to { transform: rotate(360deg); } }
`}</style>
}

<style>{`
@keyframes spin { to { transform: rotate(360deg); } }
`}</style>
