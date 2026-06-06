import { useState, useEffect, useCallback } from 'react';
import { normalizeStateId } from '@/lib/ticketStates';
import {
    clientsAPI,
    branchesAPI,
    ticketsAPI,
    techniciansAPI,
    paymentsAPI,
    evidencesAPI
} from '@/lib/supabase-api';
import { supabase } from '@/lib/supabase';

// ============================================
// CLIENTS HOOKS
// ============================================

export function useClients() {
    const [clients, setClients] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);

    const fetchClients = useCallback(async () => {
        try {
            setLoading(true);
            const data = await clientsAPI.getAll();
            setClients(data);
            setError(null);
        } catch (err) {
            setError(err as Error);
            console.error('Error fetching clients:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchClients();
    }, [fetchClients]);

    const createClient = useCallback(async (clientData: { name: string }) => {
        try {
            const newClient = await clientsAPI.create(clientData);
            setClients(prev => [...prev, newClient]);
            return newClient;
        } catch (err) {
            console.error('Error creating client:', err);
            throw err;
        }
    }, []);

    const updateClient = useCallback(async (id: string, updates: Partial<{ name: string }>) => {
        try {
            const updated = await clientsAPI.update(id, updates);
            setClients(prev => prev.map(c => c.id === id ? updated : c));
            return updated;
        } catch (err) {
            console.error('Error updating client:', err);
            throw err;
        }
    }, []);

    const deleteClient = useCallback(async (id: string) => {
        try {
            await clientsAPI.delete(id);
            setClients(prev => prev.filter(c => c.id !== id));
        } catch (err) {
            console.error('Error deleting client:', err);
            throw err;
        }
    }, []);

    return {
        clients,
        loading,
        error,
        refresh: fetchClients,
        createClient,
        updateClient,
        deleteClient
    };
}

export function useClient(id: string | null) {
    const [client, setClient] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);

    useEffect(() => {
        if (!id) {
            setClient(null);
            setLoading(false);
            return;
        }

        const fetchClient = async () => {
            try {
                setLoading(true);
                const data = await clientsAPI.getById(id);
                setClient(data);
                setError(null);
            } catch (err) {
                setError(err as Error);
                console.error('Error fetching client:', err);
            } finally {
                setLoading(false);
            }
        };

        fetchClient();
    }, [id]);

    return { client, loading, error };
}

// ============================================
// BRANCHES HOOKS
// ============================================

export function useBranches(clientId?: string) {
    const [branches, setBranches] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);

    const fetchBranches = useCallback(async () => {
        // 🚧 FIX: Normalizar clientId - nunca undefined
        const cid = clientId ?? "";
        
        // Optimización: No cargar si el clientId es un string vacío
        if (!cid || cid === "") {
            setBranches([]);
            setLoading(false);
            return;
        }

        try {
            setLoading(true);
            setBranches([]); // Limpiar sedes anteriores
            
            // Consulta directa - Sin timeout artificial
            const data: any = await branchesAPI.getByClient(cid);
            
            setBranches(data || []);
            setError(null);
        } catch (err: any) {
            setError(err as Error);
            console.error('[useBranches] Error fetching branches:', err.message || err);
        } finally {
            setLoading(false);
        }
    }, [clientId]); // clientId en dependencias

    useEffect(() => {
        fetchBranches();
    }, [fetchBranches]);

    // Función de refetch manual
    const refetch = useCallback(() => {
        fetchBranches();
    }, [fetchBranches]);

    const createBranch = useCallback(async (branchData: {
        client_id: string;
        name: string;
        address?: string;
        zone?: string;
        departamento?: string;
        provincia?: string;
        distrito?: string;
        codigo_topaz?: string;
        tipo?: string;
    }) => {
        try {
            const newBranch = await branchesAPI.create(branchData);
            setBranches(prev => [...prev, newBranch]);
            return newBranch;
        } catch (err) {
            console.error('Error creating branch:', err);
            throw err;
        }
    }, []);

    const updateBranch = useCallback(async (id: string, updates: Partial<{
        name: string;
        address: string;
        zone: string;
        departamento: string;
        provincia: string;
        distrito: string;
        codigo_topaz: string;
        tipo: string;
    }>) => {
        try {
            const updated = await branchesAPI.update(id, updates);
            setBranches(prev => prev.map(b => b.id === id ? updated : b));
            return updated;
        } catch (err) {
            console.error('Error updating branch:', err);
            throw err;
        }
    }, []);

    const deleteBranch = useCallback(async (id: string) => {
        try {
            await branchesAPI.delete(id);
            setBranches(prev => prev.filter(b => b.id !== id));
        } catch (err) {
            console.error('Error deleting branch:', err);
            throw err;
        }
    }, []);

    return { branches, loading, error, refetch, createBranch, updateBranch, deleteBranch };
}

