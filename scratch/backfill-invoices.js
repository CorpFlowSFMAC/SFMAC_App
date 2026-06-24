const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf8');
const envVars = {};
env.split('\n').forEach(l => { const m = l.match(/^([^=]+)=(.*)$/); if(m) envVars[m[1].trim()] = m[2].trim(); });
const url = envVars.NEXT_PUBLIC_SUPABASE_URL;
const key = envVars.SUPABASE_SERVICE_ROLE_KEY;

const headers = { 'apikey': key, 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json', 'Prefer': 'return=representation' };

async function fetchAll(endpoint) {
    let all = [];
    let page = 0;
    while(true) {
        const res = await fetch(`${url}/rest/v1/${endpoint}&limit=1000&offset=${page*1000}`, { headers });
        if(!res.ok) throw new Error(`Fetch error: ${await res.text()}`);
        const data = await res.json();
        if(data.length === 0) break;
        all = all.concat(data);
        page++;
    }
    return all;
}

async function run() {
    try {
        console.log("Fetching invoices...");
        const invoices = await fetchAll('invoices?select=ticket_id');
        const invoiceTicketIds = new Set(invoices.map(i => i.ticket_id));

        console.log("Fetching tickets...");
        const tickets = await fetchAll('tickets?select=id,status_id,client_id,client_ticket_number,metadata,total_quoted_amount');
        
        console.log(`Found ${tickets.length} total tickets. Identifying closed tickets without invoices...`);
        
        let insertedCount = 0;

        for (const t of tickets) {
            // Check if status is cerrado
            if (t.status_id === 'ticket_cerrado' || String(t.status_id).toLowerCase().includes('cerrado') || String(t.status_id).toLowerCase().includes('liquidado')) {
                if (!invoiceTicketIds.has(t.id)) {
                    // Determine amount
                    let amount = t.montoFinal || t.total_quoted_amount || t.monto_presupuesto || t.montoTotalCotizado || t.metadata?.totalVenta || t.metadata?.monto_presupuesto || 0;
                    amount = parseFloat(amount);
                    if (isNaN(amount)) amount = 0;

                    if (amount > 0) {
                        const dueDate = new Date();
                        dueDate.setDate(dueDate.getDate() + 30); // Default to 30 days
                        
                        const payload = {
                            ticket_id: t.id,
                            client_id: t.client_id,
                            amount_base: amount / 1.18,
                            amount_total: amount,
                            amount_igv: amount * 0.18,
                            status: 'emitida', // or cobrada depending on logic, defaulting to emitida for now
                            due_date: dueDate.toISOString(),
                            issued_date: new Date().toISOString()
                        };

                        const res = await fetch(`${url}/rest/v1/invoices`, {
                            method: 'POST',
                            headers,
                            body: JSON.stringify(payload)
                        });

                        if (res.ok) {
                            insertedCount++;
                            if(insertedCount % 50 === 0) console.log(`Inserted ${insertedCount} invoices...`);
                        } else {
                            console.error(`Error inserting invoice for ticket ${t.id}:`, await res.text());
                        }
                    }
                }
            }
        }
        
        console.log(`Backfill completed. Retroactively created ${insertedCount} invoices.`);
    } catch(err) {
        console.error(err);
    }
}
run();
