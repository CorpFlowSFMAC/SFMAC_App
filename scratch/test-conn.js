const { Client } = require('pg');

const client = new Client({
  host: '87.99.137.96',
  port: 6543,
  user: 'postgres.tenant_id', // let's try just supabase_admin first? wait, the .env says supabase_admin
});

async function testPool() {
  const c1 = new Client({ host: '87.99.137.96', port: 6543, user: 'supabase_admin', password: 'CorpFlowSFMAC_DB_2026', database: '_supabase' });
  try { await c1.connect(); console.log("Connected 6543 supabase_admin!"); await c1.end(); } catch (e) { console.log("Fail 6543 supabase_admin:", e.message); }
  
  const c2 = new Client({ host: '87.99.137.96', port: 5432, user: 'supabase_admin', password: 'CorpFlowSFMAC_DB_2026', database: '_supabase' });
  try { await c2.connect(); console.log("Connected 5432 supabase_admin!"); await c2.end(); } catch (e) { console.log("Fail 5432 supabase_admin:", e.message); }
}
testPool();
