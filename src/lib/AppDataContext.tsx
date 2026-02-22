"use client";

import React, {
    createContext,
    useContext,
    useState,
    useEffect,
    useCallback,
    useRef,
} from "react";
import { supabase } from "@/lib/supabase";
import { clientsAPI, techniciansAPI, ticketsAPI } from "@/lib/supabase-api";
import { normalizeStateId } from "@/lib/ticketStates";

// ─────────────────────────────────────────────
// NORMALIZACIÓN DE TICKET (igual que en el hook)
// ─────────────────────────────────────────────
const normalizeTicket = (t: any) => {
    if (!t) return null;

    let realMetadata = t.metadata || {};
    while (realMetadata.metadata && typeof realMetadata.metadata === "object") {
        realMetadata = { ...realMetadata, ...realMetadata.metadata };
        delete realMetadata.metadata;
    }

    const clienteRaw = t.clients || t.cliente || realMetadata.cliente;
    const cliente = clienteRaw
        ? {
            ...clienteRaw,
            nombre: clienteRaw.name || clienteRaw.nombre || "Sin Nombre",
            color: clienteRaw.color_aura || clienteRaw.color || "#8B5CF6",
        }
        : null;

    const sedeRaw = t.branch_offices || t.sede || realMetadata.sede;
    const sede = sedeRaw
        ? {
            ...sedeRaw,
            nombre: sedeRaw.name || sedeRaw.nombre || "Sin Sede",
            direccion: sedeRaw.address || sedeRaw.direccion || "Sin dirección",
            zona: sedeRaw.zone || sedeRaw.zona || "PAN PERÚ",
            departamento: sedeRaw.departamento || realMetadata.departamento,
            provincia: sedeRaw.provincia || realMetadata.provincia,
            distrito: sedeRaw.distrito || realMetadata.distrito,
        }
        : null;

    let tecnicoRaw = t.technicians || t.tecnico || realMetadata.tecnico;
    if (Array.isArray(tecnicoRaw)) tecnicoRaw = tecnicoRaw[0];

    let tecnico = null;
    if (tecnicoRaw) {
        const firstName = tecnicoRaw.first_name || tecnicoRaw.nombre || "";
        const lastName = tecnicoRaw.last_name || tecnicoRaw.apellido || "";
        const fullName =
            tecnicoRaw.name ||
            (firstName && lastName
                ? `${firstName} ${lastName}`.trim()
                : firstName || lastName);
        tecnico = {
            ...tecnicoRaw,
            id: tecnicoRaw.id,
            nombre: fullName || "Sin Técnico",
            banco: tecnicoRaw.bank_name || tecnicoRaw.banco || "---",
            numeroCuenta:
                tecnicoRaw.account_number || tecnicoRaw.numeroCuenta || "---",
            cci: tecnicoRaw.cci || tecnicoRaw.cci_number || "---",
            yape:
                tecnicoRaw.yape_number || tecnicoRaw.yape || tecnicoRaw.phone,
            plin:
                tecnicoRaw.plin_number || tecnicoRaw.plin || tecnicoRaw.phone,
        };
    }

    return {
        ...t,
        estadoId: normalizeStateId(
            t.status_id || t.estadoId || realMetadata.estadoId || "nuevo"
        ),
        descripcionProblema:
            t.description ||
            t.descripcionProblema ||
            realMetadata.descripcionProblema ||
            "",
        numeroTicketCliente:
            t.client_ticket_number ||
            t.numeroTicketCliente ||
            realMetadata.numeroTicketCliente ||
            "",
        fechaCreacion:
            t.created_at || t.fechaCreacion || realMetadata.fechaCreacion,
        createdAt:
            t.created_at || t.createdAt || t.fechaCreacion || realMetadata.createdAt,
        costoManoObra:
            t.labor_cost || t.costoManoObra || realMetadata.costoManoObra || 0,
        costoMateriales:
            t.materials_cost ||
            t.costoMateriales ||
            realMetadata.costoMateriales ||
            0,
        costoVisita:
            t.visit_cost || t.costoVisita || realMetadata.costoVisita || 0,
        montoFinal:
            t.total_quoted_amount ||
            t.montoFinal ||
            realMetadata.montoFinal ||
            0,
        cliente,
        sede,
        tecnico,
        tipoServicio:
            t.service_type || t.tipoServicio || realMetadata.tipoServicio,
        creadoPor: t.created_by || t.creadoPor || realMetadata.creadoPor,
        diagnostico:
            t.diagnosis || t.diagnostico || realMetadata.diagnostico,
        metadata: realMetadata,
        ...realMetadata,
    };
};

// ─────────────────────────────────────────────
// TIPOS DEL CONTEXTO
// ─────────────────────────────────────────────
interface AppDataContextType {
    // Clients
    clients: any[];
    loadingClients: boolean;
    refreshClients: () => Promise<void>;
    createClient: (data: any) => Promise<any>;
    updateClient: (id: string, updates: any) => Promise<any>;
    deleteClient: (id: string) => Promise<void>;

