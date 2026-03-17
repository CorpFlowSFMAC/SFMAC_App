/**
 * ROUTING ENGINE API
 * API functions for the cascading routing engine (Cliente > Zona > Agencia)
 * 
 * Regla de asignación:
 * - Una gestora puede ser responsable de una o más ZONAS completas
 * - Adicionalmente puede tener AGENCIAS específicas de otras zonas
 * - Resolución en cascada: Agencia (directo) → Agencia (por gestora_branch_assignments) → Zona → Cliente
 */
import { supabase } from './supabase';

// ============================================
// HELPER: Resolver gestoras.id desde cualquier ID
// ============================================
/**
 * Dado un gestoraId (puede ser auth_user_id de perfiles o id de gestoras),
 * devuelve el id correcto de la tabla gestoras para guardar en FKs.
 */
async function resolveGestorasId(rawId: string | null): Promise<string | null> {
    if (!rawId) return null;

    // Primero intentamos buscar directamente en gestoras (id nativo)
    const { data: direct } = await supabase
        .from('gestoras')
        .select('id')
        .eq('id', rawId)
        .maybeSingle();

    if (direct) return direct.id;

    // Si no existe, el rawId podría ser auth_user_id (de perfiles RBAC)
    const { data: byAuthId } = await supabase
        .from('gestoras')
        .select('id')
        .eq('auth_user_id', rawId)
        .maybeSingle();

    if (byAuthId) return byAuthId.id;

    // No encontrado en gestoras → el usuario es solo RBAC perfiles sin registro legacy
    // Intentamos crear un registro en gestoras para que sea compatible
    const { data: perfil } = await supabase
        .from('perfiles')
        .select('id, email, nombre_completo')
        .eq('id', rawId)
        .maybeSingle();

    if (perfil) {
        const { data: newGestora, error } = await supabase
            .from('gestoras')
            .upsert({
                auth_user_id: perfil.id,
                email: perfil.email,
                name: perfil.nombre_completo || perfil.email?.split('@')[0] || 'Gestora',
                status: 'active'
            }, { onConflict: 'email' })
            .select('id')
            .single();

        if (!error && newGestora) return newGestora.id;
    }

    return null;
}

// ============================================
// GESTORAS API
// ============================================
export const gestorasAPI = {
    /**
     * Obtiene gestoras desde la tabla `perfiles` (RBAC) con rol = 'GESTORA'.
     * También incluye gestoras de la tabla legacy `gestoras` para compatibilidad.
     * El resultado combinado se usa para los dropdowns de asignación en Enrutamiento.
     */
    async getAll() {
        // Primero: Obtener gestoras desde perfiles RBAC
        const { data: perfilGestoras, error: perfilError } = await supabase
            .from('perfiles')
            .select('id, email, nombre_completo, rol')
            .eq('rol', 'GESTORA')
            .order('nombre_completo');

        if (perfilError) {
            console.warn('[GestorasAPI] Error fetching from perfiles, falling back:', perfilError);
        }

        // Convertir perfiles al formato de gestoras para compatibilidad
        const fromPerfiles = (perfilGestoras || []).map((p: any) => ({
            id: p.id,
            name: p.nombre_completo || p.email.split('@')[0],
            email: p.email,
            status: 'active',
            auth_user_id: p.id,
            _source: 'perfiles'
        }));

        // Fallback: También leer de la tabla legacy gestoras
        const { data: legacyGestoras, error: legacyError } = await supabase
            .from('gestoras')
            .select('*')
            .eq('status', 'active')
            .order('name');

        if (legacyError) {
            console.warn('[GestorasAPI] Error fetching legacy gestoras:', legacyError);
        }

        // Combinar: priorizar perfiles RBAC, agregar legacy que no estén duplicadas
        const perfilIds = new Set(fromPerfiles.map((p: any) => p.id));
        const perfilEmails = new Set(fromPerfiles.map((p: any) => p.email?.toLowerCase()));
        const uniqueLegacy = (legacyGestoras || []).filter((g: any) =>
            !perfilIds.has(g.auth_user_id) && !perfilEmails.has(g.email?.toLowerCase())
        );

        return [...fromPerfiles, ...uniqueLegacy];
    },

    async getById(id: string) {
        const { data, error } = await supabase
            .from('gestoras')
            .select('*')
            .eq('id', id)
            .single();
        if (error) throw error;
        return data;
    },

    async create(gestora: { name: string; email?: string; phone?: string; auth_user_id?: string }) {
        const { data, error } = await supabase
            .from('gestoras')
            .insert(gestora)
            .select()
            .single();
        if (error) throw error;
        return data;
    },

    async update(id: string, updates: Partial<{ name: string; email: string; phone: string; status: string }>) {
        const { data, error } = await supabase
            .from('gestoras')
            .update(updates)
            .eq('id', id)
            .select()
            .single();
        if (error) throw error;
        return data;
    },

    async delete(id: string) {
        const { error } = await supabase
            .from('gestoras')
            .delete()
            .eq('id', id);
        if (error) throw error;
    }
};

