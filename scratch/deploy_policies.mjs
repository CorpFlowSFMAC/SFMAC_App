import { Client } from 'ssh2';

const conn = new Client();

const policiesSql = `
CREATE POLICY "Allow public select on evidencias" ON storage.objects FOR SELECT TO public USING (bucket_id = 'evidencias');
CREATE POLICY "Allow public insert on evidencias" ON storage.objects FOR INSERT TO public WITH CHECK (bucket_id = 'evidencias');
CREATE POLICY "Allow public update on evidencias" ON storage.objects FOR UPDATE TO public USING (bucket_id = 'evidencias');
CREATE POLICY "Allow public delete on evidencias" ON storage.objects FOR DELETE TO public USING (bucket_id = 'evidencias');

CREATE POLICY "Allow public select on vouchers" ON storage.objects FOR SELECT TO public USING (bucket_id = 'vouchers');
CREATE POLICY "Allow public insert on vouchers" ON storage.objects FOR INSERT TO public WITH CHECK (bucket_id = 'vouchers');
CREATE POLICY "Allow public update on vouchers" ON storage.objects FOR UPDATE TO public USING (bucket_id = 'vouchers');
CREATE POLICY "Allow public delete on vouchers" ON storage.objects FOR DELETE TO public USING (bucket_id = 'vouchers');
`;

const cmd = `docker exec supabase-db psql -U postgres -d postgres -c "${policiesSql.replace(/"/g, '\\"')}"`;

conn.on('ready', () => {
  console.log('SSH Connection ready. Deploying RLS policies...');
  conn.exec(cmd, (err, stream) => {
    if (err) throw err;
    stream.on('close', (code, signal) => {
      console.log(`SSH Command completed with code ${code}`);
      conn.end();
    }).on('data', (data) => {
      console.log(data.toString());
    }).stderr.on('data', (data) => {
      console.error('STDERR:', data.toString());
    });
  });
}).connect({
  host: '87.99.137.96',
  port: 22,
  username: 'root',
  password: 'etNpxhE7dKAtRA3aTVEv_Secured'
});
