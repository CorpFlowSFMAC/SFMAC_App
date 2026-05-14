export const HETZNER_SUPABASE_URL = 'http://87.99.137.96:8000';

export const getSupabaseUrl = () => process.env.NEXT_PUBLIC_SUPABASE_URL || HETZNER_SUPABASE_URL;

export const getSupabaseAnonKey = () => process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export const getSupabaseServiceKey = () => process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || '';

export const getSupabaseAuthKey = () => getSupabaseServiceKey() || getSupabaseAnonKey();
