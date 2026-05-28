import { Pool } from 'pg';

async function tryConnect(port, ssl) {
    const pool = new Pool({
        host: '87.99.137.96',
        port: port,
        user: 'postgres',
        password: 'CorpFlowSFMAC_DB_2026',
        database: 'postgres',
        ssl: ssl,
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
    console.log("Searching for a valid connection...");
    
    let validClient = null;
    let validPool = null;
    
    for (const port of [5432, 6543]) {
        for (const ssl of [false, { rejectUnauthorized: false }]) {
            console.log(`Trying port ${port}, ssl: ${JSON.stringify(ssl)}...`);
            const result = await tryConnect(port, ssl);
            if (result) {
                validClient = result.client;
                validPool = result.pool;
                console.log(`✅ Connected on port ${port} with ssl ${JSON.stringify(ssl)}`);
                break;
            }
        }
        if (validClient) break;
    }
    
    if (!validClient) {
        console.log("❌ Could not connect.");
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
