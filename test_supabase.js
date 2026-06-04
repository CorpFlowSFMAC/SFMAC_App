const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://api.sinfimac.pe';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNvcnBmbG93c2ZtYWMtaGV0em5lciIsInJvbGUiOiJhbm9uIiwiaWF0IjoxNzc4NzQ4NTY5LCJleHAiOjIwODU3MjkyOTR9.UVpFZwAHuUFXKEwZANp58HP3x-9wgFGrvVY12yoC9MI';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function main() {
  console.log('Fetching gestoras...');
  const { data: gestoras, error: gError } = await supabase.from('gestoras').select('*');
  if (gError) {
    console.error('Gestoras error:', gError);
    return;
  }
  console.table(gestoras.map(g => ({ id: g.id, name: g.name, email: g.email })));

  const janeth = gestoras.find(g => g.email === 'j.portocarrero@sinfimac.pe');
  if (janeth) {
    console.log(`\nJaneth ID: ${janeth.id}`);
    
    // Fetch tickets
    const { data: tickets, error: tError } = await supabase.from('tickets').select('*');
    if (tError) {
      console.error('Tickets error:', tError);
      return;
    }
    console.log(`Total tickets: ${tickets.length}`);

    // Filter tickets for Janeth manually to see what keys/metadata exist
    const janethTickets = tickets.filter(t => {
      if (t.gestora_id === janeth.id) return true;
      if (t.metadata?.gestora_id === janeth.id) return true;
      return false;
    });
    console.log(`Janeth direct tickets: ${janethTickets.length}`);
    console.table(janethTickets.slice(0, 10).map(t => ({
      id: t.id,
      status_id: t.status_id,
      gestora_id: t.gestora_id,
      metadata_gestora_id: t.metadata?.gestora_id,
      created_at: t.created_at
    })));

    // Let's see if there are branch_offices or clients that match
    const { data: branches, error: bError } = await supabase.from('branch_offices').select('*');
    if (bError) {
      console.error('Branches error:', bError);
      return;
    }
    const { data: clients, error: cError } = await supabase.from('clients').select('*');
    if (cError) {
      console.error('Clients error:', cError);
      return;
    }

    const myBranchIds = new Set(branches.filter(b => b.gestora_asignada_id === janeth.id).map(b => b.id));
    const myClientIds = new Set(clients.filter(c => c.gestora_asignada_id === janeth.id).map(c => c.id));
    
    console.log(`Janeth assigned branch offices count: ${myBranchIds.size}`);
    console.log(`Janeth assigned clients count: ${myClientIds.size}`);

    const indirectTickets = tickets.filter(t => {
      if (myBranchIds.has(t.branch_office_id)) return true;
      if (myClientIds.has(t.client_id)) return true;
      return false;
    });
    console.log(`Janeth indirect tickets (via client/branch): ${indirectTickets.length}`);
  }
}

main().catch(console.error);
