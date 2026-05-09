import { round2 } from "./formatters";

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

// --- HELPERS DE CATEGORIZACIÓN ---

const isConfirmed = (status: string | null | undefined) => {
    const rawSt = (status || '').toLowerCase().trim();
    const valid = [
        'pagado', 'adelanto', 'abonado', 'confirmado', 'auditado',
        'ejecutado', 'autorizado admin', 'autorizado', 'aprobado',
        'transferido', 'completado', 'depósito', 'deposito'
    ];
    return valid.some(v => rawSt.includes(v));
};

const isOperating = (item: any) => {
    const cat = (item.categoria || '').toLowerCase();
    const con = (item.concepto || item.tipo || '').toLowerCase();
    
    const operatingKeywords = [
        'compras', 'materiales', 'viáticos', 'viatico', 'logística', 
        'insumos', 'movilidad', 'pasajes', 'taxi', 'bus', 'transporte',
        'envíos', 'gasto operativo', 'compra mat', 'herramientas',
        'repuestos', 'insumo', 'peaje', 'estacionamiento'
    ];
    
    if (con.includes('adelanto operativo')) {
        return con.includes('materiales');
    }
    
    return operatingKeywords.some(key => cat.includes(key) || con.includes(key));
};

const isLabor = (item: any) => {
    if (isOperating(item)) return false; // Prioridad operativa

    const cat = (item.categoria || '').toLowerCase();
    const con = (item.concepto || item.tipo || '').toLowerCase();
    
    const laborKeywords = [
        'adelanto m.o', 'rescate financiero', 'pago mo', 
        'adelanto', 'rescate', 'pago_mo', 'liquidación final',
        'mano de obra', 'honorarios', 'pago técnico', 'pago_tecnico',
        'pago mo', 'pago mano de obra', 'mo pactada', 'pacted mo',
        'liquidación', 'liquidacion', 'saldo mo', 'mo final', 'laboral', 'técnico'
    ];
    
    return laborKeywords.some(key => cat.includes(key) || con.includes(key)) || con.includes('pago');
};

/**
 * Lógica Financiera Centralizada y Blindada para Tickets.
 */
export function calculateTicketFinances(ticket: any, costs: any[] = []) {
    const rawMetadata = ticket.metadata || {};
    const safeCosts = Array.isArray(costs) ? costs : [];

    // 1. MONTOS PACTADOS
    const pactedMO = [
        ticket.monto_pactado_mo,
        ticket.labor_cost,
        ticket.costoManoObra,
        rawMetadata.monto_pactado_mo,
        rawMetadata.labor_cost,
        rawMetadata.costoManoObra,
        ticket.monto_acordado
    ].map(v => toNum(v)).find(v => v > 0) || 0;
    
    const montoFinal = [
        ticket.ingresos_reales,
        ticket.monto_presupuesto,
        ticket.total_quoted_amount,
        ticket.montoFinal,
        ticket.montoTotalCotizado,
        rawMetadata.ingresos_reales,
        rawMetadata.total_quoted_amount,
        rawMetadata.montoFinal,
        rawMetadata.montoTotalCotizado
    ].map(v => toNum(v)).find(v => v > 0) || 0;
    
    const hasIGV = rawMetadata?.montoIGV > 0 || rawMetadata?.igv > 0 || ticket.montoIGV > 0 || ticket.igv > 0;
    const igvMonto = toNum(rawMetadata?.montoIGV || rawMetadata?.igv || ticket.montoIGV || ticket.igv || 0);
    const montoBase = hasIGV && igvMonto > 0 ? round2(montoFinal - igvMonto) : montoFinal;

    const normalizePayment = (p: any) => ({
        ...p,
        monto: toNum(p.monto || p.amount || 0),
        fecha: p.fecha_pago || p.fecha || p.date || p.created_at || (ticket as any).created_at || new Date().toISOString(),
    });

    // 2. FILTRADO Y CATEGORIZACIÓN
    const confirmedModern = safeCosts.filter(c => isConfirmed(c.estado_pago || c.estado));
    const pendingModern = safeCosts.filter(c => {
        const st = (c.estado_pago || c.estado || '').toLowerCase();
        return st === 'pendiente' || st === 'requiere_aprobacion_admin';
    });

    const arrs = [
        rawMetadata.historialPagosTecnico, 
        ticket.historialPagosTecnico,
        rawMetadata.historialPagosTécnico, 
        ticket.historialPagosTécnico
    ];
    const allById = new Map();
    arrs.forEach(arr => {
        if (Array.isArray(arr)) {
            arr.forEach(p => {
                const normalized = normalizePayment(p);
                if (normalized?.id) allById.set(normalized.id, normalized);
                else {
                    const hash = `${normalized.tipo}-${normalized.concepto}-${normalized.monto}-${normalized.fecha}`;
                    allById.set(hash, normalized);
                }
            });
        }
    });
    
    const legacyPayments = Array.from(allById.values());
    const filteredLegacy = legacyPayments.filter((lp: any) => 
        !safeCosts.some(mc => mc.id === lp.id) && isConfirmed(lp.estado)
    );

    const modernLabor = confirmedModern.filter(isLabor).map(normalizePayment);
    const modernOp = confirmedModern.filter(isOperating).map(normalizePayment);
    const legacyLabor = filteredLegacy.filter(isLabor);
    const legacyOp = filteredLegacy.filter(isOperating);

    const totalLaborConfirmed = round2(
        modernLabor.reduce((acc, c) => acc + c.monto, 0) +
        legacyLabor.reduce((acc, p) => acc + p.monto, 0)
    );

    const totalOpConfirmed = round2(
        modernOp.reduce((acc, c) => acc + c.monto, 0) +
        legacyOp.reduce((acc, p) => acc + p.monto, 0)
    );

    const netLaborBalance = Math.max(0, round2(pactedMO - totalLaborConfirmed));
    const realProfitability = round2(montoBase - pactedMO - totalOpConfirmed);
    const margenReal = montoBase > 0 ? round2((realProfitability / montoBase) * 100) : 0;

    return {
        pactedMO,
        totalVenta: montoBase,
        totalLaborConfirmed,
        totalOpConfirmed,
        netLaborBalance,
        realProfitability,
        margenReal,
        laborItems: [...modernLabor, ...legacyLabor],
        operatingItems: [...modernOp, ...legacyOp],
        pendingCosts: pendingModern
    };
}
