const { Client } = require('pg');

const client = new Client({
  host: '87.99.137.96',
  port: 5432,
  database: 'postgres',
  user: 'postgres.corpflowsfmac-hetzner',
  password: 'CorpFlowSFMAC_DB_2026',
});

async function main() {
  await client.connect();
  console.log('✅ Connected successfully!');
  
  const res = await client.query('SELECT count(*) FROM gestoras;');
  console.log('Gestoras count:', res.rows[0].count);
  
  await client.end();
}

main().catch(console.error);
