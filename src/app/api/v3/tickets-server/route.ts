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
            // Filtro estricto de columnas válidas de la tabla tickets para evitar errores de esquema
            const ALLOWED_TICKET_COLUMNS = new Set([
                'client_id', 'branch_id', 'technician_id', 'status_id',
                'description', 'client_ticket_number', 'labor_cost', 'materials_cost',
                'visit_cost', 'total_quoted_amount', 'created_at', 'updated_at',
                'quotation_date', 'execution_date', 'closure_date',
                'service_type', 'created_by', 'diagnosis', 'priority',
                'current_step', 'is_sla_paused', 'sla_pause_date', 'sla_reactivation_date',
                'sede_reportada_cliente', 'gestora_id'
            ]);
            const sanitizedUpdates: any = {};
            for (const [key, val] of Object.entries(columnUpdates)) {
                if (ALLOWED_TICKET_COLUMNS.has(key)) {
                    sanitizedUpdates[key] = val;
                }
            }

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

        if (accion === 'trasladar_movimientos') {
            const client = getClient() as any;
            if (!client) throw new Error('Supabase server client no configurado');

            const { sourceTicketId, targetTicketId } = await request.json() as {
                sourceTicketId?: string;
                targetTicketId?: string;
            };

            if (!sourceTicketId || !targetTicketId) {
                return NextResponse.json({
                    success: false,
                    error: 'sourceTicketId y targetTicketId son requeridos'
                }, { status: 400 });
            }

            // 1. Mover ticket_costs
            const { data: movedCosts, error: errCosts } = await client
                .from('ticket_costs')
                .update({ ticket_id: targetTicketId })
                .eq('ticket_id', sourceTicketId)
                .select();

            if (errCosts) throw errCosts;

            // 2. Mover ticket_payments
            const { data: movedPayments, error: errPayments } = await client
                .from('ticket_payments')
                .update({ ticket_id: targetTicketId })
                .eq('ticket_id', sourceTicketId)
                .select();

            if (errPayments) throw errPayments;

            return NextResponse.json({
                success: true,
                data: {
                    movedCosts: movedCosts || [],
                    movedPayments: movedPayments || []
                }
            });
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

/**
 * DELETE: Eliminar ticket definitivamente
 * Regla de negocio estricta: Solo se puede eliminar un ticket si NO tiene
 * depósitos (ticket_payments) ni gastos (ticket_costs) registrados.
 */
export async function DELETE(request: NextRequest) {
    try {
        const client = getClient() as any;
        if (!client) {
            return NextResponse.json({ success: false, error: 'Supabase server client no configurado' }, { status: 503 });
        }

        const id = new URL(request.url).searchParams.get('id');
        if (!id) {
            return NextResponse.json({ success: false, error: 'id es requerido' }, { status: 400 });
        }

        // 1. Verificar si existen gastos registrados
        const { data: costs, error: errCosts } = await client
            .from('ticket_costs')
            .select('id, concepto, monto')
            .eq('ticket_id', id);

        if (errCosts) throw errCosts;

        // 2. Verificar si existen depósitos o pagos registrados
        const { data: payments, error: errPayments } = await client
            .from('ticket_payments')
            .select('id, amount, payment_type')
            .eq('ticket_id', id);

        if (errPayments) throw errPayments;

        const hasCosts = Array.isArray(costs) && costs.length > 0;
        const hasPayments = Array.isArray(payments) && payments.length > 0;

        if (hasCosts || hasPayments) {
            const costsCount = costs?.length || 0;
            const paymentsCount = payments?.length || 0;
            return NextResponse.json({
                success: false,
                code: 'HAS_FINANCIAL_RECORDS',
                error: `No se puede eliminar el ticket porque tiene ${costsCount} gasto(s) y ${paymentsCount} depósito(s) registrado(s). Debe eliminarlos o trasladarlos antes de borrar el ticket.`,
                costsCount,
                paymentsCount,
            }, { status: 400 });
        }

        // 3. Eliminar evidencias fotográficas y adjuntos asociados
        const { error: errEvidences } = await client
            .from('ticket_evidences')
            .delete()
            .eq('ticket_id', id);

        if (errEvidences) throw errEvidences;

        // 4. Eliminar el ticket principal
        const { error: errDelete } = await client
            .from('tickets')
            .delete()
            .eq('id', id);

        if (errDelete) throw errDelete;

        return NextResponse.json({
            success: true,
            message: 'Ticket eliminado definitivamente'
        });
    } catch (err: unknown) {
        console.error('[Tickets Server API] DELETE Error:', err);
        return NextResponse.json({
            success: false,
            error: getErrorMessage(err)
        }, { status: 500 });
    }
}
