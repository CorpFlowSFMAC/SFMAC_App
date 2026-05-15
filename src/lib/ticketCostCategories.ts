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
