import { Client } from 'ssh2';

const conn = new Client();

const sql = "SELECT pg_get_viewdef('vw_ticket_financials'::regclass);";
const cmd = `docker exec supabase-db psql -U postgres -d postgres -t -A -c "${sql}"`;

conn.on('ready', () => {
  conn.exec(cmd, (err, stream) => {
    if (err) throw err;
    let output = '';
    stream.on('close', (code, signal) => {
      console.log('--- VIEW DEFINITION START ---');
      console.log(output);
      console.log('--- VIEW DEFINITION END ---');
      conn.end();
    }).on('data', (data) => {
      output += data.toString();
    }).stderr.on('data', (data) => {
      console.log('STDERR: ' + data.toString());
    });
  });
}).connect({
  host: '87.99.137.96',
  port: 22,
  username: 'root',
  password: 'etNpxhE7dKAtRA3aTVEv_Secured'
});