export function useBranchesByZone(zone: string) {
    const [branches, setBranches] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);

    useEffect(() => {
        const fetchBranches = async () => {
            try {
                setLoading(true);
                const data = await branchesAPI.getByZone(zone);
                setBranches(data);
                setError(null);
            } catch (err) {
                setError(err as Error);
                console.error('Error fetching branches by zone:', err);
            } finally {
                setLoading(false);
            }
        };

        if (zone) {
            fetchBranches();
        }
    }, [zone]);

    return { branches, loading, error };
}

// ============================================
// TECHNICIANS HOOKS
// ============================================

export function useTechnicians(status?: string) {
    const [technicians, setTechnicians] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);

    const fetchTechnicians = useCallback(async () => {
        try {
            setLoading(true);
            const data = status
                ? await techniciansAPI.getByStatus(status)
                : await techniciansAPI.getAll();
            setTechnicians(data);
            setError(null);
        } catch (err) {
            setError(err as Error);
            console.error('Error fetching technicians:', err);
        } finally {
            setLoading(false);
        }
    }, [status]);

    useEffect(() => {
        fetchTechnicians();
    }, [fetchTechnicians]);

    const createTechnician = useCallback(async (techData: {
        name: string;
        document_number?: string;
        phone?: string;
        email?: string;
        bank_name?: string;
        account_number?: string;
        cci?: string;
        yape_number?: string;
        plin_number?: string;
        status?: string;
    }) => {
        try {
            const newTech = await techniciansAPI.create(techData);
            setTechnicians(prev => [...prev, newTech]);
            return newTech;
        } catch (err) {
            console.error('Error creating technician:', err);
            throw err;
        }
    }, []);

    const updateTechnician = useCallback(async (id: string, updates: any) => {
        try {
            const updated = await techniciansAPI.update(id, updates);
            setTechnicians(prev => prev.map(t => t.id === id ? updated : t));
            return updated;
        } catch (err) {
            console.error('Error updating technician:', err);
            throw err;
        }
    }, []);

    const deleteTechnician = useCallback(async (id: string) => {
        try {
            await techniciansAPI.delete(id);
            setTechnicians(prev => prev.filter(t => t.id !== id));
        } catch (err) {
            console.error('Error deleting technician:', err);
            throw err;
        }
    }, []);

    return {
        technicians,
        loading,
        error,
        refresh: fetchTechnicians,
        createTechnician,
        updateTechnician,
        deleteTechnician
    };
}

export function useTechnician(id: string | null) {
    const [technician, setTechnician] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);

    const fetchTechnician = useCallback(async () => {
        if (!id) {
            setTechnician(null);
            setLoading(false);
            return;
        }

        try {
            setLoading(true);
            const data = await techniciansAPI.getById(id);
            setTechnician(data);
            setError(null);
        } catch (err) {
            setError(err as Error);
            console.error('Error fetching technician:', err);
        } finally {
            setLoading(false);
        }
    }, [id]);

    useEffect(() => {
        fetchTechnician();
    }, [fetchTechnician]);

    return { technician, loading, error, refresh: fetchTechnician };
}

