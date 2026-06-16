const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://api.sinfimac.pe';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNvcnBmbG93c2ZtYWMtaGV0em5lciIsInJvbGUiOiJzZXJ2aWNlX3JvbGUiLCJpYXQiOjE3Nzg3NDg1NjksImV4cCI6MjA4NTcyOTI5NH0.vLLePfYAiz9YCvJEIwk-YLx2RXgyLNCKHMVHlc2vAEc';

const supabase = createClient(supabaseUrl, supabaseKey);

async function updateTicket() {
    console.log("Fetching tickets to find 2fcb39f0...");
    const { data: tickets, error: searchError } = await supabase
        .from('tickets')
        .select('id, status_id');

    if (searchError) {
        console.error("Search Error:", searchError);
        return;
    }

    const targetTicket = tickets.find(t => t.id.startsWith('2fcb39f0'));

    if (!targetTicket) {
        console.log("No ticket found with prefix 2fcb39f0.");
        return;
    }

    const ticketId = targetTicket.id;
    console.log(`Found ticket: ${ticketId}`);

    const { data, error } = await supabase
        .from('tickets')
        .update({ status_id: 'documentacion_enviada', updated_at: new Date().toISOString() })
        .eq('id', ticketId)
        .select();

    if (error) {
        console.error("Update Error:", error);
    } else {
        console.log("Update Success:", data);
    }
}

updateTicket();
