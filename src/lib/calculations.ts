import { round2 } from "./formatters";

/**
 * Lógica Financiera Centralizada y Blindada para Tickets.
 * Esta función unifica el cálculo de pagos (Legacy + Moderno) y costos pactados.
 */
export function calculateTicketFinances(ticket: any, costs: any[] = []) {
    // 1. EXTRAER METADATA CON BLINDAJE (Prevenir errores de anidamiento)
    const rawMetadata = ticket.metadata || {};
    
    // 2. MONTOS PACTADOS (Mano de Obra y Total Cliente)
    // Buscamos el primer valor mayor a cero en todas las fuentes posibles
    const pactedMO = [
        ticket.monto_pactado_mo,
        ticket.labor_cost,
        ticket.costoManoObra,
        rawMetadata.monto_pactado_mo,
        rawMetadata.labor_cost,
        rawMetadata.costoManoObra
    ].map(v => round2(v || 0)).find(v => v > 0) || 0;
    
    const montoFinal = [
        ticket.total_quoted_amount,
        ticket.montoFinal,
        ticket.montoTotalCotizado,
        rawMetadata.total_quoted_amount,
        rawMetadata.montoFinal,
        rawMetadata.montoTotalCotizado
    ].map(v => round2(v || 0)).find(v => v > 0) || 0;

    const ingresosReales = round2(ticket.ingresos_reales || 0);
    const utilidadDB = round2(ticket.utilidad_neta || 0);
    const margenDB = parseFloat(ticket.margen_real || 0);

    // 3. CATEGORIZACIÓN DE COSTOS (Modernos - ticket_costs)
    const feeKeywords = ['mano de obra', 'adelanto', 'rescate', 'honorarios', 'pago', 'mo'];
    const operationalKeywords = ['materiales', 'insumos', 'viáticos', 'movilidad', 'logística', 'envíos', 'gasto'];

    const confirmedModernPayments = (costs || []).filter(c => {
        const st = (c.estado_pago || c.estado || '').toLowerCase();
        return ['pagado', 'adelanto', 'abonado', 'completado'].includes(st);
    });

    // Búsqueda flexible por palabras clave para evitar fallos por mayúsculas o textos extra
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

    // 4. UNIFICACIÓN CON PAGOS LEGACY (historialPagosTecnico)
    const legacyHistory = 
        (Array.isArray(ticket.historialPagosTecnico) ? ticket.historialPagosTecnico : null) ||
        (Array.isArray(ticket.historialPagosTécnico) ? ticket.historialPagosTécnico : null) ||
        (Array.isArray(rawMetadata.historialPagosTecnico) ? rawMetadata.historialPagosTecnico : null) ||
        (Array.isArray(rawMetadata.historialPagosTécnico) ? rawMetadata.historialPagosTécnico : null) ||
        [];

    const legacyPaymentsFiltered = legacyHistory.filter((h: any) => {
        const hMonto = round2(h.monto || 0);
        if (hMonto <= 0 || h.estado === 'anulado') return false;
        
        // Deduplicación por monto: Si ya existe en la tabla moderna
        const isMirror = modernFees.some((m: any) => Math.abs(hMonto - round2(m.monto || 0)) < 0.01);
        return !isMirror;
    });

    // 5. TOTALES CONSOLIDADOS
    const totalModernFeesSum = modernFees.reduce((acc, c) => acc + round2(c.monto || 0), 0);
    const totalLegacyFeesSum = legacyPaymentsFiltered.reduce((acc: number, h: any) => acc + round2(h.monto || 0), 0);
    const totalConfirmedSum = round2(totalModernFeesSum + totalLegacyFeesSum);

    // Pagos en trámite
    const totalInProcessSum = (costs || []).reduce((acc, c) => {
        const st = (c.estado_pago || c.estado || '').toLowerCase();
        if (isFee(c.categoria || '') && ['pendiente', 'requiere_aprobacion', 'requiere_aprobacion_admin'].includes(st)) {
            return acc + round2(c.monto || 0);
        }
        return acc;
    }, 0);

    // 6. BALANCE Y RENTABILIDAD
    const realBalance = Math.max(0, round2(pactedMO - totalConfirmedSum));

    // Rentabilidad Dinámica
    const totalInvestmentModern = (costs || []).reduce((acc, c) => {
        const st = (c.estado_pago || c.estado || '').toLowerCase();
        return (st !== 'anulado' && st !== 'rechazado') ? acc + round2(c.monto || 0) : acc;
    }, 0);
    const totalInvestmentReal = round2(totalInvestmentModern + totalLegacyFeesSum);

    // Si utilidadDB es 0, usamos el cálculo dinámico
    const currentGrossMargin = utilidadDB > 0 ? utilidadDB : Math.max(0, round2(montoFinal - totalInvestmentReal));
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
