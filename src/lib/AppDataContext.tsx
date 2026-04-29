"use client";

import React, {
    createContext,
    useContext,
    useCallback,
    useEffect,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { clientsAPI, techniciansAPI, ticketsAPI, gestorasAPI, gestorasTargetsAPI } from "@/lib/supabase-api";
import { normalizeStateId } from "@/lib/ticketStates";
import {
    useTickets,
    useClients as useClientsQuery,
    useTechnicians as useTechniciansQuery,
    useGestoras as useGestorasQuery,
    useGestorasTargets as useGestorasTargetsQuery,
    queryKeys,
    normalizeTicket,
} from "@/lib/useQueryHooks";

// ─────────────────────────────────────────────
// TIPOS DEL CONTEXTO (misma interfaz pública de siempre)
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
    updatePaymentSafe: (id: string, newPago: any, additionalUpdates?: any) => Promise<any>;
    deleteTicket: (id: string) => Promise<void>;

    // Gestoras
    gestoras: any[];
    loadingGestoras: boolean;
    refreshGestoras: () => Promise<void>;

    // Targets & Bonos
    gestorasTargets: any[];
    loadingTargets: boolean;
    refreshTargets: () => Promise<void>;
    setTarget: (gestoraId: string, monthKey: string, updates: any) => Promise<any>;
}

const AppDataContext = createContext<AppDataContextType | null>(null);

