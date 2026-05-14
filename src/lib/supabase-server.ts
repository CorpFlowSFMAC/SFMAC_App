/**
 * Supabase Server Client - Usa Service Role Key para evitar RLS
 * Versión resiliente: No crashea si faltan variables
 */
import { createClient } from '@supabase/supabase-js';
import { getSupabaseServiceKey, getSupabaseUrl } from './supabase-config';

let supabaseServerInstance: ReturnType<typeof createClient> | null = null;

function getSupabaseServerClient() {
    if (supabaseServerInstance) {
        return supabaseServerInstance;
    }

    const supabaseUrl = getSupabaseUrl();
    const supabaseServiceKey = getSupabaseServiceKey();

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

const TICKET_SUMMARY_SELECT = `
    *,
    clients(*),
    branch_offices(*, clients(*), zonas(*)),
    technicians(*),
    gestora:gestoras(*)
`;

async function getTicketsSummaryDirect(gestorId?: string) {
    const client = getSupabaseServerClient();
    if (!client) {
        return [];
    }

    let query = client
        .from('tickets')
        .select(TICKET_SUMMARY_SELECT)
        .order('created_at', { ascending: false })
        .limit(300);

    if (gestorId) {
        query = query.eq('gestora_id', gestorId);
    }

    const { data, error } = await query;

    if (error) {
        console.error('[Supabase Server] Error fetching tickets direct fallback:', error.message);
        return [];
    }

    return data || [];
}

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
    const client = getSupabaseServerClient();
    if (!client) {
        return [];
    }

    let query = client
        .from('vw_tickets_strategic')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(300);

    if (gestorId) {
        query = query.eq('gestora_id', gestorId);
    }

    const { data, error } = await query;

    if (error) {
        console.error('[Supabase Server] Error fetching tickets from strategic view:', error.message);
        return getTicketsSummaryDirect(gestorId);
    }

    return data || [];
}

/**
 * Obtener resumen de tickets (con join mínimos)
 * Útil para dashboard
 */
export async function getTicketsSummary() {
    const client = getSupabaseServerClient();
    if (!client) {
        return [];
    }

    // Consulta enriquecida con datos financieros del backend
    const { data, error } = await client
        .from('vw_tickets_strategic')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(300);

    if (error) {
        console.log('[Supabase Server] Error fetching strategic summary:', error.message);
        return getTicketsSummaryDirect();
    }

    return data || [];
}

/**
 * Keep-alive: consulta ligera a la DB
 * Usado para verificar disponibilidad del backend Supabase self-hosted
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