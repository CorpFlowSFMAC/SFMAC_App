import { Client } from 'ssh2';

const conn = new Client();

const sqlQuery = `
\\echo '--- COSTS WITH 400 OR ADELANTO ---'
SELECT id, ticket_id, concepto, categoria, monto, estado_pago 
FROM ticket_costs 
WHERE monto = 400 OR estado_pago = 'adelanto' OR categoria = 'Adelanto' OR categoria = 'Adelanto Operativo'
LIMIT 10;

\\echo '--- CURRENT VIEW DEFINITION ---'
SELECT pg_get_viewdef('vw_ticket_financials'::regclass);
`;

conn.on('ready', () => {
    console.log('SSH Connection established.');
    
    const cmd = 'docker exec -i supabase-db psql -U postgres -d postgres';
    conn.exec(cmd, (err, stream) => {
        if (err) {
            console.error('Failed to execute command:', err);
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
        
        stream.write(sqlQuery);
        stream.end();
    });
}).connect({
    host: '87.99.137.96',
    port: 22,
    username: 'root',
    password: 'etNpxhE7dKAtRA3aTVEv_Secured'
});
