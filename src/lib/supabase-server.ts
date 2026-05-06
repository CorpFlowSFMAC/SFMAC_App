/**
 * Supabase Server Client - Usa Service Role Key para evitar RLS
 * Versión resiliente: No crashea si faltan variables
 */
import { createClient } from '@supabase/supabase-js';

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

// Exportar getClient para uso en endpoints - siempre como any para evitar errores de tipo
export { getSupabaseServerClient as getClient };

/**
 * Helper para obtener perfil usando service role
 * Devuelve null si no hay configuración - no crashea
 */
export async function getProfileByEmail(email: string): Promise<any> {
    const client = getSupabaseServerClient() as any;
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
    const client = getSupabaseServerClient() as any;
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

/**
 * Obtener TODOS los tickets usando service role (ignora RLS)
 * Versión ligera para evitar payload masivo
 */
export async function getAllTicketsLite(gestorId?: string) {
    const client = getSupabaseServerClient() as any;
    if (!client) {
        return [];
    }
    
    let query = client
        .from('tickets')
        .select('id, status_id, estadoId, service_type, description, descripcionProblema, diagnosis, client_ticket_number, created_at, labor_cost, materials_cost, visit_cost, total_quoted_amount, priority, current_step, created_by, client_id, branch_id, technician_id, gestora_id, metadata')
        .order('created_at', { ascending: false })
        .limit(200);
    
    if (gestorId) {
        query = query.eq('gestora_id', gestorId);
    }
    
    const { data, error } = await query;
    
    if (error) {
        console.error('[Supabase Server] Error fetching tickets:', error.message);
        return [];
    }
    
    return data || [];
}

/**
 * Obtener resumen de tickets (con join mínimos)
 * Útil para dashboard
 */
export async function getTicketsSummary() {
    const client = getSupabaseServerClient() as any;
    if (!client) {
        return [];
    }
    
    // Consulta simple sin relaciones complejas
    const { data, error } = await client
        .from('tickets')
        .select('*')
        .order('creado_el', { ascending: false })
        .limit(100);

    if (error) {
        console.log('[Supabase Server] Error fetching tickets:', error.message);
        return [];
    }

    return data || [];
}

/**
 * Keep-alive: consulta légère a la DB
 * Usado para evitar pausa por inactividad en Supabase Free Tier
 */
export async function pingDatabase() {
    const client = getSupabaseServerClient() as any;
    if (!client) {
        return false;
    }
    
    try {
        // Consulta muy ligera: solo verificar conexión
        const { error } = await client
            .from('tickets')
            .select('id')
            .limit(1);
        
        if (error) {
            console.error('[Supabase Server] Ping failed:', error.message);
            return false;
        }
        
        return true;
    } catch (e) {
        console.error('[Supabase Server] Ping exception:', e);
        return false;
    }
}