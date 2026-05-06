// TICKET CACHE - Offline-First (COMPRESSED)

import { compressToUTF16, decompressFromUTF16 } from 'lz-string';

const TICKETS_CACHE_KEY = 'sfmac_tickets_cache';
const TICKETS_CACHE_EXPIRY = 5 * 60 * 1000;
const MAX_CACHED_TICKETS = 50;

export const ticketsCache = {
    set: (tickets: any[]) => {
        try {
            const limitedTickets = tickets.slice(0, MAX_CACHED_TICKETS);
            const cache = { data: limitedTickets, timestamp: Date.now() };
            const compressed = compressToUTF16(JSON.stringify(cache));
            localStorage.setItem(TICKETS_CACHE_KEY, compressed);
        } catch { /* silent */ }
    },
    
    get: (): any[] | null => {
        try {
            const stored = localStorage.getItem(TICKETS_CACHE_KEY);
            if (!stored) return null;
            const cache = JSON.parse(decompressFromUTF16(stored));
            if (Date.now() - cache.timestamp > TICKETS_CACHE_EXPIRY) return null;
            return cache.data;
        } catch { return null; }
    },
    
    getForced: (): any[] | null => {
        try {
            const stored = localStorage.getItem(TICKETS_CACHE_KEY);
            if (!stored) return null;
            return JSON.parse(decompressFromUTF16(stored)).data;
        } catch { return null; }
    },
    
    invalidate: () => localStorage.removeItem(TICKETS_CACHE_KEY),
    
    hasCache: (): boolean => localStorage.getItem(TICKETS_CACHE_KEY) !== null
};
