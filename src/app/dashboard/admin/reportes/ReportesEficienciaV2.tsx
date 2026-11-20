"use client";

/**
 * ReportesEficienciaV2 — Módulo de Eficiencia Rediseñado (Datos 100% Reales)
 *
 * FUENTES DE DATOS:
 *   Ingreso Neto  → metadata.ingresos_reales || metadata.montoSubtotal || total_quoted_amount / 1.18
 *   Inversión Real → SUM(ticket_costs.monto) WHERE estado_pago = 'pagado'
 *   Gestoras      → tabla `gestoras`
 *   Periodo       → tickets.closure_date (YYYY-MM)
 *
 * BUGS CORREGIDOS VS V1:
 *   ✅ S/ 0 en Inversión → ahora se consulta ticket_costs directamente, no calculateTicketFinances(t, [])
 *   ✅ SLA -33%          → nueva fórmula: (cerrados en SLA / total cerrados) * 100, clamp 0-100
 *   ✅ Tiempo Promedio 0h → se filtran tickets con delta < 0.5h (cierres manuales retroactivos)
 */

import React, { useState, useMemo, useCallback } from "react";
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer, BarChart, Cell, AreaChart, Area,
} from "recharts";
import {
  TrendingUp, TrendingDown, Users, DollarSign, Activity,
  BarChart3, RefreshCcw, ChevronUp, ChevronDown,
  Layers, ArrowUpRight, ArrowDownRight,
} from "lucide-react";
import { useEficienciaData, GestoraSummary, GestoraMes } from "./useEficienciaData";

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

const fmtMoney = (n: number) =>
  `S/ ${Math.round(n).toLocaleString("es-PE")}`;

const fmtPct = (n: number) =>
  `${Math.round(n * 10) / 10}%`;

function colorMargen(pct: number): string {
  if (pct >= 55) return "#10B981";   // verde
  if (pct >= 35) return "#F59E0B";   // ámbar
  return "#EF4444";                   // rojo
}

function bgMargen(pct: number): string {
  if (pct >= 55) return "rgba(16,185,129,0.1)";
  if (pct >= 35) return "rgba(245,158,11,0.1)";
  return "rgba(239,68,68,0.1)";
}

