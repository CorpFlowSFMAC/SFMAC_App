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

            // Sanitizar campos que pueden no existir en la base de datos
            const { assigned_zones, specialties, ...safeUpdates } = columnUpdates as any;

            const { data, error } = await client
                .from('technicians')
                .update(safeUpdates)
                .eq('id', id)
                .select()
                .single();

            if (error) throw error;
            return NextResponse.json({ success: true, data });
        }
        
        return NextResponse.json({ success: false, error: 'Acción no reconocida' }, { status: 400 });
        
    } catch (err: any) {
        console.error('[Technicians Server API] POST Error:', err);
        return NextResponse.json({ success: false, error: err.message || 'Error desconocido' }, { status: 500 });
    }
}
