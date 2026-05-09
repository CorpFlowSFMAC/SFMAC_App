import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

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
            .from('tickets')
            .select(`
                id, client_ticket_number, status_id, created_at,
                labor_cost, total_quoted_amount,
                clients(name),
                technicians(name),
                costos:ticket_costs(id, estado_pago, monto)
            `)
            .not('status_id', 'in', `(${ESTADOS_EXCLUIDOS.join(',')})`)
            .order('created_at', { ascending: false })
            .limit(10);

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