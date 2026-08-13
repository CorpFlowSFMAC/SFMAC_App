import { NextRequest, NextResponse } from 'next/server';
import { isConfirmedTicketCostStatus } from '@/lib/calculations';
import { getClient } from '@/lib/supabase-server';
import { normalizeTicketCostCategory } from '@/lib/ticketCostCategories';

class DuplicateTicketCostError extends Error {
    constructor() {
        super('Error: Intento de pago duplicado detectado. Ya existe un pago confirmado idéntico en los últimos 10 minutos.');
        this.name = 'DuplicateTicketCostError';
    }
}

const TICKET_COST_SELECT = `
    *,
    technicians(id, name, first_name, last_name, document_number, phone, bank_name, account_number, cci, yape_number, plin_number)
`;

const normalizeCostConcept = (value: string | null | undefined) => (value || '').trim().replace(/\s+/g, ' ').toLowerCase();

const cleanCostPayload = (cost: Record<string, any>) => {
    const payload: Record<string, any> = {};

    if (cost.ticket_id) payload.ticket_id = cost.ticket_id;
    if (cost.concepto) payload.concepto = cost.concepto;
    if (cost.categoria || cost.concepto) payload.categoria = normalizeTicketCostCategory(cost);
    if (cost.proveedor) payload.proveedor = cost.proveedor;
    if (cost.specialist_id) payload.specialist_id = cost.specialist_id;
    if (cost.monto !== undefined) payload.monto = Number(cost.monto);
    if (cost.estado_pago) payload.estado_pago = cost.estado_pago;
    if (cost.url_comprobante) payload.url_comprobante = cost.url_comprobante;
    if (cost.solicitado_por) payload.solicitado_por = cost.solicitado_por;
    if (cost.motivo) payload.motivo = cost.motivo;
    if (cost.fecha_pago) payload.fecha_pago = cost.fecha_pago;
    
    // ★ NOTA: tipo_solicitud fue removido de la tabla ticket_costs
    // Asegurar que no se envíe este campo aunque venga en el payload
    // (puede causar errores si la columna no existe en la DB)

    return payload;
};

const normalizeRequesterId = async (client: any, requesterId?: string) => {
    if (!requesterId) return undefined;

    const { data: profile } = await client
        .from('perfiles')
        .select('id')
        .eq('id', requesterId)
        .maybeSingle();

    if (profile?.id) return profile.id;

    const { data: gestora } = await client
        .from('gestoras')
        .select('auth_user_id')
        .eq('id', requesterId)
        .maybeSingle();

    return gestora?.auth_user_id || undefined;
};

const normalizeCostPayload = async (client: any, payload: Record<string, any>) => {
    if (!payload.solicitado_por) return payload;

    const requesterId = await normalizeRequesterId(client, payload.solicitado_por);
    if (!requesterId) {
        const { solicitado_por: _solicitadoPor, ...rest } = payload;
        return rest;
    }

    return { ...payload, solicitado_por: requesterId };
};

const assertUniqueConfirmedTicketCost = async (
    client: any,
    ticketId: string,
    monto: number,
    concepto: string,
    ignoredId?: string
) => {
    if (!client) {
        throw new Error('Supabase server client is not configured');
    }

    const { data, error } = await client
        .from('ticket_costs')
        .select('id, concepto, estado_pago, created_at')
        .eq('ticket_id', ticketId)
        .eq('monto', monto);

    if (error) throw error;

    const targetConcept = normalizeCostConcept(concepto);
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);

    const exists = (data || []).some((cost: any) => {
        if (ignoredId && cost.id === ignoredId) return false;
        
        // Verifica si el registro fue creado o actualizado en los últimos 10 minutos
        const recordDate = new Date(cost.created_at || Date.now());
        const isRecent = recordDate > tenMinutesAgo;

        return isConfirmedTicketCostStatus(cost.estado_pago) && 
               normalizeCostConcept(cost.concepto || '') === targetConcept &&
               isRecent;
    });

    if (exists) throw new DuplicateTicketCostError();
};



