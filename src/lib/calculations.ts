import { round2 } from "./formatters";

/**
 * Función auxiliar para parseo ultra-seguro de valores numéricos
 */
export const toNum = (val: any): number => {
    if (typeof val === 'number') return val;
    if (typeof val === 'string') {
        const clean = val.replace(/[^0-9.-]/g, '');
        return parseFloat(clean) || 0;
    }
    return 0;
};

// --- HELPERS DE CATEGORIZACIÓN ---

export const isConfirmedTicketCostStatus = (status: string | null | undefined) => {
    const rawSt = (status || '').toLowerCase().trim();
    const valid = [
        'pagado', 'adelanto', 'abonado', 'confirmado', 'auditado',
        'ejecutado', 'autorizado admin', 'autorizado', 'aprobado',
        'transferido', 'completado', 'depósito', 'deposito'
    ];
    return valid.some(v => rawSt.includes(v));
};

const isConfirmed = isConfirmedTicketCostStatus;

const isOperating = (item: any) => {
    const cat = (item.categoria || '').toLowerCase();
    const con = (item.concepto || item.tipo || '').toLowerCase();
    
    const operatingKeywords = [
        'compras', 'materiales', 'viáticos', 'viatico', 'logística', 
        'insumos', 'movilidad', 'pasajes', 'taxi', 'bus', 'transporte',
        'envíos', 'gasto operativo', 'compra mat', 'herramientas',
        'repuestos', 'insumo', 'peaje', 'estacionamiento', 'egreso', 'compras'
    ];
    
    // Si tiene un specialist_id y NO es el técnico principal del ticket (si se conoce),
    // o si el concepto indica explícitamente un pago a tercero/compra.
    const isExternalSpecialist = item.specialist_id && item.specialist_id !== item.main_technician_id;

    if (con.includes('adelanto operativo')) {
        return con.includes('materiales');
    }
    
    return operatingKeywords.some(key => cat.includes(key) || con.includes(key)) || isExternalSpecialist;
};

const isLabor = (item: any) => {
    if (isOperating(item)) return false; // Prioridad operativa/terceros

    const cat = (item.categoria || '').toLowerCase();
    const con = (item.concepto || item.tipo || '').toLowerCase();
    
    const laborKeywords = [
        'adelanto m.o', 'rescate financiero', 'pago mo', 
        'adelanto', 'rescate', 'pago_mo', 'liquidación final',
        'mano de obra', 'honorarios', 'pago técnico', 'pago_tecnico',
        'pago mo', 'pago mano de obra', 'mo pactada', 'pacted mo',
        'liquidación', 'liquidacion', 'saldo mo', 'mo final', 'laboral', 'técnico'
    ];
    
    return laborKeywords.some(key => cat.includes(key) || con.includes(key)) || con.includes('pago');
};

/**
 * Lógica Financiera V3 CORE ABSOLUTO para Tickets.
 * PRIORIDAD ABSOLUTA: ticket_costs (tabla única de verdad)
 * La metadata QUEDA COMPLETAMENTE IGNORADA para cálculos financieros.
 */
