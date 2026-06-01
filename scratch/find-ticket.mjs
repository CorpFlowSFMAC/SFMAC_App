import { Client } from 'ssh2';

const conn = new Client();

conn.on('ready', () => {
  console.log('Client :: ready');
  const sql = "SELECT t.id, t.ticket_number, t.status_id, t.client_ticket_number, t.created_at, t.labor_cost, t.materials_cost, t.total_quoted_amount FROM tickets t WHERE t.client_ticket_number = 'MB888888.26';";
  const sqlCosts = "SELECT tc.id, tc.monto, tc.categoria, tc.concepto, tc.estado_pago FROM ticket_costs tc WHERE tc.ticket_id = (SELECT id FROM tickets WHERE client_ticket_number = 'MB888888.26' LIMIT 1);";
  const cmd = `docker exec -i supabase-db psql -U postgres -d postgres -c "${sql}" -c "${sqlCosts}"`;
  
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
