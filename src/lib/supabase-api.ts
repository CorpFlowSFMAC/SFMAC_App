import { supabase } from './supabase'
import { stripFinancialMetadata } from './financialMetadata'
import { round2 } from './formatters'
import { sanitizeTicketMetadata } from './calculations'

const toNumberSafe = (value: any): number => {
    const num = typeof value === 'string' ? parseFloat(value) : Number(value);
    return isNaN(num) ? 0 : num;
};

/**
 * Helper para obtener el código de zona de una relación zonas de Supabase.
 * La relación puede retornar un array o un objeto según el contexto.
 */
const getZonaCodigo = (zonasRelation: any): string | null => {
    if (!zonasRelation) return null;
    if (Array.isArray(zonasRelation)) {
        return zonasRelation[0]?.codigo || null;
    }
    return zonasRelation.codigo || null;
};

export class DuplicateTicketCostError extends Error {
    constructor() {
        super('Ya existe un pago confirmado con el mismo ticket, monto y concepto.');
        this.name = 'DuplicateTicketCostError';
    }
}

const TICKET_LIST_SELECT = `
    *,
    clients(*),
    branch_offices(*, clients(*), zonas(*)),
    technicians(*),
    gestora:gestoras(*)
`;

const PAYMENT_TICKET_SELECT = `
    id, ticket_number, status_id, service_type, description,
    client_ticket_number, created_at, labor_cost, materials_cost, visit_cost,
    total_quoted_amount, client_id, branch_id, technician_id, gestora_id,
    diagnosis, priority, sede_reportada_cliente,
    clients(id, name, ruc),
    branch_offices(id, name),
    technicians(id, name, bank_name, account_number, cci, yape_number, plin_number, phone),
    gestoras(id, name)
`;

const attachTicketCosts = async <T extends { id?: string }>(tickets: T[]) => {
    const ticketIds = tickets.map((ticket) => ticket.id).filter((id): id is string => Boolean(id));

    if (ticketIds.length === 0) {
        return tickets.map((ticket) => ({ ...ticket, costos: [] }));
    }

    const response = await fetch(`/api/v3/ticket-costs?ticket_ids=${encodeURIComponent(ticketIds.join(','))}`, {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' }
    });
    const result = await response.json();
    if (!response.ok || !result.success) throw new Error(result.error || 'Error al obtener costos de tickets');

    const costsByTicket = new Map<string, any[]>();
    (result.data || []).forEach((cost: any) => {
        const current = costsByTicket.get(cost.ticket_id) || [];
        current.push(cost);
        costsByTicket.set(cost.ticket_id, current);
    });

    return tickets.map((ticket) => ({
        ...ticket,
        costos: ticket.id ? (costsByTicket.get(ticket.id) || []) : [],
    }));
};

// ============================================
// CLIENTS API
// ============================================

