/**
 * Supabase Server Client - Usa Service Role Key para evitar RLS
 * Versión resiliente: No crashea si faltan variables
 */
import { createClient } from '@supabase/supabase-js'

let supabaseServerInstance: ReturnType<typeof createClient> | null = null;

function getSupabaseServerClient() {
    if (supabaseServerInstance) {
        return supabaseServerInstance;
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

    // Si no hay keys, retornar null - no throw
    if (!supabaseUrl || !supabaseServiceKey) {
        console.warn('[Supabase Server] Advertencia: Faltan variables de entorno');
        return null;
    }

    supabaseServerInstance = createClient(supabaseUrl, supabaseServiceKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    });

    return supabaseServerInstance;
}

export const supabaseServer = {
    getClient: getSupabaseServerClient
};

/**
 * Helper para obtener perfil usando service role
 * Devuelve null si no hay configuración - no crashea
 */
export async function getProfileByEmail(email: string) {
    const client = getSupabaseServerClient();
    if (!client) {
        console.error('[Supabase Server] Cliente no inicializado - falta SUPABASE_SERVICE_ROLE_KEY');
        return null;
    }

    const normalizedEmail = email.toLowerCase().trim();
    
    const { data, error } = await client
        .from('perfiles')
        .select('*')
        .eq('email', normalizedEmail)
        .single();
    
    if (error) {
        console.error('[Supabase Server] Error fetching profile:', error.message);
        return null;
    }
    
    return data;
}

/**
 * Helper para obtener ticket count
 */
export async function getTicketsCount() {
    const client = getSupabaseServerClient();
    if (!client) {
        return 0;
    }
    
    const { count, error } = await client
        .from('tickets')
        .select('id', { count: 'exact', head: true });
    
    if (error) {
        console.error('[Supabase Server] Error counting tickets:', error.message);
        return 0;
    }
    
    return count || 0;
}