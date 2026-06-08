import { NextRequest, NextResponse } from 'next/server';
import { getClient } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const accion = searchParams.get('accion');
        
        if (accion === 'patch') {
            const client = getClient();
            if (!client) throw new Error('Supabase server client is not configured');

            const body = await request.json();
            const { id, columnUpdates = {} } = body;
            
            if (!id) {
                return NextResponse.json({ success: false, error: 'id es requerido' }, { status: 400 });
            }

            const { data, error } = await client
                .from('technicians')
                // @ts-ignore
                .update(columnUpdates as any)
                .eq('id', id)
                .select();

            if (error) throw error;

            // Return first element or null (defensive - prevents coercion error)
            const updatedRow = data && data.length > 0 ? data[0] : null;
            return NextResponse.json({ success: true, data: updatedRow });
        }
        
        if (accion === 'sincronizar_agencias') {
            const client = getClient();
            if (!client) throw new Error('Supabase server client is not configured');

            const body = await request.json();
            const { tecnico_id, agencias_asignadas } = body;
            
            console.log('[sincronizar_agencias] Received request:', { tecnico_id, agencias_asignadas, branchIdsCount: agencias_asignadas?.length });
            
            if (!tecnico_id || !Array.isArray(agencias_asignadas)) {
                return NextResponse.json({ success: false, error: 'tecnico_id y agencias_asignadas (array) son requeridos' }, { status: 400 });
            }

            // 1. Borrar asignaciones existentes
            console.log('[sincronizar_agencias] Deleting existing assignments for technician:', tecnico_id);
            const { error: delErr } = await client
                .from('technician_branches')
                .delete()
                .eq('tecnico_id', tecnico_id);
            
            if (delErr !== null) {
                console.error('[sincronizar_agencias] Delete error:', delErr);
                return NextResponse.json({ error: delErr.message || 'Error al eliminar asignaciones' }, { status: 500 });
            }
            console.log('[sincronizar_agencias] Delete successful');

            // 2. Insertar nuevas asignaciones si existen
            if (agencias_asignadas.length > 0) {
                console.log('[sincronizar_agencias] Inserting', agencias_asignadas.length, 'branch assignments');
                const rows = agencias_asignadas.map((bid: string) => ({ tecnico_id, branch_id: bid }));
                console.log('[sincronizar_agencias] Insert rows:', rows);
                
                const { error: insErr } = await client
                    .from('technician_branches')
                    // @ts-ignore
                    .insert(rows);
                
                if (insErr !== null) {
                    console.error('[sincronizar_agencias] Insert error:', insErr);
                    return NextResponse.json({ error: insErr.message || 'Error al insertar asignaciones' }, { status: 500 });
                }
                console.log('[sincronizar_agencias] Insert successful');
            } else {
                console.log('[sincronizar_agencias] No branches to insert (empty array) - keeping only deleted state');
            }

            console.log('[sincronizar_agencias] Returning success');
            return NextResponse.json({ success: true });
        }
        
        return NextResponse.json({ success: false, error: 'Acción no reconocida' }, { status: 400 });
        
    } catch (err: any) {
        console.error('[Technicians Server API] POST Error:', err);
        return NextResponse.json({ success: false, error: err.message || 'Error desconocido' }, { status: 500 });
    }
}

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const accion = searchParams.get('accion');

        if (accion === 'get_assigned_branches') {
            const client = getClient();
            if (!client) throw new Error('Supabase server client is not configured');

            const technicianId = searchParams.get('tecnico_id');
            if (!technicianId) {
                return NextResponse.json({ success: false, error: 'tecnico_id es requerido' }, { status: 400 });
            }

            const { data, error } = await client
                .from('technician_branches')
                .select('branch_id, branch_offices(id, name, zone, address, departamento, client_id, client:clients(id, name))')
                .eq('tecnico_id', technicianId);

            if (error) throw error;
            
            const branches = (data || []).map((r: any) => r.branch_offices).filter(Boolean);
            return NextResponse.json({ success: true, branches });
        }

        if (accion === 'get_all_assignments') {
            const client = getClient();
            if (!client) throw new Error('Supabase server client is not configured');

            // Fetch ALL technician branches, bypassing RLS
            const { data, error } = await client
                .from('technician_branches')
                .select('tecnico_id, branch_id');

            if (error) throw error;
            
            return NextResponse.json({ success: true, data });
        }

        return NextResponse.json({ success: false, error: 'Acción no reconocida' }, { status: 400 });

    } catch (err: any) {
        console.error('[Technicians Server API] GET Error:', err);
        return NextResponse.json({ success: false, error: err.message || 'Error desconocido' }, { status: 500 });
    }
}
