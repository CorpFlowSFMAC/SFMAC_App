import { round2 } from "./formatters";

/**
 * Lógica Financiera Centralizada y Blindada para Tickets.
 * Esta función unifica el cálculo de pagos (Legacy + Moderno) y costos pactados.
 */
export function calculateTicketFinances(ticket: any, costs: any[] = []) {
    const ticketData = ticket.metadata || ticket;
    
    // 1. COSTO PACTADO (Referencia de Deuda)
    const pactedMO = round2(parseFloat(ticketData.labor_cost || ticketData.costoManoObra || 0));
    const pactedMat = round2(parseFloat(ticketData.material_cost || ticketData.costoMateriales || 0));
    const visitCost = round2(parseFloat(ticketData.costoVisita || ticketData.costoPasaje || 0));

    // Gastos Adicionales (Materiales extra, viáticos, etc. que NO sean adelantos/rescates)
    const extraCosts = (costs || [])
        .filter(c => {
            const cat = (c.categoria || '').toLowerCase();
            return !['adelanto', 'movilidad / visita', 'mano de obra', 'rescate', 'viáticos'].includes(cat);
        })
        .reduce((sum, c) => sum + (parseFloat(c.monto) || 0), 0);

    const jobCostBase = round2(pactedMO + pactedMat + extraCosts);
    const totalPactedDebt = jobCostBase > 0 ? jobCostBase : visitCost;

    // 2. PAGOS REALIZADOS Y SALDO TÉCNICO (Regla Inmutable)
    
    // Categorías que afectan los honorarios del técnico
    const feeCategories = ['mano de obra', 'adelanto', 'adelanto operativo', 'rescate financiero', 'rescate'];
    const confirmedStates = ['pagado'];
    const inProcessStates = ['pendiente', 'requiere_aprobacion', 'requiere_aprobacion_admin'];
    const exclusionStates = ['rechazado', 'anulado'];

    // A. Honorarios Modernos (Filtrados por estado)
    const technicianFeesArr = (costs || []).filter(c => {
        const cat = (c.categoria || '').toLowerCase();
        return feeCategories.includes(cat);
    });

    // Solo lo que ya salió del banco
    const confirmedFeesModern = technicianFeesArr
        .filter(c => confirmedStates.includes((c.estado_pago || '').toLowerCase()))
        .reduce((sum, c) => sum + (parseFloat(c.monto) || 0), 0);

    // Lo que está en cola (retiene saldo)
    const inProcessFeesModern = technicianFeesArr
        .filter(c => inProcessStates.includes((c.estado_pago || '').toLowerCase()))
        .reduce((sum, c) => sum + (parseFloat(c.monto) || 0), 0);

    const totalFeesModern = confirmedFeesModern + inProcessFeesModern;

    // B. Fuente Legacy (Deduplicada)
    const rawHistory = (ticketData.historialPagosTecnico || ticketData.historialPagosTécnico || []).filter((p: any) => p && !exclusionStates.includes((p.estado || '').toLowerCase()));
    
    const legacyPaymentsFiltered = rawHistory.filter((h: any) => {
        const hMonto = round2(h.monto || 0);
        if (hMonto <= 0) return false;
        const hTipo = (h.tipo || '').toLowerCase();
        const isFee = feeCategories.some(f => hTipo.includes(f)) || ['refuerzo', 'liquidación final'].includes(hTipo);
        if (!isFee) return false;

        return !technicianFeesArr.some((m: any) => {
            const mMonto = round2(m.monto || 0);
            return Math.abs(hMonto - mMonto) < 0.01;
        });
    });
    
    const confirmedFeesLegacy = legacyPaymentsFiltered
        .filter((p: any) => confirmedStates.includes((p.estado || 'pagado').toLowerCase()))
        .reduce((sum: number, p: any) => sum + round2(p.monto || 0), 0);
    
    const inProcessFeesLegacy = legacyPaymentsFiltered
        .filter((p: any) => inProcessStates.includes((p.estado || '').toLowerCase()))
        .reduce((sum: number, p: any) => sum + round2(p.monto || 0), 0);

    const totalFeesLegacy = confirmedFeesLegacy + inProcessFeesLegacy;

    // C. Pagos Manuales (Solo si no están en las listas anteriores)
    let additionalFeesManual = 0;
    if (ticketData.adelantoPagado && ticketData.montoAdelanto) {
        const exists = [...legacyPaymentsFiltered, ...technicianFeesArr].some(p => Math.abs(round2(p.monto || 0) - round2(ticketData.montoAdelanto || 0)) < 0.01);
        if (!exists) additionalFeesManual += parseFloat(ticketData.montoAdelanto || 0);
    }

    const confirmedTotal = round2(confirmedFeesModern + confirmedFeesLegacy + additionalFeesManual);
    const inProcessTotal = round2(inProcessFeesModern + inProcessFeesLegacy);
    const totalTechnicianHonorarios = round2(confirmedTotal + inProcessTotal);
    const balance = Math.max(0, round2(pactedMO - totalTechnicianHonorarios));

    // D. Gastos Operativos (NO se restan del saldo del técnico)
    const operationalCategories = ['materiales', 'insumos', 'viáticos', 'movilidad', 'logística', 'envíos', 'viáticos / movilidad'];
    const operationalCostsArr = (costs || []).filter(c => {
        const cat = (c.categoria || '').toLowerCase();
        const st = (c.estado_pago || '').toLowerCase();
        return operationalCategories.includes(cat) && !exclusionStates.includes(st);
    });
    const totalOperationalCosts = operationalCostsArr.reduce((sum, c) => sum + (parseFloat(c.monto) || 0), 0);

    // 3. RENTABILIDAD
    const clientAmount = parseFloat(ticketData.total_quoted_amount || ticketData.montoFinal || 0);
    const actualMaterialCosts = operationalCostsArr
        .filter(c => (c.categoria || '').toLowerCase().includes('material'))
        .reduce((sum, c) => sum + (parseFloat(c.monto) || 0), 0);
    
    const materialsToSum = Math.max(pactedMat, actualMaterialCosts);
    const otherOperational = totalOperationalCosts - actualMaterialCosts;

    const totalInvestment = round2(totalTechnicianHonorarios + materialsToSum + otherOperational);
    const grossMargin = round2(clientAmount - totalInvestment);
    const marginPercent = clientAmount > 0 ? (grossMargin / clientAmount) * 100 : 0;

    return {
        totalPactedDebt: pactedMO,
        totalPaidCalculated: totalTechnicianHonorarios,
        totalConfirmed: confirmedTotal,
        totalInProcess: inProcessTotal,
        balance,
        grossMargin,
        marginPercent,
        totalInvestment,
        pactedMO,
        pactedMat,
        extraCosts: totalOperationalCosts,
        paidModernArr: technicianFeesArr, // Todos los honorarios no anulados/rechazados
        legacyPaymentsFiltered,
        operationalCostsArr
    };
}
