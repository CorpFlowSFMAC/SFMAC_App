"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LayoutDashboard, Users, Settings, UserCog, LogOut, Building2, Ticket, DollarSign, BarChart3, Clock } from 'lucide-react';
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

    const handleLogout = async () => {
        await supabase.auth.signOut({ scope: 'global' });
        document.cookie = "userRole=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC;";
        localStorage.removeItem("userRole");
        localStorage.removeItem("userEmail");
        localStorage.removeItem("userName");
        localStorage.removeItem("userAvatar");
        localStorage.removeItem("rbacRole");
        router.push("/login");
    };

    const [realUserName, setRealUserName] = useState<string | null>(null);

    const [userAvatar, setUserAvatar] = useState<string | null>(null);

    useEffect(() => {
        setIsMounted(true);
        const role = localStorage.getItem("userRole");
        const storedName = localStorage.getItem("userName");
        const storedAvatar = localStorage.getItem("userAvatar");
        setUserRole(role);
        setRealUserName(storedName);
        setUserAvatar(storedAvatar);
    }, []);

    const avatarLetter = isMounted && realUserName ? realUserName.charAt(0).toUpperCase() : (isMounted && userRole === 'admin' ? 'A' : 'G');
    const fullDisplayName = isMounted && realUserName ? realUserName : (isMounted && userRole === 'admin' ? 'Administrador' : 'Gestora Operativa');
    const displayName = fullDisplayName.split(' ')[0]; // Solo el primer nombre
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
                                href={dashboardHref}
                                className={`${styles.navItem} ${pathname === '/dashboard/admin' || pathname === '/dashboard/gestor' ? styles.navItemActive : ''}`}
                            >
                                <LayoutDashboard size={20} />
                                Inicio / Métricas
                            </Link>

                            {/* Links always visible for Gestora (Admin sees more in admin layout) */}
                            <Link href="/dashboard/admin/technicians" className={`${styles.navItem} ${pathname.includes('/technicians') ? styles.navItemActive : ''}`}>
                                <UserCog size={20} />
                                Gestión Técnicos
                            </Link>

                            <Link href="/dashboard/admin/tickets" className={`${styles.navItem} ${pathname.includes('/tickets') ? styles.navItemActive : ''}`}>
                                <Ticket size={20} />
                                Sistema Tickets
                            </Link>

                            {isMounted && userRole === 'admin' && (
                                <Link href="/dashboard/admin/payments" className={`${styles.navItem} ${pathname.includes('/payments') ? styles.navItemActive : ''}`}>
                                    <DollarSign size={20} />
                                    Pagos y Tesorería
                                </Link>
                            )}

                            <Link href="/dashboard/admin/reportes" className={`${styles.navItem} ${pathname.includes('/reportes') ? styles.navItemActive : ''}`}>
                                <BarChart3 size={20} />
                                Reportes de Eficiencia
                            </Link>

                            {isMounted && userRole === 'admin' && (
                                <Link href="/dashboard/admin/asistencia" className={`${styles.navItem} ${pathname.includes('/asistencia') ? styles.navItemActive : ''}`}>
                                    <Clock size={20} />
                                    Asistencia y Planillas
                                </Link>
                            )}

                            {isMounted && userRole === 'admin' && (
                                <Link href="/dashboard/admin/clients" className={`${styles.navItem} ${pathname.includes('/clients') ? styles.navItemActive : ''}`}>
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
