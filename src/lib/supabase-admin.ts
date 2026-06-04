/**
 * supabase-admin.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Cliente Supabase con sesión PERMANENTE para usuarios con rol "admin".
 * Diferencias respecto al cliente anónimo estándar (supabase.ts):
 *   - persistSession: true  → almacena el token en localStorage de forma explícita
 *   - autoRefreshToken: true → renueva el JWT silenciosamente antes de que expire
 *   - storageKey personalizado → evita colisión con sesiones normales
 *
 * USO: Importar SÓLO en componentes/páginas donde el usuario sea admin.
 * Para todo lo demás usar el cliente estándar de supabase.ts.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { createClient } from '@supabase/supabase-js';
import { getSupabaseAnonKey, getSupabaseUrl } from './supabase-config';

const supabaseUrl = getSupabaseUrl();
const supabaseAnonKey = getSupabaseAnonKey();

/**
 * Cliente con sesión persistente e infinite-refresh.
 * Solo instanciar en entornos de navegador (no SSR).
 */
export const supabaseAdmin = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
        // Persiste la sesión en localStorage; no la elimina al cerrar la pestaña
        persistSession: true,
        // Renueva el JWT de Supabase automáticamente en segundo plano
        autoRefreshToken: true,
        // Clave de almacenamiento exclusiva para la sesión de administrador
        storageKey: 'sb_admin_session',
        // Detecta el token de hash en la URL (necesario para magic links / OAuth)
        detectSessionInUrl: true,
    },
});

/**
 * Activa el listener de refresh automático para la sesión de admin.
 * Llamar UNA SOLA VEZ en el layout raíz (AdminLayout) cuando el rol sea admin.
 *
 * El listener llama a getSession() cada 5 minutos para mantener el JWT vivo
 * aunque el navegador permanezca en segundo plano.
 *
 * Devuelve una función de cleanup para usar en el return de useEffect.
 */
export function startAdminSessionKeepAlive(): () => void {
    // Ping inmediato para validar sesión al montar
    supabaseAdmin.auth.getSession().catch(() => {
        // Silencioso — no bloquear el render
    });

    // Intervalo de refresco cada 4 minutos (el JWT de Supabase dura 1 h)
    const INTERVAL_MS = 4 * 60 * 1000; // 4 min
    const intervalId = setInterval(async () => {
        try {
            const { data: { session }, error } = await supabaseAdmin.auth.getSession();
            if (error || !session) {
                // Intentar renovar desde el refresh token almacenado
                await supabaseAdmin.auth.refreshSession();
            }
        } catch {
            // Silencioso — el tab puede estar en modo inactivo
        }
    }, INTERVAL_MS);

    // Listener de visibilidad del documento: refrescar al volver al tab
    const handleVisibilityChange = () => {
        if (document.visibilityState === 'visible') {
            supabaseAdmin.auth.getSession().catch(() => {});
        }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
        clearInterval(intervalId);
        document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
}
