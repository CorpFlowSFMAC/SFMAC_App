const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://api.sinfimac.pe';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNvcnBmbG93c2ZtYWMtaGV0em5lciIsInJvbGUiOiJzZXJ2aWNlX3JvbGUiLCJpYXQiOjE3Nzg3NDg1NjksImV4cCI6MjA4NTcyOTI5NH0.vLLePfYAiz9YCvJEIwk-YLx2RXgyLNCKHMVHlc2vAEc';

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

const TICKET_ID = 'e18c4378-6b30-4973-b5c6-71f9313dd08d';

async function main() {
    // 1. Leer metadata actual
    const { data: current, error: fetchErr } = await supabase
        .from('tickets')
        .select('id, status_id, client_ticket_number, metadata')
        .eq('id', TICKET_ID)
        .single();

    if (fetchErr) { console.error('Error leyendo:', fetchErr); return; }
    console.log('Estado actual:', current.status_id, '| client_ticket_number:', current.client_ticket_number);

    // 2. Preparar metadata limpia: revertir al estado documentacion_enviada
    const newMeta = {
        ...(current.metadata || {}),
        estadoId: 'documentacion_enviada',
        solicitudLiquidacion: null,  // Limpiar solicitud de liquidación creada
        isAdminRevision: false,
    };

    // 3. Actualizar
    const { data: updated, error: updateErr } = await supabase
        .from('tickets')
        .update({
            status_id: 'documentacion_enviada',
            metadata: newMeta,
        })
        .eq('id', TICKET_ID)
        .select('id, status_id, client_ticket_number');

    if (updateErr) {
        console.error('Error actualizando:', updateErr);
        return;
    }

    console.log('\n✅ Ticket TK-313DD08D revertido a DOCUMENTACIÓN:');
    console.log('  ID:', updated[0].id);
    console.log('  Nuevo status:', updated[0].status_id);
    console.log('  client_ticket_number:', updated[0].client_ticket_number, '(la gestora debe ingresarlo ahora)');
}

main();
