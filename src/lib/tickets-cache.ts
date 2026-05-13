// ═════════════════════════════════════════════════════════════
// 🎫 TICKET CACHE - Offline-First para Tickets
// Guardar tickets en localStorage para scroll instantáneo
// ═════════════════════════════════════════════════════════════

const TICKETS_CACHE_KEY = 'sfmac_tickets_cache';
const TICKETS_CACHE_EXPIRY = 5 * 60 * 1000; // 5 minutos

export const ticketsCache = {
    // Guardar tickets en cache
    set: (tickets: any[]) => {
        try {
            const cache = {
                data: tickets,
                timestamp: Date.now()
            };
            localStorage.setItem(TICKETS_CACHE_KEY, JSON.stringify(cache));
        } catch (_) { /* silencio en producción */ }
    },

    // Obtener tickets del cache
    get: (): any[] | null => {
        try {
            const stored = localStorage.getItem(TICKETS_CACHE_KEY);
            if (!stored) return null;

            const cache = JSON.parse(stored);

            // Verificar si el cache está vigente
            if (Date.now() - cache.timestamp > TICKETS_CACHE_EXPIRY) {
                return null;
            }

            return cache.data;
        } catch {
            return null;
        }
    },

    // Obtener tickets sin importar expiry (para offline)
    getForced: (): any[] | null => {
        try {
            const stored = localStorage.getItem(TICKETS_CACHE_KEY);
            if (!stored) return null;
            return JSON.parse(stored).data;
        } catch {
            return null;
        }
    },

    // Invalidar cache completo
    invalidate: () => {
        try { localStorage.removeItem(TICKETS_CACHE_KEY); } catch (_) {}
    },

    // 🆕 Eliminación quirúrgica: remover un ticket específico del cache sin borrar los demás
    remove: (ticketId: string) => {
        try {
            const stored = localStorage.getItem(TICKETS_CACHE_KEY);
            if (!stored) return;
            const cache = JSON.parse(stored);
            if (!Array.isArray(cache.data)) return;
            cache.data = cache.data.filter((t: any) => t.id !== ticketId);
            localStorage.setItem(TICKETS_CACHE_KEY, JSON.stringify(cache));
        } catch (_) {}
    },

    // Verificar si hay cache
    hasCache: (): boolean => {
        try { return localStorage.getItem(TICKETS_CACHE_KEY) !== null; } catch { return false; }
    }
};

// Hook para usar cache en componente
export function useTicketsWithCache(tickets: any[], setTickets: (t: any[]) => void) {
    const cache = ticketsCache.get();

    // Usar cache si hay datos
    if (cache && cache.length > 0 && (!tickets || tickets.length === 0)) {
        setTickets(cache);
    }

    // Actualizar cache cuando cambian los tickets
    if (tickets && tickets.length > 0) {
        ticketsCache.set(tickets);
    }
}