/**
 * Quick Admin Setup - /api/admin/set-admin
 * Directly sets a user as ADMIN using email (no Supabase Auth session needed)
 * Uses Azure AD cookies for authentication
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getSupabaseUrl, getSupabaseServiceKey } from '@/lib/supabase-config';

function getAdminClient() {
    const url = getSupabaseUrl();
    const serviceKey = getSupabaseServiceKey();
    if (!serviceKey) {
        throw new Error('SUPABASE_SERVICE_ROLE_KEY no está configurada.');
    }
    return createClient(url, serviceKey, {
        auth: { persistSession: false, autoRefreshToken: false },
    });
}

// GET - Set user as ADMIN by email
export async function POST(req: NextRequest) {
    try {
        // Verify admin via cookies (Azure AD auth)
        const cookies = req.cookies.getAll();
        const userRoleCookie = cookies.find(c => c.name === 'userRole');
        const userEmailCookie = cookies.find(c => c.name === 'userEmail');
        const authStatusCookie = cookies.find(c => c.name === 'auth_status');

        if (userRoleCookie?.value !== 'admin' || authStatusCookie?.value !== 'azure_logged_in') {
            return NextResponse.json({ error: 'No autorizado. Se requiere rol admin.' }, { status: 403 });
        }

        // Get target email from request body
        const body = await req.json();
        const { email, nombre_completo } = body;

        if (!email || !email.includes('@')) {
            return NextResponse.json({ error: 'Email inválido.' }, { status: 400 });
        }

        const supabase = getAdminClient();
        const normalizedEmail = email.toLowerCase().trim();

        // Upsert user as ADMIN
        const { data, error } = await supabase
            .from('perfiles')
            .upsert({
                email: normalizedEmail,
                nombre_completo: nombre_completo || null,
                rol: 'ADMIN',
            }, { onConflict: 'email' })
            .select()
            .single();

        if (error) throw error;

        return NextResponse.json({
            success: true,
            message: `Usuario ${normalizedEmail} establecido como ADMIN.`,
            profile: data
        });
    } catch (err: any) {
        console.error('[SET-ADMIN API] Error:', err);
        return NextResponse.json({ error: err.message || 'Error interno.' }, { status: 500 });
    }
}