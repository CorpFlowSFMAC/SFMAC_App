
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
        const processedIds = new Set();

        for (const identifier of ticketsToDelete) {
            console.log(`[Cleanup] Searching for ticket: ${identifier}`);
            
            // Usar consultas individuales para evitar errores de sintaxis Postgrest .or()
            const { data: res1 } = await client
                .from('tickets')
                .select('id, ticket_number, client_ticket_number')
                .eq('ticket_number', identifier);

            const { data: res2 } = await client
                .from('tickets')
                .select('id, ticket_number, client_ticket_number')
                .eq('client_ticket_number', identifier);

            const foundTickets = [...(res1 || []), ...(res2 || [])];

            if (foundTickets.length === 0) {
                console.log(`[Cleanup] No ticket found for: ${identifier}`);
                continue;
            }

            for (const ticket of foundTickets) {
                if (processedIds.has(ticket.id)) continue;
                processedIds.add(ticket.id);

                const displayName = ticket.ticket_number || ticket.client_ticket_number || ticket.id;
                console.log(`[Cleanup] Deleting ticket ${displayName} (${ticket.id})...`);
                
                // Eliminar dependencias manualmente para asegurar limpieza en cascada
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

        if (results.length === 0) {
            return NextResponse.json({ success: true, message: 'No tickets were found or deleted', searched: ticketsToDelete });
        }

        return NextResponse.json({ success: true, results });
    } catch (err: any) {
        console.error('[Cleanup API] Error:', err);
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}
