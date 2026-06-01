import { Client } from 'ssh2';

const conn = new Client();

conn.on('ready', () => {
  console.log('Client :: ready');
  const sql = `
    BEGIN;
    DELETE FROM ticket_evidences WHERE ticket_id = 'ae9018fc-5045-45fc-9f41-9b87e090ae13';
    DELETE FROM ticket_costs WHERE ticket_id = 'ae9018fc-5045-45fc-9f41-9b87e090ae13';
    DELETE FROM ticket_payments WHERE ticket_id = 'ae9018fc-5045-45fc-9f41-9b87e090ae13';
    DELETE FROM tickets WHERE id = 'ae9018fc-5045-45fc-9f41-9b87e090ae13';
    ROLLBACK;
  `;
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
