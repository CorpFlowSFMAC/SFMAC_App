import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getSupabaseUrl, getSupabaseServiceKey } from '@/lib/supabase-config';

function getAdminClient() {
    const url = getSupabaseUrl();
    const serviceKey = getSupabaseServiceKey();
    if (!serviceKey) {
        throw new Error('SUPABASE_SERVICE_ROLE_KEY no está configurada en el servidor.');
    }
    return createClient(url, serviceKey, {
        auth: { persistSession: false, autoRefreshToken: false },
    });
}

// ── GET /api/profile → Returns the current user's profile, bypassing RLS ─────
export async function GET(req: NextRequest) {
    try {
        const authHeader = req.headers.get('authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
        }
        const token = authHeader.split(' ')[1];
        
        const supabase = getAdminClient();
        const { data: { user }, error } = await supabase.auth.getUser(token);
        
        if (error || !user) {
            return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
        }

        const { data: perfil, error: perfilError } = await supabase
            .from('perfiles')
            .select('*')
            .eq('id', user.id)
            .single();

        if (perfilError) {
            return NextResponse.json({ error: 'Perfil no encontrado', profile: null });
        }

        return NextResponse.json({ success: true, profile: perfil });
    } catch (err: any) {
        console.error('[PROFILE API] GET Error:', err);
        return NextResponse.json({ error: err.message || 'Error interno del servidor.' }, { status: 500 });
    }
}