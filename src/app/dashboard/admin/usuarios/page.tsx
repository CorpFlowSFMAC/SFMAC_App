"use client";

import React, { useState, useMemo } from "react";
import {
    Shield, Users, Search, Loader2, CheckCircle2, XCircle,
    UserCheck, Clock, Eye, ShieldOff, Info
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { perfilesAPI, type Perfil, type UserRole } from "@/lib/profiles-api";
import styles from "./usuarios.module.css";

interface Toast {
    message: string;
    type: "success" | "error";
}

const ROLE_CONFIG: Record<UserRole, { label: string; icon: React.ReactNode; avatarClass: string; selectClass: string; color: string }> = {
    ADMIN: {
        label: "Administrador",
        icon: <Shield size={14} />,
        avatarClass: styles.userAvatarAdmin,
        selectClass: styles.roleSelectAdmin,
        color: "#8B5CF6"
    },
    GESTORA: {
        label: "Gestor(a) Operativo(a)",
        icon: <UserCheck size={14} />,
        avatarClass: styles.userAvatarGestora,
        selectClass: styles.roleSelectGestora,
        color: "#10B981"
    },
    ESPECTADOR: {
        label: "Espectador",
        icon: <Eye size={14} />,
        avatarClass: styles.userAvatarEspectador,
        selectClass: styles.roleSelectEspectador,
        color: "#3B82F6"
    },
    SIN_ACCESO: {
        label: "Sin acceso",
        icon: <ShieldOff size={14} />,
        avatarClass: styles.userAvatarSinAcceso,
        selectClass: styles.roleSelectSinAcceso,
        color: "#6B7280"
    }
};

function getInitials(name: string | null, email: string): string {
    if (name && name.trim()) {
        const parts = name.trim().split(/\s+/);
        if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
        return parts[0].substring(0, 2).toUpperCase();
    }
    return email.substring(0, 2).toUpperCase();
}

function formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString("es-PE", {
        year: "numeric",
        month: "short",
        day: "numeric",
    });
}

function timeAgo(dateString: string): string {
    const now = new Date();
    const date = new Date(dateString);
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return "Hoy";
    if (diffDays === 1) return "Ayer";
    if (diffDays < 7) return `Hace ${diffDays} días`;
    if (diffDays < 30) return `Hace ${Math.floor(diffDays / 7)} semanas`;
    return `Hace ${Math.floor(diffDays / 30)} meses`;
}