const normalizeTicket = (t: any) => {
    if (!t) return null;

    // 🛡️ ANTI-RECURSIVIDAD: Extraer el objeto real de metadatos si está anidado
    let realMetadata = t.metadata || {};
    while (realMetadata.metadata && typeof realMetadata.metadata === 'object') {
        realMetadata = { ...realMetadata, ...realMetadata.metadata };
        delete realMetadata.metadata;
    }

    // Normalizar Cliente (Supabase 'clients' -> UI 'cliente')
    const clienteRaw = t.clients || t.cliente || realMetadata.cliente;
    const cliente = clienteRaw ? {
        ...clienteRaw,
        nombre: clienteRaw.name || clienteRaw.nombre || 'Sin Nombre',
        color: clienteRaw.color_aura || clienteRaw.color || '#8B5CF6'
    } : null;

    // Normalizar Sede (Supabase 'branch_offices' -> UI 'sede')
    const sedeRaw = t.branch_offices || t.sede || realMetadata.sede;
    const sede = sedeRaw ? {
        ...sedeRaw,
        nombre: sedeRaw.name || sedeRaw.nombre || 'Sin Sede',
        direccion: sedeRaw.address || sedeRaw.direccion || 'Sin dirección',
        zona: sedeRaw.zonas?.codigo || sedeRaw.zone || sedeRaw.zona || (sedeRaw.zonas?.nombre) || 'PAN PERÚ',
        departamento: sedeRaw.departamento || realMetadata.departamento,
        provincia: sedeRaw.provincia || realMetadata.provincia,
        distrito: sedeRaw.distrito || realMetadata.distrito
    } : null;

    // Normalizar Técnico
    let tecnicoRaw = t.technicians || t.tecnico || realMetadata.tecnico;
    if (Array.isArray(tecnicoRaw)) tecnicoRaw = tecnicoRaw[0];

    let tecnico = null;
    if (tecnicoRaw) {
        const firstName = tecnicoRaw.first_name || tecnicoRaw.nombre || '';
        const lastName = tecnicoRaw.last_name || tecnicoRaw.apellido || '';
        const fullName = tecnicoRaw.name || (firstName && lastName ? `${firstName} ${lastName}`.trim() : firstName || lastName);

        tecnico = {
            ...tecnicoRaw,
            id: tecnicoRaw.id,
            nombre: fullName || 'Sin Técnico',
            banco: tecnicoRaw.bank_name || tecnicoRaw.banco || '---',
            numeroCuenta: tecnicoRaw.account_number || tecnicoRaw.numeroCuenta || '---',
            cci: tecnicoRaw.cci || tecnicoRaw.cci_number || '---',
            yape: tecnicoRaw.yape_number || tecnicoRaw.yape || tecnicoRaw.phone,
            plin: tecnicoRaw.plin_number || tecnicoRaw.plin || tecnicoRaw.phone
        };
    }

    // Normalizar Gestora (Supabase 'gestora' o 'gestoras' o plural anidado -> UI 'gestora')
    // El API usa .select('..., gestora:gestoras(*)') el resultado es t.gestora
    const gestoraRaw = t.gestora || t.gestoras?.[0] || t.gestoras || realMetadata.gestora;
    const gestora = gestoraRaw ? {
        ...gestoraRaw,
        nombre: gestoraRaw.name || gestoraRaw.nombre || gestoraRaw.email?.split('@')[0] || 'Gestora'
    } : null;

    return {
        ...realMetadata, // Campos de metadatos primero
        ...t,            // Columnas de backend ganan si hay solapamiento (Preservation)
        
        // Mapeo de campos raíz prioritarios
        estadoId: normalizeStateId(t.status_id || t.estadoId || realMetadata.estadoId || 'nuevo'),
        descripcionProblema: t.description || t.descripcionProblema || realMetadata.descripcionProblema || '',
        numeroTicketCliente: t.client_ticket_number || t.numeroTicketCliente || realMetadata.numeroTicketCliente || '',
        fechaCreacion: t.created_at || t.fechaCreacion || realMetadata.fechaCreacion,
        createdAt: t.created_at || t.createdAt || t.fechaCreacion || realMetadata.createdAt,
        costoManoObra: t.labor_cost || t.costoManoObra || realMetadata.costoManoObra || 0,
        costoMateriales: t.materials_cost || t.costoMateriales || realMetadata.costoMateriales || 0,
        costoVisita: t.visit_cost || t.costoVisita || realMetadata.costoVisita || 0,
        montoFinal: t.total_quoted_amount || t.montoFinal || realMetadata.montoFinal || 0,

        // Otros campos operativos
        tipoServicio: t.service_type || t.tipoServicio || realMetadata.tipoServicio,
        creadoPor: t.created_by || t.creadoPor || realMetadata.creadoPor,
        diagnostico: t.diagnosis || t.diagnostico || realMetadata.diagnostico,

        // Conservar metadatos limpios en su objeto original
        metadata: realMetadata,
        
        // Forzar objetos normalizados
        cliente,
        sede,
        tecnico,
        gestora,
        // Columna de base de datos directa para lógica de visibilidad fiable
        gestora_id: t.gestora_id || realMetadata.gestora_id || null
    };
};

// ============================================
// TICKETS HOOKS
// ============================================

