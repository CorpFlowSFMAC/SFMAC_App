
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'http://87.99.137.96:8000';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzc3MjIwMzI0LCJleHAiOjIwOTI1ODAzMjR9.bz2FnNU2lPSYg7phNladdHjVqw_mHWYpklHjd-A_EIY';

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
    console.log('Buscando tickets...');
    const { data, error } = await supabase
        .from('tickets')
        .select('id, ticket_number')
        .or('ticket_number.eq.TK-7A82AB9A,ticket_number.eq.MB000001.26');

    if (error) {
        console.error('Error:', error.message);
        return;
    }

    console.log('Tickets encontrados:', data);

    if (data && data.length > 0) {
        for (const ticket of data) {
            console.log(`Intentando eliminar ticket ${ticket.ticket_number} (${ticket.id})...`);
            
            // Intentar eliminar dependencias primero
            await supabase.from('ticket_costs').delete().eq('ticket_id', ticket.id);
            await supabase.from('ticket_payments').delete().eq('ticket_id', ticket.id);
            
            const { error: delError } = await supabase
                .from('tickets')
                .delete()
                .eq('id', ticket.id);

            if (delError) {
                console.error(`Error eliminando ticket ${ticket.ticket_number}:`, delError.message);
            } else {
                console.log(`✅ Ticket ${ticket.ticket_number} eliminado.`);
            }
        }
    } else {
        console.log('No se encontraron los tickets especificados.');
    }
}

main();
