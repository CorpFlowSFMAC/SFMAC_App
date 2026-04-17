const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://xqnghcdndqicqofnxvuf.supabase.co', process.env.SUPABASE_SERVICE_ROLE_KEY || '');

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
