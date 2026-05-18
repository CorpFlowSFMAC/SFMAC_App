



const supabaseUrl = 'http://87.99.137.96:8000';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzc3MjIwMzI0LCJleHAiOjIwOTI1ODAzMjR9.bz2FnNU2lPSYg7phNladdHjVqw_mHWYpklHjd-A_EIY';

async function main() {
    console.log('Fetching all tickets summary...');
    const resp = await fetch(`${supabaseUrl}/rest/v1/tickets?select=id,ticket_number,client_ticket_number&limit=1000`, {
        headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`
        }
    });

    if (!resp.ok) {
        console.error('Error:', await resp.text());
        return;
    }

    const data = await resp.json();
    console.log(`Found ${data.length} tickets.`);
    
    const targets = ['TK-7A82AB9A', 'MB000001.26'];
    const found = data.filter(t => targets.includes(t.ticket_number) || targets.includes(t.client_ticket_number));
    
    console.log('Target tickets found:', found);
}

main();
