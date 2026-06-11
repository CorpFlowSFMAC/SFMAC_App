/**
 * ADMIN USERS API ROUTE — /api/admin/users
 * Secure endpoint for creating and deleting users.
 * Uses SUPABASE_SERVICE_ROLE_KEY — never exposed to the client.
 * Auth guard: Only callable by authenticated users with rol = 'ADMIN'.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getSupabaseUrl, getSupabaseServiceKey } from '@/lib/supabase-config';

// ── Server-side Admin Client (Service Role) ───────────────────────────────────
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

// ── Auth Guard: Verify caller is an authenticated ADMIN ───────────────────────
async function verifyAdmin(req: NextRequest): Promise<{ authorized: boolean; message?: string }> {
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
        return { authorized: false, message: 'No autorizado: token faltante.' };
    }
    const token = authHeader.split(' ')[1];
    const supabase = getAdminClient();
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) {
        return { authorized: false, message: 'No autorizado: sesión inválida.' };
    }
    const { data: perfil } = await supabase
        .from('perfiles')
        .select('rol')
        .eq('id', user.id)
        .single();
    if (!perfil || perfil.rol !== 'ADMIN') {
        return { authorized: false, message: 'Prohibido: se requiere rol ADMIN.' };
    }
    return { authorized: true };
}

// ── POST /api/admin/users → Invite new user by email ─────────────────────────
export async function POST(req: NextRequest) {
    try {
        const auth = await verifyAdmin(req);
        if (!auth.authorized) {
            return NextResponse.json({ error: auth.message }, { status: 403 });
        }

        const body = await req.json();
        const { email, nombre_completo, rol = 'SIN_ACCESO' } = body;

        if (!email || !email.includes('@')) {
            return NextResponse.json({ error: 'Email inválido.' }, { status: 400 });
        }

        const supabase = getAdminClient();

        // Invite via Supabase Auth admin
        const { data: inviteData, error: inviteError } = await supabase.auth.admin.inviteUserByEmail(
            email.toLowerCase().trim(),
            { data: { nombre_completo: nombre_completo || null, rol } }
        );

        if (inviteError) {
            if (inviteError.message?.includes('already been registered')) {
                return NextResponse.json({ error: 'El usuario ya existe en el sistema.' }, { status: 409 });
            }
            throw inviteError;
        }

        const newUserId = inviteData.user?.id;
        if (!newUserId) throw new Error('No se pudo obtener el ID del nuevo usuario.');

        // Upsert into perfiles
        const { error: perfilError } = await supabase.from('perfiles').upsert({
            id: newUserId,
            email: email.toLowerCase().trim(),
            nombre_completo: nombre_completo || null,
            rol,
        }, { onConflict: 'id' });

        if (perfilError) {
            console.error('[RBAC] Upsert perfiles warning:', perfilError.message);
        }

        return NextResponse.json({
            success: true,
            message: `Invitación enviada a ${email}.`,
            userId: newUserId,
        });
    } catch (err: any) {
        console.error('[ADMIN USERS API] POST Error:', err);
        return NextResponse.json({ error: err.message || 'Error interno del servidor.' }, { status: 500 });
    }
}

// ── DELETE /api/admin/users → Remove user by userId ──────────────────────────
export async function DELETE(req: NextRequest) {
    try {
        const auth = await verifyAdmin(req);
        if (!auth.authorized) {
            return NextResponse.json({ error: auth.message }, { status: 403 });
        }

        const body = await req.json();
        const { userId } = body;

        if (!userId) {
            return NextResponse.json({ error: 'userId es requerido.' }, { status: 400 });
        }

        const supabase = getAdminClient();

        // Delete from perfiles first
        const { error: perfilError } = await supabase
            .from('perfiles')
            .delete()
            .eq('id', userId);

        if (perfilError) throw perfilError;

        // Delete from auth.users
        const { error: authError } = await supabase.auth.admin.deleteUser(userId);
        if (authError) {
            console.error('[RBAC] Delete auth.users warning:', authError.message);
        }

        return NextResponse.json({ success: true, message: 'Usuario eliminado correctamente.' });
    } catch (err: any) {
        console.error('[ADMIN USERS API] DELETE Error:', err);
        return NextResponse.json({ error: err.message || 'Error interno del servidor.' }, { status: 500 });
    }
}

// ── GET /api/admin/users → Bypasses RLS to return all users ───────────────────
export async function GET(req: NextRequest) {
    try {
        const auth = await verifyAdmin(req);
        if (!auth.authorized) {
            return NextResponse.json({ error: auth.message }, { status: 403 });
        }

        const supabase = getAdminClient();
        const { data, error } = await supabase
            .from('perfiles')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;
        
        return NextResponse.json({ success: true, perfiles: data });
    } catch (err: any) {
        console.error('[ADMIN USERS API] GET Error:', err);
        return NextResponse.json({ error: err.message || 'Error interno del servidor.' }, { status: 500 });
    }
}

// ── PATCH /api/admin/users → Update user role ────────────────────────────────
export async function PATCH(req: NextRequest) {
    try {
        const auth = await verifyAdmin(req);
        if (!auth.authorized) {
            return NextResponse.json({ error: auth.message }, { status: 403 });
        }

        const body = await req.json();
        const { userId, newRole } = body;

        if (!userId || !newRole) {
            return NextResponse.json({ error: 'userId y newRole son requeridos.' }, { status: 400 });
        }

        const supabase = getAdminClient();
        const { data, error } = await supabase
            .from('perfiles')
            .update({ rol: newRole })
            .eq('id', userId)
            .select()
            .single();

        if (error) throw error;

        return NextResponse.json({ success: true, profile: data });
    } catch (err: any) {
        console.error('[ADMIN USERS API] PATCH Error:', err);
        return NextResponse.json({ error: err.message || 'Error interno del servidor.' }, { status: 500 });
    }
}
