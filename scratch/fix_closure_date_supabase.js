/**
 * Script para corregir closure_date NULL usando Supabase JS Client
 * Ejecutar: node scratch/fix_closure_date_supabase.js
 */

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://api.sinfimac.pe';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNvcnBmbG93c2ZtYWMtaGV0em5lciIsInJvbGUiOiJzZXJ2aWNlX3JvbGUiLCJpYXQiOjE3Nzg3NDg1NjksImV4cCI6MjA4NTcyOTI5NH0.vLLePfYAiz9YCvJEIwk-YLx2RXgyLNCKHMVHlc2vAEc';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function runFix() {
    console.log('='.repeat(60));
    console.log('CORRECCION DE closure_date NULL');
    console.log('='.repeat(60));
    console.log(`Supabase: ${SUPABASE_URL}`);
    console.log('');

    try {
        // ============================================================
        // TAREA 1: UPDATE - Reparar tickets con closure_date NULL
        // ============================================================
        console.log('📋 TAREA 1: Actualizando tickets con closure_date NULL...');

        // Obtener los tickets a actualizar
        const { data: ticketsToUpdate, error: fetchError } = await supabase
            .from('tickets')
            .select('id, updated_at')
            .eq('status_id', 'ticket_cerrado')
            .is('closure_date', null);

        if (fetchError) {
            console.error('❌ Error al obtener tickets:', fetchError.message);
            return;
        }

        const countToUpdate = ticketsToUpdate?.length || 0;
        console.log(`   Tickets a actualizar: ${countToUpdate}`);

        if (countToUpdate > 0) {
            let updatedCount = 0;
            let errorCount = 0;
            const sampleUpdated = [];

            // Actualizar cada ticket
            for (const ticket of ticketsToUpdate) {
                const { error: updateError } = await supabase
                    .from('tickets')
                    .update({ closure_date: ticket.updated_at })
                    .eq('id', ticket.id);

                if (updateError) {
                    errorCount++;
                    console.error(`   Error actualizando ${ticket.id}: ${updateError.message}`);
                } else {
                    updatedCount++;
                    if (sampleUpdated.length < 5) {
                        sampleUpdated.push({
                            id: ticket.id.slice(0, 8) + '...',
                            updated_at: ticket.updated_at,
                            closure_date: ticket.updated_at
                        });
                    }
                }
            }

            console.log(`   ✅ Tickets actualizados: ${updatedCount}`);
            console.log(`   ❌ Errores: ${errorCount}`);

            if (sampleUpdated.length > 0) {
                console.log('\n   Ejemplos de tickets actualizados:');
                sampleUpdated.forEach((t, i) => {
                    console.log(`   [${i+1}] ID: ${t.id} | closure_date: ${t.closure_date}`);
                });
            }
        } else {
            console.log('   ℹ️  No hay tickets que actualizar');
        }

        // ============================================================
        // TAREA 2: Verificación
        // ============================================================
        console.log('\n📋 VERIFICACION...');

        // Contar tickets ticket_cerrado sin closure_date
        const { count: remainingNull } = await supabase
            .from('tickets')
            .select('id', { count: 'exact', head: true })
            .eq('status_id', 'ticket_cerrado')
            .is('closure_date', null);

        // Contar total ticket_cerrado
        const { count: totalClosed } = await supabase
            .from('tickets')
            .select('id', { count: 'exact', head: true })
            .eq('status_id', 'ticket_cerrado');

        // Contar los de julio 2026
        const { data: julyTickets } = await supabase
            .from('tickets')
            .select('id, closure_date')
            .eq('status_id', 'ticket_cerrado')
            .gte('closure_date', '2026-07-01')
            .lt('closure_date', '2026-08-01');

        console.log(`   Total tickets ticket_cerrado: ${totalClosed || 0}`);
        console.log(`   Con closure_date NULL: ${remainingNull || 0}`);
        console.log(`   Con closure_date en Julio 2026: ${julyTickets?.length || 0}`);

        if ((remainingNull || 0) === 0 && (julyTickets?.length || 0) > 0) {
            console.log('\n   🎉 ¡CORRECCION COMPLETADA! El dashboard debería mostrar datos ahora.');
        }

        console.log('\n' + '='.repeat(60));
        console.log('NOTA: El TRIGGER debe crearse manualmente.');
        console.log('Ver archivo: scratch/create_trigger.sql');
        console.log('='.repeat(60));

    } catch (err) {
        console.error('❌ ERROR:', err.message);
    }
}

runFix();
