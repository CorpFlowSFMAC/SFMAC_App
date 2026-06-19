const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://api.sinfimac.pe';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNvcnBmbG93c2ZtYWMtaGV0em5lciIsInJvbGUiOiJzZXJ2aWNlX3JvbGUiLCJpYXQiOjE3Nzg3NDg1NjksImV4cCI6MjA4NTcyOTI5NH0.vLLePfYAiz9YCvJEIwk-YLx2RXgyLNCKHMVHlc2vAEc';

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
const TICKET_ID = 'e18c4378-6b30-4973-b5c6-71f9313dd08d';

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function applyRollback() {
    const { data: current } = await supabase
        .from('tickets')
        .select('status_id, metadata, client_ticket_number')
        .eq('id', TICKET_ID)
        .single();

    console.log(`[${new Date().toISOString()}] status_id actual: ${current.status_id}`);

    const newMeta = {
        ...(current.metadata || {}),
        estadoId: 'documentacion_enviada',
        status_id: 'documentacion_enviada',
        solicitudLiquidacion: null,
        isAdminRevision: false,
        numeroTicketCliente: null,
        client_ticket_number: null,
    };

    const { data: updated, error } = await supabase
        .from('tickets')
        .update({
            status_id: 'documentacion_enviada',
            client_ticket_number: null,
            metadata: newMeta,
        })
        .eq('id', TICKET_ID)
        .select('status_id');

    if (error) { console.error('Error:', error); return false; }
    console.log(`[${new Date().toISOString()}] Rollback aplicado → status: ${updated[0].status_id}`);
    return true;
}

async function main() {
    // Aplicar 3 veces con 8 segundos de espera para ganarle al syncToSupabase del browser
    for (let i = 1; i <= 3; i++) {
        console.log(`\n=== Intento ${i}/3 ===`);
        await applyRollback();
        if (i < 3) {
            console.log('Esperando 8s antes del siguiente intento...');
            await delay(8000);
        }
    }

    // Verificación final
    console.log('\n=== VERIFICACIÓN FINAL ===');
    const { data } = await supabase
        .from('tickets')
        .select('status_id, client_ticket_number, metadata')
        .eq('id', TICKET_ID)
        .single();
    
    console.log('status_id:', data.status_id);
    console.log('metadata.estadoId:', data.metadata?.estadoId);
    console.log('client_ticket_number:', data.client_ticket_number);
    
    if (data.status_id === 'documentacion_enviada') {
        console.log('\n✅ TICKET CONFIRMADO EN DOCUMENTACION_ENVIADA');
        console.log('⚠️  IMPORTANTE: La gestora debe cerrar y reabrir el ticket en el browser');
        console.log('   para que la UI refleje el nuevo estado.');
    } else {
        console.log('\n❌ El browser está sobreescribiendo el estado. La gestora debe cerrar el ticket en el navegador.');
    }
}

main();
