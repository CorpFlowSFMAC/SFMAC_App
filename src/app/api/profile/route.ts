/**
 * API: Get User Profile - Busca perfil de usuario via Service Role
 * Evita RLS buscando desde el servidor
 */
import { NextRequest, NextResponse } from 'next/server';
import { getProfileByEmail } from '@/lib/supabase-server';

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const email = searchParams.get('email');

    if (!email) {
        return NextResponse.json({ error: 'Email requerido' }, { status: 400 });
    }

    try {
        const normalizedEmail = email.toLowerCase().trim();
        
        const perfil = await getProfileByEmail(normalizedEmail);

        if (!perfil) {
            console.log('[API Profile] No encontrado:', normalizedEmail);
            return NextResponse.json({ 
                found: false, 
                email: normalizedEmail,
                error: 'Perfil no existe en la base de datos'
            });
        }

        return NextResponse.json({
            found: true,
            perfil: {
                id: perfil.id,
                email: perfil.email,
                nombre_completo: perfil.nombre_completo,
                rol: perfil.rol
            }
        });
    } catch (err: any) {
        console.error('[API Profile] Error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}