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
  
  console.log('--- AUTH USERS ---');
  const users = await client.query('SELECT id, email, raw_user_meta_data FROM auth.users;');
  console.table(users.rows.map(u => ({ id: u.id, email: u.email, role: u.raw_user_meta_data?.role })));
  
  console.log('--- GESTORAS ---');
  const gestoras = await client.query('SELECT id, name, email, auth_user_id FROM public.gestoras;');
  console.table(gestoras.rows);
  
  await client.end();
}

main().catch(console.error);