export default function UsuariosPage() {
    const queryClient = useQueryClient();
    const [toast, setToast] = useState<Toast | null>(null);
    const [searchTerm, setSearchTerm] = useState("");
    const [filterRole, setFilterRole] = useState<string>("");

    // ── Fetch Profiles ──
    const { data: perfiles = [], isLoading } = useQuery<Perfil[]>({
        queryKey: ["perfiles"],
        queryFn: () => perfilesAPI.getAll(),
    });

    // ── Mutation: Update Role ──
    const updateRoleMutation = useMutation({
        mutationFn: ({ userId, newRole }: { userId: string; newRole: UserRole }) =>
            perfilesAPI.updateRole(userId, newRole),
        // Optimistic update
        onMutate: async ({ userId, newRole }) => {
            await queryClient.cancelQueries({ queryKey: ["perfiles"] });
            const previousPerfiles = queryClient.getQueryData<Perfil[]>(["perfiles"]);

            queryClient.setQueryData<Perfil[]>(["perfiles"], (old) =>
                old?.map((p) =>
                    p.id === userId ? { ...p, rol: newRole } : p
                ) || []
            );

            return { previousPerfiles };
        },
        onSuccess: (_, { newRole }) => {
            const roleName = ROLE_CONFIG[newRole].label;
            showToast(`Rol de usuario actualizado exitosamente a "${roleName}"`, "success");
        },
        onError: (error: any, _, context) => {
            // Rollback on error
            if (context?.previousPerfiles) {
                queryClient.setQueryData(["perfiles"], context.previousPerfiles);
            }
            showToast("Error al actualizar el rol: " + (error.message || "Intenta de nuevo"), "error");
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: ["perfiles"] });
        },
    });

    // ── Toast ──
    const showToast = (message: string, type: "success" | "error") => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 3500);
    };

    // ── Filtered Data ──
    const filteredPerfiles = useMemo(() => {
        return perfiles.filter((p) => {
            const matchesSearch =
                (p.nombre_completo || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
                p.email.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesRole = !filterRole || p.rol === filterRole;
            return matchesSearch && matchesRole;
        });
    }, [perfiles, searchTerm, filterRole]);

    // ── Stats ──
    const stats = useMemo(() => ({
        total: perfiles.length,
        admins: perfiles.filter((p) => p.rol === "ADMIN").length,
        gestoras: perfiles.filter((p) => p.rol === "GESTORA").length,
        sinAcceso: perfiles.filter((p) => p.rol === "SIN_ACCESO").length,
    }), [perfiles]);

    // ── Loading State ──
    if (isLoading) {
        return (
            <div className={styles.container}>
                <div className={styles.loadingState}>
                    <Loader2 className={styles.loadingIcon} size={48} />
                    <p>Cargando usuarios...</p>
                </div>
            </div>
        );
    }

    return (
        <div className={styles.container}>
            {/* Header */}
            <div className={styles.pageHeader}>
                <div className={styles.headerLeft}>
                    <div className={styles.headerIcon}>
                        <Shield size={24} />
                    </div>
                    <div>
                        <h1 className={styles.pageTitle}>Usuarios y Accesos</h1>
                        <p className={styles.pageSubtitle}>
                            Gestión de roles y permisos del sistema RBAC
                        </p>
                    </div>
                </div>
            </div>

            {/* Stats */}
            <div className={styles.statsRow}>
                <div className={styles.statCard}>
                    <div className={styles.statIconWrap} style={{ background: "rgba(139, 92, 246, 0.15)" }}>
                        <Users size={20} color="#8B5CF6" />
                    </div>
                    <div className={styles.statContent}>
                        <span className={styles.statValue}>{stats.total}</span>
                        <span className={styles.statLabel}>Total Usuarios</span>
                    </div>
                </div>
                <div className={styles.statCard}>
                    <div className={styles.statIconWrap} style={{ background: "rgba(139, 92, 246, 0.15)" }}>
                        <Shield size={20} color="#A78BFA" />
                    </div>
                    <div className={styles.statContent}>
                        <span className={styles.statValue}>{stats.admins}</span>
                        <span className={styles.statLabel}>Administradores</span>
                    </div>
                </div>
                <div className={styles.statCard}>
                    <div className={styles.statIconWrap} style={{ background: "rgba(16, 185, 129, 0.15)" }}>
                        <UserCheck size={20} color="#10B981" />
                    </div>
                    <div className={styles.statContent}>
                        <span className={styles.statValue}>{stats.gestoras}</span>
                        <span className={styles.statLabel}>Gestores(as)</span>
                    </div>
                </div>
                <div className={styles.statCard}>
                    <div className={styles.statIconWrap} style={{ background: "rgba(245, 158, 11, 0.15)" }}>
                        <Clock size={20} color="#F59E0B" />
                    </div>
                    <div className={styles.statContent}>
                        <span className={styles.statValue}>{stats.sinAcceso}</span>
                        <span className={styles.statLabel}>Pendientes</span>
                    </div>
                </div>
            </div>

            {/* Info Banner */}
            <div className={styles.infoBanner}>
                <Info size={16} />
                <span>
                    Los nuevos usuarios que inician sesión con Microsoft Azure AD se registran automáticamente con rol
                    <strong style={{ color: "#FBBF24" }}> &quot;Sin acceso&quot;</strong>.
                    Asígnales un rol para permitir su acceso al sistema.
                </span>
            </div>

            {/* Search & Filter Bar */}
            <div className={styles.searchBar}>
                <div className={styles.searchInput}>
                    <Search size={16} color="rgba(255,255,255,0.3)" />
                    <input
                        type="text"
                        placeholder="Buscar por nombre o email..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <select
                    className={styles.filterSelect}
                    value={filterRole}
                    onChange={(e) => setFilterRole(e.target.value)}
                >
                    <option value="">Todos los roles</option>
                    <option value="ADMIN">🛡️ Administrador</option>
                    <option value="GESTORA">✅ Gestor(a)</option>
                    <option value="ESPECTADOR">👁️ Espectador</option>
                    <option value="SIN_ACCESO">⏳ Sin acceso</option>
                </select>
            </div>

            {/* Users Table */}
            <div className={styles.tableContainer}>
                {filteredPerfiles.length === 0 ? (
                    <div className={styles.emptyState}>
                        <div className={styles.emptyIcon}>👥</div>
                        <p>No se encontraron usuarios</p>
                    </div>
                ) : (
                    <table className={styles.usersTable}>
                        <thead>
                            <tr>
                                <th>Usuario</th>
                                <th>Fecha de Registro</th>
                                <th>Estado</th>
                                <th>Rol</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredPerfiles.map((perfil) => {
                                const roleConfig = ROLE_CONFIG[perfil.rol];
                                const isSaving = updateRoleMutation.isPending
                                    && updateRoleMutation.variables?.userId === perfil.id;

                                return (
                                    <tr key={perfil.id}>
                                        {/* User Info */}
                                        <td>
                                            <div className={styles.userCell}>
                                                <div className={`${styles.userAvatar} ${roleConfig.avatarClass}`}>
                                                    {getInitials(perfil.nombre_completo, perfil.email)}
                                                </div>
                                                <div className={styles.userInfo}>
                                                    <span className={styles.userName}>
                                                        {perfil.nombre_completo || perfil.email.split("@")[0]}
                                                    </span>
                                                    <span className={styles.userEmail}>{perfil.email}</span>
                                                </div>
                                            </div>
                                        </td>

                                        {/* Date */}
                                        <td>
                                            <div className={styles.dateCell}>
                                                {formatDate(perfil.created_at)}
                                                <div className={styles.dateRelative}>
                                                    {timeAgo(perfil.created_at)}
                                                </div>
                                            </div>
                                        </td>

                                        {/* Status */}
                                        <td>
                                            {perfil.rol === "SIN_ACCESO" ? (
                                                <span className={`${styles.statusBadge} ${styles.statusPending}`}>
                                                    <Clock size={12} />
                                                    Pendiente
                                                </span>
                                            ) : (
                                                <span className={`${styles.statusBadge} ${styles.statusActive}`}>
                                                    <CheckCircle2 size={12} />
                                                    Activo
                                                </span>
                                            )}
                                        </td>

                                        {/* Role Dropdown */}
                                        <td>
                                            <select
                                                className={`${styles.roleSelect} ${roleConfig.selectClass} ${isSaving ? styles.roleSelectSaving : ""}`}
                                                value={perfil.rol}
                                                onChange={(e) =>
                                                    updateRoleMutation.mutate({
                                                        userId: perfil.id,
                                                        newRole: e.target.value as UserRole,
                                                    })
                                                }
                                                disabled={isSaving}
                                            >
                                                <option value="ADMIN">🛡️ Administrador</option>
                                                <option value="GESTORA">✅ Gestor(a) Operativo(a)</option>
                                                <option value="ESPECTADOR">👁️ Espectador</option>
                                                <option value="SIN_ACCESO">⏳ Sin acceso</option>
                                            </select>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Toast */}
            {toast && (
                <div className={`${styles.toast} ${toast.type === "success" ? styles.toastSuccess : styles.toastError}`}>
                    {toast.type === "success" ? <CheckCircle2 size={18} /> : <XCircle size={18} />}
                    {toast.message}
                </div>
            )}
        </div>
    );
}
