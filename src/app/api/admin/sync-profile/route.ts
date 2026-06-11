/**
 * Sync Profile - /api/admin/sync-profile
 * Creates or updates a user profile from their Azure AD session
 * No auth required - uses cookies to identify user
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getSupabaseUrl, getSupabaseServiceKey } from '@/lib/supabase-config';
import { randomUUID } from 'crypto';

// Admin emails that should get ADMIN role
const ADMIN_EMAILS = ['acubas@sinfimac.pe', 'admin@sinfimac.pe', 'pjsr71081@gmail.com'];

export async function POST(req: NextRequest) {
    try {
        // Get user info from cookies
        const cookies = req.cookies.getAll();
        const userEmailCookie = cookies.find(c => c.name === 'userEmail');
        const userRoleCookie = cookies.find(c => c.name === 'userRole');
        const authStatusCookie = cookies.find(c => c.name === 'auth_status');

        // Verify user is authenticated via Azure AD
        if (authStatusCookie?.value !== 'azure_logged_in' || !userEmailCookie?.value) {
            return NextResponse.json({ error: 'No autenticado via Azure AD.' }, { status: 401 });
        }

        const userEmail = userEmailCookie.value.toLowerCase().trim();
        const currentRole = userRoleCookie?.value || 'sin_acceso';

        // Get Supabase service client
        const supabaseUrl = getSupabaseUrl();
        const supabaseServiceKey = getSupabaseServiceKey();

        if (!supabaseServiceKey) {
            return NextResponse.json({ error: 'Service key no configurada.' }, { status: 500 });
        }

        const supabase = createClient(supabaseUrl, supabaseServiceKey, {
            auth: { persistSession: false, autoRefreshToken: false },
        });

        // Check if profile exists
        const { data: existingProfile } = await supabase
            .from('perfiles')
            .select('*')
            .eq('email', userEmail)
            .maybeSingle();

        // Determine correct role
        const isAdminEmail = ADMIN_EMAILS.includes(userEmail);
        const correctRole = isAdminEmail ? 'ADMIN' : 
            (currentRole === 'admin' ? 'ADMIN' : 
             (currentRole === 'gestora' ? 'GESTORA' : 
              (currentRole === 'espectador' ? 'ESPECTADOR' : 'GESTORA')));

        let result;
        if (existingProfile) {
            // Update existing profile
            const { data, error } = await supabase
                .from('perfiles')
                .update({ rol: correctRole })
                .eq('email', userEmail)
                .select()
                .single();

            if (error) throw error;
            result = data;
            console.log(`[SYNC] Perfil ${userEmail} actualizado a ${correctRole}`);
        } else {
            // Create new profile
            const { data, error } = await supabase
                .from('perfiles')
                .insert({
                    id: randomUUID(),
                    email: userEmail,
                    nombre_completo: null,
                    rol: correctRole,
                })
                .select()
                .single();

            if (error) throw error;
            result = data;
            console.log(`[SYNC] Perfil ${userEmail} creado con rol ${correctRole}`);
        }

        // Update the cookie to match the correct role
        const response = NextResponse.json({
            success: true,
            message: `Perfil sincronizado: ${userEmail} = ${correctRole}`,
            profile: {
                id: result.id,
                email: result.email,
                rol: result.rol,
            },
            updated: !!existingProfile,
        });

        // Update the userRole cookie
        response.cookies.set('userRole', correctRole.toLowerCase(), {
            path: '/',
            httpOnly: false,
            sameSite: 'lax',
            maxAge: 86400,
        });

        return response;

    } catch (err: any) {
        console.error('[SYNC PROFILE API] Error:', err);
        return NextResponse.json({ error: err.message || 'Error interno.' }, { status: 500 });
    }
}

// Also support GET for easy testing
export async function GET(req: NextRequest) {
    return POST(req);
}