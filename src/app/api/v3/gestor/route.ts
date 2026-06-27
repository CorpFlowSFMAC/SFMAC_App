import { NextRequest, NextResponse } from 'next/server';
import { getAllTicketsLite } from '@/lib/supabase-server';
import { normalizeStateId } from '@/lib/ticketStates';

/**
 * API V3 - Gestor Data
 *
 * Endpoint específico para dashboard de gestores.
 * Usa Supabase Server Client (Service Role Key) para evitar bloqueos RLS.
 */

// ─────────────────────────────────────────────────────────────────────────
// HELPER: Verificar turno activo (Gatekeeper de Asistencia)
// Sólo aplica a roles gestor/espectador. Admins están exentos.
// ─────────────────────────────────────────────────────────────────────────
async function verificarTurnoActivo(client: any, email: string, userRole?: string): Promise<boolean> {
    // EXENCIÓN: Admins no requieren marcación activa
    const normalizedRole = (userRole || '').toLowerCase();
    if (normalizedRole === 'admin' || normalizedRole === 'superadmin') {
        return true;
    }

    if (!email) return false;

    const today = new Date().toISOString().split('T')[0];
    const { data, error } = await client
        .from('turnos')
        .select('id, estado')
        .eq('usuario_email', email)
        .eq('fecha', today)
        .in('estado', ['en_jornada', 'EN_CURSO']) // compatibilidad con estado anterior
        .limit(1)
        .maybeSingle();

    if (error) {
        console.error('[Gatekeeper] Error verificando turno:', error.message);
        // En caso de error de consulta, permitir paso para no bloquear por fallo de DB
        return true;
    }

    return data !== null;
}

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const gestorId = searchParams.get('gestor_id') || undefined;
        const email = searchParams.get('email') || '';

        // Obtener tickets usando server client (ignora RLS)
        const rawTickets = await getAllTicketsLite(gestorId) as any;

        // Normalizar estados
        const normalizedTickets = ((rawTickets || []) as any[]).map((t: any) => ({
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
 * POST - Marcar Ingreso/Salida/Refrigerio de Turno
 * Gatekeeper: valida turno activo antes de operaciones críticas.
 * Admins están exentos del gatekeeper.
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { action, email, nombre, turnoId, userRole, deviceInfo, status_attendance, location_gps } = body;

        // Importar server client
        const { getClient } = await import('@/lib/supabase-server');
        const client = getClient() as any;

        if (!client) {
            return NextResponse.json({
                success: false,
                error: 'Server client no disponible'
            }, { status: 500 });
        }

        // Capturar IP del cliente desde los headers
        const forwarded = request.headers.get('x-forwarded-for');
        const ipAddress = forwarded ? forwarded.split(',')[0].trim() : (request.headers.get('x-real-ip') || 'desconocida');

        // ── INGRESO: registrar entrada al turno ──────────────────────────
        if (action === 'ingreso') {
            // Verificar que no exista ya un turno EN_JORNADA hoy (evitar duplicados)
            const today = new Date().toISOString().split('T')[0];
            const { data: existing } = await client
                .from('turnos')
                .select('id, estado')
                .eq('usuario_email', email)
                .eq('fecha', today)
                .in('estado', ['en_jornada', 'EN_CURSO'])
                .limit(1)
                .maybeSingle();

            if (existing) {
                // Ya tiene turno activo — retornar el existente
                return NextResponse.json({
                    success: true,
                    action: 'ingreso',
                    message: 'Turno ya activo (retornando existente)',
                    turno: { id: existing.id, hora_ingreso: existing.hora_ingreso }
                });
            }

            const { data, error } = await client
                .from('turnos')
                .insert({
                    usuario_email: email,
                    usuario_nombre: nombre,
                    fecha: today,
                    estado: 'en_jornada',
                    ip_address: ipAddress,
                    device_info: deviceInfo || null,
                    status_attendance: status_attendance || null,
                    location_gps: location_gps || null,
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

        // ── SALIDA: cerrar turno ──────────────────────────────────────────
        if (action === 'salida' && turnoId) {
            // Fetch ingreso time to calculate horas_trabajadas
            const { data: turnoData } = await client
                .from('turnos')
                .select('hora_ingreso')
                .eq('id', turnoId)
                .single();

            const now = new Date();
            let horasTrabajadas: number | null = null;
            let salidaStatusAttendance: string | null = null;

            if (turnoData?.hora_ingreso) {
                horasTrabajadas = (now.getTime() - new Date(turnoData.hora_ingreso).getTime()) / 3_600_000;
                horasTrabajadas = Math.round(horasTrabajadas * 100) / 100;
                if (horasTrabajadas > 9) {
                    salidaStatusAttendance = 'horas_extra';
                }
            }

            const { error } = await client
                .from('turnos')
                .update({
                    hora_salida: now.toISOString(),
                    estado: 'finalizado',
                    horas_trabajadas: horasTrabajadas,
                    ...(salidaStatusAttendance ? { status_attendance: salidaStatusAttendance } : {})
                })
                .eq('id', turnoId);

            if (error) throw error;

            return NextResponse.json({
                success: true,
                action: 'salida',
                horas_trabajadas: horasTrabajadas
            });
        }

        // ── INICIO_REFRIGERIO: pausar jornada ─────────────────────────────
        if (action === 'inicio_refrigerio' && turnoId) {
            // GATEKEEPER: debe tener turno activo
            const turnoActivo = await verificarTurnoActivo(client, email, userRole);
            if (!turnoActivo) {
                return NextResponse.json({
                    success: false,
                    error: 'No tienes una jornada activa. Marca tu ingreso primero.',
                    code: 'NO_ACTIVE_SHIFT'
                }, { status: 403 });
            }

            const { error } = await client
                .from('turnos')
                .update({ inicio_refrigerio: new Date().toISOString(), estado: 'en_refrigerio' })
                .eq('id', turnoId);

            if (error) throw error;

            return NextResponse.json({ success: true, action: 'inicio_refrigerio' });
        }

        // ── FIN_REFRIGERIO: reanudar jornada ──────────────────────────────
        if (action === 'fin_refrigerio' && turnoId) {
            const { error } = await client
                .from('turnos')
                .update({ fin_refrigerio: new Date().toISOString(), estado: 'en_jornada' })
                .eq('id', turnoId);

            if (error) throw error;

            return NextResponse.json({ success: true, action: 'fin_refrigerio' });
        }

        // ── VERIFICAR TURNO: endpoint de consulta para gatekeeper frontend ─
        if (action === 'verificar') {
            const turnoActivo = await verificarTurnoActivo(client, email, userRole);
            return NextResponse.json({
                success: true,
                turnoActivo,
                action: 'verificar'
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

    const slaVencidos = activos.filter((t: any) => {
        const created = new Date(t.created_at || t.createdAt);
        const hours = (now.getTime() - created.getTime()) / 3_600_000;
        return hours >= 72;
    });

    let mttrHours = 0;
    const cerradosConTiempo = cerrados.filter((t: any) => !!(t.created_at && t.fechaCierre));

    if (cerradosConTiempo.length > 0) {
        const totalHours = cerradosConTiempo.reduce((acc: number, t: any) => {
            const start = new Date(t.created_at || t.createdAt);
            const end = new Date(t.fechaCierre || t.closure_date || now);
            return acc + (end.getTime() - start.getTime()) / 3_600_000;
        }, 0);
        mttrHours = totalHours / cerradosConTiempo.length;
    }

    const backlog = activos.filter((t: any) => {
        const created = new Date(t.created_at || t.createdAt);
        const hours = (now.getTime() - created.getTime()) / 3_600_000;
        return hours >= 24;
    });

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