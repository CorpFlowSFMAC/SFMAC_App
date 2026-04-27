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
    const pactedMO = parseFloat(ticket.monto_pactado_mo || ticketData.labor_cost || ticketData.costoManoObra || 0);
    const extraCosts = parseFloat(ticket.gastos_flujo_a || 0);
    
    // ✅ FIX 2026-04-27: Calcular pagos directamente desde costs
    const feeCategories = ['mano de obra', 'adelanto', 'adelanto operativo', 'rescate financiero', 'rescate', 'honorarios'];
    const technicianFeesArr = (costs || []).filter(c => {
        const match = feeCategories.includes((c.categoria || '').toLowerCase()) && c.estado_pago !== 'ANULADO' && c.estado_pago !== 'RECHAZADO';
        return match;
    });
    
    // Calcular suma directa de costs (más confiable que columna del backend)
    const totalPaidFromCosts = technicianFeesArr.reduce((sum, c) => sum + (parseFloat(c.monto) || 0), 0);
    console.log("[DEBUG calculateTicketFinances] Costs:", costs?.length, "Filtered:", technicianFeesArr.length, "Sum:", totalPaidFromCosts);
    
    // Fallback: si no hay costs, usar columna del backend
    const totalPaidCalculated = totalPaidFromCosts > 0 ? totalPaidFromCosts : parseFloat(ticket.adelantos_flujo_b || 0);

    // Categorizar costos para visualización (solo lectura)
    const operationalCategories = ['materiales', 'insumos', 'viáticos', 'movilidad', 'logística', 'envíos', 'viáticos / movilidad'];
    const operationalCostsArr = (costs || []).filter(c => {
        const cat = (c.categoria || '').toLowerCase();
        return operationalCategories.includes(cat) && c.estado_pago !== 'ANULADO' && c.estado_pago !== 'RECHAZADO';
    });

    return {
        totalPactedDebt: pactedMO, // El monto base pactado
        totalPaidCalculated, // ✅ Ahora calcula desde costs directamente
        totalConfirmed: totalPaidCalculated,
        totalInProcess: 0,
        balance: saldoDB, // Saldo inmutable desde la BD
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
