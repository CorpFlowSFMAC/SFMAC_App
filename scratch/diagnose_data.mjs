const supabaseUrl = 'https://api.sinfimac.pe';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNvcnBmbG93c2ZtYWMtaGV0em5lciIsInJvbGUiOiJhbm9uIiwiaWF0IjoxNzc4NzQ4NTY5LCJleHAiOjIwODU3MjkyOTR9.UVpFZwAHuUFXKEwZANp58HP3x-9wgFGrvVY12yoC9MI';

async function main() {
    console.log("=== DIAGNOSTIC START ===");
    try {
        // 1. Fetch tickets
        const tRes = await fetch(`${supabaseUrl}/rest/v1/tickets?select=*`, {
            headers: {
                'apikey': supabaseKey,
                'Authorization': `Bearer ${supabaseKey}`
            }
        });
        const tickets = await tRes.json();
        console.log("--- TICKETS ---");
        console.log(JSON.stringify(tickets, null, 2));

        // 2. Fetch ticket_costs
        const cRes = await fetch(`${supabaseUrl}/rest/v1/ticket_costs?select=*`, {
            headers: {
                'apikey': supabaseKey,
                'Authorization': `Bearer ${supabaseKey}`
            }
        });
        const costs = await cRes.json();
        console.log("\n--- TICKET COSTS ---");
        console.log(JSON.stringify(costs, null, 2));

        // 3. Fetch vw_ticket_financials
        const fRes = await fetch(`${supabaseUrl}/rest/v1/vw_ticket_financials?select=*`, {
            headers: {
                'apikey': supabaseKey,
                'Authorization': `Bearer ${supabaseKey}`
            }
        });
        const financials = await fRes.json();
        console.log("\n--- VW TICKET FINANCIALS ---");
        console.log(JSON.stringify(financials, null, 2));

    } catch (e) {
        console.error("Diagnostic error:", e);
    }
}
main();
