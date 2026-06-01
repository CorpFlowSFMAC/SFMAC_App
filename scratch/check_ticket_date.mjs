import { Client } from 'ssh2';

const conn = new Client();

const sqlScript = `
SELECT id, ticket_number, status_id, created_at, labor_cost, total_quoted_amount, metadata 
FROM public.tickets 
WHERE ticket_number::text LIKE '%888888%' OR client_ticket_number LIKE '%888888%';

SELECT * FROM public.vw_ticket_financials 
WHERE ticket_id IN (
    SELECT id FROM public.tickets 
    WHERE ticket_number::text LIKE '%888888%' OR client_ticket_number LIKE '%888888%'
);

SELECT * FROM public.vw_tickets_strategic 
WHERE id IN (
    SELECT id FROM public.tickets 
    WHERE ticket_number::text LIKE '%888888%' OR client_ticket_number LIKE '%888888%'
);
`;

conn.on('ready', () => {
  console.log('SSH Connection established to check ticket MB888888.26...');
  
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
