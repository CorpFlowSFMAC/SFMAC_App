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
        'repuestos', 'insumo', 'peaje', 'estacionamiento', 'egreso', 'compras'
    ];
    
    // Si tiene un specialist_id y NO es el técnico principal del ticket (si se conoce),
    // o si el concepto indica explícitamente un pago a tercero/compra.
    const isExternalSpecialist = item.specialist_id && item.specialist_id !== item.main_technician_id;

    if (con.includes('adelanto operativo')) {
        return con.includes('materiales');
    }
    
    return operatingKeywords.some(key => cat.includes(key) || con.includes(key)) || isExternalSpecialist;
};

const isLabor = (item: any) => {
    if (isOperating(item)) return false; // Prioridad operativa/terceros

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
        main_technician_id: ticket.technician_id || ticket.technicians?.id || rawMetadata.tecnico?.id,
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

    // ─────────────────────────────────────────────────────────────────────────────
    // DEDUPLICACIÓN V3 (Pairing Logic & 1-min Rule)
    // ─────────────────────────────────────────────────────────────────────────────
    // Propósito: Evitar doble conteo entre ticket_costs (moderno) y legacy (metadata).
    // REGLA: Si hay dos pagos de S/ 500 en legacy y uno en modern, se debe contar 
    // el modern y el RESTANTE de legacy (Total 1000).
    const usedModernIds = new Set<string>();

    const filteredLegacy = legacyPayments.filter((lp: any) => {
        // Encontrar un match en modern que no haya sido "usado" ya para deduplicar otro legacy
        const matchingModernIndex = confirmedModern.findIndex((mc: any) => {
            if (usedModernIds.has(mc.id)) return false;

            // 1. ★ PRIORIDAD ABSOLUTTA: Si ambos tienen ID diferentes, SON transacciones distintas
            // No deduplicar si al menos uno tiene ID único - sumar ambos
            const hasIdModern = !!(mc.id);
            const hasIdLegacy = !!(lp.id);
            
            // Si ambos tienen IDs diferentes → NO es duplicado, son transacciones separadas
            if (hasIdModern && hasIdLegacy && mc.id !== lp.id) return false;
            
            // Si el moderno tiene ID pero el legacy NO → podría ser migración del mismo registro
            if (hasIdModern && !hasIdLegacy) {
                // Verificar coincidencia por ID de referencia en metadata
                const isSameId = mc.metadata?.legacy_id === lp.id;
                if (isSameId) return true;
            }

            // 2. Solo para REGISTROS LEGACY sin ID: margen de 1 segundo (SFMAC V3 Hardening)
            // Esto aplica solo para registros que realmente no tengan identificador único
            if (!hasIdModern && !hasIdLegacy) {
                const sameMonto = toNum(mc.monto) === toNum(lp.monto);
                const dateM = new Date(mc.fecha_pago || mc.fecha || mc.created_at);
                const dateL = new Date(lp.fecha || lp.date);
                
                const diffMs = Math.abs(dateM.getTime() - dateL.getTime());
                const sameTime = diffMs < 1000; // < 1 segundo (1,000 ms) para evitar falsos positivos

                return sameMonto && sameTime;
            }

            return false;
        });

        if (matchingModernIndex !== -1) {
            // "Consumir" el registro moderno para que no deduplique otros pagos legítimos del mismo monto
            usedModernIds.add(confirmedModern[matchingModernIndex].id);
            return false; // Es un duplicado, no incluir este legacy
        }

        // Si no hubo match, el pago legacy es legítimo (o aún no migrado)
        return isConfirmed(lp.estado);
    });


    const modernLabor = confirmedModern.map(normalizePayment).filter(isLabor);
    const modernOp = confirmedModern.map(normalizePayment).filter(isOperating);
    const legacyLabor = filteredLegacy.map(normalizePayment).filter(isLabor);
    const legacyOp = filteredLegacy.map(normalizePayment).filter(isOperating);

    const totalLaborConfirmed = round2(
        modernLabor.reduce((acc, c) => acc + c.monto, 0) +
        legacyLabor.reduce((acc, p) => acc + p.monto, 0)
    );

    const totalOpConfirmed = round2(
        modernOp.reduce((acc, c) => acc + c.monto, 0) +
        legacyOp.reduce((acc, p) => acc + p.monto, 0)
    );

    const netLaborBalance = Math.max(0, round2(pactedMO - totalLaborConfirmed));
    
    // 🚀 LEY DE SFMAC V3: realProfitability SOLO resta lo que tiene ID de transacción CONFIRMADO.
    // El saldo proyectado (netLaborBalance) NO resta utilidad hasta que se ejecute el pago.
    const realProfitability = round2(montoBase - totalLaborConfirmed - totalOpConfirmed);
    const margenReal = montoBase > 0 ? round2((realProfitability / montoBase) * 100) : 0;

    const pendingLaborItems = pendingModern.map(normalizePayment).filter(isLabor);
    const pendingOpItems = pendingModern.map(normalizePayment).filter(isOperating);
    const totalOpPending = round2(pendingOpItems.reduce((acc, c) => acc + c.monto, 0));
    const totalLaborPending = round2(pendingLaborItems.reduce((acc, c) => acc + c.monto, 0));
    const laborRequested = totalLaborConfirmed + totalLaborPending;

    // 🛡️ RESERVA: Todo lo que es deuda proyectada o pendiente de aprobación.
    const totalReserva = round2(netLaborBalance + totalLaborPending + totalOpPending);

    return {
        pactedMO,
        totalVenta: montoBase,
        totalLaborConfirmed,
        totalOpConfirmed,
        laborRequested, // Requerido por TicketWindow
        totalLaborPending,
        netProfit: realProfitability, // Alias
        profitMargin: margenReal,    // Alias
        netIncome: montoBase,        // Alias
        laborPactado: pactedMO,      // Alias
        laborExpenses: totalLaborConfirmed, // Alias
        totalPactedDebt: pactedMO,   // Alias
        operatingExpenses: totalOpConfirmed, // Alias para compatibilidad V2
        totalExpenses: totalLaborConfirmed + totalOpConfirmed, // Alias para compatibilidad V2
        netLaborBalance,
        balance: netLaborBalance, // Alias para compatibilidad V2
        realProfitability,
        margenReal,
        totalReserva,
        laborItems: [...modernLabor, ...legacyLabor],
        operatingItems: [...modernOp, ...legacyOp],
        pendingCosts: pendingModern,
        pendingLaborItems,
        pendingOpItems,
        totalOpPending,
        totalRequested: totalLaborConfirmed + totalOpConfirmed + totalOpPending
    };
}
