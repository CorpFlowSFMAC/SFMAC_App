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

export const perfilesAPI = {
    /**
     * Get all profiles (for Admin panel)
     */
    async getAll(): Promise<Perfil[]> {
        const { data, error } = await supabase
            .from('perfiles')
            .select('*')
            .order('created_at', { ascending: false });
        if (error) throw error;
        return (data || []) as Perfil[];
    },

    /**
     * Get a single profile by auth user id
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
     * Get the current user's profile
     */
    async getCurrentProfile(): Promise<Perfil | null> {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return null;
        return this.getById(user.id);
    },

    /**
     * Update a user's role (Admin only)
     */
    async updateRole(userId: string, newRole: UserRole): Promise<Perfil> {
        const { data, error } = await supabase
            .from('perfiles')
            .update({ rol: newRole })
            .eq('id', userId)
            .select()
            .single();
        if (error) throw error;
        return data as Perfil;
    },

    /**
     * Get all profiles with role GESTORA (for routing assignments)
     */
    async getGestoras(): Promise<Perfil[]> {
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
