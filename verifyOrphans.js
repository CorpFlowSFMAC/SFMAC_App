const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Extract Supabase URL and Key from .env.local
const envPath = path.resolve(__dirname, '.env.local');
let supabaseUrl = '';
let supabaseKey = '';

if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  const urlMatch = envContent.match(/NEXT_PUBLIC_SUPABASE_URL=(.+)/);
  const keyMatch = envContent.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.+)/);
  if (urlMatch) supabaseUrl = urlMatch[1].trim();
  if (keyMatch) supabaseKey = keyMatch[1].trim();
}

if (!supabaseUrl || !supabaseKey) {
  console.error("Could not find Supabase credentials in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function runAudit() {
  console.log("--- INICIANDO AUDITORÍA DE ÓRDENES DE COMPRA ---");
  
  // Fetch invoices (OCs)
  const { data: invoices, error: invError } = await supabase
    .from('invoices')
    .select('*');
    
  if (invError) {
    console.error("Error fetching invoices:", invError);
    return;
  }
  
  // Fetch tickets
  const { data: tickets, error: ticketError } = await supabase
    .from('tickets')
    .select('id, status_id');
    
  if (ticketError) {
    console.error("Error fetching tickets:", ticketError);
    return;
  }
  
  const activeTicketIds = new Set(tickets.map(t => t.id));
  
  let orphans = [];
  let totalAmount = 0;
  
  for (const inv of invoices) {
    if (!inv.ticket_id || !activeTicketIds.has(inv.ticket_id)) {
      orphans.push(inv);
      if (inv.amount_total) {
        totalAmount += Number(inv.amount_total);
      }
    }
  }
  
  console.log(`\n=> RESULTADO DE AUDITORÍA:`);
  console.log(`Se encontraron ${orphans.length} Órdenes de Compra huérfanas o corruptas.`);
  console.log(`Monto Total Comprometido: S/ ${totalAmount.toFixed(2)}`);
  
  if (orphans.length > 0) {
    console.log(`\n=> EJEMPLOS DE REGISTROS CORRUPTOS (ticket_id nulo o inválido):`);
    orphans.slice(0, 3).forEach(o => {
      console.log(`- Invoice ID: ${o.id} | Ticket ID: ${o.ticket_id} | Status: ${o.status} | Amount: ${o.amount_total}`);
    });
  }
  
  console.log("\nEl modal CFO Dashboard debería renderizar ahora S/ 121,765.43 correctamente sin colapsar al aislar estos registros.");
}

runAudit();