// ============================================
// ZONAS API
// ============================================
export const zonasAPI = {
    async getAll() {
        const { data, error } = await supabase
            .from('zonas')
            .select('*, client:clients(id, name, icon, color_aura), gestora:gestoras(id, name, email)')
            .order('nombre');
        if (error) throw error;
        return data || [];
    },

    async getByClient(clientId: string) {
        const { data, error } = await supabase
            .from('zonas')
            .select('*, gestora:gestoras(id, name, email)')
            .eq('client_id', clientId)
            .order('nombre');
        if (error) throw error;
        return data || [];
    },

    async create(zona: { nombre: string; codigo: string; client_id: string; icon?: string; color?: string; departamentos?: string[] }) {
        const { data, error } = await supabase
            .from('zonas')
            .insert(zona)
            .select()
            .single();
        if (error) throw error;
        return data;
    },

    async updateGestora(id: string, rawGestoraId: string | null) {
        // ── CORRECCIÓN CLAVE: Resolver al gestoras.id real antes de guardar ──
        const gestoraId = await resolveGestorasId(rawGestoraId);

        const { data, error } = await supabase
            .from('zonas')
            .update({ gestora_asignada_id: gestoraId })
            .eq('id', id)
            .select('*, gestora:gestoras(id, name, email)')
            .single();
        if (error) throw error;
        return data;
    },

    async delete(id: string) {
        const { error } = await supabase
            .from('zonas')
            .delete()
            .eq('id', id);
        if (error) throw error;
    }
};

// ============================================
// GESTORA BRANCH ASSIGNMENTS API
// Regla: Una gestora puede tener zonas + agencias específicas de otras zonas
// ============================================
export const gestoraBranchAPI = {
    /**
     * Obtiene las agencias específicas asignadas a una gestora
     * (agencias que están fuera de su zona principal)
     */
    async getByGestora(rawGestoraId: string) {
        const gestoraId = await resolveGestorasId(rawGestoraId);
        if (!gestoraId) return [];

        const { data, error } = await supabase
            .from('gestora_branch_assignments')
            .select('branch_id, branch:branch_offices(id, name, zone, address, departamento, client:clients(id, name, icon, color_aura))')
            .eq('gestora_id', gestoraId);
        if (error) throw error;
        return (data || []).map((r: any) => r.branch).filter(Boolean);
    },

    /**
     * Sincroniza las agencias específicas de una gestora.
     * branchIds = lista completa de agencias específicas a asignar
     */
    async syncBranchAssignments(rawGestoraId: string, branchIds: string[]) {
        const gestoraId = await resolveGestorasId(rawGestoraId);
        if (!gestoraId) throw new Error('Gestora no encontrada en el sistema');

        // Eliminar todas las asignaciones anteriores
        await supabase
            .from('gestora_branch_assignments')
            .delete()
            .eq('gestora_id', gestoraId);

        if (branchIds.length === 0) return [];

        // Insertar las nuevas
        const inserts = branchIds.map(bid => ({ gestora_id: gestoraId, branch_id: bid }));
        const { data, error } = await supabase
            .from('gestora_branch_assignments')
            .insert(inserts)
            .select();
        if (error) throw error;
        return data || [];
    },

    /**
     * Agrega una agencia específica a una gestora
     */
    async addBranch(rawGestoraId: string, branchId: string) {
        const gestoraId = await resolveGestorasId(rawGestoraId);
        if (!gestoraId) throw new Error('Gestora no encontrada');

        const { data, error } = await supabase
            .from('gestora_branch_assignments')
            .upsert({ gestora_id: gestoraId, branch_id: branchId })
            .select();
        if (error) throw error;
        return data;
    },

    /**
     * Elimina una agencia específica de una gestora
     */
    async removeBranch(rawGestoraId: string, branchId: string) {
        const gestoraId = await resolveGestorasId(rawGestoraId);
        if (!gestoraId) return;

        const { error } = await supabase
            .from('gestora_branch_assignments')
            .delete()
            .eq('gestora_id', gestoraId)
            .eq('branch_id', branchId);
        if (error) throw error;
    }
};

