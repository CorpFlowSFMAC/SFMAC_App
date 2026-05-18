
const fs = require('fs');
const path = require('path');

function findJwt(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            if (file !== 'node_modules' && file !== '.git') {
                findJwt(fullPath);
            }
        } else {
            try {
                const content = fs.readFileSync(fullPath, 'utf8');
                const matches = content.match(/eyJ[a-zA-Z0-9_-]+\.eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/g);
                if (matches) {
                    matches.forEach(match => {
                        const parts = match.split('.');
                        if (parts.length === 3) {
                            try {
                                const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
                                if (payload.role === 'service_role') {
                                    console.log(`Found SERVICE_ROLE JWT in ${fullPath}: ${match}`);
                                } else if (payload.role === 'admin') {
                                    console.log(`Found ADMIN JWT in ${fullPath}: ${match}`);
                                }
                            } catch (e) {}
                        }
                    });
                }
            } catch (e) {}
        }
    }
}

findJwt('.');
