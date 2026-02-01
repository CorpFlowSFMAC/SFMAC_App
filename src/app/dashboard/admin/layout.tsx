"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Users, Settings, UserCog, LogOut, Building2, Ticket } from 'lucide-react';
import styles from "./admin.module.css";
import Image from "next/image";

export default function AdminLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const pathname = usePathname();

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
                    />
                    <span style={{ fontWeight: "bold", fontSize: "1.2rem" }}>SINFIMAC</span>
                </div>

                <nav className={styles.nav}>
                    <Link href="/dashboard/admin" className={`${styles.navItem} ${pathname === '/dashboard/admin' ? styles.navItemActive : ''}`}>
                        <LayoutDashboard size={20} />
                        Dashboard
                    </Link>
                    <Link href="/dashboard/admin/clients" className={`${styles.navItem} ${pathname.includes('/clients') ? styles.navItemActive : ''}`}>
                        <Users size={20} />
                        Gestión Clientes
                    </Link>
                    <Link href="/dashboard/admin/technicians" className={`${styles.navItem} ${pathname.includes('/technicians') ? styles.navItemActive : ''}`}>
                        <UserCog size={20} />
                        Gestión Técnicos
                    </Link>
                    <Link href="/dashboard/admin/tickets" className={`${styles.navItem} ${pathname.includes('/tickets') ? styles.navItemActive : ''}`}>
                        <Ticket size={20} />
                        Sistema Tickets
                    </Link>
                    <div className={styles.navItem}>
                        <Settings size={20} />
                        Configuración
                    </div>
                </nav>

                <div style={{ marginTop: "auto" }}>
                    <Link href="/login" className={styles.navItem} style={{ color: "#ff4444" }}>
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