// ============================================
// ROUTING ASSIGNMENTS API
// ============================================
export const routingAPI = {
    // Assign gestora to client (Nivel Nacional)
    async assignGestoraToClient(clientId: string, rawGestoraId: string | null) {
        const gestoraId = await resolveGestorasId(rawGestoraId);

        const { data, error } = await supabase
            .from('clients')
            .update({ gestora_asignada_id: gestoraId })
            .eq('id', clientId)
            .select('*, gestora:gestoras(id, name, email)')
            .single();
        if (error) throw error;
        return data;
    },

    // Assign gestora to zona (Nivel Regional)
    async assignGestoraToZona(zonaId: string, gestoraId: string | null) {
        return zonasAPI.updateGestora(zonaId, gestoraId);
    },

    // Assign gestora to branch (Nivel Agencia) 
    async assignGestoraToBranch(branchId: string, rawGestoraId: string | null) {
        const gestoraId = await resolveGestorasId(rawGestoraId);

        const { data, error } = await supabase
            .from('branch_offices')
            .update({ gestora_asignada_id: gestoraId })
            .eq('id', branchId)
            .select('*, gestora:gestoras(id, name, email)')
            .single();
        if (error) throw error;
        return data;
    },

    // Get clients with their gestora assignments
    async getClientsWithGestora() {
        const { data, error } = await supabase
            .from('clients')
            .select('id, name, icon, color_aura, logo, gestora_asignada_id, gestora:gestoras(id, name, email)')
            .order('name');
        if (error) throw error;
        return data || [];
    },

    // Get branches with their gestora assignments (filtrable by client)
    async getBranchesWithGestora(clientId?: string) {
        let query = supabase
            .from('branch_offices')
            .select('id, name, zone, departamento, client_id, zona_id, gestora_asignada_id, gestora:gestoras(id, name, email), client:clients(id, name, icon, color_aura)')
            .order('name');

        if (clientId) {
            query = query.eq('client_id', clientId);
        }

        const { data, error } = await query;
        if (error) throw error;
        return data || [];
    },

    /**
     * Resolve gestora for a branch using cascade logic:
     * 1. Agencia directa (branch.gestora_asignada_id)
     * 2. Agencia por asignación específica (gestora_branch_assignments)
     * 3. Zona (branch.zona_id → zonas.gestora_asignada_id)
     * 4. Cliente (branch.client_id → clients.gestora_asignada_id)
     */
    async resolveGestora(branchId: string): Promise<string | null> {
        // Step 1: Get branch with its zona and client info
        const { data: branch, error: branchError } = await supabase
            .from('branch_offices')
            .select('gestora_asignada_id, zona_id, client_id')
            .eq('id', branchId)
            .single();

        if (branchError || !branch) return null;

        // Cascade Step 1: Check branch-level direct assignment
        if (branch.gestora_asignada_id) {
            return branch.gestora_asignada_id;
        }

        // Cascade Step 2: Check gestora_branch_assignments (agencias específicas de gestoras)
        const { data: specificAssignment } = await supabase
            .from('gestora_branch_assignments')
            .select('gestora_id')
            .eq('branch_id', branchId)
            .maybeSingle();

        if (specificAssignment?.gestora_id) {
            return specificAssignment.gestora_id;
        }

        // Cascade Step 3: Check zona-level assignment
        if (branch.zona_id) {
            const { data: zona, error: zonaError } = await supabase
                .from('zonas')
                .select('gestora_asignada_id')
                .eq('id', branch.zona_id)
                .single();

            if (!zonaError && zona?.gestora_asignada_id) {
                return zona.gestora_asignada_id;
            }
        }

        // Cascade Step 4: Check client-level assignment
        if (branch.client_id) {
            const { data: client, error: clientError } = await supabase
                .from('clients')
                .select('gestora_asignada_id')
                .eq('id', branch.client_id)
                .single();

            if (!clientError && client?.gestora_asignada_id) {
                return client.gestora_asignada_id;
            }
        }

        // No assignment found at any level
        return null;
    },

    // Get routing summary for dashboard
    async getRoutingSummary() {
        const [clients, zonas, branches, gestoras] = await Promise.all([
            routingAPI.getClientsWithGestora(),
            zonasAPI.getAll(),
            routingAPI.getBranchesWithGestora(),
            gestorasAPI.getAll()
        ]);

        return {
            clients,
            zonas,
            branches,
            gestoras,
            stats: {
                totalClients: clients.length,
                clientsWithGestora: clients.filter((c: any) => c.gestora_asignada_id).length,
                totalZonas: zonas.length,
                zonasWithGestora: zonas.filter((z: any) => z.gestora_asignada_id).length,
                totalBranches: branches.length,
                branchesWithGestora: branches.filter((b: any) => b.gestora_asignada_id).length,
                totalGestoras: gestoras.length,
            }
        };
    }
};