export function useTickets(statusId?: string, technicianId?: string, fullData: boolean = false) {
    const [tickets, setTickets] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);

    const fetchTickets = useCallback(async () => {
        try {
            setLoading(true);
            let data;

            if (technicianId) {
                data = await ticketsAPI.getByTechnician(technicianId);
            } else if (statusId) {
                data = await ticketsAPI.getByStatus(statusId);
            } else if (fullData) {
                // Solo si explícitamente se piden los metadatos pesados (ej: en módulo de pagos si no hay de otra)
                data = await ticketsAPI.getAll();
            } else {
                // 🔥 CARGA LIGERA POR DEFECTO: Omitimos metadatos (imágenes base64) para máxima velocidad
                data = await ticketsAPI.getSummaryAll();
            }

            setTickets((data || []).map(normalizeTicket));
            setError(null);
        } catch (err) {
            setError(err as Error);
            console.error('Error fetching tickets:', err);
        } finally {
            setLoading(false);
        }
    }, [statusId, technicianId, fullData]);

    useEffect(() => {
        fetchTickets();

        // ⚡ REALTIME OPTIMIZADO: Suscribirse a cambios en tickets
        // En lugar de recargar TODO, podríamos actualizar solo el ticket que cambió
        const channel = supabase
            .channel('public:tickets_changes')
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'tickets'
            }, (payload) => {
                if (payload.eventType === 'INSERT') {
                    // Para nuevos tickets, quizás conviene recargar para traer las relaciones (clients, branch)
                    // que Supabase no envía en el payload simple de realtime.
                    fetchTickets();
                } else if (payload.eventType === 'UPDATE') {
                    // Actualizamos localmente si ya lo tenemos
                    setTickets(prev => prev.map(t =>
                        t.id === payload.new.id ? normalizeTicket({ ...t, ...payload.new }) : t
                    ));
                    // Opcional: fetchTickets() si necesitamos relaciones actualizadas
                } else if (payload.eventType === 'DELETE') {
                    setTickets(prev => prev.filter(t => t.id !== payload.old.id));
                }
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [fetchTickets]);

    const createTicket = useCallback(async (ticketData: any) => {
        try {
            const newTicket = await ticketsAPI.create(ticketData);
            const normalized = normalizeTicket(newTicket);
            setTickets(prev => [normalized, ...prev]);
            return normalized;
        } catch (err) {
            console.error('Error creating ticket:', err);
            throw err;
        }
    }, []);

    const updateTicket = useCallback(async (id: string, updates: any) => {
        try {
            const updated = await ticketsAPI.update(id, updates);
            const normalized = normalizeTicket(updated);
            setTickets(prev => prev.map(t => t.id === id ? normalized : t));
            return normalized;
        } catch (err) {
            console.error('Error updating ticket:', err);
            throw err;
        }
    }, []);

    const deleteTicket = useCallback(async (id: string) => {
        try {
            await ticketsAPI.delete(id);
            setTickets(prev => prev.filter(t => t.id !== id));
        } catch (err) {
            console.error('Error deleting ticket:', err);
            throw err;
        }
    }, []);

    return {
        tickets,
        loading,
        error,
        refresh: fetchTickets,
        createTicket,
        updateTicket,
        deleteTicket
    };
}

export function useTicket(id: string | null) {
    const [ticket, setTicket] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);

    const fetchTicket = useCallback(async () => {
        if (!id) {
            setTicket(null);
            setLoading(false);
            return;
        }

        try {
            setLoading(true);
            const data = await ticketsAPI.getById(id);
            setTicket(normalizeTicket(data));
            setError(null);
        } catch (err) {
            setError(err as Error);
            console.error('Error fetching ticket:', err);
        } finally {
            setLoading(false);
        }
    }, [id]);

    useEffect(() => {
        fetchTicket();
    }, [fetchTicket]);

    const updateTicket = useCallback(async (updates: any) => {
        if (!id) return;

        try {
            const updated = await ticketsAPI.update(id, updates);
            setTicket(updated);
            return updated;
        } catch (err) {
            console.error('Error updating ticket:', err);
            throw err;
        }
    }, [id]);

    return {
        ticket,
        loading,
        error,
        refresh: fetchTicket,
        updateTicket
    };
}

// ============================================
// PAYMENTS HOOKS
// ============================================

