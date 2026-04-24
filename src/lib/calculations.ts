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

    return {
        totalPactedDebt: pactedMO, // El monto base pactado
        totalPaidCalculated: parseFloat(ticket.adelantos_flujo_b || 0),
        totalConfirmed: parseFloat(ticket.adelantos_flujo_b || 0),
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
