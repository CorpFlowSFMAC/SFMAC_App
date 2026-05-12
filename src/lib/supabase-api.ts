import { supabase } from './supabase'

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
            .limit(200); // Límite de seguridad para evitar egress masivo

        if (error) throw error;
        return data;
    },

    async getSummaryAll() {
        // Consulta simple - evita errores de relaciones FK
        const { data, error } = await supabase
            .from('tickets')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(200);

        if (error) {
            
            throw error;
        }
        return data || [];
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
            .select(`
                id, ticket_number, status_id, service_type, description,
                client_ticket_number, created_at, labor_cost, materials_cost, visit_cost,
                total_quoted_amount, client_id, branch_id, technician_id, gestora_id,
                diagnosis, priority, sede_reportada_cliente, metadata,
                clients(id, name, ruc),
                branch_offices(id, name),
                technicians(id, name, bank_name, account_number, cci, yape_number, plin_number, phone),
                gestoras(id, name),
                costos:ticket_costs(*, technicians(id, name, bank_name, account_number, cci, yape_number, plin_number, phone))
            `)
            .not('status_id', 'in', `(${ESTADOS_EXCLUIDOS.join(',')})`)
            .order('created_at', { ascending: false })
            .limit(200);

        if (tErr) throw tErr;

        // Normalizar: costos siempre es array; ticket_cerrado sin pagos pendientes
        // se filtra en el lado JS (processTicketsToGroups) según negocio.
        return (ticketsData || []).map((t: any) => ({
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
            .select(`
                *,
                clients(*),
                branch_offices(*, zonas(*)),
                technicians(*),
                gestora:gestoras(*),
                costos:ticket_costs(*),
                solicitudesDeposito:solicitudes_deposito(*)
            `)
            .eq('id', id)
            .single();

        if (error) throw error;
        
        // Normalizar costos para el motor de cálculos
        const ticket = {
            ...data,
            costos: Array.isArray(data.costos) ? data.costos : []
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

    // ★★★ PAYMENT-SAFE UPDATE ★★★
    // Uso exclusivo del módulo de pagos cuando se confirma un depósito.
    // A diferencia de update() — que sobreescribe toda la metadata —
    // esta función SIEMPRE:
    //   1. Lee la metadata actual del servidor (fuente de verdad)
    //   2. Hace un merge profundo del historialPagosTecnico (append-only, nunca destruye)
    //   3. Solo actualiza los campos de pago relevantes
    // Esto evita la race condition donde TicketWindow.syncToSupabase() borra pagos recién confirmados.
    async updatePaymentSafe(id: string, newPago: {
        id: string;
        monto: number;
        fecha: string;
        tipo: string;
        estado: string;
        referencia: string;
        voucherRef?: string | null;
    }, additionalUpdates: {
        status_id?: string;
        execution_date?: string;
        closure_date?: string;
        metadataFields?: Record<string, any>;
    } = {}) {
        // 1. Leer metadata actual del servidor — es la única fuente de verdad
        const { data: current, error: fetchErr } = await supabase
            .from('tickets')
            .select('metadata, status_id, labor_cost, total_quoted_amount, technician_id, monto_pactado_mo, costoManoObra, monto_acordado, ingresos_reales, monto_presupuesto, montoFinal, montoTotalCotizado, montoIGV, igv')
            .eq('id', id)
            .single();

        if (fetchErr) throw fetchErr;

        const serverMeta = current?.metadata || {};

        // 2. Merge del historial: nunca pisamos pagos existentes
        // 2. Unificar historial (evitar duplicados y manejar ambos nombres de campo)
        const existingPagos: any[] = serverMeta.historialPagosTecnico || serverMeta.historialPagosTécnico || [];
        // Evitar duplicados en caso de doble-click
        const alreadyExists = existingPagos.some((p: any) => p.id === newPago.id);
        const mergedPagos = alreadyExists ? existingPagos : [...existingPagos, newPago];

        // 3. Metadata final: merge inteligente del servidor + cambios de pago
        const newMetadata = {
            ...serverMeta,
            ...additionalUpdates.metadataFields,
            historialPagosTecnico: mergedPagos,
            historialPagosTécnico: mergedPagos
        };

        // 4. Preparar updates de columnas
        const updates: any = { metadata: newMetadata };
        if (additionalUpdates.status_id) updates.status_id = additionalUpdates.status_id;
        if (additionalUpdates.execution_date) updates.execution_date = additionalUpdates.execution_date;
        if (additionalUpdates.closure_date) updates.closure_date = additionalUpdates.closure_date;

        const { data, error } = await supabase
            .from('tickets')
            .update(updates)
            .eq('id', id)
            .select('id, status_id, metadata')
            .single();

        if (error) throw error;
        return data;
    },

    // ★★★ METADATA-SAFE GENERIC UPDATE ★★★
    // Permite actualizar campos de la metadata sin borrar el resto del JSON.
    // Especialmente útil para no borrar el historial de pagos al reasignar gestoras.
    async patchMetadata(id: string, metadataUpdates: Record<string, any>, columnUpdates: Record<string, any> = {}) {
        const { data: current, error: fetchErr } = await supabase
            .from('tickets')
            .select('metadata, status_id, labor_cost, total_quoted_amount, technician_id, monto_pactado_mo, costoManoObra, monto_acordado, ingresos_reales, monto_presupuesto, montoFinal, montoTotalCotizado, montoIGV, igv')
            .eq('id', id)
            .single();

        if (fetchErr) return this.update(id, { ...columnUpdates, metadata: metadataUpdates });

        const serverMeta = current?.metadata || {};
        
        // Manejar ambos nombres de campo (con y sin acento) y unificar a sin acento
        let mergedPagos = serverMeta.historialPagosTecnico || serverMeta.historialPagosTécnico || [];
        if (metadataUpdates.historialPagosTecnico || metadataUpdates.historialPagosTécnico) {
            const incoming = metadataUpdates.historialPagosTecnico || metadataUpdates.historialPagosTécnico || [];
            const allById = new Map();
            [...mergedPagos, ...incoming].forEach(p => {
                if (p?.id) allById.set(p.id, p);
            });
            mergedPagos = Array.from(allById.values());
        }

        const finalMetadata = {
            ...serverMeta,
            ...metadataUpdates,
            historialPagosTecnico: mergedPagos,
            historialPagosTécnico: mergedPagos
        };

        const updates = {
            ...columnUpdates,
            metadata: finalMetadata
        };

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
        const { data, error } = await supabase
            .from('ticket_costs')
            .select('*, technicians(id, name, first_name, last_name, document_number, phone, bank_name, account_number, cci, yape_number, plin_number)')
            .eq('ticket_id', ticketId)
            .order('created_at', { ascending: true });

        if (error) throw error;
        return data || [];
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
    }) {
        // Strip undefined / empty-string optional UUID fields to avoid FK violations
        const safePayload: Record<string, any> = {
            ticket_id: cost.ticket_id,
            concepto: cost.concepto,
            categoria: cost.categoria,
            monto: cost.monto,
            estado_pago: cost.estado_pago,
        };
        if (cost.proveedor)         safePayload.proveedor = cost.proveedor;
        if (cost.specialist_id)     safePayload.specialist_id = cost.specialist_id;
        if (cost.url_comprobante)   safePayload.url_comprobante = cost.url_comprobante;
        if (cost.solicitado_por)    safePayload.solicitado_por = cost.solicitado_por;
        if (cost.motivo)            safePayload.motivo = cost.motivo;

        const { data, error } = await supabase
            .from('ticket_costs')
            .insert(safePayload)
            .select('*')
            .single();

        if (error) {
            console.error("DEBUG: Error in ticketCostsAPI.create:", error.code, error.message, error.details, "Payload:", safePayload);
            throw error;
        }
        return data;
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
    }>) {
        const { data, error } = await supabase
            .from('ticket_costs')
            .update(updates)
            .eq('id', id)
            .select('*, technicians(*)')
            .single();

        if (error) throw error;
        return data;
    },

    async delete(id: string) {
        const { error } = await supabase
            .from('ticket_costs')
            .delete()
            .eq('id', id);

        if (error) throw error;
    },

    // Trasladar todos los costos de un ticket a otro (Blindaje Financiero)
    async transferAllToTicket(sourceTicketId: string, targetTicketId: string) {
        const { data, error } = await supabase
            .from('ticket_costs')
            .update({ ticket_id: targetTicketId })
            .eq('ticket_id', sourceTicketId)
            .select();

        if (error) throw error;
        return data;
    }
};

