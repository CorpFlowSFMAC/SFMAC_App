"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Loader } from "lucide-react";

/**
 * /dashboard — Gateway de Autenticación
 * 
 * Esta página actúa como punto de entrada después del login OAuth (Microsoft Azure AD).
 * Supabase redirige aquí con un hash fragment (#access_token=...).
 * 
 * Flujo:
 * 1. Supabase client-side SDK procesa automáticamente el hash fragment
 * 2. getSession() devuelve la sesión con el usuario autenticado  
 * 3. Se extrae el rol del user_metadata
 * 4. Se setea la cookie 'userRole' para el middleware
 * 5. Se redirige al dashboard correcto (admin o gestor)
 */
export default function DashboardGateway() {
    const router = useRouter();
    const [status, setStatus] = useState("Verificando sesión...");
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        async function handleAuth() {
            try {
                setStatus("Procesando autenticación...");

                // Esperar un momento para que Supabase procese el hash fragment
                // El SDK detecta #access_token=... y lo intercambia automáticamente
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

                    // Timeout de seguridad — si después de 8 segundos no hay sesión, ir a login
                    setTimeout(async () => {
                        subscription.unsubscribe();
                        // Último intento antes de rendirse
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

            // Determinar el rol del usuario
            const role = user.user_metadata?.role || 'gestor';
            console.log("[Dashboard Gateway] User:", user.email, "Role:", role);

            // Establecer la cookie para el middleware
            document.cookie = `userRole=${role}; path=/; max-age=86400; SameSite=Lax`;
            localStorage.setItem("userRole", role);
            localStorage.setItem("userEmail", user.email || "");
            localStorage.setItem("userName", user.user_metadata?.full_name || user.email || "");

            // Pequeña pausa para que se aprecie el mensaje de bienvenida
            await new Promise(resolve => setTimeout(resolve, 800));

            // Redirigir al dashboard correcto
            const destination = role === 'admin' ? '/dashboard/admin' : '/dashboard/gestor';
            setStatus(`Redirigiendo a ${role === 'admin' ? 'Panel Admin' : 'Panel Gestora'}...`);

            router.push(destination);
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
