import { Pool } from 'pg';

const pool = new Pool({
  host: '87.99.137.96',
  port: 6543,
  user: 'postgres',
  password: 'CorpFlowSFMAC_DB_2026',
  database: 'postgres'
});

async function main() {
    try {
        console.log("Checking if view exists...");
        const res = await pool.query(`
            SELECT table_name 
            FROM information_schema.views 
            WHERE table_schema = 'public' AND table_name = 'vw_tickets_strategic';
        `);
        if (res.rows.length > 0) {
            console.log("View 'vw_tickets_strategic' EXISTS!");
            
            console.log("Reloading schema for PostgREST...");
            await pool.query(`NOTIFY pgrst, 'reload schema';`);
            console.log("Schema reloaded successfully!");
        } else {
            console.log("View 'vw_tickets_strategic' DOES NOT EXIST in public schema!");
        }
    } catch (e) {
        console.error("Error:", e);
    } finally {
        await pool.end();
    }
}

main();
