import { Client } from 'ssh2';

const conn = new Client();

conn.on('ready', () => {
  console.log('Client :: ready');
  const sql = `
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    ORDER BY table_name;
  `;
  const cmd = `docker exec -i supabase-db psql -U postgres -d postgres -c "${sql}" -t`;
  
  conn.exec(cmd, (err, stream) => {
    if (err) throw err;
    let stdout = '';
    stream.on('close', async (code, signal) => {
      const tables = stdout.split('\n').map(t => t.trim()).filter(t => t.length > 0);
      console.log(`Found tables: ${tables.join(', ')}`);
      
      const counts = [];
      for (const table of tables) {
        const countSql = `SELECT COUNT(*) FROM "${table}";`;
        const countCmd = `docker exec -i supabase-db psql -U postgres -d postgres -c "${countSql}" -t`;
        await new Promise((resolve) => {
          conn.exec(countCmd, (err, stream) => {
            let countStdout = '';
            stream.on('close', () => {
              counts.push({ table, count: parseInt(countStdout.trim()) });
              resolve();
            }).on('data', (d) => {
              countStdout += d.toString();
            });
          });
        });
      }
      console.log('ROW COUNTS:');
      console.log(JSON.stringify(counts, null, 2));
      conn.end();
    }).on('data', (data) => {
      stdout += data.toString();
    });
  });
}).connect({
  host: '87.99.137.96',
  port: 22,
  username: 'root',
  password: 'etNpxhE7dKAtRA3aTVEv_Secured'
});