export async function GET(request: NextRequest) {
    try {
        const client = getClient() as any;
        if (!client) throw new Error('Supabase server client is not configured');

        const params = new URL(request.url).searchParams;
        const ticketId = params.get('ticket_id');
        const ticketIds = (params.get('ticket_ids') || '')
            .split(',')
            .map((id) => id.trim())
            .filter(Boolean);

        if (!ticketId && ticketIds.length === 0) {
            return NextResponse.json({ success: false, error: 'ticket_id o ticket_ids es requerido' }, { status: 400 });
        }

        let query = client
            .from('ticket_costs')
            .select(TICKET_COST_SELECT)
            .order('created_at', { ascending: true });

        query = ticketId ? query.eq('ticket_id', ticketId) : query.in('ticket_id', ticketIds);

        const { data, error } = await query;

        if (error) throw error;

        return NextResponse.json({ success: true, data: data || [] });
    } catch (err: any) {
        console.error('[Ticket Costs API] GET Error:', err);
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const client = getClient() as any;
        if (!client) throw new Error('Supabase server client is not configured');

        const rawPayload = await request.json();
        const cleanPayload = cleanCostPayload(rawPayload);
        
        // ★ FILTRAR campos que no existen en la tabla ticket_costs
        // Esto evita errores de "column not found" de Supabase
        const allowedFields = ['ticket_id', 'concepto', 'categoria', 'proveedor', 'specialist_id', 'monto', 'estado_pago', 'url_comprobante', 'solicitado_por', 'motivo', 'fecha_pago'];
        const filteredPayload: Record<string, any> = {};
        for (const key of allowedFields) {
            if (key in cleanPayload) {
                filteredPayload[key] = cleanPayload[key];
            }
        }

        const payload = await normalizeCostPayload(client, filteredPayload);
        if (!payload.ticket_id || !payload.concepto || !payload.categoria || payload.monto === undefined || payload.monto === null || !payload.estado_pago) {
            return NextResponse.json({ success: false, error: 'Datos incompletos para registrar el costo' }, { status: 400 });
        }

        // ══════════════════════════════════════════════════════════════════════
        // REGLA FIJA V3: Ningún costo puede nacer en estado "pagado" o confirmado.
        // Solo Tesorería/Admin puede transicionar a "pagado" vía PUT (módulo de pagos).
        // Estados permitidos en creación: 'pendiente' | 'REQUIERE_APROBACION_ADMIN'
        // ══════════════════════════════════════════════════════════════════════
        if (isConfirmedTicketCostStatus(payload.estado_pago)) {
            return NextResponse.json(
                { success: false, error: 'Los costos deben crearse como pendientes. Solo Tesorería puede marcarlos como pagados.' },
                { status: 403 }
            );
        }

        const { data, error } = await client
            .from('ticket_costs')
            .insert(payload)
            .select('*')
            .single();

        if (error) {
            console.error('[Ticket Costs API] POST - Database error:', error);
            if (error.code === '23505') throw new DuplicateTicketCostError();
            return NextResponse.json({ 
                success: false, 
                error: error.message,
                errorDetails: {
                    code: error.code,
                    details: error.details,
                    hint: error.hint
                }
            }, { status: 400 });
        }

        return NextResponse.json({ success: true, data });
    } catch (err: any) {
        console.error('[Ticket Costs API] POST Error:', err);
        const status = err instanceof DuplicateTicketCostError ? 409 : 500;
        return NextResponse.json({ success: false, error: err.message, code: err.name }, { status });
    }
}

