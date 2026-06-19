const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://api.sinfimac.pe';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNvcnBmbG93c2ZtYWMtaGV0em5lciIsInJvbGUiOiJzZXJ2aWNlX3JvbGUiLCJpYXQiOjE3Nzg3NDg1NjksImV4cCI6MjA4NTcyOTI5NH0.vLLePfYAiz9YCvJEIwk-YLx2RXgyLNCKHMVHlc2vAEc';

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

async function main() {
    // El ticket ID en la captura dice "#3dd08d" - buscar los últimos tickets de MiBanco
    // con status por_liquidar para encontrar el correcto
    const { data, error } = await supabase
        .from('tickets')
        .select('id, client_ticket_number, status_id')
        .in('status_id', ['por_liquidar', 'documentacion_enviada', 'requiere_revision_admin'])
        .order('created_at', { ascending: false })
        .limit(20);

    if (error) {
        console.error('Error:', error);
        return;
    }

    console.log('Tickets recientes en por_liquidar/documentacion:');
    data.forEach(t => {
        const shortId = t.id.slice(-8);
        const match = shortId.includes('3dd08d') || t.id.includes('3dd08d');
        console.log(`${match ? '>>> MATCH <<<' : '          '} id=${t.id}  short=${shortId}  status=${t.status_id}  client_ticket=${t.client_ticket_number}`);
    });
}

main();
