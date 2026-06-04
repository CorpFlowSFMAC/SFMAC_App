const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

function loadEnv(file) {
  const filePath = path.join(__dirname, '..', file);
  if (!fs.existsSync(filePath)) return;
  const content = fs.readFileSync(filePath, 'utf8');
  content.split('\n').forEach(line => {
    const match = line.match(/^\s*([^#=]+)\s*=\s*(.*)\s*$/);
    if (match) {
      const key = match[1].trim();
      let val = match[2].trim();
      if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
      if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1);
      process.env[key] = val;
    }
  });
}

loadEnv('.env');
loadEnv('.env.local');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://api.sinfimac.pe';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const client = createClient(supabaseUrl, supabaseAnonKey);

async function main() {
  const { data, error } = await client
    .from('vw_tickets_strategic')
    .select('*')
    .limit(1);

  if (error) {
    console.error('Error:', error);
  } else {
    console.log('Keys in vw_tickets_strategic record:', Object.keys(data[0]));
    console.log('Sample record details:', JSON.stringify(data[0], null, 2));
  }
}

main().catch(console.error);