export function calculateTicketFinances(ticket: any, costs: any[] = []) {
    // ★ V3 CORE: Ignorar metadata completamente para cálculos financieros
    // La única fuente de verdad es ticket_costs
    const safeCosts = Array.isArray(costs) ? costs : [];

    // 1. MONTOS PACTADOS - Desde columnas directas del ticket (no metadata)
    const pactedMO = [
        ticket.labor_cost,
        ticket.monto_pactado_mo,
        ticket.costoManoObra,
        ticket.monto_acordado
    ].map(v => toNum(v)).find(v => v > 0) || 0;
    
    const montoFinal = [
        ticket.ingresos_reales,
        ticket.monto_presupuesto,
        ticket.total_quoted_amount,
        ticket.montoFinal,
        ticket.montoTotalCotizado
    ].map(v => toNum(v)).find(v => v > 0) || 0;
    
    // 处理IGV si existe
    const hasIGV = ticket.montoIGV > 0 || ticket.igv > 0;
    const igvMonto = toNum(ticket.montoIGV || ticket.igv || 0);
    const montoBase = hasIGV && igvMonto > 0 ? round2(montoFinal - igvMonto) : montoFinal;

    // 2. FILTRADO Y CATEGORIZACIÓN - Solo desde ticket_costs
    const confirmedModern = safeCosts.filter(c => isConfirmed(c.estado_pago || c.estado));
    const pendingModern = safeCosts.filter(c => {
        const st = (c.estado_pago || c.estado || '').toLowerCase();
        return st === 'pendiente' || st === 'requiere_aprobacion_admin';
    });

    // ─────────────────────────────────────────────────────────────────────────────
    // V3 CORE PURO: Solo ticket_costs importa para cálculos
    // No hay legacy - no se lee metadata
    // ─────────────────────────────────────────────────────────────────────────────
    
    const normalizePayment = (p: any) => ({
        ...p,
        monto: toNum(p.monto || p.amount || 0),
        fecha: p.fecha_pago || p.fecha || p.date || p.created_at || new Date().toISOString(),
    });

    // Solo costos confirmados de ticket_costs
    const modernLabor = confirmedModern.map(normalizePayment).filter(isLabor);
    const modernOp = confirmedModern.map(normalizePayment).filter(isOperating);

    const totalLaborConfirmed = round2(
        modernLabor.reduce((acc, c) => acc + c.monto, 0)
    );

    const totalOpConfirmed = round2(
        modernOp.reduce((acc, c) => acc + c.monto, 0)
    );

    const netLaborBalance = Math.max(0, round2(pactedMO - totalLaborConfirmed));
    
    // V3 CORE: rentabilidad real = ingresos totales - pagos confirmados en ticket_costs.
    const realProfitability = round2(montoBase - totalLaborConfirmed - totalOpConfirmed);
    const margenReal = montoBase > 0 ? round2((realProfitability / montoBase) * 100) : 0;

    const pendingLaborItems = pendingModern.map(normalizePayment).filter(isLabor);
    const pendingOpItems = pendingModern.map(normalizePayment).filter(isOperating);
    const totalOpPending = round2(pendingOpItems.reduce((acc, c) => acc + c.monto, 0));
    const totalLaborPending = round2(pendingLaborItems.reduce((acc, c) => acc + c.monto, 0));
    const laborRequested = totalLaborConfirmed + totalLaborPending;

    // 🛡️ RESERVA: Todo lo que es deuda proyectada o pendiente de aprobación.
    const totalReserva = round2(netLaborBalance + totalLaborPending + totalOpPending);

    return {
        pactedMO,
        totalVenta: montoBase,
        totalLaborConfirmed,
        totalOpConfirmed,
        laborRequested, // Requerido por TicketWindow
        totalLaborPending,
        netProfit: realProfitability, // Alias
        profitMargin: margenReal,    // Alias
        netIncome: montoBase,        // Alias
        laborPactado: pactedMO,      // Alias
        laborExpenses: totalLaborConfirmed, // Alias
        totalPactedDebt: pactedMO,   // Alias
        operatingExpenses: totalOpConfirmed, // Alias para compatibilidad V2
        totalExpenses: totalLaborConfirmed + totalOpConfirmed, // Alias para compatibilidad V2
        netLaborBalance,
        balance: netLaborBalance, // Alias para compatibilidad V2
        realProfitability,
        margenReal,
        totalReserva,
        laborItems: modernLabor,
        operatingItems: modernOp,
        pendingCosts: pendingModern,
        pendingLaborItems,
        pendingOpItems,
        totalOpPending,
        totalRequested: totalLaborConfirmed + totalOpConfirmed + totalOpPending
    };
}
