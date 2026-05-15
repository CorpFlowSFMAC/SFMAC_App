
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'http://87.99.137.96:8000';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzc3MjIwMzI0LCJleHAiOjIwOTI1ODAzMjR9.bz2FnNU2lPSYg7phNladdHjVqw_mHWYpklHjd-A_EIY';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  try {
    const targets = [
      'MB000023.26', 'MB000001.26', 'MB000002.26', 'MB000122.26',
      'TK-E7D15C46', 'TK-ED81BF83', 'TK-F208B76A', 'TK-7C1D181D'
    ];
    
    console.log('--- BUSCANDO TICKETS ---');
    const { data: tickets, error: fetchErr } = await supabase
      .from('tickets')
      .select('id, client_ticket_number')
      .or(`client_ticket_number.in.(${targets.join(',')}),id.ilike.%E7D15C46,id.ilike.%ED81BF83,id.ilike.%F208B76A,id.ilike.%7C1D181D`);

    if (fetchErr) throw fetchErr;

    if (!tickets || tickets.length === 0) {
      console.log('No se encontraron tickets.');
      return;
    }

    console.log('Tickets encontrados:', tickets);

    const ids = tickets.map(t => t.id);

    console.log('--- ELIMINANDO RAMIFICACIONES ---');
    await supabase.from('ticket_costs').delete().in('ticket_id', ids);
    await supabase.from('ticket_payments').delete().in('ticket_id', ids);
    await supabase.from('ticket_evidences').delete().in('ticket_id', ids);
    
    console.log('--- ELIMINANDO TICKETS ---');
    const { count, error: delErr } = await supabase.from('tickets').delete().in('id', ids);
    
    if (delErr) throw delErr;
    console.log(`Eliminados tickets y sus ramificaciones.`);

  } catch (err) {
    console.error('Error:', err);
  }
}

run();
