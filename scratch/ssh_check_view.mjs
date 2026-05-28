import { Client } from 'ssh2';

const conn = new Client();
const cmd = process.argv.slice(2).join(' ') || 'ls -la /opt';

conn.on('ready', () => {
    conn.exec(cmd, (err, stream) => {
        if (err) throw err;
        stream.on('close', (code, signal) => {
            conn.end();
        }).on('data', (data) => {
            process.stdout.write(data.toString());
        }).stderr.on('data', (data) => {
            process.stderr.write(data.toString());
        });
    });
}).on('error', (err) => {
    console.error('SSH connection error:', err.message);
}).connect({
    host: '87.99.137.96',
    port: 22,
    username: 'root',
    password: 'etNpxhE7dKAtRA3aTVEv_Secured',
    readyTimeout: 60000
});
