const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://api.sinfimac.pe';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNvcnBmbG93c2ZtYWMtaGV0em5lciIsInJvbGUiOiJzZXJ2aWNlX3JvbGUiLCJpYXQiOjE3Nzg3NDg1NjksImV4cCI6MjA4NTcyOTI5NH0.vLLePfYAiz9YCvJEIwk-YLx2RXgyLNCKHMVHlc2vAEc';

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
const TICKET_ID = 'e18c4378-6b30-4973-b5c6-71f9313dd08d';

async function main() {
    // Ver estado actual en BD
    const { data, error } = await supabase
        .from('tickets')
        .select('id, status_id, client_ticket_number, metadata')
        .eq('id', TICKET_ID)
        .single();

    if (error) { console.error('Error:', error); return; }
    
    console.log('=== ESTADO ACTUAL EN BD ===');
    console.log('status_id:', data.status_id);
    console.log('client_ticket_number:', data.client_ticket_number);
    console.log('metadata.estadoId:', data.metadata?.estadoId);
    console.log('metadata.solicitudLiquidacion:', JSON.stringify(data.metadata?.solicitudLiquidacion));
    console.log('metadata.isAdminRevision:', data.metadata?.isAdminRevision);
    console.log('\n=== METADATA COMPLETA ===');
    const { solicitudLiquidacion, estadoId, ...rest } = data.metadata || {};
    console.log('Claves del metadata:', Object.keys(data.metadata || {}));
}

main();
