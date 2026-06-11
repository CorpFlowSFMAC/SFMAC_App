/**
 * PROFILES API
 * CRUD operations for the perfiles table (RBAC system)
 */
import { supabase } from './supabase';

export type UserRole = 'ADMIN' | 'GESTORA' | 'ESPECTADOR' | 'SIN_ACCESO';

export interface Perfil {
    id: string;
    email: string;
    nombre_completo: string | null;
    rol: UserRole;
    created_at: string;
    updated_at: string;
}

// Helper to get token for API calls
async function getAuthToken(): Promise<string | null> {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token || null;
}

export const perfilesAPI = {
    /**
     * Get all profiles (for Admin panel)
     * Works with both Supabase Auth sessions and Azure AD cookie-based auth
     */
    async getAll(): Promise<Perfil[]> {
        const token = await getAuthToken();
        const headers: Record<string, string> = {};
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }
        const res = await fetch('/api/admin/users', { 
            headers,
            credentials: 'include'  // Send cookies for Azure AD auth
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Error al obtener usuarios');
        return json.perfiles || [];
    },

    /**
     * Get a single profile by auth user id (fallback to direct DB, mostly not needed now)
     */
    async getById(userId: string): Promise<Perfil | null> {
        const { data, error } = await supabase
            .from('perfiles')
            .select('*')
            .eq('id', userId)
            .single();
        if (error) {
            if (error.code === 'PGRST116') return null; // Not found
            throw error;
        }
        return data as Perfil;
    },

    /**
     * Get a profile by email (for Azure AD authentication)
     */
    async getByEmail(email: string): Promise<Perfil | null> {
        const normalizedEmail = email.toLowerCase().trim();
        const { data, error } = await supabase
            .from('perfiles')
            .select('*')
            .eq('email', normalizedEmail)
            .single();
        if (error) {
            if (error.code === 'PGRST116') return null; // Not found
            throw error;
        }
        return data as Perfil;
    },

    /**
     * Get the current user's profile securely via backend bypass RLS
     * Works with both Supabase Auth sessions and Azure AD cookie-based auth
     */
    async getCurrentProfile(): Promise<Perfil | null> {
        const token = await getAuthToken();
        const headers: Record<string, string> = {};
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }
        try {
            const res = await fetch('/api/profile', { 
                headers,
                credentials: 'include'  // Send cookies for Azure AD auth
            });
            if (!res.ok) return null;
            const json = await res.json();
            return json.profile || null;
        } catch {
            return null;
        }
    },

    /**
     * Update a user's role (Admin only)
     * Works with both Supabase Auth sessions and Azure AD cookie-based auth
     */
    async updateRole(userId: string, newRole: UserRole): Promise<Perfil> {
        const token = await getAuthToken();
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
        };
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }
        const res = await fetch('/api/admin/users', {
            method: 'PATCH',
            headers,
            credentials: 'include',  // Send cookies for Azure AD auth
            body: JSON.stringify({ userId, newRole })
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Error al actualizar rol');
        return json.profile as Perfil;
    },

    /**
     * Get all profiles with role GESTORA (for routing assignments)
     */
    async getGestoras(): Promise<Perfil[]> {
        // Direct DB read (might fail if strict RLS, but if it works it works)
        const { data, error } = await supabase
            .from('perfiles')
            .select('*')
            .eq('rol', 'GESTORA')
            .order('nombre_completo');
        if (error) throw error;
        return (data || []) as Perfil[];
    },

    /**
     * Check if user has access (role is not SIN_ACCESO)
     */
    hasAccess(perfil: Perfil | null): boolean {
        if (!perfil) return false;
        return perfil.rol !== 'SIN_ACCESO';
    },

    /**
     * Check if user is Admin
     */
    isAdmin(perfil: Perfil | null): boolean {
        if (!perfil) return false;
        return perfil.rol === 'ADMIN';
    },

    /**
     * Map RBAC role to the legacy cookie role format
     */
    toLegacyRole(perfil: Perfil | null): string {
        if (!perfil) return 'sin_acceso';
        switch (perfil.rol) {
            case 'ADMIN': return 'admin';
            case 'GESTORA': return 'gestor';
            case 'ESPECTADOR': return 'espectador';
            default: return 'sin_acceso';
        }
    }
};
