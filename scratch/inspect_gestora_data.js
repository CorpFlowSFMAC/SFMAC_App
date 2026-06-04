const { Client } = require('pg');

async function tryConnect(user, database) {
  console.log(`Testing user="${user}" database="${database}"...`);
  const client = new Client({
    host: '87.99.137.96',
    port: 5432,
    database: database,
    user: user,
    password: 'CorpFlowSFMAC_DB_2026',
  });
  try {
    await client.connect();
    console.log(`✅ Success! user="${user}" database="${database}"`);
    return client;
  } catch (e) {
    console.log(`❌ Failed: ${e.message}`);
    return null;
  }
}

async function main() {
  const configs = [
    { user: 'postgres.corpflowsfmac-hetzner', db: 'postgres' },
    { user: 'postgres', db: 'postgres' },
    { user: 'postgres.corpflowsfmac_hetzner', db: 'postgres' },
    { user: 'postgres', db: 'corpflowsfmac-hetzner' }
  ];

  let client = null;
  for (const config of configs) {
    client = await tryConnect(config.user, config.db);
    if (client) break;
  }

  if (!client) {
    console.error('Could not connect with any configuration.');
    return;
  }

  console.log('\n--- 📋 GESTORAS TABLE ---');
  const gestorasRes = await client.query('SELECT id, name, email, meta_mensual_utilidad FROM gestoras;');
  console.table(gestorasRes.rows);

  console.log('\n--- 📋 SAMPLE TICKETS (First 5) ---');
  const ticketsRes = await client.query(`
    SELECT id, status_id, gestora_id, labor_cost, materials_cost, total_quoted_amount, created_at
    FROM tickets 
    LIMIT 5;
  `);
  console.table(ticketsRes.rows);

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

  await client.end();
}

main().catch(console.error);
