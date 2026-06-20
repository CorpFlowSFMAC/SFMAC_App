import { calculateTicketFinances } from '../src/lib/calculations';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://api.sinfimac.pe';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNvcnBmbG93c2ZtYWMtaGV0em5lciIsInJvbGUiOiJzZXJ2aWNlX3JvbGUiLCJpYXQiOjE3Nzg3NDg1NjksImV4cCI6MjA4NTcyOTI5NH0.vLLePfYAiz9YCvJEIwk-YLx2RXgyLNCKHMVHlc2vAEc';
const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

async function run() {
  const { data: ticket } = await supabase.from('tickets').select('*').eq('client_ticket_number', 'MB009696.26').single();
  const { data: costs } = await supabase.from('ticket_costs').select('*').eq('ticket_id', ticket.id);

  const finances = calculateTicketFinances(ticket, costs);
  console.log("Calculated Finances Now:");
  console.log(JSON.stringify(finances, null, 2));
}

run();
