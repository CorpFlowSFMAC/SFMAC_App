import { round2 } from "./formatters";

/**
 * Lógica Financiera Centralizada y Blindada para Tickets.
 * Esta función unifica el cálculo de pagos (Legacy + Moderno) y costos pactados.
 */
export function calculateTicketFinances(ticket: any, costs: any[] = []) {
    // 1. NORMALIZACIÓN DE METADATA
    const rawMetadata = ticket.metadata || {};
    const safeCosts = Array.isArray(costs) ? costs : [];
    
    // Función auxiliar para parseo ultra-seguro
    const toNum = (val: any) => {
        if (typeof val === 'number') return val;
        if (typeof val === 'string') {
            const clean = val.replace(/[^0-9.-]/g, '');
            return parseFloat(clean) || 0;
        }
        return 0;
    };

    // 2. DETECCIÓN DE MONTOS PACTADOS (Blindaje contra nulos y ceros)
    const pactedMO = [
        ticket.monto_pactado_mo,
        ticket.labor_cost,
        ticket.costoManoObra,
        rawMetadata.monto_pactado_mo,
        rawMetadata.labor_cost,
        rawMetadata.costoManoObra
    ].map(v => toNum(v)).find(v => v > 0) || 0;
    
    const montoFinal = [
        ticket.total_quoted_amount,
        ticket.montoFinal,
        ticket.montoTotalCotizado,
        rawMetadata.total_quoted_amount,
        rawMetadata.montoFinal,
        rawMetadata.montoTotalCotizado
    ].map(v => toNum(v)).find(v => v > 0) || 0;

    const ingresosReales = toNum(ticket.ingresos_reales || 0);
    const utilidadDB = toNum(ticket.utilidad_neta || 0);
    const margenDB = toNum(ticket.margen_real || 0);

    // 3. CATEGORIZACIÓN Y ESTADOS (Expansión de estados válidos)
    const feeKeywords = ['mano de obra', 'adelanto', 'rescate', 'honorarios', 'pago', 'mo', 'comisión'];
    const operationalKeywords = ['materiales', 'insumos', 'viáticos', 'movilidad', 'logística', 'envíos', 'gasto', 'compra'];
    
    // Estados que consideramos como "dinero ya entregado o por entregar confirmado"
    const validStates = ['pagado', 'adelanto', 'abonado', 'completado', 'autorizado', 'aprobado', 'transferido', 'confirmado'];

    const confirmedModernPayments = safeCosts.filter(c => {
        const st = (c.estado_pago || c.estado || '').toLowerCase();
        return validStates.some(v => st.includes(v));
    });

    const isFee = (cat: string) => {
        const c = cat.toLowerCase();
        return feeKeywords.some(key => c.includes(key));
    };
    
    const isOp = (cat: string) => {
        const c = cat.toLowerCase();
        return operationalKeywords.some(key => c.includes(key));
    };

    const modernFees = confirmedModernPayments.filter(c => isFee(c.categoria || ''));
    const modernOps = confirmedModernPayments.filter(c => isOp(c.categoria || ''));

    // 4. PAGOS LEGACY (Deduplicación mejorada)
    const legacyHistory = 
        (Array.isArray(ticket.historialPagosTecnico) ? ticket.historialPagosTecnico : null) ||
        (Array.isArray(ticket.historialPagosTécnico) ? ticket.historialPagosTécnico : null) ||
        (Array.isArray(rawMetadata.historialPagosTecnico) ? rawMetadata.historialPagosTecnico : null) ||
        [];

    const legacyPaymentsFiltered = legacyHistory.filter((h: any) => {
        const hMonto = toNum(h.monto);
        if (hMonto <= 0 || h.estado === 'anulado') return false;
        // No contar si ya está en modernFees
        return !modernFees.some(m => Math.abs(hMonto - toNum(m.monto)) < 0.01);
    });

    // 5. CÁLCULO DE TOTALES
    const totalModernFeesSum = modernFees.reduce((acc, c) => acc + toNum(c.monto), 0);
    const totalLegacyFeesSum = legacyPaymentsFiltered.reduce((acc: number, h: any) => acc + toNum(h.monto), 0);
    const totalConfirmedSum = round2(totalModernFeesSum + totalLegacyFeesSum);

    const totalInProcessSum = safeCosts.reduce((acc, c) => {
        const st = (c.estado_pago || c.estado || '').toLowerCase();
        if (isFee(c.categoria || '') && (st.includes('pendiente') || st.includes('requiere'))) {
            return acc + toNum(c.monto);
        }
        return acc;
    }, 0);

    // 6. RESULTADOS FINALES
    const realBalance = Math.max(0, round2(pactedMO - totalConfirmedSum));

    // Rentabilidad Dinámica (Soles)
    const totalInvestmentModern = safeCosts.reduce((acc, c) => {
        const st = (c.estado_pago || c.estado || '').toLowerCase();
        return (!st.includes('anulado') && !st.includes('rechazado')) ? acc + toNum(c.monto) : acc;
    }, 0);
    const totalInvestmentReal = round2(totalInvestmentModern + totalLegacyFeesSum);

    // Si el backend no tiene utilidad, calculamos dinámicamente
    const currentGrossMargin = (utilidadDB > 0) ? utilidadDB : Math.max(0, round2(montoFinal - totalInvestmentReal));
    const currentMarginPercent = (margenDB > 0) ? (margenDB * 100) : (montoFinal > 0 ? (currentGrossMargin / montoFinal) * 100 : 0);

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
        extraCosts: toNum(ticket.gastos_flujo_a || 0),
        paidModernArr: modernFees,
        legacyPaymentsFiltered,
        operationalCostsArr: modernOps
    };
}
