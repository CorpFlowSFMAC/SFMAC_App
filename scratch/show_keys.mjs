import fs from 'fs';

const content = fs.readFileSync('.env.local', 'utf-8');
const lines = content.split('\n');
for (const line of lines) {
    if (line.includes('SUPABASE_URL') || line.includes('ANON_KEY') || line.includes('SERVICE_KEY') || line.includes('SERVICE_ROLE')) {
        console.log(line.trim());
    }
}
