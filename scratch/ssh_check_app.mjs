import { Client } from 'ssh2';

const conn = new Client();
conn.on('ready', () => {
    console.log('SSH connection established to Hetzner production server.');
    
    // Run diagnostic commands: docker ps, pm2 status, etc.
    conn.exec('docker ps && echo "=== PM2 STATUS ===" && (pm2 status || echo "pm2 not installed") && echo "=== SYSTEM LOGS OR STATUS ===" && (systemctl status || echo "no systemctl")', (err, stream) => {
        if (err) throw err;
        stream.on('close', (code, signal) => {
            conn.end();
        }).on('data', (data) => {
            process.stdout.write(data.toString());
        }).stderr.on('data', (data) => {
            process.stderr.write(data.toString());
        });
    });
}).connect({
    host: '87.99.137.96',
    port: 22,
    username: 'root',
    password: 'etNpxhE7dKAtRA3aTVEv_Secured'
});
