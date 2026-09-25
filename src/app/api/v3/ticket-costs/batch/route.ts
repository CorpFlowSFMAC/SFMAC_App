import { NextRequest, NextResponse } from 'next/server';
import { getClient } from '@/lib/supabase-server';

/**
 * POST /api/v3/ticket-costs/batch
 *
 * Recibe { ticket_ids: string[] } en el body JSON y devuelve todos los
 * ticket_costs de esos tickets. Reemplaza al patrón GET con ?ticket_ids=...
 * que generaba URI too long (HTTP 414) cuando había muchos tickets.
 */

const TICKET_COST_SELECT = `
    *,
    technicians(id, name, first_name, last_name, document_number, phone, bank_name, account_number, cci, yape_number, plin_number)
`;

const BATCH_SIZE = 200; // máximo IDs por sub-query para evitar query strings largas en Supabase

export async function POST(request: NextRequest) {
    try {
        const client = getClient() as any;
        if (!client) throw new Error('Supabase server client is not configured');

        const body = await request.json();
        const ticketIds: string[] = (body?.ticket_ids || [])
            .map((id: any) => String(id).trim())
            .filter(Boolean);

        if (ticketIds.length === 0) {
            return NextResponse.json({ success: true, data: [] });
        }

        // Dividir en lotes para evitar consultas con demasiados IDs
        const allCosts: any[] = [];
        for (let i = 0; i < ticketIds.length; i += BATCH_SIZE) {
            const batch = ticketIds.slice(i, i + BATCH_SIZE);

            const { data, error } = await client
                .from('ticket_costs')
                .select(TICKET_COST_SELECT)
                .in('ticket_id', batch)
                .order('created_at', { ascending: true });

            if (error) throw error;
            if (data) allCosts.push(...data);
        }

        return NextResponse.json({ success: true, data: allCosts });
    } catch (err: any) {
        console.error('[Ticket Costs Batch API] POST Error:', err);
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}

export const dynamic = 'force-dynamic';
