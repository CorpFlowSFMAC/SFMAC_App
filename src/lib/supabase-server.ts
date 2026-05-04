/**
 * Supabase Server Client - Usa Service Role Key para evitar RLS
 * 
 * Este cliente se usa en el servidor (API routes) para operaciones
 * que requieren acceso completo a la base de datos sin restricciones de RLS.
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('[Supabase Server] Se requieren NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY');
}

// Cliente con service role - ignora RLS
export const supabaseServer = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
})

/**
 * Helper para obtener perfil usando service role
 * Evita cualquier problema de RLS
 */
export async function getProfileByEmail(email: string) {
    const normalizedEmail = email.toLowerCase().trim();
    
    const { data, error } = await supabaseServer
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
    const { count, error } = await supabaseServer
        .from('tickets')
        .select('id', { count: 'exact', head: true });
    
    if (error) {
        console.error('[Supabase Server] Error counting tickets:', error.message);
        return 0;
    }
    
    return count || 0;
}