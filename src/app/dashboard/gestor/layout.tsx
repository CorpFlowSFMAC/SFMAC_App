"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LayoutDashboard, Users, Settings, UserCog, LogOut, Building2, Ticket, BarChart3, Clock, FolderOpen, FileText } from 'lucide-react';
import styles from "@/app/dashboard/admin/admin.module.css";
import Image from "next/image";
import { AppDataProvider } from "@/lib/AppDataContext";
import { QueryProvider } from "@/lib/QueryProvider";
import { supabase } from "@/lib/supabase";

export default function GestorLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const pathname = usePathname();
    const router = useRouter();
    const [userRole, setUserRole] = useState<string | null>(null);
    const [isMounted, setIsMounted] = useState(false);
    const [userEmail, setUserEmail] = useState<string | null>(null);
    const [realUserName, setRealUserName] = useState<string | null>(null);
    const [userAvatar, setUserAvatar] = useState<string | null>(null);
    const [gestoraNombre, setGestoraNombre] = useState<string | null>(null);

    // Cargar datos del usuario desde cookies, localStorage y sesión de Supabase
    useEffect(() => {
        setIsMounted(true);
        
        const loadUserData = async () => {
            // 1. Intentar desde localStorage
            let role = localStorage.getItem("userRole");
            let storedName = localStorage.getItem("userName");
            let storedEmail = localStorage.getItem("userEmail");
            let storedAvatar = localStorage.getItem("userAvatar");
            
            // 2. Fallback a cookies (Azure AD redirecciones no setean localStorage)
            if (!storedEmail || !role) {
            const getCookie = (name: string): string | null => {
                const value = `; ${document.cookie}`;
                const parts = value.split(`; ${name}=`);
                if (parts.length === 2) return parts.pop()?.split(';').shift() || null;
                return null;
            };
            
            if (!role) role = getCookie('userRole');
            if (!storedEmail) storedEmail = getCookie('userEmail');
            }

            // 3. Fallback definitivo: Sesión de Supabase
            if (!storedEmail) {
                const { data: { user } } = await supabase.auth.getUser();
                if (user) {
                    storedEmail = user.email || null;
                    if (!role) role = user.user_metadata?.role || 'gestor';
                }
            }
            
            setUserRole(role);
            setRealUserName(storedName);
            setUserEmail(storedEmail);
            setUserAvatar(storedAvatar);
            
            // Buscar nombre real siempre que tengamos un email
            if (storedEmail) {
                fetchPerfilNombre(storedEmail);
            } else if (storedName && !storedName.includes('@')) {
                setGestoraNombre(storedName);
            }
        };

        loadUserData();
    }, []);

    // Buscar nombre real desde perfil o gestora
    const fetchPerfilNombre = async (email: string | null) => {
        if (!email) return;
        
        try {
            // Buscar en tabla gestoras por email
            const { data: g } = await supabase
                .from('gestoras')
                .select('id, name, nombre')
                .ilike('email', email)
                .maybeSingle();
            
            if (g?.name || g?.nombre) {
                setGestoraNombre(g.name || g.nombre);
                return;
            }
            
            // Buscar en perfiles
            const { data: p } = await supabase
                .from('perfiles')
                .select('id, nombre_completo, nombre')
                .ilike('email', email)
                .maybeSingle();
            
            if (p?.nombre_completo || p?.nombre) {
                setGestoraNombre(p.nombre_completo || p.nombre);
            } else {
                //Fallback: usar el nombre desde Azure/email
                setGestoraNombre(email.split('@')[0]);
            }
        } catch (e) {
            console.log('[GestorLayout] Error fetching perfil:', e);
            setGestoraNombre(email.split('@')[0]);
        }
    };

    const avatarLetter = isMounted && gestoraNombre ? gestoraNombre.charAt(0).toUpperCase() : (isMounted && realUserName ? realUserName.charAt(0).toUpperCase() : (isMounted && userRole === 'admin' ? 'A' : 'G'));
    // Usar el nombre de la gestora desde la DB o fallback
    const displayGestora = isMounted && gestoraNombre ? gestoraNombre : (isMounted && realUserName ? realUserName : (isMounted && userEmail ? userEmail.split('@')[0] : 'Gestora'));
    const displayName = displayGestora.split(' ')[0]; // Solo el primer nombre
    const fullDisplayName = displayGestora;
    const finalAvatarUrl = userAvatar || (isMounted && fullDisplayName && fullDisplayName !== 'Gestora' ? `https://ui-avatars.com/api/?name=${encodeURIComponent(fullDisplayName)}&background=f97316&color=fff&bold=true` : null);
    const dashboardHref = isMounted && userRole === 'admin' ? "/dashboard/admin" : "/dashboard/gestor";

    const motivationalPhrases = [
        "¡Hoy es un gran día para lograr metas!",
        "Tu esfuerzo construye el futuro.",
        "Cada acción cuenta, ¡adelante!",
        "Juntos somos más fuertes.",
        "El éxito es el resultado de tu dedicación.",
    ];
    const motivationalPhrase = isMounted ? motivationalPhrases[new Date().getDay() % motivationalPhrases.length] : "";

    const handleLogout = async () => {
        try {
            await fetch('/api/auth/logout', { method: 'POST' });
        } catch (e) {
            console.error('Logout error:', e);
        }
        await supabase.auth.signOut({ scope: 'global' });
        document.cookie = "userRole=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC;";
        document.cookie = "auth_status=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC;";
        document.cookie = "azure_code=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC;";
        localStorage.removeItem("userRole");
        localStorage.removeItem("userEmail");
        localStorage.removeItem("userName");
        localStorage.removeItem("userAvatar");
        localStorage.removeItem("rbacRole");
        window.location.href = "/login";
    };

    return (
        <QueryProvider>
            <AppDataProvider>
                <div className={styles.adminContainer}>
                    {/* Sidebar */}
                    <aside className={`${styles.sidebar} ${styles.sidebarMini}`}>
                        <div className={styles.sidebarHeader}>
                            <Image
                                src="/logo-final.png"
                                alt="Logo"
                                width={44}
                                height={44}
                                style={{ objectFit: "contain" }}
                                unoptimized
                                priority
                            />
                            <div className={styles.brandNameContainer}>
                                <span className={styles.brandMain}>SINFIMAC</span>
                                <span className={styles.brandSub}>CORP.</span>
                            </div>
                        </div>

                        <div className={styles.userProfileMini}>
                            <div className={styles.avatarCircle} style={{ padding: finalAvatarUrl ? 0 : '', overflow: 'hidden' }}>
                                {finalAvatarUrl ? (
                                    <img src={finalAvatarUrl} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                ) : (
                                    avatarLetter
                                )}
                            </div>
                            <div className={styles.userMeta}>
                                <span className={styles.userName}>{displayName}</span>
                                <span className={styles.userStatus}>En Línea</span>
                                {isMounted && (
                                    <span className={styles.userMotivation}>{motivationalPhrase}</span>
                                )}
                            </div>
                        </div>

                        <nav className={styles.nav}>
                            <Link
                                href="/dashboard/gestor/metrics"
                                className={`${styles.navItem} ${pathname.includes('/metrics') ? styles.navItemActive : ''}`}
                                title="Inicio / Métricas"
                            >
                                <LayoutDashboard size={20} />
                                <span className={styles.navText}>Inicio / Métricas</span>
                            </Link>

                            <Link href="/dashboard/gestor/tickets" className={`${styles.navItem} ${pathname.includes('/tickets') ? styles.navItemActive : ''}`} title="Sistema Tickets">
                                <Ticket size={20} />
                                <span className={styles.navText}>Sistema Tickets</span>
                            </Link>

                            <Link href="/dashboard/gestor/technicians" className={`${styles.navItem} ${pathname.includes('/technicians') ? styles.navItemActive : ''}`} title="Mis Técnicos">
                                <UserCog size={20} />
                                <span className={styles.navText}>Mis Técnicos</span>
                            </Link>

                            <Link href="/dashboard/gestor/reportes" className={`${styles.navItem} ${pathname.includes('/reportes') ? styles.navItemActive : ''}`} title="Reportes de Eficiencia">
                                <BarChart3 size={20} />
                                <span className={styles.navText}>Reportes de Eficiencia</span>
                            </Link>
                        </nav>

                        <div style={{ marginTop: "auto", overflow: 'hidden' }}>
                            <button
                                className={styles.navItem}
                                style={{ color: "#ff4444", background: "none", border: "none", cursor: "pointer", width: "100%", textAlign: "left" }}
                                onClick={handleLogout}
                                title="Cerrar Sesión"
                            >
                                <LogOut size={20} />
                                <span className={styles.navText}>Cerrar Sesión</span>
                            </button>
                        </div>
                    </aside>

                    {/* Main Content */}
                    <main className={styles.mainContent}>
                        {children}
                    </main>
                </div>
            </AppDataProvider>
        </QueryProvider>
    );
}
