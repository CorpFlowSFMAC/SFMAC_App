const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://87.99.137.96:8000', process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '');

async function test() {
    const { data, error } = await supabase.rpc('get_tickets_summary_v2');
    if (error) {
        console.error('Error calling RPC:', error);
    } else {
        console.log('RPC returned', data?.length, 'tickets');
        if (data?.length > 0) {
            console.log('Sample ticket:', JSON.stringify(data[0], null, 2));
        }
    }
}

test();
