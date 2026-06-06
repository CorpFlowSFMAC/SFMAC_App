import { supabase } from './supabase'
import { stripFinancialMetadata } from './financialMetadata'
import { round2 } from './formatters'
import { sanitizeTicketMetadata } from './calculations'

const toNumberSafe = (value: any): number => {
    const num = typeof value === 'string' ? parseFloat(value) : Number(value);
    return isNaN(num) ? 0 : num;
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
            .select('*')
            .order('name');

        if (error) throw error;
        return data;
    },

    async getById(id: string) {
        const { data, error } = await supabase
            .from('technicians')
            .select('*')
            .eq('id', id)
            .single();

        if (error) throw error;
        return data;
    },

    async getByStatus(status: string) {
        const { data, error } = await supabase
            .from('technicians')
            .select('*')
            .eq('status', status)
            .order('name');

        if (error) throw error;
        return data;
    },

    // Retorna los técnicos disponibles para atender una agencia específica
    // usando la función PL/pgSQL que implementa la lógica de microzonificación
    async getAvailableForBranch(branchId: string) {
        const { data, error } = await supabase
            .rpc('get_technicians_for_branch', { p_branch_id: branchId });
        if (error) throw error;
        return data || [];
    },

    // Obtiene las agencias asignadas a un técnico
    async getAssignedBranches(technicianId: string) {
        const { data, error } = await supabase
            .from('technician_branches')
            .select('branch_id, branch_offices(id, name, zone, address, departamento)')
            .eq('technician_id', technicianId);
        if (error) throw error;
        return (data || []).map((r: any) => r.branch_offices);
    },

    // Sincroniza las agencias asignadas a un técnico (replace completo)
    async syncBranchAssignments(technicianId: string, branchIds: string[]) {
        // 1. Borrar asignaciones existentes
        const { error: delErr } = await supabase
            .from('technician_branches')
            .delete()
            .eq('technician_id', technicianId);
        if (delErr) throw delErr;

        // 2. Insertar nuevas asignaciones
        if (branchIds.length > 0) {
            const rows = branchIds.map(bid => ({ technician_id: technicianId, branch_id: bid }));
            const { error: insErr } = await supabase
                .from('technician_branches')
                .insert(rows);
            if (insErr) throw insErr;
        }
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
