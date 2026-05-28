import { Client } from 'ssh2';

const conn = new Client();

conn.on('ready', () => {
  console.log('Client :: ready');
  // Consulta para listar todas las tablas del esquema público
  const sql = "SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name;";
  const cmd = `docker exec -i supabase-db psql -U postgres -d postgres -c "${sql}"`;
  
  conn.exec(cmd, (err, stream) => {
    if (err) throw err;
    let stdout = '';
    let stderr = '';
    stream.on('close', (code, signal) => {
      console.log('STDOUT:\n' + stdout);
      console.log('STDERR:\n' + stderr);
      conn.end();
    }).on('data', (data) => {
      stdout += data.toString();
    }).stderr.on('data', (data) => {
      stderr += data.toString();
    });
  });
}).connect({
  host: '87.99.137.96',
  port: 22,
  username: 'root',
  password: 'etNpxhE7dKAtRA3aTVEv_Secured'
});