export async function PUT(request: NextRequest) {
    try {
        const client = getClient() as any;
        if (!client) throw new Error('Supabase server client is not configured');

        const { id, updates } = await request.json();
        if (!id || !updates) {
            return NextResponse.json({ success: false, error: 'id y updates son requeridos' }, { status: 400 });
        }

        console.log('[Ticket Costs API] PUT - id:', id, 'updates:', Object.keys(updates));

        // ★ FILTRAR campos que no existen en la tabla ticket_costs
        // Esto evita errores de "column not found" de Supabase
        const allowedFields = ['ticket_id', 'concepto', 'categoria', 'proveedor', 'specialist_id', 'monto', 'estado_pago', 'url_comprobante', 'solicitado_por', 'motivo', 'fecha_pago'];
        const filteredUpdates: Record<string, any> = {};
        for (const key of allowedFields) {
            if (key in updates) {
                filteredUpdates[key] = updates[key];
            }
        }
        console.log('[Ticket Costs API] PUT - filteredUpdates:', Object.keys(filteredUpdates));

        const safeUpdates = await normalizeCostPayload(client, filteredUpdates);
        console.log('[Ticket Costs API] PUT - safeUpdates:', Object.keys(safeUpdates));

        if (safeUpdates.estado_pago && isConfirmedTicketCostStatus(safeUpdates.estado_pago)) {
            const { data: current, error: fetchErr } = await client
                .from('ticket_costs')
                .select('id, ticket_id, monto, concepto')
                .eq('id', id)
                .single();

            if (fetchErr) throw fetchErr;

            await assertUniqueConfirmedTicketCost(
                client,
                current.ticket_id,
                safeUpdates.monto ?? current.monto,
                safeUpdates.concepto ?? current.concepto,
                id
            );
        }



        const { data, error } = await client
            .from('ticket_costs')
            .update(safeUpdates)
            .eq('id', id)
            .select('*, technicians(*)')
            .single();

        if (error) {
            console.error('[Ticket Costs API] PUT - Database error:', error);
            if (error.code === '23505') throw new DuplicateTicketCostError();
            throw error;
        }

        // --- NEW LOGIC: TRANSICIÓN AUTOMÁTICA A EJECUCIÓN ---
        // Si el pago ha sido confirmado (ej. pagado, reembolso pagado, etc.)
        if (safeUpdates.estado_pago && isConfirmedTicketCostStatus(safeUpdates.estado_pago)) {
            const { data: ticket, error: ticketErr } = await client
                .from('tickets')
                .select('id, status_id')
                .eq('id', data.ticket_id)
                .single();
            
            if (ticket && !ticketErr) {
                const currentStatus = String(ticket.status_id);
                // Si está en 'cotizacion_aprobada' (7) pasa a 'en_ejecucion' (8)
                if (currentStatus === '7' || currentStatus === 'cotizacion_aprobada') {
                    const newStatus = typeof ticket.status_id === 'number' ? 8 : 'en_ejecucion';
                    
                    await client
                        .from('tickets')
                        .update({ status_id: newStatus })
                        .eq('id', data.ticket_id);
                    
                    console.log(`[Ticket Costs API] Ticket ${data.ticket_id} transicionado automáticamente a en_ejecucion tras confirmación de pago.`);
                }
            }
        }
        // ----------------------------------------------------

        return NextResponse.json({ success: true, data });
    } catch (err: any) {
        console.error('[Ticket Costs API] PUT Error:', err);
        const status = err instanceof DuplicateTicketCostError ? 409 : 500;
        return NextResponse.json({ success: false, error: err.message, code: err.name }, { status });
    }
}

export async function DELETE(request: NextRequest) {
    try {
        const client = getClient() as any;
        if (!client) throw new Error('Supabase server client is not configured');

        const id = new URL(request.url).searchParams.get('id');
        if (!id) {
            return NextResponse.json({ success: false, error: 'id es requerido' }, { status: 400 });
        }

        const { error } = await client.from('ticket_costs').delete().eq('id', id);
        if (error) throw error;

        return NextResponse.json({ success: true });
    } catch (err: any) {
        console.error('[Ticket Costs API] DELETE Error:', err);
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}

export const dynamic = 'force-dynamic';
