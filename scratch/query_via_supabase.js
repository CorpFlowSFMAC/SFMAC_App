const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://api.sinfimac.pe';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNvcnBmbG93c2ZtYWMtaGV0em5lciIsInJvbGUiOiJhbm9uIiwiaWF0IjoxNzc4NzQ4NTY5LCJleHAiOjIwODU3MjkyOTR9.UVpFZwAHuUFXKEwZANp58HP3x-9wgFGrvVY12yoC9MI';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function main() {
  const janethId = 'b804dc69-27b1-4335-8cea-bcc47557af0a';

  console.log('Querying Janeth tickets details from vw_tickets_strategic...');
  const { data: tickets, error } = await supabase
    .from('vw_tickets_strategic')
    .select('id, status_id, gestora_id, created_at, labor_cost, materials_cost, total_quoted_amount, total_costs_agg, utilidad_neta')
    .eq('gestora_id', janethId);

  if (error) {
    console.error('Error:', error);
  } else {
    console.table(tickets.map(t => ({
      id: t.id.slice(0, 8),
      status: t.status_id,
      created: t.created_at,
      labor: t.labor_cost,
      materials: t.materials_cost,
      quoted: t.total_quoted_amount,
      costs: t.total_costs_agg,
      net_util: t.utilidad_neta
    })));
  }
}

main().catch(console.error);
