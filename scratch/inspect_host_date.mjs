import { Client } from 'ssh2';

const conn = new Client();

conn.on('ready', () => {
    console.log('SSH Connection established.');
    
    conn.exec('date && date -u && timedatectl', (err, stream) => {
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
    });
}).connect({
    host: '87.99.137.96',
    port: 22,
    username: 'root',
    password: 'etNpxhE7dKAtRA3aTVEv_Secured'
});
