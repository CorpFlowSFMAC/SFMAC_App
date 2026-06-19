const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://api.sinfimac.pe';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNvcnBmbG93c2ZtYWMtaGV0em5lciIsInJvbGUiOiJzZXJ2aWNlX3JvbGUiLCJpYXQiOjE3Nzg3NDg1NjksImV4cCI6MjA4NTcyOTI5NH0.vLLePfYAiz9YCvJEIwk-YLx2RXgyLNCKHMVHlc2vAEc';

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
const TICKET_ID = 'e18c4378-6b30-4973-b5c6-71f9313dd08d';

async function main() {
    console.log('Leyendo estado actual...');
    const { data: current } = await supabase
        .from('tickets')
        .select('status_id, metadata, client_ticket_number')
        .eq('id', TICKET_ID)
        .single();

    console.log('status_id actual:', current.status_id);
    console.log('metadata.estadoId:', current.metadata?.estadoId);
    console.log('metadata.numeroTicketCliente:', current.metadata?.numeroTicketCliente);
    console.log('client_ticket_number (columna):', current.client_ticket_number);

    // Construir metadata limpia: revertir TODO a documentacion_enviada
    // y setear el client_ticket_number en metadata.numeroTicketCliente también
    const newMeta = {
        ...(current.metadata || {}),
        estadoId: 'documentacion_enviada',
        status_id: 'documentacion_enviada',
        solicitudLiquidacion: null,
        isAdminRevision: false,
        // Limpiar el número de ticket del cliente para que la gestora lo ingrese correctamente
        numeroTicketCliente: null,
        client_ticket_number: null,
    };

    console.log('\nAplicando rollback completo a documentacion_enviada...');
    const { data: updated, error } = await supabase
        .from('tickets')
        .update({
            status_id: 'documentacion_enviada',
            client_ticket_number: null,
            metadata: newMeta,
        })
        .eq('id', TICKET_ID)
        .select('id, status_id, client_ticket_number');

    if (error) {
        console.error('ERROR al actualizar:', error);
        return;
    }

    console.log('\n✅ ROLLBACK APLICADO:');
    console.log('  status_id:', updated[0].status_id);
    console.log('  client_ticket_number:', updated[0].client_ticket_number);
    console.log('\nVerificando en BD...');
    
    // Verificar
    const { data: verify } = await supabase
        .from('tickets')
        .select('status_id, client_ticket_number, metadata')
        .eq('id', TICKET_ID)
        .single();
    
    console.log('VERIFICACIÓN FINAL:');
    console.log('  status_id en BD:', verify.status_id);
    console.log('  client_ticket_number en BD:', verify.client_ticket_number);
    console.log('  metadata.estadoId:', verify.metadata?.estadoId);
    console.log('  metadata.solicitudLiquidacion:', verify.metadata?.solicitudLiquidacion);
}

main();
