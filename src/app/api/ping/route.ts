/**
 * API: Ping - Keep-alive para evitar pausa de Supabase
 * Mantiene la conexión activa con pings periódicos
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(request: NextRequest) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
    
    if (!supabaseUrl) {
        return NextResponse.json({ 
            success: false, 
            error: 'SUPABASE_URL no configurada' 
        });
    }
    
    // Crear cliente con service key si está disponible, si no usar anon
    const client = supabaseServiceKey 
        ? createClient(supabaseUrl, supabaseServiceKey)
        : createClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJxxxxx');
    
    try {
        // Ping a la tabla profiles para mantener conexión activa
        const { data: profiles, error: profilesError } = await client
            .from('perfiles')
            .select('id, email, rol')
            .limit(3);
        
        const { data: tickets, error: ticketsError } = await client
            .from('tickets')
            .select('id, estado')
            .limit(1);
        
        const { count: ticketCount } = await client
            .from('tickets')
            .select('id', { count: 'exact', head: true });
        
        const adminProfile = profiles?.find(p => 
            p.email?.toLowerCase() === 'acubas@sinfimac.pe' || 
            p.email?.toLowerCase() === 'admin@sinfimac.pe'
        );
        
        return NextResponse.json({
            success: true,
            timestamp: new Date().toISOString(),
            database: 'ACTIVE_HEALTHY',
            hasServiceKey: !!supabaseServiceKey,
            profiles: {
                count: profiles?.length || 0,
                sample: profiles?.slice(0, 2) || [],
                adminFound: !!adminProfile,
                adminRole: adminProfile?.rol || null
            },
            tickets: {
                count: ticketCount || 0,
                sample: tickets?.[0] || null
            },
            errors: {
                profiles: profilesError?.message || null,
                tickets: ticketsError?.message || null
            }
        });
    } catch (err: any) {
        return NextResponse.json({
            success: false,
            error: err.message
        }, { status: 500 });
    }
}