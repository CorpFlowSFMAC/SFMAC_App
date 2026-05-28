import { Pool } from 'pg';

const DATABASES = [
    'postgres', 'default$default', 'supabase', 'app', 'sfmac', 'db', 'prod', 'production', 'main', 'application'
];

async function tryConnect(dbName) {
    const pool = new Pool({
        host: '87.99.137.96',
        port: 5432,
        user: 'postgres',
        password: 'CorpFlowSFMAC_DB_2026',
        database: dbName,
        connectionTimeoutMillis: 5000
    });

    try {
        const client = await pool.connect();
        return { client, pool };
    } catch (e) {
        await pool.end();
        return null;
    }
}

async function main() {
    console.log("Searching for a valid database...");
    
    let validClient = null;
    let validPool = null;
    let validDb = null;
    
    for (const db of DATABASES) {
        console.log(`Trying ${db}...`);
        const result = await tryConnect(db);
        if (result) {
            validClient = result.client;
            validPool = result.pool;
            validDb = db;
            console.log(`✅ Connected to ${db}`);
            break;
        }
    }
    
    if (!validClient) {
        console.log("❌ Could not connect to any database using port 5432 and user postgres.");
        return;
    }
    
    try {
        console.log("Checking if view exists...");
        const res = await validClient.query(`
            SELECT table_name 
            FROM information_schema.views 
            WHERE table_schema = 'public' AND table_name = 'vw_tickets_strategic';
        `);
        
        if (res.rows.length > 0) {
            console.log("View 'vw_tickets_strategic' EXISTS!");
            console.log("Reloading schema for PostgREST...");
            await validClient.query(`NOTIFY pgrst, 'reload schema';`);
            console.log("Schema reloaded successfully!");
        } else {
            console.log("View 'vw_tickets_strategic' DOES NOT EXIST in public schema!");
        }
    } catch (e) {
        console.error("Error:", e);
    } finally {
        validClient.release();
        await validPool.end();
    }
}

main();
