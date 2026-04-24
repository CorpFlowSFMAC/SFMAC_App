"use client";

import {
    useQuery,
    useMutation,
    useQueryClient,
    QueryClient,
} from "@tanstack/react-query";
import { ticketsAPI, clientsAPI, techniciansAPI, gestorasAPI, gestorasTargetsAPI } from "@/lib/supabase-api";
import { normalizeStateId } from "@/lib/ticketStates";
import { round2 } from "@/lib/formatters";

// ─────────────────────────────────────────────
// TICKET NORMALIZER (extraído como función pura reutilizable)
// ─────────────────────────────────────────────
export const normalizeTicket = (t: any) => {
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
            logo: clienteRaw.logo || realMetadata.logo || null,
        }
        : null;

    const sedeRaw = t.branch_offices || t.sede || realMetadata.sede;
    const sede = sedeRaw
        ? {
            ...sedeRaw,
            nombre: sedeRaw.name || sedeRaw.nombre || "Sin Sede",
            direccion: sedeRaw.address || sedeRaw.direccion || realMetadata.address || "Sin dirección",
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

    // Combinar todo en un objeto final
    // Importante: No dejar que el spread (...realMetadata) al final sobreescriba campos normalizados
    return {
        ...t,
        ...realMetadata, // Spread inicial para capturar campos extras
        id: t.id, // Asegurar ID del nivel superior
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
        costoManoObra: round2(
            Number(t.labor_cost || t.costoManoObra || realMetadata.costoManoObra || 0)
        ),
        costoMateriales: round2(
            Number(t.materials_cost ||
            t.costoMateriales ||
            realMetadata.costoMateriales ||
            0)
        ),
        costoVisita: round2(
            Number(t.visit_cost || t.costoVisita || realMetadata.costoVisita || 0)
        ),
        montoFinal: round2(
            Number(t.total_quoted_amount ||
            t.montoFinal ||
            realMetadata.montoFinal ||
            0)
        ),
        cliente,
        sede,
        tecnico,
        tipoServicio:
            t.service_type || t.tipoServicio || realMetadata.tipoServicio,
        creadoPor: t.created_by || t.creadoPor || realMetadata.creadoPor,
        diagnostico:
            t.diagnosis || t.diagnostico || realMetadata.diagnostico,
            
        // --- IMMUTABLE FINANCIAL FIELDS FROM BACKEND ---
        // Ensure these always come from the root `t` object (vw_ticket_financials)
        // and are not overwritten by stale legacy values in `realMetadata`.
        saldo_tecnico: t.saldo_tecnico,
        margen_real: t.margen_real,
        utilidad_neta: t.utilidad_neta,
        inversion_ejecutada: t.inversion_ejecutada ?? t.total_costs_agg,
        total_costs_agg: t.total_costs_agg,
        ingresos_reales: t.ingresos_reales,
        monto_pactado_mo: t.monto_pactado_mo,
        gastos_flujo_a: t.gastos_flujo_a,
        adelantos_flujo_b: t.adelantos_flujo_b,

        metadata: realMetadata, // Objeto de metadata limpio (sin anidamiento excesivo)
    };
};

// ─────────────────────────────────────────────
// QUERY KEYS FACTORY (centraliza las claves de caché)
// ─────────────────────────────────────────────
export const queryKeys = {
    tickets: {
        all: ["tickets"] as const,
        summary: () => [...queryKeys.tickets.all, "summary"] as const,
        detail: (id: string) => [...queryKeys.tickets.all, "detail", id] as const,
        payments: () => [...queryKeys.tickets.all, "payments"] as const,
    },
    clients: {
        all: ["clients"] as const,
    },
    technicians: {
        all: ["technicians"] as const,
    },
    gestoras: {
        all: ["gestoras"] as const,
    },
    gestorasTargets: {
        all: ["gestorasTargets"] as const,
        byMonth: (month: string) => [...queryKeys.gestorasTargets.all, month] as const,
    },
};

// ─────────────────────────────────────────────
// useTickets — Hook principal para lista/kanban
// ─────────────────────────────────────────────
export function useTickets() {
    return useQuery({
        queryKey: queryKeys.tickets.summary(),
        queryFn: async () => {
            const data = await ticketsAPI.getSummaryAll();
            return (data || []).map(normalizeTicket).filter(Boolean);
        },
        staleTime: 1000 * 60, // 60s - Tickets no cambian tan rápido para vista general
        gcTime: 1000 * 60 * 5, // 5 min
    });
}

