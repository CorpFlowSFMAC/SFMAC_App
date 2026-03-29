"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
    Clock, Users, TrendingUp, Flame, Star, Calendar,
    CheckCircle2, AlertCircle, RefreshCw, ChevronDown, ChevronUp,
    LogIn, LogOut, Timer
} from "lucide-react";
import { supabase } from "@/lib/supabase";

// ── Tipos ─────────────────────────────────────────────
interface Turno {
    id: string;
    usuario_email: string;
    usuario_nombre: string | null;
    fecha: string;
    hora_ingreso: string;
    hora_salida: string | null;
    estado: "EN_CURSO" | "CERRADO";
    horas_trabajadas: number | null;
    observaciones: string | null;
}

// ── Helpers ───────────────────────────────────────────
function formatHora(iso: string): string {
    return new Date(iso).toLocaleTimeString("es-PE", {
        hour: "2-digit", minute: "2-digit", hour12: true
    });
}

function formatFecha(dateStr: string): string {
    return new Date(dateStr + "T00:00:00").toLocaleDateString("es-PE", {
        weekday: "short", day: "2-digit", month: "short"
    });
}

function calcHorasActual(ingreso: string): number {
    return (Date.now() - new Date(ingreso).getTime()) / 3_600_000;
}

function HorasBadge({ horas }: { horas: number | null; esEnCurso?: boolean }) {
    if (horas === null) return <span style={{ color: "#94A3B8", fontSize: "0.8rem" }}>—</span>;
    const esExtra = horas > 9;
    const esLarga = horas >= 8 && horas <= 9;
    return (
        <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", fontWeight: 800, fontSize: "0.85rem", fontFamily: "monospace" }}>
            <span style={{ color: esExtra ? "#059669" : esLarga ? "#0284C7" : "#475569" }}>
                {horas.toFixed(1)}h
            </span>
            {esExtra && (
                <span title="¡Horas extra — esfuerzo destacado!" style={{
                    display: "inline-flex", alignItems: "center", gap: "2px",
                    background: "linear-gradient(135deg,#DCFCE7,#BBF7D0)",
                    border: "1px solid #86EFAC", borderRadius: "6px",
                    padding: "1px 6px", fontSize: "0.7rem", fontWeight: 800, color: "#15803D"
                }}>
                    🔥 Extra
                </span>
            )}
        </span>
    );
}

