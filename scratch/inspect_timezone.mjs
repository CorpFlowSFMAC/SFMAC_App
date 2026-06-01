import { Client } from 'ssh2';

const conn = new Client();

const sqlQuery = `
\\echo '--- TICKETS COLUMN TYPES ---'
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'tickets' AND column_name IN ('created_at', 'updated_at');

\\echo '--- TIMEZONE AND NOW ---'
SELECT now() as postgres_now, now() AT TIME ZONE 'UTC' as postgres_utc, current_setting('timezone') as postgres_timezone;

\\echo '--- SAMPLE TICKETS ---'
SELECT id, ticket_number, created_at FROM tickets ORDER BY created_at DESC LIMIT 5;
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
