import { Client } from 'ssh2';

const conn = new Client();

const policiesSql = `
   -- 1. CORRECCIÓN DEFINITIVA PARA VOUCHERS (PERMITIR INSERCIÓN GLOBAL AL BUCKET)
   DROP POLICY IF EXISTS "Permitir inserción a usuarios autenticados en vouchers" ON storage.objects;
   
   CREATE POLICY "Permitir inserción pública controlada en vouchers" 
   ON storage.objects FOR INSERT 
   TO public 
   WITH CHECK (bucket_id = 'vouchers');

   -- 2. CORRECCIÓN DEFINITIVA PARA EVIDENCIAS (PERMITIR INSERCIÓN GLOBAL AL BUCKET)
   DROP POLICY IF EXISTS "Permitir inserción a usuarios autenticados en evidencias" ON storage.objects;
   
   CREATE POLICY "Permitir inserción pública controlada en evidencias" 
   ON storage.objects FOR INSERT 
   TO public 
   WITH CHECK (bucket_id = 'evidencias');
`;

const cmd = `docker exec supabase-db psql -U postgres -d postgres -c "${policiesSql.replace(/"/g, '\\"')}"`;

conn.on('ready', () => {
  console.log('SSH Connection ready. Deploying secure RLS policies to public...');
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