export const clientsAPI = {
    async getAll() {
        const { data, error } = await supabase
            .from('clients')
            .select(`
                *,
                branch_offices(count)
            `)
            .order('name');

        if (error) throw error;

        // Transformar el conteo de sedes
        return data?.map(client => ({
            ...client,
            totalBranches: client.branch_offices?.[0]?.count || 0,
            branch_offices: undefined // Eliminar el objeto de conteo
        })) || [];
    },

    async getById(id: string) {
        const { data, error } = await supabase
            .from('clients')
            .select('*')
            .eq('id', id)
            .single();

        if (error) throw error;
        return data;
    },

    async create(client: {
        name: string;
        ruc?: string;
        address?: string;
        email?: string;
        phone?: string;
        zone?: string;
        logo?: string;
        icon?: string;
        color_aura?: string;
    }) {
        const { data, error } = await supabase
            .from('clients')
            .insert(client)
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    async update(id: string, updates: Partial<{
        name: string;
        ruc: string;
        address: string;
        email: string;
        phone: string;
        zone: string;
        logo: string;
        icon: string;
        color_aura: string;
    }>) {
        const { data, error } = await supabase
            .from('clients')
            .update(updates)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    async delete(id: string) {
        const { error } = await supabase
            .from('clients')
            .delete()
            .eq('id', id);

        if (error) throw error;
    }
};

// ============================================
// BRANCH OFFICES API
// ============================================

export const branchesAPI = {
    async getAll() {
        const { data, error } = await supabase
            .from('branch_offices')
            .select('*, clients(*), zonas(*)')
            .order('name');

        if (error) throw error;
        return data;
    },

    async getByClient(clientId: string) {
        const { data, error } = await supabase
            .from('branch_offices')
            .select('*')
            .eq('client_id', clientId)
            .order('name');

        if (error) throw error;
        return data;
    },

    async getByZone(zone: string) {
        const { data, error } = await supabase
            .from('branch_offices')
            .select('*, clients(*)')
            .eq('zone', zone)
            .order('name');

        if (error) throw error;
        return data;
    },

    async getById(id: string) {
        const { data, error } = await supabase
            .from('branch_offices')
            .select('*, clients(*)')
            .eq('id', id)
            .single();

        if (error) throw error;
        return data;
    },

    /**
     * Valida que los IDs de agencias existan en la base de datos.
     * Retorna solo los IDs válidos, filtrando IDs corruptos o no existentes.
     * Esto previene errores de Foreign Key en operaciones de sync.
     */
    async validateBranchIds(candidateIds: string[]): Promise<{ validIds: string[]; invalidIds: string[] }> {
        if (!candidateIds || candidateIds.length === 0) {
            return { validIds: [], invalidIds: [] };
        }

        // Obtener todos los IDs válidos de una sola query
        const { data, error } = await supabase
            .from('branch_offices')
            .select('id')
            .in('id', candidateIds);

        if (error) {
            console.error('[validateBranchIds] Error querying branch_offices:', error);
            // En caso de error, asumir que todos los IDs son válidos y dejar que el servidor valide
            return { validIds: candidateIds, invalidIds: [] };
        }

        const validIdSet = new Set((data || []).map((b: any) => b.id));
        const validIds = candidateIds.filter(id => validIdSet.has(id));
        const invalidIds = candidateIds.filter(id => !validIdSet.has(id));

        if (invalidIds.length > 0) {
            console.warn('[validateBranchIds] Invalid branch IDs filtered out:', invalidIds);
        }

        return { validIds, invalidIds };
    },

    async create(branch: {
        client_id: string;
        name: string;
        address?: string;
        zone?: string;
        departamento?: string;
        provincia?: string;
        distrito?: string;
        codigo_topaz?: string;
        tipo?: string;
    }) {
        const { data, error } = await supabase
            .from('branch_offices')
            .insert(branch)
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    async update(id: string, updates: Partial<{
        name: string;
        address: string;
        zone: string;
        departamento: string;
        provincia: string;
        distrito: string;
        codigo_topaz: string;
        tipo: string;
        codigo_cliente: string;
    }>) {
        const { data, error } = await supabase
            .from('branch_offices')
            .update(updates)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    async delete(id: string) {
        const { error } = await supabase
            .from('branch_offices')
            .delete()
            .eq('id', id);

        if (error) throw error;
    }
};

// ============================================
// TECHNICIANS API
// ============================================

export const techniciansAPI = {
    async getAll() {
        const { data, error } = await supabase
            .from('technicians')
            .select('*, technician_branches(branch_id)')
            .order('name');

        if (error) throw error;
        return data;
    },

    async getById(id: string) {
        const { data, error } = await supabase
            .from('technicians')
            .select('*, technician_branches(branch_id)')
            .eq('id', id)
            .single();

        if (error) throw error;
        return data;
    },

    async getByStatus(status: string) {
        const { data, error } = await supabase
            .from('technicians')
            .select('*, technician_branches(branch_id)')
            .eq('status', status)
            .order('name');

        if (error) throw error;
        return data;
    },

    // Retorna los técnicos disponibles para atender una agencia específica
    // usando la función PL/pgSQL que implementa la lógica de microzonificación
    // Si la RPC no existe, usa fallback local
    async getAvailableForBranch(branchId: string) {
        try {
            const { data, error } = await supabase
                .rpc('get_technicians_for_branch', { p_branch_id: branchId });
            if (!error && data) return data || [];
        } catch (e) {
            console.warn('[getAvailableForBranch] RPC not available, using fallback');
        }
        
        // Fallback: obtener técnicos cuyas zonas incluyan la zona de la agencia
        const { data: branch } = await supabase
            .from('branch_offices')
            .select('zone, zona_id, zonas(codigo)')
            .eq('id', branchId)
            .single();
        
        if (!branch) return [];
        
        // Determinar la zona de la agencia
        const branchZone = branch.zone || getZonaCodigo(branch.zonas) || null;
        if (!branchZone) return [];
        
        // Buscar técnicos de esa zona
        const { data: technicians } = await supabase
            .from('technicians')
            .select('*, technician_branches(branch_id)')
            .or(`assigned_zones.cs.{"${branchZone}"},zone.eq.${branchZone}`)
            .eq('status', 'active');
        
        return technicians || [];
    },

    /**
     * Obtiene los técnicos que atienden a un cliente específico.
     * Un técnico atiende a un cliente si:
     * 1. Tiene al menos una agencia del cliente asignada directamente, O
     * 2. Tiene al menos una zona en común con las zonas del cliente
     */
    async getByClient(clientId: string) {
        // 1. Obtener todas las agencias del cliente con sus zonas
        const { data: branches } = await supabase
            .from('branch_offices')
            .select('id, zone, zona_id, zonas(codigo, nombre)')
            .eq('client_id', clientId);
        
        if (!branches || branches.length === 0) return [];
        
        // Extraer zonas únicas del cliente
        const clientZones = new Set<string>();
        branches.forEach(b => {
            if (b.zone) clientZones.add(b.zone);
            const zonaCodigo = getZonaCodigo(b.zonas);
            if (zonaCodigo) clientZones.add(zonaCodigo);
        });
        
        // 2. Obtener técnicos que tienen agencias directas del cliente
        const branchIds = branches.map(b => b.id);
        const { data: techWithBranches } = await supabase
            .from('technician_branches')
            .select('technician_id, branch_id, technicians(*)')
            .in('branch_id', branchIds);
        
        // 3. Obtener técnicos que tienen zonas en común
        const zonesArray = Array.from(clientZones);
        const { data: techWithZones } = await supabase
            .from('technicians')
            .select('*, technician_branches(branch_id)')
            .or(`assigned_zones.cs.{${zonesArray.join(',')}},zone.eq.${zonesArray[0]}`)
            .eq('status', 'active');
        
        // Combinar y deduplicar
        const techMap = new Map();
        
        if (techWithBranches) {
            techWithBranches.forEach((tb: any) => {
                if (tb.technicians && !techMap.has(tb.technicians.id)) {
                    techMap.set(tb.technicians.id, {
                        ...tb.technicians,
                        _coverageType: 'direct_branch',
                        _servedBranches: []
                    });
                }
            });
        }
        
        if (techWithZones) {
            techWithZones.forEach((tech: any) => {
                if (!techMap.has(tech.id)) {
                    techMap.set(tech.id, {
                        ...tech,
                        _coverageType: 'zone_based',
                        _servedBranches: []
                    });
                }
            });
        }
        
        return Array.from(techMap.values());
    },

    /**
     * Obtiene técnicos filtrados por zonas específicas.
     * Un técnico es retornado si alguna de sus zonas coincide con las solicitadas.
     */
    async getByZones(zoneIds: string[]) {
        if (!zoneIds || zoneIds.length === 0) return [];
        
        const { data, error } = await supabase
            .from('technicians')
            .select('*, technician_branches(branch_id)')
            .eq('status', 'active');
        
        if (error) throw error;
        
        // Filtrar por coincidencia de zonas
        const normalizedZones = zoneIds.map(z => z.toUpperCase());
        return (data || []).filter((tech: any) => {
            const techZones: string[] = tech.assigned_zones || (tech.zone ? [tech.zone] : []);
            const normalizedTechZones = techZones.map(z => z.toUpperCase());
            return normalizedZones.some(z => normalizedTechZones.includes(z));
        });
    },

    /**
     * Obtiene técnicos que pueden atender una lista de agencias específicas.
     * Útil para verificar cobertura antes de asignar.
     */
    async getByBranches(branchIds: string[]) {
        if (!branchIds || branchIds.length === 0) return [];
        
        // 1. Obtener info de las agencias (zonas y clientes)
        const { data: branches } = await supabase
            .from('branch_offices')
            .select('id, zone, client_id')
            .in('id', branchIds);
        
        if (!branches || branches.length === 0) return [];
        
        // 2. Obtener técnicos con ramas asignadas que coincidan
        const { data: techBranches } = await supabase
            .from('technician_branches')
            .select('technician_id, branch:branch_offices(id, name, zone, client_id)')
            .in('branch_id', branchIds);
        
        // 3. Extraer técnicos únicos
        const techIds = [...new Set((techBranches || []).map((tb: any) => tb.technician_id))];
        
        if (techIds.length === 0) return [];
        
        const { data: technicians } = await supabase
            .from('technicians')
            .select('*, technician_branches(branch_id)')
            .in('id', techIds);
        
        return technicians || [];
    },

    // Obtiene las agencias asignadas a un técnico con info completa
    async getAssignedBranches(technicianId: string) {
        try {
            const response = await fetch(`/api/v3/technicians-server?action=get_assigned_branches&technician_id=${technicianId}`);
            if (!response.ok) {
                const err = await response.json().catch(() => ({}));
                throw new Error(err.error || 'Server error on get_assigned_branches');
            }
            const data = await response.json();
            return data.branches || [];
        } catch (error) {
            console.error('Error fetching assigned branches via server API:', error);
            // Fallback en caso de que el endpoint falle (intentará por Supabase directo aunque RLS pueda bloquearlo)
            const { data, error: fallbackError } = await supabase
                .from('technician_branches')
                .select('branch_id, branch_offices(id, name, zone, address, departamento, client_id, client:clients(id, name))')
                .eq('technician_id', technicianId);
            if (fallbackError) throw fallbackError;
            return (data || []).map((r: any) => r.branch_offices).filter(Boolean);
        }
    },

    /**
     * Verifica la consistencia de zonas entre un técnico y sus agencias asignadas.
     * Retorna problemas encontrados y sugerencias de corrección.
     */
    async verifyZoneConsistency(technicianId: string) {
        const issues: string[] = [];
        const suggestions: string[] = [];
        
        // 1. Obtener datos del técnico
        const { data: tech, error: techError } = await supabase
            .from('technicians')
            .select('id, name, zone, assigned_zones')
            .eq('id', technicianId)
            .single();
        
        if (techError || !tech) {
            issues.push('Técnico no encontrado');
            return { isConsistent: false, issues, suggestions };
        }
        
        // 2. Obtener agencias asignadas
        const { data: branches } = await supabase
            .from('technician_branches')
            .select('branch_id, branch_offices(zone)')
            .eq('technician_id', technicianId);
        
        const branchZones = (branches || [])
            .map((b: any) => b.branch_offices?.zone)
            .filter(Boolean);
        
        // 3. Obtener zonas únicas de las agencias
        const uniqueBranchZones = [...new Set(branchZones)];
        
        // 4. Comparar con zonas del técnico
        const techZones: string[] = tech.assigned_zones || (tech.zone ? [tech.zone] : []);
        const normalizedTechZones = techZones.map(z => z.toUpperCase());
        const normalizedBranchZones = uniqueBranchZones.map(z => z.toUpperCase());
        
        // Verificar si las zonas del técnico cubren las zonas de sus agencias
        const uncoveredZones = normalizedBranchZones.filter(
            bz => !normalizedTechZones.some(tz => tz === bz)
        );
        
        if (uncoveredZones.length > 0) {
            issues.push(`El técnico tiene agencias en zonas no asignadas: ${uncoveredZones.join(', ')}`);
            suggestions.push(`Agregar las zonas [${uncoveredZones.join(', ')}] a assigned_zones del técnico`);
        }
        
        // Verificar zonas huérfanas (zonas asignadas al técnico pero sin agencias en esas zonas)
        const orphanedZones = normalizedTechZones.filter(
            tz => !normalizedBranchZones.some(bz => bz === tz) && normalizedBranchZones.length > 0
        );
        
        if (orphanedZones.length > 0) {
            suggestions.push(`Zonas asignadas sin agencias: ${orphanedZones.join(', ')}. Considerar removerlas o agregar agencias en esas zonas.`);
        }
        
        return {
            isConsistent: issues.length === 0,
            technician: { id: tech.id, name: tech.name, zones: techZones },
            branchZones: uniqueBranchZones,
            issues,
            suggestions
        };
    },

    /**
     * Obtiene un resumen de cobertura de técnicos por cliente y zona.
     * Útil para dashboards de asignación.
     */
    async getCoverageSummary() {
        // Obtener todos los técnicos con sus agencias
        const { data: technicians } = await supabase
            .from('technicians')
            .select('id, name, zone, assigned_zones, status, technician_branches(branch_id)')
            .eq('status', 'active');
        
        // Obtener todas las agencias con info de cliente y zona
        const { data: branches } = await supabase
            .from('branch_offices')
            .select('id, name, zone, client_id, client:clients(id, name)');
        
        if (!technicians || !branches) {
            return { byClient: [], byZone: [], stats: {} };
        }
        
        // Crear mapa de agencias por cliente
        const branchesByClient = new Map<string, any[]>();
        const branchesByZone = new Map<string, any[]>();
        
        branches.forEach(b => {
            // Por cliente
            const clientId = b.client_id;
            if (!branchesByClient.has(clientId)) {
                branchesByClient.set(clientId, []);
            }
            branchesByClient.get(clientId)!.push(b);
            
            // Por zona
            const zone = b.zone || 'SIN_ZONA';
            if (!branchesByZone.has(zone)) {
                branchesByZone.set(zone, []);
            }
            branchesByZone.get(zone)!.push(b);
        });
        
        // Calcular cobertura por cliente
        const byClient = Array.from(branchesByClient.entries()).map(([clientId, clientBranches]) => {
            const clientName = clientBranches[0]?.client?.name || 'Cliente desconocido';
            const branchIds = clientBranches.map(b => b.id);
            
            const servingTechs = (technicians || []).filter(t => {
                const techBranchIds = (t.technician_branches || []).map((tb: any) => tb.branch_id);
                return techBranchIds.some(id => branchIds.includes(id));
            });
            
            return {
                clientId,
                clientName,
                totalBranches: clientBranches.length,
                assignedTechs: servingTechs.length,
                techNames: servingTechs.map(t => t.name)
            };
        });
        
        // Calcular cobertura por zona
        const byZone = Array.from(branchesByZone.entries()).map(([zone, zoneBranches]) => {
            const branchIds = zoneBranches.map(b => b.id);
            
            const servingTechs = (technicians || []).filter(t => {
                const techZones = t.assigned_zones || (t.zone ? [t.zone] : []);
                const normalizedTechZones = techZones.map((z: string) => z.toUpperCase());
                return normalizedTechZones.includes(zone.toUpperCase());
            });
            
            return {
                zone,
                totalBranches: zoneBranches.length,
                assignedTechs: servingTechs.length,
                techNames: servingTechs.map(t => t.name)
            };
        });
        
        return {
            byClient,
            byZone,
            stats: {
                totalTechnicians: (technicians || []).length,
                totalBranches: branches.length,
                totalClients: branchesByClient.size
            }
        };
    },

    // Sincroniza las agencias asignadas a un técnico (vía server para bypass RLS)
    // Incluye validación de integridad referencial para evitar FK errors
    async syncBranchAssignments(technicianId: string, branchIds: string[]) {
        console.log('[syncBranchAssignments] START - technicianId:', technicianId, 'branchIds:', branchIds);
        
        // STEP 3: Validar integridad referencial - filtrar IDs que no existen
        const { validIds, invalidIds } = await branchesAPI.validateBranchIds(branchIds);
        
        console.log('[syncBranchAssignments] After validation - validIds:', validIds, 'invalidIds:', invalidIds);
        
        if (invalidIds.length > 0) {
            console.warn('[syncBranchAssignments] Filtering invalid branch IDs:', invalidIds);
            // Los IDs inválidos se filtran - solo se procesan IDs válidos
        }
        
        if (validIds.length === 0 && branchIds.length > 0) {
            // Todos los IDs eran inválidos - lanzar error específico
            throw new Error(`Ninguna de las agencias seleccionadas existe en el catálogo. IDs inválidos: ${invalidIds.slice(0, 3).join(', ')}${invalidIds.length > 3 ? '...' : ''}`);
        }
        
        const requestBody = { technician_id: technicianId, branch_ids: validIds };
        console.log('[syncBranchAssignments] Making request to server:', requestBody);
        
        const response = await fetch('/api/v3/technicians-server?action=sync_branches', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody)
        });
        
        console.log('[syncBranchAssignments] Response status:', response.status);
        
        // Parse response body for error details
        let errData: { error?: string; success?: boolean } = {};
        try {
            errData = await response.json();
            console.log('[syncBranchAssignments] Response body:', errData);
        } catch (e) {
            console.error('[syncBranchAssignments] Failed to parse JSON response:', e);
        }
        
        // Explicitly check response status - throw detailed error to propagate to UI
        if (!response.ok) {
            console.error('[syncBranchAssignments] HTTP error:', response.status, errData);
            throw new Error(errData.error || `Error HTTP ${response.status} al sincronizar agencias del técnico`);
        }
        
        // Check for server-side business logic errors
        if (errData.success === false || errData.error) {
            console.error('[syncBranchAssignments] Server error:', errData.error);
            throw new Error(errData.error || 'Fallo en la sincronización de agencias');
        }
        
        console.log('[syncBranchAssignments] SUCCESS - Branch assignments synced');
    },

    async create(technician: {
        name?: string;
        first_name?: string;
        last_name?: string;
        document_type?: string;
        document_number?: string;
        phone?: string;
        email?: string;
        zone?: string;
        assigned_zones?: string[];
        specialties?: string[];
        photo?: string;
        rating?: number;
        bank_name?: string;
        account_number?: string;
        account_type?: string;
        cci?: string;
        yape_number?: string;
        plin_number?: string;
        address?: string;
        phone_secondary?: string;
        status?: string;
    }) {
        // Asegurar que name esté presente si no se proporciona
        if (!technician.name && (technician.first_name || technician.last_name)) {
            technician.name = `${technician.first_name || ''} ${technician.last_name || ''}`.trim();
        }

        const { data, error } = await supabase
            .from('technicians')
            .insert(technician)
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    async update(id: string, updates: Partial<{
        name: string;
        first_name: string;
        last_name: string;
        document_type: string;
        document_number: string;
        phone: string;
        email: string;
        zone: string;
        assigned_zones: string[];
        specialties: string[];
        photo: string;
        rating: number;
        bank_name: string;
        account_number: string;
        account_type: string;
        cci: string;
        yape_number: string;
        plin_number: string;
        address: string;
        phone_secondary: string;
        status: string;
    }>) {
        // Actualizar name si cambian first_name o last_name y no se proporciona name
        if (!updates.name && (updates.first_name || updates.last_name)) {
            // Confiamos en que TechnicianDrawer envíe el name actualizado.
        }

        const response = await fetch('/api/v3/technicians-server?action=patch', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                id,
                columnUpdates: updates
            })
        });

        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            throw new Error(errData.error || 'Error al actualizar técnico (Server Patch)');
        }

        const resData = await response.json();
        return resData.data;
    },

    async delete(id: string) {
        const { error } = await supabase
            .from('technicians')
            .delete()
            .eq('id', id);

        if (error) throw error;
    }
};

