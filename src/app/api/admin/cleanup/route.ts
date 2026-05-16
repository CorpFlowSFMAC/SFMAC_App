
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
        
        // 1. Encontrar los UUIDs buscando en ambos campos (interno y externo)
        const { data, error: findError } = await client
            .from('tickets')
            .select('id, ticket_number, client_ticket_number')
            .or(`ticket_number.in.(${ticketsToDelete.join(',')}),client_ticket_number.in.(${ticketsToDelete.join(',')})`);
            
        if (findError) throw findError;

        interface TicketRecord {
            id: string;
            ticket_number: string | null;
            client_ticket_number: string | null;
        }

        const tickets = (data as TicketRecord[]) || [];
        
        if (tickets.length === 0) {
            console.log('[Cleanup] No tickets found to delete matching:', ticketsToDelete);
            return NextResponse.json({ success: true, message: 'No tickets found to delete', searched: ticketsToDelete });
        }

        const results = [];
        for (const ticket of tickets) {
            const displayName = ticket.ticket_number || ticket.client_ticket_number || ticket.id;
            console.log(`[Cleanup] Deleting ticket ${displayName} (${ticket.id})...`);
            
            // Eliminar dependencias (la DB debería tener cascade, pero aseguramos para V3 Stability)
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


        return NextResponse.json({ success: true, results });
    } catch (err: any) {
        console.error('[Cleanup API] Error:', err);
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}
