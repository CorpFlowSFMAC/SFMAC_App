const supabaseUrl = 'http://87.99.137.96:8000';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzc3MjIwMzI0LCJleHAiOjIwOTI1ODAzMjR9.bz2FnNU2lPSYg7phNladdHjVqw_mHWYpklHjd-A_EIY';

async function main() {
    console.log("Fetching vw_tickets_strategic via PostgREST...");
    try {
        const res = await fetch(`${supabaseUrl}/rest/v1/vw_tickets_strategic?select=*&limit=1`, {
            headers: {
                'apikey': supabaseKey,
                'Authorization': `Bearer ${supabaseKey}`
            }
        });
        
        console.log("Status:", res.status);
        const text = await res.text();
        console.log("Response:", text);
    } catch (e) {
        console.error("Fetch error:", e);
    }
}
main();