// Últimos N meses desde hoy
function lastNMonths(n: number): string[] {
  const result: string[] = [];
  const d = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const date = new Date(d.getFullYear(), d.getMonth() - i, 1);
    result.push(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`);
  }
  return result;
}

const MONTH_LABEL: Record<string, string> = {
  "01": "Ene", "02": "Feb", "03": "Mar", "04": "Abr",
  "05": "May", "06": "Jun", "07": "Jul", "08": "Ago",
  "09": "Set", "10": "Oct", "11": "Nov", "12": "Dic",
};
const shortMonth = (key: string) => MONTH_LABEL[key.split("-")[1]] || key;

// ─────────────────────────────────────────────────────────────────────────────
// SUBCOMPONENTES VISUALES
// ─────────────────────────────────────────────────────────────────────────────

interface KpiCardProps {
  label: string;
  value: string;
  sub?: string;
  icon: React.ReactNode;
  trend?: number; // % cambio vs mes anterior, opcional
  accentColor: string;
}

const KpiCard = ({ label, value, sub, icon, trend, accentColor }: KpiCardProps) => (
  <div style={{
    background: "#fff",
    borderRadius: "1rem",
    border: "1px solid #E2E8F0",
    boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
    padding: "1.25rem 1.5rem",
    display: "flex",
    flexDirection: "column",
    gap: "0.5rem",
    flex: "1 1 200px",
    minWidth: 0,
  }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
      <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.05em" }}>
        {label}
      </span>
      <span style={{
        background: `${accentColor}20`,
        color: accentColor,
        borderRadius: "0.5rem",
        padding: "0.25rem",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        {icon}
      </span>
    </div>
    <div style={{ fontSize: "1.5rem", fontWeight: 800, color: "#0F172A", lineHeight: 1 }}>{value}</div>
    {sub && <div style={{ fontSize: "0.78rem", color: "#64748B" }}>{sub}</div>}
    {trend !== undefined && (
      <div style={{ display: "flex", alignItems: "center", gap: "0.25rem", fontSize: "0.78rem",
        color: trend >= 0 ? "#10B981" : "#EF4444", fontWeight: 600 }}>
        {trend >= 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
        {Math.abs(Math.round(trend * 10) / 10)}% vs mes anterior
      </div>
    )}
  </div>
);

// Tooltip personalizado para gráfica financiera
const FinancialTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  const data = payload[0]?.payload;
  return (
    <div style={{
      background: "#1E293B", borderRadius: "0.75rem", padding: "0.875rem 1rem",
      boxShadow: "0 20px 40px rgba(0,0,0,0.3)", color: "#F8FAFC",
      fontSize: "0.82rem", minWidth: "200px",
    }}>
      <div style={{ fontWeight: 700, marginBottom: "0.5rem", color: "#94A3B8" }}>{label}</div>
      {data && <>
        <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", marginBottom: "0.25rem" }}>
          <span>Tickets cerrados:</span>
          <span style={{ fontWeight: 700, color: "#818CF8" }}>{data.ticketsCerrados}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", marginBottom: "0.25rem" }}>
          <span>Ingreso Neto:</span>
          <span style={{ fontWeight: 700, color: "#6366F1" }}>{fmtMoney(data.ingresoNeto)}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", marginBottom: "0.25rem" }}>
          <span>Inversión Real:</span>
          <span style={{ fontWeight: 700, color: "#10B981" }}>{fmtMoney(data.inversion)}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", borderTop: "1px solid #334155", paddingTop: "0.4rem", marginTop: "0.4rem" }}>
          <span>Utilidad Neta:</span>
          <span style={{ fontWeight: 800, color: data.utilidadNeta >= 0 ? "#34D399" : "#F87171" }}>{fmtMoney(data.utilidadNeta)}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem" }}>
          <span>Margen:</span>
          <span style={{ fontWeight: 800, color: colorMargen(data.margenPct) }}>{fmtPct(data.margenPct)}</span>
        </div>
      </>}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENTE PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────

type RangoType = "6m" | "12m" | "año" | "mes";
type SortKey = "totalIngreso" | "totalInversion" | "totalUtilidad" | "margenPct" | "totalTickets";

export default function ReportesEficienciaV2() {
  const { data, isLoading, isError, refetch } = useEficienciaData();

  const [selectedGestoraId, setSelectedGestoraId] = useState<string>("global");
  const [rango, setRango] = useState<RangoType>("6m");
  const [selectedMes, setSelectedMes] = useState<string>("");
  const [sortKey, setSortKey] = useState<SortKey>("totalUtilidad");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  // ── Meses en rango seleccionado ──────────────────────────────────────────
  const mesesEnRango = useMemo((): string[] => {
    if (!data) return [];
    if (rango === "mes" && selectedMes) return [selectedMes];
    if (rango === "6m") return lastNMonths(6);
    if (rango === "12m") return lastNMonths(12);
    if (rango === "año") {
      const year = new Date().getFullYear();
      return Array.from({ length: 12 }, (_, i) =>
        `${year}-${String(i + 1).padStart(2, "0")}`
      );
    }
    return data.mesesDisponibles;
  }, [rango, selectedMes, data]);

  // ── Gestora seleccionada (o null = global) ───────────────────────────────
  const gestoraSeleccionada: GestoraSummary | null = useMemo(() => {
    if (!data || selectedGestoraId === "global") return null;
    return data.gestoras.find((g) => g.gestoraId === selectedGestoraId) || null;
  }, [data, selectedGestoraId]);

  // ── Meses para gráficas históricas (filtrados al rango) ─────────────────
  const historialMeses: GestoraMes[] = useMemo(() => {
    if (!data) return [];
    const gestoras = gestoraSeleccionada ? [gestoraSeleccionada] : data.gestoras;

    // Agrupar por mes sumando todas las gestoras (si global) o solo la seleccionada
    const mesMap: Record<string, GestoraMes> = {};
    gestoras.forEach((g) => {
      g.meses.forEach((m) => {
        if (!mesesEnRango.includes(m.mesKey)) return;
        if (!mesMap[m.mesKey]) {
          mesMap[m.mesKey] = { ...m, gestoraId: "global", gestoraName: "Global" };
        } else {
          const existing = mesMap[m.mesKey];
          existing.ticketsCerrados += m.ticketsCerrados;
          existing.ingresoNeto += m.ingresoNeto;
          existing.inversion += m.inversion;
          existing.utilidadNeta = existing.ingresoNeto - existing.inversion;
          existing.margenPct = existing.ingresoNeto > 0
            ? Math.round(((existing.utilidadNeta / existing.ingresoNeto) * 100) * 10) / 10
            : 0;
        }
      });
    });

    // Fill missing months with 0
    return mesesEnRango.map((key) => mesMap[key] || {
      mesKey: key, mesLabel: shortMonth(key) + " " + key.split("-")[0],
      gestoraId: "global", gestoraName: "Global",
      ticketsCerrados: 0, ingresoNeto: 0, inversion: 0,
      utilidadNeta: 0, margenPct: 0, horasPromedio: 0,
    });
  }, [data, gestoraSeleccionada, mesesEnRango]);

  // ── KPIs del período seleccionado ────────────────────────────────────────
  const kpis = useMemo(() => {
    const totalTickets = historialMeses.reduce((s, m) => s + m.ticketsCerrados, 0);
    const totalIngreso = historialMeses.reduce((s, m) => s + m.ingresoNeto, 0);
    const totalInversion = historialMeses.reduce((s, m) => s + m.inversion, 0);
    const totalUtilidad = totalIngreso - totalInversion;
    const margen = totalIngreso > 0 ? (totalUtilidad / totalIngreso) * 100 : 0;

    // Comparativa vs período anterior (misma cantidad de meses)
    if (!data) return { totalTickets, totalIngreso, totalInversion, totalUtilidad, margen, trendTickets: undefined, trendIngreso: undefined };
    const nMeses = mesesEnRango.length;
    const prevMeses = lastNMonths(nMeses * 2).slice(0, nMeses);
    const prevMap: Record<string, GestoraMes> = {};
    const gestoras = gestoraSeleccionada ? [gestoraSeleccionada] : data.gestoras;
    gestoras.forEach((g) => {
      g.meses.forEach((m) => {
        if (!prevMeses.includes(m.mesKey)) return;
        if (!prevMap[m.mesKey]) prevMap[m.mesKey] = { ...m };
        else {
          prevMap[m.mesKey].ticketsCerrados += m.ticketsCerrados;
          prevMap[m.mesKey].ingresoNeto += m.ingresoNeto;
        }
      });
    });
    const prevTickets = Object.values(prevMap).reduce((s, m) => s + m.ticketsCerrados, 0);
    const prevIngreso = Object.values(prevMap).reduce((s, m) => s + m.ingresoNeto, 0);
    const trendTickets = prevTickets > 0 ? ((totalTickets - prevTickets) / prevTickets) * 100 : undefined;
    const trendIngreso = prevIngreso > 0 ? ((totalIngreso - prevIngreso) / prevIngreso) * 100 : undefined;

    return { totalTickets, totalIngreso, totalInversion, totalUtilidad, margen, trendTickets, trendIngreso };
  }, [historialMeses, data, gestoraSeleccionada, mesesEnRango]);

  // ── Tabla de ranking por gestora en el período ───────────────────────────
  const rankingGestoras = useMemo(() => {
    if (!data) return [];
    const list = data.gestoras.map((g) => {
      const mesFiltrados = g.meses.filter((m) => mesesEnRango.includes(m.mesKey));
      const totalTickets = mesFiltrados.reduce((s, m) => s + m.ticketsCerrados, 0);
      const totalIngreso = mesFiltrados.reduce((s, m) => s + m.ingresoNeto, 0);
      const totalInversion = mesFiltrados.reduce((s, m) => s + m.inversion, 0);
      const totalUtilidad = totalIngreso - totalInversion;
      const margenPct = totalIngreso > 0 ? (totalUtilidad / totalIngreso) * 100 : 0;
      const ticketPromedio = totalTickets > 0 ? totalIngreso / totalTickets : 0;
      return { ...g, totalTickets, totalIngreso, totalInversion, totalUtilidad, margenPct, ticketPromedio };
    });

    return [...list].sort((a, b) => {
      const valA = a[sortKey] as number;
      const valB = b[sortKey] as number;
      return sortDir === "desc" ? valB - valA : valA - valB;
    });
  }, [data, mesesEnRango, sortKey, sortDir]);

  // ── Comparativa horizontal de gestoras (chart) ───────────────────────────
  const comparativaData = useMemo(() =>
    rankingGestoras.map((g) => ({
      nombre: g.gestoraName.split(" ")[0], // Primera palabra del nombre
      Ingreso: Math.round(g.totalIngreso),
      Inversión: Math.round(g.totalInversion),
      Utilidad: Math.round(g.totalUtilidad),
      tickets: g.totalTickets,
    }))
  , [rankingGestoras]);

  const handleSort = useCallback((key: SortKey) => {
    if (sortKey === key) setSortDir((d) => d === "desc" ? "asc" : "desc");
    else { setSortKey(key); setSortDir("desc"); }
  }, [sortKey]);

  // ── Render: Loading / Error ──────────────────────────────────────────────
  if (isLoading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "400px", gap: "1rem", color: "#64748B" }}>
        <RefreshCcw size={40} style={{ animation: "spin 1s linear infinite" }} />
        <p style={{ fontWeight: 600 }}>Cargando datos de eficiencia...</p>
        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "400px", gap: "1rem" }}>
        <p style={{ color: "#EF4444", fontWeight: 700 }}>Error al cargar datos. Revisa la conexión con Supabase.</p>
        <button onClick={() => refetch()} style={{ padding: "0.5rem 1.5rem", background: "#6366F1", color: "#fff", border: "none", borderRadius: "0.5rem", cursor: "pointer", fontWeight: 600 }}>
          Reintentar
        </button>
      </div>
    );
  }

  const SortIcon = ({ k }: { k: SortKey }) =>
    sortKey === k
      ? (sortDir === "desc" ? <ChevronDown size={14} /> : <ChevronUp size={14} />)
      : null;

  const thStyle: React.CSSProperties = {
    padding: "0.75rem 1rem", textAlign: "left", fontSize: "0.72rem",
    fontWeight: 700, color: "#64748B", textTransform: "uppercase",
    letterSpacing: "0.05em", cursor: "pointer", whiteSpace: "nowrap",
    background: "#F8FAFC",
  };
  const tdStyle: React.CSSProperties = {
    padding: "0.875rem 1rem", fontSize: "0.85rem", color: "#1E293B",
    borderTop: "1px solid #F1F5F9",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>

      {/* ── BARRA DE FILTROS ─────────────────────────────────────────────── */}
      <div style={{
        display: "flex", flexWrap: "wrap", gap: "0.75rem", alignItems: "center",
        background: "#fff", border: "1px solid #E2E8F0", borderRadius: "0.875rem",
        padding: "0.875rem 1.25rem", boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
      }}>
        {/* Selector Gestora */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <Users size={15} color="#64748B" />
          <select
            value={selectedGestoraId}
            onChange={(e) => { setSelectedGestoraId(e.target.value); }}
            style={{ border: "1px solid #E2E8F0", borderRadius: "0.5rem", padding: "0.375rem 0.75rem", fontSize: "0.85rem", color: "#0F172A", background: "#F8FAFC", fontWeight: 600, cursor: "pointer" }}
          >
            <option value="global">Todos los Gestores</option>
            {data.gestoras.map((g) => (
              <option key={g.gestoraId} value={g.gestoraId}>{g.gestoraName}</option>
            ))}
          </select>
        </div>

        {/* Selector Rango */}
        <div style={{ display: "flex", gap: "0.375rem" }}>
          {(["6m", "12m", "año", "mes"] as RangoType[]).map((r) => (
            <button
              key={r}
              onClick={() => setRango(r)}
              style={{
                padding: "0.375rem 0.75rem", borderRadius: "0.5rem", fontSize: "0.82rem",
                fontWeight: 600, cursor: "pointer", border: "none",
                background: rango === r ? "#6366F1" : "#F1F5F9",
                color: rango === r ? "#fff" : "#64748B",
                transition: "all 0.15s",
              }}
            >
              {r === "6m" ? "Últ. 6 meses" : r === "12m" ? "Últ. 12 meses" : r === "año" ? "Año actual" : "Mes específico"}
            </button>
          ))}
        </div>

        {/* Selector Mes específico */}
        {rango === "mes" && (
          <select
            value={selectedMes}
            onChange={(e) => setSelectedMes(e.target.value)}
            style={{ border: "1px solid #E2E8F0", borderRadius: "0.5rem", padding: "0.375rem 0.75rem", fontSize: "0.85rem", color: "#0F172A", background: "#F8FAFC" }}
          >
            <option value="">— Selecciona mes —</option>
            {data.mesesDisponibles.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        )}

        {/* Botón Refresh */}
        <button
          onClick={() => refetch()}
          style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "0.375rem", padding: "0.375rem 0.875rem", borderRadius: "0.5rem", border: "1px solid #E2E8F0", background: "#fff", color: "#64748B", fontSize: "0.82rem", fontWeight: 600, cursor: "pointer" }}
        >
          <RefreshCcw size={14} /> Actualizar
        </button>
      </div>

      {/* ── 4 TARJETAS KPI ───────────────────────────────────────────────── */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "1rem" }}>
        <KpiCard
          label="Tickets Cerrados"
          value={kpis.totalTickets.toString()}
          sub={`en ${mesesEnRango.length} mes${mesesEnRango.length !== 1 ? "es" : ""}`}
          icon={<Activity size={16} />}
          trend={kpis.trendTickets}
          accentColor="#6366F1"
        />
        <KpiCard
          label="Ingreso Neto (Sin IGV)"
          value={fmtMoney(kpis.totalIngreso)}
          sub="Facturación real cobrada"
          icon={<DollarSign size={16} />}
          trend={kpis.trendIngreso}
          accentColor="#0EA5E9"
        />
        <KpiCard
          label="Inversión Real en Tickets"
          value={fmtMoney(kpis.totalInversion)}
          sub="Gastos operativos pagados en Tesorería"
          icon={<BarChart3 size={16} />}
          accentColor="#F59E0B"
        />
        <KpiCard
          label="Utilidad Neta"
          value={fmtMoney(kpis.totalUtilidad)}
          sub={`Margen: ${fmtPct(kpis.margen)}`}
          icon={<TrendingUp size={16} />}
          accentColor={colorMargen(kpis.margen)}
        />
      </div>

      {/* ── GRÁFICA 1: HISTORIAL FINANCIERO MES A MES ───────────────────── */}
      <div style={{
        background: "#fff", border: "1px solid #E2E8F0", borderRadius: "1rem",
        padding: "1.5rem", boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" }}>
          <div>
            <h3 style={{ fontWeight: 800, color: "#0F172A", fontSize: "1rem", margin: 0 }}>
              📊 Historial Financiero Mes a Mes
            </h3>
            <p style={{ color: "#64748B", fontSize: "0.8rem", margin: "0.25rem 0 0 0" }}>
              Ingreso Neto vs Inversión Real + Utilidad Neta
            </p>
          </div>
        </div>
        <div style={{ height: 340, width: "100%" }}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={historialMeses} margin={{ top: 10, right: 20, bottom: 0, left: 10 }}>
              <defs>
                <linearGradient id="gradIngreso" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#6366F1" stopOpacity={1} />
                  <stop offset="100%" stopColor="#4338CA" stopOpacity={1} />
                </linearGradient>
                <linearGradient id="gradInversion" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#F59E0B" stopOpacity={1} />
                  <stop offset="100%" stopColor="#D97706" stopOpacity={1} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
              <XAxis
                dataKey="mesLabel"
                axisLine={false} tickLine={false}
                tick={{ fill: "#64748B", fontSize: 11, fontWeight: 600 }}
                tickFormatter={(v) => v.split(" ")[0]}
              />
              <YAxis
                axisLine={false} tickLine={false}
                tick={{ fill: "#64748B", fontSize: 11 }}
                tickFormatter={(v) => `S/ ${(v / 1000).toFixed(0)}k`}
              />
              <Tooltip content={<FinancialTooltip />} />
              <Legend
                verticalAlign="top" align="right"
                iconType="circle" iconSize={8}
                wrapperStyle={{ paddingBottom: "1rem", fontSize: "0.8rem" }}
              />
              <Bar dataKey="ingresoNeto" name="Ingreso Neto (S/)" fill="url(#gradIngreso)" radius={[6, 6, 0, 0]} barSize={28} />
              <Bar dataKey="inversion" name="Inversión Real (S/)" fill="url(#gradInversion)" radius={[6, 6, 0, 0]} barSize={28} />
              <Line
                type="monotone" dataKey="utilidadNeta" name="Utilidad Neta (S/)"
                stroke="#10B981" strokeWidth={2.5}
                dot={{ r: 4, fill: "#10B981", strokeWidth: 2, stroke: "#fff" }}
                activeDot={{ r: 6 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── GRÁFICA 2: PRODUCTIVIDAD DE TICKETS MES A MES ───────────────── */}
      <div style={{
        background: "#fff", border: "1px solid #E2E8F0", borderRadius: "1rem",
        padding: "1.5rem", boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
      }}>
        <div style={{ marginBottom: "1.25rem" }}>
          <h3 style={{ fontWeight: 800, color: "#0F172A", fontSize: "1rem", margin: 0 }}>
            📈 Productividad de Tickets — Mes a Mes
          </h3>
          <p style={{ color: "#64748B", fontSize: "0.8rem", margin: "0.25rem 0 0 0" }}>
            Cantidad de tickets cerrados por período
          </p>
        </div>
        <div style={{ height: 260, width: "100%" }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={historialMeses} margin={{ top: 10, right: 20, bottom: 0, left: 10 }}>
              <defs>
                <linearGradient id="gradTickets" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#6366F1" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="#6366F1" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
              <XAxis
                dataKey="mesLabel"
                axisLine={false} tickLine={false}
                tick={{ fill: "#64748B", fontSize: 11 }}
                tickFormatter={(v) => v.split(" ")[0]}
              />
              <YAxis axisLine={false} tickLine={false} tick={{ fill: "#64748B", fontSize: 11 }} allowDecimals={false} />
              <Tooltip
                contentStyle={{ borderRadius: "0.75rem", border: "none", boxShadow: "0 10px 25px rgba(0,0,0,0.15)", padding: "0.875rem" }}
                formatter={(v: any) => [`${v} tickets`, "Tickets cerrados"]}
              />
              <Area
                type="monotone" dataKey="ticketsCerrados" name="Tickets cerrados"
                fill="url(#gradTickets)" stroke="#6366F1" strokeWidth={2.5}
                dot={{ r: 4, fill: "#6366F1", stroke: "#fff", strokeWidth: 2 }}
                activeDot={{ r: 6 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── GRÁFICA 3: COMPARATIVA POR GESTOR (solo cuando global) ─────── */}
      {selectedGestoraId === "global" && comparativaData.length > 1 && (
        <div style={{
          background: "#fff", border: "1px solid #E2E8F0", borderRadius: "1rem",
          padding: "1.5rem", boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
        }}>
          <div style={{ marginBottom: "1.25rem" }}>
            <h3 style={{ fontWeight: 800, color: "#0F172A", fontSize: "1rem", margin: 0 }}>
              👥 Comparativa de Productividad por Gestor
            </h3>
            <p style={{ color: "#64748B", fontSize: "0.8rem", margin: "0.25rem 0 0 0" }}>
              Ingreso vs Inversión vs Utilidad en el período seleccionado
            </p>
          </div>
          <div style={{ height: 300, width: "100%" }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={comparativaData} layout="vertical" margin={{ top: 10, right: 30, bottom: 0, left: 60 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E2E8F0" />
                <XAxis
                  type="number" axisLine={false} tickLine={false}
                  tick={{ fill: "#64748B", fontSize: 11 }}
                  tickFormatter={(v) => `S/${(v / 1000).toFixed(0)}k`}
                />
                <YAxis
                  type="category" dataKey="nombre" axisLine={false} tickLine={false}
                  tick={{ fill: "#0F172A", fontSize: 12, fontWeight: 700 }}
                />
                <Tooltip
                  contentStyle={{ borderRadius: "0.75rem", border: "none", boxShadow: "0 10px 25px rgba(0,0,0,0.15)", padding: "0.875rem" }}
                  formatter={(v: any, name) => [fmtMoney(v), name]}
                />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: "0.8rem" }} />
                <Bar dataKey="Ingreso" fill="#6366F1" radius={[0, 4, 4, 0]} barSize={16} />
                <Bar dataKey="Inversión" fill="#F59E0B" radius={[0, 4, 4, 0]} barSize={16} />
                <Bar dataKey="Utilidad" radius={[0, 4, 4, 0]} barSize={16}>
                  {comparativaData.map((entry, i) => (
                    <Cell key={i} fill={entry.Utilidad >= 0 ? "#10B981" : "#EF4444"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* ── TABLA EJECUTIVA DE RANKING ────────────────────────────────────── */}
      <div style={{
        background: "#fff", border: "1px solid #E2E8F0", borderRadius: "1rem",
        boxShadow: "0 2px 8px rgba(0,0,0,0.06)", overflow: "hidden",
      }}>
        <div style={{ padding: "1.25rem 1.5rem", borderBottom: "1px solid #F1F5F9", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h3 style={{ fontWeight: 800, color: "#0F172A", fontSize: "1rem", margin: 0 }}>
              🏆 Ranking de Gestores
            </h3>
            <p style={{ color: "#64748B", fontSize: "0.8rem", margin: "0.25rem 0 0 0" }}>
              Click en una fila para filtrar el dashboard a ese gestor
            </p>
          </div>
          <span style={{ background: "#F1F5F9", color: "#64748B", padding: "0.25rem 0.75rem", borderRadius: "2rem", fontSize: "0.78rem", fontWeight: 700 }}>
            {rankingGestoras.length} gestores
          </span>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={thStyle}>Gestor</th>
                <th style={{ ...thStyle, textAlign: "right" }} onClick={() => handleSort("totalTickets")}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "0.25rem" }}>
                    Tickets <SortIcon k="totalTickets" />
                  </div>
                </th>
                <th style={{ ...thStyle, textAlign: "right" }} onClick={() => handleSort("totalIngreso")}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "0.25rem" }}>
                    Ingreso Neto <SortIcon k="totalIngreso" />
                  </div>
                </th>
                <th style={{ ...thStyle, textAlign: "right" }} onClick={() => handleSort("totalInversion")}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "0.25rem" }}>
                    Inversión Real <SortIcon k="totalInversion" />
                  </div>
                </th>
                <th style={{ ...thStyle, textAlign: "right" }} onClick={() => handleSort("totalUtilidad")}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "0.25rem" }}>
                    Utilidad Neta <SortIcon k="totalUtilidad" />
                  </div>
                </th>
                <th style={{ ...thStyle, textAlign: "right" }} onClick={() => handleSort("margenPct")}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "0.25rem" }}>
                    Margen % <SortIcon k="margenPct" />
                  </div>
                </th>
                <th style={{ ...thStyle, textAlign: "right" }}>Ticket Prom.</th>
              </tr>
            </thead>
            <tbody>
              {rankingGestoras.map((g, i) => {
                const isSelected = selectedGestoraId === g.gestoraId;
                return (
                  <tr
                    key={g.gestoraId}
                    onClick={() => setSelectedGestoraId(isSelected ? "global" : g.gestoraId)}
                    style={{
                      cursor: "pointer",
                      background: isSelected ? "rgba(99,102,241,0.06)" : i % 2 === 0 ? "#fff" : "#FAFAFA",
                      transition: "background 0.15s",
                    }}
                    onMouseEnter={(e) => !isSelected && ((e.currentTarget as HTMLElement).style.background = "#F8FAFC")}
                    onMouseLeave={(e) => !isSelected && ((e.currentTarget as HTMLElement).style.background = i % 2 === 0 ? "#fff" : "#FAFAFA")}
                  >
                    <td style={{ ...tdStyle, fontWeight: 700 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.625rem" }}>
                        <div style={{
                          width: 32, height: 32, borderRadius: "50%",
                          background: `hsl(${(i * 137) % 360}, 70%, 92%)`,
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: "0.75rem", fontWeight: 800, color: `hsl(${(i * 137) % 360}, 60%, 35%)`,
                          flexShrink: 0,
                        }}>
                          {g.gestoraName.charAt(0).toUpperCase()}
                        </div>
                        <span style={{ fontSize: "0.85rem", color: "#0F172A" }}>{g.gestoraName}</span>
                      </div>
                    </td>
                    <td style={{ ...tdStyle, textAlign: "right", fontWeight: 700, color: "#6366F1" }}>
                      {g.totalTickets}
                    </td>
                    <td style={{ ...tdStyle, textAlign: "right" }}>{fmtMoney(g.totalIngreso)}</td>
                    <td style={{ ...tdStyle, textAlign: "right", color: "#F59E0B" }}>{fmtMoney(g.totalInversion)}</td>
                    <td style={{ ...tdStyle, textAlign: "right", fontWeight: 700, color: g.totalUtilidad >= 0 ? "#10B981" : "#EF4444" }}>
                      {fmtMoney(g.totalUtilidad)}
                    </td>
                    <td style={{ ...tdStyle, textAlign: "right" }}>
                      <span style={{
                        background: bgMargen(g.margenPct), color: colorMargen(g.margenPct),
                        padding: "0.2rem 0.6rem", borderRadius: "2rem",
                        fontWeight: 700, fontSize: "0.82rem",
                      }}>
                        {fmtPct(g.margenPct)}
                      </span>
                    </td>
                    <td style={{ ...tdStyle, textAlign: "right", color: "#64748B" }}>
                      {fmtMoney(g.ticketPromedio)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            {/* Total row */}
            <tfoot>
              <tr style={{ background: "#F8FAFC", borderTop: "2px solid #E2E8F0" }}>
                <td style={{ ...tdStyle, fontWeight: 800, color: "#0F172A" }}>TOTAL PERÍODO</td>
                <td style={{ ...tdStyle, textAlign: "right", fontWeight: 800, color: "#6366F1" }}>
                  {rankingGestoras.reduce((s, g) => s + g.totalTickets, 0)}
                </td>
                <td style={{ ...tdStyle, textAlign: "right", fontWeight: 800 }}>
                  {fmtMoney(rankingGestoras.reduce((s, g) => s + g.totalIngreso, 0))}
                </td>
                <td style={{ ...tdStyle, textAlign: "right", fontWeight: 800, color: "#F59E0B" }}>
                  {fmtMoney(rankingGestoras.reduce((s, g) => s + g.totalInversion, 0))}
                </td>
                <td style={{ ...tdStyle, textAlign: "right", fontWeight: 800, color: "#10B981" }}>
                  {fmtMoney(rankingGestoras.reduce((s, g) => s + g.totalUtilidad, 0))}
                </td>
                <td style={{ ...tdStyle, textAlign: "right" }}>
                  <span style={{
                    background: bgMargen(kpis.margen),
                    color: colorMargen(kpis.margen),
                    padding: "0.2rem 0.6rem", borderRadius: "2rem",
                    fontWeight: 800, fontSize: "0.82rem",
                  }}>
                    {fmtPct(kpis.margen)}
                  </span>
                </td>
                <td style={{ ...tdStyle, textAlign: "right" }}>—</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* ── NOTA TÉCNICA (Footer) ─────────────────────────────────────────── */}
      <div style={{
        background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: "0.75rem",
        padding: "0.875rem 1.25rem", fontSize: "0.75rem", color: "#64748B",
        display: "flex", gap: "1.5rem", flexWrap: "wrap",
      }}>
        <span>📊 <strong>{data.raw.tickets.length}</strong> tickets cerrados en BD</span>
        <span>💰 <strong>{data.raw.costs.length}</strong> costos pagados (ticket_costs)</span>
        <span>👥 <strong>{data.gestoras.length}</strong> gestores activos</span>
        <span>📅 Período histórico: <strong>{data.mesesDisponibles[0]}</strong> → <strong>{data.mesesDisponibles[data.mesesDisponibles.length - 1]}</strong></span>
        <span style={{ marginLeft: "auto", color: "#10B981", fontWeight: 700 }}>✅ Datos 100% reales desde Supabase</span>
      </div>

    </div>
  );
}
