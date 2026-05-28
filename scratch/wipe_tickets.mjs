import { Client } from 'ssh2';

const conn = new Client();

conn.on('ready', () => {
  console.log('Client :: ready');
  
  // Transacción SQL para eliminar tickets y ramificaciones
  const sql = `
    BEGIN;
    DELETE FROM ticket_costs;
    DELETE FROM ticket_evidences;
    DELETE FROM ticket_payments;
    DELETE FROM tickets;
    DELETE FROM tickets_v3;
    COMMIT;
  `;
  
  // Usamos -e para que muestre los comandos que ejecuta y falle ante cualquier error
  const cmd = `docker exec -i supabase-db psql -U postgres -d postgres -c "${sql}"`;
  
  conn.exec(cmd, (err, stream) => {
    if (err) throw err;
    let stdout = '';
    let stderr = '';
    stream.on('close', (code, signal) => {
      console.log('STDOUT:\n' + stdout);
      console.log('STDERR:\n' + stderr);
      console.log('Stream :: close :: code: ' + code);
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
