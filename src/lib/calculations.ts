import { round2 } from "./formatters";

/**
 * Lógica Financiera Centralizada y Blindada para Tickets.
 * Esta función unifica el cálculo de pagos (Legacy + Moderno) y costos pactados.
 */
export function calculateTicketFinances(ticket: any, costs: any[] = []) {
    const ticketData = ticket.metadata || ticket;
    
    // 1. REGLA INMUTABLE: Los valores vienen pre-calculados desde el backend (vw_ticket_financials)
    const saldoDB = parseFloat(ticket.saldo_tecnico || 0);
    const margenDB = parseFloat(ticket.margen_real || 0) * 100;
    const utilidadDB = parseFloat(ticket.utilidad_neta || 0);
    const inversionDB = parseFloat(ticket.total_costs_agg || 0);
    const ingresosDB = parseFloat(ticket.ingresos_reales || 0);
    // CRITICAL FIX: Read pactedMO from root ticket fields first (labor_cost, costoManoObra are
    // mapped to the root by normalizeTicket), then fall back to metadata. This prevents S/0.00
    // when ticketData === ticket.metadata (which lacks the root-level DB columns).
    const pactedMO = parseFloat(
        ticket.monto_pactado_mo ||
        ticket.labor_cost ||
        ticket.costoManoObra ||
        ticketData.labor_cost ||
        ticketData.costoManoObra ||
        0
    );
    const extraCosts = parseFloat(ticket.gastos_flujo_a || 0);
    
    // Categorizar costos para visualización (solo lectura)
    const operationalCategories = ['materiales', 'insumos', 'viáticos', 'movilidad', 'logística', 'envíos', 'viáticos / movilidad'];
    const operationalCostsArr = (costs || []).filter(c => {
        const cat = (c.categoria || '').toLowerCase();
        return operationalCategories.includes(cat) && c.estado_pago !== 'ANULADO' && c.estado_pago !== 'RECHAZADO';
    });

    const feeCategories = ['mano de obra', 'adelanto', 'adelanto operativo', 'rescate financiero', 'rescate', 'honorarios'];
    const technicianFeesArr = (costs || []).filter(c => {
        const cat = (c.categoria || '').toLowerCase();
        return feeCategories.includes(cat) && c.estado_pago !== 'ANULADO' && c.estado_pago !== 'RECHAZADO';
    });

    // 2. CÁLCULO EN TIEMPO REAL (Reactividad inmediata ante nuevos registros)
    const confirmedFees = technicianFeesArr.reduce((sum, c) => {
        const st = (c.estado_pago || c.estado || '').toLowerCase();
        // Solo sumamos lo efectivamente pagado/abonado
        if (['pagado', 'adelanto', 'abonado', 'completado'].includes(st)) {
            return sum + round2(parseFloat(c.monto || 0));
        }
        return sum;
    }, 0);

    // El total confirmado es lo mayor entre lo que dice la DB (vía view) y lo que tenemos localmente en el array de costos
    const totalConfirmedSum = Math.max(parseFloat(ticket.adelantos_flujo_b || 0), confirmedFees);
    const totalInProcessSum = technicianFeesArr.reduce((sum, c) => {
        const st = (c.estado_pago || c.estado || '').toLowerCase();
        if (['pendiente', 'requiere_aprobacion', 'requiere_aprobacion_admin'].includes(st)) {
            return sum + round2(parseFloat(c.monto || 0));
        }
        return sum;
    }, 0);

    // El saldo real es el pactado menos lo que ya se pagó (confirmado)
    const realBalance = Math.max(0, round2(pactedMO - totalConfirmedSum));

    return {
        totalPactedDebt: pactedMO,
        totalPaidCalculated: totalConfirmedSum,
        totalConfirmed: totalConfirmedSum,
        totalInProcess: totalInProcessSum,
        balance: realBalance, 
        grossMargin: utilidadDB,
        marginPercent: margenDB,
        totalInvestment: inversionDB,
        pactedMO,
        pactedMat: 0,
        extraCosts,
        paidModernArr: technicianFeesArr, 
        legacyPaymentsFiltered: [],
        operationalCostsArr
    };
}
