import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getSupabaseAuthKey, getSupabaseUrl } from '@/lib/supabase-config';

const supabaseUrl = getSupabaseUrl();
const supabaseKey = getSupabaseAuthKey();

/**
 * DIAGNOSTIC ENDPOINT — SINFIMAC V3
 * POST /api/debug-rpc
 */
export async function POST(request: Request) {
    try {
        const supabase = createClient(supabaseUrl, supabaseKey, {
            auth: { persistSession: false }
        });

        // 1. Conteo total de tickets en la tabla física sin filtros
        const { count: totalTickets, error: countError } = await supabase
            .from('tickets')
            .select('id', { count: 'exact', head: true });

        if (countError) {
            return NextResponse.json({ error: 'Error counting tickets: ' + countError.message }, { status: 500 });
        }

        // 2. Obtener la lista de todos los tickets
        const { data: tickets, error: ticketsError } = await supabase
            .from('tickets')
            .select(`
                id,
                ticket_number,
                client_ticket_number,
                status_id,
                created_at,
                gestora_id,
                gestoras:gestoras (
                    id,
                    name,
                    email
                )
            `)
            .order('created_at', { ascending: false });

        if (ticketsError) {
            return NextResponse.json({ error: 'Error fetching tickets: ' + ticketsError.message }, { status: 500 });
        }

        // 3. Obtener todas las gestoras registradas
        const { data: gestoras, error: gestorasError } = await supabase
            .from('gestoras')
            .select('*');

        // 4. Obtener zona horaria de la base de datos (vía timestamp)
        // Compararemos la hora del servidor con now()
        const nowServer = new Date().toISOString();

        return NextResponse.json({
            success: true,
            totalTicketsCount: totalTickets,
            nowServer,
            gestoras,
            tickets: tickets || [],
            gestorasError: gestorasError ? gestorasError.message : null
        });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}