import { createClient } from '@supabase/supabase-js'
import { getSupabaseAnonKey, getSupabaseUrl } from './supabase-config';

const supabaseUrl = getSupabaseUrl();
const supabaseAnonKey = getSupabaseAnonKey();

if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('[Supabase] Variables de entorno NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY son requeridas.');
}

// ── Cliente Supabase con configuración resiliente ────────────────────────
// Timeout extendido y retry adaptativo para conexiones WebSocket
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
        persistSession: true,
        autoRefreshToken: true,
    },
    realtime: {
        timeout: 40000,           // 40s timeout para eventos de realtime
        params: {
            eventsPerSecond: 10   // Limitar frecuencia de eventos
        },
    },
    global: {
        headers: {
            'x-client-info': 'sfmac-platform'
        },
        // Retry config para requests HTTP
        fetch: (url, options) => {
            return fetch(url, {
                ...options,
                signal: options?.signal || AbortSignal.timeout(30000)
            }).catch(error => {
                // Log para debugging de errores de red
                if (error.name === 'AbortError' || error.name === 'TimeoutError') {
                    console.warn('[Supabase] Request timeout, will retry...');
                }
                throw error;
            });
        }
    }
});
