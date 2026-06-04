const { Client } = require('pg');

const client = new Client({
  host: '87.99.137.96',
  port: 5432,
  database: 'postgres',
  user: 'postgres',
  password: 'CorpFlowSFMAC_DB_2026',
});

async function main() {
  await client.connect();
  console.log('✅ Connected to database\n');

  console.log('--- 📋 GESTORAS TABLE ---');
  const gestorasRes = await client.query('SELECT id, name, email, meta_mensual_utilidad FROM gestoras;');
  console.table(gestorasRes.rows);

  console.log('\n--- 📋 VIEW STACK IN VW_TICKETS_STRATEGIC (Sample) ---');
  const columnsRes = await client.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'vw_tickets_strategic'
    ORDER BY column_name;
  `);
  console.log('Columns in vw_tickets_strategic:', columnsRes.rows.map(r => r.column_name).join(', '));

  console.log('\n--- 📋 SAMPLE TICKETS (First 5) ---');
  const ticketsRes = await client.query(`
    SELECT id, status_id, gestora_id, labor_cost, materials_cost, total_quoted_amount, created_at
    FROM tickets 
    LIMIT 5;
  `);
  console.table(ticketsRes.rows);

  console.log('\n--- 📋 STRATEGIC VIEW TICKETS (First 5) ---');
  const stratRes = await client.query(`
    SELECT id, status_id, gestora_id, created_at, saldo_tecnico, margen_real, utilidad_neta
    FROM vw_tickets_strategic 
    LIMIT 5;
  `);
  console.table(stratRes.rows);

  // Check if there are tickets with non-null gestora_id
  console.log('\n--- 📋 TICKETS WITH GESTORA_ID ---');
  const withGestoraRes = await client.query(`
    SELECT id, status_id, gestora_id, created_at, total_quoted_amount
    FROM tickets
    WHERE gestora_id IS NOT NULL;
  `);
  console.log(`Total tickets with gestora_id: ${withGestoraRes.rowCount}`);
  if (withGestoraRes.rowCount > 0) {
    console.table(withGestoraRes.rows.slice(0, 10));
  }

  // Count tickets grouped by status_id
  console.log('\n--- 📋 TICKET COUNT BY STATUS ---');
  const statusRes = await client.query(`
    SELECT status_id, COUNT(*)
    FROM tickets
    GROUP BY status_id;
  `);
  console.table(statusRes.rows);

  await client.end();
}

main().catch(console.error);