// ─────────────────────────────────────────────
// useTicketDetail — Hook para cargar un ticket completo (con metadata)
// ─────────────────────────────────────────────
export function useTicketDetail(ticketId: string | null) {
    return useQuery({
        queryKey: queryKeys.tickets.detail(ticketId || ""),
        queryFn: async () => {
            if (!ticketId) return null;
            const data = await ticketsAPI.getById(ticketId);
            return normalizeTicket(data);
        },
        enabled: !!ticketId,
        staleTime: 1000 * 30, // Detalle del ticket 30s
        gcTime: 1000 * 60 * 10, // Mantener en memoria 10 min
    });
}

// ─────────────────────────────────────────────
// usePaymentTickets — Hook para módulo de pagos (con metadata)
// ─────────────────────────────────────────────
export function usePaymentTickets() {
    return useQuery({
        queryKey: queryKeys.tickets.payments(),
        queryFn: async () => {
            const data = await ticketsAPI.getForPayments();
            return data || [];
        },
        staleTime: 1000 * 60, // 60s - Módulo de tesorería
    });
}

// ─────────────────────────────────────────────
// useClients — Hook para clientes
// ─────────────────────────────────────────────
export function useClients() {
    return useQuery({
        queryKey: queryKeys.clients.all,
        queryFn: async () => {
            const data = await clientsAPI.getAll();
            return data || [];
        },
        staleTime: 1000 * 60 * 5, // 5 min - Clientes son estáticos
    });
}

// ─────────────────────────────────────────────
// useTechnicians — Hook para técnicos
// ─────────────────────────────────────────────
export function useTechnicians() {
    return useQuery({
        queryKey: queryKeys.technicians.all,
        queryFn: async () => {
            const data = await techniciansAPI.getAll();
            return data || [];
        },
        staleTime: 1000 * 60 * 5, // 5 min - Técnicos son estáticos
    });
}

// ─────────────────────────────────────────────
// useGestoras — Hook para gestoras
// ─────────────────────────────────────────────
export function useGestoras() {
    return useQuery({
        queryKey: queryKeys.gestoras.all,
        queryFn: async () => {
            const data = await gestorasAPI.getAll();
            return data || [];
        },
        staleTime: 1000 * 60 * 10, // 10 min - Gestoras casi nunca cambian
    });
}

// ─────────────────────────────────────────────
// useGestorasTargets — Hook para metas y bonos
// ─────────────────────────────────────────────
export function useGestorasTargets() {
    return useQuery({
        queryKey: queryKeys.gestorasTargets.all,
        queryFn: async () => {
            const data = await gestorasTargetsAPI.getAll();
            return data || [];
        },
        staleTime: 1000 * 60 * 5, // 5 min
    });
}

// ─────────────────────────────────────────────
// useUpdateTicketStatus — Mutación OPTIMISTA para cambio de estado
// ─────────────────────────────────────────────
export function useUpdateTicketStatus() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({
            ticketId,
            updates,
        }: {
            ticketId: string;
            updates: Record<string, any>;
        }) => {
            const result = await ticketsAPI.update(ticketId, updates);
            return normalizeTicket(result);
        },
        // ── OPTIMISTIC UPDATE ──
        onMutate: async ({ ticketId, updates }) => {
            // 1. Cancelar queries en curso para evitar sobreescrituras
            await queryClient.cancelQueries({ queryKey: queryKeys.tickets.all });

            // 2. Snapshot del caché actual (para posible rollback)
            const previousTickets = queryClient.getQueryData(queryKeys.tickets.summary());

            // 3. Actualizar caché local inmediatamente (UI instantánea)
            queryClient.setQueryData(
                queryKeys.tickets.summary(),
                (old: any[] | undefined) => {
                    if (!old) return old;
                    return old.map((t) => {
                        if (t.id !== ticketId) return t;
                        const newStatusId = updates.status_id || t.status_id;
                        return {
                            ...t,
                            ...updates,
                            status_id: newStatusId,
                            estadoId: normalizeStateId(newStatusId),
                        };
                    });
                }
            );

            return { previousTickets };
        },
        // ── ROLLBACK en caso de error ──
        onError: (_err, _vars, context) => {
            if (context?.previousTickets) {
                queryClient.setQueryData(
                    queryKeys.tickets.summary(),
                    context.previousTickets
                );
            }
            console.error("[useUpdateTicketStatus] Error, rolled back:", _err);
        },
        // ── RECONCILIACIÓN: siempre refetch desde DB para garantizar consistencia ──
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.tickets.all });
        },
    });
}

