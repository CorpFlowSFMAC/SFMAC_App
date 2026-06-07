import { NextRequest, NextResponse } from 'next/server';
import { getClient } from '@/lib/supabase-server';

export async function POST(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const action = searchParams.get('action');
        
        if (action === 'patch') {
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
                .select()
                .single();

            if (error) throw error;

            return NextResponse.json({ success: true, data });
        }
        
        if (action === 'sync_branches') {
            const client = getClient();
            if (!client) throw new Error('Supabase server client is not configured');

            const body = await request.json();
            const { technician_id, branch_ids } = body;
            
            console.log('[sync_branches] Received request:', { technician_id, branch_ids, branchIdsCount: branch_ids?.length });
            
            if (!technician_id || !Array.isArray(branch_ids)) {
                return NextResponse.json({ success: false, error: 'technician_id y branch_ids (array) son requeridos' }, { status: 400 });
            }

            // 1. Borrar asignaciones existentes
            console.log('[sync_branches] Deleting existing assignments for technician:', technician_id);
            const { error: delErr } = await client
                .from('technician_branches')
                .delete()
                .eq('technician_id', technician_id);
            
            if (delErr !== null) {
                console.error('[sync_branches] Delete error:', delErr);
                return NextResponse.json({ error: delErr.message || 'Error al eliminar asignaciones' }, { status: 500 });
            }
            console.log('[sync_branches] Delete successful');

            // 2. Insertar nuevas asignaciones si existen
            if (branch_ids.length > 0) {
                console.log('[sync_branches] Inserting', branch_ids.length, 'branch assignments');
                const rows = branch_ids.map((bid: string) => ({ technician_id, branch_id: bid }));
                console.log('[sync_branches] Insert rows:', rows);
                
                const { error: insErr } = await client
                    .from('technician_branches')
                    // @ts-ignore
                    .insert(rows);
                
                if (insErr !== null) {
                    console.error('[sync_branches] Insert error:', insErr);
                    return NextResponse.json({ error: insErr.message || 'Error al insertar asignaciones' }, { status: 500 });
                }
                console.log('[sync_branches] Insert successful');
            } else {
                console.log('[sync_branches] No branches to insert (empty array) - keeping only deleted state');
            }

            console.log('[sync_branches] Returning success');
            return NextResponse.json({ success: true });
        }
        
        return NextResponse.json({ success: false, error: 'Acción no reconocida' }, { status: 400 });
        
    } catch (err: any) {
        console.error('[Technicians Server API] POST Error:', err);
        return NextResponse.json({ success: false, error: err.message || 'Error desconocido' }, { status: 500 });
    }
}
