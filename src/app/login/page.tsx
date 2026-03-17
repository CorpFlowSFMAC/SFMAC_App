"use client";

import { useState, useEffect } from "react";
import { Mail, Key, ArrowRight, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function LoginPage() {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(false);
    const [formData, setFormData] = useState({ username: "", password: "" });
    const [error, setError] = useState("");
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
        document.cookie = "userRole=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC;";
        localStorage.removeItem("userRole");
        localStorage.removeItem("userEmail");
        localStorage.removeItem("userName");
        localStorage.removeItem("rbacRole");
    }, []);

    const handleMicrosoftLogin = async () => {
        setIsLoading(true);
        try {
            const { error } = await supabase.auth.signInWithOAuth({
                provider: "azure",
                options: {
                    scopes: "openid profile email",
                    redirectTo: `${window.location.origin}/dashboard`,
                    queryParams: { prompt: "select_account" },
                },
            });
            if (error) throw error;
        } catch (err: any) {
            setError(err.message || "Error al conectar con Microsoft.");
            setIsLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError("");
        try {
            const email = formData.username.includes("@")
                ? formData.username
                : `${formData.username}@sinfimac.com`;
            const { data, error: authError } = await supabase.auth.signInWithPassword({
                email,
                password: formData.password,
            });
            if (authError) throw authError;
            if (data.user) {
                const role = data.user.user_metadata?.role ||
                    (formData.username.toLowerCase() === "admin" ? "admin" : "gestor");
                document.cookie = `userRole=${role}; path=/; max-age=86400`;
                localStorage.setItem("userRole", role);
                router.push(role === "admin" ? "/dashboard/admin" : "/dashboard/gestor");
            }
        } catch (err: any) {
            setError(err.message || "Credenciales incorrectas. Inténtalo de nuevo.");
            setIsLoading(false);
        }
    };

    if (!mounted) return null;

    return (
        <div style={{
            display: "flex", minHeight: "100vh", fontFamily: "'Inter', 'Montserrat', system-ui, sans-serif",
            background: "linear-gradient(135deg, #8A2BE2 0%, #FF1493 50%, #FF69B4 100%)",
            backgroundSize: "200% 200%", animation: "auroraMove 15s ease infinite",
            position: "relative", overflow: "hidden", flexDirection: "column",
            alignItems: "center", justifyContent: "center", padding: "1.5rem"
        }}>
            {/* ════════════════════════════════════════
                PARTÍCULAS Y DESTELLOS DE LUZ (Fondo Dinámico)
            ════════════════════════════════════════ */}
            <div style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none", zIndex: 0 }}>
                {/* Gran destello de luz centrado */}
                <div style={{
                    position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)",
                    width: "800px", height: "800px", background: "radial-gradient(circle, rgba(0,255,255,0.15) 0%, transparent 70%)",
                    animation: "pulseGlow 6s ease-in-out infinite"
                }} />

                {/* Partículas flotantes */}
                {[...Array(15)].map((_, i) => (
                    <div key={i} style={{
                        position: "absolute",
                        width: `${Math.random() * 4 + 2}px`, height: `${Math.random() * 4 + 2}px`,
                        background: "rgba(255, 255, 255, 0.6)", borderRadius: "50%",
                        boxShadow: "0 0 10px rgba(255,255,255,0.8)",
                        top: `${Math.random() * 100}%`, left: `${Math.random() * 100}%`,
                        animation: `floatUpParticles ${Math.random() * 10 + 10}s linear infinite`,
                        opacity: Math.random() * 0.8 + 0.2
                    }} />
                ))}
            </div>

            {/* ════════════════════════════════════════
                CONTENEDOR PRINCIPAL
            ════════════════════════════════════════ */}
            <div style={{ position: "relative", zIndex: 10, width: "100%", maxWidth: "420px", display: "flex", flexDirection: "column", alignItems: "center" }}>

                {/* ── LOGO PROMINENTE ── */}
                <h1 style={{
                    color: "#FFFFFF", fontSize: "3.2rem", fontWeight: 900,
                    textShadow: "0 0 25px rgba(255,255,255,0.4), 0 0 10px rgba(0,255,255,0.2)",
                    marginBottom: "2rem", textAlign: "center", letterSpacing: "0.04em",
                    lineHeight: 1.1, display: "flex", flexDirection: "column"
                }}>
                    SINFIMAC
                    <span style={{ fontSize: "1.8rem", fontWeight: 300, letterSpacing: "0.2em", opacity: 0.9 }}>CORP</span>
                </h1>

                {/* ── PANEL GLASSMORPHISM ── */}
                <div style={{
                    background: "rgba(255, 255, 255, 0.1)",
                    backdropFilter: "blur(20px)",
                    WebkitBackdropFilter: "blur(20px)",
                    borderRadius: "24px",
                    border: "1px solid rgba(255, 255, 255, 0.25)",
                    padding: "2.5rem 2rem", width: "100%",
                    boxShadow: "0 25px 50px rgba(0,0,0,0.2), inset 0 0 0 1px rgba(255,255,255,0.1)"
                }}>
                    
                    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
                        
                        {/* Input Correo */}
                        <div style={{ position: "relative" }}>
                            <div style={{ position: "absolute", left: "1rem", top: "50%", transform: "translateY(-50%)", color: "rgba(255,255,255,0.8)" }}>
                                <Mail size={18} />
                            </div>
                            <input
                                type="text"
                                placeholder="Email Institucional"
                                value={formData.username}
                                onChange={e => setFormData({ ...formData, username: e.target.value })}
                                style={{
                                    width: "100%", padding: "1rem 1rem 1rem 3rem",
                                    background: "rgba(255, 255, 255, 0.05)",
                                    border: "1px solid rgba(255, 255, 255, 0.3)",
                                    borderRadius: "16px", color: "#FFFFFF", fontSize: "0.95rem",
                                    outline: "none", transition: "all 0.3s ease",
                                    fontFamily: "inherit"
                                }}
                                onFocus={e => { e.target.style.background = "rgba(255,255,255,0.15)"; e.target.style.borderColor = "rgba(255,255,255,0.6)"; }}
                                onBlur={e => { e.target.style.background = "rgba(255,255,255,0.05)"; e.target.style.borderColor = "rgba(255,255,255,0.3)"; }}
                            />
                        </div>

                        {/* Input Contraseña */}
                        <div style={{ position: "relative" }}>
                            <div style={{ position: "absolute", left: "1rem", top: "50%", transform: "translateY(-50%)", color: "rgba(255,255,255,0.8)" }}>
                                <Key size={18} />
                            </div>
                            <input
                                type="password"
                                placeholder="Contraseña"
                                value={formData.password}
                                onChange={e => setFormData({ ...formData, password: e.target.value })}
                                style={{
                                    width: "100%", padding: "1rem 1rem 1rem 3rem",
                                    background: "rgba(255, 255, 255, 0.05)",
                                    border: "1px solid rgba(255, 255, 255, 0.3)",
                                    borderRadius: "16px", color: "#FFFFFF", fontSize: "0.95rem",
                                    outline: "none", transition: "all 0.3s ease",
                                    fontFamily: "inherit"
                                }}
                                onFocus={e => { e.target.style.background = "rgba(255,255,255,0.15)"; e.target.style.borderColor = "rgba(255,255,255,0.6)"; }}
                                onBlur={e => { e.target.style.background = "rgba(255,255,255,0.05)"; e.target.style.borderColor = "rgba(255,255,255,0.3)"; }}
                            />
                        </div>

                        {error && (
                            <div style={{ color: "#FFD700", fontSize: "0.85rem", textAlign: "center", fontWeight: 600, padding: "0.5rem", background: "rgba(0,0,0,0.2)", borderRadius: "8px" }}>
                                {error}
                            </div>
                        )}

                        {/* Links secundarios */}
                        <div style={{ display: "flex", justifyContent: "space-between", padding: "0 0.5rem", marginTop: "-0.25rem" }}>
                            <button type="button" style={{ background: "none", border: "none", color: "rgba(255,255,255,0.7)", fontSize: "0.8rem", cursor: "pointer", transition: "color 0.2s" }} onMouseEnter={e => e.currentTarget.style.color = "white"} onMouseLeave={e => e.currentTarget.style.color = "rgba(255,255,255,0.7)"}>
                                ¿Olvidaste la contraseña?
                            </button>
                            <button type="button" style={{ background: "none", border: "none", color: "rgba(255,255,255,0.7)", fontSize: "0.8rem", cursor: "pointer", transition: "color 0.2s" }} onMouseEnter={e => e.currentTarget.style.color = "white"} onMouseLeave={e => e.currentTarget.style.color = "rgba(255,255,255,0.7)"}>
                                Crear Cuenta
                            </button>
                        </div>

                        <button 
                            type="submit" 
                            disabled={isLoading}
                            style={{ 
                                display: "none" // Ocultamos el botón original, se usa el de Azure como principal (requerimiento) o dejamos que MS maneje todo
                             }}> 
                        </button>
                    </form>

                    {/* Separador */}
                    <div style={{ display: "flex", alignItems: "center", gap: "1rem", margin: "2rem 0 1.5rem" }}>
                        <div style={{ flex: 1, height: "1px", background: "rgba(255,255,255,0.2)" }} />
                        <span style={{ fontSize: "0.65rem", fontWeight: 600, color: "rgba(255,255,255,0.6)", letterSpacing: "0.1em" }}>O</span>
                        <div style={{ flex: 1, height: "1px", background: "rgba(255,255,255,0.2)" }} />
                    </div>

                    {/* ── BOTÓN DE PODER (AZURE AD) ── */}
                    <button
                        type="button"
                        onClick={handleMicrosoftLogin}
                        disabled={isLoading}
                        style={{
                            width: "100%", padding: "1.1rem",
                            background: "#00FFFF", // Turquesa Brillante / Cian
                            color: "#000000", border: "none", borderRadius: "16px",
                            fontSize: "1.05rem", fontWeight: 900, cursor: isLoading ? "not-allowed" : "pointer",
                            display: "flex", alignItems: "center", justifyContent: "center", gap: "0.75rem",
                            boxShadow: "0 10px 30px rgba(0,255,255,0.4), inset 0 2px 0 rgba(255,255,255,0.4)",
                            transition: "all 0.3s cubic-bezier(0.34,1.56,0.64,1)",
                            letterSpacing: "0.02em", textTransform: "uppercase"
                        }}
                        onMouseEnter={e => {
                            if (!isLoading) {
                                (e.currentTarget as HTMLElement).style.transform = "translateY(-4px)";
                                (e.currentTarget as HTMLElement).style.boxShadow = "0 15px 40px rgba(0,255,255,0.6), inset 0 2px 0 rgba(255,255,255,0.6)";
                                (e.currentTarget as HTMLElement).style.background = "#33FFFF";
                            }
                        }}
                        onMouseLeave={e => {
                            (e.currentTarget as HTMLElement).style.transform = "translateY(0)";
                            (e.currentTarget as HTMLElement).style.boxShadow = "0 10px 30px rgba(0,255,255,0.4), inset 0 2px 0 rgba(255,255,255,0.4)";
                            (e.currentTarget as HTMLElement).style.background = "#00FFFF";
                        }}
                    >
                        {isLoading ? (
                            <Loader2 size={22} style={{ animation: "spin 1s linear infinite" }} />
                        ) : (
                            <svg width="22" height="22" viewBox="0 0 21 21" xmlns="http://www.w3.org/2000/svg" style={{ filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.2))" }}>
                                <path d="m.3 0h9.7v9.7h-9.7z" fill="#f25022" />
                                <path d="m11 0h9.7v9.7h-9.7z" fill="#7fba00" />
                                <path d="m.3 11h9.7v9.7h-9.7z" fill="#00a4ef" />
                                <path d="m11 11h9.7v9.7h-9.7z" fill="#ffb900" />
                            </svg>
                        )}
                        {isLoading ? "CONECTANDO..." : "INICIAR SESIÓN CON AZURE AD"}
                    </button>

                </div>
            </div>

            {/* ── MENSAJE MOTIVACIONAL FINAL ── */}
            <div style={{ position: "absolute", bottom: "2.5rem", width: "100%", textAlign: "center", zIndex: 10 }}>
                <p style={{
                    color: "rgba(255,255,255,0.9)", fontSize: "0.85rem", fontWeight: 300,
                    letterSpacing: "0.15em", margin: 0, textShadow: "0 2px 10px rgba(0,0,0,0.5)"
                }}>
                    IMPULSA TU JORNADA CON ENERGÍA. ¡EMPIEZA A TRANSFORMAR HOY!
                </p>
            </div>

            {/* Animations */}
            <style>{`
                ::placeholder { color: rgba(255,255,255,0.5); font-weight: 300; }
                
                @keyframes auroraMove {
                    0% { background-position: 0% 50%; }
                    50% { background-position: 100% 50%; }
                    100% { background-position: 0% 50%; }
                }
                @keyframes pulseGlow {
                    0%, 100% { transform: translate(-50%, -50%) scale(1); opacity: 0.5; }
                    50% { transform: translate(-50%, -50%) scale(1.1); opacity: 0.8; }
                }
                @keyframes floatUpParticles {
                    0% { transform: translateY(100vh) scale(0); opacity: 0; }
                    10% { opacity: 1; }
                    90% { opacity: 1; }
                    100% { transform: translateY(-100px) scale(1.5); opacity: 0; }
                }
                @keyframes spin { 
                    from { transform: rotate(0deg); } 
                    to { transform: rotate(360deg); } 
                }
            `}</style>
        </div>
    );
}
