import { round2 } from "./formatters";

/**
 * Lógica Financiera Centralizada y Blindada para Tickets.
 * Esta función unifica el cálculo de pagos (Legacy + Moderno) y costos pactados.
 */
export function calculateTicketFinances(ticket: any, costs: any[] = []) {
    const ticketData = ticket.metadata || ticket;
    
    // 1. REGLA INMUTABLE: Los valores vienen pre-calculados desde el backend (vw_ticket_financials)
    const saldoDB = parseFloat(ticket.saldo_tecnico || 0);
    const margenDB = parseFloat(ticket.margen_real || 0);
    const utilidadDB = parseFloat(ticket.utilidad_neta || 0);
    const inversionDB = parseFloat(ticket.total_costs_agg || 0);
    const ingresosDB = parseFloat(ticket.ingresos_reales || 0);
    
    const pactedMO = parseFloat(
        ticket.monto_pactado_mo ||
        ticket.labor_cost ||
        ticket.costoManoObra ||
        ticketData.labor_cost ||
        ticketData.costoManoObra ||
        0
    );
    const extraCosts = parseFloat(ticket.gastos_flujo_a || 0);
    const montoFinal = parseFloat(ticket.total_quoted_amount || ticket.montoFinal || ticketData.montoFinal || 0);
    
    // 2. UNIFICACIÓN DE PAGOS (Modernos + Legacy)
    // Fuente Moderna (ticket_costs)
    const operationalCategories = ['materiales', 'insumos', 'viáticos', 'movilidad', 'logística', 'envíos', 'viáticos / movilidad'];
    const feeCategories = ['mano de obra', 'adelanto', 'adelanto operativo', 'rescate financiero', 'rescate', 'honorarios'];

    const paidModernArr = (costs || []).filter(c => {
        const st = (c.estado_pago || c.estado || '').toLowerCase();
        return ['pagado', 'adelanto', 'abonado', 'completado'].includes(st);
    });

    const technicianFeesArr = paidModernArr.filter(c => {
        const cat = (c.categoria || '').toLowerCase();
        return feeCategories.includes(cat);
    });

    const operationalCostsArr = paidModernArr.filter(c => {
        const cat = (c.categoria || '').toLowerCase();
        return operationalCategories.includes(cat);
    });

    // Fuente Legacy (historialPagosTecnico)
    const legacyHistory = ticketData.historialPagosTecnico || ticketData.historialPagosTécnico || [];
    const legacyPaymentsFiltered = legacyHistory.filter((h: any) => {
        const hMonto = round2(parseFloat(h.monto || 0));
        if (hMonto <= 0 || h.estado === 'anulado') return false;
        
        // Evitar duplicados: Si ya existe en modern (por ID o por monto/fecha aproximada)
        const isAlreadyInModern = technicianFeesArr.some((m: any) => {
            const mMonto = round2(parseFloat(m.monto || 0));
            const hTipo = (h.tipo || '').toLowerCase();
            const mCat = (m.categoria || '').toLowerCase();
            const isSameAmount = Math.abs(hMonto - mMonto) < 0.01;
            const isSameType = hTipo === mCat || hTipo === `gasto: ${mCat}` || (hTipo === 'adelanto' && mCat === 'rescate financiero');
            return isSameAmount && isSameType;
        });
        return !isAlreadyInModern;
    });

    // Sumar confirmados
    const confirmedModernFees = technicianFeesArr.reduce((sum, c) => sum + round2(parseFloat(c.monto || 0)), 0);
    const confirmedLegacyFees = legacyPaymentsFiltered.reduce((sum: number, h: any) => sum + round2(parseFloat(h.monto || 0)), 0);
    
    const totalConfirmedSum = round2(confirmedModernFees + confirmedLegacyFees);
    
    // Pagos en proceso (Pendientes)
    const totalInProcessSum = (costs || []).reduce((sum, c) => {
        const st = (c.estado_pago || c.estado || '').toLowerCase();
        const cat = (c.categoria || '').toLowerCase();
        if (feeCategories.includes(cat) && ['pendiente', 'requiere_aprobacion', 'requiere_aprobacion_admin'].includes(st)) {
            return sum + round2(parseFloat(c.monto || 0));
        }
        return sum;
    }, 0);

    // 3. CÁLCULO DE SALDO Y RENTABILIDAD
    const realBalance = Math.max(0, round2(pactedMO - totalConfirmedSum));
    
    // Rentabilidad Dinámica (Frontend) para casos donde el backend no ha actualizado la vista
    // Rentabilidad = (Ingresos - Gastos Totales)
    const totalModernCosts = (costs || []).reduce((sum, c) => {
        const st = (c.estado_pago || c.estado || '').toLowerCase();
        if (st !== 'anulado' && st !== 'rechazado') {
            return sum + round2(parseFloat(c.monto || 0));
        }
        return sum;
    }, 0);
    
    // Usar la utilidad del backend si existe (>0), si no, calcularla
    const calculatedUtilidad = Math.max(utilidadDB, round2(montoFinal - totalModernCosts - confirmedLegacyFees));
    const calculatedMargenPercent = ingresosDB > 0 ? (calculatedUtilidad / ingresosDB) * 100 : (montoFinal > 0 ? (calculatedUtilidad / montoFinal) * 100 : 0);

    return {
        totalPactedDebt: pactedMO,
        totalPaidCalculated: totalConfirmedSum,
        totalConfirmed: totalConfirmedSum,
        totalInProcess: totalInProcessSum,
        balance: realBalance, 
        grossMargin: calculatedUtilidad,
        marginPercent: margenDB > 0 ? margenDB * 100 : calculatedMargenPercent,
        totalInvestment: Math.max(inversionDB, totalModernCosts + confirmedLegacyFees),
        pactedMO,
        pactedMat: 0,
        extraCosts,
        paidModernArr: technicianFeesArr, 
        legacyPaymentsFiltered,
        operationalCostsArr
    };
}
