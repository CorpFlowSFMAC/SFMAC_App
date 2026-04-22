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
import TicketWindow from "./tickets/TicketWindow";
import { ticketsAPI } from "@/lib/supabase-api";

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
    const { tickets, loadingTickets, technicians, gestoras } = useAppData();
    const [dateRange, setDateRange] = useState<"today" | "week" | "month" | "all">("month");
    const [now] = useState(() => new Date());

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
            const { data, error } = await ticketsAPI.update(id, updates);
            if (error) throw error;
            return data;
        } catch (err) {
            console.error("Error updating ticket from dashboard:", err);
            throw err;
        }
    };

    const isInRange = (d: string) => {
        const diff = (now.getTime() - new Date(d).getTime()) / 86_400_000;
        if (dateRange === "today") return diff < 1;
        if (dateRange === "week") return diff < 7;
        if (dateRange === "month") return diff < 30;
        return true;
    };

    // ── MÓDULO 1: Rentabilidad / ROI (AUDITORÍA STRICT - SIN IGV) ───────────
    const roi = useMemo(() => {
        // REGLA 1: Solo tickets CERRADOS para Rentabilidad
        const closed = tickets.filter((t: any) => {
            const sid = normalizeStateId(t.status_id || t.estadoId);
            return sid === "ticket_cerrado" || sid === "liquidado";
        });

        // REGLA 2: Cálculos 100% SIN IGV (Monto / 1.18)
        const ingresosGenerados = closed.reduce((acc, t) => {
            const bruto = parseFloat(t.total_quoted_amount || t.montoFinal || 0);
            return acc + (bruto / 1.18);
        }, 0);

        const inversionEjecutada = closed.reduce((acc, t) => {
            // REGLA CLARIFICADA: La inversión (pagos a técnicos, materiales, etc.) se toma TAL CUAL se deposita (BRUTO/REAL)
            const mo = parseFloat(t.labor_cost || t.costoManoObra || 0);
            const mat = parseFloat(t.materials_cost || t.costoMateriales || 0);
            const vis = parseFloat(t.visit_cost || t.costoVisita || 0);
            return acc + (mo + mat + vis);
        }, 0);

        const utilidadNeta = round2(ingresosGenerados - inversionEjecutada);
        const margenReal = ingresosGenerados > 0 ? (utilidadNeta / ingresosGenerados) * 100 : 0;
        
        // Ratio de Eficiencia: [Utilidad Neta] / [Inversión Ejecutada]
        const ratioEficiencia = inversionEjecutada > 0 ? (utilidadNeta / inversionEjecutada) : 0;

        // AUDIT LOG (Temporal para validación)
        console.log(`[AUDIT ROI] Tickets Cerrados: ${closed.length}`);
        console.log(`[AUDIT ROI] Ingresos (Neto): S/ ${ingresosGenerados.toFixed(2)}`);
        console.log(`[AUDIT ROI] Inversión (Neto): S/ ${inversionEjecutada.toFixed(2)}`);
        console.log(`[AUDIT ROI] Utilidad: S/ ${utilidadNeta.toFixed(2)} (Diff: ${(ingresosGenerados - inversionEjecutada - utilidadNeta).toFixed(4)})`);

        // Por servicio (Basado en Neto sin IGV)
        const byService = SERVICE_TYPES.map(s => {
            const st = closed.filter((t: any) => t.service_type === s.id || t.tipoServicio === s.id);
            const ingNeto = st.reduce((acc, t) => acc + (parseFloat(t.total_quoted_amount || t.montoFinal || 0) / 1.18), 0);
            const costReal = st.reduce((acc, t) => {
                const mo = parseFloat(t.labor_cost || t.costoManoObra || 0);
                const mat = parseFloat(t.materials_cost || t.costoMateriales || 0);
                const vis = parseFloat(t.visit_cost || t.costoVisita || 0);
                return acc + (mo + mat + vis);
            }, 0);
            const m = ingNeto > 0 ? ((ingNeto - costReal) / ingNeto) * 100 : 0;
            return { ...s, tickets: st.length, ingresos: ingNeto, margen: m };
        }).filter(s => s.tickets > 0).sort((a, b) => b.ingresos - a.ingresos);

        return { 
            inversion: round2(inversionEjecutada), 
            ingresos: round2(ingresosGenerados), 
            utilidad: utilidadNeta, 
            margen: margenReal, 
            ratio: ratioEficiencia, 
            closed: closed.length, 
            total: tickets.length, 
            byService,
            inversionItems: closed.map(t => ({
                ...t,
                _investmentTotalReal: (parseFloat(t.labor_cost || t.costoManoObra || 0) + 
                                       parseFloat(t.materials_cost || t.costoMateriales || 0) + 
                                       parseFloat(t.visit_cost || t.costoVisita || 0))
            })).sort((a,b) => b._investmentTotalReal - a._investmentTotalReal),
            ingresosItems: closed.sort((a,b) => new Date(b.closure_date || b.updated_at).getTime() - new Date(a.closure_date || a.updated_at).getTime())
        };
    }, [tickets]);

    // ── MÓDULO 2: Tesorería / Pendientes (AUDITORÍA STRICT - SIN IGV) ───────
    const tesoreria = useMemo(() => {
        // Pipeline: Cotizaciones en curso (SUBTOTAL)
        const pipelineStates = ["en_cotizacion", "cotizacion_enviada", "borrador", "nuevo", "pendiente", "visitado"];
        const pipelineTickets = tickets.filter((t: any) => pipelineStates.includes(normalizeStateId(t.status_id || t.estadoId)));
        const totalPipelineNeto = pipelineTickets.reduce((s, t) => s + ((parseFloat(t.total_quoted_amount || t.montoFinal || 0)) / 1.18), 0);

        // Presupuestos Aprobados: En ejecución o por liquidar (SUBTOTAL)
        const approvedStates = ["cotizacion_aprobada", "en_ejecucion", "documentacion_enviada", "por_liquidar", "requiere_revision_admin"];
        const approvedTickets = tickets.filter((t: any) => approvedStates.includes(normalizeStateId(t.status_id || t.estadoId)));
        const totalAprobadosNeto = approvedTickets.reduce((s, t) => s + ((parseFloat(t.total_quoted_amount || t.montoFinal || 0)) / 1.18), 0);

        // Lucro Cesante: Utilidad PROYECTADA de tickets aprobados (Ingreso Neto - Gasto Real)
        const lucroReal = approvedTickets.reduce((s, t) => {
            const ingNeto = parseFloat(t.total_quoted_amount || t.montoFinal || 0) / 1.18;
            const costReal = (parseFloat(t.labor_cost || t.costoManoObra || 0) + 
                               parseFloat(t.materials_cost || t.costoMateriales || 0) + 
                               parseFloat(t.visit_cost || t.costoVisita || 0));
            
            return s + (ingNeto - costReal);
        }, 0);

        // Aging
        const todosPendientes = [...pipelineTickets, ...approvedTickets];
        const aging = {
            "0-24h": todosPendientes.filter((t: any) => hoursAgo(t.updated_at || t.createdAt || t.created_at || "") < 24),
            "24-48h": todosPendientes.filter((t: any) => { const h = hoursAgo(t.updated_at || t.createdAt || t.created_at || ""); return h >= 24 && h < 48; }),
            "+48h": todosPendientes.filter((t: any) => hoursAgo(t.updated_at || t.createdAt || t.created_at || "") >= 48),
        };

        const calcAmountNeto = (arr: any[]) => round2(arr.reduce((s: number, t: any) => s + (parseFloat(t.total_quoted_amount || t.montoFinal || 0) / 1.18), 0));

        return {
            tickets: todosPendientes,
            pipelineTickets,
            approvedTickets,
            total: todosPendientes.length,
            totalPipeline: round2(totalPipelineNeto),
            totalAprobados: round2(totalAprobadosNeto),
            lucro: round2(lucroReal),
            aging: [
                { label: "0 – 24 horas", count: aging["0-24h"].length, amount: calcAmountNeto(aging["0-24h"]), color: "#10B981" },
                { label: "24 – 48 horas", count: aging["24-48h"].length, amount: calcAmountNeto(aging["24-48h"]), color: "#F59E0B" },
                { label: "+ 48 horas (alerta)", count: aging["+48h"].length, amount: calcAmountNeto(aging["+48h"]), color: "#EF4444" },
            ],
            bloqueados48: aging["+48h"].length,
            bottlenecks: [
                { label: "Esperando Cotización", count: pipelineTickets.filter(t => ["nuevo", "asignado_a_tecnico", "en_inspeccion", "borrador"].includes(normalizeStateId(t.status_id || t.estadoId))).length, color: "#8B5CF6" },
                { label: "Esperando Aprobación", count: pipelineTickets.filter(t => ["cotizacion_enviada"].includes(normalizeStateId(t.status_id || t.estadoId))).length, color: "#3B82F6" },
                { label: "Esperando Adelanto", count: approvedTickets.filter(t => ["cotizacion_aprobada"].includes(normalizeStateId(t.status_id || t.estadoId)) && !(t.metadata?.historialPagosTecnico?.length)).length, color: "#F59E0B" },
                { label: "En Ejecución", count: approvedTickets.filter(t => normalizeStateId(t.status_id || t.estadoId) === "en_ejecucion").length, color: "#10B981" },
                { label: "Pendiente Liquidar", count: approvedTickets.filter(t => ["por_liquidar", "documentacion_enviada", "liquidado", "requiere_revision_admin"].includes(normalizeStateId(t.status_id || t.estadoId))).length, color: "#64748B" },
            ].filter(b => b.count > 0).sort((a,b) => b.count - a.count)
        };
    }, [tickets]);

    // ── CAPITAL EXPUESTO / ADELANTADO (Pagos a Técnicos en tickets activos) ────────
    // Estados activos previos a ejecución/cierre donde aún hay capital en riesgo
    const ESTADOS_RIESGO_CAPITAL = ["en_cotizacion", "cotizacion_enviada", "cotizacion_aprobada", "por_liquidar", "nuevo", "asignado_a_tecnico", "en_inspeccion", "visitado"];

    const capitalExpuesto = useMemo(() => {
        const ticketsConAdelantos = tickets
            .filter((t: any) => {
                const sid = normalizeStateId(t.estadoId);
                // Exluir cerrados/rechazados/cancelados
                const isActive = !["ticket_cerrado", "ticket_rechazado", "ticket_cancelado"].includes(sid);
                // Debe tener al menos un pago registrado
                const pagos = t.metadata?.historialPagosTecnico || [];
                const totalPagado = pagos.reduce((s: number, p: any) => s + (parseFloat(p.monto) || 0), 0);
                return isActive && totalPagado > 0;
            })
            .map((t: any) => {
                const pagos = t.metadata?.historialPagosTecnico || [];
                const totalAdelantado = pagos.reduce((s: number, p: any) => s + (parseFloat(p.monto) || 0), 0);

                // Resolver nombre de gestora
                const gestoraId = t.gestora_id || t.metadata?.gestora_id;
                const gestoraObj = gestoras.find((g: any) => g.id === gestoraId);
                const gestoraName = gestoraObj
                    ? (gestoraObj.name || gestoraObj.nombre || gestoraObj.full_name || "Gestora")
                    : (t.gestora?.nombre || t.gestora?.name || "Sin asignar");

                // Resolver especialista (primer pago con nombre, o metadata)
                const especialista = pagos[0]?.tecnico || t.metadata?.tecnicoAsignado?.name || t.metadata?.tecnico_nombre || "Sin especialista";

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
                    _pagos: pagos,
                };
            })
            .sort((a: any, b: any) => b._totalAdelantado - a._totalAdelantado);

        const totalCapital = round2(ticketsConAdelantos.reduce((s: number, t: any) => s + t._totalAdelantado, 0));
        const enRiesgo = ticketsConAdelantos.filter((t: any) => t._isRiesgo);
        const totalEnRiesgo = round2(enRiesgo.reduce((s: number, t: any) => s + t._totalAdelantado, 0));

        return { tickets: ticketsConAdelantos, total: totalCapital, enRiesgo: enRiesgo.length, totalEnRiesgo };
    }, [tickets, gestoras]);

    // ── MÓDULO 3: RRHH / Productividad — Alineado con Módulo de Tickets ────────
    const NUEVOS_STATES_RRHH = ["nuevo", "pendiente", "asignado_a_tecnico", "borrador"];
    const EN_PROCESO_STATES_RRHH = ["en_inspeccion", "en_cotizacion", "cotizacion_enviada", "cotizacion_aprobada", "en_ejecucion", "documentacion_enviada", "por_liquidar", "liquidado", "visitado"];

    const rrhh = useMemo(() => {
        const active = tickets.filter((t: any) =>
            !["ticket_cerrado", "ticket_rechazado", "ticket_cancelado"].includes(normalizeStateId(t.estadoId))
        );

        const closed = tickets.filter((t: any) => normalizeStateId(t.estadoId) === "ticket_cerrado");
        const total = tickets.length || 1;

        // SLA global
        const expired = active.filter((t: any) => hoursAgo(t.createdAt || t.created_at || "") >= SLA_HOURS);
        const slaGlobal = ((total - expired.length) / total) * 100;

        // FCR (tickets cerrados sin re-apertura — simulado)
        const fcrPct = closed.length > 0 ? Math.min(92, 70 + closed.length * 2) : 0;
        const npsPct = 78;

        // Distribución por gestora REAL (matching por gestora_id)
        const gestorasData = gestoras.map((g: any) => {
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
            return !tGestoraId || !gestoras.find((g: any) => g.id === tGestoraId);
        });
        if (sinGestora.length > 0) {
            gestorasData.push({ id: 'sin_asignar', nombre: 'Sin Gestora', count: sinGestora.length, nuevos: sinGestora.length, enProceso: 0, vencidos: 0, tickets: sinGestora });
        }

        const maxLoad = Math.max(...gestorasData.map((g: any) => g.count), 1);

        return { slaGlobal, fcrPct, npsPct, gestoras: gestorasData, maxLoad, expired: expired.length };
    }, [tickets, gestoras]);

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
                    sub={`${roi.closed} tickets cerrados (Monto Real)`} color="#3B82F6"
                    icon={BanknoteIcon}
                    light={roi.inversion > 0 ? "VERDE" : "AMBAR"}
                    onClick={() => {
                        setModalTitle("Análisis de Costos: Inversión Ejecutada (REAL)");
                        setModalTickets(roi.inversionItems.map(t => ({ ...t, _viewMode: 'inversion' })));
                        setShowListModal(true);
                    }}
                />
                <RoiCard label="Ingresos Generados" value={`S/ ${fmt(roi.ingresos)}`}
                    sub={`${roi.closed} tickets cerrados (Neto)`} color="#10B981"
                    icon={DollarSign}
                    light={roi.ingresos > roi.inversion ? "VERDE" : "ROJO"}
                    onClick={() => {
                        setModalTitle("Análisis de Ingresos: Ventas Liquidadas (NETO)");
                        setModalTickets(roi.ingresosItems.map(t => ({ ...t, _viewMode: 'ingresos' })));
                        setShowListModal(true);
                    }}
                />
                <RoiCard label="Utilidad Neta" value={`S/ ${fmt(roi.utilidad)}`}
                    sub={`Margen Real: ${Math.round(roi.margen)}%`} color="#8B5CF6"
                    icon={TrendingUp}
                    light={roi.margen >= 35 ? "VERDE" : roi.margen >= 20 ? "AMBAR" : "ROJO"}
                    onClick={() => {
                        setModalTitle("Análisis de Utilidad Neta (Profitability)");
                        setModalTickets(roi.ingresosItems.map(t => {
                            const bruto = parseFloat(t.total_quoted_amount || t.montoFinal || 0);
                            const ingNeto = bruto / 1.18;
                            const costReal = (parseFloat(t.labor_cost || t.costoManoObra || 0) + 
                                              parseFloat(t.materials_cost || t.costoMateriales || 0) + 
                                              parseFloat(t.visit_cost || t.costoVisita || 0));
                            return { ...t, _viewMode: 'utilidad', _utilityAmount: ingNeto - costReal };
                        }));
                        setShowListModal(true);
                    }}
                />
                <RoiCard label="Ratio de Eficiencia" value={`${roi.ratio.toFixed(2)}x`}
                    sub="Ganancia por S/ invertido" color="#F59E0B"
                    icon={Target}
                    light={roi.ratio >= 1.5 ? "VERDE" : roi.ratio >= 1 ? "AMBAR" : "ROJO"}
                    onClick={() => {
                        setModalTitle("Eficiencia Operativa / ROI");
                        setModalTickets(roi.ingresosItems.map(t => ({ ...t, _viewMode: 'ratio' })));
                        setShowListModal(true);
                    }}
                />
            </div>

            {/* ROI por servicio */}
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

                {/* Col 1: Gestión de Ingresos y Pipeline */}
                <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "14px", padding: "1.4rem" }}>
                    
                    {/* Presupuestos Aprobados — CLICKABLE */}
                    <div 
                        onClick={() => {
                            setModalTitle("Presupuestos Aprobados (Trabajos en curso)");
                            setModalTickets(tesoreria.approvedTickets);
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
                            setModalTickets(tesoreria.pipelineTickets);
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

                    <div style={{ padding: "0.65rem 0.9rem", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)", borderRadius: "10px", marginBottom: "0.85rem" }}>
                        <div style={{ fontSize: "0.7rem", fontWeight: 700, color: "#EF4444", marginBottom: "2px" }}>⚡ Lucro Cesante Estimado</div>
                        <div style={{ fontSize: "1.4rem", fontWeight: 900, color: "#EF4444" }}>S/ {fmt(tesoreria.lucro)}</div>
                        <div style={{ fontSize: "0.68rem", color: "rgba(239,68,68,0.7)" }}>ganancia detenida por pendientes</div>
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
                        {tesoreria.aging.map(a => <AgingRow key={a.label} {...a} />)}
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
                                <div key={c.label} style={{ marginBottom: "0.6rem" }}>
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

                {/* Carga por gestora — NUEVA VERSIÓN CON DATOS REALES */}
                <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "14px", padding: "1.4rem" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
                        <div style={{ fontSize: "0.72rem", fontWeight: 800, color: "rgba(255,255,255,0.4)", textTransform: "uppercase" }}>Distribución de Carga</div>
                        <div style={{ fontSize: "0.65rem", color: "rgba(255,255,255,0.25)", fontWeight: 600 }}>CLICK para ver tickets</div>
                    </div>
                    {rrhh.gestoras.length === 0 ? (
                        <div style={{ textAlign: "center", color: "rgba(255,255,255,0.3)", fontSize: "0.8rem", paddingTop: "1rem" }}>Sin datos de asignación</div>
                    ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
                            {rrhh.gestoras.map((g: any) => {
                                const pct = rrhh.maxLoad > 0 ? (g.count / rrhh.maxLoad) * 100 : 0;
                                const stress = g.count > 8 ? "#EF4444" : g.count > 5 ? "#F59E0B" : "#10B981";
                                const initials = (g.nombre || "?").substring(0, 2).toUpperCase();
                                return (
                                    <div
                                        key={g.id}
                                        onClick={() => { setModalTitle(`Tickets de ${g.nombre}`); setModalTickets(g.tickets || []); setShowListModal(true); }}
                                        style={{
                                            padding: "0.75rem 0.9rem", borderRadius: "12px",
                                            background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)",
                                            cursor: "pointer", transition: "all 0.2s"
                                        }}
                                        onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.07)"; e.currentTarget.style.borderColor = `${stress}40`; }}
                                        onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.03)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)"; }}
                                    >
                                        {/* Row 1: Avatar + Nombre + Total */}
                                        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginBottom: "0.5rem" }}>
                                            <div style={{
                                                width: "32px", height: "32px", borderRadius: "50%", flexShrink: 0,
                                                background: g.id === 'sin_asignar' ? "rgba(255,255,255,0.1)" : "linear-gradient(135deg,#8B5CF6,#6366F1)",
                                                display: "flex", alignItems: "center", justifyContent: "center",
                                                fontSize: "0.72rem", fontWeight: 900, color: "white"
                                            }}>{initials}</div>
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div style={{ fontSize: "0.82rem", fontWeight: 700, color: "rgba(255,255,255,0.9)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{g.nombre}</div>
                                                <div style={{ fontSize: "0.65rem", color: "rgba(255,255,255,0.35)" }}>
                                                    {g.nuevos} nuevo{g.nuevos !== 1 ? "s" : ""} · {g.enProceso} en proceso{g.vencidos > 0 ? ` · ⚠️ ${g.vencidos} vencido${g.vencidos !== 1 ? "s" : ""}` : ""}
                                                </div>
                                            </div>
                                            <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                                                <span style={{ fontSize: "1.1rem", fontWeight: 900, color: stress, lineHeight: 1 }}>{g.count}</span>
                                                <span style={{ fontSize: "0.62rem", color: "rgba(255,255,255,0.3)", fontWeight: 600 }}>tickets</span>
                                            </div>
                                        </div>
                                        {/* Row 2: Barra de progreso */}
                                        <div style={{ height: "5px", background: "rgba(255,255,255,0.06)", borderRadius: "999px", overflow: "hidden" }}>
                                            <div style={{ height: "100%", width: `${pct}%`, background: stress, borderRadius: "999px", transition: "width 0.8s ease" }} />
                                        </div>
                                        {/* Row 3: Badges */}
                                        {g.vencidos > 0 && (
                                            <div style={{ marginTop: "0.4rem", display: "flex", gap: "4px" }}>
                                                <span style={{ fontSize: "0.6rem", fontWeight: 800, padding: "1px 6px", borderRadius: "4px", background: "rgba(239,68,68,0.15)", color: "#EF4444", border: "1px solid rgba(239,68,68,0.3)" }}>
                                                    {g.vencidos} SLA VENCIDO{g.vencidos > 1 ? "S" : ""}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Alert status cards */}
                <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                    {[
                        { 
                            label: "Tickets Activos", 
                            value: fmtInt(tickets.filter((t: any) => !["ticket_cerrado","ticket_rechazado","ticket_cancelado"].includes(normalizeStateId(t.estadoId))).length), 
                            icon: Activity, 
                            color: "#3B82F6", 
                            light: "VERDE" as Light,
                            tickets: tickets.filter((t: any) => !["ticket_cerrado","ticket_rechazado","ticket_cancelado"].includes(normalizeStateId(t.estadoId)))
                        },
                        { 
                            label: "SLA Vencidos (activos)", 
                            value: fmtInt(rrhh.expired), 
                            icon: AlertTriangle, 
                            color: "#EF4444", 
                            light: (rrhh.expired > 0 ? "ROJO" : "VERDE") as Light,
                            tickets: tickets.filter((t: any) => {
                                const active = !["ticket_cerrado", "ticket_rechazado", "ticket_cancelado"].includes(normalizeStateId(t.estadoId));
                                return active && hoursAgo(t.createdAt || t.created_at || "") >= SLA_HOURS;
                            })
                        },
                        { label: "Técnicos Registrados", value: fmtInt(technicians.length), icon: Award, color: "#8B5CF6", light: "VERDE" as Light },
                        { 
                            label: "Pipeline Bloq. >48h", 
                            value: fmtInt(tesoreria.bloqueados48), 
                            icon: Shield, 
                            color: "#F59E0B", 
                            light: (tesoreria.bloqueados48 > 0 ? "ROJO" : "VERDE") as Light,
                            tickets: tickets.filter((t: any) => {
                                const sid = normalizeStateId(t.estadoId);
                                const isPending = ["en_cotizacion", "cotizacion_enviada", "cotizacion_aprobada", "por_liquidar"].includes(sid);
                                return isPending && hoursAgo(t.createdAt || t.created_at || "") >= 48;
                            })
                        },
                    ].map(c => {
                        const Icon = c.icon;
                        const lc = c.light === "ROJO" ? "#EF4444" : c.light === "AMBAR" ? "#F59E0B" : "#10B981";
                        const isClickable = !!c.tickets;

                        return (
                            <div 
                                key={c.label} 
                                onClick={() => {
                                    if (isClickable) {
                                        setModalTitle(c.label);
                                        setModalTickets(c.tickets || []);
                                        setShowListModal(true);
                                    }
                                }}
                                style={{
                                    background: `${lc}08`, border: `1px solid ${lc}25`,
                                    borderRadius: "12px", padding: "0.85rem 1.1rem",
                                    display: "flex", alignItems: "center", gap: "0.75rem",
                                    cursor: isClickable ? "pointer" : "default",
                                    transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
                                    position: "relative"
                                }}
                                onMouseEnter={e => {
                                    if (isClickable) {
                                        e.currentTarget.style.background = `${lc}18`;
                                        e.currentTarget.style.transform = "translateX(5px)";
                                        e.currentTarget.style.borderColor = `${lc}60`;
                                    }
                                }}
                                onMouseLeave={e => {
                                    if (isClickable) {
                                        e.currentTarget.style.background = `${lc}08`;
                                        e.currentTarget.style.transform = "translateX(0)";
                                        e.currentTarget.style.borderColor = `${lc}25`;
                                    }
                                }}
                            >
                                <div style={{ width: "36px", height: "36px", borderRadius: "10px", background: `${c.color}15`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                                    <Icon size={17} color={c.color} />
                                </div>
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontSize: "0.7rem", color: "rgba(255,255,255,0.4)", fontWeight: 600 }}>{c.label}</div>
                                    <div style={{ fontSize: "1.3rem", fontWeight: 900, color: "white", lineHeight: 1.2 }}>{c.value}</div>
                                </div>
                                <span style={{ fontSize: "0.6rem", fontWeight: 800, padding: "2px 7px", borderRadius: "999px", background: `${lc}18`, color: lc }}>{c.light}</span>
                                {isClickable && <ChevronRight size={14} color="rgba(255,255,255,0.2)" style={{ marginLeft: "5px" }} />}
                            </div>
                        );
                    })}
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
                                        SUMA TOTAL (NETO): S/ {fmt(modalTickets.reduce((acc, t) => acc + (t._investmentTotalNet || t._utilityAmount || (parseFloat(t.total_quoted_amount || t.montoFinal || 0) / 1.18)), 0))}
                                    </p>
                                </div>
                            </div>
                            <button onClick={() => setShowListModal(false)} style={{ background: 'rgba(255,255,255,0.05)', border: 'none', color: 'white', width: '32px', height: '32px', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <ArrowRight size={18} style={{ transform: 'rotate(45deg)' }} />
                            </button>
                        </div>

                        <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem 2rem' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr style={{ textAlign: 'left', borderBottom: '2px solid rgba(255,255,255,0.05)' }}>
                                        <th style={{ padding: '12px 10px', fontSize: '0.75rem', fontWeight: 800, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase' }}>Ticket #</th>
                                        <th style={{ padding: '12px 10px', fontSize: '0.75rem', fontWeight: 800, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase' }}>Cliente / Sede</th>
                                        <th style={{ padding: '12px 10px', fontSize: '0.75rem', fontWeight: 800, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase' }}>Estado</th>
                                        <th style={{ padding: '12px 10px', fontSize: '0.75rem', fontWeight: 800, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase' }}>Presupuesto</th>
                                        <th style={{ padding: '12px 10px', fontSize: '0.75rem', fontWeight: 800, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase' }}>Aging</th>
                                        <th style={{ padding: '12px 2px', textAlign: 'center' }}></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {modalTickets.map((t: any, idx: number) => {
                                        const h = hoursAgo(t.createdAt || t.created_at || "");
                                        const agingCol = h >= 72 ? "#EF4444" : h >= 48 ? "#F59E0B" : "#10B981";
                                        
                                        // Configuración de visualización según modo
                                        const isPayment = !!t._paymentMonto;
                                        const isUtility = t._viewMode === 'utilidad';
                                        
                                        // Amount primario
                                        const primaryAmount = t._viewMode === 'utilidad' ? (t._utilityAmount || 0) : (t._paymentMonto || t.montoFinal || 0);
                                        const amountLabel = isUtility ? 'UTILIDAD NETO' : isPayment ? 'MONTO PAGADO' : 'TOTAL FACTURADO';
                                        const amountColor = isUtility ? '#8B5CF6' : isPayment ? '#F59E0B' : '#22C55E';

                                        return (
                                            <tr 
                                                key={t.id + idx} 
                                                onClick={() => setSelectedTicket(t)}
                                                style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', transition: 'background 0.2s', cursor: 'pointer' }}
                                                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}
                                                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                            >

                                                <td style={{ padding: '14px 10px' }}>
                                                    <div style={{ color: 'white', fontWeight: 800, fontSize: '0.85rem', fontFamily: 'monospace' }}>
                                                        {t.numeroTicketCliente || t.id.substring(0,8).toUpperCase()}
                                                    </div>
                                                    <div style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.75)', fontWeight: 600 }}>
                                                        {`F. Audit: ${new Date(t.closure_date || t.updated_at || t.createdAt || t.created_at).toLocaleDateString()}`}
                                                    </div>
                                                </td>
                                                <td style={{ padding: '14px 10px' }}>
                                                    <div style={{ color: 'rgba(255,255,255,0.9)', fontWeight: 700, fontSize: '0.82rem' }}>
                                                        {t.cliente?.nombre || t.client?.name || "Cliente SINFIMAC"}
                                                    </div>
                                                    <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.7)', fontWeight: 700 }}>
                                                        {(t.sede?.nombre || t.sede_reportada_cliente || "Sede por definir")}
                                                    </div>
                                                </td>
                                                <td style={{ padding: '14px 10px' }}>
                                                    <span style={{ 
                                                        padding: '4px 8px', borderRadius: '6px', fontSize: '0.65rem', fontWeight: 800, 
                                                        background: `${amountColor}15`, 
                                                        color: amountColor, 
                                                        border: `1px solid ${amountColor}30`
                                                    }}>
                                                        {isPayment ? (t._paymentType || 'PAGO').toUpperCase() : (t.estadoId?.replace(/_/g, ' ').toUpperCase() || "NUEVO")}
                                                    </span>
                                                </td>
                                                <td style={{ padding: '14px 10px' }}>
                                                    <div style={{ color: amountColor, fontWeight: 900, fontSize: '0.9rem' }}>
                                                        S/ {fmt(t._viewMode === 'utilidad' ? (t._utilityAmount || 0) : t._viewMode === 'inversion' ? (t._investmentTotalReal || 0) : (parseFloat(t.total_quoted_amount || t.montoFinal || 0) / 1.18))}
                                                    </div>
                                                    <div style={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.65)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.02em' }}>
                                                        {t._viewMode === 'utilidad' ? 'Utilidad Neta' : t._viewMode === 'inversion' ? 'Monto Real (Salida)' : 'Ingreso Neto'}
                                                    </div>
                                                    {t._viewMode === 'utilidad' && (
                                                        <div style={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.55)', fontWeight: 700 }}>
                                                            {`(Sin IGV)`}
                                                        </div>
                                                    )}
                                                </td>
                                                <td style={{ padding: '14px 10px' }}>
                                                    <div style={{ color: agingCol, fontWeight: 900, fontSize: '0.85rem' }}>{Math.floor(h)}h</div>
                                                    <div style={{ width: '40px', height: '4px', background: 'rgba(255,255,255,0.05)', borderRadius: '2px', marginTop: '4px' }}>
                                                        <div style={{ width: `${Math.min(h/72*100, 100)}%`, height: '100%', background: agingCol, borderRadius: '2px' }} />
                                                    </div>
                                                </td>
                                                <td style={{ padding: '14px 2px' }}>
                                                    <Link 
                                                        href={`/dashboard/admin/tickets?ticketId=${t.id}`}
                                                        style={{ 
                                                            display: 'flex', alignItems: 'center', justifyContent: 'center', width: '28px', height: '28px', 
                                                            borderRadius: '8px', background: 'rgba(255,255,255,0.05)', color: 'white', transition: 'all 0.2s'
                                                        }}
                                                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.12)'}
                                                        onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                                                    >
                                                        <ChevronRight size={14} />
                                                    </Link>
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
                                                            {t.numeroTicketCliente || t.id.substring(0, 8).toUpperCase()}
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
                                                        <Link href={`/dashboard/admin/tickets?ticketId=${t.id}`} onClick={() => setShowCapitalModal(false)}
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
