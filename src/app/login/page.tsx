"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { User, Lock, ArrowRight, Loader } from "lucide-react";
import styles from "./login.module.css";
import { useRouter } from "next/navigation";

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
    const [formData, setFormData] = useState({ username: "", password: "" });
    const [error, setError] = useState("");

    useEffect(() => {
        // Random quote on mount
        const randomQuote = QUOTES[Math.floor(Math.random() * QUOTES.length)];
        setQuote(randomQuote);
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError("");

        // Simulate API call
        setTimeout(() => {
            // Mock validation
            if (formData.username && formData.password) {
                if (formData.username === "admin") {
                    // Admin privileges
                    localStorage.setItem("userRole", "admin");
                    router.push("/dashboard/admin");
                } else if (formData.username.startsWith("gestor")) {
                    // Gestor privileges
                    localStorage.setItem("userRole", "gestor");
                    router.push("/dashboard/gestor");
                } else {
                    setError("Credenciales inválidas. Intente nuevamente.");
                    setIsLoading(false);
                }
            } else {
                setError("Por favor ingrese usuario y contraseña.");
                setIsLoading(false);
            }
        }, 1500);
    };

    return (
        <div className={styles.loginContainer}>
            {/* Background Ambience */}
            <div className={`${styles.bgOrb} ${styles.bgOrb1}`} />
            <div className={`${styles.bgOrb} ${styles.bgOrb2}`} />
            <div className={`${styles.bgOrb} ${styles.bgOrb3}`} />

            <div className={styles.contentWrapper}>
                {/* Visual Side (Left) */}
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

                {/* Form Side (Right) */}
                <div className={styles.formSide}>
                    <div className={styles.loginCard}>
                        <div style={{ textAlign: "center" }}>
                            <h1 className={styles.welcomeTitle}>Bienvenido</h1>
                            <p className={styles.welcomeSubtitle}>Inicia sesión para continuar</p>
                        </div>

                        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
                            <div className={styles.inputGroup}>
                                <label className={styles.label}>Usuario</label>
                                <div className={styles.inputWrapper}>
                                    <User className={styles.icon} />
                                    <input
                                        type="text"
                                        placeholder="Ingrese su usuario"
                                        className={styles.input}
                                        value={formData.username}
                                        onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                                    />
                                </div>
                            </div>

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

                            {error && <p style={{ color: "red", fontSize: "0.9rem", textAlign: "center" }}>{error}</p>}

                            <button type="submit" className={styles.submitBtn} disabled={isLoading}>
                                {isLoading ? (
                                    <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem" }}>
                                        <Loader className="animate-spin" size={20} /> Ingresando...
                                    </span>
                                ) : (
                                    <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem" }}>
                                        INICIAR OPERACIONES <ArrowRight size={20} />
                                    </span>
                                )}
                            </button>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    );
}
