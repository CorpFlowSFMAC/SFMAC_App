import { Client } from 'ssh2';

const conn = new Client();

const sql = process.argv[2] || "SELECT datname FROM pg_database;";
const db = process.argv[3] || "postgres";
const cmd = `docker exec supabase-db psql -U postgres -d ${db} -c "${sql}"`;

conn.on('ready', () => {
  console.log(`Running on DB '${db}': ${sql}`);
  conn.exec(cmd, (err, stream) => {
    if (err) throw err;
    stream.on('close', (code, signal) => {
      conn.end();
    }).on('data', (data) => {
      console.log(data.toString());
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
