import { createClient } from '@supabase/supabase-js';

const HETZNER_SUPABASE_URL = 'https://api.sinfimac.pe';
const HETZNER_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNvcnBmbG93c2ZtYWMtaGV0em5lciIsInJvbGUiOiJhbm9uIiwiaWF0IjoxNzc4NzQ4NTY5LCJleHAiOjIwODU3MjkyOTR9.UVpFZwAHuUFXKEwZANp58HP3x-9wgFGrvVY12yoC9MI';

const supabase = createClient(HETZNER_SUPABASE_URL, HETZNER_SUPABASE_ANON_KEY);

async function checkFinancials() {
    // Get some ticket IDs first
    const { data: tickets, error: tErr } = await supabase
        .from('tickets')
        .select('id, status_id, total_quoted_amount, labor_cost, metadata')
        .not('status_id', 'eq', 'borrador')
        .limit(10);
    
    if (tErr) {
        console.log('Tickets Error:', tErr.message);
        return;
    }
    
    console.log('\n=== TICKETS CHECK ===\n');
    
    // Show first 5 tickets with their metadata
    tickets?.slice(0, 5).forEach(t => {
        console.log('--- Ticket:', t.id.slice(0, 8));
        console.log('  status_id:', t.status_id);
        console.log('  total_quoted_amount:', t.total_quoted_amount);
        console.log('  labor_cost:', t.labor_cost);
        console.log('  metadata.ingresos_reales:', t.metadata?.ingresos_reales);
        console.log('  metadata.montoSubtotal:', t.metadata?.montoSubtotal);
        console.log('  metadata.total_quoted_amount:', t.metadata?.total_quoted_amount);
        console.log('  metadata.labor_cost:', t.metadata?.labor_cost);
        console.log('');
    });
    
    // Now check vw_ticket_financials directly
    const { data: financials, error: fErr } = await supabase
        .from('vw_ticket_financials')
        .select('*')
        .limit(5);
    
    if (fErr) {
        console.log('Financials View Error:', fErr.message);
        return;
    }
    
    console.log('\n=== vw_ticket_financials VIEW ===\n');
    
    financials?.forEach(f => {
        console.log('--- Ticket:', f.ticket_id.slice(0, 8));
        console.log('  status_id:', f.status_id);
        console.log('  ingresos_reales:', f.ingresos_reales);
        console.log('  utilidad_neta:', f.utilidad_neta);
        console.log('  gastos_flujo_a:', f.gastos_flujo_a);
        console.log('  adelantos_flujo_b:', f.adelantos_flujo_b);
        console.log('');
    });
    
    // Check if there's a table vs view mismatch
    console.log('\n=== COMPARISON ===\n');
    
    tickets?.slice(0, 5).forEach(t => {
        const f = financials?.find(fin => fin.ticket_id === t.id);
        console.log('Ticket:', t.id.slice(0, 8));
        console.log('  Root status_id:', t.status_id);
        console.log('  View status_id:', f?.status_id);
        console.log('  Root total_quoted:', t.total_quoted_amount);
        console.log('  View ingresos_reales:', f?.ingresos_reales);
        console.log('  Root metadata.ingresos_reales:', t.metadata?.ingresos_reales);
        console.log('  Root metadata.montoSubtotal:', t.metadata?.montoSubtotal);
        console.log('');
    });
}

checkFinancials();