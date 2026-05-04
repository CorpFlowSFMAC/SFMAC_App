/**
 * API de Diagnóstico - Verifica conexión a DB y cuenta tickets
 * Usa Service Role Key para evitar problemas de RLS
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
const hasServiceKey = !!supabaseServiceKey;

function getClient() {
    if (supabaseServiceKey && supabaseUrl) {
        return createClient(supabaseUrl, supabaseServiceKey);
    }
    return null;
}

export async function GET(request: NextRequest) {
    const client = getClient();
    
    if (!client || !supabaseUrl) {
        return NextResponse.json({
            success: false,
            error: 'Supabase no configurado',
            hasServiceKey,
            hasUrl: !!supabaseUrl
        }, { status: 500 });
    }

    try {
        // Obtener perfiles
        const { data: perfiles, error: profilesError } = await client
            .from('perfiles')
            .select('id, email, rol, nombre_completo')
            .limit(10);

        // Contar tickets
        const { count: ticketsCount, error: ticketsError } = await client
            .from('tickets')
            .select('id', { count: 'exact', head: true });

        // Buscar admin específico
        const admin = perfiles?.find(p => 
            p.email?.toLowerCase() === 'acubas@sinfimac.pe'
        );

        let adminStatus = 'NO_ENCONTRADO';
        if (admin) {
            adminStatus = `ENCONTRADO - Rol: ${admin.rol}`;
        }

        return NextResponse.json({
            success: true,
            connection: 'ACTIVE_HEALTHY',
            hasServiceKey,
            admin: {
                email: 'acubas@sinfimac.pe',
                status: adminStatus,
                found: !!admin,
                role: admin?.rol || null
            },
            profiles: {
                count: perfiles?.length || 0,
                list: perfiles?.map(p => ({ email: p.email, rol: p.rol })) || [],
                errors: profilesError?.message || null
            },
            tickets: {
                count: ticketsCount || 0,
                error: ticketsError?.message || null
            },
            config: {
                url: supabaseUrl ? ' configurada' : ' FALTA',
                serviceKey: hasServiceKey ? ' configurada' : ' FALTA'
            }
        });
    } catch (err: any) {
        return NextResponse.json({
            success: false,
            error: err.message,
            hasServiceKey
        }, { status: 500 });
    }
}