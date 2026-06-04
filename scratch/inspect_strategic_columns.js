const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://api.sinfimac.pe';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNvcnBmbG93c2ZtYWMtaGV0em5lciIsInJvbGUiOiJhbm9uIiwiaWF0IjoxNzc4NzQ4NTY5LCJleHAiOjIwODU3MjkyOTR9.UVpFZwAHuUFXKEwZANp58HP3x-9wgFGrvVY12yoC9MI';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function main() {
  const { data, error } = await supabase.from('vw_tickets_strategic').select('*').limit(1);
  if (error) {
    console.error('Error fetching strategic ticket:', error);
    return;
  }
  if (data && data.length > 0) {
    console.log('Keys of vw_tickets_strategic ticket:', Object.keys(data[0]));
    console.log('Sample ticket:', JSON.stringify(data[0], null, 2));
  } else {
    console.log('No tickets found in vw_tickets_strategic');
  }
}

main().catch(console.error);
