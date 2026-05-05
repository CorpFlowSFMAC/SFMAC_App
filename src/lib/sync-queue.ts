// 🔄 SYNC QUEUE - Offline-First para Técnicos

const SYNC_QUEUE_KEY = 'sfmac_tech_sync_queue';
const SYNC_RETRY_INTERVAL = 30000;

export interface PendingTech {
    id: string;
    action: 'create' | 'update' | 'delete';
    data: any;
    status: 'pending' | 'syncing' | 'failed';
    createdAt: number;
    lastAttempt?: number;
    attempts: number;
    error?: string;
}

// Encrypt data (simple encoding)
const encodeData = (data: string): string => btoa(unescape(encodeURIComponent(data)));
const decodeData = (encoded: string): string => decodeURIComponent(atob(encoded));

// Get queue from localStorage
const getAll = (): PendingTech[] => {
    try {
        const stored = localStorage.getItem(SYNC_QUEUE_KEY);
        return stored ? JSON.parse(stored) : [];
    } catch { return []; }
};

// Save queue to localStorage
const saveAll = (queue: PendingTech[]) => {
    localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(queue));
};

export const syncQueue = {
    // Add operation to queue
    add: (operation: { action: 'create' | 'update' | 'delete'; data: any }): string => {
        const queue = getAll();
        const id = 'tech_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        
        const pending: PendingTech = {
            ...operation,
            id,
            createdAt: Date.now(),
            attempts: 0,
            status: 'pending'
        };
        
        // Encrypt sensitive data
        const sensitive = ['account_number', 'cci', 'yape_number', 'plin_number', 'numeroCuenta'];
        pending.data = Object.assign({}, pending.data);
        sensitive.forEach((f: string) => {
            if (pending.data[f]) pending.data[f] = encodeData(String(pending.data[f]));
        });
        
        queue.push(pending);
        saveAll(queue);
        console.log('[SyncQueue] Added:', id);
        return id;
    },
    
    getAll: getAll,
    
    getPending: (): PendingTech[] => {
        return getAll().filter(op => op.status === 'pending' || op.status === 'failed');
    },
    
    updateStatus: (id: string, status: PendingTech['status'], error?: string) => {
        const queue = getAll();
        const idx = queue.findIndex(op => op.id === id);
        if (idx >= 0) {
            queue[idx].status = status;
            queue[idx].lastAttempt = Date.now();
            if (error) queue[idx].error = error;
            if (status === 'failed') queue[idx].attempts += 1;
            saveAll(queue);
        }
    },
    
    remove: (id: string) => {
        saveAll(getAll().filter(op => op.id !== id));
    },
    
    clearCompleted: () => {
        saveAll(getAll().filter(op => op.status !== 'syncing'));
    },
    
    decrypt: (data: any): any => {
        const sensitive = ['account_number', 'cci', 'yape_number', 'plin_number', 'numeroCuenta'];
        const decrypted = Object.assign({}, data);
        sensitive.forEach((f: string) => {
            if (decrypted[f] && typeof decrypted[f] === 'string') {
                try { decrypted[f] = decodeData(decrypted[f]); } catch { /* ignore */ }
            }
        });
        return decrypted;
    }
};

// Background sync service
let syncInterval: any = null;

export const startBackgroundSync = (
    onSync: (op: PendingTech) => Promise<boolean>,
    onConflict?: (op: PendingTech, error: string) => void
) => {
    if (syncInterval) return;
    
    const sync = async () => {
        const pending = syncQueue.getPending();
        if (pending.length === 0) return;
        
        for (const op of pending) {
            if (op.attempts >= 5) continue;
            if (op.lastAttempt && Date.now() - op.lastAttempt < SYNC_RETRY_INTERVAL) continue;
            
            syncQueue.updateStatus(op.id, 'syncing');
            const data = syncQueue.decrypt(op.data);
            
            try {
                const success = await onSync(Object.assign({}, op, { data }));
                if (success) syncQueue.remove(op.id);
                else syncQueue.updateStatus(op.id, 'failed', 'Sync failed');
            } catch (error: any) {
                const msg = error?.message || 'Unknown error';
                if (msg.includes('duplicate') && onConflict) {
                    onConflict(op, 'Documento duplicado: ' + data.document_number);
                }
                syncQueue.updateStatus(op.id, msg.includes('network') ? 'pending' : 'failed', msg);
            }
        }
    };
    
    syncInterval = setInterval(sync, SYNC_RETRY_INTERVAL);
    sync();
};

export const stopBackgroundSync = () => {
    if (syncInterval) { clearInterval(syncInterval); syncInterval = null; }
};

export const getTechStatusBadge = (tech: any, pending?: PendingTech[]) => {
    const p = pending?.find(op => op.data?.document_number === tech.document_number);
    if (p?.status === 'syncing') return { label: 'Sincronizando', color: '#F59E0B', icon: '🔄' };
    if (p?.status === 'failed') return { label: 'Error', color: '#EF4444', icon: '⚠️' };
    if (tech.estado === 'ACTIVO' || tech.status === 'active') return { label: 'Activo', color: '#10B981', icon: '✅' };
    return { label: tech.estado || 'Activo', color: '#64748B', icon: '⏳' };
};