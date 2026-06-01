import { round2 } from "./formatters";

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS DE PARSEO
// ─────────────────────────────────────────────────────────────────────────────

/** Parseo numérico seguro: acepta number, string formateado o cualquier cosa. */
export const toNum = (val: any): number => {
    if (typeof val === "number") return val;
    if (typeof val === "string") return parseFloat(val.replace(/[^0-9.-]/g, "")) || 0;
    return 0;
};

// ─────────────────────────────────────────────────────────────────────────────
// ESTADO DE PAGO CONFIRMADO
// ─────────────────────────────────────────────────────────────────────────────

const CONFIRMED_STATUSES = new Set([
    "pagado", "abonado", "confirmado", "auditado",
    "ejecutado", "autorizado admin", "autorizado", "aprobado",
    "transferido", "completado", "depósito", "deposito",
]);

export const isConfirmedTicketCostStatus = (status: string | null | undefined): boolean => {
    const s = (status || "").toLowerCase().trim();
    return CONFIRMED_STATUSES.has(s) || [...CONFIRMED_STATUSES].some(v => s.includes(v));
};

// ─────────────────────────────────────────────────────────────────────────────
// CLASIFICADOR RELACIONAL: 'labor' | 'operating' | 'none'
//
// Jerarquía de reglas (en orden de prioridad):
//   1. specialist_id === main_technician_id  → labor   (pago al técnico del ticket)
//   2. specialist_id !== main_technician_id  → operating (pago a tercero externo)
//   3. sin specialist_id → inferir por palabras clave en categoría/concepto
// ─────────────────────────────────────────────────────────────────────────────

const OPERATING_KEYWORDS = [
    "compras", "materiales", "viáticos", "viatico", "logística",
    "insumos", "movilidad", "pasajes", "taxi", "bus", "transporte",
    "envíos", "gasto operativo", "compra mat", "herramientas",
    "repuestos", "insumo", "peaje", "estacionamiento", "egreso",
    "adelanto operativo",
];

const LABOR_KEYWORDS = [
    "mano de obra", "adelanto m.o", "pago mo", "pago_mo",
    "honorarios", "pago técnico", "pago_tecnico", "rescate",
    "liquidación", "liquidacion", "saldo mo", "mo final",
    "laboral", "técnico",
];

type CostClass = "labor" | "operating" | "none";

function classifyItem(item: any): CostClass {
    const sid: string = item.specialist_id ?? "";
    const mid: string = item.main_technician_id ?? "";

    // Regla relacional (fuente de verdad primaria)
    if (sid && mid) {
        return sid === mid ? "labor" : "operating";
    }

    // Fallback por palabras clave (solo cuando falta el ID relacional)
    const cat = (item.categoria || "").toLowerCase();
    const con = (item.concepto || item.tipo || "").toLowerCase();
    const text = `${cat} ${con}`;

    if (OPERATING_KEYWORDS.some(k => text.includes(k))) return "operating";
    if (LABOR_KEYWORDS.some(k => text.includes(k)) || con.includes("pago")) return "labor";
    return "none";
}

// Alias compatibles con el código externo que llama isLabor/isOperating directamente
/** @internal Solo para compatibilidad — preferir classifyItem() */
const isLabor     = (item: any) => classifyItem(item) === "labor";
const isOperating = (item: any) => classifyItem(item) === "operating";

// ─────────────────────────────────────────────────────────────────────────────
// MOTOR FINANCIERO V3 — Fuente de verdad: ticket_costs (tabla relacional)
// Metadata ignorada completamente para cálculos financieros.
// ─────────────────────────────────────────────────────────────────────────────

