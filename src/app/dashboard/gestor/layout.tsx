"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, LogOut, Ticket, Sparkles, UserCog, DollarSign } from 'lucide-react';
import styles from "../admin/admin.module.css";
import Image from "next/image";

export default function GestorLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const pathname = usePathname();
    const [userRole, setUserRole] = useState<string | null>(null);

    useEffect(() => {
        if (typeof window !== 'undefined') {
            setUserRole(localStorage.getItem("userRole"));
        }
    }, []);

    return (
        <div className={styles.adminContainer}>
            {/* Sidebar Reutilizada pero adaptada a Gestora */}
            <aside className={styles.sidebar}>
                <div className={styles.sidebarHeader}>
                    <Image
                        src="/logo-final.png"
                        alt="Logo"
                        width={40}
                        height={40}
                        style={{ objectFit: "contain" }}
                    />
                    <span style={{ fontWeight: "bold", fontSize: "1.2rem" }}>SINFIMAC</span>
                </div>

                <div className={styles.userProfileMini}>
                    <div className={styles.avatarCircle} style={{ background: '#FF6600' }}>G</div>
                    <div className={styles.userMeta}>
                        <span className={styles.userName}>Gestora Operativa</span>
                        <span className={styles.userStatus}>En Línea</span>
                    </div>
                </div>

                <nav className={styles.nav}>
                    <Link href="/dashboard/gestor" className={`${styles.navItem} ${pathname === '/dashboard/gestor' ? styles.navItemActive : ''}`}>
                        <LayoutDashboard size={20} />
                        Inicio / Métricas
                    </Link>

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
                        Control de Pagos
                    </Link>

                    <div className={styles.navItem} style={{ opacity: 0.5, cursor: 'not-allowed' }}>
                        <Sparkles size={20} />
                        Config. Bloqueada
                    </div>
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
