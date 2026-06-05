export const HETZNER_SUPABASE_URL = 'https://api.sinfimac.pe';
export const HETZNER_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNvcnBmbG93c2ZtYWMtaGV0em5lciIsInJvbGUiOiJhbm9uIiwiaWF0IjoxNzc4NzQ4NTY5LCJleHAiOjIwODU3MjkyOTR9.UVpFZwAHuUFXKEwZANp58HP3x-9wgFGrvVY12yoC9MI';

const isSupabaseCloudUrl = (value: string) => /\.supabase\.co(?:\/|$)/i.test(value);

export const getSupabaseUrl = () => {
    const configuredUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();

    if (!configuredUrl || isSupabaseCloudUrl(configuredUrl)) {
        return HETZNER_SUPABASE_URL;
    }

    return configuredUrl;
};

export const getSupabaseAnonKey = () => {
    const configuredUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
    const configuredKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() || '';

    if (!configuredUrl || isSupabaseCloudUrl(configuredUrl)) {
        return HETZNER_SUPABASE_ANON_KEY;
    }

    if (configuredKey.includes('xqnghcdndqicqofnxvuf') || configuredKey.startsWith('sb_publishable_')) {
        return HETZNER_SUPABASE_ANON_KEY;
    }

    return configuredKey;
};

export const getSupabaseServiceKey = () => process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || '';

export const getSupabaseAuthKey = () => getSupabaseServiceKey() || getSupabaseAnonKey();
