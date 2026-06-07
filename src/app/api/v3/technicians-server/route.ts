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
            
            if (!technician_id || !Array.isArray(branch_ids)) {
                return NextResponse.json({ success: false, error: 'technician_id y branch_ids (array) son requeridos' }, { status: 400 });
            }

            // 1. Borrar asignaciones existentes
            const { error: delErr } = await client
                .from('technician_branches')
                .delete()
                .eq('technician_id', technician_id);
            
            if (delErr) throw delErr;

            // 2. Insertar nuevas asignaciones si existen
            if (branch_ids.length > 0) {
                const rows = branch_ids.map(bid => ({ technician_id, branch_id: bid }));
                const { error: insErr } = await client
                    .from('technician_branches')
                    // @ts-ignore
                    .insert(rows);
                
                if (insErr) throw insErr;
            }

            return NextResponse.json({ success: true });
        }
        
        return NextResponse.json({ success: false, error: 'Acción no reconocida' }, { status: 400 });
        
    } catch (err: any) {
        console.error('[Technicians Server API] POST Error:', err);
        return NextResponse.json({ success: false, error: err.message || 'Error desconocido' }, { status: 500 });
    }
}
