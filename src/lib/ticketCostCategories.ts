/**
 * Tipo de Solicitud de Pago
 * Clasificación primaria para separar flujos financieros en el módulo de Tesorería
 */
export type TipoSolicitud = 'GASTO_RESCATE' | 'ADELANTO' | 'LIQUIDACION' | 'OTRO';

export const VALID_TICKET_COST_CATEGORIES = new Set([
    'Materiales',
    'Mano de Obra',
    'Logística',
    'Viáticos',
    'Movilidad',
    'Viáticos / Movilidad',
    'Envíos',
    'Adelanto',
    'Adelanto Operativo',
    'Rescate Financiero',
    'Otros',
]);

type TicketCostCategoryInput = {
    categoria?: string | null;
    tipo?: string | null;
    concepto?: string | null;
};

/**
 * Clasifica automáticamente el tipo de solicitud basándose en categoria/concepto
 * Esta función garantiza que cada costo tenga un tipo de solicitud definido
 */
export const getTipoSolicitud = ({ categoria, tipo, concepto }: TicketCostCategoryInput): TipoSolicitud => {
    const text = `${categoria || ''} ${tipo || ''} ${concepto || ''}`.toLowerCase();
    
    // LIQUIDACION: Liquidación final, saldo de MO, cierre de ticket
    if (text.includes('liquidación') || text.includes('liquidacion final') || 
        text.includes('saldo de mano de obra') || text.includes('saldo mo') ||
        text.includes('cierre') || text.includes('final')) {
        return 'LIQUIDACION';
    }
    
    // ADELANTO: Pagos parciales de MO antes del cierre
    if (text.includes('adelanto') || text.includes('adelanto operativo') ||
        text.includes('adelanto m.o') || text.includes('pago mo parcial') ||
        text.includes('refuerzo')) {
        return 'ADELANTO';
    }
    
    // GASTO_RESCATE: Gastos operativos, compras, viáticos, rescates financieros
    if (text.includes('rescate') || text.includes('materiales') || text.includes('viático') ||
        text.includes('viaticos') || text.includes('movilidad') || text.includes('logística') ||
        text.includes('envíos') || text.includes('compras') || text.includes('gasto operativo') ||
        text.includes('compra') || text.includes('insumo') || text.includes('herramienta') ||
        text.includes('repuesto')) {
        return 'GASTO_RESCATE';
    }
    
    return 'OTRO';
};

/**
 * Mapeo de estados de pago a estados universales del flujo de tesorería
 */
export const mapEstadoPagoToUniversal = (estadoPago: string | null | undefined): string => {
    const st = (estadoPago || '').toLowerCase().trim();
    
    if (st === 'pendiente' || st === 'requiere_aprobacion_admin') {
        return 'pendiente_aprobacion';
    }
    
    if (st === 'aprobado' || st === 'pagado' || st === 'adelanto' || st === 'abonado' ||
        st === 'confirmado' || st === 'autorizado' || st === 'transferido') {
        return 'desembolsado';
    }
    
    if (st === 'rechazado') {
        return 'rechazado';
    }
    
    return 'pendiente_aprobacion';
};

export const normalizeTicketCostCategory = ({ categoria, tipo, concepto }: TicketCostCategoryInput) => {
    const candidates = [categoria, tipo?.replace(/^Gasto:\s*/i, '')];

    for (const candidate of candidates) {
        const clean = candidate?.trim();
        if (clean && VALID_TICKET_COST_CATEGORIES.has(clean)) return clean;
    }

    const text = `${categoria || ''} ${tipo || ''} ${concepto || ''}`.toLowerCase();
    if (text.includes('liquidación') || text.includes('mano de obra') || text.includes('saldo')) return 'Mano de Obra';
    if (text.includes('movilidad') || text.includes('visita') || text.includes('viático')) return 'Viáticos / Movilidad';
    if (text.includes('material')) return 'Materiales';
    if (text.includes('adelanto')) return 'Adelanto Operativo';
    if (text.includes('rescate')) return 'Rescate Financiero';

    return 'Otros';
};
