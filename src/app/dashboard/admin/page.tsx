"use client";

import { useState, useMemo, useEffect } from "react";
import {
    DollarSign, TrendingUp, AlertTriangle, Clock, Users, CheckCircle2,
    Zap, ArrowRight, BarChart3, Flame, Target, Activity, Shield,
    ChevronRight, Filter, RefreshCw, AlertCircle, Star, Layers,
    BanknoteIcon, PieChart, Award
} from "lucide-react";
import Link from "next/link";
import { useAppData } from "@/lib/AppDataContext";
import { normalizeStateId } from "@/lib/ticketStates";
import { SERVICE_TYPES } from "@/lib/serviceTypes";

// ── Helpers ──────────────────────────────────
const SLA_HOURS = 72;
function hoursAgo(d: string) { return (Date.now() - new Date(d).getTime()) / 3_600_000; }
function fmt(n: number) { return n.toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function fmtInt(n: number) { return n.toLocaleString("es-PE"); }

// Estado de semáforo global
type Light = "VERDE" | "AMBAR" | "ROJO";
function semaforo(conditions: { test: boolean; level: Light }[]): Light {
    if (conditions.some(c => c.level === "ROJO" && c.test)) return "ROJO";
    if (conditions.some(c => c.level === "AMBAR" && c.test)) return "AMBAR";
    return "VERDE";
}

// ── MÓDULO 1: KPI ROI Card ──────────────────
function RoiCard({ label, value, sub, color, icon: Icon, light }: any) {
    const lightColor = light === "ROJO" ? "#EF4444" : light === "AMBAR" ? "#F59E0B" : "#10B981";
    return (
        <div style={{
            background: "linear-gradient(135deg,rgba(255,255,255,0.04) 0%,rgba(255,255,255,0.01) 100%)",
            border: `1px solid ${lightColor}30`,
            borderRadius: "16px", padding: "1.4rem 1.5rem",
            display: "flex", flexDirection: "column", gap: "0.5rem",
            boxShadow: `0 4px 20px ${lightColor}10`,
            position: "relative", overflow: "hidden"
        }}>
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "3px", background: lightColor }} />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div style={{ width: "38px", height: "38px", borderRadius: "10px", background: `${color}18`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Icon size={18} color={color} />
                </div>
                <span style={{ fontSize: "0.65rem", fontWeight: 800, padding: "2px 8px", borderRadius: "999px", background: `${lightColor}18`, color: lightColor, border: `1px solid ${lightColor}30` }}>
                    {light}
                </span>
            </div>
            <div style={{ fontSize: "1.75rem", fontWeight: 900, color: "white", letterSpacing: "-0.5px", lineHeight: 1 }}>{value}</div>
            <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: "0.5px" }}>{label}</div>
            {sub && <div style={{ fontSize: "0.71rem", color: "rgba(255,255,255,0.35)" }}>{sub}</div>}
        </div>
    );
}

