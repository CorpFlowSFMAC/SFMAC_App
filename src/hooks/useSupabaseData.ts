import { useState, useEffect, useCallback } from 'react';
import {
    clientsAPI,
    branchesAPI,
    ticketsAPI,
    techniciansAPI,
    paymentsAPI,
    evidencesAPI
} from '@/lib/supabase-api';

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
        try {
            setLoading(true);
            const data = clientId
                ? await branchesAPI.getByClient(clientId)
                : await branchesAPI.getAll();
            setBranches(data);
            setError(null);
        } catch (err) {
            setError(err as Error);
            console.error('Error fetching branches:', err);
        } finally {
            setLoading(false);
        }
    }, [clientId]);

    useEffect(() => {
        fetchBranches();
    }, [fetchBranches]);

    const createBranch = useCallback(async (branchData: {
        client_id: string;
        name: string;
        address?: string;
        zone?: string;
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

    return {
        branches,
        loading,
        error,
        refresh: fetchBranches,
        createBranch,
        updateBranch,
        deleteBranch
    };
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

// ============================================
// TICKETS HOOKS
// ============================================

export function useTickets(statusId?: string, technicianId?: string) {
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
            } else {
                data = await ticketsAPI.getAll();
            }

            setTickets(data);
            setError(null);
        } catch (err) {
            setError(err as Error);
            console.error('Error fetching tickets:', err);
        } finally {
            setLoading(false);
        }
    }, [statusId, technicianId]);

    useEffect(() => {
        fetchTickets();
    }, [fetchTickets]);

    const createTicket = useCallback(async (ticketData: {
        client_id?: string;
        branch_id?: string;
        technician_id?: string;
        status_id?: string;
        description?: string;
        client_ticket_number?: string;
        labor_cost?: number;
        materials_cost?: number;
        visit_cost?: number;
        total_quoted_amount?: number;
        metadata?: any;
    }) => {
        try {
            const newTicket = await ticketsAPI.create(ticketData);
            setTickets(prev => [newTicket, ...prev]);
            return newTicket;
        } catch (err) {
            console.error('Error creating ticket:', err);
            throw err;
        }
    }, []);

    const updateTicket = useCallback(async (id: string, updates: any) => {
        try {
            const updated = await ticketsAPI.update(id, updates);
            setTickets(prev => prev.map(t => t.id === id ? updated : t));
            return updated;
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
            setTicket(data);
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
