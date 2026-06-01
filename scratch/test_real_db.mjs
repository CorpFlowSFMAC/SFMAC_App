import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://api.sinfimac.pe';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNvcnBmbG93c2ZtYWMtaGV0em5lciIsInJvbGUiOiJhbm9uIiwiaWF0IjoxNzc4NzQ4NTY5LCJleHAiOjIwODU3MjkyOTR9.UVpFZwAHuUFXKEwZANp58HP3x-9wgFGrvVY12yoC9MI';

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
    console.log("Checking tickets via Supabase JS with production key...");
    const { data, error } = await supabase
        .from('tickets')
        .select('*, clients(*)')
        .limit(1);
    
    if (error) {
        console.error("Error:", error);
    } else {
        console.log("Success! Data:", data);
    }
}

main();
