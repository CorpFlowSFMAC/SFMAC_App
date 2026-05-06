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
            console.log('[TicketsCache] Saved', tickets.length, 'tickets');
        } catch (error) {
            console.error('[TicketsCache] Error saving:', error);
        }
    },
    
    // Obtener tickets del cache
    get: (): any[] | null => {
        try {
            const stored = localStorage.getItem(TICKETS_CACHE_KEY);
            if (!stored) return null;
            
            const cache = JSON.parse(stored);
            
            // Verificar si el cache está vigente
            if (Date.now() - cache.timestamp > TICKETS_CACHE_EXPIRY) {
                console.log('[TicketsCache] Cache expired');
                return null;
            }
            
            console.log('[TicketsCache] Cache hit:', cache.data.length, 'tickets');
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
    
    // Invalidar cache
    invalidate: () => {
        localStorage.removeItem(TICKETS_CACHE_KEY);
    },
    
    // Verificar si hay cache
    hasCache: (): boolean => {
        return localStorage.getItem(TICKETS_CACHE_KEY) !== null;
    }
};

// Hook para usar cache en componente
export function useTicketsWithCache(tickets: any[], setTickets: (t: any[]) => void) {
    const cache = ticketsCache.get();
    
    // Usar cache si hay datos
    if (cache && cache.length > 0 && (!tickets || tickets.length === 0)) {
        console.log('[useTicketsWithCache] Using cached tickets');
        setTickets(cache);
    }
    
    // Actualizar cache cuando cambian los tickets
    if (tickets && tickets.length > 0) {
        ticketsCache.set(tickets);
    }
}