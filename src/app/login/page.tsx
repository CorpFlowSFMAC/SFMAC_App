"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import Image from "next/image";
import { User, Lock, ArrowRight, Loader, Key, CheckCircle, RefreshCw } from "lucide-react";
import styles from "./login.module.css";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import type { AuthTokenResponsePassword, AuthOtpResponse } from "@supabase/supabase-js";

// Constante desde variable de entorno — no expone el correo en el bundle fuente
const TREASURER_EMAIL = process.env.NEXT_PUBLIC_TREASURER_EMAIL ?? "";

// Mock Motivational Quotes
const QUOTES = [
    { text: "El único modo de hacer un gran trabajo es amar lo que haces.", author: "Steve Jobs" },
    { text: "El éxito es la suma de pequeños esfuerzos repetidos día tras día.", author: "Robert Collier" },
    { text: "No cuentes los días, haz que los días cuenten.", author: "Muhammad Ali" },
    { text: "La excelencia no es un acto, es un hábito.", author: "Aristóteles" },
    { text: "Gestión eficiente es el camino hacia la cima.", author: "SINFIMAC Filosofía" },
];

export default function LoginPage() {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(false);
    const [quote, setQuote] = useState(QUOTES[0]);
    const [formData, setFormData] = useState({ username: "", password: "", otp: "" });
    const [error, setError] = useState("");
    const [otpSent, setOtpSent] = useState(false);
    const buttonRef = useRef<HTMLButtonElement>(null);

    // FIX #7: useMemo para evitar recalcular en cada render
    const isTreasurer = useMemo(
        () => formData.username.trim().toLowerCase() === TREASURER_EMAIL.toLowerCase(),
        [formData.username]
    );

    // FIX #7b: email resuelto memoizado — centraliza la lógica de expansión de usuario
    const resolvedEmail = useMemo(
        () => (formData.username.includes("@") ? formData.username.trim() : `${formData.username.trim()}@sinfimac.pe`),
        [formData.username]
    );

    useEffect(() => {
        const randomQuote = QUOTES[Math.floor(Math.random() * QUOTES.length)];
        setQuote(randomQuote);
    }, []);

    // =====================================================
    // EMERGENCY COOKIE CLEANUP - Force clear ALL cookies and localStorage
    // This prevents redirect loops caused by stale sessions
    // =====================================================
    useEffect(() => {
        const currentOrigin = typeof window !== "undefined" ? window.location.origin : "";
        const cookieNames = [
            "userRole", "sb-access-token", "sb-refresh-token",
            "supabase-auth-token", "appSession", "authState",
            "sinfimac", "corpflow", "old-session",
        ];

        cookieNames.forEach((name) => {
            try {
                document.cookie = `${name}=;path=/;expires=Thu, 01 Jan 1970 00:00:00 GMT;SameSite=Strict`;
                document.cookie = `${name}=;path=/;expires=Thu, 01 Jan 1970 00:00:00 GMT;SameSite=Lax`;
                document.cookie = `${name}=;path=/;expires=Thu, 01 Jan 1970 00:00:00 GMT`;
                document.cookie = `${name}=;path=/;domain=${currentOrigin};expires=Thu, 01 Jan 1970 00:00:00 GMT`;
            } catch (_) {}
        });

        try {
            const cookies = document.cookie.split(";");
            for (let i = 0; i < cookies.length; i++) {
                const cookieName = cookies[i].split("=")[0]?.trim();
                if (cookieName && !cookieName.startsWith("__")) {
                    const paths = ["/", "/dashboard", "/dashboard/admin", "/dashboard/gestor"];
                    const domains = ["", currentOrigin, "all-hands.dev", "sinfimac.pe", "corpflow.sinfimac.pe"];
                    paths.forEach((path) => {
                        domains.forEach((domain) => {
                            const domainStr = domain ? `;domain=${domain}` : "";
                            document.cookie = `${cookieName}=;path=${path}${domainStr};expires=Thu, 01 Jan 1970 00:00:00 GMT`;
                        });
                    });
                }
            }
        } catch (e) {
            console.log("[Cleanup] Error clearing cookies:", e);
        }

        try { localStorage.clear(); } catch (_) {}
        try { sessionStorage.clear(); } catch (_) {}

        console.log("[Cleanup] Emergency cookie/localStorage cleanup completed");
    }, []);

    const handleMicrosoftLogin = async () => {
        console.log("[Login] Starting Azure AD login...");
        setIsLoading(true);
        setError("");

        try {
            const origin = "https://corpflow.sinfimac.pe";
            const redirectUri = encodeURIComponent(`${origin}/api/auth/callback/azure-ad`);
            const clientId = process.env.NEXT_PUBLIC_AZURE_AD_CLIENT_ID || "18a47ee7-7ecc-4978-9e78-06fd4ea0b343";
            const tenantId = process.env.NEXT_PUBLIC_AZURE_AD_TENANT_ID || "7b359926-1313-48e4-a459-1f7a9f5c63aa";
            const azureAuthUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize?client_id=${clientId}&response_type=code&redirect_uri=${redirectUri}&scope=openid%20profile%20email%20User.Read&response_mode=query&prompt=login`;

            window.location.href = azureAuthUrl;
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : "Error de conexión";
            setError(msg);
            setIsLoading(false);
        }
    };

    // FIX #1 + #3: usa `email` pasado como parámetro (no formData), tipado correcto
    const handleSessionSuccess = async (
        data: AuthTokenResponsePassword["data"] | AuthOtpResponse["data"],
        email: string
    ) => {
        if (!data?.user) return;

        const usernameForRole = email.split("@")[0]; // derivado del email recibido, no del estado
        const role =
            data.user.user_metadata?.role ||
            (usernameForRole.toLowerCase() === "admin" ? "admin" : "gestor");

        const maxAge = role === "admin" ? 60 * 60 * 24 * 30 : 60 * 60 * 24;
        document.cookie = `userRole=${role}; path=/; max-age=${maxAge}; SameSite=Lax`;
        localStorage.setItem("userRole", role);

        if (role === "admin" && data.session) {
            try {
                const { supabaseAdmin } = await import("@/lib/supabase-admin");
                await supabaseAdmin.auth.setSession({
                    access_token: data.session.access_token,
                    refresh_token: data.session.refresh_token,
                });
                console.log("[Auth] Admin session synchronized to persistent client ✓");
            } catch (e) {
                console.warn("[Auth] Could not sync admin session:", e);
            }
        }

        router.push(role === "admin" ? "/dashboard/admin" : "/dashboard/gestor");
    };

    const handleRequestOTP = async () => {
        if (!formData.username.trim()) {
            setError("Por favor, ingrese su usuario o correo.");
            return;
        }
        setIsLoading(true);
        setError("");

        try {
            const { error: otpError } = await supabase.auth.signInWithOtp({
                email: resolvedEmail,
            });

            if (otpError) throw otpError;
            setOtpSent(true);
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : "Error al solicitar OTP.";
            setError(msg);
        } finally {
            setIsLoading(false);
        }
    };

    // FIX #6: validación del OTP antes de llamar a Supabase
    const validateOtp = (otp: string): boolean => {
        if (!/^\d{6}$/.test(otp)) {
            setError("El código OTP debe tener exactamente 6 dígitos numéricos.");
            return false;
        }
        return true;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError("");

        try {
            const { password, otp } = formData;

            if (isTreasurer) {
                // Flujo con contraseña exclusiva para la Tesorera Priscila
                const { data, error: authError } = await supabase.auth.signInWithPassword({
                    email: resolvedEmail,
                    password,
                });
                if (authError) throw authError;
                await handleSessionSuccess(data, resolvedEmail);
            } else {
                // FIX #6: validar formato antes de enviar
                if (!validateOtp(otp)) {
                    setIsLoading(false);
                    return;
                }
                // Flujo OTP para el resto del equipo
                const { data, error: authError } = await supabase.auth.verifyOtp({
                    email: resolvedEmail,
                    token: otp,
                    type: "email",
                });
                if (authError) throw authError;
                await handleSessionSuccess(data, resolvedEmail);
            }
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : "Error de autenticación.";
            setError(msg);
            setIsLoading(false);
        }
    };

    // FIX #5: reiniciar flujo OTP
    const handleResetOtp = () => {
        setOtpSent(false);
        setFormData((prev) => ({ ...prev, otp: "" }));
        setError("");
    };

    return (
        <div className={styles.loginContainer}>
            <div className={`${styles.bgOrb} ${styles.bgOrb1}`} />
            <div className={`${styles.bgOrb} ${styles.bgOrb2}`} />
            <div className={`${styles.bgOrb} ${styles.bgOrb3}`} />

            <div className={styles.contentWrapper}>
                <div className={styles.visualSide}>
                    <div className={styles.logoWrapper}>
                        <Image
                            src="/logo-final.png"
                            alt="SINFIMAC Logo"
                            width={500}
                            height={500}
                            className={styles.logoImage}
                            priority
                            quality={100}
                            unoptimized
                        />
                    </div>
                    <div className={styles.quoteContainer}>
                        <p className={styles.quoteText}>"{quote.text}"</p>
                        <span className={styles.quoteAuthor}>— {quote.author}</span>
                    </div>
                </div>

                <div className={styles.formSide}>
                    <div className={styles.loginCard}>
                        <div style={{ textAlign: "center" }}>
                            <h1 className={styles.welcomeTitle}>Bienvenido</h1>
                            <p className={styles.welcomeSubtitle}>Inicia sesión para continuar</p>
                        </div>

                        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
                            {/* Campo usuario */}
                            <div className={styles.inputGroup}>
                                <label className={styles.label}>Usuario / Correo</label>
                                <div className={styles.inputWrapper}>
                                    <User className={styles.icon} />
                                    <input
                                        type="text"
                                        placeholder="Ingrese su correo o usuario"
                                        className={styles.input}
                                        value={formData.username}
                                        onChange={(e) => {
                                            setFormData({ ...formData, username: e.target.value });
                                            // Resetear OTP si cambia el usuario
                                            if (otpSent) setOtpSent(false);
                                        }}
                                        // FIX #5: campo editable via botón "Cambiar correo", no disabled
                                        readOnly={otpSent && !isTreasurer}
                                    />
                                </div>
                            </div>

                            {/* Campo contraseña (solo Tesorera) */}
                            {isTreasurer && (
                                <div className={styles.inputGroup}>
                                    <label className={styles.label}>Contraseña</label>
                                    <div className={styles.inputWrapper}>
                                        <Lock className={styles.icon} />
                                        <input
                                            type="password"
                                            placeholder="••••••••"
                                            className={styles.input}
                                            value={formData.password}
                                            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                        />
                                    </div>
                                </div>
                            )}

                            {/* FIX #4: Confirmación visual de OTP enviado */}
                            {!isTreasurer && otpSent && (
                                <div style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "0.5rem",
                                    padding: "0.75rem 1rem",
                                    background: "rgba(34, 197, 94, 0.1)",
                                    border: "1px solid rgba(34, 197, 94, 0.4)",
                                    borderRadius: "8px",
                                    color: "#22c55e",
                                    fontSize: "0.875rem",
                                }}>
                                    <CheckCircle size={16} />
                                    <span>Código enviado a <strong>{resolvedEmail}</strong></span>
                                </div>
                            )}

                            {/* Campo OTP (resto del equipo, después de solicitar código) */}
                            {!isTreasurer && otpSent && (
                                <div className={styles.inputGroup}>
                                    {/* FIX #5: Botón para reiniciar si se equivocó de correo */}
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                        <label className={styles.label}>Código OTP</label>
                                        <button
                                            type="button"
                                            onClick={handleResetOtp}
                                            style={{
                                                background: "none",
                                                border: "none",
                                                cursor: "pointer",
                                                color: "#6b7280",
                                                fontSize: "0.78rem",
                                                display: "flex",
                                                alignItems: "center",
                                                gap: "0.25rem",
                                            }}
                                        >
                                            <RefreshCw size={12} /> Cambiar correo
                                        </button>
                                    </div>
                                    <div className={styles.inputWrapper}>
                                        <Key className={styles.icon} />
                                        <input
                                            type="text"
                                            inputMode="numeric"
                                            pattern="\d{6}"
                                            maxLength={6}
                                            placeholder="Código de 6 dígitos"
                                            className={styles.input}
                                            value={formData.otp}
                                            onChange={(e) => {
                                                // FIX #6: solo permite dígitos en el campo
                                                const val = e.target.value.replace(/\D/g, "").slice(0, 6);
                                                setFormData({ ...formData, otp: val });
                                            }}
                                        />
                                    </div>
                                </div>
                            )}

                            {error && (
                                <p style={{ color: "red", fontSize: "0.9rem", textAlign: "center", margin: 0 }}>
                                    {error}
                                </p>
                            )}

                            {/* Botón: Solicitar OTP (usuarios sin contraseña, antes de enviarlo) */}
                            {!isTreasurer && !otpSent ? (
                                <button
                                    type="button"
                                    className={styles.submitBtn}
                                    disabled={isLoading}
                                    onClick={handleRequestOTP}
                                >
                                    {isLoading ? (
                                        <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem" }}>
                                            <Loader className="animate-spin" size={20} /> Enviando código...
                                        </span>
                                    ) : (
                                        <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem" }}>
                                            SOLICITAR CÓDIGO <ArrowRight size={20} />
                                        </span>
                                    )}
                                </button>
                            ) : (
                                /* Botón: Ingresar (Tesorera con password | Equipo con OTP) */
                                <button type="submit" className={styles.submitBtn} disabled={isLoading}>
                                    {isLoading ? (
                                        <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem" }}>
                                            <Loader className="animate-spin" size={20} /> Ingresando...
                                        </span>
                                    ) : (
                                        <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem" }}>
                                            {isTreasurer ? "INICIAR OPERACIONES" : "VERIFICAR E INGRESAR"} <ArrowRight size={20} />
                                        </span>
                                    )}
                                </button>
                            )}
                        </form>

                        <div className={styles.divider}>
                            <span>O CONTINUAR CON</span>
                        </div>

                        <button
                            ref={buttonRef}
                            type="button"
                            className={styles.microsoftBtn}
                            onClick={handleMicrosoftLogin}
                            disabled={isLoading}
                        >
                            <svg className={styles.microsoftIcon} viewBox="0 0 21 21" xmlns="http://www.w3.org/2000/svg">
                                <path d="m.3 0h9.7v9.7h-9.7z" fill="#f25022" />
                                <path d="m11 0h9.7v9.7h-9.7z" fill="#7fba00" />
                                <path d="m.3 11h9.7v9.7h-9.7z" fill="#00a4ef" />
                                <path d="m11 11h9.7v9.7h-9.7z" fill="#ffb900" />
                            </svg>
                            ACCESO CORPORATIVO (AZURE AD)
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
