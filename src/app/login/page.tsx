"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { User, Lock, ArrowRight, Loader2, Zap, Shield, TrendingUp, Rocket } from "lucide-react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

const QUOTES = [
    { text: "Simplifica tu flujo. Maximiza tu éxito.", author: "CorpFlow · Sinfimac" },
    { text: "El éxito es la suma de pequeños esfuerzos repetidos día tras día.", author: "Robert Collier" },
    { text: "La excelencia no es un acto, es un hábito.", author: "Aristóteles" },
    { text: "No cuentes los días, haz que los días cuenten.", author: "Muhammad Ali" },
    { text: "Gestión eficiente es el camino hacia la cima.", author: "SINFIMAC Corp" },
];

const STATS = [
    { icon: Zap, label: "Tickets resueltos", value: "99.2%", sub: "eficiencia" },
    { icon: Shield, label: "Disponibilidad", value: "24/7", sub: "uptime garantizado" },
    { icon: TrendingUp, label: "Productividad", value: "+40%", sub: "promedio del equipo" },
];

export default function LoginPage() {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(false);
    const [quote, setQuote] = useState(QUOTES[0]);
    const [formData, setFormData] = useState({ username: "", password: "" });
    const [error, setError] = useState("");
    const [focusField, setFocusField] = useState<string | null>(null);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
        setQuote(QUOTES[Math.floor(Math.random() * QUOTES.length)]);
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

    return (
        <div style={{
            display: "flex", minHeight: "100vh", fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif",
            background: "linear-gradient(135deg,#F4F7F6 0%,#EEF2FF 100%)"
        }}>

            {/* ════════════════════════════════════════
                LADO IZQUIERDO — IMPACTO VISUAL
            ════════════════════════════════════════ */}
            <div style={{
                flex: "0 0 55%", position: "relative", overflow: "hidden",
                background: "linear-gradient(135deg,#2EC4B6 0%,#1A9E95 30%,#FF7149 75%,#FF5733 100%)",
                display: "flex", flexDirection: "column", justifyContent: "space-between",
                padding: "3rem"
            }}>
                {/* Animated background shapes */}
                <div style={{
                    position: "absolute", inset: 0, overflow: "hidden", zIndex: 0, pointerEvents: "none"
                }}>
                    {/* Orb 1 */}
                    <div style={{
                        position: "absolute", width: "500px", height: "500px",
                        borderRadius: "50%", top: "-150px", right: "-100px",
                        background: "rgba(255,255,255,0.08)", filter: "blur(1px)",
                        animation: "orbFloat1 8s ease-in-out infinite"
                    }} />
                    {/* Orb 2 */}
                    <div style={{
                        position: "absolute", width: "350px", height: "350px",
                        borderRadius: "50%", bottom: "-80px", left: "-80px",
                        background: "rgba(255,255,255,0.06)",
                        animation: "orbFloat2 10s ease-in-out infinite"
                    }} />
                    {/* Grid lines decoration */}
                    <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0.07 }}
                        xmlns="http://www.w3.org/2000/svg">
                        <defs>
                            <pattern id="grid" width="50" height="50" patternUnits="userSpaceOnUse">
                                <path d="M 50 0 L 0 0 0 50" fill="none" stroke="white" strokeWidth="1" />
                            </pattern>
                        </defs>
                        <rect width="100%" height="100%" fill="url(#grid)" />
                    </svg>
                </div>

                {/* Logo top left */}
                <div style={{ position: "relative", zIndex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                        <div style={{
                            width: "44px", height: "44px", borderRadius: "12px",
                            background: "rgba(255,255,255,0.2)", backdropFilter: "blur(10px)",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            border: "1px solid rgba(255,255,255,0.3)"
                        }}>
                            <Rocket size={22} color="white" />
                        </div>
                        <div>
                            <div style={{ color: "white", fontWeight: 900, fontSize: "1.2rem", letterSpacing: "0.02em" }}>
                                CORPFLOW
                            </div>
                            <div style={{ color: "rgba(255,255,255,0.7)", fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.15em" }}>
                                BY SINFIMAC CORP SAC
                            </div>
                        </div>
                    </div>
                </div>

                {/* Center: Hero illustration + headline */}
                <div style={{ position: "relative", zIndex: 1, textAlign: "center" }}>
                    {/* SVG Illustration — Rocket + Growth */}
                    <div style={{ marginBottom: "2rem", animation: "floatUp 4s ease-in-out infinite" }}>
                        <svg width="280" height="220" viewBox="0 0 280 220" fill="none" xmlns="http://www.w3.org/2000/svg"
                            style={{ margin: "0 auto", display: "block", filter: "drop-shadow(0 20px 40px rgba(0,0,0,0.2))" }}>
                            {/* Bar chart background */}
                            <rect x="20" y="140" width="32" height="60" rx="6" fill="rgba(255,255,255,0.15)" />
                            <rect x="62" y="110" width="32" height="90" rx="6" fill="rgba(255,255,255,0.2)" />
                            <rect x="104" y="80" width="32" height="120" rx="6" fill="rgba(255,255,255,0.25)" />
                            <rect x="146" y="50" width="32" height="150" rx="6" fill="rgba(255,255,255,0.3)" />
                            <rect x="188" y="20" width="32" height="180" rx="6" fill="rgba(255,255,255,0.35)" />

                            {/* Rising arrow line */}
                            <polyline points="36,155 78,118 120,90 162,60 204,28" stroke="white" strokeWidth="3"
                                strokeLinecap="round" strokeLinejoin="round" opacity="0.9" />
                            <circle cx="204" cy="28" r="6" fill="white" opacity="0.95" />

                            {/* Rocket body */}
                            <ellipse cx="200" cy="70" rx="22" ry="42" fill="white" opacity="0.95"
                                transform="rotate(-30 200 70)" />
                            <ellipse cx="200" cy="70" rx="10" ry="18" fill="#2EC4B6" opacity="0.85"
                                transform="rotate(-30 200 70)" />
                            {/* Rocket tip */}
                            <polygon points="190,38 200,18 210,38" fill="white" opacity="0.95"
                                transform="rotate(-30 200 28)" />
                            {/* Rocket flames */}
                            <ellipse cx="185" cy="98" rx="8" ry="14" fill="#FF8E53" opacity="0.9"
                                transform="rotate(-30 185 98)" />
                            <ellipse cx="188" cy="102" rx="5" ry="9" fill="white" opacity="0.6"
                                transform="rotate(-30 188 102)" />

                            {/* Stars */}
                            <circle cx="50" cy="30" r="3" fill="white" opacity="0.6" />
                            <circle cx="100" cy="15" r="2" fill="white" opacity="0.5" />
                            <circle cx="160" cy="25" r="2.5" fill="white" opacity="0.7" />
                            <circle cx="240" cy="60" r="2" fill="white" opacity="0.5" />
                            <circle cx="30" cy="70" r="2" fill="white" opacity="0.4" />
                        </svg>
                    </div>

                    {/* Hero headline */}
                    <h1 style={{
                        color: "white", fontWeight: 900, fontSize: "2.2rem",
                        lineHeight: 1.2, margin: "0 0 1rem", letterSpacing: "-0.02em",
                        textShadow: "0 2px 20px rgba(0,0,0,0.15)"
                    }}>
                        Simplifica tu flujo.<br />
                        <span style={{ color: "rgba(255,255,255,0.85)" }}>Maximiza tu éxito.</span>
                    </h1>
                    <p style={{
                        color: "rgba(255,255,255,0.75)", fontSize: "1rem",
                        lineHeight: 1.6, maxWidth: "380px", margin: "0 auto"
                    }}>
                        La plataforma de gestión operativa que impulsa a los mejores equipos de servicio técnico del Perú.
                    </p>
                </div>

                {/* Bottom: Stats row */}
                <div style={{ position: "relative", zIndex: 1, display: "flex", gap: "1rem" }}>
                    {STATS.map((s, i) => {
                        const Icon = s.icon;
                        return (
                            <div key={i} style={{
                                flex: 1, background: "rgba(255,255,255,0.12)",
                                backdropFilter: "blur(10px)", borderRadius: "16px",
                                padding: "1rem", border: "1px solid rgba(255,255,255,0.2)",
                                textAlign: "center"
                            }}>
                                <Icon size={18} color="white" style={{ marginBottom: "0.4rem", opacity: 0.9 }} />
                                <div style={{ color: "white", fontWeight: 900, fontSize: "1.3rem", lineHeight: 1 }}>{s.value}</div>
                                <div style={{ color: "rgba(255,255,255,0.65)", fontSize: "0.68rem", fontWeight: 600, marginTop: "2px" }}>{s.sub}</div>
                            </div>
                        );
                    })}
                </div>

                <style>{`
                    @keyframes orbFloat1 {
                        0%, 100% { transform: translate(0, 0) scale(1); }
                        50% { transform: translate(-20px, 20px) scale(1.05); }
                    }
                    @keyframes orbFloat2 {
                        0%, 100% { transform: translate(0, 0) scale(1); }
                        50% { transform: translate(15px, -15px) scale(1.08); }
                    }
                    @keyframes floatUp {
                        0%, 100% { transform: translateY(0px); }
                        50% { transform: translateY(-12px); }
                    }
                `}</style>
            </div>

            {/* ════════════════════════════════════════
                LADO DERECHO — FORMULARIO
            ════════════════════════════════════════ */}
            <div style={{
                flex: 1, display: "flex", flexDirection: "column",
                alignItems: "center", justifyContent: "center",
                background: "white", padding: "3rem 2.5rem",
                position: "relative", overflow: "hidden"
            }}>
                {/* Subtle top decoration */}
                <div style={{
                    position: "absolute", top: 0, left: 0, right: 0, height: "4px",
                    background: "linear-gradient(90deg,#2EC4B6,#FF7149,#FF5733)"
                }} />

                <div style={{ width: "100%", maxWidth: "400px" }}>

                    {/* Logo mark */}
                    <div style={{ textAlign: "center", marginBottom: "2.5rem" }}>
                        <div style={{
                            display: "inline-flex", alignItems: "center", justifyContent: "center",
                            width: "64px", height: "64px", borderRadius: "18px", marginBottom: "1.25rem",
                            background: "linear-gradient(135deg,#FF7149,#FF5733)",
                            boxShadow: "0 8px 25px rgba(255,113,73,0.35)"
                        }}>
                            <Rocket size={30} color="white" />
                        </div>
                        <h1 style={{
                            fontSize: "1.75rem", fontWeight: 900, color: "#1A202C",
                            margin: "0 0 0.4rem", letterSpacing: "-0.03em"
                        }}>
                            Bienvenido de vuelta
                        </h1>
                        <p style={{ color: "#718096", fontSize: "0.9rem", margin: 0 }}>
                            Inicia sesión en tu espacio de trabajo
                        </p>
                    </div>

                    {/* ── MICROSOFT / AZURE BUTTON (Principal) ── */}
                    <button
                        type="button"
                        onClick={handleMicrosoftLogin}
                        disabled={isLoading}
                        style={{
                            width: "100%", padding: "0.95rem 1.5rem",
                            background: isLoading ? "#FDA085" : "linear-gradient(135deg,#FF7149 0%,#FF5733 100%)",
                            color: "white", border: "none", borderRadius: "14px",
                            fontSize: "0.95rem", fontWeight: 800, cursor: isLoading ? "not-allowed" : "pointer",
                            display: "flex", alignItems: "center", justifyContent: "center", gap: "0.75rem",
                            boxShadow: "0 8px 25px rgba(255,87,51,0.35), 0 2px 8px rgba(255,87,51,0.2)",
                            transition: "all 0.25s cubic-bezier(0.34,1.56,0.64,1)",
                            letterSpacing: "0.02em", marginBottom: "0.75rem"
                        }}
                        onMouseEnter={e => {
                            if (!isLoading) {
                                (e.currentTarget as HTMLElement).style.transform = "translateY(-2px) scale(1.01)";
                                (e.currentTarget as HTMLElement).style.boxShadow = "0 14px 35px rgba(255,87,51,0.45), 0 4px 12px rgba(255,87,51,0.25)";
                            }
                        }}
                        onMouseLeave={e => {
                            (e.currentTarget as HTMLElement).style.transform = "";
                            (e.currentTarget as HTMLElement).style.boxShadow = "0 8px 25px rgba(255,87,51,0.35), 0 2px 8px rgba(255,87,51,0.2)";
                        }}
                    >
                        {isLoading ? (
                            <Loader2 size={20} style={{ animation: "spin 1s linear infinite" }} />
                        ) : (
                            <svg width="20" height="20" viewBox="0 0 21 21" xmlns="http://www.w3.org/2000/svg">
                                <path d="m.3 0h9.7v9.7h-9.7z" fill="#f25022" />
                                <path d="m11 0h9.7v9.7h-9.7z" fill="#7fba00" />
                                <path d="m.3 11h9.7v9.7h-9.7z" fill="#00a4ef" />
                                <path d="m11 11h9.7v9.7h-9.7z" fill="#ffb900" />
                            </svg>
                        )}
                        {isLoading ? "Conectando con Microsoft..." : "Iniciar sesión con Cuenta Corporativa"}
                    </button>

                    {/* Motivational subtext */}
                    <p style={{
                        textAlign: "center", fontSize: "0.78rem", color: "#A0AEC0",
                        margin: "0 0 1.75rem", fontStyle: "italic"
                    }}>
                        ✨ Bienvenido de vuelta. ¡Hagamos cosas increíbles hoy!
                    </p>

                    {/* Divider */}
                    <div style={{
                        display: "flex", alignItems: "center", gap: "1rem",
                        marginBottom: "1.75rem"
                    }}>
                        <div style={{ flex: 1, height: "1px", background: "#E2E8F0" }} />
                        <span style={{ fontSize: "0.72rem", fontWeight: 700, color: "#CBD5E0", letterSpacing: "0.08em" }}>
                            O ACCESO DIRECTO
                        </span>
                        <div style={{ flex: 1, height: "1px", background: "#E2E8F0" }} />
                    </div>

                    {/* ── FORM ── */}
                    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1.1rem" }}>

                        {/* Username */}
                        <div>
                            <label style={{ fontSize: "0.78rem", fontWeight: 700, color: "#4A5568", display: "block", marginBottom: "0.4rem", letterSpacing: "0.02em" }}>
                                USUARIO
                            </label>
                            <div style={{
                                display: "flex", alignItems: "center", gap: "0.75rem",
                                border: `2px solid ${focusField === "user" ? "#2EC4B6" : "#E2E8F0"}`,
                                borderRadius: "12px", padding: "0.75rem 1rem",
                                background: focusField === "user" ? "#F0FFFE" : "white",
                                transition: "all 0.2s ease"
                            }}>
                                <User size={16} color={focusField === "user" ? "#2EC4B6" : "#A0AEC0"} />
                                <input
                                    type="text"
                                    placeholder="usuario o correo"
                                    value={formData.username}
                                    onChange={e => setFormData({ ...formData, username: e.target.value })}
                                    onFocus={() => setFocusField("user")}
                                    onBlur={() => setFocusField(null)}
                                    style={{
                                        flex: 1, border: "none", outline: "none", background: "transparent",
                                        fontSize: "0.9rem", color: "#1A202C", fontFamily: "inherit"
                                    }}
                                />
                            </div>
                        </div>

                        {/* Password */}
                        <div>
                            <label style={{ fontSize: "0.78rem", fontWeight: 700, color: "#4A5568", display: "block", marginBottom: "0.4rem", letterSpacing: "0.02em" }}>
                                CONTRASEÑA
                            </label>
                            <div style={{
                                display: "flex", alignItems: "center", gap: "0.75rem",
                                border: `2px solid ${focusField === "pass" ? "#2EC4B6" : "#E2E8F0"}`,
                                borderRadius: "12px", padding: "0.75rem 1rem",
                                background: focusField === "pass" ? "#F0FFFE" : "white",
                                transition: "all 0.2s ease"
                            }}>
                                <Lock size={16} color={focusField === "pass" ? "#2EC4B6" : "#A0AEC0"} />
                                <input
                                    type="password"
                                    placeholder="••••••••"
                                    value={formData.password}
                                    onChange={e => setFormData({ ...formData, password: e.target.value })}
                                    onFocus={() => setFocusField("pass")}
                                    onBlur={() => setFocusField(null)}
                                    style={{
                                        flex: 1, border: "none", outline: "none", background: "transparent",
                                        fontSize: "0.9rem", color: "#1A202C", fontFamily: "inherit"
                                    }}
                                />
                            </div>
                        </div>

                        {/* Error */}
                        {error && (
                            <div style={{
                                background: "#FFF5F5", border: "1px solid #FED7D7",
                                borderRadius: "10px", padding: "0.7rem 1rem",
                                color: "#C53030", fontSize: "0.82rem", fontWeight: 600,
                                display: "flex", alignItems: "center", gap: "0.5rem"
                            }}>
                                ⚠️ {error}
                            </div>
                        )}

                        {/* Submit */}
                        <button
                            type="submit"
                            disabled={isLoading}
                            style={{
                                width: "100%", padding: "0.85rem",
                                background: "linear-gradient(135deg,#2EC4B6 0%,#1A9E95 100%)",
                                color: "white", border: "none", borderRadius: "12px",
                                fontSize: "0.9rem", fontWeight: 800, cursor: isLoading ? "not-allowed" : "pointer",
                                display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem",
                                boxShadow: "0 6px 20px rgba(46,196,182,0.3)",
                                transition: "all 0.2s ease", letterSpacing: "0.02em",
                                opacity: isLoading ? 0.7 : 1
                            }}
                            onMouseEnter={e => { if (!isLoading) (e.currentTarget as HTMLElement).style.transform = "translateY(-1px)"; }}
                            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = ""; }}
                        >
                            {isLoading
                                ? <><Loader2 size={18} style={{ animation: "spin 1s linear infinite" }} /> Ingresando...</>
                                : <>INICIAR OPERACIONES <ArrowRight size={18} /></>
                            }
                        </button>
                    </form>

                    {/* Quote bottom */}
                    <div style={{
                        marginTop: "2.5rem", padding: "1rem 1.25rem",
                        background: "linear-gradient(135deg,#F0FFFE,#FFF5F0)",
                        borderRadius: "12px", borderLeft: "3px solid #2EC4B6"
                    }}>
                        <p style={{ fontSize: "0.8rem", color: "#4A5568", fontStyle: "italic", margin: "0 0 4px", lineHeight: 1.5 }}>
                            "{quote.text}"
                        </p>
                        <span style={{ fontSize: "0.72rem", fontWeight: 700, color: "#A0AEC0" }}>— {quote.author}</span>
                    </div>

                    {/* Footer */}
                    <p style={{ textAlign: "center", fontSize: "0.7rem", color: "#CBD5E0", marginTop: "1.5rem" }}>
                        © 2026 Sinfimac Corp SAC · Todos los derechos reservados
                    </p>
                </div>

                <style>{`
                    @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
                `}</style>
            </div>
        </div>
    );
}
