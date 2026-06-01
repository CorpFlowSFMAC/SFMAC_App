const supabaseUrl = 'https://api.sinfimac.pe';
const anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNvcnBmbG93c2ZtYWMtaGV0em5lciIsInJvbGUiOiJhbm9uIiwiaWF0IjoxNzc4NzQ4NTY5LCJleHAiOjIwODU3MjkyOTR9.UVpFZwAHuUFXKEwZANp58HP3x-9wgFGrvVY12yoC9MI';

async function main() {
    console.log("Fetching ticket MB888888.26 from REST API...");
    const res = await fetch(`${supabaseUrl}/rest/v1/vw_tickets_strategic?client_ticket_number=eq.MB888888.26`, {
        headers: {
            'apikey': anonKey,
            'Authorization': `Bearer ${anonKey}`
        }
    });
    
    const data = await res.json();
    console.log("REST API Response:", JSON.stringify(data, null, 2));
    
    if (data && data.length > 0) {
        const t = data[0];
        
        // Simulating the browser timezone offset for Peru (-5)
        const now = new Date("2026-06-01T01:00:33-05:00");
        console.log("\nSimulated Current Time (now):", now.toString());
        console.log("startOfCurrentMonth (local):", new Date(now.getFullYear(), now.getMonth(), 1).toString());
        
        const createdDate = new Date(t.created_at);
        console.log("Parsed created_at Date in Peru Local Time:", createdDate.toString());
        console.log("Parsed original_created_at in Peru Local Time:", new Date(t.original_created_at).toString());
        
        // Filter logic
        const diffMs = now.getTime() - createdDate.getTime();
        const diffDays = diffMs / (1000 * 60 * 60 * 24);
        console.log("diffDays for month filter (sliding 30 days):", diffDays);
        
        const isInRangeMonth = diffDays >= -0.2 && diffDays <= 30.2;
        console.log("isInRangeMonth (sliding 30 days):", isInRangeMonth);
        
        const isRolledOver = () => {
            const sid = t.status_id;
            const isClosed = ["ticket_cerrado", "ticket_rechazado", "ticket_cancelado"].includes(sid);
            if (isClosed) return false;

            const created = t.original_created_at ?? t.created_at;
            if (!created) return false;
            
            const origDate = new Date(created);
            const startOfCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
            return origDate < startOfCurrentMonth;
        };
        
        console.log("isRolledOver:", isRolledOver());
        
        const isTicketInPeriod = isInRangeMonth || isRolledOver();
        console.log("isTicketInPeriod:", isTicketInPeriod);
    }
}

main().catch(console.error);
