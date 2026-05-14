import { NextRequest, NextResponse } from 'next/server';
import { getAllTicketsLite, getClient, getTicketsSummary, pingDatabase } from '@/lib/supabase-server';
import { normalizeStateId } from '@/lib/ticketStates';
import { stripFinancialMetadata } from '@/lib/financialMetadata';

type TicketPatchRequest = {
    id?: string;
    metadataUpdates?: Record<string, unknown>;
    columnUpdates?: Record<string, unknown>;
};

type TicketServerClient = {
    from: (table: 'tickets') => {
        select: (columns: string) => {
            eq: (column: string, value: string) => {
                single: () => Promise<{ data: { metadata?: Record<string, unknown> | null } | null; error: unknown }>;
            };
        };
        update: (updates: Record<string, unknown>) => {
            eq: (column: string, value: string) => {
                select: (columns: string) => {
                    single: () => Promise<{ data: unknown; error: unknown }>;
                };
            };
        };
    };
};

type TicketServerRow = {
    status_id?: string;
    estadoId?: string;
};

const getErrorMessage = (err: unknown) => err instanceof Error ? err.message : 'Error desconocido';

/**
 * API v3 - Tickets Server
 * 
 * Usa Supabase Server Client (Service Role Key) para evitar bloqueos RLS.
 * Esta ruta es chamada desde el servidor next.js, no desde el cliente.
 */

/**
 * GET: Obtener tickets usando server client
 * Params opcionales:
 * - summary: solo resumen (sin detalles)
 * - gestor_id: filtrar por gestora
 */
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const isSummary = searchParams.get('summary') === '1';
        const gestorId = searchParams.get('gestor_id') || undefined;

        // Intentar obtener tickets via server client
        let ticketsData;
        
        if (isSummary) {
            ticketsData = await getTicketsSummary();
        } else {
            ticketsData = await getAllTicketsLite(gestorId);
        }
        
        // Normalizar estados para frontend
        const normalizedTickets = ((ticketsData || []) as TicketServerRow[]).map((t) => ({
            ...t,
            estadoId: normalizeStateId(t.status_id || t.estadoId || 'nuevo')
        }));

        return NextResponse.json({
            success: true,
            source: 'server-client',
            count: normalizedTickets.length,
            data: normalizedTickets
        });
        
    } catch (err: unknown) {
        console.error('[Tickets Server API] Error:', err);
        return NextResponse.json({
            success: false,
            error: 'Error al obtener tickets',
            details: getErrorMessage(err)
        }, { status: 500 });
    }
}

/**
 * POST: Keep-alive (ping a la base de datos)
 */
export async function POST(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const action = searchParams.get('action') || 'ping';
        
        if (action === 'ping') {
            const result = await pingDatabase();
            return NextResponse.json({
                success: result,
                action: 'ping',
                message: result ? 'Database activa' : 'Database no responde'
            });
        }

        if (action === 'patch') {
            const client = getClient() as unknown as TicketServerClient | null;
            if (!client) throw new Error('Supabase server client is not configured');

            const { id, metadataUpdates = {}, columnUpdates = {} } = await request.json() as TicketPatchRequest;
            if (!id) {
                return NextResponse.json({ success: false, error: 'id es requerido' }, { status: 400 });
            }

            const { data: current, error: fetchError } = await client
                .from('tickets')
                .select('metadata')
                .eq('id', id)
                .single();

            if (fetchError) throw fetchError;

            const { data, error } = await client
                .from('tickets')
                .update({
                    ...columnUpdates,
                    metadata: {
                        ...stripFinancialMetadata(current?.metadata || {}),
                        ...stripFinancialMetadata(metadataUpdates),
                    },
                })
                .eq('id', id)
                .select('*, clients(*), branch_offices(*), technicians(*)')
                .single();

            if (error) throw error;
            return NextResponse.json({ success: true, data });
        }
        
        return NextResponse.json({
            success: false,
            error: 'Acción no reconocida'
        }, { status: 400 });
        
    } catch (err: unknown) {
        console.error('[Tickets Server API] POST Error:', err);
        return NextResponse.json({
            success: false,
            error: getErrorMessage(err)
        }, { status: 500 });
    }
}