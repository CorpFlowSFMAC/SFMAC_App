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

  console.log('\n--- 📋 JANETH TICKETS ---');
  const janeth = gestorasRes.rows.find(g => g.email === 'j.portocarrero@sinfimac.pe');
  if (janeth) {
    console.log(`Janeth's ID: ${janeth.id}`);
    const ticketsRes = await client.query(`
      SELECT id, status_id, gestora_id, created_at, total_quoted_amount, materials_cost, labor_cost
      FROM tickets
      WHERE gestora_id = $1;
    `, [janeth.id]);
    console.log(`Total tickets found: ${ticketsRes.rowCount}`);
    console.table(ticketsRes.rows);
  } else {
    console.log('Janeth not found in gestoras table.');
  }

  await client.end();
}

main().catch(console.error);
