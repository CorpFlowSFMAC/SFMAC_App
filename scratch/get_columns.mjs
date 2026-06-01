import { Client } from 'ssh2';

const conn = new Client();

const sqlScript = `
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'tickets' 
ORDER BY ordinal_position;

SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'ticket_costs' 
ORDER BY ordinal_position;
`;

conn.on('ready', () => {
  console.log('SSH Connection established to fetch columns...');
  
  const cmd = 'docker exec -i supabase-db psql -U postgres -d postgres';
  conn.exec(cmd, (err, stream) => {
    if (err) {
      console.error('Failed to execute docker exec psql via SSH:', err);
      conn.end();
      return;
    }
    
    let stdout = '';
    let stderr = '';
    
    stream.on('data', (chunk) => {
      stdout += chunk.toString();
    });
    
    stream.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    
    stream.on('close', (code, signal) => {
      console.log('--- STDOUT ---');
      console.log(stdout);
      console.log('--- STDERR ---');
      console.log(stderr);
      conn.end();
    });
    
    stream.write(sqlScript);
    stream.end();
  });
}).connect({
  host: '87.99.137.96',
  port: 22,
  username: 'root',
  password: 'etNpxhE7dKAtRA3aTVEv_Secured'
});
