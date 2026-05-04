import { NextRequest, NextResponse } from 'next/server';
import { getAllTicketsLite, getTicketsSummary, pingDatabase } from '@/lib/supabase-server';
import { normalizeStateId } from '@/lib/ticketStates';

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
        const normalizedTickets = (ticketsData || []).map((t: any) => ({
            ...t,
            estadoId: normalizeStateId(t.status_id || t.estadoId || 'nuevo')
        }));

        return NextResponse.json({
            success: true,
            source: 'server-client',
            count: normalizedTickets.length,
            data: normalizedTickets
        });
        
    } catch (err: any) {
        console.error('[Tickets Server API] Error:', err);
        return NextResponse.json({
            success: false,
            error: 'Error al obtener tickets',
            details: err.message
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
        
        return NextResponse.json({
            success: false,
            error: 'Acción no reconocida'
        }, { status: 400 });
        
    } catch (err: any) {
        console.error('[Tickets Server API] POST Error:', err);
        return NextResponse.json({
            success: false,
            error: err.message
        }, { status: 500 });
    }
}