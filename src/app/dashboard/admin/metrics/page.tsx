"use client";

import { useState, useMemo } from "react";
import { 
    DollarSign, TrendingUp, AlertTriangle, Clock, 
    BarChart3, Filter, Calendar, Building2, PieChart,
    ArrowUpDown, Target, Wallet
} from "lucide-react";
import { useAppData } from "@/lib/AppDataContext";
import { normalizeStateId } from "@/lib/ticketStates";

// === HELPERS ===
const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const fmt = (n: number) => n.toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtInt = (n: number) => n.toLocaleString("es-PE");

// === DATE UTILS ===
const getStartOfMonth = () => new Date(new Date().getFullYear(), new Date().getMonth(), 1);
const isInRange = (dateStr: string, start: Date, end: Date) => {
    if (!dateStr) return false;
    const d = new Date(dateStr);
    return d >= start && d <= end;
};

// === MAIN COMPONENT ===
export default function MetricsDashboard() {
    const { tickets, clients } = useAppData();
    
    // Filters
    const [selectedClient, setSelectedClient] = useState<string>("all");
    const [dateRange, setDateRange] = useState<"this_month"|"last_month"|"this_year"|"custom">("this_month");
    const [customStart, setCustomStart] = useState<string>("");
    const [customEnd, setCustomEnd] = useState<string>("");

    // Compute date range
    const rangeDates = useMemo(() => {
        const now = new Date();
        let start: Date, end: Date;
        
        switch (dateRange) {
            case "this_month":
                start = getStartOfMonth();
                end = now;
                break;
            case "last_month":
                start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
                break;
            case "this_year":
                start = new Date(now.getFullYear(), 0, 1);
                end = now;
                break;
            case "custom":
                start = customStart ? new Date(customStart) : new Date(now.getFullYear(), 0, 1);
                end = customEnd ? new Date(customEnd) : now;
                break;
            default:
                start = getStartOfMonth();
                end = now;
        }
        return { start, end };
    }, [dateRange, customStart, customEnd]);

    // CLIENT DATA (cached)
    const clientsMap = useMemo(() => {
        const map = new Map();
        (clients || []).forEach((c: any) => map.set(c.id, c));
        return map;
    }, [clients]);

    // FILTER TICKETS BY DATE AND CLIENT
    const filteredTickets = useMemo(() => {
        return tickets.filter((t: any) => {
            // Filter by client
            if (selectedClient !== "all" && t.client_id !== selectedClient) return false;
            // Filter by date range (creation OR closure)
            const createdAt = t.created_at || t.createdAt;
            const closedAt = t.closure_date;
            const inCreated = createdAt && isInRange(createdAt, rangeDates.start, rangeDates.end);
            const inClosed = closedAt && isInRange(closedAt, rangeDates.start, rangeDates.end);
            return inCreated || inClosed;
        });
    }, [tickets, selectedClient, rangeDates]);

    // === KPI CALCULATIONS (READ-ONLY AGGREGATION) ===
    const kpis = useMemo(() => {
        const tk = filteredTickets;
        
        // Define estados por categoría
        const pipelineStates = ["en_cotizacion", "cotizacion_enviada"];
        const approvedStates = ["cotizacion_aprobada", "en_ejecucion", "documentacion_enviada", "por_liquidar", "requiere_revision_admin"];
        const closedStates = ["ticket_cerrado", "liquidado"];
        const rejectedStates = ["ticket_rechazado", "ticket_cancelado"];
        
        // A. Capital Expuesto: Adelantos (50%) en tickets NO cerrados
        const enProceso = tk.filter((t: any) => !closedStates.includes(normalizeStateId(t.status_id || t.estadoId)));
        
        // Calcular avances/adelantos pagados (campo gasto_flujo_a = anticipo 50%)
        const capitalExpuesto = enProceso.reduce((sum, t: any) => 
            sum + (parseFloat(t.gasto_flujo_a || t.adelantos_flujo_a || t.anticipo_50 || 0)), 0);
        
        // B. Pipeline en Cotización
        const enCotizacion = tk.filter((t: any) => 
            pipelineStates.includes(normalizeStateId(t.status_id || t.estadoId)));
        const pipelineMonto = enCotizacion.reduce((sum, t: any) => 
            sum + (parseFloat(t.total_quoted_amount || t.montoFinal || 0) / 1.18), 0);
        
        // C. Precios Aprobados (asegurado)
        const aprob = tk.filter((t: any) => 
            approvedStates.includes(normalizeStateId(t.status_id || t.estadoId)));
        const presupuestosAprobados = aprob.reduce((sum, t: any) => 
            sum + (parseFloat(t.ingresos_reales || t.ingreso_real || 0)), 0);
        
        // D. Rentabilidad (SOLO tickets CERRADOS)
        const cerradostk = tk.filter((t: any) => 
            closedStates.includes(normalizeStateId(t.status_id || t.estadoId)));
        const ingresosCerrados = cerradostk.reduce((sum, t: any) => 
            sum + (parseFloat(t.ingresos_reales || t.ingreso_real || 0)), 0);
        const inversionCerrados = cerradostk.reduce((sum, t: any) => 
            sum + (parseFloat(t.total_costs_agg || t.inversion_ejecutada || 0)), 0);
        const utilidadNeta = round2(ingresosCerrados - inversionCerrados);
        const margenReal = ingresosCerrados > 0 ? (utilidadNeta / ingresosCerrados) * 100 : 0;
        
        // E. Inversión Total Ejecutada
        const inversionTotal = tk.reduce((sum, t: any) => 
            sum + (parseFloat(t.total_costs_agg || t.inversion_ejecutada || 0)), 0);
        
        // F. Lucro Cesante: Tickets rechazados/anulados en el periodo
        const rechazados = tk.filter((t: any) => 
            rejectedStates.includes(normalizeStateId(t.status_id || t.estadoId)));
        const lucroCesante = rechazados.reduce((sum, t: any) => 
            sum + (parseFloat(t.utilidad_neta || t.montoPerdido || 0)), 0);
        
        // Por Cliente
        const porCliente = new Map();
        (tk || []).forEach((t: any) => {
            const cid = t.client_id || "unknown";
            const curr = porCliente.get(cid) || { ingresos: 0, costos: 0, tickets: 0 };
            curr.ingresos += parseFloat(t.ingresos_reales || 0);
            curr.costos += parseFloat(t.total_costs_agg || 0);
            curr.tickets++;
            porCliente.set(cid, curr);
        });
        
        return {
            capitalExpuesto: round2(capitalExpuesto),
            pipelineMonto: round2(pipelineMonto),
            presupuestosAprobados: round2(presupuestosAprobados),
            ingresosCerrados: round2(ingresosCerrados),
            inversionCerrados: round2(inversionCerrados),
            utilidadNeta,
            margenReal,
            inversionTotal,
            lucroCesante: round2(lucroCesante),
            // Counts
            ticketsEnProceso: enProceso.length,
            ticketsEnCotizacion: enCotizacion.length,
            ticketsAprobados: aprob.length,
            ticketsCerrados: cerradostk.length,
            ticketsRechazados: rechazados.length,
            // By Client
            porCliente: Array.from(porCliente.entries()).map(([id, data]: any) => {
                const cliente = clientsMap.get(id);
                return {
                    id,
                    nombre: cliente?.name || "Sin cliente",
                    icon: cliente?.icon || "🏦",
                    ...data
                };
            }).sort((a, b) => b.ingresos - a.ingresos)
        };
    }, [filteredTickets, clientsMap]);

    // === STYLES ===
    const cardStyle = (active: boolean) => ({
        background: "rgba(255,255,255,0.03)",
        border: `1px solid ${active ? "rgba(34,197,94,0.4)" : "rgba(255,255,255,0.06)"}`,
        borderRadius: "14px",
        padding: "1.25rem",
        transition: "all 0.2s"
    });

    const valueStyle = (value: number, color: string = "#fff") => ({
        fontSize: "1.8rem",
        fontWeight: 900,
        color: value > 0 ? color : "rgba(255,255,255,0.3)"
    });

    return (
        <div className="min-h-screen" style={{ background: "#0a0a0a", color: "#fff", padding: "1.5rem" }}>
            {/* HEADER */}
            <div style={{ marginBottom: "1.5rem" }}>
                <h1 style={{ fontSize: "1.75rem", fontWeight: 900, display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <BarChart3 size={28} style={{ color: "#10B981" }} />
                    Intelligence Dashboard
                </h1>
                <p style={{ color: "rgba(255,255,255,0.5)", marginTop: "0.25rem" }}>
                    Panel Gerencial • Read-Only • Code Freeze Active
                </p>
            </div>

            {/* FILTERS BAR */}
            <div style={{ 
                display: "flex", gap: "1rem", flexWrap: "wrap",
                background: "rgba(255,255,255,0.03)", padding: "1rem",
                borderRadius: "12px", marginBottom: "1.5rem",
                border: "1px solid rgba(255,255,255,0.06)"
            }}>
                {/* Date Range */}
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <Calendar size={16} style={{ color: "rgba(255,255,255,0.5)" }} />
                    <select 
                        value={dateRange}
                        onChange={(e) => setDateRange(e.target.value as any)}
                        style={{
                            background: "rgba(255,255,255,0.1)",
                            border: "1px solid rgba(255,255,255,0.2)",
                            borderRadius: "8px",
                            padding: "0.4rem 0.75rem",
                            color: "#fff",
                            fontSize: "0.85rem"
                        }}
                    >
                        <option value="this_month">Este Mes</option>
                        <option value="last_month">Mes Anterior</option>
                        <option value="this_year">Este Año</option>
                        <option value="custom">Personalizado</option>
                    </select>
                    {dateRange === "custom" && (
                        <>
                            <input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)}
                                style={{ background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)", borderRadius: "6px", padding: "0.3rem", color: "#fff" }} />
                            <span>-</span>
                            <input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)}
                                style={{ background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)", borderRadius: "6px", padding: "0.3rem", color: "#fff" }} />
                        </>
                    )}
                </div>

                {/* Client Filter */}
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <Building2 size={16} style={{ color: "rgba(255,255,255,0.5)" }} />
                    <select 
                        value={selectedClient}
                        onChange={(e) => setSelectedClient(e.target.value)}
                        style={{
                            background: "rgba(255,255,255,0.1)",
                            border: "1px solid rgba(255,255,255,0.2)",
                            borderRadius: "8px",
                            padding: "0.4rem 0.75rem",
                            color: "#fff",
                            fontSize: "0.85rem"
                        }}
                    >
                        <option value="all">Todos los Clientes</option>
                        {(clients || []).map((c: any) => (
                            <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
                        ))}
                    </select>
                </div>

                {/* Summary Stats */}
                <div style={{ marginLeft: "auto", display: "flex", gap: "1rem", fontSize: "0.8rem", color: "rgba(255,255,255,0.5)" }}>
                    <span>{filteredTickets.length} tickets</span>
                    <span>•</span>
                    <span>{kpis.ticketsCerrados} cerrados</span>
                </div>
            </div>

            {/* === SECTION 1: TERMÓMETRO DE LIQUIDEZ === */}
            <div style={{ marginBottom: "2rem" }}>
                <h3 style={{ fontSize: "0.75rem", fontWeight: 800, color: "rgba(255,255,255,0.4)", marginBottom: "0.75rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    🌡️ Termómetro de Liquidez (Dinero en la Calle)
                </h3>
                
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "1rem" }}>
                    {/* Capital Expuesto */}
                    <div style={cardStyle(kpis.capitalExpuesto > 0)}>
                        <div style={{ fontSize: "0.7rem", fontWeight: 700, color: "rgba(239,68,68,0.8)", marginBottom: "0.25rem", display: "flex", alignItems: "center", gap: "6px" }}>
                            <Wallet size={14} /> CAPITAL EXPUESTO
                        </div>
                        <div style={valueStyle(kpis.capitalExpuesto, "#EF4444")}>S/ {fmt(kpis.capitalExpuesto)}</div>
                        <div style={{ fontSize: "0.7rem", color: "rgba(255,255,255,0.4)", marginTop: "0.25rem" }}>
                            Adelantos (50%) no liquidados • {kpis.ticketsEnProceso} tickets
                        </div>
                    </div>

                    {/* Lucro Cesante */}
                    <div style={cardStyle(kpis.lucroCesante > 0)}>
                        <div style={{ fontSize: "0.7rem", fontWeight: 700, color: "rgba(239,68,68,0.8)", marginBottom: "0.25rem", display: "flex", alignItems: "center", gap: "6px" }}>
                            <AlertTriangle size={14} /> LUCRO CESANTE
                        </div>
                        <div style={valueStyle(kpis.lucroCesante, "#EF4444")}>S/ {fmt(kpis.lucroCesante)}</div>
                        <div style={{ fontSize: "0.7rem", color: "rgba(255,255,255,0.4)", marginTop: "0.25rem" }}>
                            Pérdida por rechazos • {kpis.ticketsRechazados} tickets
                        </div>
                    </div>
                </div>
            </div>

            {/* === SECTION 2: PIPELINE COMERCIAL === */}
            <div style={{ marginBottom: "2rem" }}>
                <h3 style={{ fontSize: "0.75rem", fontWeight: 800, color: "rgba(255,255,255,0.4)", marginBottom: "0.75rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    📈 Pipeline Comercial (Futuro Corto Plazo)
                </h3>
                
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "1rem" }}>
                    {/* Pipeline en Cotización */}
                    <div style={cardStyle(kpis.pipelineMonto > 0)}>
                        <div style={{ fontSize: "0.7rem", fontWeight: 700, color: "rgba(245,158,11,0.8)", marginBottom: "0.25rem", display: "flex", alignItems: "center", gap: "6px" }}>
                            <Clock size={14} /> PIPELINE EN COTIZACIÓN
                        </div>
                        <div style={valueStyle(kpis.pipelineMonto, "#F59E0B")}>S/ {fmt(kpis.pipelineMonto)}</div>
                        <div style={{ fontSize: "0.7rem", color: "rgba(255,255,255,0.4)", marginTop: "0.25rem" }}>
                            Por aprobar • {kpis.ticketsEnCotizacion} tickets
                        </div>
                    </div>

                    {/* Precios Aprobados */}
                    <div style={cardStyle(kpis.presupuestosAprobados > 0)}>
                        <div style={{ fontSize: "0.7rem", fontWeight: 700, color: "rgba(34,197,94,0.8)", marginBottom: "0.25rem", display: "flex", alignItems: "center", gap: "6px" }}>
                            <Target size={14} /> PRESUPUESTOS APROBADOS
                        </div>
                        <div style={valueStyle(kpis.presupuestosAprobados, "#22C55E")}>S/ {fmt(kpis.presupuestosAprobados)}</div>
                        <div style={{ fontSize: "0.7rem", color: "rgba(255,255,255,0.4)", marginTop: "0.25rem" }}>
                            Dinero asegurado • {kpis.ticketsAprobados} tickets
                        </div>
                    </div>
                </div>
            </div>

            {/* === SECTION 3: ANÁLISIS DE RENTABILIDAD === */}
            <div style={{ marginBottom: "2rem" }}>
                <h3 style={{ fontSize: "0.75rem", fontWeight: 800, color: "rgba(255,255,255,0.4)", marginBottom: "0.75rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    💰 Análisis de Rentabilidad (Resultado Real)
                </h3>
                
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "1rem" }}>
                    {/* Inversión Ejecutada */}
                    <div style={cardStyle(kpis.inversionTotal > 0)}>
                        <div style={{ fontSize: "0.7rem", fontWeight: 700, color: "rgba(139,92,246,0.8)", marginBottom: "0.25rem", display: "flex", alignItems: "center", gap: "6px" }}>
                            <ArrowUpDown size={14} /> INVERSIÓN TOTAL
                        </div>
                        <div style={valueStyle(kpis.inversionTotal, "#8B5CF6")}>S/ {fmt(kpis.inversionTotal)}</div>
                        <div style={{ fontSize: "0.7rem", color: "rgba(255,255,255,0.4)", marginTop: "0.25rem" }}>
                            Costo directo real de la empresa
                        </div>
                    </div>

                    {/* Utilidad Neta */}
                    <div style={cardStyle(kpis.utilidadNeta > 0)}>
                        <div style={{ fontSize: "0.7rem", fontWeight: 700, color: "rgba(16,185,129,0.8)", marginBottom: "0.25rem", display: "flex", alignItems: "center", gap: "6px" }}>
                            <TrendingUp size={14} /> UTILIDAD NETA
                        </div>
                        <div style={valueStyle(kpis.utilidadNeta, "#10B981")}>S/ {fmt(kpis.utilidadNeta)}</div>
                        <div style={{ fontSize: "0.85rem", fontWeight: 700, marginTop: "0.25rem" }}>
                            <span style={{ 
                                color: kpis.margenReal >= 35 ? "#22C55E" : kpis.margenReal >= 20 ? "#F59E0B" : "#EF4444",
                                background: "rgba(255,255,255,0.1)",
                                padding: "0.2rem 0.5rem",
                                borderRadius: "4px"
                            }}>
                                Margen: {Math.round(kpis.margenReal)}%
                            </span>
                        </div>
                        <div style={{ fontSize: "0.7rem", color: "rgba(255,255,255,0.4)", marginTop: "0.25rem" }}>
                            De {kpis.ticketsCerrados} ticket(s) cerrado(s)
                        </div>
                    </div>
                </div>
            </div>

            {/* === SECTION 4: POR CLIENTE === */}
            {kpis.porCliente.length > 0 && (
                <div style={{ marginBottom: "2rem" }}>
                    <h3 style={{ fontSize: "0.75rem", fontWeight: 800, color: "rgba(255,255,255,0.4)", marginBottom: "0.75rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                        🏦 Totales por Cliente
                    </h3>
                    
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "1rem" }}>
                        {kpis.porCliente.slice(0, 6).map((cli) => (
                            <div key={cli.id} style={cardStyle(false)}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                    <div style={{ fontSize: "0.85rem", fontWeight: 700 }}>{cli.icon} {cli.nombre}</div>
                                    <div style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.4)" }}>{cli.tickets} tickets</div>
                                </div>
                                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginTop: "0.75rem" }}>
                                    <div>
                                        <div style={{ fontSize: "0.65rem", color: "rgba(255,255,255,0.4)" }}>Ingresos</div>
                                        <div style={{ fontSize: "1.1rem", fontWeight: 800, color: "#10B981" }}>S/ {fmt(cli.ingresos)}</div>
                                    </div>
                                    <div>
                                        <div style={{ fontSize: "0.65rem", color: "rgba(255,255,255,0.4)" }}>Costos</div>
                                        <div style={{ fontSize: "1.1rem", fontWeight: 800, color: "#F59E0B" }}>S/ {fmt(cli.costos)}</div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* FOOTER */}
            <div style={{ textAlign: "center", padding: "2rem", color: "rgba(255,255,255,0.25)", fontSize: "0.75rem" }}>
                <p>🔒 Intelligence Dashboard • Read-Only Mode • Code Freeze Active</p>
                <p style={{ marginTop: "0.25rem" }}>Datos agregados de public.vw_tickets_strategic • Sin modificaciones al núcleo</p>
            </div>
        </div>
    );
}