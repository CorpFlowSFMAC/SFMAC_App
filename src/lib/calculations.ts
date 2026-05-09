import { round2 } from "./formatters";

/**
 * Lógica Financiera Centralizada y Blindada para Tickets.
 * Esta función unifica el cálculo de pagos (Legacy + Moderno) y costos pactados.
 */
/**
 * Función auxiliar para parseo ultra-seguro de valores numéricos
 */
export const toNum = (val: any): number => {
    if (typeof val === 'number') return val;
    if (typeof val === 'string') {
        const clean = val.replace(/[^0-9.-]/g, '');
        return parseFloat(clean) || 0;
    }
    return 0;
};

/**
 * Lógica Financiera Centralizada y Blindada para Tickets.
 * Esta función unifica el cálculo de pagos (Legacy + Moderno) y costos pactados.
 */
export function calculateTicketFinances(ticket: any, costs: any[] = []) {
    // 1. NORMALIZACIÓN DE METADATA
    const rawMetadata = ticket.metadata || {};
    const safeCosts = Array.isArray(costs) ? costs : [];

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

    // 3. CATEGORIZACIÓN ESTRICTA V3
    // Canal 1: Pasivo Laboral (Descontable de MO)
    const laborKeywords = [
        'adelanto m.o', 'rescate financiero', 'pago mo', 
        'adelanto', 'rescate', 'pago_mo', 'liquidación final',
        'mano de obra', 'honorarios', 'pago técnico', 'pago_tecnico'
    ];
    
    // Canal 2: Gastos Operativos (Afectan Rentabilidad)
    const operatingKeywords = [
        'compras', 'materiales', 'viáticos', 'logística', 
        'mano de obra externa', 'insumos', 'movilidad', 
        'envíos', 'gasto operativo', 'compra mat'
    ];

    const isConfirmed = (status: string | null | undefined) => {
        const rawSt = (status || '').toLowerCase().trim();
        const valid = [
            'pagado', 'adelanto', 'abonado', 'confirmado', 'auditado',
            'ejecutado', 'autorizado admin', 'autorizado', 'aprobado',
            'transferido', 'completado'
        ];
        return valid.some(v => rawSt.includes(v));
    };

    const isLabor = (item: any) => {
        const cat = (item.categoria || '').toLowerCase();
        const con = (item.concepto || item.tipo || '').toLowerCase();
        
        // Regla especial V3: Adelanto Operativo clasificado
        if (con.includes('adelanto operativo')) {
            return !con.includes('materiales'); // Si no dice materiales, asumimos bolsillo técnico
        }
        
        return laborKeywords.some(key => cat.includes(key) || con.includes(key));
    };
    
    const isOperating = (item: any) => {
        const cat = (item.categoria || '').toLowerCase();
        const con = (item.concepto || item.tipo || '').toLowerCase();
        
        // Regla especial V3: Adelanto Operativo clasificado
        if (con.includes('adelanto operativo')) {
            return con.includes('materiales');
        }
        
        return operatingKeywords.some(key => cat.includes(key) || con.includes(key));
    };

    // 4. FILTRADO DE MOVIMIENTOS
    const confirmedModern = safeCosts.filter(c => isConfirmed(c.estado_pago || c.estado));
    const pendingModern = safeCosts.filter(c => {
        const st = (c.estado_pago || c.estado || '').toLowerCase();
        return st === 'pendiente' || st === 'requiere_aprobacion_admin';
    });

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
    const filteredLegacy = legacyPayments.filter((lp: any) => 
        !safeCosts.some(mc => mc.id === lp.id) && isConfirmed(lp.estado)
    );

    // 5. CÁLCULOS POR CANAL
    const modernLabor = confirmedModern.filter(isLabor);
    const modernOp = confirmedModern.filter(isOperating);
    const legacyLabor = filteredLegacy.filter(isLabor);
    const legacyOp = filteredLegacy.filter(isOperating);

    const totalLaborConfirmed = round2(
        modernLabor.reduce((acc, c) => acc + toNum(c.monto), 0) +
        legacyLabor.reduce((acc, p) => acc + toNum(p.monto), 0)
    );

    const totalOpConfirmed = round2(
        modernOp.reduce((acc, c) => acc + toNum(c.monto), 0) +
        legacyOp.reduce((acc, p) => acc + toNum(p.monto), 0)
    );

    const totalLaborPending = round2(pendingModern.filter(isLabor).reduce((acc, c) => acc + toNum(c.monto), 0));
    const totalOpPending = round2(pendingModern.filter(isOperating).reduce((acc, c) => acc + toNum(c.monto), 0));

    // 6. RESULTADOS V3 (BUSINESS RULES)
    // Regla 1: netLaborBalance solo descuenta Pasivo Laboral
    const netLaborBalance = Math.max(0, round2(pactedMO - totalLaborConfirmed));
    
    // Regla 2: realProfitability = (Venta) - (MO Pactada) - (Gastos Operativos)
    const totalVenta = montoFinal;
    const realProfitability = round2(totalVenta - pactedMO - totalOpConfirmed);
    const margenReal = totalVenta > 0 ? round2((realProfitability / totalVenta) * 100) : 0;

    return {
        // Canal de Mano de Obra (Pasivo Laboral)
        pactedMO,
        laborPactado: pactedMO, // Alias para compatibilidad
        totalPactedDebt: pactedMO, // Alias para compatibilidad
        totalLaborConfirmed,
        laborExpenses: totalLaborConfirmed, // Alias para compatibilidad
        totalLaborPending,
        netLaborBalance,
        balance: netLaborBalance, // Alias para compatibilidad
        laborRequested: round2(totalLaborConfirmed + totalLaborPending),
        
        // Canal de Gastos Operativos
        operatingExpenses: totalOpConfirmed,
        totalOpPending,
        
        // Rentabilidad Real
        totalVenta,
        netIncome: totalVenta, // Alias para compatibilidad
        realProfitability,
        netProfit: realProfitability, // Alias para compatibilidad
        margenReal,
        profitMargin: margenReal, // Alias para compatibilidad
        
        // Totales Agregados
        totalExpenses: round2(totalLaborConfirmed + totalOpConfirmed),
        totalPaidCalculated: round2(totalLaborConfirmed + totalOpConfirmed), // Alias para compatibilidad
        totalRequested: round2(totalLaborPending + totalOpPending), // Alias para compatibilidad
        totalPending: round2(totalLaborPending + totalOpPending), // Alias para compatibilidad
        
        // Desgloses para TransactionLedger
        laborItems: [...modernLabor, ...legacyLabor],
        operatingItems: [...modernOp, ...legacyOp],
        pendingLaborItems: pendingModern.filter(isLabor),
        pendingOpItems: pendingModern.filter(isOperating)
    };
}
