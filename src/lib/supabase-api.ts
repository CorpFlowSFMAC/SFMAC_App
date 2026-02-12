import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://xqnghcdndqicqofnxvuf.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_DHL-l6BH0dVVfvNFYG9kdQ_18F8SeL3'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

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
            .select('*, clients(*)')
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

    async create(technician: {
        name?: string;
        first_name?: string;
        last_name?: string;
        document_type?: string;
        document_number?: string;
        phone?: string;
        email?: string;
        zone?: string;
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
            // Para ser precisos tendríamos que obtener el registro actual, 
            // pero como en el UI solemos enviar todo el form, 
            // confiamos en que TechnicianDrawer envíe el name actualizado.
        }

        const { data, error } = await supabase
            .from('technicians')
            .update(updates)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        return data;
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
// TICKETS API
// ============================================

export const ticketsAPI = {
    async getAll() {
        const { data, error } = await supabase
            .from('tickets')
            .select('*, clients(*), branch_offices(*), technicians(*)')
            .order('created_at', { ascending: false });

        if (error) throw error;
        return data;
    },

    async getById(id: string) {
        const { data, error } = await supabase
            .from('tickets')
            .select('*, clients(*), branch_offices(*), technicians(*)')
            .eq('id', id)
            .single();

        if (error) throw error;
        return data;
    },

    async getByStatus(statusId: string) {
        const { data, error } = await supabase
            .from('tickets')
            .select('*, clients(*), branch_offices(*), technicians(*)')
            .eq('status_id', statusId)
            .order('created_at', { ascending: false });

        if (error) throw error;
        return data;
    },

    async getByTechnician(technicianId: string) {
        const { data, error } = await supabase
            .from('tickets')
            .select('*, clients(*), branch_offices(*), technicians(*)')
            .eq('technician_id', technicianId)
            .order('created_at', { ascending: false });

        if (error) throw error;
        return data;
    },

    async create(ticket: {
        client_id?: string;
        branch_id?: string;
        technician_id?: string;
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
    }) {
        const { data, error } = await supabase
            .from('tickets')
            .insert(ticket)
            .select('*, clients(*), branch_offices(*), technicians(*)')
            .single();

        if (error) throw error;
        return data;
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
    }>) {
        const { data, error } = await supabase
            .from('tickets')
            .update(updates)
            .eq('id', id)
            .select('*, clients(*), branch_offices(*), technicians(*)')
            .single();

        if (error) throw error;
        return data;
    },

    async delete(id: string) {
        const { error } = await supabase
            .from('tickets')
            .delete()
            .eq('id', id);

        if (error) throw error;
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
        return data;
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
