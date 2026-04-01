"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { perfilesAPI } from "@/lib/profiles-api";
import { Loader } from "lucide-react";

/**
 * /dashboard — Gateway de Autenticación + RBAC
 * 
 * Flujo actualizado con perfiles:
 * 1. Supabase procesa el hash fragment de OAuth
 * 2. Se obtiene la sesión autenticada
 * 3. Se consulta la tabla `perfiles` para obtener el rol RBAC
 * 4. Se setea la cookie 'userRole' basada en el rol del perfil
 * 5. Se redirige según el rol:
 *    - ADMIN → /dashboard/admin
 *    - GESTORA → /dashboard/gestor  
 *    - SIN_ACCESO → /dashboard/sin-acceso
 */
export default function DashboardGateway() {
    const router = useRouter();
    const [status, setStatus] = useState("Verificando sesión...");
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        async function handleAuth() {
            try {
                setStatus("Procesando autenticación...");

                // Esperar a que Supabase procese el hash fragment
                await new Promise(resolve => setTimeout(resolve, 500));

                // Obtener la sesión actual
                const { data: { session }, error: sessionError } = await supabase.auth.getSession();

                if (sessionError) {
                    console.error("[Dashboard Gateway] Session error:", sessionError);
                    setError("Error al verificar la sesión: " + sessionError.message);
                    setTimeout(() => router.push("/login"), 2000);
                    return;
                }

                if (!session?.user) {
                    // No hay sesión — intentar escuchar el evento de auth
                    setStatus("Esperando confirmación de Microsoft...");

                    const { data: { subscription } } = supabase.auth.onAuthStateChange(
                        async (event, newSession) => {
                            console.log("[Dashboard Gateway] Auth event:", event);

                            if (event === 'SIGNED_IN' && newSession?.user) {
                                subscription.unsubscribe();
                                await processUserSession(newSession.user);
                            }
                        }
                    );

                    // Timeout de seguridad
                    setTimeout(async () => {
                        subscription.unsubscribe();
                        const { data: { session: lastCheck } } = await supabase.auth.getSession();
                        if (lastCheck?.user) {
                            await processUserSession(lastCheck.user);
                        } else {
                            setError("No se pudo establecer la sesión. Redirigiendo al login...");
                            setTimeout(() => router.push("/login"), 1500);
                        }
                    }, 8000);

                    return;
                }

                // Sesión encontrada — procesar
                await processUserSession(session.user);

            } catch (err: any) {
                console.error("[Dashboard Gateway] Error:", err);
                setError("Error inesperado: " + (err.message || "Intenta de nuevo"));
                setTimeout(() => router.push("/login"), 2000);
            }
        }

        async function processUserSession(user: any) {
            setStatus(`¡Bienvenido/a, ${user.user_metadata?.full_name || user.email}!`);

            // ── RBAC: Consultar perfil desde la tabla perfiles ──
            setStatus("Verificando permisos de acceso...");
            let perfil = await perfilesAPI.getById(user.id);

            // Si no existe perfil (caso raro, el trigger debería haberlo creado),
            // esperar un momento y reintentar
            if (!perfil) {
                console.log("[Dashboard Gateway] Profile not found, waiting for trigger...");
                await new Promise(resolve => setTimeout(resolve, 1500));
                perfil = await perfilesAPI.getById(user.id);
            }

            // Determinar el rol desde el perfil RBAC
            const rbacRole = perfil?.rol || 'SIN_ACCESO';
            const legacyRole = perfilesAPI.toLegacyRole(perfil);

            console.log("[Dashboard Gateway] User:", user.email, "RBAC Role:", rbacRole, "Legacy Role:", legacyRole);

            // Establecer la cookie y localStorage para el middleware
            const finalName = user.user_metadata?.full_name || perfil?.nombre_completo || user.email || "";
            const avatarUrl = user.user_metadata?.avatar_url || user.user_metadata?.picture || `https://ui-avatars.com/api/?name=${encodeURIComponent(finalName)}&background=f97316&color=fff&bold=true`;
            
            document.cookie = `userRole=${legacyRole}; path=/; max-age=86400; SameSite=Lax`;
            localStorage.setItem("userRole", legacyRole);
            localStorage.setItem("userEmail", user.email || "");
            localStorage.setItem("userName", finalName);
            localStorage.setItem("userAvatar", avatarUrl);
            localStorage.setItem("rbacRole", rbacRole);

            // Pequeña pausa para el mensaje de bienvenida
            await new Promise(resolve => setTimeout(resolve, 800));

            // Redirigir según el rol RBAC
            if (rbacRole === 'SIN_ACCESO') {
                setStatus("Tu cuenta está pendiente de asignación de rol...");
                router.push('/dashboard/sin-acceso');
            } else if (rbacRole === 'ADMIN') {
                setStatus("Redirigiendo a Panel Admin...");
                router.push('/dashboard/admin');
            } else {
                // GESTORA, ESPECTADOR → gestor dashboard
                setStatus("Redirigiendo a Panel Gestora...");
                router.push('/dashboard/gestor');
            }
        }

        handleAuth();
    }, [router]);

    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '100vh',
            background: 'linear-gradient(135deg, #0a0a1a 0%, #1a1a2e 50%, #16213e 100%)',
            color: '#fff',
            fontFamily: "'Inter', 'Segoe UI', sans-serif",
            gap: '1.5rem',
        }}>
            {/* Logo */}
            <img
                src="/logo-final.png"
                alt="SINFIMAC"
                style={{ width: 80, height: 80, objectFit: 'contain', opacity: 0.9 }}
            />

            {/* Spinner */}
            {!error && (
                <div style={{
                    animation: 'spin 1.5s linear infinite',
                }}>
                    <Loader size={36} color="#8B5CF6" />
                </div>
            )}

            {/* Status message */}
            <p style={{
                fontSize: '1.1rem',
                fontWeight: 600,
                color: error ? '#EF4444' : 'rgba(255,255,255,0.8)',
                textAlign: 'center',
                maxWidth: 400,
            }}>
                {error || status}
            </p>

            {/* Subtle hint */}
            {!error && (
                <p style={{
                    fontSize: '0.75rem',
                    color: 'rgba(255,255,255,0.3)',
                    marginTop: '1rem',
                }}>
                    SINFIMAC Ecosystem
                </p>
            )}

            <style>{`
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    );
}