// ============================================
// GESTORAS API
// ============================================

export const gestorasAPI = {
    async getAll() {
        const { data, error } = await supabase
            .from('gestoras')
            .select('*')
            .order('name');

        if (error) throw error;
        return data;
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

    async create(gestora: {
        name: string;
        email?: string;
        phone?: string;
        auth_user_id?: string;
        status?: string;
    }) {
        const { data, error } = await supabase
            .from('gestoras')
            .insert(gestora)
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    async update(id: string, updates: Partial<{
        name: string;
        email: string;
        phone: string;
        status: string;
    }>) {
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
// TICKETS API
// ============================================

export const ticketsAPI = {
    async getAll() {
        const { data, error } = await supabase
            .from('tickets')
            .select('*, clients(*), branch_offices(*, clients(*), zonas(*)), technicians(*), gestora:gestoras(*)')
            .order('created_at', { ascending: false })
            .limit(2000); // Límite ampliado para incluir tickets recientes de todos los gestores

        if (error) throw error;
        return data;
    },

    async getSummaryAll() {
        // Usar la vista estratégica que ya tiene los cálculos financieros (ROI, Margen, etc.)
        const { data, error } = await supabase
            .from('vw_tickets_strategic')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(2000);

        if (error) {
            // No hacer mucho ruido en consola si es por Auth, ya que el fallback del servidor lo resolverá
            if (error.message?.includes('Auth session')) {
                console.warn('[ticketsAPI] Sesión Auth no lista, usando fallback del servidor para tickets...');
            } else {
                console.error('[ticketsAPI] Error fetching strategic summary:', error.message);
            }
            
            const { data: fallbackData, error: fallbackError } = await supabase
                .from('tickets')
                .select(TICKET_LIST_SELECT)
                .order('created_at', { ascending: false })
                .limit(2000);

            if (fallbackError) {
                // Si esto también falla (ej. por RLS), simplemente devolveremos vacío en el catch exterior
                throw fallbackError;
            }

            const fallbackWithCosts = await attachTicketCosts(fallbackData || []);
            return fallbackWithCosts.map((t: any) => ({
                ...t,
                costos: Array.isArray(t.costos) ? t.costos : [],
            }));
        }

        const ticketsWithCosts = await attachTicketCosts(data || []);
        return ticketsWithCosts.map((t: any) => ({
            ...t,
            costos: Array.isArray(t.costos) ? t.costos : [],
        }));
    },

    async getStrategicMetrics(startDate: string, endDate: string) {
        const { data, error } = await supabase
            .rpc('get_strategic_metrics', {
                p_start_date: startDate,
                p_end_date: endDate
            });

        if (error) {
            console.error('[ticketsAPI] Error calling get_strategic_metrics:', error.message);
            throw error;
        }
        return data;
    },

    async getForPayments() {
        // ════════════════════════════════════════════════════════════════════
        // MOTOR PRINCIPAL V3: Consulta directa JS con Joins (SINFIMAC V3)
        // Esta consulta es la fuente de verdad para la Bandeja de Tesorería/Pagos.
        // ════════════════════════════════════════════════════════════════════
        const ESTADOS_EXCLUIDOS = [
            'borrador',
            // NO excluir estados terminales aquí, ya que se necesitan para el historial (PAGADOS)
            // y para el cálculo de estadísticas globales.
        ];

        const { data: ticketsData, error: tErr } = await supabase
            .from('tickets')
            .select(PAYMENT_TICKET_SELECT)
            .not('status_id', 'in', `(${ESTADOS_EXCLUIDOS.join(',')})`)
            .order('created_at', { ascending: false })
            .limit(500);

        if (tErr) throw tErr;

        const ticketsWithCosts = await attachTicketCosts(ticketsData || []);

        // Normalizar: costos siempre es array; ticket_cerrado sin pagos pendientes
        // se filtra en el lado JS (processTicketsToGroups) según negocio.
        return ticketsWithCosts.map((t: any) => ({
            ...t,
            costos: Array.isArray(t.costos) ? t.costos : [],
        }));
    },

    async getById(id: string) {
        // ════════════════════════════════════════════════════════════════════
        // MOTOR V3: Consulta Directa con Joins (Evita dependencia de RPCs legacy)
        // ════════════════════════════════════════════════════════════════════
        const { data, error } = await supabase
            .from('tickets')
            .select(TICKET_LIST_SELECT)
            .eq('id', id)
            .single();

        if (error) throw error;

        const [ticketWithCosts] = await attachTicketCosts([data]);
        
        // Normalizar costos para el motor de cálculos
        const ticket = {
            ...ticketWithCosts,
            costos: Array.isArray(ticketWithCosts.costos) ? ticketWithCosts.costos : []
        };
        
        return ticket;
    },

    async getByStatus(statusId: string) {
        const { data, error } = await supabase
            .from('tickets')
            .select('id, status_id, service_type, description, diagnosis, client_ticket_number, created_at, labor_cost, materials_cost, visit_cost, total_quoted_amount, priority, current_step, created_by, client_id, branch_id, technician_id, gestora_id, clients(*), branch_offices(*, clients(*), zonas(*)), technicians(*), gestora:gestoras(*)')
            .eq('status_id', statusId)
            .order('created_at', { ascending: false })
            .limit(100);

        if (error) throw error;
        return data;
    },

    async getByTechnician(technicianId: string) {
        const { data, error } = await supabase
            .from('tickets')
            .select('id, status_id, service_type, description, diagnosis, client_ticket_number, created_at, labor_cost, materials_cost, visit_cost, total_quoted_amount, priority, current_step, created_by, client_id, branch_id, technician_id, gestora_id, clients(*), branch_offices(*, clients(*), zonas(*)), technicians(*), gestora:gestoras(*)')
            .eq('technician_id', technicianId)
            .order('created_at', { ascending: false })
            .limit(100);

        if (error) throw error;
        return data;
    },

    async create(ticket: {
        client_id?: string | null;
        branch_id?: string | null;
        technician_id?: string | null;
        status_id?: string;
        service_type?: string;
        description?: string;
        diagnosis?: string;
        client_ticket_number?: string;
        labor_cost?: number;
        materials_cost?: number;
        visit_cost?: number;
        total_quoted_amount?: number;
        priority?: string;
        created_by?: string;
        current_step?: number;
        metadata?: any;
        created_at?: string;
    }) {
        const payload = {
            ...ticket,
            metadata: sanitizeTicketMetadata(ticket.metadata),
            created_at: ticket.created_at || new Date().toISOString()
        };
        const { data, error } = await supabase
            .from('tickets')
            .insert(payload)
            .select('*, clients(*), branch_offices(*), technicians(*)')
            .single();

        if (error) throw error;
        return data;
    },

    /**
     * Obtiene el último número de ticket correlativo para un prefijo dado (ej. 'STD')
     * Se usa para la generación automática de números de Santander.
     */
    async getLastClientTicketNumber(prefix: string) {
        const { data, error } = await supabase
            .from('tickets')
            .select('client_ticket_number')
            .ilike('client_ticket_number', `${prefix}%`)
            .order('client_ticket_number', { ascending: false })
            .limit(1);
        
        if (error) throw error;
        return data?.[0]?.client_ticket_number || null;
    },

    async checkClientTicketExists(ticketNumber: string) {
        const { count, error } = await supabase
            .from('tickets')
            .select('*', { count: 'exact', head: true })
            .eq('client_ticket_number', ticketNumber);
        
        if (error) throw error;
        return (count || 0) > 0;
    },

    async update(id: string, updates: Partial<{
        client_id: string;
        branch_id: string;
        technician_id: string;
        status_id: string;
        service_type: string;
        description: string;
        diagnosis: string;
        client_ticket_number: string;
        labor_cost: number;
        materials_cost: number;
        visit_cost: number;
        total_quoted_amount: number;
        priority: string;
        created_by: string;
        current_step: number;
        quotation_date: string;
        execution_date: string;
        closure_date: string;
        is_sla_paused: boolean;
        sla_pause_date: string;
        sla_reactivation_date: string;
        metadata: any;
        gestora_id: string;
    }>) {
        const { metadata, ...columnUpdates } = updates;
        
        const metadataUpdates = metadata ? sanitizeTicketMetadata(metadata) : {};

        // Removes undefined
        Object.keys(columnUpdates).forEach(key => (columnUpdates as any)[key] === undefined && delete (columnUpdates as any)[key]);

        const response = await fetch('/api/v3/tickets-server?action=patch', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                id,
                metadataUpdates,
                columnUpdates
            })
        });

        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            throw new Error(errData.error || 'Error al actualizar ticket (Server Patch)');
        }

        const resData = await response.json();
        return resData.data;
    },

    async patchMetadata(id: string, metadataUpdates: Record<string, any>, columnUpdates: Record<string, any> = {}) {
        const response = await fetch('/api/v3/tickets-server?action=patch', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, metadataUpdates, columnUpdates }),
        });
        const result = await response.json();

        if (response.ok && result.success) return result.data;
        throw new Error(result.error || 'Error al actualizar metadata (Server Patch)');
    },

    // Eliminación completa de ticket con todas sus ramificaciones reales
    async delete(id: string) {
        // 1. Eliminar ticket_evidences (evidencias/fotos del ticket)
        const { error: eEvidences } = await supabase
            .from('ticket_evidences')
            .delete()
            .eq('ticket_id', id);
        if (eEvidences) throw eEvidences;

        // 2. Eliminar ticket_costs (costos del ticket)
        const { error: eCosts } = await supabase
            .from('ticket_costs')
            .delete()
            .eq('ticket_id', id);
        if (eCosts) throw eCosts;

        // 3. Eliminar ticket_payments (pagos del ticket)
        const { error: ePayments } = await supabase
            .from('ticket_payments')
            .delete()
            .eq('ticket_id', id);
        if (ePayments) throw ePayments;

        // 4. Finalmente eliminar el ticket principal
        const { error: errorTicket } = await supabase
            .from('tickets')
            .delete()
            .eq('id', id);
        if (errorTicket) throw errorTicket;
    },

    async updatePaymentSafe(ticketId: string, nuevoPago: any, additionalUpdates?: any) {
        const { data: ticket, error: fetchErr } = await supabase
            .from('tickets')
            .select('metadata')
            .eq('id', ticketId)
            .single();
        if (fetchErr || !ticket) throw new Error("Ticket not found");
        
        const meta = ticket.metadata || {};
        const history = meta.historialPagosTecnico || [];
        
        const filtered = history.filter((p: any) => p.id !== nuevoPago.id);
        filtered.push(nuevoPago);
        
        const newMeta = {
            ...meta,
            ...additionalUpdates?.metadataFields,
            historialPagosTecnico: filtered,
            montoAdelanto: filtered.reduce((s: number, p: any) => s + (p.monto || 0), 0)
        };
        
        const updates: any = { metadata: newMeta };
        if (additionalUpdates?.status_id) {
            updates.status_id = additionalUpdates.status_id;
            newMeta.estadoId = additionalUpdates.status_id;
        }
        if (additionalUpdates?.closure_date) updates.closure_date = additionalUpdates.closure_date;
        
        const { metadata, ...colUpdates } = updates;
        await this.patchMetadata(ticketId, newMeta, colUpdates);
        
        return updates;
    }
};

