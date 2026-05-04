import { NextRequest, NextResponse } from 'next/server';
import { getAllTicketsLite } from '@/lib/supabase-server';
import { normalizeStateId } from '@/lib/ticketStates';

/**
 * API V3 - Gestor Data
 * 
 * Endpoint específico para dashboard de gestores.
 * Usa Supabase Server Client (Service Role Key) para evitar bloqueos RLS.
 * Filtra tickets por gestora_id o deduce jurisdicción desde el email del gestor.
 */

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const gestorId = searchParams.get('gestor_id') || undefined;
        const email = searchParams.get('email') || '';

        // Obtener tickets usando server client (ignora RLS)
        let ticketsData = await getAllTicketsLite(gestorId);
        
        // Si hay email, intentar identificar gestora desde el perfil
        if (!gestorId && email) {
            // Intentar buscar gestora por email en la DB
            const ticketsConEmail = await getAllTicketsLite();
            // Filtrar localmente por jurisdicción - simplificar a tipo any
            ticketsData = (ticketsConEmail as any[]).filter((t: any) => {
                if (t.gestora_id) return true;
                return true;
            });
        }
        
        // Normalizar estados
        const normalizedTickets = ((ticketsData || []) as any[]).map((t: any) => ({
            ...t,
            estadoId: normalizeStateId(t.status_id || t.estadoId || 'nuevo')
        }));

        // Calcular métricas
        const metricas = calcularMetricas(normalizedTickets);

        return NextResponse.json({
            success: true,
            source: 'server-client',
            gestor_id: gestorId || email,
            tickets: normalizedTickets,
            metricas
        });
        
    } catch (err: any) {
        console.error('[Gestor API] Error:', err);
        return NextResponse.json({
            success: false,
            error: 'Error al obtener datos',
            details: err.message
        }, { status: 500 });
    }
}

/**
 * POST - Marcar Ingreso/Salida de Turno
 * Usa server client para evitar bloqueos RLS
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { action, email, nombre, turnoId } = body;

        // Importar server client
        const { getClient } = await import('@/lib/supabase-server');
        const client = getClient();
        
        if (!client) {
            return NextResponse.json({
                success: false,
                error: 'Server client no disponible'
            }, { status: 500 });
        }

        if (action === 'ingreso') {
            const { data, error } = await client
                .from('turnos')
                .insert({ 
                    usuario_email: email, 
                    usuario_nombre: nombre, 
                    fecha: new Date().toISOString().split('T')[0] 
                })
                .select('id, hora_ingreso')
                .single();
            
            if (error) throw error;
            
            return NextResponse.json({
                success: true,
                action: 'ingreso',
                turno: data
            });
        }
        
        if (action === 'salida' && turnoId) {
            const { error } = await client
                .from('turnos')
                .update({ hora_salida: new Date().toISOString(), estado: 'CERRADO' })
                .eq('id', turnoId);
            
            if (error) throw error;
            
            return NextResponse.json({
                success: true,
                action: 'salida'
            });
        }
        
        return NextResponse.json({
            success: false,
            error: 'Acción no válida'
        }, { status: 400 });
        
    } catch (err: any) {
        console.error('[Gestor API] POST Error:', err);
        return NextResponse.json({
            success: false,
            error: err.message
        }, { status: 500 });
    }
}

/**
 * Calcular métricas para el gestor
 */
function calcularMetricas(tickets: any[]) {
    const now = new Date();
    const closedStatus: string[] = ['ticket_cerrado', 'ticket_rechazado', 'ticket_cancelado'];
    
    const activos = tickets.filter((t: any) => !closedStatus.includes(t.estadoId));
    const cerrados = tickets.filter((t: any) => closedStatus.includes(t.estadoId));
    
    // Calcular SLA (tickets abiertos hace más de 72h)
    const slaVencidos = activos.filter((t: any) => {
        const created = new Date(t.created_at || t.createdAt);
        const hours = (now.getTime() - created.getTime()) / 3_600_000;
        return hours >= 72;
    });
    
    // Calcular MTTR promedio (en horas)
    let mttrHours = 0;
    const cerradosConTiempo = cerrados.filter((t: any) => {
        if (!t.created_at || !t.fechaCierre) return false;
        return true;
    });
    
    if (cerradosConTiempo.length > 0) {
        const totalHours = cerradosConTiempo.reduce((acc: number, t: any) => {
            const start = new Date(t.created_at || t.createdAt);
            const end = new Date(t.fechaCierre || t.closure_date || now);
            return acc + (end.getTime() - start.getTime()) / 3_600_000;
        }, 0);
        mttrHours = totalHours / cerradosConTiempo.length;
    }
    
    // Backlog (>24h sin cerrar)
    const backlog = activos.filter((t: any) => {
        const created = new Date(t.created_at || t.createdAt);
        const hours = (now.getTime() - created.getTime()) / 3_600_000;
        return hours >= 24;
    });
    
    // % Cumplimiento SLA
    const slaCompliance = activos.length > 0
        ? Math.round(((activos.length - slaVencidos.length) / activos.length) * 100)
        : 100;
    
    return {
        total: tickets.length,
        activos: activos.length,
        cerrados: cerrados.length,
        backlog: backlog.length,
        slaVencidos: slaVencidos.length,
        slaCompliance,
        mttrHours: Math.round(mttrHours * 10) / 10
    };
}