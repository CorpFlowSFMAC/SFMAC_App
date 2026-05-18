
const fs = require('fs');
const content = fs.readFileSync('.env.local', 'utf8');
const lines = content.split('\n');
lines.forEach(line => {
    if (line.includes('SERVICE') || line.includes('KEY') || line.includes('URL')) {
        console.log(line);
    }
});
