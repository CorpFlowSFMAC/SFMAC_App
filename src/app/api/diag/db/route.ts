/**
 * API de Diagnóstico - Verifica conexión a DB y cuenta tickets
 * Usa Service Role Key para evitar problemas de RLS
 */
import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer, getTicketsCount } from '@/lib/supabase-server';

export async function GET(request: NextRequest) {
    try {
        // Obtener conteo de tickets
        const ticketsCount = await getTicketsCount();

        // Obtener perfiles usando service role
        const { data: perfiles } = await supabaseServer
            .from('perfiles')
            .select('id, email, rol, nombre_completo');

        // Obtener algunos tickets
        const { data: sampleTickets } = await supabaseServer
            .from('tickets')
            .select('id, estado, description')
            .limit(5);

        // Calcular estadísticas
        const adminCount = perfiles?.filter(p => p.rol === 'ADMIN').length || 0;
        const gestoraCount = perfiles?.filter(p => p.rol === 'GESTORA').length || 0;

        return NextResponse.json({
            success: true,
            connection: true,
            tickets: {
                count: ticketsCount,
                sample: sampleTickets || []
            },
            perfiles: perfiles || [],
            detalle_perfiles: {
                count: perfiles?.length || 0,
                admin_count: adminCount,
                gestora_count: gestoraCount
            }
        });
    } catch (err: any) {
        return NextResponse.json({
            error: err.message
        }, { status: 500 });
    }
}