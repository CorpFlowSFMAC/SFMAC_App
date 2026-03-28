const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

async function test() {
    try {
        const { data, error } = await supabase
            .from('zonas')
            .update({ gestora_asignada_id: null })
            .eq('id', '83496611-a810-49f6-97a0-b7ff8dad041a')
            .select('*, gestora:gestoras(id, name, email)')
            .single();
            
        console.log('Result:', error || data);
    } catch (err) {
        console.error('Caught:', err);
    }
}
test();
