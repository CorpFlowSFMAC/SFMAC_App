/**
 * Script de Diagnóstico - Tickets Julio 2026
 * Ejecutar: node scratch/diagnose_july2026.mjs
 * 
 * Requiere variables de entorno:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from '@supabase/supabase-js';

// Configuración
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('ERROR: Faltan variables de entorno');
    console.error('Necesitas:');
    console.error('  NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co');
    console.error('  SUPABASE_SERVICE_ROLE_KEY=eyJxxx');
    process.exit(1);
}

const client = createClient(supabaseUrl, supabaseServiceKey);

const PERU_TIMEZONE = 'America/Lima';

function getYearMonthLima(dateStr) {
    if (!dateStr) return null;
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return null;
    
    const formatter = new Intl.DateTimeFormat("en-US", {
        timeZone: PERU_TIMEZONE,
        year: "numeric", month: "2-digit"
    });
    const parts = formatter.formatToParts(d);
    const year = parseInt(parts.find(p => p.type === "year").value, 10);
    const month = parseInt(parts.find(p => p.type === "month").value, 10);
    return { year, month };
}

async function runDiagnostics() {
    console.log('='.repeat(60));
    console.log('DIAGNOSTICO: Tickets de Julio 2026');
    console.log('='.repeat(60));
    console.log(`Supabase: ${supabaseUrl}`);
    console.log(`Zona horaria: ${PERU_TIMEZONE}`);
    console.log('');

    // Período de julio 2026
    const JULIO_2026 = { year: 2026, month: 7 };

    try {
        // 1. Obtener TODOS los tickets con status ticket_cerrado o liquidado
        console.log('1. CONSULTANDO TICKETS CON ESTADO ticket_cerrado o liquidado...');
        
        const { data: tickets, error } = await client
            .from('tickets')
            .select('id, status_id, estadoId, created_at, closure_date, updated_at, total_quoted_amount, montoFinal, ingresos_reales, client_ticket_number')
            .or('status_id.ilike.%ticket_cerrado%,status_id.ilike.%liquidado%')
            .order('closure_date', { ascending: false });

        if (error) {
            console.error('ERROR en consulta:', error.message);
            return;
        }

        console.log(`   Total tickets con estado de cierre: ${tickets?.length || 0}`);
        console.log('');

        // 2. Analizar cada ticket
        const analysis = (tickets || []).map((t) => {
            const closureDateLima = getYearMonthLima(t.closure_date);
            const updatedAtLima = getYearMonthLima(t.updated_at);
            
            // UTC dates
            const closureUTC = t.closure_date ? new Date(t.closure_date) : null;
            
            // Verificar si califica para julio 2026
            const qualifiesByClosure = closureDateLima?.year === JULIO_2026.year && closureDateLima?.month === JULIO_2026.month;
            const qualifiesByUpdate = updatedAtLima?.year === JULIO_2026.year && updatedAtLima?.month === JULIO_2026.month;
            
            return {
                id: t.id,
                client_ticket_number: t.client_ticket_number,
                status_id: t.status_id,
                created_at: t.created_at,
                closure_date: t.closure_date,
                updated_at: t.updated_at,
                // Análisis en Lima
                closureDateLima,
                updatedAtLima,
                // Análisis UTC
                closureDateUTC: closureUTC ? {
                    year: closureUTC.getFullYear(),
                    month: closureUTC.getMonth() + 1
                } : null,
                // Resultados
                qualifiesForJuly2026: qualifiesByClosure || qualifiesByUpdate,
                qualifyingField: qualifiesByClosure ? 'closure_date' : qualifiesByUpdate ? 'updated_at' : null,
                // Montos
                total_quoted_amount: t.total_quoted_amount,
                montoFinal: t.montoFinal,
                ingresos_reales: t.ingresos_reales
            };
        });

        // 3. Filtrar los que califican
        const qualifyingTickets = analysis.filter(t => t.qualifiesForJuly2026);
        const nonQualifying = analysis.filter(t => !t.qualifiesForJuly2026);

        console.log('2. RESUMEN DE ANALISIS:');
        console.log(`   Tickets que califican para Julio 2026: ${qualifyingTickets.length}`);
        console.log(`   Tickets que NO califican: ${nonQualifying.length}`);
        console.log('');

        // 4. Mostrar tickets que califican
        console.log('3. TICKETS QUE CALIFICAN PARA JULIO 2026:');
        console.log('-'.repeat(60));
        
        if (qualifyingTickets.length === 0) {
            console.log('   NO HAY TICKETS que califiquen para Julio 2026');
            console.log('   Esto explica el "Total: 0 registros" en el modal');
        } else {
            qualifyingTickets.forEach((t, i) => {
                console.log(`\n   [${i + 1}] ID: ${t.id}`);
                console.log(`       Ticket: ${t.client_ticket_number || 'N/A'}`);
                console.log(`       Status: ${t.status_id}`);
                console.log(`       closure_date (original): ${t.closure_date}`);
                console.log(`       closure_date (Lima): ${t.closureDateLima?.year}-${String(t.closureDateLima?.month).padStart(2, '0')}`);
                console.log(`       closure_date (UTC): ${t.closureDateUTC?.year}-${String(t.closureDateUTC?.month).padStart(2, '0')}`);
                console.log(`       Califica por: ${t.qualifyingField}`);
                console.log(`       Monto: S/ ${t.total_quoted_amount || t.montoFinal || 0}`);
            });
        }
        
        console.log('\n' + '-'.repeat(60));

        // 5. Mostrar algunos que NO califican (para comparar)
        if (nonQualifying.length > 0) {
            console.log('\n4. MUESTRA DE TICKETS QUE NO CALIFICAN:');
            console.log('-'.repeat(60));
            
            nonQualifying.slice(0, 5).forEach((t, i) => {
                console.log(`\n   [${i + 1}] ID: ${t.id}`);
                console.log(`       Ticket: ${t.client_ticket_number || 'N/A'}`);
                console.log(`       Status: ${t.status_id}`);
                console.log(`       closure_date: ${t.closure_date || 'NULL'}`);
                console.log(`       closureDateLima: ${t.closureDateLima ? `${t.closureDateLima.year}-${String(t.closureDateLima.month).padStart(2, '0')}` : 'N/A'}`);
                console.log(`       closureDateUTC: ${t.closureDateUTC ? `${t.closureDateUTC.year}-${String(t.closureDateUTC.month).padStart(2, '0')}` : 'N/A'}`);
            });
        }

        // 6. Diagnóstico específico
        console.log('\n' + '='.repeat(60));
        console.log('CONCLUSION:');
        console.log('='.repeat(60));
        
        if (qualifyingTickets.length === 0) {
            console.log('❌ NO HAY tickets con closure_date en Julio 2026');
            console.log('   Possible reasons:');
            console.log('   1. Los tickets fueron cerrados en meses anteriores');
            console.log('   2. Los tickets no tienen closure_date populated');
            console.log('   3. Los tickets aún no están en estado ticket_cerrado/liquidado');
            
            // Verificar si hay tickets sin closure_date
            const sinClosureDate = tickets.filter(t => !t.closure_date);
            console.log(`\n   Tickets con estado de cierre pero SIN closure_date: ${sinClosureDate.length}`);
        } else {
            console.log(`✅ ${qualifyingTickets.length} tickets califican para Julio 2026`);
            console.log('   El problema puede estar en otra parte del código');
        }

    } catch (err) {
        console.error('ERROR:', err.message);
    }
}

runDiagnostics();
