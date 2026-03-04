"use client";

import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { LogOut, ShieldAlert, RefreshCw } from "lucide-react";
import { useState } from "react";

/**
 * /dashboard/sin-acceso — Waiting Room
 * 
 * Shown to users whose profile has rol = 'SIN_ACCESO'.
 * They have authenticated successfully but an Admin hasn't assigned their role yet.
 */
export default function SinAccesoPage() {
    const router = useRouter();
    const [checking, setChecking] = useState(false);

    const handleRetry = async () => {
        setChecking(true);
        // Force re-check by navigating to the gateway which will re-evaluate the role
        router.push("/dashboard");
    };

    const handleLogout = async () => {
        await supabase.auth.signOut();
        document.cookie = "userRole=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC;";
        localStorage.removeItem("userRole");
        localStorage.removeItem("userEmail");
        localStorage.removeItem("userName");
        router.push("/login");
    };

    return (
        <div style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            minHeight: "100vh",
            background: "linear-gradient(135deg, #0a0a1a 0%, #1a1a2e 50%, #16213e 100%)",
            color: "#fff",
            fontFamily: "'Inter', 'Segoe UI', sans-serif",
            padding: "2rem",
        }}>
            {/* Logo */}
            <img
                src="/logo-final.png"
                alt="SINFIMAC"
                style={{ width: 70, height: 70, objectFit: "contain", opacity: 0.8, marginBottom: "1.5rem" }}
            />

            {/* Icon */}
            <div style={{
                width: 80,
                height: 80,
                background: "rgba(245, 158, 11, 0.15)",
                border: "2px solid rgba(245, 158, 11, 0.3)",
                borderRadius: 20,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: "1.5rem",
            }}>
                <ShieldAlert size={36} color="#F59E0B" />
            </div>

            {/* Title */}
            <h1 style={{
                fontSize: "1.6rem",
                fontWeight: 800,
                marginBottom: "0.5rem",
                textAlign: "center",
                background: "linear-gradient(135deg, #fff 30%, rgba(245, 158, 11, 0.8))",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
            }}>
                Esperando Asignación de Rol
            </h1>

            {/* Description */}
            <p style={{
                maxWidth: 480,
                textAlign: "center",
                color: "rgba(255, 255, 255, 0.6)",
                fontSize: "0.95rem",
                lineHeight: 1.6,
                marginBottom: "2rem",
            }}>
                Tu cuenta ha sido creada exitosamente, pero un <strong style={{ color: "#F59E0B" }}>administrador</strong> debe
                asignarte un rol para acceder a <strong style={{ color: "#8B5CF6" }}>CorpFlow</strong>.
                Contacta a tu supervisor para agilizar el proceso.
            </p>

            {/* Status badges */}
            <div style={{
                display: "flex",
                gap: "1rem",
                marginBottom: "2.5rem",
                flexWrap: "wrap",
                justifyContent: "center",
            }}>
                <div style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem",
                    padding: "0.5rem 1rem",
                    background: "rgba(16, 185, 129, 0.1)",
                    border: "1px solid rgba(16, 185, 129, 0.2)",
                    borderRadius: 100,
                    fontSize: "0.8rem",
                    color: "#34D399",
                    fontWeight: 600,
                }}>
                    ✅ Autenticación exitosa
                </div>
                <div style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem",
                    padding: "0.5rem 1rem",
                    background: "rgba(245, 158, 11, 0.1)",
                    border: "1px solid rgba(245, 158, 11, 0.2)",
                    borderRadius: 100,
                    fontSize: "0.8rem",
                    color: "#FBBF24",
                    fontWeight: 600,
                    animation: "pulse 2.5s ease-in-out infinite",
                }}>
                    ⏳ Pendiente de rol
                </div>
            </div>

            {/* Action buttons */}
            <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", justifyContent: "center" }}>
                <button
                    onClick={handleRetry}
                    disabled={checking}
                    style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.5rem",
                        padding: "0.85rem 1.5rem",
                        background: "rgba(139, 92, 246, 0.2)",
                        border: "1px solid rgba(139, 92, 246, 0.4)",
                        borderRadius: 12,
                        color: "#A78BFA",
                        fontWeight: 700,
                        cursor: checking ? "wait" : "pointer",
                        fontSize: "0.9rem",
                        transition: "all 0.2s ease",
                        opacity: checking ? 0.6 : 1,
                    }}
                >
                    <RefreshCw size={18} style={checking ? { animation: "spin 1.5s linear infinite" } : {}} />
                    {checking ? "Verificando..." : "Verificar acceso"}
                </button>

                <button
                    onClick={handleLogout}
                    style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.5rem",
                        padding: "0.85rem 1.5rem",
                        background: "rgba(239, 68, 68, 0.1)",
                        border: "1px solid rgba(239, 68, 68, 0.3)",
                        borderRadius: 12,
                        color: "#F87171",
                        fontWeight: 700,
                        cursor: "pointer",
                        fontSize: "0.9rem",
                        transition: "all 0.2s ease",
                    }}
                >
                    <LogOut size={18} />
                    Cerrar sesión
                </button>
            </div>

            {/* Footer */}
            <p style={{
                position: "absolute",
                bottom: "1.5rem",
                fontSize: "0.7rem",
                color: "rgba(255, 255, 255, 0.2)",
            }}>
                SINFIMAC Ecosystem — CorpFlow RBAC
            </p>

            <style>{`
                @keyframes pulse {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.5; }
                }
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    );
}