// ── MAIN ──────────────────────────────────────────────
export default function AsistenciaAdminPage() {
    const [turnos, setTurnos] = useState<Turno[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedDate, setSelectedDate] = useState(
        new Date().toISOString().split("T")[0]
    );
    const [expandedUser, setExpandedUser] = useState<string | null>(null);
    const [tick, setTick] = useState(0); // refresco cada minuto para turnos EN_CURSO

    const fetchTurnos = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from("turnos")
            .select("*")
            .order("fecha", { ascending: false })
            .order("hora_ingreso", { ascending: false });
        if (!error && data) setTurnos(data as Turno[]);
        setLoading(false);
    };

    useEffect(() => {
        fetchTurnos();
        // Tick cada 60s para actualizar horas EN_CURSO sin refetch
        const interval = setInterval(() => setTick(t => t + 1), 60_000);
        return () => clearInterval(interval);
    }, []);

    // Turnos del día seleccionado
    const turnosDia = useMemo(() =>
        turnos.filter(t => t.fecha === selectedDate),
        [turnos, selectedDate]
    );

    // Agrupado por usuario (para historial)
    const porUsuario = useMemo(() => {
        const map: Record<string, Turno[]> = {};
        turnos.forEach(t => {
            if (!map[t.usuario_email]) map[t.usuario_email] = [];
            map[t.usuario_email].push(t);
        });
        return map;
    }, [turnos]);

    // KPIs del día
    const kpis = useMemo(() => {
        const enCurso = turnosDia.filter(t => t.estado === "EN_CURSO");
        const cerrados = turnosDia.filter(t => t.estado === "CERRADO");
        const conExtra = cerrados.filter(t => (t.horas_trabajadas ?? 0) > 9);
        const promedio = cerrados.length > 0
            ? cerrados.reduce((s, t) => s + (t.horas_trabajadas ?? 0), 0) / cerrados.length
            : 0;
        return { enCurso, cerrados, conExtra, promedio };
    }, [turnosDia]);

    // Días disponibles para el selector
    const diasDisponibles = useMemo(() => {
        const set = new Set(turnos.map(t => t.fecha));
        const today = new Date().toISOString().split("T")[0];
        set.add(today);
        return Array.from(set).sort((a, b) => b.localeCompare(a)).slice(0, 30);
    }, [turnos]);

    const isToday = selectedDate === new Date().toISOString().split("T")[0];

    return (
        <div style={{ padding: "1.5rem 2rem", minHeight: "100vh", background: "#F8FAFC", fontFamily: "Inter, system-ui, sans-serif" }}>

            {/* ── HEADER ── */}
            <div style={{
                background: "linear-gradient(135deg, #0F172A 0%, #1E293B 50%, #334155 100%)",
                borderRadius: "20px", padding: "1.5rem 2rem", marginBottom: "1.5rem",
                display: "flex", justifyContent: "space-between", alignItems: "center",
                boxShadow: "0 10px 40px rgba(15,23,42,0.3)"
            }}>
                <div style={{ display: "flex", gap: "1.25rem", alignItems: "center" }}>
                    <div style={{
                        width: "52px", height: "52px", borderRadius: "14px",
                        background: "rgba(255,255,255,0.1)", display: "flex",
                        alignItems: "center", justifyContent: "center"
                    }}>
                        <Clock size={26} color="white" />
                    </div>
                    <div>
                        <h1 style={{ color: "white", fontWeight: 900, fontSize: "1.4rem", margin: 0 }}>
                            Asistencia y Planillas
                        </h1>
                        <p style={{ color: "rgba(255,255,255,0.55)", fontSize: "0.8rem", margin: "4px 0 0" }}>
                            Control de turnos del personal interno — Gestoras y Admin
                        </p>
                    </div>
                </div>
                <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
                    {/* Selector de fecha */}
                    <select
                        value={selectedDate}
                        onChange={e => setSelectedDate(e.target.value)}
                        style={{
                            padding: "0.5rem 1rem", borderRadius: "10px", border: "1px solid rgba(255,255,255,0.2)",
                            background: "rgba(255,255,255,0.1)", color: "white", fontSize: "0.82rem",
                            fontWeight: 700, cursor: "pointer", outline: "none"
                        }}
                    >
                        {diasDisponibles.map(d => (
                            <option key={d} value={d} style={{ background: "#1E293B" }}>
                                {d === new Date().toISOString().split("T")[0] ? `📅 Hoy — ${d}` : formatFecha(d)}
                            </option>
                        ))}
                    </select>
                    <button
                        onClick={fetchTurnos}
                        style={{
                            background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.2)",
                            color: "white", borderRadius: "10px", padding: "0.5rem 0.9rem",
                            cursor: "pointer", display: "flex", alignItems: "center", gap: "5px",
                            fontSize: "0.8rem", fontWeight: 700, transition: "all 0.2s"
                        }}
                        title="Actualizar"
                    >
                        <RefreshCw size={14} />
                        Actualizar
                    </button>
                </div>
            </div>

            {/* ── KPI CARDS ── */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "1rem", marginBottom: "1.5rem" }}>
                <KpiCard
                    icon={<Users size={20} color="#4338CA" />}
                    iconBg="#EEF2FF"
                    label="Activos ahora"
                    value={kpis.enCurso.length}
                    sub="Turnos EN_CURSO"
                    pulse={kpis.enCurso.length > 0}
                />
                <KpiCard
                    icon={<CheckCircle2 size={20} color="#059669" />}
                    iconBg="#DCFCE7"
                    label="Salidas registradas"
                    value={kpis.cerrados.length}
                    sub={`Hoy — ${formatFecha(selectedDate)}`}
                />
                <KpiCard
                    icon={<Timer size={20} color="#0284C7" />}
                    iconBg="#DBEAFE"
                    label="Promedio del día"
                    value={kpis.promedio > 0 ? `${kpis.promedio.toFixed(1)}h` : "—"}
                    sub="Horas trabajadas"
                />
                <KpiCard
                    icon={<Flame size={20} color="#DC2626" />}
                    iconBg="#FEE2E2"
                    label="Horas extra 🔥"
                    value={kpis.conExtra.length}
                    sub="Personal > 9h hoy"
                    highlight={kpis.conExtra.length > 0}
                />
            </div>

            {/* ── TABLA DE TURNOS DEL DÍA ── */}
            <div style={{
                background: "white", borderRadius: "16px", border: "1px solid #E2E8F0",
                boxShadow: "0 2px 8px rgba(0,0,0,0.04)", overflow: "hidden", marginBottom: "1.5rem"
            }}>
                <div style={{
                    padding: "1rem 1.5rem", borderBottom: "1px solid #F1F5F9",
                    display: "flex", justifyContent: "space-between", alignItems: "center"
                }}>
                    <h2 style={{ margin: 0, fontSize: "0.95rem", fontWeight: 800, color: "#1E293B", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        <Calendar size={16} color="#4338CA" />
                        Turnos del {isToday ? "día de hoy" : formatFecha(selectedDate)}
                    </h2>
                    <span style={{
                        background: "#EEF2FF", color: "#4338CA", fontSize: "0.72rem",
                        fontWeight: 800, padding: "3px 10px", borderRadius: "999px"
                    }}>
                        {turnosDia.length} registro{turnosDia.length !== 1 ? "s" : ""}
                    </span>
                </div>

                {loading ? (
                    <div style={{ padding: "3rem", textAlign: "center", color: "#94A3B8" }}>
                        <RefreshCw size={28} style={{ animation: "spin 1s linear infinite", margin: "0 auto 0.5rem" }} />
                        <p style={{ margin: 0, fontSize: "0.85rem" }}>Cargando turnos...</p>
                    </div>
                ) : turnosDia.length === 0 ? (
                    <div style={{ padding: "3rem", textAlign: "center", color: "#94A3B8" }}>
                        <AlertCircle size={32} style={{ margin: "0 auto 0.5rem", opacity: 0.4 }} />
                        <p style={{ margin: 0, fontWeight: 600, fontSize: "0.9rem" }}>Sin registros para este día</p>
                        <p style={{ margin: "6px 0 0", fontSize: "0.78rem" }}>Aún nadie ha marcado ingreso hoy.</p>
                    </div>
                ) : (
                    <table style={{ width: "100%", borderCollapse: "collapse" }}>
                        <thead>
                            <tr style={{ background: "#F8FAFC" }}>
                                {["Personal", "Ingreso", "Salida", "Horas totales", "Estado"].map(h => (
                                    <th key={h} style={{
                                        padding: "0.7rem 1.25rem", textAlign: "left",
                                        fontSize: "0.68rem", fontWeight: 800, color: "#64748B",
                                        textTransform: "uppercase", letterSpacing: "0.06em",
                                        borderBottom: "1px solid #F1F5F9"
                                    }}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {turnosDia.map((turno, idx) => {
                                const horasActual = turno.estado === "EN_CURSO"
                                    ? calcHorasActual(turno.hora_ingreso)
                                    : (turno.horas_trabajadas ?? 0);
                                const esExtra = horasActual > 9;

                                return (
                                    <tr key={turno.id} style={{
                                        background: idx % 2 === 0 ? "white" : "#FAFBFC",
                                        borderBottom: "1px solid #F1F5F9",
                                        transition: "background 0.15s"
                                    }}>
                                        {/* Personal */}
                                        <td style={{ padding: "0.9rem 1.25rem" }}>
                                            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                                                <div style={{
                                                    width: 34, height: 34, borderRadius: "50%",
                                                    background: "linear-gradient(135deg,#4338CA,#6366F1)",
                                                    display: "flex", alignItems: "center", justifyContent: "center",
                                                    color: "white", fontSize: "0.85rem", fontWeight: 800, flexShrink: 0
                                                }}>
                                                    {(turno.usuario_nombre || turno.usuario_email).charAt(0).toUpperCase()}
                                                </div>
                                                <div>
                                                    <div style={{ fontWeight: 700, fontSize: "0.85rem", color: "#1E293B" }}>
                                                        {turno.usuario_nombre || "—"}
                                                    </div>
                                                    <div style={{ fontSize: "0.7rem", color: "#94A3B8" }}>
                                                        {turno.usuario_email}
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                        {/* Ingreso */}
                                        <td style={{ padding: "0.9rem 1.25rem" }}>
                                            <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                                                <LogIn size={13} color="#059669" />
                                                <span style={{ fontFamily: "monospace", fontSize: "0.85rem", fontWeight: 700, color: "#1E293B" }}>
                                                    {formatHora(turno.hora_ingreso)}
                                                </span>
                                            </div>
                                        </td>
                                        {/* Salida */}
                                        <td style={{ padding: "0.9rem 1.25rem" }}>
                                            {turno.hora_salida ? (
                                                <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                                                    <LogOut size={13} color="#EF4444" />
                                                    <span style={{ fontFamily: "monospace", fontSize: "0.85rem", fontWeight: 700, color: "#1E293B" }}>
                                                        {formatHora(turno.hora_salida)}
                                                    </span>
                                                </div>
                                            ) : (
                                                <span style={{ fontSize: "0.78rem", color: "#94A3B8", fontStyle: "italic" }}>
                                                    Sigue activa...
                                                </span>
                                            )}
                                        </td>
                                        {/* Horas */}
                                        <td style={{ padding: "0.9rem 1.25rem" }}>
                                            <HorasBadge
                                                horas={turno.estado === "EN_CURSO" ? horasActual : turno.horas_trabajadas}
                                                esEnCurso={turno.estado === "EN_CURSO"}
                                            />
                                            {turno.estado === "EN_CURSO" && (
                                                <span style={{ fontSize: "0.65rem", color: "#94A3B8", display: "block", marginTop: "2px" }}>
                                                    (en tiempo real)
                                                </span>
                                            )}
                                        </td>
                                        {/* Estado */}
                                        <td style={{ padding: "0.9rem 1.25rem" }}>
                                            {turno.estado === "EN_CURSO" ? (
                                                <span style={{
                                                    display: "inline-flex", alignItems: "center", gap: "5px",
                                                    background: "#DCFCE7", color: "#15803D",
                                                    fontSize: "0.72rem", fontWeight: 800, padding: "4px 10px",
                                                    borderRadius: "999px", border: "1px solid #86EFAC"
                                                }}>
                                                    <span style={{
                                                        width: 6, height: 6, borderRadius: "50%",
                                                        background: "#22C55E",
                                                        animation: "pulse 2s infinite"
                                                    }} />
                                                    EN CURSO
                                                </span>
                                            ) : (
                                                <span style={{
                                                    display: "inline-flex", alignItems: "center", gap: "5px",
                                                    background: esExtra ? "#F0FDF4" : "#F8FAFC",
                                                    color: esExtra ? "#15803D" : "#475569",
                                                    fontSize: "0.72rem", fontWeight: 800, padding: "4px 10px",
                                                    borderRadius: "999px",
                                                    border: `1px solid ${esExtra ? "#86EFAC" : "#E2E8F0"}`
                                                }}>
                                                    {esExtra ? "🔥 EXTRA" : "✓ CERRADO"}
                                                </span>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                )}
            </div>

            {/* ── HISTORIAL POR USUARIO ── */}
            {Object.keys(porUsuario).length > 0 && (
                <div style={{
                    background: "white", borderRadius: "16px", border: "1px solid #E2E8F0",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.04)", overflow: "hidden"
                }}>
                    <div style={{ padding: "1rem 1.5rem", borderBottom: "1px solid #F1F5F9" }}>
                        <h2 style={{ margin: 0, fontSize: "0.95rem", fontWeight: 800, color: "#1E293B", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                            <TrendingUp size={16} color="#4338CA" />
                            Historial por Persona
                        </h2>
                    </div>
                    <div style={{ padding: "1rem" }}>
                        {Object.entries(porUsuario).map(([email, turnosUser]) => {
                            const nombre = turnosUser[0]?.usuario_nombre || email;
                            const totalExtra = turnosUser.filter(t => (t.horas_trabajadas ?? 0) > 9).length;
                            const isExpanded = expandedUser === email;
                            return (
                                <div key={email} style={{
                                    border: "1px solid #F1F5F9", borderRadius: "12px",
                                    marginBottom: "0.75rem", overflow: "hidden"
                                }}>
                                    <button
                                        onClick={() => setExpandedUser(isExpanded ? null : email)}
                                        style={{
                                            width: "100%", background: isExpanded ? "#F8FAFC" : "white",
                                            border: "none", cursor: "pointer", padding: "0.9rem 1.25rem",
                                            display: "flex", justifyContent: "space-between", alignItems: "center",
                                            transition: "background 0.2s"
                                        }}
                                    >
                                        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                                            <div style={{
                                                width: 32, height: 32, borderRadius: "50%",
                                                background: "linear-gradient(135deg,#4338CA,#6366F1)",
                                                display: "flex", alignItems: "center", justifyContent: "center",
                                                color: "white", fontSize: "0.8rem", fontWeight: 800
                                            }}>
                                                {nombre.charAt(0).toUpperCase()}
                                            </div>
                                            <div style={{ textAlign: "left" }}>
                                                <div style={{ fontWeight: 700, fontSize: "0.85rem", color: "#1E293B" }}>{nombre}</div>
                                                <div style={{ fontSize: "0.7rem", color: "#94A3B8" }}>
                                                    {turnosUser.length} turno{turnosUser.length !== 1 ? "s" : ""}
                                                    {totalExtra > 0 && (
                                                        <span style={{ marginLeft: "6px", color: "#15803D", fontWeight: 700 }}>
                                                            · 🔥 {totalExtra} día{totalExtra !== 1 ? "s" : ""} con horas extra
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                        {isExpanded ? <ChevronUp size={16} color="#94A3B8" /> : <ChevronDown size={16} color="#94A3B8" />}
                                    </button>
                                    {isExpanded && (
                                        <div style={{ borderTop: "1px solid #F1F5F9" }}>
                                            <table style={{ width: "100%", borderCollapse: "collapse" }}>
                                                <thead>
                                                    <tr style={{ background: "#F8FAFC" }}>
                                                        {["Fecha", "Ingreso", "Salida", "Total", ""].map(h => (
                                                            <th key={h} style={{
                                                                padding: "0.55rem 1.25rem", textAlign: "left",
                                                                fontSize: "0.65rem", fontWeight: 800, color: "#94A3B8",
                                                                textTransform: "uppercase", letterSpacing: "0.05em"
                                                            }}>{h}</th>
                                                        ))}
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {turnosUser.map((t, i) => (
                                                        <tr key={t.id} style={{ background: i % 2 === 0 ? "white" : "#FAFBFC", borderTop: "1px solid #F8FAFC" }}>
                                                            <td style={{ padding: "0.65rem 1.25rem", fontSize: "0.8rem", fontWeight: 600, color: "#475569" }}>
                                                                {formatFecha(t.fecha)}
                                                            </td>
                                                            <td style={{ padding: "0.65rem 1.25rem", fontFamily: "monospace", fontSize: "0.8rem", color: "#1E293B" }}>
                                                                {formatHora(t.hora_ingreso)}
                                                            </td>
                                                            <td style={{ padding: "0.65rem 1.25rem", fontFamily: "monospace", fontSize: "0.8rem", color: t.hora_salida ? "#1E293B" : "#94A3B8" }}>
                                                                {t.hora_salida ? formatHora(t.hora_salida) : "—"}
                                                            </td>
                                                            <td style={{ padding: "0.65rem 1.25rem" }}>
                                                                <HorasBadge horas={t.horas_trabajadas} />
                                                            </td>
                                                            <td style={{ padding: "0.65rem 1.25rem" }}>
                                                                {t.estado === "EN_CURSO" && (
                                                                    <span style={{
                                                                        background: "#DCFCE7", color: "#15803D",
                                                                        fontSize: "0.65rem", fontWeight: 800, padding: "2px 8px", borderRadius: "999px"
                                                                    }}>
                                                                        EN CURSO
                                                                    </span>
                                                                )}
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            <style>{`
                @keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
                @keyframes pulse {
                    0%, 100% { opacity: 1; transform: scale(1); }
                    50% { opacity: 0.6; transform: scale(1.4); }
                }
            `}</style>
        </div>
    );
}

// ── KPI Card ──────────────────────────────────────────
function KpiCard({ icon, iconBg, label, value, sub, pulse = false, highlight = false }: {
    icon: React.ReactNode; iconBg: string; label: string;
    value: any; sub: string; pulse?: boolean; highlight?: boolean;
}) {
    return (
        <div style={{
            background: "white", borderRadius: "14px", padding: "1.1rem 1.25rem",
            border: `1px solid ${highlight ? "#86EFAC50" : "#E2E8F0"}`,
            boxShadow: highlight ? "0 0 0 2px #DCFCE780" : "0 2px 8px rgba(0,0,0,0.04)",
            display: "flex", flexDirection: "column", gap: "0.5rem"
        }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div style={{ width: 36, height: 36, borderRadius: "10px", background: iconBg, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {icon}
                </div>
                {pulse && (
                    <span style={{
                        width: 8, height: 8, borderRadius: "50%", background: "#22C55E",
                        animation: "pulse 2s infinite", display: "block", marginTop: "4px"
                    }} />
                )}
            </div>
            <div>
                <div style={{ fontSize: "1.7rem", fontWeight: 900, color: highlight ? "#15803D" : "#1E293B", lineHeight: 1 }}>
                    {value}
                </div>
                <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.5px", marginTop: "4px" }}>
                    {label}
                </div>
            </div>
            <div style={{ fontSize: "0.7rem", color: "#94A3B8" }}>{sub}</div>
        </div>
    );
}
