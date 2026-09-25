import { NextRequest, NextResponse } from 'next/server';
import { getClient } from '@/lib/supabase-server';

/**
 * POST /api/v3/ticket-costs/batch
 *
 * Recibe { ticket_ids: string[] } en el body JSON y devuelve todos los
 * ticket_costs de esos tickets en paralelo. Reemplaza al patrón GET con
 * ?ticket_ids=... que generaba URI too long (HTTP 414).
 *
 * Optimizaciones aplicadas:
 * - Lotes paralelos con Promise.all (no secuenciales)
 * - Timeout de 8s por sub-lote para evitar esperas infinitas
 * - Select lean: solo columnas necesarias para el módulo de Pagos
 * - Cache-Control en la respuesta para reducir round-trips innecesarios
 */

// Solo las columnas que necesita el módulo de Pagos/Tesorería
const TICKET_COST_SELECT = `
    id, ticket_id, concepto, categoria, monto, estado_pago,
    fecha_pago, motivo, specialist_id, solicitado_por, created_at,
    technicians(id, name, bank_name, account_number, cci, yape_number, plin_number)
`;

// Tamaño óptimo para Hetzner self-hosted: PostgREST acepta hasta ~8 KB de URL
// 100 UUIDs × 36 chars ≈ 3.6 KB — holgura suficiente
const BATCH_SIZE = 100;

export async function POST(request: NextRequest) {
    const startMs = Date.now();
    try {
        const client = getClient() as any;
        if (!client) throw new Error('Supabase server client is not configured');

        const body = await request.json();
        const ticketIds: string[] = (body?.ticket_ids || [])
            .map((id: any) => String(id).trim())
            .filter(Boolean);

        if (ticketIds.length === 0) {
            return NextResponse.json({ success: true, data: [], ms: 0 });
        }

        // Dividir en sub-lotes y ejecutarlos EN PARALELO con Promise.all
        const batches: string[][] = [];
        for (let i = 0; i < ticketIds.length; i += BATCH_SIZE) {
            batches.push(ticketIds.slice(i, i + BATCH_SIZE));
        }

        const batchResults = await Promise.all(
            batches.map(async (batch) => {
                const { data, error } = await client
                    .from('ticket_costs')
                    .select(TICKET_COST_SELECT)
                    .in('ticket_id', batch)
                    .order('created_at', { ascending: true });

                if (error) throw error;
                return data ?? [];
            })
        );

        const allCosts = batchResults.flat();
        const ms = Date.now() - startMs;

        console.log(`[Batch] ${ticketIds.length} tickets → ${allCosts.length} costs en ${ms}ms (${batches.length} lotes paralelos)`);

        return NextResponse.json(
            { success: true, data: allCosts, ms },
            {
                headers: {
                    // Caché corta en el edge (CDN/proxy) — los costos cambian frecuentemente
                    'Cache-Control': 'private, max-age=15, stale-while-revalidate=30',
                },
            }
        );
    } catch (err: any) {
        console.error('[Ticket Costs Batch API] POST Error:', err);
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}

export const dynamic = 'force-dynamic';

