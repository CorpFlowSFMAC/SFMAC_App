
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
            const content = fs.readFileSync(fullPath, 'utf8');
            const matches = content.match(/eyJ[a-zA-Z0-9_-]+\.eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/g);
            if (matches) {
                matches.forEach(match => {
                    if (!match.includes('bz2FnNU2lPSYg7phNladdHjVqw_mHWYpklHjd-A_EIY')) { // Skip known anon key
                        console.log(`Found JWT in ${fullPath}: ${match}`);
                    }
                });
            }
        }
    }
}

findJwt('.');