    // Technicians
    technicians: any[];
    loadingTechnicians: boolean;
    refreshTechnicians: () => Promise<void>;
    createTechnician: (data: any) => Promise<any>;
    updateTechnician: (id: string, updates: any) => Promise<any>;
    deleteTechnician: (id: string) => Promise<void>;

    // Tickets
    tickets: any[];
    loadingTickets: boolean;
    refreshTickets: () => Promise<void>;
    createTicket: (data: any) => Promise<any>;
    updateTicket: (id: string, updates: any) => Promise<any>;
    deleteTicket: (id: string) => Promise<void>;
}

const AppDataContext = createContext<AppDataContextType | null>(null);

// ─────────────────────────────────────────────
// PROVIDER
// ─────────────────────────────────────────────
export function AppDataProvider({ children }: { children: React.ReactNode }) {
    // ── Clients ──────────────────────────────
    const [clients, setClients] = useState<any[]>([]);
    const [loadingClients, setLoadingClients] = useState(true);

    const fetchClients = useCallback(async () => {
        try {
            setLoadingClients(true);
            const data = await clientsAPI.getAll();
            setClients(data || []);
        } catch (err) {
            console.error("[AppData] Error fetching clients:", err);
        } finally {
            setLoadingClients(false);
        }
    }, []);

    // ── Technicians ──────────────────────────
    const [technicians, setTechnicians] = useState<any[]>([]);
    const [loadingTechnicians, setLoadingTechnicians] = useState(true);

    const fetchTechnicians = useCallback(async () => {
        try {
            setLoadingTechnicians(true);
            const data = await techniciansAPI.getAll();
            setTechnicians(data || []);
        } catch (err) {
            console.error("[AppData] Error fetching technicians:", err);
        } finally {
            setLoadingTechnicians(false);
        }
    }, []);

    // ── Tickets ──────────────────────────────
    const [tickets, setTickets] = useState<any[]>([]);
    const [loadingTickets, setLoadingTickets] = useState(true);

    const fetchTickets = useCallback(async () => {
        try {
            setLoadingTickets(true);
            const data = await ticketsAPI.getSummaryAll();
            setTickets((data || []).map(normalizeTicket));
        } catch (err) {
            console.error("[AppData] Error fetching tickets:", err);
        } finally {
            setLoadingTickets(false);
        }
    }, []);

    // ── Carga inicial ─────────────────────────
    useEffect(() => {
        fetchClients();
        fetchTechnicians();
        fetchTickets();
    }, [fetchClients, fetchTechnicians, fetchTickets]);

    // ── Suscripciones Realtime Supabase ──────
    // Usamos ref para acceder a la última versión de fetchTickets sin recrear el canal
    const fetchTicketsRef = useRef(fetchTickets);
    fetchTicketsRef.current = fetchTickets;

    useEffect(() => {
        // ─ Canal: CLIENTES
        const clientsChannel = supabase
            .channel("appdata:clients")
            .on(
                "postgres_changes",
                { event: "*", schema: "public", table: "clients" },
                (payload) => {
                    if (payload.eventType === "INSERT") {
                        setClients((prev) => {
                            const exists = prev.some(
                                (c) => c.id === (payload.new as any).id
                            );
                            return exists ? prev : [...prev, payload.new];
                        });
                    } else if (payload.eventType === "UPDATE") {
                        setClients((prev) =>
                            prev.map((c) =>
                                c.id === (payload.new as any).id
                                    ? { ...c, ...payload.new }
                                    : c
                            )
                        );
                    } else if (payload.eventType === "DELETE") {
                        setClients((prev) =>
                            prev.filter(
                                (c) => c.id !== (payload.old as any).id
                            )
                        );
                    }
                }
            )
            .subscribe();

        // ─ Canal: TÉCNICOS
        const techniciansChannel = supabase
            .channel("appdata:technicians")
            .on(
                "postgres_changes",
                { event: "*", schema: "public", table: "technicians" },
                (payload) => {
                    if (payload.eventType === "INSERT") {
                        setTechnicians((prev) => {
                            const exists = prev.some(
                                (t) => t.id === (payload.new as any).id
                            );
                            return exists ? prev : [...prev, payload.new];
                        });
                    } else if (payload.eventType === "UPDATE") {
                        setTechnicians((prev) =>
                            prev.map((t) =>
                                t.id === (payload.new as any).id
                                    ? { ...t, ...payload.new }
                                    : t
                            )
                        );
                    } else if (payload.eventType === "DELETE") {
                        setTechnicians((prev) =>
                            prev.filter(
                                (t) => t.id !== (payload.old as any).id
                            )
                        );
                    }
                }
            )
            .subscribe();

        // ─ Canal: TICKETS
        const ticketsChannel = supabase
            .channel("appdata:tickets")
            .on(
                "postgres_changes",
                { event: "*", schema: "public", table: "tickets" },
                async (payload) => {
                    if (payload.eventType === "INSERT") {
                        // Para INSERTs recargamos para traer las relaciones (cliente, sede, técnico)
                        fetchTicketsRef.current();
                    } else if (payload.eventType === "UPDATE") {
                        // ⚠️ CRÍTICO: payload.new de postgres_changes NO incluye columnas JSONB
                        // grandes como 'metadata' (llegan null/vacías).
                        // Si hacemos merge superficial con payload.new, destruimos la metadata
                        // (solicitudAdelanto, historialPagosTecnico, estadoId real, etc.).
                        // Solución: hacer getById() completo para obtener el ticket fresco con metadata.
                        const ticketId = (payload.new as any).id;
                        if (!ticketId) return;
                        try {
                            const freshTicket = await ticketsAPI.getById(ticketId);
                            if (freshTicket) {
                                const normalized = normalizeTicket(freshTicket);
                                setTickets((prev) =>
                                    prev.map((t) => t.id === ticketId ? normalized : t)
                                );
                            }
                        } catch (err) {
                            console.warn("[AppData] No se pudo refetch ticket, usando merge superficial:", err);
                            // Fallback seguro: solo actualizar status_id del payload (no tocar metadata)
                            setTickets((prev) =>
                                prev.map((t) => {
                                    if (t.id !== ticketId) return t;
                                    const pNew = payload.new as any;
                                    const statusId = pNew.status_id;
                                    if (!statusId) return t;
                                    return normalizeTicket({
                                        ...t,
                                        status_id: statusId,
                                        estadoId: normalizeStateId(statusId),
                                    });
                                })
                            );
                        }
                    } else if (payload.eventType === "DELETE") {
                        setTickets((prev) =>
                            prev.filter(
                                (t) => t.id !== (payload.old as any).id
                            )
                        );
                    }
                }
            )
            .subscribe();

        // ─ Canal: BRANCH_OFFICES (sedes) → actualiza totales de clientes
        const branchesChannel = supabase
            .channel("appdata:branches")
            .on(
                "postgres_changes",
                { event: "*", schema: "public", table: "branch_offices" },
                () => {
                    // Cuando hay cambio en sedes, refrescar clientes para actualizar totalBranches
                    fetchClients();
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(clientsChannel);
            supabase.removeChannel(techniciansChannel);
            supabase.removeChannel(ticketsChannel);
            supabase.removeChannel(branchesChannel);
        };
    }, [fetchClients]);

    // ── CRUD: Clients ─────────────────────────
    const createClient = useCallback(async (data: any) => {
        const created = await clientsAPI.create(data);
        // La suscripción Realtime actualizará el estado automáticamente
        return created;
    }, []);

    const updateClient = useCallback(async (id: string, updates: any) => {
        const updated = await clientsAPI.update(id, updates);
        return updated;
    }, []);

    const deleteClient = useCallback(async (id: string) => {
        await clientsAPI.delete(id);
    }, []);

    // ── CRUD: Technicians ─────────────────────
    const createTechnician = useCallback(async (data: any) => {
        const created = await techniciansAPI.create(data);
        return created;
    }, []);

    const updateTechnician = useCallback(async (id: string, updates: any) => {
        const updated = await techniciansAPI.update(id, updates);
        return updated;
    }, []);

    const deleteTechnician = useCallback(async (id: string) => {
        await techniciansAPI.delete(id);
    }, []);

    // ── CRUD: Tickets ─────────────────────────
    const createTicket = useCallback(async (data: any) => {
        const created = await ticketsAPI.create(data);
        const normalized = normalizeTicket(created);
        // La suscripción Realtime hará el fetch completo al detectar INSERT
        return normalized;
    }, []);

    const updateTicket = useCallback(async (id: string, updates: any) => {
        const updated = await ticketsAPI.update(id, updates);
        const normalized = normalizeTicket(updated);
        setTickets((prev) =>
            prev.map((t) => (t.id === id ? normalized : t))
        );
        return normalized;
    }, []);

    const deleteTicket = useCallback(async (id: string) => {
        await ticketsAPI.delete(id);
        setTickets((prev) => prev.filter((t) => t.id !== id));
    }, []);

    return (
        <AppDataContext.Provider
            value={{
                clients,
                loadingClients,
                refreshClients: fetchClients,
                createClient,
                updateClient,
                deleteClient,
                technicians,
                loadingTechnicians,
                refreshTechnicians: fetchTechnicians,
                createTechnician,
                updateTechnician,
                deleteTechnician,
                tickets,
                loadingTickets,
                refreshTickets: fetchTickets,
                createTicket,
                updateTicket,
                deleteTicket,
            }}
        >
            {children}
        </AppDataContext.Provider>
    );
}

// ─────────────────────────────────────────────
// HOOK DE ACCESO AL CONTEXTO
// ─────────────────────────────────────────────
export function useAppData() {
    const ctx = useContext(AppDataContext);
    if (!ctx) {
        throw new Error(
            "useAppData debe usarse dentro de <AppDataProvider>. Verifica que el layout lo incluya."
        );
    }
    return ctx;
}
