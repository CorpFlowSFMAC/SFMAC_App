"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function AuthCallbackPage() {
    const router = useRouter();
    const [status, setStatus] = useState("Procesando credenciales de Microsoft...");

    useEffect(() => {
        let isMounted = true;
        let authEventListened = false;

        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            async (event, session) => {
                console.log("[Auth Callback] Auth event:", event);

                if (['SIGNED_IN', 'INITIAL_SESSION', 'TOKEN_REFRESHED'].includes(event) && session?.user && !authEventListened) {
                    authEventListened = true;
                    if (isMounted) setStatus("Autenticación exitosa. Redirigiendo al sistema...");
                    
                    // Pequeña pausa para asegurar guardado local
                    setTimeout(() => {
                        router.push('/dashboard'); // Ahora enviamos al Dashboard Gateway para asignar cookies RBAC
                    }, 500);
                }
            }
        );

        // Fallback porsia el listener no dispara o el auth-token falló
        setTimeout(async () => {
            if (authEventListened || !isMounted) return;
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.user) {
                authEventListened = true;
                subscription.unsubscribe();
                setStatus("Redirigiendo...");
                router.push('/dashboard');
            } else {
                subscription.unsubscribe();
                setStatus("No se logró recuperar la sesión. Verifica tu conexión e intenta de nuevo.");
                setTimeout(() => router.push('/login'), 4000);
            }
        }, 5000);

        return () => {
            isMounted = false;
            subscription.unsubscribe();
        };
    }, [router]);

    return (
        <div style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            height: "100vh",
            backgroundColor: "#111827",
            color: "#fff",
            fontFamily: "sans-serif"
        }}>
            {/* Logo SINFIMAC animado */}
            <div style={{ position: "relative", width: "120px", height: "120px", marginBottom: "2rem" }}>
                <div style={{
                    position: "absolute",
                    inset: 0,
                    border: "3px solid #f97316",
                    borderTopColor: "transparent",
                    borderRadius: "50%",
                    animation: "spin 1.5s linear infinite"
                }} />
                <div style={{
                    position: "absolute",
                    inset: "10px",
                    border: "3px solid #3b82f6",
                    borderTopColor: "transparent",
                    borderBottomColor: "transparent",
                    borderRadius: "50%",
                    animation: "spin 2s linear infinite reverse"
                }} />
            </div>

            <h2 style={{ fontSize: "1.2rem", fontWeight: "600", letterSpacing: "1px" }}>{status}</h2>
            
            <style jsx>{`
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    );
}