// ============================================
// TICKET PAYMENTS API
// ============================================

export const paymentsAPI = {
    async getByTicket(ticketId: string) {
        const { data, error } = await supabase
            .from('ticket_payments')
            .select('*')
            .eq('ticket_id', ticketId)
            .order('payment_date', { ascending: false });

        if (error) throw error;
        return data;
    },

    async create(payment: {
        ticket_id: string;
        amount: number;
        payment_type: string;
        reference_number?: string;
        payment_date?: string;
        status?: string;
    }) {
        const { data, error } = await supabase
            .from('ticket_payments')
            .insert(payment)
            .select()
            .single();

        if (error) throw error;

        const created = data;

        try {
            const paymentDate = payment.payment_date || new Date().toISOString();

            // 1) Si viene referencia a un costo específico, marcarlo como pagado o consumir parcialmente
            if (payment.reference_number) {
                const { data: costRecord, error: costErr } = await supabase
                    .from('ticket_costs')
                    .select('*')
                    .eq('id', payment.reference_number)
                    .maybeSingle();

                if (!costErr && costRecord) {
                    const paidAmount = toNumberSafe(payment.amount || (payment as any).monto || 0);
                    const originalAmount = toNumberSafe(costRecord.monto || 0);

                    if (paidAmount >= originalAmount) {
                        // Pago completo: marcar pagado
                        await supabase
                            .from('ticket_costs')
                            .update({ estado_pago: 'pagado', fecha_pago: paymentDate })
                            .eq('id', costRecord.id);
                    } else if (paidAmount > 0) {
                        // Pago parcial: marcar registro original como 'abonado' y crear costo por saldo pendiente
                        try {
                            await supabase
                                .from('ticket_costs')
                                .update({ estado_pago: 'abonado', fecha_pago: paymentDate })
                                .eq('id', costRecord.id);

                            const remaining = round2(originalAmount - paidAmount);
                            await supabase
                                .from('ticket_costs')
                                .insert({
                                    ticket_id: costRecord.ticket_id,
                                    concepto: `Saldo pendiente: ${costRecord.concepto || costRecord.tipo || 'Costo'}`,
                                    categoria: costRecord.categoria || 'Mano de Obra',
                                    monto: remaining,
                                    estado_pago: 'pendiente',
                                    specialist_id: costRecord.specialist_id || null,
                                    proveedor: costRecord.proveedor || null
                                });
                        } catch (partErr) {
                            console.error('[paymentsAPI.create] Error handling partial payment:', partErr);
                        }
                    }
                }
            } else {
                // 2) Si NO viene referencia y el pago es un ADELANTO, crear un costo 'Adelanto Operativo'
                // En lugar de marcar todos los adelantos existentes como pagados, creamos un registro de costo
                // que representa el adelanto recibido. Esto evita marcar parcialmente costos y conserva trazabilidad.
                const pt = (payment.payment_type || '').toLowerCase();
                if (pt.includes('adelanto')) {
                    try {
                        const { data: createdCost, error: createCostErr } = await supabase
                            .from('ticket_costs')
                            .insert({
                                ticket_id: payment.ticket_id,
                                concepto: 'Adelanto recibido',
                                categoria: 'Adelanto Operativo',
                                monto: payment.amount || 0,
                                estado_pago: 'pagado',
                                fecha_pago: paymentDate
                            })
                            .select()
                            .single();

                        if (!createCostErr && createdCost && createdCost.id) {
                            // Vincular el pago creado con el costo de adelanto para trazabilidad
                            await supabase
                                .from('ticket_payments')
                                .update({ reference_number: createdCost.id })
                                .eq('id', created.id);
                        }
                    } catch (innerErr) {
                        console.error('[paymentsAPI.create] Error creando costo-adelanto:', innerErr);
                    }
                }
            }
        } catch (err) {
            // No fallar la creación del pago si la sincronización de costos falla; loguear para auditoría
            console.error('[paymentsAPI.create] Post-create sync error:', err);
        }

        return created;
    },

    async update(id: string, updates: Partial<{
        amount: number;
        payment_type: string;
        reference_number: string;
        payment_date: string;
        status: string;
    }>) {
        const { data, error } = await supabase
            .from('ticket_payments')
            .update(updates)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    async delete(id: string) {
        const { error } = await supabase
            .from('ticket_payments')
            .delete()
            .eq('id', id);

        if (error) throw error;
    }
};

// ============================================
// TICKET EVIDENCES API
// ============================================

export const evidencesAPI = {
    async getByTicket(ticketId: string) {
        const { data, error } = await supabase
            .from('ticket_evidences')
            .select('*')
            .eq('ticket_id', ticketId)
            .order('created_at', { ascending: false });

        if (error) throw error;
        return data;
    },

    async create(evidence: {
        ticket_id: string;
        url: string;
        evidence_type?: string;
    }) {
        const { data, error } = await supabase
            .from('ticket_evidences')
            .insert(evidence)
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    async delete(id: string) {
        const { error } = await supabase
            .from('ticket_evidences')
            .delete()
            .eq('id', id);

        if (error) throw error;
    }
};

// ─────────────────────────────────────────────
// GESTORAS TARGETS (Metas y Bonos)
// ─────────────────────────────────────────────
export const gestorasTargetsAPI = {
    async getAll() {
        const { data, error } = await supabase
            .from("gestoras_targets")
            .select("*")
            .order("month_key", { ascending: false });
        if (error) throw error;
        return data;
    },
    async getByMonth(monthKey: string) {
        const { data, error } = await supabase
            .from("gestoras_targets")
            .select("*")
            .eq("month_key", monthKey);
        if (error) throw error;
        return data;
    },
    async set(gestora_id: string, month_key: string, updates: any) {
        const { data, error } = await supabase
            .from("gestoras_targets")
            .upsert({ gestora_id, month_key, ...updates }, { onConflict: "gestora_id,month_key" })
            .select();
        if (error) throw error;
        return data?.[0];
    },
};

// ============================================
// TICKET COSTS API
// ============================================

export const ticketCostsAPI = {
    async getByTicket(ticketId: string) {
        const response = await fetch(`/api/v3/ticket-costs?ticket_id=${encodeURIComponent(ticketId)}`, {
            cache: 'no-store',
            headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' }
        });
        const result = await response.json();

        if (!response.ok || !result.success) throw new Error(result.error || 'Error al obtener costos del ticket');
        return result.data || [];
    },

    async create(cost: {
        ticket_id: string;
        concepto: string;
        categoria: string;
        proveedor?: string;
        specialist_id?: string;
        monto: number;
        estado_pago: string;
        url_comprobante?: string;
        solicitado_por?: string;
        motivo?: string;
        /** Token UUID único por transacción — usado para idempotencia exacta en tesorería */
        transaction_token?: string;
    }) {
        // Strip undefined / empty-string optional UUID fields to avoid FK violations
        const safePayload: Record<string, any> = {
            ticket_id: cost.ticket_id,
            concepto: cost.concepto,
            categoria: cost.categoria,
            monto: cost.monto,
            estado_pago: cost.estado_pago,
        };
        if (cost.proveedor)             safePayload.proveedor = cost.proveedor;
        if (cost.specialist_id)         safePayload.specialist_id = cost.specialist_id;
        if (cost.url_comprobante)       safePayload.url_comprobante = cost.url_comprobante;
        if (cost.solicitado_por)        safePayload.solicitado_por = cost.solicitado_por;
        if (cost.motivo)                safePayload.motivo = cost.motivo;
        if (cost.transaction_token)     safePayload.transaction_token = cost.transaction_token;

        const response = await fetch('/api/v3/ticket-costs', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(safePayload),
        });
        const result = await response.json();

        if (!response.ok || !result.success) {
            if (response.status === 409 || result.code === 'DuplicateTicketCostError') throw new DuplicateTicketCostError();
            console.error("DEBUG: Error in ticketCostsAPI.create:", result.error, "Payload:", safePayload);
            throw new Error(result.error || 'Error al registrar costo del ticket');
        }
        return result.data;
    },

    async update(id: string, updates: Partial<{
        concepto: string;
        categoria: string;
        proveedor: string;
        specialist_id: string | null;
        monto: number;
        estado_pago: string;
        url_comprobante: string;
        motivo: string;
        solicitado_por: string;
    }>) {
        const response = await fetch('/api/v3/ticket-costs', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, updates }),
        });
        const result = await response.json();

        if (!response.ok || !result.success) {
            if (response.status === 409 || result.code === 'DuplicateTicketCostError') throw new DuplicateTicketCostError();
            throw new Error(result.error || 'Error al actualizar costo del ticket');
        }
        return result.data;
    },

    async delete(id: string) {
        const response = await fetch(`/api/v3/ticket-costs?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
        const result = await response.json();

        if (!response.ok || !result.success) throw new Error(result.error || 'Error al eliminar costo del ticket');
    },

    // Trasladar todos los costos y pagos de un ticket a otro (Blindaje Financiero)
    async transferAllToTicket(sourceTicketId: string, targetTicketId: string) {
        // 1) Mover ticket_costs
        const { data: movedCosts, error: errCosts } = await supabase
            .from('ticket_costs')
            .update({ ticket_id: targetTicketId })
            .eq('ticket_id', sourceTicketId)
            .select();

        if (errCosts) throw errCosts;

        // 2) Mover ticket_payments (si existen) para mantener trazabilidad financiera
        const { data: movedPayments, error: errPayments } = await supabase
            .from('ticket_payments')
            .update({ ticket_id: targetTicketId })
            .eq('ticket_id', sourceTicketId)
            .select();

        if (errPayments) throw errPayments;

        return { movedCosts, movedPayments };
    }
};
