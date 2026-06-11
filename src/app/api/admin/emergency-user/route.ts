/**
 * Emergency User Setup - /api/admin/emergency-user
 * Creates or updates a user profile directly using a secret key
 * This bypasses normal auth for emergency situations
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getSupabaseUrl, getSupabaseServiceKey } from '@/lib/supabase-config';
import { randomUUID } from 'crypto';

// Emergency secret key - should match environment variable if set
const EMERGENCY_SECRET = process.env.EMERGENCY_ADMIN_SECRET || 'sinfimac-emergency-2026';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { secret, email, nombre_completo, rol = 'ADMIN' } = body;

        // Verify emergency secret
        if (secret !== EMERGENCY_SECRET) {
            return NextResponse.json({ error: 'Secret inválido.' }, { status: 403 });
        }

        if (!email || !email.includes('@')) {
            return NextResponse.json({ error: 'Email inválido.' }, { status: 400 });
        }

        // Validate rol
        const validRoles = ['ADMIN', 'GESTORA', 'ESPECTADOR', 'SIN_ACCESO'];
        if (!validRoles.includes(rol)) {
            return NextResponse.json({ error: 'Rol inválido.' }, { status: 400 });
        }

        const supabaseUrl = getSupabaseUrl();
        const supabaseServiceKey = getSupabaseServiceKey();

        if (!supabaseServiceKey) {
            return NextResponse.json({ error: 'Service key no configurada.' }, { status: 500 });
        }

        const supabase = createClient(supabaseUrl, supabaseServiceKey, {
            auth: { persistSession: false, autoRefreshToken: false },
        });

        const normalizedEmail = email.toLowerCase().trim();

        // Check if user exists
        const { data: existingUser } = await supabase
            .from('perfiles')
            .select('*')
            .eq('email', normalizedEmail)
            .maybeSingle();

        let result;
        if (existingUser) {
            // Update existing user
            const { data, error } = await supabase
                .from('perfiles')
                .update({
                    rol,
                    nombre_completo: nombre_completo || existingUser.nombre_completo,
                })
                .eq('email', normalizedEmail)
                .select()
                .single();

            if (error) throw error;
            result = data;
            console.log(`[EMERGENCY] Usuario ${normalizedEmail} actualizado a ${rol}`);
        } else {
            // Create new user
            const { data, error } = await supabase
                .from('perfiles')
                .insert({
                    id: randomUUID(),
                    email: normalizedEmail,
                    nombre_completo: nombre_completo || null,
                    rol,
                })
                .select()
                .single();

            if (error) throw error;
            result = data;
            console.log(`[EMERGENCY] Usuario ${normalizedEmail} creado como ${rol}`);
        }

        return NextResponse.json({
            success: true,
            message: `Usuario ${normalizedEmail} establecido como ${rol}.`,
            profile: {
                id: result.id,
                email: result.email,
                rol: result.rol,
                nombre_completo: result.nombre_completo,
            }
        });

    } catch (err: any) {
        console.error('[EMERGENCY USER API] Error:', err);
        return NextResponse.json({ error: err.message || 'Error interno.' }, { status: 500 });
    }
}