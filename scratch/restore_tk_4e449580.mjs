import { Client } from 'ssh2';

const conn = new Client();

const sql = `
UPDATE tickets 
SET status_id = 'en_ejecucion', 
    closure_date = NULL 
WHERE id = 'e3a4a814-4d72-4cef-b639-f3634e449580';
`;

const cmd = `docker exec supabase-db psql -U postgres -d postgres -c "${sql.replace(/"/g, '\\"').replace(/\n/g, ' ')}"`;

conn.on('ready', () => {
  console.log('SSH Connection ready. Restoring ticket...');
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
