"use client";

import React, { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "./supabase";

export function RealtimeSyncProvider({ children }: { children: React.ReactNode }) {
    const queryClient = useQueryClient();

    useEffect(() => {
        const channel = supabase.channel('global-sync-channel');

        // Escuchar cambios en tickets
        channel.on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'tickets' },
            (payload) => {
                console.log('[Realtime] Cambio detectado en tickets:', payload);
                queryClient.invalidateQueries({ queryKey: ['tickets'] });
            }
        );

        // Escuchar cambios en payments
        channel.on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'payments' },
            (payload) => {
                console.log('[Realtime] Cambio detectado en payments:', payload);
                queryClient.invalidateQueries({ queryKey: ['payments'] });
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