export function useTicketPayments(ticketId: string | null) {
    const [payments, setPayments] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);

    const fetchPayments = useCallback(async () => {
        if (!ticketId) {
            setPayments([]);
            setLoading(false);
            return;
        }

        try {
            setLoading(true);
            const data = await paymentsAPI.getByTicket(ticketId);
            setPayments(data);
            setError(null);
        } catch (err) {
            setError(err as Error);
            console.error('Error fetching payments:', err);
        } finally {
            setLoading(false);
        }
    }, [ticketId]);

    useEffect(() => {
        fetchPayments();
    }, [fetchPayments]);

    const createPayment = useCallback(async (paymentData: {
        ticket_id: string;
        amount: number;
        payment_type: string;
        reference_number?: string;
        payment_date?: string;
        status?: string;
    }) => {
        try {
            const newPayment = await paymentsAPI.create(paymentData);
            setPayments(prev => [newPayment, ...prev]);
            return newPayment;
        } catch (err) {
            console.error('Error creating payment:', err);
            throw err;
        }
    }, []);

    const updatePayment = useCallback(async (id: string, updates: any) => {
        try {
            const updated = await paymentsAPI.update(id, updates);
            setPayments(prev => prev.map(p => p.id === id ? updated : p));
            return updated;
        } catch (err) {
            console.error('Error updating payment:', err);
            throw err;
        }
    }, []);

    const deletePayment = useCallback(async (id: string) => {
        try {
            await paymentsAPI.delete(id);
            setPayments(prev => prev.filter(p => p.id !== id));
        } catch (err) {
            console.error('Error deleting payment:', err);
            throw err;
        }
    }, []);

    return {
        payments,
        loading,
        error,
        refresh: fetchPayments,
        createPayment,
        updatePayment,
        deletePayment
    };
}

// ============================================
// EVIDENCES HOOKS
// ============================================

export function useTicketEvidences(ticketId: string | null) {
    const [evidences, setEvidences] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);

    const fetchEvidences = useCallback(async () => {
        if (!ticketId) {
            setEvidences([]);
            setLoading(false);
            return;
        }

        try {
            setLoading(true);
            const data = await evidencesAPI.getByTicket(ticketId);
            setEvidences(data);
            setError(null);
        } catch (err) {
            setError(err as Error);
            console.error('Error fetching evidences:', err);
        } finally {
            setLoading(false);
        }
    }, [ticketId]);

    useEffect(() => {
        fetchEvidences();
    }, [fetchEvidences]);

    const createEvidence = useCallback(async (evidenceData: {
        ticket_id: string;
        url: string;
        evidence_type?: string;
    }) => {
        try {
            const newEvidence = await evidencesAPI.create(evidenceData);
            setEvidences(prev => [newEvidence, ...prev]);
            return newEvidence;
        } catch (err) {
            console.error('Error creating evidence:', err);
            throw err;
        }
    }, []);

    const deleteEvidence = useCallback(async (id: string) => {
        try {
            await evidencesAPI.delete(id);
            setEvidences(prev => prev.filter(e => e.id !== id));
        } catch (err) {
            console.error('Error deleting evidence:', err);
            throw err;
        }
    }, []);

    return {
        evidences,
        loading,
        error,
        refresh: fetchEvidences,
        createEvidence,
        deleteEvidence
    };
}

// ============================================
// UTILITY HOOKS
// ============================================

/**
 * Hook para obtener estadísticas de tickets por estado
 */
export function useTicketStats() {
    const { tickets, loading } = useTickets();
    const [stats, setStats] = useState<Record<string, number>>({});

    useEffect(() => {
        if (!loading && tickets) {
            const statsByStatus: Record<string, number> = {};

            tickets.forEach(ticket => {
                const status = ticket.status_id || 'unknown';
                statsByStatus[status] = (statsByStatus[status] || 0) + 1;
            });

            setStats(statsByStatus);
        }
    }, [tickets, loading]);

    return { stats, loading };
}

/**
 * Hook para modo híbrido: intenta Supabase, fallback a localStorage
 */
export function useHybridData<T>(
    supabaseFetcher: () => Promise<T[]>,
    localStorageKey: string
) {
    const [data, setData] = useState<T[]>([]);
    const [loading, setLoading] = useState(true);
    const [source, setSource] = useState<'supabase' | 'localStorage' | null>(null);

    useEffect(() => {
        const fetchData = async () => {
            try {
                setLoading(true);
                // Intentar Supabase primero
                const supabaseData = await supabaseFetcher();
                setData(supabaseData);
                setSource('supabase');
            } catch (err) {
                console.warn('Supabase fetch failed, falling back to localStorage:', err);
                // Fallback a localStorage
                try {
                    const localData = JSON.parse(localStorage.getItem(localStorageKey) || '[]');
                    setData(localData);
                    setSource('localStorage');
                } catch (localErr) {
                    console.error('localStorage fetch also failed:', localErr);
                    setData([]);
                    setSource(null);
                }
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [supabaseFetcher, localStorageKey]);

    return { data, loading, source };
}