// ─────────────────────────────────────────────
// PROVIDER — Ahora usa TanStack Query internamente
// pero mantiene la misma API para no romper consumidores
// ─────────────────────────────────────────────
export function AppDataProvider({ children }: { children: React.ReactNode }) {
    const queryClient = useQueryClient();

    // ── Queries ──────────────────────────────
    const {
        data: tickets = [],
        isLoading: loadingTickets,
    } = useTickets();

    const {
        data: clients = [],
        isLoading: loadingClients,
    } = useClientsQuery();

    const {
        data: technicians = [],
        isLoading: loadingTechnicians,
    } = useTechniciansQuery();

    const {
        data: gestoras = [],
        isLoading: loadingGestoras,
    } = useGestorasQuery();

    const {
        data: gestorasTargets = [],
        isLoading: loadingTargets,
    } = useGestorasTargetsQuery();

    // ── Refresh = invalidar caché → TanStack refetch automáticamente ──
    const refreshTickets = useCallback(async () => {
        await queryClient.invalidateQueries({ queryKey: queryKeys.tickets.all });
    }, [queryClient]);

    const refreshClients = useCallback(async () => {
        await queryClient.invalidateQueries({ queryKey: queryKeys.clients.all });
    }, [queryClient]);

    const refreshTechnicians = useCallback(async () => {
        await queryClient.invalidateQueries({ queryKey: queryKeys.technicians.all });
    }, [queryClient]);

    const refreshGestoras = useCallback(async () => {
        await queryClient.invalidateQueries({ queryKey: queryKeys.gestoras.all });
    }, [queryClient]);

    const refreshTargets = useCallback(async () => {
        await queryClient.invalidateQueries({ queryKey: queryKeys.gestorasTargets.all });
    }, [queryClient]);

    const setTarget = useCallback(async (gestoraId: string, monthKey: string, updates: any) => {
        const result = await gestorasTargetsAPI.set(gestoraId, monthKey, updates);
        await queryClient.invalidateQueries({ queryKey: queryKeys.gestorasTargets.all });
        return result;
    }, [queryClient]);

    // ── Suscripciones Realtime → invalidan caché TanStack ──
    useEffect(() => {
        // ─ Canal: CLIENTES → inserción/actualización/borrado directo en caché
        const clientsChannel = supabase
            .channel("appdata:clients")
            .on(
                "postgres_changes",
                { event: "*", schema: "public", table: "clients" },
                (payload) => {
                    if (payload.eventType === "INSERT") {
                        queryClient.setQueryData(
                            queryKeys.clients.all,
                            (old: any[] | undefined) => {
                                if (!old) return old;
                                const exists = old.some(
                                    (c) => c.id === (payload.new as any).id
                                );
                                return exists ? old : [...old, payload.new];
                            }
                        );
                    } else if (payload.eventType === "UPDATE") {
                        queryClient.setQueryData(
                            queryKeys.clients.all,
                            (old: any[] | undefined) =>
                                old
                                    ? old.map((c) =>
                                        c.id === (payload.new as any).id
                                            ? { ...c, ...payload.new }
                                            : c
                                    )
                                    : old
                        );
                    } else if (payload.eventType === "DELETE") {
                        queryClient.setQueryData(
                            queryKeys.clients.all,
                            (old: any[] | undefined) =>
                                old
                                    ? old.filter(
                                        (c) =>
                                            c.id !== (payload.old as any).id
                                    )
                                    : old
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
                        queryClient.setQueryData(
                            queryKeys.technicians.all,
                            (old: any[] | undefined) => {
                                if (!old) return old;
                                const exists = old.some(
                                    (t) => t.id === (payload.new as any).id
                                );
                                return exists ? old : [...old, payload.new];
                            }
                        );
                    } else if (payload.eventType === "UPDATE") {
                        queryClient.setQueryData(
                            queryKeys.technicians.all,
                            (old: any[] | undefined) =>
                                old
                                    ? old.map((t) =>
                                        t.id === (payload.new as any).id
                                            ? { ...t, ...payload.new }
                                            : t
                                    )
                                    : old
                        );
                    } else if (payload.eventType === "DELETE") {
                        queryClient.setQueryData(
                            queryKeys.technicians.all,
                            (old: any[] | undefined) =>
                                old
                                    ? old.filter(
                                        (t) =>
                                            t.id !== (payload.old as any).id
                                    )
                                    : old
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
                (payload) => {
                    if (payload.eventType === "INSERT") {
                        // Inserción requiere fetch porque el summary es una vista con joins
                        queryClient.invalidateQueries({
                            queryKey: queryKeys.tickets.all,
                        });
                    } else if (payload.eventType === "UPDATE") {
                        const pNew = payload.new as any;
                        const ticketId = pNew.id;
                        if (!ticketId) return;

                        // Actualizar Summary en caché con MERGE PROFUNDO
                        // El payload Realtime incluye todos los campos de la tabla pero
                        // puede llegar con metadata desactualizada durante race conditions.
                        // Usamos merge para preservar campos críticos del caché local.
                        queryClient.setQueryData(
                            queryKeys.tickets.summary(),
                            (old: any[] | undefined) =>
                                old
                                    ? old.map((t) => {
                                        if (t.id !== ticketId) return t;
                                        const statusId = pNew.status_id || t.status_id;
                                        const incomingMeta = pNew.metadata || {};
                                        const existingMeta = t.metadata || {};
                                        
                                        // Merge metadata: el payload nuevo gana.
                                        // Solo protegemos campos si el incoming es explícitamente undefined
                                        // (lo que indicaría un payload parcial corrupto).
                                        const mergedMeta = {
                                            ...existingMeta,
                                            ...incomingMeta,
                                            solicitudAdelanto: incomingMeta.solicitudAdelanto !== undefined
                                                ? incomingMeta.solicitudAdelanto
                                                : existingMeta.solicitudAdelanto,
                                            adelantoPagado: incomingMeta.adelantoPagado !== undefined
                                                ? incomingMeta.adelantoPagado
                                                : existingMeta.adelantoPagado,
                                            solicitudPagoVisita: incomingMeta.solicitudPagoVisita !== undefined
                                                ? incomingMeta.solicitudPagoVisita
                                                : existingMeta.solicitudPagoVisita,
                                        };
                                        return {
                                            ...t,
                                            ...pNew,
                                            status_id: statusId,
                                            estadoId: normalizeStateId(statusId),
                                            metadata: mergedMeta,
                                            // Propagar campos clave a nivel raiz
                                            solicitudAdelanto: mergedMeta.solicitudAdelanto,
                                            adelantoPagado: mergedMeta.adelantoPagado ?? t.adelantoPagado,
                                        };
                                    })
                                    : old
                        );
                        
                        // Actualizar Detalle en caché (si existe) con el MISMO MERGE
                        queryClient.setQueryData(
                            queryKeys.tickets.detail(ticketId),
                            (old: any) => {
                                if (!old) return old;
                                const incomingMeta = pNew.metadata || {};
                                const existingMeta = old.metadata || {};
                                const mergedMeta = {
                                    ...existingMeta,
                                    ...incomingMeta,
                                    solicitudAdelanto: incomingMeta.solicitudAdelanto !== undefined
                                        ? incomingMeta.solicitudAdelanto
                                        : existingMeta.solicitudAdelanto,
                                    adelantoPagado: incomingMeta.adelantoPagado !== undefined
                                        ? incomingMeta.adelantoPagado
                                        : existingMeta.adelantoPagado,
                                    solicitudPagoVisita: incomingMeta.solicitudPagoVisita !== undefined
                                        ? incomingMeta.solicitudPagoVisita
                                        : existingMeta.solicitudPagoVisita,
                                };
                                return {
                                    ...old,
                                    ...pNew,
                                    metadata: mergedMeta,
                                    solicitudAdelanto: mergedMeta.solicitudAdelanto,
                                    adelantoPagado: mergedMeta.adelantoPagado ?? old.adelantoPagado,
                                };
                            }
                        );

                        // Marcar como stale pero ya tenemos los datos frescos y fusionados
                        queryClient.invalidateQueries({ 
                            queryKey: queryKeys.tickets.detail(ticketId),
                            exact: true,
                            refetchType: 'none' 
                        });
                    } else if (payload.eventType === "DELETE") {
                        queryClient.setQueryData(
                            queryKeys.tickets.summary(),
                            (old: any[] | undefined) =>
                                old
                                    ? old.filter((t) => t.id !== (payload.old as any).id)
                                    : old
                        );
                    }
                }
            )
            .subscribe();

        // ─ Canal: COSTOS (Para peticiones de pago)
        const costsChannel = supabase
            .channel("appdata:ticket_costs")
            .on(
                "postgres_changes",
                { event: "*", schema: "public", table: "ticket_costs" },
                (payload) => {
                    const ticketId = (payload.new as any)?.ticket_id || (payload.old as any)?.ticket_id;
                    if (ticketId) {
                        // Solo invalidar el ticket afectado, no toda la base de datos
                        queryClient.invalidateQueries({
                            queryKey: queryKeys.tickets.detail(ticketId),
                        });
                        // El summary también podría cambiar (totales), pero lo hacemos silencioso
                        queryClient.invalidateQueries({
                            queryKey: queryKeys.tickets.summary(),
                            refetchType: 'none'
                        });
                    }
                }
            )
            .subscribe();

        // ─ Canal: BRANCH_OFFICES → actualiza clientes
        const branchesChannel = supabase
            .channel("appdata:branches")
            .on(
                "postgres_changes",
                { event: "*", schema: "public", table: "branch_offices" },
                () => {
                    queryClient.invalidateQueries({
                        queryKey: queryKeys.clients.all,
                    });
                }
            )
            .subscribe();

        // ─ Canal: GESTORAS
        const gestorasChannel = supabase
            .channel("appdata:gestoras")
            .on(
                "postgres_changes",
                { event: "*", schema: "public", table: "gestoras" },
                () => {
                    queryClient.invalidateQueries({
                        queryKey: queryKeys.gestoras.all,
                    });
                }
            )
            .subscribe();

        // ─ Canal: TARGETS
        const targetsChannel = supabase
            .channel("appdata:targets")
            .on(
                "postgres_changes",
                { event: "*", schema: "public", table: "gestoras_targets" },
                () => {
                    queryClient.invalidateQueries({
                        queryKey: queryKeys.gestorasTargets.all,
                    });
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(clientsChannel);
            supabase.removeChannel(techniciansChannel);
            supabase.removeChannel(ticketsChannel);
            supabase.removeChannel(costsChannel);
            supabase.removeChannel(branchesChannel);
            supabase.removeChannel(gestorasChannel);
            supabase.removeChannel(targetsChannel);
        };
    }, [queryClient]);

    // ── CRUD: Clients ─────────────────────────
    const createClient = useCallback(
        async (data: any) => {
            const created = await clientsAPI.create(data);
            queryClient.invalidateQueries({
                queryKey: queryKeys.clients.all,
            });
            return created;
        },
        [queryClient]
    );

    const updateClient = useCallback(
        async (id: string, updates: any) => {
            const updated = await clientsAPI.update(id, updates);
            queryClient.setQueryData(
                queryKeys.clients.all,
                (old: any[] | undefined) =>
                    old
                        ? old.map((c) =>
                            c.id === id ? { ...c, ...updated } : c
                        )
                        : old
            );
            return updated;
        },
        [queryClient]
    );

    const deleteClient = useCallback(
        async (id: string) => {
            await clientsAPI.delete(id);
            queryClient.setQueryData(
                queryKeys.clients.all,
                (old: any[] | undefined) =>
                    old ? old.filter((c) => c.id !== id) : old
            );
        },
        [queryClient]
    );

    // ── CRUD: Technicians ─────────────────────
    const createTechnician = useCallback(
        async (data: any) => {
            const created = await techniciansAPI.create(data);
            queryClient.invalidateQueries({
                queryKey: queryKeys.technicians.all,
            });
            return created;
        },
        [queryClient]
    );

    const updateTechnician = useCallback(
        async (id: string, updates: any) => {
            const updated = await techniciansAPI.update(id, updates);
            queryClient.setQueryData(
                queryKeys.technicians.all,
                (old: any[] | undefined) =>
                    old
                        ? old.map((t) =>
                            t.id === id ? { ...t, ...updated } : t
                        )
                        : old
            );
            return updated;
        },
        [queryClient]
    );

    const deleteTechnician = useCallback(
        async (id: string) => {
            await techniciansAPI.delete(id);
            queryClient.setQueryData(
                queryKeys.technicians.all,
                (old: any[] | undefined) =>
                    old ? old.filter((t) => t.id !== id) : old
            );
        },
        [queryClient]
    );

    // ── CRUD: Tickets ─────────────────────────
    const createTicket = useCallback(
        async (data: any) => {
            const created = await ticketsAPI.create(data);
            const normalized = normalizeTicket(created);
            // 🚀 OPTIMIZACIÓN: en lugar de invalidar (refetch HTTP de toda la lista),
            // insertamos el nuevo ticket directo en la cache. El canal realtime
            // (postgres_changes en `tickets`) sincroniza otras pestañas/usuarios.
            queryClient.setQueryData(
                queryKeys.tickets.summary(),
                (old: any[] | undefined) => (old ? [normalized, ...old] : [normalized])
            );
            return normalized;
        },
        [queryClient]
    );

    const updateTicket = useCallback(
        async (id: string, updates: any) => {
            const updated = await ticketsAPI.update(id, updates);
            const normalized = normalizeTicket(updated);
            // Update en caché TanStack con MERGE PROFUNDO para no borrar campos críticos de metadata
            // (e.g. solicitudAdelanto, adelantoPagado) que no vienen en el SELECT simple de update()
            queryClient.setQueryData(
                queryKeys.tickets.summary(),
                (old: any[] | undefined) =>
                    old
                        ? old.map((t) => {
                            if (t.id !== id) return t;
                            // Merge: preservar metadata critica del cache que el API no devuelve
                            const existingMeta = t.metadata || {};
                            const newMeta = normalized?.metadata || {};
                            const mergedMeta = {
                                ...existingMeta,
                                ...newMeta,
                                // Campos criticos: si el nuevo valor es null/undefined, y no es una limpieza intencional, conservar el existente.
                                // Pero si el admin está limpiando (set a null), debemos respetarlo.
                                solicitudAdelanto: newMeta.solicitudAdelanto !== undefined
                                    ? newMeta.solicitudAdelanto
                                    : existingMeta.solicitudAdelanto,
                                adelantoPagado: newMeta.adelantoPagado !== undefined
                                    ? newMeta.adelantoPagado
                                    : existingMeta.adelantoPagado,
                                solicitudPagoVisita: newMeta.solicitudPagoVisita !== undefined
                                    ? newMeta.solicitudPagoVisita
                                    : existingMeta.solicitudPagoVisita,
                                solicitudLiquidacion: newMeta.solicitudLiquidacion !== undefined
                                    ? newMeta.solicitudLiquidacion
                                    : existingMeta.solicitudLiquidacion,
                                // Eliminamos la restricción de historialPagosTecnico para permitir borrados
                            };
                            return {
                                ...t, // Preservar campos locales como paidCosts, pendingCosts
                                ...normalized,
                                metadata: mergedMeta,
                                // Propagar a nivel raiz para que TicketWindow los detecte
                                solicitudAdelanto: mergedMeta.solicitudAdelanto,
                                adelantoPagado: mergedMeta.adelantoPagado ?? t.adelantoPagado,
                            };
                        })
                        : old
            );
            // Tambien actualizar detalle si está cacheado
            queryClient.setQueryData(
                queryKeys.tickets.detail(id),
                normalized
            );
            return normalized;
        },
        [queryClient]
    );

    const updatePaymentSafe = useCallback(
        async (id: string, newPago: any, additionalUpdates: any = {}) => {
            const updated = await ticketsAPI.updatePaymentSafe(id, newPago, additionalUpdates);
            const normalized = normalizeTicket(updated);
            // Actualización inmediata en caché local
            queryClient.setQueryData(
                queryKeys.tickets.summary(),
                (old: any[] | undefined) =>
                    old ? old.map((t) => (t.id === id ? { ...t, ...normalized } : t)) : old
            );
            queryClient.setQueryData(queryKeys.tickets.detail(id), normalized);
            return normalized;
        },
        [queryClient]
    );

    const deleteTicket = useCallback(
        async (id: string) => {
            await ticketsAPI.delete(id);
            queryClient.setQueryData(
                queryKeys.tickets.summary(),
                (old: any[] | undefined) =>
                    old ? old.filter((t) => t.id !== id) : old
            );
        },
        [queryClient]
    );

    return (
        <AppDataContext.Provider
            value={{
                clients,
                loadingClients,
                refreshClients,
                createClient,
                updateClient,
                deleteClient,
                technicians,
                loadingTechnicians,
                refreshTechnicians,
                createTechnician,
                updateTechnician,
                deleteTechnician,
                tickets,
                loadingTickets,
                refreshTickets,
                createTicket,
                updateTicket,
                updatePaymentSafe,
                deleteTicket,
                gestoras,
                loadingGestoras,
                refreshGestoras,
                gestorasTargets,
                loadingTargets,
                refreshTargets,
                setTarget,
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
