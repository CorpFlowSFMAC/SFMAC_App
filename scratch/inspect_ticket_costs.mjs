import pg from 'pg';
const { Client } = pg;

const client = new Client({
    host: '87.99.137.96',
    port: 5432,
    user: 'postgres',
    password: 'CorpFlowSFMAC_DB_2026',
    database: 'postgres',
    connectionTimeoutMillis: 10000
});

async function main() {
    try {
        await client.connect();
        
        console.log("--- COSTS WITH 400 OR ADELANTO ---");
        const costsRes = await client.query(`
            SELECT id, ticket_id, concepto, categoria, monto, estado_pago 
            FROM ticket_costs 
            WHERE monto = 400 OR estado_pago = 'adelanto' OR categoria = 'Adelanto' OR categoria = 'Adelanto Operativo'
            LIMIT 10;
        `);
        
        const ticketIds = new Set();
        for (const row of costsRes.rows) {
            console.log(row);
            ticketIds.add(row.ticket_id);
        }
        
        if (ticketIds.size > 0) {
            console.log("\n--- TICKETS DETAILS ---");
            for (const tid of ticketIds) {
                const tRes = await client.query("SELECT id, ticket_number, status_id, labor_cost, total_quoted_amount FROM tickets WHERE id = $1;", [tid]);
                console.log("Ticket:", tRes.rows[0]);
                
                const tcRes = await client.query("SELECT id, concepto, categoria, monto, estado_pago FROM ticket_costs WHERE ticket_id = $1;", [tid]);
                console.log("Costs for ticket:");
                for (const cRow of tcRes.rows) {
                    console.log("  ", cRow);
                }
                
                const vfRes = await client.query("SELECT * FROM vw_ticket_financials WHERE ticket_id = $1;", [tid]);
                console.log("View data:");
                const vRow = vfRes.rows[0];
                if (vRow) {
                    for (const [col, val] of Object.entries(vRow)) {
                        console.log(`  ${col}: ${val}`);
                    }
                }
            }
        }
        
        console.log("\n--- VIEW DEFINITION ---");
        const viewRes = await client.query("SELECT pg_get_viewdef('vw_ticket_financials'::regclass);");
        console.log(viewRes.rows[0].pg_get_viewdef);
        
    } catch (err) {
        console.error("Error:", err);
    } finally {
        await client.end();
    }
}

main();