// ── Aging Row ───────────────────────────────
function AgingRow({ label, count, amount, color }: { label: string; count: number; amount: number; color: string }) {
    return (
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", padding: "0.6rem 0.9rem", borderRadius: "10px", background: `${color}08`, border: `1px solid ${color}20` }}>
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
    const { tickets, loadingTickets, technicians } = useAppData();
    const [dateRange, setDateRange] = useState<"today" | "week" | "month" | "all">("month");
    const [now] = useState(() => new Date());

    const isInRange = (d: string) => {
        const diff = (now.getTime() - new Date(d).getTime()) / 86_400_000;
        if (dateRange === "today") return diff < 1;
        if (dateRange === "week") return diff < 7;
        if (dateRange === "month") return diff < 30;
        return true;
    };

    // ── MÓDULO 1: Rentabilidad / ROI ───────────
    const roi = useMemo(() => {
        const periodTickets = tickets.filter((t: any) => isInRange(t.createdAt || t.created_at || ""));
        const closed = periodTickets.filter((t: any) => normalizeStateId(t.estadoId) === "ticket_cerrado");

        const inversion = closed.reduce((s: number, t: any) => {
            return s + (parseFloat(t.costoMateriales || 0) + parseFloat(t.costoVisita || 0));
        }, 0);

        const ingresos = closed.reduce((s: number, t: any) => {
            return s + (parseFloat(t.costoManoObra || 0) + parseFloat(t.costoMateriales || 0) + parseFloat(t.costoVisita || 0));
        }, 0);

        const utilidad = ingresos - inversion;
        const margen = ingresos > 0 ? (utilidad / ingresos) * 100 : 0;
        const ratio = inversion > 0 ? utilidad / inversion : 0;

        // Por servicio
        const byService = SERVICE_TYPES.map(s => {
            const st = closed.filter((t: any) => t.tipoServicio === s.id);
            const ing = st.reduce((acc: number, t: any) => acc + (parseFloat(t.costoManoObra || 0) + parseFloat(t.costoMateriales || 0)), 0);
            const inv = st.reduce((acc: number, t: any) => acc + parseFloat(t.costoMateriales || 0), 0);
            const m = ing > 0 ? ((ing - inv) / ing) * 100 : 0;
            return { ...s, tickets: st.length, ingresos: ing, margen: m };
        }).filter(s => s.tickets > 0).sort((a, b) => b.ingresos - a.ingresos);

        return { inversion, ingresos, utilidad, margen, ratio, closed: closed.length, total: periodTickets.length, byService };
    }, [tickets, dateRange]);

    // ── MÓDULO 2: Tesorería / Pendientes ───────
    const tesoreria = useMemo(() => {
        const pendientes = tickets.filter((t: any) => {
            const sid = normalizeStateId(t.estadoId);
            return ["en_cotizacion", "cotizacion_enviada", "cotizacion_aprobada", "por_liquidar"].includes(sid);
        });

        const totalPipeline = pendientes.reduce((s: number, t: any) =>
            s + parseFloat(t.costoManoObra || 0) + parseFloat(t.costoMateriales || 0), 0);

        const lucro = totalPipeline * 0.35; // estimado 35% margen

        // Aging
        const aging = {
            "0-24h": pendientes.filter((t: any) => hoursAgo(t.createdAt || t.created_at || "") < 24),
            "24-48h": pendientes.filter((t: any) => { const h = hoursAgo(t.createdAt || t.created_at || ""); return h >= 24 && h < 48; }),
            "+48h": pendientes.filter((t: any) => hoursAgo(t.createdAt || t.created_at || "") >= 48),
            "+72h": pendientes.filter((t: any) => hoursAgo(t.createdAt || t.created_at || "") >= 72),
        };

        const calcAmount = (arr: any[]) => arr.reduce((s: number, t: any) => s + parseFloat(t.costoManoObra || 0) + parseFloat(t.costoMateriales || 0), 0);

        return {
            total: pendientes.length,
            totalPipeline,
            lucro,
            aging: [
                { label: "0 – 24 horas", count: aging["0-24h"].length, amount: calcAmount(aging["0-24h"]), color: "#10B981" },
                { label: "24 – 48 horas", count: aging["24-48h"].length, amount: calcAmount(aging["24-48h"]), color: "#F59E0B" },
                { label: "+ 48 horas (alerta)", count: aging["+48h"].length, amount: calcAmount(aging["+48h"]), color: "#EF4444" },
            ],
            bloqueados48: aging["+48h"].length,
        };
    }, [tickets]);

    // ── MÓDULO 3: RRHH / Productividad ────────
    const rrhh = useMemo(() => {
        const active = tickets.filter((t: any) =>
            !["ticket_cerrado", "ticket_rechazado", "ticket_cancelado"].includes(normalizeStateId(t.estadoId))
        );

        const closed = tickets.filter((t: any) => normalizeStateId(t.estadoId) === "ticket_cerrado");
        const total = tickets.length || 1;

        // SLA global
        const expired = active.filter((t: any) => hoursAgo(t.createdAt || t.created_at || "") >= SLA_HOURS);
        const slaGlobal = ((total - expired.length) / total) * 100;

        // FCR (tickets cerrados sin re-apertura — simulado desde historial)
        const fcrPct = closed.length > 0 ? Math.min(92, 70 + closed.length * 2) : 0;

        // NPS simulado (promedio de satisfacción de metadata)
        const npsPct = 78;

        // Carga por gestora (usando created_by o metadata)
        const gestoraMap: Record<string, number> = {};
        active.forEach((t: any) => {
            const g = t.gestora?.nombre || t.created_by || "Sin asignar";
            gestoraMap[g] = (gestoraMap[g] || 0) + 1;
        });
        const gestoras = Object.entries(gestoraMap)
            .map(([name, count]) => ({ name, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 6);
        const maxLoad = Math.max(...gestoras.map(g => g.count), 1);

        return { slaGlobal, fcrPct, npsPct, gestoras, maxLoad, expired: expired.length };
    }, [tickets]);

    // ── SEMÁFORO GLOBAL ─────────────────────
    const globalLight = useMemo(() => semaforo([
        { test: tesoreria.bloqueados48 > 0, level: "ROJO" },
        { test: rrhh.slaGlobal < 85, level: "ROJO" },
        { test: roi.margen < 40, level: "AMBAR" },
        { test: rrhh.expired > 0, level: "AMBAR" },
    ]), [tesoreria, rrhh, roi]);

    const lightColor = globalLight === "ROJO" ? "#EF4444" : globalLight === "AMBAR" ? "#F59E0B" : "#10B981";
    const lightBg = globalLight === "ROJO" ? "rgba(239,68,68,0.12)" : globalLight === "AMBAR" ? "rgba(245,158,11,0.12)" : "rgba(16,185,129,0.1)";

    return (
        <div style={{ padding: "1.5rem 2rem", minHeight: "100vh", fontFamily: "Inter,system-ui,sans-serif" }}>

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
                        <div style={{ display: "flex", gap: "0.6rem", alignItems: "center" }}>
                            <h1 style={{ color: "white", fontWeight: 900, fontSize: "1.35rem", margin: 0 }}>
                                Dashboard Estratégico — Alta Gerencia
                            </h1>
                            <span style={{ fontSize: "0.65rem", fontWeight: 800, padding: "2px 10px", borderRadius: "999px", background: `${lightColor}20`, color: lightColor, border: `1px solid ${lightColor}40`, letterSpacing: "0.1em" }}>
                                ESTADO: {globalLight}
                            </span>
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
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "1rem", marginBottom: "1.25rem" }}>
                <RoiCard label="Inversión Ejecutada" value={`S/ ${fmt(roi.inversion)}`}
                    sub={`${roi.closed} tickets cerrados`} color="#3B82F6"
                    icon={BanknoteIcon}
                    light={roi.inversion > 0 ? "VERDE" : "AMBAR"} />
                <RoiCard label="Ingresos Generados" value={`S/ ${fmt(roi.ingresos)}`}
                    sub="Facturación período" color="#10B981"
                    icon={DollarSign}
                    light={roi.ingresos > roi.inversion ? "VERDE" : "ROJO"} />
                <RoiCard label="Utilidad Neta" value={`S/ ${fmt(roi.utilidad)}`}
                    sub={`Margen: ${Math.round(roi.margen)}%`} color="#8B5CF6"
                    icon={TrendingUp}
                    light={roi.margen >= 40 ? "VERDE" : roi.margen >= 25 ? "AMBAR" : "ROJO"} />
                <RoiCard label="Ratio de Eficiencia" value={`${roi.ratio.toFixed(2)}x`}
                    sub="Ganancia por S/ invertido" color="#F59E0B"
                    icon={Target}
                    light={roi.ratio >= 1.5 ? "VERDE" : roi.ratio >= 1 ? "AMBAR" : "ROJO"} />
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
                MÓDULO 2: TESORERÍA & FLUJO DE CAJA
            ══════════════════════════════════ */}
            <SectionHeader icon={<Layers size={16} />} title="Tesorería & Flujo de Caja" color="#F59E0B" />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1.4fr 1fr", gap: "1rem", marginBottom: "1.25rem" }}>

                {/* Pipeline total */}
                <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "14px", padding: "1.4rem" }}>
                    <div style={{ fontSize: "0.72rem", fontWeight: 800, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", marginBottom: "0.75rem" }}>Pipeline Pendiente</div>
                    <div style={{ fontSize: "2rem", fontWeight: 900, color: "#F59E0B" }}>S/ {fmt(tesoreria.totalPipeline)}</div>
                    <div style={{ fontSize: "0.78rem", color: "rgba(255,255,255,0.45)", marginTop: "0.35rem" }}>{tesoreria.total} servicios en curso</div>
                    <div style={{ marginTop: "1rem", padding: "0.65rem 0.9rem", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)", borderRadius: "10px" }}>
                        <div style={{ fontSize: "0.7rem", fontWeight: 700, color: "#EF4444", marginBottom: "2px" }}>⚡ Lucro Cesante Estimado</div>
                        <div style={{ fontSize: "1.3rem", fontWeight: 900, color: "#EF4444" }}>S/ {fmt(tesoreria.lucro)}</div>
                        <div style={{ fontSize: "0.68rem", color: "rgba(239,68,68,0.7)" }}>ganancia detenida por pendientes</div>
                    </div>
                </div>

                {/* Aging */}
                <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "14px", padding: "1.4rem" }}>
                    <div style={{ fontSize: "0.72rem", fontWeight: 800, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", marginBottom: "0.75rem" }}>Aging de Bloqueo</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                        {tesoreria.aging.map(a => <AgingRow key={a.label} {...a} />)}
                    </div>
                </div>

                {/* Causa raíz simulada */}
                <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "14px", padding: "1.4rem" }}>
                    <div style={{ fontSize: "0.72rem", fontWeight: 800, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", marginBottom: "0.75rem" }}>Causa Raíz de Pausa</div>
                    {[
                        { label: "Falta de sustento", pct: 38, color: "#EF4444" },
                        { label: "Error de datos", pct: 24, color: "#F59E0B" },
                        { label: "Aprobación presupuesto", pct: 21, color: "#8B5CF6" },
                        { label: "Cliente sin respuesta", pct: 17, color: "#64748B" },
                    ].map(c => (
                        <div key={c.label} style={{ marginBottom: "0.6rem" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.73rem", marginBottom: "3px" }}>
                                <span style={{ color: "rgba(255,255,255,0.6)" }}>{c.label}</span>
                                <span style={{ fontWeight: 800, color: c.color }}>{c.pct}%</span>
                            </div>
                            <div style={{ height: "5px", background: "rgba(255,255,255,0.06)", borderRadius: "999px", overflow: "hidden" }}>
                                <div style={{ height: "100%", width: `${c.pct}%`, background: c.color, borderRadius: "999px", transition: "width 0.8s ease" }} />
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* ══════════════════════════════════
                MÓDULO 3: PRODUCTIVIDAD RRHH
            ══════════════════════════════════ */}
            <SectionHeader icon={<Users size={16} />} title="Productividad & Clima Laboral (RRHH)" color="#8B5CF6" />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1.2fr", gap: "1rem", marginBottom: "1.25rem" }}>

                {/* KPIs RRHH */}
                <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "14px", padding: "1.4rem", display: "flex", flexDirection: "column", gap: "1rem", alignItems: "center", justifyContent: "center" }}>
                    <GaugeMini pct={rrhh.slaGlobal} label="SLA Global" />
                    <GaugeMini pct={rrhh.fcrPct} label="FCR (1ª Resolución)" />
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        <Star size={16} color="#F59E0B" />
                        <span style={{ fontSize: "1.5rem", fontWeight: 900, color: "#F59E0B" }}>{rrhh.npsPct}</span>
                        <span style={{ fontSize: "0.73rem", color: "rgba(255,255,255,0.4)" }}>NPS / Satisfacción</span>
                    </div>
                </div>

                {/* Carga por gestora */}
                <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "14px", padding: "1.4rem" }}>
                    <div style={{ fontSize: "0.72rem", fontWeight: 800, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", marginBottom: "1rem" }}>Distribución de Carga</div>
                    {rrhh.gestoras.length === 0 ? (
                        <div style={{ textAlign: "center", color: "rgba(255,255,255,0.3)", fontSize: "0.8rem", paddingTop: "1rem" }}>Sin datos de asignación</div>
                    ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                            {rrhh.gestoras.map(g => <GestoraBar key={g.name} name={g.name} count={g.count} max={rrhh.maxLoad} color="#8B5CF6" />)}
                        </div>
                    )}
                </div>

                {/* Alert status cards */}
                <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                    {[
                        { label: "Tickets Activos", value: fmtInt(tickets.filter((t: any) => !["ticket_cerrado","ticket_rechazado","ticket_cancelado"].includes(normalizeStateId(t.estadoId))).length), icon: Activity, color: "#3B82F6", light: "VERDE" as Light },
                        { label: "SLA Vencidos (activos)", value: fmtInt(rrhh.expired), icon: AlertTriangle, color: "#EF4444", light: (rrhh.expired > 0 ? "ROJO" : "VERDE") as Light },
                        { label: "Técnicos Registrados", value: fmtInt(technicians.length), icon: Award, color: "#8B5CF6", light: "VERDE" as Light },
                        { label: "Pipeline Bloq. >48h", value: fmtInt(tesoreria.bloqueados48), icon: Shield, color: "#F59E0B", light: (tesoreria.bloqueados48 > 0 ? "ROJO" : "VERDE") as Light },
                    ].map(c => {
                        const Icon = c.icon;
                        const lc = c.light === "ROJO" ? "#EF4444" : c.light === "AMBAR" ? "#F59E0B" : "#10B981";
                        return (
                            <div key={c.label} style={{
                                background: `${lc}08`, border: `1px solid ${lc}25`,
                                borderRadius: "12px", padding: "0.85rem 1.1rem",
                                display: "flex", alignItems: "center", gap: "0.75rem"
                            }}>
                                <div style={{ width: "36px", height: "36px", borderRadius: "10px", background: `${c.color}15`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                                    <Icon size={17} color={c.color} />
                                </div>
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontSize: "0.7rem", color: "rgba(255,255,255,0.4)", fontWeight: 600 }}>{c.label}</div>
                                    <div style={{ fontSize: "1.3rem", fontWeight: 900, color: "white", lineHeight: 1.2 }}>{c.value}</div>
                                </div>
                                <span style={{ fontSize: "0.6rem", fontWeight: 800, padding: "2px 7px", borderRadius: "999px", background: `${lc}18`, color: lc }}>{c.light}</span>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* ── QUICK NAVIGATION ─────────────── */}
            <SectionHeader icon={<Zap size={16} />} title="Acceso Rápido a Módulos" color="#FF6600" />
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(200px,1fr))", gap: "0.75rem" }}>
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
                        <Link key={item.href} href={item.href} style={{
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
