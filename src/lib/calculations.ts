import { round2 } from "./formatters";

/**
 * Lógica Financiera Centralizada y Blindada para Tickets.
 * Esta función unifica el cálculo de pagos (Legacy + Moderno) y costos pactados.
 */
export function calculateTicketFinances(ticket: any, costs: any[] = []) {
    const ticketData = ticket.metadata || ticket;
    
    // 1. Intentar obtener valores pre-calculados desde el backend
    let saldoDB = parseFloat(ticket.saldo_tecnico || ticketData.saldo_tecnico || 0);
    let margenDB = parseFloat(ticket.margen_real || ticketData.margen_real || 0);
    let utilidadDB = parseFloat(ticket.utilidad_neta || ticketData.utilidad_neta || 0);
    let inversionDB = parseFloat(ticket.total_costs_agg || ticketData.total_costs_agg || 0);
    let ingresosDB = parseFloat(ticket.ingresos_reales || ticketData.ingresos_reales || 0);
    let pactedMO = parseFloat(ticketData.costoManoObra || ticket.monto_pactado_mo || ticketData.monto_pactado_mo || ticketData.labor_cost || ticket.labor_cost || 0);
    let extraCosts = parseFloat(ticket.gastos_flujo_a || ticketData.gastos_flujo_a || 0);
    let adelantosDB = parseFloat(ticket.adelantos_flujo_b || ticketData.adelantos_flujo_b || 0);
    
    // ✅ FALLBACK: Si los valores del backend están en cero pero hay costs, calcular desde costos
    const hasCosts = costs && costs.length > 0;
    
    // Si el margen está en cero pero hay presupuesto y costos, calcular localmente
    const presupuesto = parseFloat(ticket.total_quoted_amount || ticketData.total_quoted_amount || ticketData.montoFinal || 0);
    if (hasCosts && (margenDB === 0 || utilidadDB === 0) && presupuesto > 0) {
        // Calcular depuis costs
        const totalCost = costs.reduce((sum, c) => sum + (parseFloat(c.monto) || 0), 0);
        if (totalCost > 0) {
            inversionDB = totalCost;
            utilidadDB = round2(presupuesto - totalCost);
            margenDB = presupuesto > 0 ? round2((utilidadDB / presupuesto) * 100) : 0;
        }
    }
    
    // ✅ FIX 2026-04-28: SEPARAR SOLICITADO DE PAGADO
    // Solo contar como "Pagado/Confirmado" los costos con estado explícito 'pagado' o 'adelanto'
    const feeCategories = [
        'mano de obra', 'Mano de Obra', 'MANO DE OBRA',
        'adelanto', 'Adelanto', 'adelanto operativo', 'Adelanto Operativo',
        'rescate financiero', 'Rescate Financiero', 'rescate', 'Rescate',
        'honorarios', 'Honorarios'
    ].map(s => s.toLowerCase()); // Todas a minúsculas para comparar
    
    const technicianFeesArr = (costs || []).filter(c => {
        const catLower = (c.categoria || '').toLowerCase();
        const estadoLower = (c.estado_pago || '').toLowerCase();
        return feeCategories.includes(catLower) && 
               c.estado_pago !== 'ANULADO' && 
               c.estado_pago !== 'RECHAZADO';
    });
    
    // ✅ NUEVO: Filtrar SOLO los pagos confirmados (para显示 separado)
    const confirmedFeesArr = technicianFeesArr.filter(c => {
        const estado = (c.estado_pago || '').toLowerCase();
        return estado === 'pagado' || estado === 'adelanto' || estado === 'abonado';
    });
    
    // ✅ NUEVO: Filtrar solicitudes pendientes (no pagadas aún)
    const pendingFeesArr = technicianFeesArr.filter(c => {
        const estado = (c.estado_pago || '').toLowerCase();
        return estado === 'pendiente' || estado === 'requiere_aprobacion_admin' || estado === 'solicitado';
    });
    
    // Calcular suma de confirmados (más confiable que columna del backend)
    const totalPaidFromCosts = confirmedFeesArr.reduce((sum, c) => sum + (parseFloat(c.monto) || 0), 0);
    
    // Calcular suma de solicitados (pendientes)
    const totalPendingFromCosts = pendingFeesArr.reduce((sum, c) => sum + (parseFloat(c.monto) || 0), 0);
    
    // Fallback: si no hay costs, usar columna del backend
    const totalPaidCalculated = totalPaidFromCosts > 0 ? totalPaidFromCosts : (hasCosts ? 0 : adelantosDB);

    // Categorizar costos para visualización (solo lectura)
    const operationalCategories = ['materiales', 'insumos', 'viáticos', 'movilidad', 'logística', 'envíos', 'viáticos / movilidad'];
    const operationalCostsArr = (costs || []).filter(c => {
        const cat = (c.categoria || '').toLowerCase();
        return operationalCategories.includes(cat) && c.estado_pago !== 'ANULADO' && c.estado_pago !== 'RECHAZADO';
    });

    return {
        totalPactedDebt: pactedMO, // El monto base pactado
        totalPaidCalculated, // ✅ Ahorasubesolo confirmados
        totalConfirmed: totalPaidCalculated,
        totalRequested: totalPendingFromCosts, // ✅ NUEVO:Total de solicitudes pendientes
        totalInProcess: 0,
        balance: saldoDB, // Saldo inmutable desde la BD
        grossMargin: utilidadDB,
        marginPercent: margenDB,
        totalInvestment: inversionDB,
        pactedMO,
        pactedMat: 0,
        extraCosts,
        paidModernArr: confirmedFeesArr, // ✅ Ahorasolo confirmados
        paidModernPendingArr: pendingFeesArr, // ✅ NUEVO: Array de solicitados pendientes
        legacyPaymentsFiltered: [],
        operationalCostsArr
    };
}
