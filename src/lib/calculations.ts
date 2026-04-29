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
        rawMetadata.costoManoObra,
        ticket.monto_acordado // Alias adicional
    ].map(v => toNum(v)).find(v => v > 0) || 0;
    
    const montoFinal = [
        ticket.ingresos_reales, // Priorizar ingresos reales confirmados
        ticket.monto_presupuesto,
        ticket.total_quoted_amount,
        ticket.montoFinal,
        ticket.montoTotalCotizado,
        rawMetadata.ingresos_reales,
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
    const validStates = ['pagado', 'adelanto', 'abonado', 'completado', 'autorizado', 'aprobado', 'transferido', 'confirmado', 'auditado', 'ejecutado'];

    const isConfirmed = (status: string | null | undefined) => {
        const st = (status || '').toLowerCase().trim();
        const valid = ['pagado', 'adelanto', 'abonado', 'confirmado', 'auditado', 'ejecutado', 'autorizado admin', 'autorizado', 'aprobado', 'transferido', 'completado'];
        return valid.some(v => st.includes(v));
    };

    const confirmedModernPayments = safeCosts.filter(c => isConfirmed(c.estado_pago || c.estado));

    const isFee = (cat: string) => {
        const c = (cat || '').toLowerCase();
        return feeKeywords.some(key => c.includes(key));
    };
    
    const isOp = (cat: string) => {
        const c = (cat || '').toLowerCase();
        return operationalKeywords.some(key => c.includes(key));
    };

    const modernFees = confirmedModernPayments.filter(c => isFee(c.categoria || c.concepto || ''));
    const modernOps = confirmedModernPayments.filter(c => isOp(c.categoria || c.concepto || ''));

    // NUEVO: Filtrar solicitudes pendientes (no pagadas aún)
    // Incluimos REQUIERE_APROBACION_ADMIN como pendiente para que el saldo baje preventivamente
    const pendingModernPayments = safeCosts.filter(c => {
        const st = (c.estado_pago || c.estado || '').toLowerCase();
        return st === 'pendiente' || st === 'requiere_aprobacion_admin';
    });

    const pendingFeesArr = pendingModernPayments.filter(c => isFee(c.categoria));

    const legacyPayments = (rawMetadata.historialPagosTécnico || rawMetadata.historialPagosTecnico || []);
    
    // Filtrar pagos duplicados entre Legacy y Modern (por ID)
    const filteredLegacy = legacyPayments.filter((lp: any) => 
        !safeCosts.some(mc => mc.id === lp.id)
    );

    const confirmedLegacyPayments = filteredLegacy.filter((p: any) => isConfirmed(p.estado));

    const legacyFees = confirmedLegacyPayments.filter((p: any) => isFee(p.tipo || p.concepto || ''));
    const legacyOps = confirmedLegacyPayments.filter((p: any) => isOp(p.tipo || p.concepto || ''));

    // 5. CÁLCULO DE TOTALES (Mano de Obra vs Operativos)
    const totalModernFeesSum = modernFees.reduce((acc: number, c: any) => acc + toNum(c.monto), 0);
    const totalLegacyFeesSum = legacyFees.reduce((acc: number, p: any) => acc + toNum(p.monto), 0);
    const totalModernOpsSum = modernOps.reduce((acc: number, c: any) => acc + toNum(c.monto), 0);
    const totalLegacyOpsSum = legacyOps.reduce((acc: number, p: any) => acc + toNum(p.monto), 0);

    // Suma global para el label "Total Transferido"
    const totalConfirmedSum = round2(totalModernFeesSum + totalLegacyFeesSum + totalModernOpsSum + totalLegacyOpsSum);
    // Suma solo de honorarios para el Saldo Pendiente de MO
    const totalFeesOnlySum = round2(totalModernFeesSum + totalLegacyFeesSum);

    const totalPendingFromCosts = pendingFeesArr.reduce((acc: number, c: any) => acc + toNum(c.monto), 0);

    // 6. RESULTADOS FINALES
    // El balance inmutable de la DB se usa como base, pero el calculado es el que manda en UI para reactividad
    const realBalance = Math.max(0, round2(pactedMO - totalFeesOnlySum));

    // Rentabilidad Dinámica (Soles)
    const totalInvestmentModern = safeCosts.reduce((acc: number, c: any) => {
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
        totalRequested: totalPendingFromCosts, // Requerido por main
        totalInProcess: totalPendingFromCosts,
        balance: realBalance,
        grossMargin: currentGrossMargin,
        marginPercent: currentMarginPercent,
        totalInvestment: totalInvestmentReal,
        pactedMO,
        pactedMat: 0,
        extraCosts: toNum(ticket.gastos_flujo_a || 0),
        paidModernArr: modernFees,
        paidModernPendingArr: pendingFeesArr, // Requerido por main
        legacyPaymentsFiltered: legacyFees,
        operationalCostsArr: [...modernOps, ...legacyOps]
    };
}
