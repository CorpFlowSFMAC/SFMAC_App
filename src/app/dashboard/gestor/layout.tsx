"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LayoutDashboard, Users, Settings, UserCog, LogOut, Building2, Ticket, DollarSign, BarChart3, Clock, FolderOpen, FileText } from 'lucide-react';
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

    // Cargar datos del usuario desde localStorage y perfil
    useEffect(() => {
        setIsMounted(true);
        const role = localStorage.getItem("userRole");
        const storedName = localStorage.getItem("userName");
        const storedEmail = localStorage.getItem("userEmail");
        const storedAvatar = localStorage.getItem("userAvatar");
        
        setUserRole(role);
        setRealUserName(storedName);
        setUserEmail(storedEmail);
        setUserAvatar(storedAvatar);
        
        // Si el nombre de localStorage parece un email, intentar buscar en perfiles
        if (storedName && storedName.includes('@')) {
            // El nombre guardado es el email, buscar nombre real desde perfil/gestora
            fetchPerfilNombre(storedEmail);
        } else if (storedName) {
            // Usar el nombre almacenado
            setGestoraNombre(storedName);
        }
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

    const avatarLetter = isMounted && realUserName ? realUserName.charAt(0).toUpperCase() : (isMounted && userRole === 'admin' ? 'A' : 'G');
    // Usar el nombre de la gestora desde la DB o fallback
    const displayGestora = isMounted && gestoraNombre ? gestoraNombre : (isMounted && realUserName ? realUserName : 'Gestora');
    const displayName = displayGestora.split(' ')[0]; // Solo el primer nombre
    const fullDisplayName = displayGestora;
    const finalAvatarUrl = userAvatar || (isMounted && fullDisplayName ? `https://ui-avatars.com/api/?name=${encodeURIComponent(fullDisplayName)}&background=f97316&color=fff&bold=true` : null);
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
                            <Link
                                href="/dashboard/gestor"
                                className={`${styles.navItem} ${pathname === '/dashboard/gestor' ? styles.navItemActive : ''}`}
                            >
                                <LayoutDashboard size={20} />
                                Inicio / Métricas
                            </Link>

                            {/* Gestión Técnicos - accesible según rol */}
                            <Link href="/dashboard/gestor" className={styles.navItem} onClick={(e) => { e.preventDefault(); alert('Gestión de Técnicos: Acceso según zona asignada'); }}>
                                <UserCog size={20} />
                                Gestión Técnicos
                            </Link>

                            {/* Sistema Tickets - ir a vista de tickets del gestor */}
                            <Link href="/dashboard/gestor?view=tickets" className={`${styles.navItem} ${pathname.includes('/tickets') ? styles.navItemActive : ''}`}>
                                <Ticket size={20} />
                                Sistema Tickets
                            </Link>

                            {/* Reportes de Eficiencia */}
                            <Link href="/dashboard/gestor?view=reportes" className={`${styles.navItem} ${pathname.includes('/reportes') ? styles.navItemActive : ''}`}>
                                <BarChart3 size={20} />
                                Reportes de Eficiencia
                            </Link>

                            {/* Pagos - solo Admin */}
                            {isMounted && userRole === 'admin' && (
                                <Link href="/dashboard/gestor/payments" className={`${styles.navItem} ${pathname.includes('/payments') ? styles.navItemActive : ''}`}>
                                    <DollarSign size={20} />
                                    Pagos y Tesorería
                                </Link>
                            )}

                            {/* Asistencia - solo Admin */}
                            {isMounted && userRole === 'admin' && (
                                <Link href="/dashboard/gestor/asistencia" className={`${styles.navItem} ${pathname.includes('/asistencia') ? styles.navItemActive : ''}`}>
                                    <Clock size={20} />
                                    Asistencia y Planillas
                                </Link>
                            )}

                            {/* Clients - solo Admin */}
                            {isMounted && userRole === 'admin' && (
                                <Link href="/dashboard/gestor/clients" className={`${styles.navItem} ${pathname.includes('/clients') ? styles.navItemActive : ''}`}>
                                    <Users size={20} />
                                    Gestión Clientes
                                </Link>
                            )}

                            {isMounted && userRole === 'admin' && (
                                <div className={styles.navItem}>
                                    <Settings size={20} />
                                    Configuración
                                </div>
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
