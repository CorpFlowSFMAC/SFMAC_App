const { Client } = require('pg');

const client = new Client({
    host: '87.99.137.96',
    port: 5432,
    database: 'postgres',
    user: 'postgres',
    password: 'CorpFlowSFMAC_DB_2026',
    ssl: false
});

async function run() {
    try {
        await client.connect();
        console.log('Connected to PostgreSQL');

        // 1. Alter clients table
        await client.query('ALTER TABLE clients ADD COLUMN IF NOT EXISTS default_payment_terms integer DEFAULT 30;');
        console.log('Added default_payment_terms to clients');

        // 2. Alter invoices table
        await client.query('ALTER TABLE invoices ADD COLUMN IF NOT EXISTS due_date timestamp with time zone;');
        console.log('Added due_date to invoices');

        // 3. Drop existing trigger on tickets if it exists (for invoices)
        await client.query('DROP TRIGGER IF EXISTS trg_auto_generate_invoice ON tickets;');
        await client.query('DROP FUNCTION IF EXISTS auto_generate_invoice() CASCADE;');
        console.log('Dropped trigger trg_auto_generate_invoice');

        // 4. Insert OPEX seed
        const opexRes = await client.query(`
            INSERT INTO company_expenses (category, amount, is_active, description) 
            SELECT 'Costo Operativo General', 70000, true, 'OPEX Estructural Semilla' 
            WHERE NOT EXISTS (SELECT 1 FROM company_expenses WHERE category = 'Costo Operativo General');
        `);
        console.log('Inserted OPEX seed, rows affected:', opexRes.rowCount);

        // 5. Check clients columns to verify
        const columns = await client.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'clients';");
        console.log('Clients columns:', columns.rows.map(r => r.column_name));

    } catch (err) {
        console.error('Migration error:', err);
    } finally {
        await client.end();
    }
}
run();
