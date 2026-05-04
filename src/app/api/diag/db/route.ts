/**
 * API de Diagnóstico - Verifica conexión a DB y cuenta tickets
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export async function GET(request: NextRequest) {
    if (!supabaseUrl || !supabaseAnonKey) {
        return NextResponse.json({
            error: 'Faltan variables de entorno',
            supabaseUrl: supabaseUrl || 'NO CONFIGURADA',
            supabaseAnonKey: supabaseAnonKey ? 'CONFIGURADA' : 'NO CONFIGURADA'
        }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    try {
        // Test de conexión
        const { data: testData, error: testError } = await supabase
            .from('tickets')
            .select('id', { count: 'exact', head: true })
            .limit(1);

        const { count, error: countError } = await supabase
            .from('tickets')
            .select('id', { count: 'exact', head: true });

        // Obtener perfiles
        const { data: perfiles } = await supabase
            .from('perfiles')
            .select('email, rol');

        // Obtener algunos tickets si hay
        const { data: sampleTickets } = await supabase
            .from('tickets')
            .select('id, estado, description, service_type')
            .limit(5);

        return NextResponse.json({
            success: true,
            connection: !!supabaseUrl,
            supabaseUrl: supabaseUrl,
            tickets: {
                count: count || 0,
                sample: sampleTickets || []
            },
            perfiles: perfiles || [],
            errors: {
                testError: testError?.message || null,
                countError: countError?.message || null
            }
        });
    } catch (err: any) {
        return NextResponse.json({
            error: err.message,
            supabaseUrl: supabaseUrl
        }, { status: 500 });
    }
}