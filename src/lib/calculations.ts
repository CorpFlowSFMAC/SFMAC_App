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
    // ── Familia FEES: Mano de obra, adelantos, rescates (UNIFICADOS) ──────────
    const feeKeywords = [
        'mano de obra', 'adelanto', 'pago_mo', 'pago mo',
        'rescate', 'rescate adelanto', 'rescate m.o',
        'bono', 'honorarios', 'pago', 'mo', 'comisión'
    ];
    const operationalKeywords = ['materiales', 'insumos', 'viáticos', 'movilidad', 'logística', 'envíos', 'gasto', 'compra'];
    
    // ✅ NUEVO: Función para verificar si un pago debe ser excluido (ANULADO, RECHAZADO)
    const isExcluded = (status: string | null | undefined) => {
        const rawSt = (status || '').toLowerCase().trim();
        return rawSt === 'anulado' || rawSt === 'rechazado';
    };
    
    const isConfirmed = (status: string | null | undefined) => {
        const rawSt = (status || '').toLowerCase().trim();
        // Soportar estados compuestos como "Autorizado Admin; Adelanto" o "Autorizado Admin: Adelanto"
        const parts = rawSt.split(/[;:,]+/).map(s => s.trim());
        const valid = [
            'pagado', 'adelanto', 'abonado', 'confirmado', 'auditado',
            'ejecutado', 'autorizado admin', 'autorizado', 'aprobado',
            'transferido', 'completado'
        ];
        return parts.some(part => valid.some(v => part.includes(v)));
    };

    // ✅ CORRECCIÓN: Excluir pagos anulados/rechazados del conteo
    const confirmedModernPayments = safeCosts.filter(c => isConfirmed(c.estado_pago || c.estado) && !isExcluded(c.estado_pago || c.estado));

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
    const pendingModernPayments = safeCosts.filter(c => {
        const st = (c.estado_pago || c.estado || '').toLowerCase();
        return st === 'pendiente' || st === 'requiere_aprobacion_admin';
    });

    const pendingFeesArr = pendingModernPayments.filter(c => isFee(c.categoria));

    const arrs = [
        rawMetadata.historialPagosTécnico, 
        rawMetadata.historialPagosTecnico, 
        ticket.historialPagosTécnico, 
        ticket.historialPagosTecnico
    ];
    let legacyPayments: any[] = [];
    for (const arr of arrs) {
        if (Array.isArray(arr) && arr.length > legacyPayments.length) {
            legacyPayments = arr;
        }
    }
    
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
    const realBalance = Math.max(0, round2(pactedMO - totalFeesOnlySum));

    const totalInvestmentModern = safeCosts.reduce((acc: number, c: any) => {
        const st = (c.estado_pago || c.estado || '').toLowerCase();
        return (!st.includes('anulado') && !st.includes('rechazado')) ? acc + toNum(c.monto) : acc;
    }, 0);
    const totalInvestmentReal = round2(totalInvestmentModern + totalLegacyFeesSum);

    // ✅ CORRECCIÓN: Calcular utilidad correctamente (sin IGV)
    const montoFinalSinIGV = montoFinal / 1.18;
    const utilidadCalculada = Math.max(0, round2(montoFinalSinIGV - totalInvestmentReal));
    const margenCalculado = montoFinalSinIGV > 0 ? round2((utilidadCalculada / montoFinalSinIGV) * 100) : 0;

    // Usar valores de DB si existen, si no usar calculados
    const grossMarginFinal = (utilidadDB > 0) ? utilidadDB : utilidadCalculada;
    const marginPercentFinal = (margenDB > 0) ? margenDB : margenCalculado;

    return {
        totalPactedDebt: pactedMO,
        totalPaidCalculated: totalConfirmedSum,
        totalConfirmed: totalConfirmedSum,
        totalRequested: totalPendingFromCosts,
        totalInProcess: totalPendingFromCosts,
        balance: realBalance,
        grossMargin: grossMarginFinal,
        marginPercent: marginPercentFinal,
        totalInvestment: totalInvestmentReal,
        // Valores separados para diagnostics
        utilidadCalculada,
        margenCalculado,
        montoFinalSinIGV,
        pactedMO,
        pactedMat: 0,
        extraCosts: toNum(ticket.gastos_flujo_a || 0),
        paidModernArr: modernFees,
        paidModernPendingArr: pendingFeesArr,
        legacyPaymentsFiltered: legacyFees,
        operationalCostsArr: [...modernOps, ...legacyOps]
    };
}
