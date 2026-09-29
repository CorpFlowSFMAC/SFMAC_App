import { NextRequest, NextResponse } from 'next/server';
import { getAllTicketsLite, getClient, getTicketsSummary, pingDatabase } from '@/lib/supabase-server';
import { normalizeStateId } from '@/lib/ticketStates';
import { stripFinancialMetadata } from '@/lib/financialMetadata';

export const dynamic = 'force-dynamic';

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
        const isSummary  = searchParams.get('summary')  === '1';
        const isPayments = searchParams.get('payments') === '1';
        const gestorId   = searchParams.get('gestor_id') || undefined;

        // ── MODO PAGOS/TESORERÍA ────────────────────────────────────────────
        // Usa Service Role Key para bypassar RLS y obtener todos los tickets
        // con los campos financieros que necesita la bandeja de Pagos.
        if (isPayments) {
            const client = getClient() as any;
            if (!client) {
                return NextResponse.json({ success: false, error: 'Supabase server client no configurado' }, { status: 503 });
            }

            const PAYMENT_SELECT = `
                id, ticket_number, status_id, service_type, description,
                client_ticket_number, created_at, labor_cost, materials_cost, visit_cost,
                total_quoted_amount, client_id, branch_id, technician_id, gestora_id,
                diagnosis, priority, sede_reportada_cliente,
                clients(id, name, ruc),
                branch_offices(id, name),
                technicians(id, name, bank_name, account_number, cci, yape_number, plin_number, phone),
                gestoras(id, name)
            `;

            const excludeStatus = (searchParams.get('excludeStatus') || 'borrador,ticket_cancelado,ticket_rechazado').split(',');
            const limitParam = parseInt(searchParams.get('limit') || '500', 10);

            const { data, error } = await client
                .from('tickets')
                .select(PAYMENT_SELECT)
                .not('status_id', 'in', `(${excludeStatus.join(',')})`)
                .order('created_at', { ascending: false })
                .limit(limitParam);

            if (error) throw error;

            const normalized = ((data || []) as TicketServerRow[]).map((t) => ({
                ...t,
                estadoId: normalizeStateId(t.status_id || t.estadoId || 'nuevo')
            }));

            return NextResponse.json({
                success: true,
                source: 'server-payments',
                count: normalized.length,
                data: normalized,
            });
        }

        // ── MODO SUMMARY / DEFAULT ──────────────────────────────────────────
        let ticketsData;
        if (isSummary) {
            ticketsData = await getTicketsSummary();
        } else {
            ticketsData = await getAllTicketsLite(gestorId);
        }

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
        const accion = searchParams.get('accion') || 'ping';
        
        if (accion === 'ping') {
            const result = await pingDatabase();
            return NextResponse.json({
                success: result,
                action: 'ping',
                message: result ? 'Database activa' : 'Database no responde'
            });
        }

        if (accion === 'parchar_ticket') {
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

            // PASO 2: Sanitizar y Mapear Defensivamente el 'columnUpdates'
            // No se requiere mapeo: el frontend ya envía technician_id directamente
            const sanitizedUpdates: any = { ...columnUpdates };
            delete sanitizedUpdates.sede;

            const { data, error } = await client
                .from('tickets')
                .update({
                    ...sanitizedUpdates,
                    metadata: {
                        ...stripFinancialMetadata(current?.metadata || {}),
                        ...stripFinancialMetadata(metadataUpdates),
                    },
                })
                .eq('id', id)
                // PASO 1: Adaptar el .select() al Esquema Real verificado
                .select('*, clients(*), branch_offices(*), technicians(*), gestora:gestoras(*)')
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