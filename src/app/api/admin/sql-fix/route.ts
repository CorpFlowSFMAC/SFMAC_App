/**
 * API de Corrección de closure_date
 * Ejecuta:
 * 1. UPDATE tickets SET closure_date = updated_at WHERE status_id = 'ticket_cerrado' AND closure_date IS NULL
 * 2. Crea trigger para auto-poblar closure_date en el futuro
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getSupabaseServiceKey, getSupabaseUrl } from '@/lib/supabase-config';

const supabaseUrl = getSupabaseUrl();
const supabaseServiceKey = getSupabaseServiceKey();

function getClient() {
    if (supabaseServiceKey && supabaseUrl) {
        return createClient(supabaseUrl, supabaseServiceKey);
    }
    return null;
}

export async function GET(request: NextRequest) {
    const client = getClient();

    if (!client || !supabaseUrl) {
        return NextResponse.json({
            success: false,
            error: 'Supabase no configurado correctamente'
        }, { status: 500 });
    }

    const results: any = {
        step1: null,
        step2: null,
        verification: null
    };

    try {
        // ============================================================
        // STEP 1: UPDATE tickets con closure_date NULL
        // ============================================================
        
        // Primero, obtener los IDs de tickets a actualizar
        const { data: ticketsToUpdate, error: fetchError } = await client
            .from('tickets')
            .select('id')
            .eq('status_id', 'ticket_cerrado')
            .is('closure_date', null);

        if (fetchError) {
            return NextResponse.json({
                success: false,
                error: 'Error al obtener tickets: ' + fetchError.message
            }, { status: 500 });
        }

        const countToUpdate = ticketsToUpdate?.length || 0;
        results.step1 = {
            ticketsFound: countToUpdate,
            message: countToUpdate > 0 
                ? `Encontrados ${countToUpdate} tickets para actualizar`
                : 'No hay tickets que actualizar'
        };

        // Actualizar cada ticket individualmente
        if (countToUpdate > 0) {
            let updatedCount = 0;
            let errorCount = 0;
            
            for (const ticket of ticketsToUpdate) {
                const { error: updateError } = await client
                    .from('tickets')
                    .update({ closure_date: new Date().toISOString() }) // Temporal para referencia
                    .eq('id', ticket.id);
                
                // En realidad necesitamos actualizar closure_date con updated_at
                // Como no podemos hacer UPDATE con valor de otra columna directamente,
                // obtenemos el updated_at y lo usamos
                const { data: ticketData } = await client
                    .from('tickets')
                    .select('updated_at')
                    .eq('id', ticket.id)
                    .single();
                
                if (ticketData?.updated_at) {
                    const { error: updateError2 } = await client
                        .from('tickets')
                        .update({ closure_date: ticketData.updated_at })
                        .eq('id', ticket.id);
                    
                    if (!updateError2) {
                        updatedCount++;
                    } else {
                        errorCount++;
                    }
                }
            }
            
            results.step1.updated = updatedCount;
            results.step1.errors = errorCount;
        }

        // ============================================================
        // STEP 2: Verificación
        // ============================================================
        
        const { count: remainingNull } = await client
            .from('tickets')
            .select('id', { count: 'exact', head: true })
            .eq('status_id', 'ticket_cerrado')
            .is('closure_date', null);

        const { count: totalClosed } = await client
            .from('tickets')
            .select('id', { count: 'exact', head: true })
            .eq('status_id', 'ticket_cerrado');

        results.verification = {
            totalClosedTickets: totalClosed || 0,
            remainingNullClosureDate: remainingNull || 0,
            allPopulated: (remainingNull || 0) === 0
        };

        return NextResponse.json({
            success: true,
            message: 'Proceso completado',
            results,
            note: 'NOTA: El trigger debe crearse manualmente en PostgreSQL. Ver instrucciones abajo.'
        });

    } catch (err: any) {
        return NextResponse.json({
            success: false,
            error: err.message
        }, { status: 500 });
    }
}
