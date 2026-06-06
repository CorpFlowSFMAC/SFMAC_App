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
// EXTRACTOR DE IGV CENTRALIZADO
// ─────────────────────────────────────────────────────────────────────────────
/** Extrae de forma centralizada y segura el IGV de un ticket en cualquiera de sus formatos (root o metadata). */
export const extractIGV = (ticket: any): number => {
    if (!ticket) return 0;
    return toNum(
        ticket.montoIGV ?? 
        ticket.monto_igv ?? 
        ticket.metadata?.montoIGV ?? 
        ticket.metadata?.monto_igv ?? 
        ticket.igv ?? 
        ticket.metadata?.igv ?? 
        0
    );
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
// CLASIFICADOR: 'labor' | 'operating' | 'none'
//
// Jerarquía de reglas (en orden de prioridad):
//   1. Categoría operativa explícita → operating (siempre, independiente del técnico)
//   2. Categoría laboral explícita (MO/Rescate) → relacional: mismo técnico=labor, otro=operating
//   3. Fallback por palabras clave cuando no hay categoría ni ID relacional
//
// REGLA DE NEGOCIO CRÍTICA: Materiales, Viáticos, Logística, Adelanto Operativo y Otros
// son SIEMPRE gastos operativos (reducen utilidad), sin importar a qué técnico se le asignen.
// Solo pagos de 'Mano de Obra' / 'Rescate Financiero' al técnico principal cuentan como labor.
// ─────────────────────────────────────────────────────────────────────────────

// Categorías que son SIEMPRE gastos operativos (nunca labor)
const OPERATING_CATEGORIES = new Set([
    "materiales", "viáticos", "viaticos", "viáticos / movilidad", "viaticos / movilidad",
    "logística", "logistica", "envíos", "envios", "movilidad", "insumos",
    "otros", "otros egresos", "compras",
]);

// Categorías de MO/pagos al técnico — se resuelven por regla relacional:
//   specialist_id === main_technician_id  → 'labor'   (pago al técnico principal)
//   specialist_id !== main_technician_id  → 'operating' (pago a técnico externo)
const LABOR_CATEGORIES = new Set([
    "mano de obra", "rescate financiero", "rescate", "honorarios", "bono",
    // Adelantos de MO: tanto el pago parcial al técnico del ticket (labor)
    // como el pago a un externo (operating via regla relacional)
    "adelanto", "adelanto operativo",
]);

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
    const cat: string = (item.categoria || "").toLowerCase().trim();
    const con: string = (item.concepto || item.tipo || "").toLowerCase();
    const text = `${cat} ${con}`;

    // ── Regla 1: Categoría operativa explícita → siempre operating ──────────
    // Materiales, Viáticos, Logística, Adelanto Operativo, Otros SIEMPRE son
    // gastos que reducen la utilidad, independiente del técnico vinculado.
    if (OPERATING_CATEGORIES.has(cat)) return "operating";

    // ── Regla 2: Categoría laboral + regla relacional ────────────────────────
    // Solo 'Mano de Obra', 'Rescate Financiero', etc. se resuelven por relación
    if (LABOR_CATEGORIES.has(cat)) {
        if (sid && mid) return sid === mid ? "labor" : "operating";
        // Fallback por keyword si no hay IDs
        if (LABOR_KEYWORDS.some(k => text.includes(k))) return "labor";
    }

    // ── Regla 3: Regla relacional genérica (para categorías no mapeadas) ─────
    if (sid && mid) {
        return sid === mid ? "labor" : "operating";
    }

    // ── Regla 4: Fallback por palabras clave ─────────────────────────────────
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
    const rawAmount =
        [ticket.monto_presupuesto, ticket.total_quoted_amount,
         ticket.montoFinal, ticket.montoTotalCotizado]
            .map(toNum)
            .find(v => v > 0) ?? 0;

    const commercialRound = (val: number) => Math.round(val * 100) / 100;

    // Regla de Oro Inmutable: TODO TICKET aplica IGV matemáticamente hacia adelante, SIN EXCEPCIÓN.
    // Se elimina la dependencia de flags legacy como 'has_igv' o 'aplicaIGV'.
    const esMasIGV = ticket.mas_igv === true || ticket.incluye_igv === false;

    let montoBase = 0;
    let igvCalculado = 0;
    let totalGeneral = 0;

    if (esMasIGV) {
        // SI EL PRECIO ES MÁS IGV
        montoBase = rawAmount;
        igvCalculado = commercialRound(montoBase * 0.18);
        totalGeneral = commercialRound(montoBase + igvCalculado);
    } else {
        // SI EL PRECIO ES TODO INCLUIDO (DEFAULT UNIVERSAL)
        montoBase = commercialRound(rawAmount / 1.18);
        igvCalculado = commercialRound(montoBase * 0.18);
        totalGeneral = rawAmount;
    }

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
        igv:                 igvCalculado,
        totalGeneral:        totalGeneral,

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

// ─────────────────────────────────────────────────────────────────────────────
// GENERADOR DE TOKEN DE TRANSACCIÓN
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Genera un token UUID v4 criptográficamente único para identificar de forma
 * inequívoca un intento de transacción de pago (adelanto o liquidación).
 *
 * REGLA DE ORO: La idempotencia se valida SOLO por igualdad exacta de token.
 * Jamás se comparan montos, porcentajes ni timestamps con tolerancia.
 *
 * Uso:
 *   const token = generateTransactionToken();
 *   // guarda el token en el ref y en el payload del ticket_cost
 *   // si el proceso se repite, el mismo token ya estará en DB → skip
 */
export function generateTransactionToken(): string {
    // Usar crypto.randomUUID() si está disponible (navegadores modernos y Node ≥ 19)
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }
    // Fallback manual para entornos legacy — sigue siendo UUID v4 válido
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
    });
}

/**
 * Sanitiza el objeto metadata antes de guardarlo en Supabase para evitar el gigantismo de payload redundante.
 * Elimina duplicados relacionales pesados (como objetos enteros de cliente, sede, gestora, costos y técnicos)
 * y limpia historiales redundantes, manteniendo únicamente referencias ligeras.
 */
export function sanitizeTicketMetadata(metadata: any): any {
    if (!metadata || typeof metadata !== 'object') return metadata;
    
    // Clonar para evitar mutar el estado en memoria
    const cleaned = { ...metadata };
    
    // 1. Eliminar objetos relacionales enteros que ya existen como claves foráneas
    delete cleaned.clients;
    delete cleaned.cliente;
    delete cleaned.branch_offices;
    delete cleaned.sede;
    delete cleaned.technicians;
    delete cleaned.tecnico;
    delete cleaned.gestoras;
    delete cleaned.gestora;
    
    // 2. Limpiar arrays pesados que crecen infinitamente en metadata
    delete cleaned.costos;
    delete cleaned.gastos;
    delete cleaned.historialPagosTecnico;
    delete cleaned.historialDepositos;
    
    return cleaned;
}
