import { createClient } from '@supabase/supabase-js'
import { getSupabaseAnonKey, getSupabaseUrl } from './supabase-config';

// Lazy initialization - don't throw at module level
let _supabase: ReturnType<typeof createClient> | null = null;

export const getSupabase = () => {
    if (_supabase) return _supabase;
    
    const supabaseUrl = getSupabaseUrl();
    const supabaseAnonKey = getSupabaseAnonKey();
    
    if (!supabaseUrl || !supabaseAnonKey) {
        console.warn('[Supabase] Variables de entorno no configuradas. Retornando null.');
        return null;
    }
    
    _supabase = createClient(supabaseUrl, supabaseAnonKey);
    return _supabase;
};

// Legacy export for backward compatibility
export const supabase = {
    from: (table: string) => getSupabase()?.from(table),
    rpc: (fn: string, params?: any) => getSupabase()?.rpc(fn, params),
    auth: {
        getSession: () => getSupabase()?.auth.getSession(),
    },
};