// ─────────────────────────────────────────────
// useUpdateTicket — Mutación genérica con optimismo parcial
// ─────────────────────────────────────────────
export function useUpdateTicket() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({
            ticketId,
            updates,
        }: {
            ticketId: string;
            updates: Record<string, any>;
        }) => {
            const result = await ticketsAPI.update(ticketId, updates);
            return normalizeTicket(result);
        },
        onMutate: async ({ ticketId, updates }) => {
            await queryClient.cancelQueries({ queryKey: queryKeys.tickets.all });
            const previousTickets = queryClient.getQueryData(queryKeys.tickets.summary());
            queryClient.setQueryData(
                queryKeys.tickets.summary(),
                (old: any[] | undefined) => {
                    if (!old) return old;
                    return old.map((t) =>
                        t.id === ticketId ? { ...t, ...updates } : t
                    );
                }
            );
            return { previousTickets };
        },
        onError: (_err, _vars, context) => {
            if (context?.previousTickets) {
                queryClient.setQueryData(
                    queryKeys.tickets.summary(),
                    context.previousTickets
                );
            }
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.tickets.all });
        },
    });
}

// ─────────────────────────────────────────────
// useCreateTicket — Mutación para crear ticket
// ─────────────────────────────────────────────
export function useCreateTicket() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (data: Record<string, any>) => {
            const result = await ticketsAPI.create(data);
            return normalizeTicket(result);
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.tickets.all });
        },
    });
}

// ─────────────────────────────────────────────
// useDeleteTicket — Mutación para eliminar ticket
// ─────────────────────────────────────────────
export function useDeleteTicket() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (ticketId: string) => {
            await ticketsAPI.delete(ticketId);
            return ticketId;
        },
        onMutate: async (ticketId) => {
            await queryClient.cancelQueries({ queryKey: queryKeys.tickets.all });
            const previousTickets = queryClient.getQueryData(queryKeys.tickets.summary());
            queryClient.setQueryData(
                queryKeys.tickets.summary(),
                (old: any[] | undefined) =>
                    old ? old.filter((t) => t.id !== ticketId) : old
            );
            return { previousTickets };
        },
        onError: (_err, _vars, context) => {
            if (context?.previousTickets) {
                queryClient.setQueryData(
                    queryKeys.tickets.summary(),
                    context.previousTickets
                );
            }
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.tickets.all });
        },
    });
}

// ─────────────────────────────────────────────
// PREFETCHING HELPERS
// ─────────────────────────────────────────────

/** Precarga tickets en caché silenciosamente (ideal para tabs adyacentes) */
export function prefetchTickets(queryClient: QueryClient) {
    return queryClient.prefetchQuery({
        queryKey: queryKeys.tickets.summary(),
        queryFn: async () => {
            const data = await ticketsAPI.getSummaryAll();
            return (data || []).map(normalizeTicket).filter(Boolean);
        },
    });
}

/** Precarga un ticket individual en detalle */
export function prefetchTicketDetail(queryClient: QueryClient, ticketId: string) {
    return queryClient.prefetchQuery({
        queryKey: queryKeys.tickets.detail(ticketId),
        queryFn: async () => {
            const data = await ticketsAPI.getById(ticketId);
            return normalizeTicket(data);
        },
    });
}

/** Precarga clientes en caché */
export function prefetchClients(queryClient: QueryClient) {
    return queryClient.prefetchQuery({
        queryKey: queryKeys.clients.all,
        queryFn: async () => {
            const data = await clientsAPI.getAll();
            return data || [];
        },
    });
}

/** Precarga técnicos en caché */
export function prefetchTechnicians(queryClient: QueryClient) {
    return queryClient.prefetchQuery({
        queryKey: queryKeys.technicians.all,
        queryFn: async () => {
            const data = await techniciansAPI.getAll();
            return data || [];
        },
    });
}

/** Precarga gestoras en caché */
export function prefetchGestoras(queryClient: QueryClient) {
    return queryClient.prefetchQuery({
        queryKey: queryKeys.gestoras.all,
        queryFn: async () => {
            const data = await gestorasAPI.getAll();
            return data || [];
        },
    });
}

/** Precarga metas en caché */
export function prefetchGestorasTargets(queryClient: QueryClient) {
    return queryClient.prefetchQuery({
        queryKey: queryKeys.gestorasTargets.all,
        queryFn: async () => {
            const data = await gestorasTargetsAPI.getAll();
            return data || [];
        },
    });
}
