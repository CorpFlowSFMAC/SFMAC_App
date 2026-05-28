import { Client } from 'ssh2';

const conn = new Client();
conn.on('ready', () => {
    console.log('SSH connection established to Hetzner production server.');
    
    const deployScript = `
        set -e
        echo "=== STEP 1: Cleaning and updating git clone in /opt/sinfimac-v3 ==="
        cd /opt/sinfimac-v3
        git reset --hard HEAD
        git clean -fd
        git pull origin main

        echo "=== STEP 2: Syncing source code to /opt ==="
        rsync -av --exclude=.git --exclude=node_modules --exclude=.next /opt/sinfimac-v3/ /opt/

        echo "=== STEP 3: Building Next.js application in /opt ==="
        cd /opt
        npm install
        npm run build

        echo "=== STEP 4: Restarting Next.js server ==="
        PID=$(lsof -t -i:3000 || echo "")
        if [ ! -z "$PID" ]; then
            echo "Killing old Next.js process: $PID"
            kill -9 $PID || true
        fi

        echo "Starting Next.js in background..."
        nohup npm start > /tmp/nextjs.log 2>&1 &
        
        echo "Waiting for server to start..."
        sleep 5
        
        echo "=== STEP 5: Verifying application health ==="
        curl -I http://127.0.0.1:3000/login
        
        echo "Deployment completed successfully!"
    `;

    conn.exec(deployScript, (err, stream) => {
        if (err) throw err;
        stream.on('close', (code, signal) => {
            console.log(`Connection closed with code: ${code}`);
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
