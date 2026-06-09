const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function cleanDummyCosts() {
    console.log("Cleaning up dummy 0.00 'Especialista' costs...");
    
    const { data, error } = await supabase
        .from('ticket_costs')
        .delete()
        .eq('concepto', 'Especialista')
        .eq('monto', 0);

    if (error) {
        console.error("Error deleting:", error);
    } else {
        console.log("Success! Dummy costs deleted.");
    }
}

cleanDummyCosts();
