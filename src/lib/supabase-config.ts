// ═══════════════════════════════════════════════════════════════════
// CONFIGURACIÓN CRÍTICA: Backend auto-alojado (Self-Hosted)
// IMPORTANTE: NO usar supabase.co - Esta es una instancia local en IP directa
// ═══════════════════════════════════════════════════════════════════
// URL: http://87.99.137.96:8000 (Supabase Self-Hosted en Hetzner)
export const HETZNER_SUPABASE_URL = 'http://87.99.137.96:8000';

const isSupabaseCloudUrl = (value: string) => /\.supabase\.co(?:\/|$)/i.test(value);

export const getSupabaseUrl = () => {
    const configuredUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();

    // Si no hay URL configurada o es la nube oficial de Supabase, usar la IP directa
    if (!configuredUrl || isSupabaseCloudUrl(configuredUrl)) {
        return HETZNER_SUPABASE_URL;
    }

    return configuredUrl;
};

export const getSupabaseAnonKey = () => process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export const getSupabaseServiceKey = () => process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || '';

export const getSupabaseAuthKey = () => getSupabaseServiceKey() || getSupabaseAnonKey();
