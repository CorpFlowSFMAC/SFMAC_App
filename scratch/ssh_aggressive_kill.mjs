import { Client } from 'ssh2';

let isRetrying = false;

function tryConnect(attempt = 1) {
    if (isRetrying) return;
    isRetrying = true;

    console.log(`SSH Connection Attempt #${attempt}...`);
    const conn = new Client();
    
    let hasFailed = false;
    const handleFailure = (msg) => {
        if (hasFailed) return;
        hasFailed = true;
        conn.end();
        console.log(`Attempt #${attempt} failed: ${msg}. Retrying in 5 seconds...`);
        setTimeout(() => {
            isRetrying = false;
            tryConnect(attempt + 1);
        }, 5000);
    };

    conn.on('ready', () => {
        console.log('SSH connection established successfully! Sending kill commands...');
        conn.exec('pkill -9 node || killall -9 node', (err, stream) => {
            if (err) {
                handleFailure(err.message);
                return;
            }
            stream.on('close', (code, signal) => {
                console.log('Successfully killed all node processes on server!');
                conn.end();
                process.exit(0);
            }).on('data', (data) => {
                process.stdout.write(data.toString());
            }).stderr.on('data', (data) => {
                process.stderr.write(data.toString());
            });
        });
    }).on('error', (err) => {
        handleFailure(err.message);
    });

    conn.connect({
        host: '87.99.137.96',
        port: 22,
        username: 'root',
        password: 'etNpxhE7dKAtRA3aTVEv_Secured',
        readyTimeout: 15000 // 15 seconds to give it a decent chance
    });
}

tryConnect();
