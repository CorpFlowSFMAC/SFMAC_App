import { round2 } from "./formatters";

/**
 * Lógica Financiera Centralizada y Blindada para Tickets.
 * Esta función unifica el cálculo de pagos (Legacy + Moderno) y costos pactados.
 */
export function calculateTicketFinances(ticket: any, costs: any[] = []) {
    // 1. EXTRAER METADATA CON BLINDAJE (Prevenir errores de anidamiento)
    const rawMetadata = ticket.metadata || {};
    // El objeto 'ticket' puede ser el registro de la DB o el objeto normalizado.
    // Buscamos campos en ambos niveles para máxima compatibilidad.
    
    // 2. MONTOS PACTADOS (Mano de Obra y Total Cliente)
    const pactedMO = round2(
        ticket.monto_pactado_mo || 
        ticket.labor_cost || 
        ticket.costoManoObra || 
        rawMetadata.labor_cost || 
        rawMetadata.costoManoObra || 
        0
    );
    
    const montoFinal = round2(
        ticket.total_quoted_amount || 
        ticket.montoFinal || 
        ticket.montoTotalCotizado || 
        rawMetadata.montoFinal || 
        rawMetadata.montoTotalCotizado || 
        0
    );

    const ingresosReales = round2(ticket.ingresos_reales || 0);
    const utilidadDB = round2(ticket.utilidad_neta || 0);
    const margenDB = parseFloat(ticket.margen_real || 0);

    // 3. CATEGORIZACIÓN DE COSTOS (Modernos - ticket_costs)
    const feeCategories = ['mano de obra', 'adelanto', 'adelanto operativo', 'rescate financiero', 'rescate', 'honorarios'];
    const operationalCategories = ['materiales', 'insumos', 'viáticos', 'movilidad', 'logística', 'envíos', 'viáticos / movilidad'];

    const confirmedModernPayments = (costs || []).filter(c => {
        const st = (c.estado_pago || c.estado || '').toLowerCase();
        return ['pagado', 'adelanto', 'abonado', 'completado'].includes(st);
    });

    const modernFees = confirmedModernPayments.filter(c => feeCategories.includes((c.categoria || '').toLowerCase()));
    const modernOps = confirmedModernPayments.filter(c => operationalCategories.includes((c.categoria || '').toLowerCase()));

    // 4. UNIFICACIÓN CON PAGOS LEGACY (historialPagosTecnico)
    // Buscamos el historial en todas las ubicaciones posibles
    const legacyHistory = 
        (Array.isArray(ticket.historialPagosTecnico) ? ticket.historialPagosTecnico : null) ||
        (Array.isArray(ticket.historialPagosTécnico) ? ticket.historialPagosTécnico : null) ||
        (Array.isArray(rawMetadata.historialPagosTecnico) ? rawMetadata.historialPagosTecnico : null) ||
        (Array.isArray(rawMetadata.historialPagosTécnico) ? rawMetadata.historialPagosTécnico : null) ||
        [];

    const legacyPaymentsFiltered = legacyHistory.filter((h: any) => {
        const hMonto = round2(h.monto || 0);
        if (hMonto <= 0 || h.estado === 'anulado') return false;
        
        // Deduplicación: Si ya existe en la tabla moderna por monto y fecha aproximada
        const isMirror = modernFees.some((m: any) => {
            const mMonto = round2(m.monto || 0);
            return Math.abs(hMonto - mMonto) < 0.01;
        });
        return !isMirror;
    });

    // 5. TOTALES CONSOLIDADOS
    const totalModernFeesSum = modernFees.reduce((acc, c) => acc + round2(c.monto || 0), 0);
    const totalLegacyFeesSum = legacyPaymentsFiltered.reduce((acc: number, h: any) => acc + round2(h.monto || 0), 0);
    
    // Total que el técnico YA recibió (debe restar del saldo MO)
    const totalConfirmedSum = round2(totalModernFeesSum + totalLegacyFeesSum);

    // Pagos en trámite (Pendientes en Tesorería)
    const totalInProcessSum = (costs || []).reduce((acc, c) => {
        const st = (c.estado_pago || c.estado || '').toLowerCase();
        if (feeCategories.includes((c.categoria || '').toLowerCase()) && 
            ['pendiente', 'requiere_aprobacion', 'requiere_aprobacion_admin'].includes(st)) {
            return acc + round2(c.monto || 0);
        }
        return acc;
    }, 0);

    // 6. BALANCE Y RENTABILIDAD
    const realBalance = Math.max(0, round2(pactedMO - totalConfirmedSum));

    // Rentabilidad Dinámica (Soles)
    // Inversión = Todo lo pagado (Materiales + Mano de Obra)
    const totalInvestmentModern = (costs || []).reduce((acc, c) => {
        const st = (c.estado_pago || c.estado || '').toLowerCase();
        return (st !== 'anulado' && st !== 'rechazado') ? acc + round2(c.monto || 0) : acc;
    }, 0);
    const totalInvestmentReal = round2(totalInvestmentModern + totalLegacyFeesSum);

    // Si utilidadDB es 0, calculamos una utilidad "en vivo" basada en el monto final
    const currentGrossMargin = utilidadDB > 0 ? utilidadDB : Math.max(0, round2(montoFinal - totalInvestmentReal));
    
    // Margen en porcentaje
    const currentMarginPercent = margenDB > 0 ? (margenDB * 100) : (montoFinal > 0 ? (currentGrossMargin / montoFinal) * 100 : 0);

    return {
        totalPactedDebt: pactedMO,
        totalPaidCalculated: totalConfirmedSum,
        totalConfirmed: totalConfirmedSum,
        totalInProcess: totalInProcessSum,
        balance: realBalance,
        grossMargin: currentGrossMargin,
        marginPercent: currentMarginPercent,
        totalInvestment: totalInvestmentReal,
        pactedMO,
        pactedMat: 0,
        extraCosts: round2(ticket.gastos_flujo_a || 0),
        paidModernArr: modernFees,
        legacyPaymentsFiltered,
        operationalCostsArr: modernOps
    };
}
