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
        const cookies = req.cookies.getAll();
        const supabase = getAdminClient();

        // Method 1: Token Bearer (Supabase Auth session)
        if (authHeader?.startsWith('Bearer ')) {
            const token = authHeader.split(' ')[1];
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
        }

        // Method 2: Cookies (Azure AD login)
        const userRoleCookie = cookies.find(c => c.name === 'userRole');
        const userEmailCookie = cookies.find(c => c.name === 'userEmail');
        const authStatusCookie = cookies.find(c => c.name === 'auth_status');

        if (userRoleCookie?.value && userEmailCookie?.value && authStatusCookie?.value === 'azure_logged_in') {
            const { data: perfil, error: perfilError } = await supabase
                .from('perfiles')
                .select('*')
                .eq('email', userEmailCookie.value.toLowerCase())
                .single();

            if (perfilError) {
                return NextResponse.json({ error: 'Perfil no encontrado', profile: null });
            }

            return NextResponse.json({ success: true, profile: perfil });
        }

        return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    } catch (err: any) {
        console.error('[PROFILE API] GET Error:', err);
        return NextResponse.json({ error: err.message || 'Error interno del servidor.' }, { status: 500 });
    }
}