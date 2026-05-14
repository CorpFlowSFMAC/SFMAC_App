export const HETZNER_SUPABASE_URL = 'http://87.99.137.96:8000';

const isSupabaseCloudUrl = (value: string) => /\.supabase\.co(?:\/|$)/i.test(value);

export const getSupabaseUrl = () => {
    const configuredUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();

    if (!configuredUrl || isSupabaseCloudUrl(configuredUrl)) {
        return HETZNER_SUPABASE_URL;
    }

    return configuredUrl;
};

export const getSupabaseAnonKey = () => process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export const getSupabaseServiceKey = () => process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || '';

export const getSupabaseAuthKey = () => getSupabaseServiceKey() || getSupabaseAnonKey();
