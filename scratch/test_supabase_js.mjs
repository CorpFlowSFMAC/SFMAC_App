import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://api.sinfimac.pe';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzc3MjIwMzI0LCJleHAiOjIwOTI1ODAzMjR9.bz2FnNU2lPSYg7phNladdHjVqw_mHWYpklHjd-A_EIY';

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
    console.log("Checking vw_tickets_strategic via Supabase JS...");
    const { data, error } = await supabase
        .from('vw_tickets_strategic')
        .select('*')
        .limit(1);
    
    if (error) {
        console.error("Error:", error);
    } else {
        console.log("Success! Data:", data);
    }
}

main();