export function calculateTicketFinances(ticket: any, costs: any[] = []) {
    // ID del técnico principal (para resolver la relación en cada costo)
    const mainTechId: string =
        ticket.technician_id ?? ticket.technicians?.id ?? ticket.metadata?.tecnico?.id ?? "";

    // Enriquecer cada costo con main_technician_id si no lo tiene
    const enriched = Array.isArray(costs)
        ? costs.map(c => (c.main_technician_id ? c : { ...c, main_technician_id: mainTechId }))
        : [];

    // MO pactada: primer valor positivo entre las columnas canónicas del ticket
    const pactedMO =
        [ticket.labor_cost, ticket.monto_pactado_mo, ticket.costoManoObra, ticket.monto_acordado]
            .map(toNum)
            .find(v => v > 0) ?? 0;

    // Ingresos base (sin IGV si aplica)
    const montoFinal =
        [ticket.ingresos_reales, ticket.monto_presupuesto, ticket.total_quoted_amount,
         ticket.montoFinal, ticket.montoTotalCotizado]
            .map(toNum)
            .find(v => v > 0) ?? 0;

    const igv = toNum(ticket.montoIGV ?? ticket.igv ?? 0);
    const montoBase = igv > 0 ? round2(montoFinal - igv) : montoFinal;

    // Normalizar un costo: extraer monto y fecha canónicos
    const normalize = (c: any) => ({
        ...c,
        monto: toNum(c.monto ?? c.amount ?? 0),
        fecha: c.fecha_pago ?? c.fecha ?? c.date ?? c.created_at ?? new Date().toISOString(),
    });

    // Particionar costos por estado y clasificación
    const confirmed = enriched.filter(c => isConfirmedTicketCostStatus(c.estado_pago ?? c.estado));
    const pending   = enriched.filter(c => {
        const s = (c.estado_pago ?? c.estado ?? "").toLowerCase();
        return s === "pendiente" || s === "requiere_aprobacion_admin";
    });

    const confirmedN = confirmed.map(normalize);
    const pendingN   = pending.map(normalize);

    const laborItems   = confirmedN.filter(isLabor);
    const opItems      = confirmedN.filter(isOperating);
    const pendingLabor = pendingN.filter(isLabor);
    const pendingOp    = pendingN.filter(isOperating);

    const sum = (arr: any[]) => round2(arr.reduce((a, c) => a + c.monto, 0));

    const totalLaborConfirmed = sum(laborItems);
    const totalOpConfirmed    = sum(opItems);
    const totalLaborPending   = sum(pendingLabor);
    const totalOpPending      = sum(pendingOp);

    const totalVenta         = round2(montoBase);
    const netIncome          = totalVenta;
    
    // Cash Basis (Flujo de Caja Real) - Lo que realmente ha salido de Tesorería
    const totalCashOut       = round2(totalLaborConfirmed + totalOpConfirmed);
    
    // Accrual Basis (Costo Devengado) - El costo real del ticket para la empresa
    // Si se pagó más de la MO pactada (por rescates/excedentes), el costo real sube.
    const realLaborCost      = Math.max(pactedMO, totalLaborConfirmed);
    const totalAccrualCost   = round2(realLaborCost + totalOpConfirmed);

    // Rentabilidad Real (Se calcula sobre el Costo Devengado, garantizando que 
    // la deuda pendiente con el técnico ya esté restada de la utilidad)
    const realProfitability  = round2(montoBase - totalAccrualCost);
    const margenReal         = montoBase > 0 ? round2((realProfitability / montoBase) * 100) : 0;

    // Variables de salida (compatibilidad con frontend)
    // totalExpenses representa la "Inversión Ejecutada" (Cash-Out real)
    const totalExpenses      = totalCashOut; 

    const netLaborBalance    = Math.max(0, round2(pactedMO - totalLaborConfirmed));

    return {
        // ── Ingresos ──────────────────────────────────────────────────────────
        totalVenta:          montoBase,
        netIncome:           montoBase,       // alias

        // ── MO ────────────────────────────────────────────────────────────────
        pactedMO,
        laborPactado:        pactedMO,        // alias
        totalPactedDebt:     pactedMO,        // alias
        totalLaborConfirmed,
        laborExpenses:       totalLaborConfirmed, // alias
        totalLaborPending,
        laborRequested:      totalLaborConfirmed + totalLaborPending,
        netLaborBalance,
        balance:             netLaborBalance, // alias

        // ── Gastos operativos ─────────────────────────────────────────────────
        totalOpConfirmed,
        operatingExpenses:   totalOpConfirmed, // alias
        totalOpPending,
        totalExpenses:       totalLaborConfirmed + totalOpConfirmed, // alias
        totalRequested:      totalLaborConfirmed + totalOpConfirmed + totalOpPending,

        // ── Rentabilidad ──────────────────────────────────────────────────────
        realProfitability,
        netProfit:           realProfitability, // alias
        margenReal,
        profitMargin:        margenReal,        // alias
        totalReserva:        round2(netLaborBalance + totalLaborPending + totalOpPending),

        // ── Items (para historial / UI) ───────────────────────────────────────
        laborItems,
        operatingItems:      opItems,
        pendingCosts:        pending,
        pendingLaborItems:   pendingLabor,
        pendingOpItems:      pendingOp,
    };
}
