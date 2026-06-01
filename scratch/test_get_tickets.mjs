import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://api.sinfimac.pe';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNvcnBmbG93c2ZtYWMtaGV0em5lciIsInJvbGUiOiJhbm9uIiwiaWF0IjoxNzc4NzQ4NTY5LCJleHAiOjIwODU3MjkyOTR9.UVpFZwAHuUFXKEwZANp58HP3x-9wgFGrvVY12yoC9MI';

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
    console.log("Fetching all tickets from Supabase JS...");
    const { data, error } = await supabase
        .from('tickets')
        .select('*')
        .limit(5);
    
    if (error) {
        console.error("Error:", error);
    } else {
        console.log("Success! Count:", data?.length, "Data:", data);
    }
}

main();
