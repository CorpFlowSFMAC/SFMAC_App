"use client";

import React, { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";

export function QueryProvider({ children }: { children: React.ReactNode }) {
    // useState garantiza un solo QueryClient por ciclo de vida del componente
    const [queryClient] = useState(
        () =>
            new QueryClient({
                defaultOptions: {
                    queries: {
                        // Datos se consideran frescos por 5 minutos → no refetch innecesarios
                        staleTime: 1000 * 60 * 5,
                        // Mantener en caché 30 minutos después de que nadie los usa
                        gcTime: 1000 * 60 * 30,
                        // Desactivar refetch automático al volver a la pestaña para estabilidad
                        refetchOnWindowFocus: false,
                        // Si falla, reintentar 1 vez (no 3)
                        retry: 1,
                    },
                    mutations: {
                        retry: 0,
                    },
                },
            })
    );

    return (
        <QueryClientProvider client={queryClient}>
            {children}
            <ReactQueryDevtools initialIsOpen={false} />
        </QueryClientProvider>
    );
}
