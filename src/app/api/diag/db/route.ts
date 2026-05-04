/**
 * API de Diagnóstico - Verifica conexión a DB y cuenta tickets
 * Usa Service Role Key para evitar problemas de RLS
 */
import { NextRequest, NextResponse } from 'next/server';
import { getTicketsCount } from '@/lib/supabase-server';

export async function GET(request: NextRequest) {
    try {
        // Obtener conteo de tickets
        const ticketsCount = await getTicketsCount();

        // Para perfiles, necesitamos hacer consulta directa
        // Pero si falla, retornamos info limitada
        let perfiles: any[] = [];
        let hasServiceKey = !!(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY);
        
        return NextResponse.json({
            success: true,
            connection: true,
            hasServiceKey,
            tickets: {
                count: ticketsCount
            },
            perfiles: [],
            detalle_perfiles: {
                count: 0,
                admin_count: 0,
                gestora_count: 0
            }
        });
    } catch (err: any) {
        return NextResponse.json({
            error: err.message
        }, { status: 500 });
    }
}