import fs from 'fs';

const filePath = 'src/app/dashboard/admin/payments/page.tsx';
const content = fs.readFileSync(filePath, 'utf-8');
const query = process.argv[2];

if (!query) {
    console.error("Please provide a search query");
    process.exit(1);
}

console.log(`Searching for "${query}" in ${filePath}:`);
const lines = content.split('\n');
let count = 0;
for (let i = 0; i < lines.length; i++) {
    if (lines[i].toLowerCase().includes(query.toLowerCase())) {
        console.log(`${i + 1}: ${lines[i].trim()}`);
        count++;
        if (count > 50) {
            console.log("...more than 50 matches, truncating");
            break;
        }
    }
}
