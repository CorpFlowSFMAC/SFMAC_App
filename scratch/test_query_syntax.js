
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing env vars');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
    const ticketsToDelete = ['TK-7A82AB9A', 'MB000001.26'];
    
    // Probar con comillas
    const { data, error } = await supabase
        .from('tickets')
        .select('id, ticket_number, client_ticket_number')
        .or(`ticket_number.in.("${ticketsToDelete.join('","')}"),client_ticket_number.in.("${ticketsToDelete.join('","')}")`);

    if (error) {
        console.error('Error with quoted IN:', error);
    } else {
        console.log('Quoted IN success:', data);
    }

    // Probar con eq individual
    const { data: data2, error: error2 } = await supabase
        .from('tickets')
        .select('id, ticket_number, client_ticket_number')
        .or(`ticket_number.eq.${ticketsToDelete[0]},ticket_number.eq.${ticketsToDelete[1]},client_ticket_number.eq.${ticketsToDelete[0]},client_ticket_number.eq.${ticketsToDelete[1]}`);

    if (error2) {
        console.error('Error with EQ:', error2);
    } else {
        console.log('EQ success:', data2);
    }
}

check();
