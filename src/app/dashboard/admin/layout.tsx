"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LayoutDashboard, Users, UserCog, LogOut, Ticket, DollarSign, BarChart3, Route, Shield, Clock, Calculator, Menu, X } from 'lucide-react';
import styles from "./admin.module.css";
import Image from "next/image";
import { AppDataProvider } from "@/lib/AppDataContext";
import { QueryProvider } from "@/lib/QueryProvider";
import { supabase } from "@/lib/supabase";
import { supabaseAdmin, startAdminSessionKeepAlive } from "@/lib/supabase-admin";

export default function AdminLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const pathname = usePathname();
    const router = useRouter();
    const [userRole, setUserRole] = useState<string | null>(null);
    const [isMounted, setIsMounted] = useState(false);
    const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

    const handleLogout = async () => {
        try {
            await fetch('/api/auth/logout', { method: 'POST' });
        } catch (e) {
            console.error('Logout error:', e);
        }
        await supabase.auth.signOut({ scope: 'local' });
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
    const [sessionActiva, setSessionActiva] = useState(false);

    useEffect(() => {
        setIsMounted(true);
        
        const loadUserData = async () => {
            // 1. Intentar desde localStorage
            let role = localStorage.getItem("userRole");
            let storedEmail = localStorage.getItem("userEmail");
            if (storedEmail && storedEmail.includes('%40')) {
                storedEmail = decodeURIComponent(storedEmail);
            }
            let storedAvatar = localStorage.getItem("userAvatar");
            let email = storedEmail;
            let name = localStorage.getItem("userName");
            let avatar = storedAvatar;
            
            // 2. Fallback a cookies (Azure AD redirecciones no setean localStorage)
            const getCookie = (cookieName: string): string | null => {
                const value = `; ${document.cookie}`;
                const parts = value.split(`; ${cookieName}=`);
                if (parts.length === 2) {
                    const raw = parts.pop()?.split(';').shift();
                    return raw ? decodeURIComponent(raw) : null;
                }
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

            // Verificar sesión activa de Supabase Auth
            const { data: { session } } = await supabase.auth.getSession();
            setSessionActiva(!!session || !!email);

            // Buscar nombre real siempre que tengamos un email
            if (email) {
                fetchPerfilNombre(email);
            } else if (name && !name.includes('@')) {
                setGestoraNombre(name);
            }
        };

        loadUserData();
    }, []);

    // ── Sesión permanente para admin ──────────────────────────────────────────
    useEffect(() => {
        if (!isMounted) return;
        const role = (userRole || '').toLowerCase();
        if (role !== 'admin') return;

        // Sincronizar la sesión activa al cliente admin persistente
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (session) {
                // Establecer la misma sesión en el cliente admin (con persistSession=true)
                supabaseAdmin.auth.setSession({
                    access_token: session.access_token,
                    refresh_token: session.refresh_token,
                }).catch(() => {});
            }
        });

        // Activar el keep-alive infinito
        const cleanup = startAdminSessionKeepAlive();
        return cleanup;
    }, [isMounted, userRole]);

    // Buscar nombre real desde perfil o gestora (solo cuando email está disponible y válido)
    // Con mejor manejo de errores para evitar HTTP 400
    const fetchPerfilNombre = async (email: string | null) => {
        if (!email || typeof email !== 'string' || !email.includes('@')) return;
        try {
            // Buscar en perfiles primero (case-insensitive con eq)
            const { data: p, error: errorP } = await supabase
                .from('perfiles')
                .select('id, nombre_completo')
                .eq('email', email.toLowerCase())
                .maybeSingle();
            
            if (errorP) {
                console.warn('[AdminLayout] Error perfiles:', errorP.message);
            }
            
            if (p?.nombre_completo) {
                setGestoraNombre(p.nombre_completo);
                return;
            }

            // Fallback a gestoras (case-insensitive con eq)
            const { data: g, error: errorG } = await supabase
                .from('gestoras')
                .select('id, name')
                .eq('email', email.toLowerCase())
                .maybeSingle();
            
            if (errorG) {
                console.warn('[AdminLayout] Error gestoras:', errorG.message);
            }
            
            if (g?.name) {
                setGestoraNombre(g.name);
            } else {
                setGestoraNombre(email.split('@')[0]);
            }
        } catch (e) {
            // Silencioso - fallback seguro
            setGestoraNombre(email.split('@')[0]);
        }
    };

    const getCleanDisplayName = (rawName: string) => {
        if (!rawName) return "Usuario";
        try {
            let decoded = decodeURIComponent(rawName);
            if (decoded.includes('@')) decoded = decoded.split('@')[0];
            if (decoded.includes('.')) {
                const parts = decoded.split('.');
                return parts.map((p, i) => i === 0 && p.length === 1 ? p.toUpperCase() + '.' : p.charAt(0).toUpperCase() + p.slice(1)).join(' ');
            }
            return decoded;
        } catch(e) { return rawName; }
    };

    const isAdmin = isMounted && userRole?.toLowerCase() === 'admin';
    const avatarLetter = isMounted && gestoraNombre ? gestoraNombre.charAt(0).toUpperCase() : (isMounted && realUserName ? realUserName.charAt(0).toUpperCase() : (isAdmin ? 'A' : 'G'));
    const displayGestora = isMounted && gestoraNombre ? gestoraNombre : (isMounted && realUserName ? realUserName : (isMounted && userEmail ? userEmail.split('@')[0] : (isAdmin ? 'Administrador' : 'Gestora')));
    const fullDisplayName = displayGestora;
    const displayName = getCleanDisplayName(fullDisplayName); // Usar nombre amigable
    const finalAvatarUrl = userAvatar || (isMounted && fullDisplayName && fullDisplayName !== 'Gestora' && fullDisplayName !== 'Administrador' ? `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=f97316&color=fff&bold=true` : null);
    const dashboardHref = "/dashboard/admin";

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
                    {/* ── Overlay oscuro para cerrar sidebar en móvil ── */}
                    {mobileSidebarOpen && (
                        <div
                            className={styles.mobileOverlay}
                            onClick={() => setMobileSidebarOpen(false)}
                            aria-hidden="true"
                        />
                    )}

                    {/* ── Botón hamburguesa flotante (solo móvil) ── */}
                    <button
                        className={styles.hamburgerBtn}
                        onClick={() => setMobileSidebarOpen(o => !o)}
                        aria-label={mobileSidebarOpen ? 'Cerrar menú' : 'Abrir menú'}
                    >
                        {mobileSidebarOpen ? <X size={22} /> : <Menu size={22} />}
                    </button>

                    {/* Sidebar */}
                    <aside className={`${styles.sidebar} ${mobileSidebarOpen ? styles.sidebarMobileOpen : ''}`}>
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
                                <span className={styles.userStatus} style={{
                                    color: sessionActiva ? '#22c55e' : '#94a3b8',
                                    display: 'flex', alignItems: 'center', gap: '4px'
                                }}>
                                    <span style={{
                                        width: '7px', height: '7px', borderRadius: '50%',
                                        background: sessionActiva ? '#22c55e' : '#94a3b8',
                                        display: 'inline-block', flexShrink: 0
                                    }} />
                                    {sessionActiva ? 'En Línea' : 'Conectado'}
                                </span>
                                {isMounted && (
                                    <span className={styles.userMotivation}>{motivationalPhrase}</span>
                                )}
                            </div>
                        </div>

                        <nav className={styles.nav}>
                            {/* Dashboard Link for both roles, pointing to their respective home */}
                            <Link
                                href={dashboardHref}
                                prefetch={false}
                                className={`${styles.navItem} ${pathname === '/dashboard/admin' || pathname === '/dashboard/gestor' ? styles.navItemActive : ''}`}
                            >
                                <LayoutDashboard size={20} />
                                Inicio / Métricas
                            </Link>

                            <Link href="/dashboard/admin/clients" prefetch={false} className={`${styles.navItem} ${pathname.includes('/clients') ? styles.navItemActive : ''}`}>
                                <Users size={20} />
                                <span className={styles.navText}>Gestión Clientes</span>
                            </Link>

                            <Link href="/dashboard/admin/technicians" prefetch={false} className={`${styles.navItem} ${pathname.includes('/technicians') ? styles.navItemActive : ''}`}>
                                <UserCog size={20} />
                                Gestión Técnicos
                            </Link>

                            <Link href="/dashboard/admin/tickets" prefetch={false} className={`${styles.navItem} ${pathname.includes('/tickets') ? styles.navItemActive : ''}`}>
                                <Ticket size={20} />
                                Sistema Tickets
                            </Link>

                            <Link href="/dashboard/admin/payments" prefetch={false} className={`${styles.navItem} ${pathname.includes('/payments') ? styles.navItemActive : ''}`}>
                                <DollarSign size={20} />
                                <span className={styles.navText}>Pagos y Tesorería</span>
                            </Link>

                            <Link href="/dashboard/admin/reportes" prefetch={false} className={`${styles.navItem} ${pathname.includes('/reportes') ? styles.navItemActive : ''}`}>
                                <BarChart3 size={20} />
                                Reportes de Eficiencia
                            </Link>

                            <Link href="/dashboard/admin/routing" prefetch={false} className={`${styles.navItem} ${pathname.includes('/routing') ? styles.navItemActive : ''}`}>
                                <Route size={20} />
                                <span className={styles.navText}>Enrutamiento AI</span>
                            </Link>

                            <Link href="/dashboard/admin/asistencia" prefetch={false} className={`${styles.navItem} ${pathname.includes('/asistencia') ? styles.navItemActive : ''}`}>
                                <Clock size={20} />
                                <span className={styles.navText}>Asistencia Personal</span>
                            </Link>

                            <Link href="/dashboard/admin/closing" prefetch={false} className={`${styles.navItem} ${pathname.includes('/closing') ? styles.navItemActive : ''}`}>
                                <Calculator size={20} />
                                <span className={styles.navText}>Cierre del Mes</span>
                            </Link>

                            <Link href="/dashboard/admin/usuarios" prefetch={false} className={`${styles.navItem} ${pathname.includes('/usuarios') ? styles.navItemActive : ''}`}>
                                <Shield size={20} />
                                <span className={styles.navText}>Usuarios RBAC</span>
                            </Link>
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

                    {/* ── Bottom Navigation Bar (solo móvil) ── */}
                    <nav className={styles.mobileBottomNav} aria-label="Navegación principal móvil">
                        <Link
                            href="/dashboard/admin"
                            className={`${styles.bottomNavItem} ${pathname === '/dashboard/admin' ? styles.bottomNavItemActive : ''}`}
                        >
                            <LayoutDashboard size={22} />
                            <span>Inicio</span>
                        </Link>
                        <Link
                            href="/dashboard/admin/tickets"
                            className={`${styles.bottomNavItem} ${pathname.includes('/tickets') ? styles.bottomNavItemActive : ''}`}
                        >
                            <Ticket size={22} />
                            <span>Tickets</span>
                        </Link>
                        <Link
                            href="/dashboard/admin/payments"
                            className={`${styles.bottomNavItem} ${pathname.includes('/payments') || pathname.includes('/tesoreria') ? styles.bottomNavItemActive : ''}`}
                        >
                            <DollarSign size={22} />
                            <span>Tesorería</span>
                        </Link>
                        <Link
                            href="/dashboard/admin/reportes"
                            className={`${styles.bottomNavItem} ${pathname.includes('/reportes') ? styles.bottomNavItemActive : ''}`}
                        >
                            <BarChart3 size={22} />
                            <span>Reportes</span>
                        </Link>
                        <button
                            className={styles.bottomNavItem}
                            onClick={() => setMobileSidebarOpen(true)}
                            aria-label="Más opciones"
                        >
                            <Menu size={22} />
                            <span>Más</span>
                        </button>
                    </nav>
                </div>
            </AppDataProvider>
        </QueryProvider>
    );
}
