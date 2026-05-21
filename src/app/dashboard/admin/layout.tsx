"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LayoutDashboard, Users, Settings, UserCog, LogOut, Building2, Ticket, DollarSign, BarChart3, Route, Shield, Clock, Calculator } from 'lucide-react';
import styles from "./admin.module.css";
import Image from "next/image";
import { AppDataProvider } from "@/lib/AppDataContext";
import { QueryProvider } from "@/lib/QueryProvider";
import { supabase } from "@/lib/supabase";

export default function AdminLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const pathname = usePathname();
    const router = useRouter();
    const [userRole, setUserRole] = useState<string | null>(null);
    const [isMounted, setIsMounted] = useState(false);

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

    const [gestoraNombre, setGestoraNombre] = useState<string | null>(null);
    const [userEmail, setUserEmail] = useState<string | null>(null);
    const [realUserName, setRealUserName] = useState<string | null>(null);
    const [userAvatar, setUserAvatar] = useState<string | null>(null);

    useEffect(() => {
        setIsMounted(true);
        
        const loadUserData = async () => {
            // 1. Intentar desde localStorage
            let role = localStorage.getItem("userRole");
            let name = localStorage.getItem("userName");
            let avatar = localStorage.getItem("userAvatar");
            let email = localStorage.getItem("userEmail");
            
            // 2. Fallback a cookies (Azure AD redirecciones no setean localStorage)
            const getCookie = (cookieName: string): string | null => {
                const value = `; ${document.cookie}`;
                const parts = value.split(`; ${cookieName}=`);
                if (parts.length === 2) return parts.pop()?.split(';').shift() || null;
                return null;
            };

            if (!role) role = getCookie('userRole');
            if (!name) name = getCookie('userName');
            if (!avatar) avatar = getCookie('userAvatar');
            if (!email) email = getCookie('userEmail');

            // 3. Fallback definitivo: Sesión de Supabase
            if (!email) {
                const { data: { user } } = await supabase.auth.getUser();
                if (user) {
                    email = user.email || null;
                    if (!role) role = user.user_metadata?.role || 'admin';
                }
            }
            
            // Sincronizar cookies → localStorage
            if (role) localStorage.setItem("userRole", role);
            if (name) localStorage.setItem("userName", name || '');
            if (avatar) localStorage.setItem("userAvatar", avatar || '');
            if (email) localStorage.setItem("userEmail", email || '');
            
            setUserRole(role);
            setRealUserName(name);
            setUserAvatar(avatar);
            setUserEmail(email);

            // Buscar nombre real siempre que tengamos un email
            if (email) {
                fetchPerfilNombre(email);
            } else if (name && !name.includes('@')) {
                setGestoraNombre(name);
            }
        };

        loadUserData();
    }, []);

    // Buscar nombre real desde perfil o gestora
    // Con mejor manejo de errores para evitar HTTP 400
    const fetchPerfilNombre = async (email: string | null) => {
        if (!email) return;
        try {
            // Buscar en perfiles primero
            const { data: p, error: errorP } = await supabase
                .from('perfiles')
                .select('id, nombre_completo, nombre')
                .ilike('email', email)
                .maybeSingle();
            
            if (errorP) {
                console.warn('[AdminLayout] Error perfiles:', errorP.message);
            }
            
            if (p?.nombre_completo || p?.nombre) {
                setGestoraNombre(p.nombre_completo || p.nombre);
                return;
            }

            // Fallback a gestoras
            const { data: g, error: errorG } = await supabase
                .from('gestoras')
                .select('id, name, nombre')
                .ilike('email', email)
                .maybeSingle();
            
            if (errorG) {
                console.warn('[AdminLayout] Error gestoras:', errorG.message);
            }
            
            if (g?.name || g?.nombre) {
                setGestoraNombre(g.name || g.nombre);
            } else {
                setGestoraNombre(email.split('@')[0]);
            }
        } catch (e) {
            // Silencioso - fallback seguro
            setGestoraNombre(email.split('@')[0]);
        }
    };

    const isAdmin = isMounted && userRole?.toLowerCase() === 'admin';
    const avatarLetter = isMounted && gestoraNombre ? gestoraNombre.charAt(0).toUpperCase() : (isMounted && realUserName ? realUserName.charAt(0).toUpperCase() : (isAdmin ? 'A' : 'G'));
    const displayGestora = isMounted && gestoraNombre ? gestoraNombre : (isMounted && realUserName ? realUserName : (isMounted && userEmail ? userEmail.split('@')[0] : (isAdmin ? 'Administrador' : 'Gestora')));
    const fullDisplayName = displayGestora;
    const displayName = fullDisplayName.split(' ')[0]; // Solo el primer nombre
    const finalAvatarUrl = userAvatar || (isMounted && fullDisplayName && fullDisplayName !== 'Gestora' && fullDisplayName !== 'Administrador' ? `https://ui-avatars.com/api/?name=${encodeURIComponent(fullDisplayName)}&background=f97316&color=fff&bold=true` : null);
    const dashboardHref = isAdmin ? "/dashboard/admin" : "/dashboard/gestor";

    const motivationalPhrases = [
        "¡Hoy es un gran día para lograr metas!",
        "Tu esfuerzo construye el futuro.",
        "Cada acción cuenta, ¡adelante!",
        "Juntos somos más fuertes.",
        "El éxito es el resultado de tu dedicación.",
    ];
    const motivationalPhrase = isMounted ? motivationalPhrases[new Date().getDay() % motivationalPhrases.length] : "";

    return (
        <QueryProvider>
            <AppDataProvider>
                <div className={styles.adminContainer}>
                    {/* Sidebar */}
                    <aside className={styles.sidebar}>
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
                            {/* Dashboard Link for both roles, pointing to their respective home */}
                            <Link
                                href={dashboardHref}
                                className={`${styles.navItem} ${pathname === '/dashboard/admin' || pathname === '/dashboard/gestor' ? styles.navItemActive : ''}`}
                            >
                                <LayoutDashboard size={20} />
                                Inicio / Métricas
                            </Link>

                            {isAdmin && (
                                <Link href="/dashboard/admin/clients" className={`${styles.navItem} ${pathname.includes('/clients') ? styles.navItemActive : ''}`}>
                                    <Users size={20} />
                                    Gestión Clientes
                                </Link>
                            )}

                            <Link href="/dashboard/admin/technicians" className={`${styles.navItem} ${pathname.includes('/technicians') ? styles.navItemActive : ''}`}>
                                <UserCog size={20} />
                                Gestión Técnicos
                            </Link>

                            <Link href="/dashboard/admin/tickets" className={`${styles.navItem} ${pathname.includes('/tickets') ? styles.navItemActive : ''}`}>
                                <Ticket size={20} />
                                Sistema Tickets
                            </Link>

                            {isAdmin && (
                                <Link href="/dashboard/admin/payments" className={`${styles.navItem} ${pathname.includes('/payments') ? styles.navItemActive : ''}`}>
                                    <DollarSign size={20} />
                                    Pagos y Tesorería
                                </Link>
                            )}

                            <Link href="/dashboard/admin/reportes" className={`${styles.navItem} ${pathname.includes('/reportes') ? styles.navItemActive : ''}`}>
                                <BarChart3 size={20} />
                                Reportes de Eficiencia
                            </Link>

                            {isAdmin && (
                                <Link href="/dashboard/admin/routing" className={`${styles.navItem} ${pathname.includes('/routing') ? styles.navItemActive : ''}`}>
                                    <Route size={20} />
                                    Enrutamiento
                                </Link>
                            )}

                            {isAdmin && (
                                <Link href="/dashboard/admin/asistencia" className={`${styles.navItem} ${pathname.includes('/asistencia') ? styles.navItemActive : ''}`}>
                                    <Clock size={20} />
                                    Asistencia y Planillas
                                </Link>
                            )}

                            {isAdmin && (
                                <Link href="/dashboard/admin/closing" className={`${styles.navItem} ${pathname.includes('/closing') ? styles.navItemActive : ''}`}>
                                    <Calculator size={20} />
                                    Cierre de Mes
                                </Link>
                            )}

                            {isAdmin && (
                                <Link href="/dashboard/admin/usuarios" className={`${styles.navItem} ${pathname.includes('/usuarios') ? styles.navItemActive : ''}`}>
                                    <Shield size={20} />
                                    Usuarios y Accesos
                                </Link>
                            )}
                        </nav>

                        <div style={{ marginTop: "auto" }}>
                            <button
                                className={styles.navItem}
                                style={{ color: "#ff4444", background: "none", border: "none", cursor: "pointer", width: "100%", textAlign: "left" }}
                                onClick={handleLogout}
                            >
                                <LogOut size={20} />
                                Cerrar Sesión
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
