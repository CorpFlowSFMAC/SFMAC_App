
import { NextResponse } from 'next/server';
import { getClient } from '@/lib/supabase-server';

export async function GET() {
    try {
        const client = getClient();
        if (!client) {
            return NextResponse.json({ success: false, error: 'Supabase server client not initialized' }, { status: 500 });
        }

        const ticketsToDelete = ['TK-7A82AB9A', 'MB000001.26'];
        console.log('[Cleanup] Starting deletion of tickets:', ticketsToDelete);
        
        const results = [];

        for (const identifier of ticketsToDelete) {
            console.log(`[Cleanup] Searching for ticket: ${identifier}`);
            
            // Buscar por ticket_number o client_ticket_number individualmente para evitar errores de sintaxis Postgrest
            const { data: tickets, error: findError } = await client
                .from('tickets')
                .select('id, ticket_number, client_ticket_number')
                .or(`ticket_number.eq.${identifier},client_ticket_number.eq.${identifier}`);

            if (findError) {
                console.error(`[Cleanup] Error searching for ${identifier}:`, findError);
                results.push({ identifier, success: false, error: findError.message });
                continue;
            }

            if (!tickets || tickets.length === 0) {
                console.log(`[Cleanup] No ticket found for: ${identifier}`);
                results.push({ identifier, success: false, error: 'Not found' });
                continue;
            }

            for (const ticket of tickets) {
                const displayName = ticket.ticket_number || ticket.client_ticket_number || ticket.id;
                console.log(`[Cleanup] Deleting ticket ${displayName} (${ticket.id})...`);
                
                // Eliminar dependencias
                await client.from('ticket_costs').delete().eq('ticket_id', ticket.id);
                await client.from('ticket_payments').delete().eq('ticket_id', ticket.id);
                await client.from('ticket_evidences').delete().eq('ticket_id', ticket.id);
                
                const { error: delError } = await client
                    .from('tickets')
                    .delete()
                    .eq('id', ticket.id);
                    
                results.push({
                    id: ticket.id,
                    ticket_number: ticket.ticket_number,
                    client_ticket_number: ticket.client_ticket_number,
                    success: !delError,
                    error: delError?.message
                });
            }
        }

        return NextResponse.json({ success: true, results });
    } catch (err: any) {
        console.error('[Cleanup API] Error:', err);
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}
