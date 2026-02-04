"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Users, Settings, UserCog, LogOut, Building2, Ticket, DollarSign, BarChart3 } from 'lucide-react';
import styles from "./admin.module.css";
import Image from "next/image";

export default function AdminLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const pathname = usePathname();
    const [userRole, setUserRole] = useState<string | null>(null);
    const [isMounted, setIsMounted] = useState(false);

    useEffect(() => {
        setIsMounted(true);
        const role = localStorage.getItem("userRole");
        setUserRole(role);
    }, []);

    // Prevent hydration mismatch by returning a consistent shell until mounted
    const avatarLetter = isMounted && userRole === 'admin' ? 'A' : 'G';
    const userName = isMounted && userRole === 'admin' ? 'Administrador' : 'Gestora Operativa';
    const dashboardHref = isMounted && userRole === 'admin' ? "/dashboard/admin" : "/dashboard/gestor";

    return (
        <div className={styles.adminContainer}>
            {/* Sidebar */}
            <aside className={styles.sidebar}>
                <div className={styles.sidebarHeader}>
                    <Image
                        src="/logo-final.png"
                        alt="Logo"
                        width={40}
                        height={40}
                        style={{ objectFit: "contain" }}
                        unoptimized
                        priority
                    />
                    <span style={{ fontWeight: "bold", fontSize: "1.2rem" }}>SINFIMAC</span>
                </div>

                <div className={styles.userProfileMini}>
                    <div className={styles.avatarCircle}>
                        {avatarLetter}
                    </div>
                    <div className={styles.userMeta}>
                        <span className={styles.userName}>{userName}</span>
                        <span className={styles.userStatus}>En Línea</span>
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

                    {isMounted && userRole === 'admin' && (
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

                    <Link href="/dashboard/admin/payments" className={`${styles.navItem} ${pathname.includes('/payments') ? styles.navItemActive : ''}`}>
                        <DollarSign size={20} />
                        Pagos y Tesorería
                    </Link>

                    <Link href="/dashboard/admin/reportes" className={`${styles.navItem} ${pathname.includes('/reportes') ? styles.navItemActive : ''}`}>
                        <BarChart3 size={20} />
                        Reportes de Eficiencia
                    </Link>

                    {isMounted && userRole === 'admin' && (
                        <div className={styles.navItem}>
                            <Settings size={20} />
                            Configuración
                        </div>
                    )}
                </nav>

                <div style={{ marginTop: "auto" }}>
                    <Link
                        href="/login"
                        className={styles.navItem}
                        style={{ color: "#ff4444" }}
                        onClick={() => {
                            document.cookie = "userRole=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC;";
                            localStorage.removeItem("userRole");
                        }}
                    >
                        <LogOut size={20} />
                        Cerrar Sesión
                    </Link>
                </div>
            </aside>

            {/* Main Content */}
            <main className={styles.mainContent}>
                {children}
            </main>
        </div>
    );
}
