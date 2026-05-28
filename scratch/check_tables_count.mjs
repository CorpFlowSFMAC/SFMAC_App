import { Client } from 'ssh2';

const conn = new Client();

conn.on('ready', () => {
  console.log('Client :: ready');
  const sql = `
    SELECT 'tickets' as tbl, count(*) FROM tickets UNION ALL
    SELECT 'ticket_costs' as tbl, count(*) FROM ticket_costs UNION ALL
    SELECT 'ticket_payments' as tbl, count(*) FROM ticket_payments UNION ALL
    SELECT 'ticket_evidences' as tbl, count(*) FROM ticket_evidences UNION ALL
    SELECT 'tickets_v3' as tbl, count(*) FROM tickets_v3;
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
