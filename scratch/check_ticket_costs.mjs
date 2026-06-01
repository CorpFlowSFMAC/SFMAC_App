import { Client } from 'ssh2';

const conn = new Client();

const sqlScript = `
SELECT id, ticket_id, monto, estado_pago, categoria, concepto, created_at 
FROM public.ticket_costs 
WHERE ticket_id = '7b9b0b61-0d56-4914-b6bb-72a99d20ef65';
`;

conn.on('ready', () => {
  console.log('SSH Connection established to check ticket costs...');
  
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
