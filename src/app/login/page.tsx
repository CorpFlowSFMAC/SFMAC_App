"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
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
            background: "linear-gradient(135deg, #FFFFFF 0%, #F4F7F6 100%)",
            position: "relative", overflow: "hidden", flexDirection: "column",
            alignItems: "center", justifyContent: "center", padding: "1.5rem"
        }}>
            {/* ════════════════════════════════════════
                ILUMINACIÓN PROFESIONAL (Light Gradients)
            ════════════════════════════════════════ */}
            <div style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none", zIndex: 0 }}>
                {/* Sol cálido esquina superior izquierda */}
                <div style={{
                    position: "absolute", top: "-10%", left: "-10%",
                    width: "70vw", height: "70vw", maxWidth: "800px", maxHeight: "800px",
                    background: "radial-gradient(circle, rgba(255,140,0,0.06) 0%, transparent 60%)",
                    animation: "pulseLight 8s ease-in-out infinite alternate"
                }} />
                
                {/* Luz fresca esquina inferior derecha */}
                <div style={{
                    position: "absolute", bottom: "-15%", right: "-10%",
                    width: "60vw", height: "60vw", maxWidth: "700px", maxHeight: "700px",
                    background: "radial-gradient(circle, rgba(32,178,170,0.05) 0%, transparent 60%)",
                }} />
            </div>

            {/* ════════════════════════════════════════
                CONTENEDOR PRINCIPAL
            ════════════════════════════════════════ */}
            <div style={{ position: "relative", zIndex: 10, width: "100%", maxWidth: "440px", display: "flex", flexDirection: "column", alignItems: "center" }}>

                {/* ── LOGO PROMINENTE ── */}
                <div style={{ marginBottom: "2.5rem", display: "flex", justifyContent: "center", filter: "drop-shadow(0 4px 12px rgba(0,0,0,0.05))" }}>
                    <Image
                        src="/logo-final.png"
                        alt="SINFIMAC CORP Logo"
                        width={330}
                        height={120}
                        style={{ objectFit: "contain" }}
                        priority
                        unoptimized
                    />
                </div>

                {/* ── PANEL DE LOGIN CENTRAL (Clean Float Card) ── */}
                <div style={{
                    background: "#FFFFFF",
                    borderRadius: "20px",
                    padding: "2.5rem", width: "100%",
                    boxShadow: "0 20px 40px rgba(0, 51, 102, 0.08), 0 1px 3px rgba(0,0,0,0.02)",
                    border: "1px solid rgba(0, 51, 102, 0.05)"
                }}>
                    
                    {/* Mensaje Inspirador */}
                    <div style={{ textAlign: "center", marginBottom: "2rem" }}>
                        <h2 style={{
                            color: "#003366", fontSize: "1.4rem", fontWeight: 800,
                            letterSpacing: "-0.02em", margin: "0 0 0.5rem 0"
                        }}>
                            BIENVENIDO
                        </h2>
                        <p style={{ color: "#4A5568", fontSize: "0.95rem", fontWeight: 500, margin: 0 }}>
                            Tu éxito comienza aquí.
                        </p>
                    </div>

                    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
                        
                        {/* Input Correo */}
                        <div style={{ position: "relative" }}>
                            <div style={{ position: "absolute", left: "1.2rem", top: "50%", transform: "translateY(-50%)", color: "#A0AEC0", transition: "color 0.3s" }}>
                                <Mail size={18} />
                            </div>
                            <input
                                type="text"
                                placeholder="Email Institucional"
                                value={formData.username}
                                onChange={e => setFormData({ ...formData, username: e.target.value })}
                                style={{
                                    width: "100%", padding: "0.9rem 1rem 0.9rem 3.2rem",
                                    background: "#F8FAFC",
                                    border: "1.5px solid #E2E8F0",
                                    borderRadius: "12px", color: "#1A202C", fontSize: "0.95rem",
                                    outline: "none", transition: "all 0.3s ease",
                                    fontFamily: "inherit", fontWeight: 500
                                }}
                                onFocus={e => { 
                                    e.target.style.background = "#FFFFFF"; 
                                    e.target.style.borderColor = "#20B2AA"; 
                                    e.target.style.boxShadow = "0 0 0 3px rgba(32,178,170,0.15)";
                                    (e.target.previousSibling as HTMLElement).style.color = "#20B2AA";
                                }}
                                onBlur={e => { 
                                    e.target.style.background = "#F8FAFC"; 
                                    e.target.style.borderColor = "#E2E8F0"; 
                                    e.target.style.boxShadow = "none";
                                    (e.target.previousSibling as HTMLElement).style.color = "#A0AEC0";
                                }}
                            />
                        </div>

                        {/* Input Contraseña */}
                        <div style={{ position: "relative" }}>
                            <div style={{ position: "absolute", left: "1.2rem", top: "50%", transform: "translateY(-50%)", color: "#A0AEC0", transition: "color 0.3s" }}>
                                <Key size={18} />
                            </div>
                            <input
                                type="password"
                                placeholder="Contraseña"
                                value={formData.password}
                                onChange={e => setFormData({ ...formData, password: e.target.value })}
                                style={{
                                    width: "100%", padding: "0.9rem 1rem 0.9rem 3.2rem",
                                    background: "#F8FAFC",
                                    border: "1.5px solid #E2E8F0",
                                    borderRadius: "12px", color: "#1A202C", fontSize: "0.95rem",
                                    outline: "none", transition: "all 0.3s ease",
                                    fontFamily: "inherit", fontWeight: 500
                                }}
                                onFocus={e => { 
                                    e.target.style.background = "#FFFFFF"; 
                                    e.target.style.borderColor = "#20B2AA"; 
                                    e.target.style.boxShadow = "0 0 0 3px rgba(32,178,170,0.15)";
                                    (e.target.previousSibling as HTMLElement).style.color = "#20B2AA";
                                }}
                                onBlur={e => { 
                                    e.target.style.background = "#F8FAFC"; 
                                    e.target.style.borderColor = "#E2E8F0"; 
                                    e.target.style.boxShadow = "none";
                                    (e.target.previousSibling as HTMLElement).style.color = "#A0AEC0";
                                }}
                            />
                        </div>

                        {error && (
                            <div style={{ color: "#E53E3E", fontSize: "0.85rem", textAlign: "center", fontWeight: 600, padding: "0.6rem", background: "#FFF5F5", borderRadius: "8px", border: "1px solid #FED7D7" }}>
                                {error}
                            </div>
                        )}
                        
                        {/* Hidden submit so Enter key works on the password input */}
                        <button 
                            type="submit" 
                            disabled={isLoading}
                            style={{ display: "none" }}
                        >
                            Ingresar
                        </button>
                    </form>

                    {/* Separador */}
                    <div style={{ display: "flex", alignItems: "center", gap: "1rem", margin: "2rem 0" }}>
                        <div style={{ flex: 1, height: "1px", background: "#E2E8F0" }} />
                        <span style={{ fontSize: "0.7rem", fontWeight: 700, color: "#A0AEC0", letterSpacing: "0.05em" }}>ACCESO CORPORATIVO</span>
                        <div style={{ flex: 1, height: "1px", background: "#E2E8F0" }} />
                    </div>

                    {/* ── BOTÓN DE PODER (AZURE AD) ── */}
                    <button
                        type="button"
                        onClick={handleMicrosoftLogin}
                        disabled={isLoading}
                        style={{
                            width: "100%", padding: "1.15rem",
                            background: "linear-gradient(135deg, #FF8C00 0%, #FF7F50 100%)", /* Naranja Vibrante */
                            color: "#FFFFFF", border: "none", borderRadius: "14px",
                            fontSize: "0.95rem", fontWeight: 800, cursor: isLoading ? "not-allowed" : "pointer",
                            display: "flex", alignItems: "center", justifyContent: "center", gap: "0.75rem",
                            boxShadow: "0 8px 20px rgba(255,140,0,0.3)",
                            transition: "all 0.3s cubic-bezier(0.34,1.56,0.64,1)",
                            letterSpacing: "0.03em"
                        }}
                        onMouseEnter={e => {
                            if (!isLoading) {
                                (e.currentTarget as HTMLElement).style.transform = "translateY(-3px)";
                                (e.currentTarget as HTMLElement).style.boxShadow = "0 12px 25px rgba(255,140,0,0.4)";
                            }
                        }}
                        onMouseLeave={e => {
                            (e.currentTarget as HTMLElement).style.transform = "translateY(0)";
                            (e.currentTarget as HTMLElement).style.boxShadow = "0 8px 20px rgba(255,140,0,0.3)";
                        }}
                    >
                        {isLoading ? (
                            <Loader2 size={20} style={{ animation: "spin 1s linear infinite" }} />
                        ) : (
                            <svg width="20" height="20" viewBox="0 0 21 21" xmlns="http://www.w3.org/2000/svg">
                                <path d="m.3 0h9.7v9.7h-9.7z" fill="#FFFFFF" />
                                <path d="m11 0h9.7v9.7h-9.7z" fill="#FFFFFF" />
                                <path d="m.3 11h9.7v9.7h-9.7z" fill="#FFFFFF" />
                                <path d="m11 11h9.7v9.7h-9.7z" fill="#FFFFFF" />
                            </svg>
                        )}
                        {isLoading ? "CONECTANDO..." : "INICIAR SESIÓN CON AZURE AD"}
                        {!isLoading && <ArrowRight size={18} style={{ marginLeft: "4px" }} />}
                    </button>

                </div>
            </div>

            {/* Animations */}
            <style>{`
                ::placeholder { color: #A0AEC0; font-weight: 500; }
                
                @keyframes pulseLight {
                    0% { transform: scale(1); opacity: 0.6; }
                    100% { transform: scale(1.1); opacity: 1; }
                }
                @keyframes spin { 
                    from { transform: rotate(0deg); } 
                    to { transform: rotate(360deg); } 
                }
            `}</style>
        </div>
    );
}
