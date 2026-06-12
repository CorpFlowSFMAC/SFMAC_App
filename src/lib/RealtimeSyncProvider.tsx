"use client";

import React, { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "./supabase";
import { queryKeys, normalizeTicket } from "./useQueryHooks";

export function RealtimeSyncProvider({ children }: { children: React.ReactNode }) {
    const queryClient = useQueryClient();

    useEffect(() => {
        const channel = supabase.channel('global-sync-channel');

        // ⚡ FIX: En lugar de invalidar queries (que causa re-fetch y potencial loop infinito),
        // usamos setQueryData para actualizar la caché directamente sin disparar llamadas de red.
        // Esto evita el bucle entre ticket-costs y vw_tickets_strategic que ocurre cuando
        // invalidateQueries triggering refetch → state change → invalidateQueries again

        // Escuchar cambios en tickets
        channel.on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'tickets' },
            (payload) => {
                console.log('[Realtime] Cambio detectado en tickets:', payload);
                // Usar setQueryData con merge en lugar de invalidateQueries
                queryClient.setQueryData(
                    queryKeys.tickets.summary(),
                    (old: any[] | undefined) => {
                        if (!old) return old;
                        const newTicket = payload.new as any;
                        const oldTicket = payload.old as any;

                        if (payload.eventType === 'INSERT' && newTicket) {
                            // Para INSERT, añadir el nuevo ticket normalizado si no existe
                            const exists = old.some(t => t.id === newTicket.id);
                            if (!exists) {
                                return [normalizeTicket(newTicket), ...old];
                            }
                        } else if (payload.eventType === 'UPDATE' && newTicket) {
                            // Para UPDATE, hacer merge profundo
                            return old.map(t =>
                                t.id === newTicket.id ? normalizeTicket({ ...t, ...newTicket }) : t
                            );
                        } else if (payload.eventType === 'DELETE' && oldTicket) {
                            // Para DELETE, filtrar el ticket eliminado
                            return old.filter(t => t.id !== oldTicket.id);
                        }
                        return old;
                    }
                );
            }
        );

        // Escuchar cambios en payments (ticket_costs)
        channel.on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'ticket_costs' },
            (payload) => {
                console.log('[Realtime] Cambio detectado en ticket_costs:', payload);
                // Invalidar SOLO la query de payments, no todas las de tickets
                // Esto evita el bucle infinito entre ticket-costs y strategic views
                queryClient.invalidateQueries({ queryKey: queryKeys.tickets.payments() });
            }
        );

        channel.subscribe((status) => {
            if (status === 'SUBSCRIBED') {
                console.log('[Realtime] Conectado exitosamente a Supabase Realtime');
            }
        });

        return () => {
            supabase.removeChannel(channel);
        };
    }, [queryClient]);

    return <>{children}</>;
}
