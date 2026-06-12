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
    findGestoraByEmail,
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

    // Auth & Identity
    userEmail: string | null;
    userRole: string | null;
    activeGestora: any | null;
    isAdmin: boolean;
}

const AppDataContext = createContext<AppDataContextType | null>(null);

// ─────────────────────────────────────────────
// PROVIDER — Ahora usa TanStack Query internamente
// pero mantiene la misma API para no romper consumidores
// ─────────────────────────────────────────────
export function AppDataProvider({ children }: { children: React.ReactNode }) {
    const queryClient = useQueryClient();

    // ── Auth Lifecycle State ──
    const [userEmail, setUserEmail] = React.useState<string | null>(null);
    const [userRole, setUserRole] = React.useState<string | null>(null);
    const [authLoading, setAuthLoading] = React.useState(true);
    const [isSupabaseAuthenticated, setIsSupabaseAuthenticated] = React.useState(false);

    useEffect(() => {
        let active = true;

        async function resolveUser() {
            try {
                const { data: { session } } = await supabase.auth.getSession();
                let email = session?.user?.email || null;
                let role = session?.user?.user_metadata?.role || null;
                
                if (!email) {
                    const { data: { user } } = await supabase.auth.getUser();
                    email = user?.email || null;
                    if (user && !role) role = user.user_metadata?.role || null;
                }



                if (!email && typeof window !== "undefined") {
                    email = localStorage.getItem("userEmail");
                    if (email && email.includes('%40')) {
                        email = decodeURIComponent(email);
                    }
                }
                if (!role && typeof window !== "undefined") {
                    role = localStorage.getItem("userRole");
                }

                if (!email && typeof window !== "undefined") {
                    const cookies = document.cookie.split(";").reduce((acc, c) => {
                        const [k, v] = c.trim().split("=");
                        if (k) acc[k] = v ? decodeURIComponent(v) : "";
                        return acc;
                    }, {} as Record<string, string>);
                    email = cookies["userEmail"] || null;
                    if (!role) role = cookies["userRole"] || null;
                }

                // Consideramos autenticado si logramos conseguir un email por cualquier vía
                const isRealAuth = !!email;

                if (active) {
                    setUserEmail(email);
                    setUserRole(role);
                    setIsSupabaseAuthenticated(isRealAuth);
                    setAuthLoading(false);
                }
            } catch (err) {
                console.error("[AppDataContext] Error resolving auth user:", err);
                if (active) {
                    setAuthLoading(false);
                }
            }
        }

        resolveUser();

        // Subscribe to auth state changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            const email = session?.user?.email || null;
            const role = session?.user?.user_metadata?.role || null;
            if (active) {
                if (email) setUserEmail(email);
                if (role) setUserRole(role);
                setIsSupabaseAuthenticated(!!email);
            }
        });

        return () => {
            active = false;
            subscription.unsubscribe();
        };
    }, []);

    // ── Queries ──────────────────────────────
    // Solo habilitar las queries si la sesión de Supabase Auth está lista para evitar "Auth session missing!" y HTTP 400
    const queriesEnabled = !authLoading && isSupabaseAuthenticated;

    const {
        data: tickets = [],
        isLoading: queryLoadingTickets,
    } = useTickets(userEmail, queriesEnabled);

    const {
        data: clients = [],
        isLoading: queryLoadingClients,
    } = useClientsQuery(userEmail, queriesEnabled);

    const {
        data: technicians = [],
        isLoading: queryLoadingTechnicians,
    } = useTechniciansQuery(userEmail, queriesEnabled);

    const {
        data: gestoras = [],
        isLoading: queryLoadingGestoras,
    } = useGestorasQuery(userEmail, queriesEnabled);

    const {
        data: gestorasTargets = [],
        isLoading: queryLoadingTargets,
    } = useGestorasTargetsQuery(userEmail, queriesEnabled);

    // Resolve activeGestora and isAdmin based on resolved email and role
    const activeGestora = React.useMemo(() => {
        return findGestoraByEmail(gestoras, userEmail);
    }, [userEmail, gestoras]);

    const isAdmin = React.useMemo(() => {
        if (!userRole) return false;
        const r = userRole.toUpperCase();
        return r === "ADMIN" || r === "SUPERADMIN";
    }, [userRole]);

    const loadingTickets = authLoading || queryLoadingTickets;
    const loadingClients = authLoading || queryLoadingClients;
    const loadingTechnicians = authLoading || queryLoadingTechnicians;
    const loadingGestoras = authLoading || queryLoadingGestoras;
    const loadingTargets = authLoading || queryLoadingTargets;

    // ── Refresh = invalidar caché → TanStack refetch automáticamente ──
    const refreshTickets = useCallback(async () => {
        // Invalidar todas las queries de tickets incluyendo pagos
        await queryClient.invalidateQueries({ queryKey: queryKeys.tickets.all });
        await queryClient.invalidateQueries({ queryKey: queryKeys.tickets.payments() });
        await queryClient.invalidateQueries({ queryKey: queryKeys.tickets.summary() });
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
                        // ⚡ FIX: En lugar de invalidar queries (que causa re-fetch en cadena y potencial loop),
                        // usamos setQueryData para añadir el ticket directamente al caché.
                        // El summary view con joins se normaliza aquí para evitar inconsistencias.
                        const newTicket = payload.new as any;
                        if (newTicket?.id) {
                            queryClient.setQueryData(
                                [...queryKeys.tickets.summary(), userEmail],
                                (old: any[] | undefined) => {
                                    if (!old) return old;
                                    const exists = old.some(t => t.id === newTicket.id);
                                    if (exists) return old;
                                    return [normalizeTicket(newTicket), ...old];
                                }
                            );
                            // También actualizar el caché sin userEmail (summary global)
                            queryClient.setQueryData(
                                queryKeys.tickets.summary(),
                                (old: any[] | undefined) => {
                                    if (!old) return old;
                                    const exists = old.some(t => t.id === newTicket.id);
                                    if (exists) return old;
                                    return [normalizeTicket(newTicket), ...old];
                                }
                            );
                        }
                    } else if (payload.eventType === "UPDATE") {
                        const pNew = payload.new as any;
                        const ticketId = pNew.id;
                        if (!ticketId) return;

                        // Actualizar Summary en caché con MERGE PROFUNDO
                        // El payload Realtime incluye todos los campos de la tabla pero
                        // puede llegar con metadata desactualizada durante race conditions.
                        // Usamos merge para preservar campos críticos del caché local.
                        queryClient.setQueryData(
                            [...queryKeys.tickets.summary(), userEmail],
                            (old: any[] | undefined) =>
                                old
                                    ? old.map((t) => {
                                        if (t.id !== ticketId) return t;
                                        
                                        // Detectar cambios en técnicos/gestoras para evitar parpadeo (flickering)
                                        // Si el ID cambió pero el objeto unido (tecnico/gestora) es el viejo,
                                        // intentamos parcharlo desde el caché global de maestros.
                                        const hasTechChanged = pNew.technician_id !== undefined && pNew.technician_id !== t.technician_id;
                                        const hasGestoraChanged = pNew.gestora_id !== undefined && pNew.gestora_id !== t.gestora_id;

                                        let patchedTecnico = t.tecnico;
                                        if (hasTechChanged) {
                                            if (!pNew.technician_id) {
                                                patchedTecnico = null;
                                            } else {
                                                const allTechs = queryClient.getQueryData<any[]>(queryKeys.technicians.all);
                                                const found = allTechs?.find(tech => tech.id === pNew.technician_id);
                                                if (found) {
                                                    // Normalizar técnico igual que en useQueryHooks
                                                    const firstName = found.first_name || found.nombre || "";
                                                    const lastName = found.last_name || found.apellido || "";
                                                    patchedTecnico = {
                                                        ...found,
                                                        id: found.id,
                                                        nombre: found.name || (firstName && lastName ? `${firstName} ${lastName}`.trim() : firstName || lastName) || "Sin Técnico"
                                                    };
                                                } else {
                                                    // Si no está en cache, forzamos null para que la UI no muestre el viejo
                                                    patchedTecnico = null; 
                                                }
                                            }
                                        }

                                        let patchedGestora = t.gestora;
                                        if (hasGestoraChanged) {
                                            if (!pNew.gestora_id) {
                                                patchedGestora = null;
                                            } else {
                                                const allGestoras = queryClient.getQueryData<any[]>(queryKeys.gestoras.all);
                                                const found = allGestoras?.find(g => g.id === pNew.gestora_id);
                                                if (found) {
                                                    patchedGestora = { ...found, nombre: found.name || found.nombre };
                                                } else {
                                                    patchedGestora = null;
                                                }
                                            }
                                        }

                                        const statusId = pNew.status_id || t.status_id;
                                        const incomingMeta = pNew.metadata || {};
                                        const existingMeta = t.metadata || {};
                                        
                                        // ★ FIX: Merge metadata con protección contra null del servidor
                                        // Si el servidor tiene null (rechazado/limpio), ese null debe win sobre valores stale
                                        const incomingHasAdelanto = incomingMeta.solicitudAdelanto !== undefined;
                                        const incomingHasPagoVista = incomingMeta.solicitudPago !== undefined;
                                        const existingHasAdelanto = existingMeta.solicitudAdelanto !== undefined;
                                        const existingHasPagoVista = existingMeta.solicitudPago !== undefined;
                                        
                                        // Si el servidor tiene null (rechazado), ese null wins
                                        const serverClearedAdelanto = incomingMeta.solicitudAdelanto === null || (incomingHasAdelanto && !incomingMeta.solicitudAdelanto);
                                        const serverClearedPagoVista = incomingMeta.solicitudPago === null || (incomingHasPagoVista && !incomingMeta.solicitudPago);
                                        
                                        const mergedMeta = {
                                            ...existingMeta,
                                            ...incomingMeta,
                                            // Si el servidor tiene null (rechazado), usar null del servidor
                                            solicitudAdelanto: serverClearedAdelanto 
                                                ? null 
                                                : (incomingHasAdelanto 
                                                    ? incomingMeta.solicitudAdelanto 
                                                    : (existingHasAdelanto 
                                                        ? existingMeta.solicitudAdelanto 
                                                        : undefined)),
                                            solicitudPago: serverClearedPagoVista 
                                                ? null 
                                                : (incomingHasPagoVista 
                                                    ? incomingMeta.solicitudPago 
                                                    : (existingHasPagoVista 
                                                        ? existingMeta.solicitudPago 
                                                        : undefined)),
                                            solicitudLiquidacion: incomingMeta.solicitudLiquidacion !== undefined
                                                ? incomingMeta.solicitudLiquidacion
                                                : existingMeta.solicitudLiquidacion,
                                            // Otros campos del incoming siempre ganan
                                            pagoRechazado: incomingMeta.pagoRechazado !== undefined 
                                                ? incomingMeta.pagoRechazado 
                                                : existingMeta.pagoRechazado,
                                        };
                                        return {
                                            ...t,
                                            ...pNew,
                                            status_id: statusId,
                                            estadoId: normalizeStateId(statusId),
                                            metadata: mergedMeta,
                                            tecnico: patchedTecnico,
                                            gestora: patchedGestora,
                                            // Propagar campos clave a nivel raiz
                                            solicitudAdelanto: mergedMeta.solicitudAdelanto,
                                            solicitudPago: mergedMeta.solicitudPago,
                                            solicitudLiquidacion: mergedMeta.solicitudLiquidacion,
                                            pagoRechazado: mergedMeta.pagoRechazado,
                                            solicitudesDeposito: mergedMeta.solicitudesDeposito,
                                            adelantoPagado: mergedMeta.adelantoPagado,
                                        };
                                    })
                                    : old
                        );
                        
                        // Actualizar Detalle en caché (si existe) con el MISMO MERGE
                        queryClient.setQueryData(
                            queryKeys.tickets.detail(ticketId),
                            (old: any) => {
                                if (!old) return old;
                                
                                // Detectar cambios en técnicos/gestoras para el detalle
                                const hasTechChanged = pNew.technician_id !== undefined && pNew.technician_id !== old.technician_id;
                                const hasGestoraChanged = pNew.gestora_id !== undefined && pNew.gestora_id !== old.gestora_id;

                                let patchedTecnico = old.tecnico;
                                if (hasTechChanged) {
                                    if (!pNew.technician_id) {
                                        patchedTecnico = null;
                                    } else {
                                        const allTechs = queryClient.getQueryData<any[]>(queryKeys.technicians.all);
                                        const found = allTechs?.find(tech => tech.id === pNew.technician_id);
                                        if (found) {
                                            const firstName = found.first_name || found.nombre || "";
                                            const lastName = found.last_name || found.apellido || "";
                                            patchedTecnico = {
                                                ...found,
                                                id: found.id,
                                                nombre: found.name || (firstName && lastName ? `${firstName} ${lastName}`.trim() : firstName || lastName) || "Sin Técnico"
                                            };
                                        } else {
                                            patchedTecnico = null; 
                                        }
                                    }
                                }

                                let patchedGestora = old.gestora;
                                if (hasGestoraChanged) {
                                    if (!pNew.gestora_id) {
                                        patchedGestora = null;
                                    } else {
                                        const allGestoras = queryClient.getQueryData<any[]>(queryKeys.gestoras.all);
                                        const found = allGestoras?.find(g => g.id === pNew.gestora_id);
                                        if (found) {
                                            patchedGestora = { ...found, nombre: found.name || found.nombre };
                                        } else {
                                            patchedGestora = null;
                                        }
                                    }
                                }

                                const incomingMeta = pNew.metadata || {};
                                const existingMeta = old.metadata || {};
                                
                                // ★ FIX: Segunda ubicación - misma lógica de protección
                                const incomingHasAdelanto = incomingMeta.solicitudAdelanto !== undefined;
                                const incomingHasPagoVista = incomingMeta.solicitudPago !== undefined;
                                const existingHasAdelanto = existingMeta.solicitudAdelanto !== undefined;
                                const existingHasPagoVista = existingMeta.solicitudPago !== undefined;
                                
                                const serverClearedAdelanto = incomingMeta.solicitudAdelanto === null || (incomingHasAdelanto && !incomingMeta.solicitudAdelanto);
                                const serverClearedPagoVista = incomingMeta.solicitudPago === null || (incomingHasPagoVista && !incomingMeta.solicitudPago);
                                
                                const mergedMeta = {
                                    ...existingMeta,
                                    ...incomingMeta,
                                    solicitudAdelanto: serverClearedAdelanto 
                                        ? null 
                                        : (incomingHasAdelanto 
                                            ? incomingMeta.solicitudAdelanto 
                                            : (existingHasAdelanto 
                                                ? existingMeta.solicitudAdelanto 
                                                : undefined)),
                                    solicitudPago: serverClearedPagoVista 
                                        ? null 
                                        : (incomingHasPagoVista 
                                            ? incomingMeta.solicitudPago 
                                            : (existingHasPagoVista 
                                                ? existingMeta.solicitudPago 
                                                : undefined)),
                                    solicitudLiquidacion: incomingMeta.solicitudLiquidacion !== undefined
                                        ? incomingMeta.solicitudLiquidacion
                                        : existingMeta.solicitudLiquidacion,
                                    solicitudesDeposito: incomingMeta.solicitudesDeposito !== undefined
                                        ? incomingMeta.solicitudesDeposito
                                        : existingMeta.solicitudesDeposito,
                                    adelantoPagado: incomingMeta.adelantoPagado !== undefined
                                        ? incomingMeta.adelantoPagado
                                        : existingMeta.adelantoPagado,
                                    pagoRechazado: incomingMeta.pagoRechazado !== undefined 
                                        ? incomingMeta.pagoRechazado 
                                        : existingMeta.pagoRechazado,
                                };
                                return {
                                    ...old,
                                    ...pNew,
                                    metadata: mergedMeta,
                                    tecnico: patchedTecnico,
                                    gestora: patchedGestora,
                                    solicitudAdelanto: mergedMeta.solicitudAdelanto,
                                    solicitudPago: mergedMeta.solicitudPago,
                                    solicitudLiquidacion: mergedMeta.solicitudLiquidacion,
                                    pagoRechazado: mergedMeta.pagoRechazado,
                                    solicitudesDeposito: mergedMeta.solicitudesDeposito,
                                    adelantoPagado: mergedMeta.adelantoPagado,
                                };
                            }
                        );

                        // Marcar como stale pero ya tenemos los datos frescos y fusionados
                        queryClient.invalidateQueries({ 
                            queryKey: queryKeys.tickets.detail(ticketId),
                            exact: true,
                            refetchType: 'none' 
                        });
                        // Invalidar bandeja de pagos para sincronización inmediata
                        queryClient.invalidateQueries({
                            queryKey: queryKeys.tickets.payments()
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
                        // Abstracción de Red: Mutación 100% en RAM, cero peticiones al servidor (Previene fallos de Hetzner)
                        const updateLocalCache = (old: any[] | undefined) => {
                            if (!old) return old;
                            return old.map(t => {
                                if (t.id === ticketId) {
                                    const currentCosts = Array.isArray(t.costos) ? [...t.costos] : [];
                                    const payloadCost = payload.new as any;
                                    
                                    if (payload.eventType === 'DELETE') {
                                        return { ...t, costos: currentCosts.filter(c => c.id !== (payload.old as any).id) };
                                    }
                                    
                                    const existingIdx = currentCosts.findIndex(c => c.id === payloadCost.id);
                                    if (existingIdx >= 0) {
                                        currentCosts[existingIdx] = { ...currentCosts[existingIdx], ...payloadCost };
                                    } else if (payloadCost.id) {
                                        currentCosts.push(payloadCost);
                                    }
                                    return { ...t, costos: currentCosts };
                                }
                                return t;
                            });
                        };
                        
                        queryClient.setQueryData(queryKeys.tickets.summary(), updateLocalCache);
                        if (userEmail) {
                            queryClient.setQueryData([...queryKeys.tickets.summary(), userEmail], updateLocalCache);
                        }
                    }
                    // Invalidar silenciosamente sin disparar GET masivos
                    queryClient.invalidateQueries({
                        queryKey: queryKeys.tickets.payments(),
                        refetchType: 'none'
                    });
                }
            )
            .subscribe();

        // ─ Canal: PAGOS (Para depósitos o pagos)
        const paymentsChannel = supabase
            .channel("appdata:ticket_payments")
            .on(
                "postgres_changes",
                { event: "*", schema: "public", table: "ticket_payments" },
                (payload) => {
                    const ticketId = (payload.new as any)?.ticket_id || (payload.old as any)?.ticket_id;
                    if (ticketId) {
                        // Abstracción de Red: Mutación 100% en RAM, cero peticiones al servidor (Previene fallos de Hetzner)
                        const updateLocalCache = (old: any[] | undefined) => {
                            if (!old) return old;
                            return old.map(t => {
                                if (t.id === ticketId) {
                                    const currentPayments = Array.isArray(t.pagos) ? [...t.pagos] : [];
                                    const payloadPayment = payload.new as any;
                                    
                                    if (payload.eventType === 'DELETE') {
                                        return { ...t, pagos: currentPayments.filter(p => p.id !== (payload.old as any).id) };
                                    }
                                    
                                    const existingIdx = currentPayments.findIndex(p => p.id === payloadPayment.id);
                                    if (existingIdx >= 0) {
                                        currentPayments[existingIdx] = { ...currentPayments[existingIdx], ...payloadPayment };
                                    } else if (payloadPayment.id) {
                                        currentPayments.push(payloadPayment);
                                    }
                                    return { ...t, pagos: currentPayments };
                                }
                                return t;
                            });
                        };
                        
                        queryClient.setQueryData(queryKeys.tickets.summary(), updateLocalCache);
                        if (userEmail) {
                            queryClient.setQueryData([...queryKeys.tickets.summary(), userEmail], updateLocalCache);
                        }
                    }
                    // Invalidar silenciosamente sin disparar GET masivos
                    queryClient.invalidateQueries({
                        queryKey: queryKeys.tickets.payments(),
                        refetchType: 'none'
                    });
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

        // ─ Canal: TECHNICIAN_BRANCHES → actualiza técnicos
        const technicianBranchesChannel = supabase
            .channel("appdata:technician_branches")
            .on(
                "postgres_changes",
                { event: "*", schema: "public", table: "technician_branches" },
                () => {
                    queryClient.invalidateQueries({
                        queryKey: queryKeys.technicians.all,
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
            supabase.removeChannel(paymentsChannel);
            supabase.removeChannel(branchesChannel);
            supabase.removeChannel(technicianBranchesChannel);
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
            // 🚀 OPTIMIZACIÓN: insertamos directo en cache + invalidamos summary para asegurar sync
            queryClient.invalidateQueries({ queryKey: queryKeys.tickets.summary() });
            
            // También insertar directo para respuesta instantánea
            queryClient.setQueryData(
                [...queryKeys.tickets.summary(), userEmail],
                (old: any[] | undefined) => (old ? [normalized, ...old] : [normalized])
            );
            return normalized;
        },
        [queryClient, userEmail]
    );

    const updateTicket = useCallback(
        async (id: string, updates: any) => {
            const updated = await ticketsAPI.update(id, updates);
            const normalized = normalizeTicket(updated);
            // Update en caché TanStack con MERGE PROFUNDO para no borrar campos críticos de metadata
            // (e.g. solicitudAdelanto, adelantoPagado) que no vienen en el SELECT simple de update()
            queryClient.setQueryData(
                [...queryKeys.tickets.summary(), userEmail],
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
                                solicitudPago: newMeta.solicitudPago !== undefined
                                    ? newMeta.solicitudPago
                                    : existingMeta.solicitudPago,
                                solicitudLiquidacion: newMeta.solicitudLiquidacion !== undefined
                                    ? newMeta.solicitudLiquidacion
                                    : existingMeta.solicitudLiquidacion,
                                pagoRechazado: newMeta.pagoRechazado !== undefined
                                    ? newMeta.pagoRechazado
                                    : existingMeta.pagoRechazado,
                                solicitudesDeposito: newMeta.solicitudesDeposito !== undefined
                                    ? newMeta.solicitudesDeposito
                                    : existingMeta.solicitudesDeposito,
                                adelantoPagado: newMeta.adelantoPagado !== undefined
                                    ? newMeta.adelantoPagado
                                    : existingMeta.adelantoPagado,
                            };
                            return {
                                ...t,
                                ...normalized,
                                metadata: mergedMeta,
                                tecnico: normalized?.tecnico || t.tecnico,
                                gestora: normalized?.gestora || t.gestora,
                                cliente: normalized?.cliente || t.cliente,
                                sede: normalized?.sede || t.sede,
                                solicitudAdelanto: mergedMeta.solicitudAdelanto,
                                solicitudPago: mergedMeta.solicitudPago,
                                solicitudLiquidacion: mergedMeta.solicitudLiquidacion,
                                pagoRechazado: mergedMeta.pagoRechazado,
                                solicitudesDeposito: mergedMeta.solicitudesDeposito,
                                adelantoPagado: mergedMeta.adelantoPagado,
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

    const deleteTicket = useCallback(
        async (id: string) => {
            await ticketsAPI.delete(id);
            queryClient.setQueryData(
                [...queryKeys.tickets.summary(), userEmail],
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
                deleteTicket,
                gestoras,
                loadingGestoras,
                refreshGestoras,
                gestorasTargets,
                loadingTargets,
                refreshTargets,
                setTarget,
                userEmail,
                userRole,
                activeGestora,
                isAdmin,
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
