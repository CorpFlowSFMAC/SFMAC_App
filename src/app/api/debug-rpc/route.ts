import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getSupabaseAuthKey, getSupabaseUrl } from '@/lib/supabase-config';

const supabaseUrl = getSupabaseUrl();
const supabaseKey = getSupabaseAuthKey();

/**
 * DEBUG ENDPOINT — SINFIMAC V3
 * Valida el motor principal de pagos (JS directo con Joins).
 * La RPC get_payment_tickets_ultra_light está DEPRECADA como motor primario.
 *
 * POST /api/debug-rpc
 */
export async function POST(request: Request) {
    try {
        const supabase = createClient(supabaseUrl, supabaseKey, {
            auth: { persistSession: false }
        });

        const ESTADOS_EXCLUIDOS = [
            'borrador',
            'ticket_cerrado',
            'ticket_rechazado',
            'ticket_cancelado',
            'rechazado',
            'cancelado',
        ];

        const { data, error } = await supabase
            .from('vw_tickets_strategic')
            .select('*')
            .limit(5);

        if (error) {
            return NextResponse.json({
                engine: 'js_direct_v3',
                error: error.message,
                hint: error.hint,
                details: error.details
            }, { status: 500 });
        }

        return NextResponse.json({
            engine: 'js_direct_v3',
            success: true,
            count: data?.length || 0,
            estados_excluidos: ESTADOS_EXCLUIDOS,
            sample: data?.[0] || null
        });
    } catch (e: any) {
        return NextResponse.json({ engine: 'js_direct_v3', error: e.message }, { status: 500 });
    }
}