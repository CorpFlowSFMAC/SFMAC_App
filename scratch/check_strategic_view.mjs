import { createClient } from '@supabase/supabase-js';

const HETZNER_SUPABASE_URL = 'https://api.sinfimac.pe';
const HETZNER_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNvcnBmbG93c2ZtYWMtaGV0em5lciIsInJvbGUiOiJhbm9uIiwiaWF0IjoxNzc4NzQ4NTY5LCJleHAiOjIwODU3MjkyOTR9.UVpFZwAHuUFXKEwZANp58HP3x-9wgFGrvVY12yoC9MI';

const supabase = createClient(HETZNER_SUPABASE_URL, HETZNER_SUPABASE_ANON_KEY);

async function checkStrategicView() {
    // Get all tickets from strategic view
    const { data, error } = await supabase
        .from('vw_tickets_strategic')
        .select('*')
        .limit(3);
    
    if (error) {
        console.log('Error:', error.message);
        return;
    }
    
    console.log('\n=== vw_tickets_strategic FIELDS ===\n');
    
    if (data && data.length > 0) {
        console.log('Fields in view:');
        Object.keys(data[0]).forEach(key => {
            console.log('  -', key);
        });
        
        console.log('\n=== Sample Data ===\n');
        data.forEach(t => {
            console.log('Ticket:', t.id?.slice(0, 8));
            console.log('  ingresos_reales:', t.ingresos_reales);
            console.log('  adelantos_flujo_b:', t.adelantos_flujo_b);
            console.log('  gastos_flujo_a:', t.gastos_flujo_a);
            console.log('  utilidad_neta:', t.utilidad_neta);
            console.log('  margen_real:', t.margen_real);
            console.log('  status_id:', t.status_id);
            console.log('  total_quoted_amount:', t.total_quoted_amount);
            console.log('  labor_cost:', t.labor_cost);
            console.log('');
        });
    }
}

checkStrategicView();