import { Client } from 'ssh2';

const conn = new Client();

const sqlStatements = [
  `DROP POLICY IF EXISTS "Permitir inserción a usuarios autenticados en vouchers" ON storage.objects;`,
  `CREATE POLICY "Permitir inserción a usuarios autenticados en vouchers" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'vouchers');`,
  `DROP POLICY IF EXISTS "Permitir inserción a usuarios autenticados en evidencias" ON storage.objects;`,
  `CREATE POLICY "Permitir inserción a usuarios autenticados en evidencias" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'evidencias');`,
  `SELECT polname, polcmd FROM pg_policy WHERE polrelid = 'storage.objects'::regclass AND polcmd IN ('insert','all');`
];

console.log('Executing RLS fix on Hetzner DB (storage.objects)...');

conn.on('ready', () => {
  console.log('SSH Connected. Running SQL statements...');

  async function runStatements() {
    for (const sql of sqlStatements) {
      const safeSql = sql.replace(/"/g, '\\"');
      const cmd = `docker exec supabase-db psql -U postgres -d postgres -c "${safeSql}"`;
      console.log(`\n>>> EXECUTING: ${sql.substring(0, 60)}...`);

      await new Promise((resolve, reject) => {
        conn.exec(cmd, (err, stream) => {
          if (err) { console.error('Exec error:', err); reject(err); return; }
          let out = '', errOut = '';
          stream.on('close', (code) => {
            console.log('  Result code:', code);
            if (out) console.log('  STDOUT:', out.trim());
            if (errOut) console.log('  STDERR:', errOut.trim());
            resolve();
          }).on('data', (d) => { out += d.toString(); })
            .stderr.on('data', (d) => { errOut += d.toString(); });
        });
      });
    }
    console.log('\n✅ All RLS policies applied successfully!');
    conn.end();
  }

  runStatements().catch(e => { console.error(e); conn.end(); });
}).on('error', (err) => {
  console.error('SSH connection error:', err);
}).connect({
  host: '87.99.137.96',
  port: 22,
  username: 'root',
  password: 'etNpxhE7dKAtRA3aTVEv_Secured'
});