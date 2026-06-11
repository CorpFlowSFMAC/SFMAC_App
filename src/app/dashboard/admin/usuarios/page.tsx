"use client";

import React, { useState, useMemo } from "react";
import {
    Shield, Users, Search, Loader2, CheckCircle2, XCircle,
    UserCheck, Clock, Eye, ShieldOff, Info, UserPlus, Trash2, X, Mail
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { perfilesAPI, type Perfil, type UserRole } from "@/lib/profiles-api";
import { supabase } from "@/lib/supabase";
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

// ── Helper: get auth token for API calls ─────────────────────────────────────
// Returns token if available (Supabase Auth), null otherwise (Azure AD - uses cookies)
async function getAuthToken(): Promise<string | null> {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token || null;
}

export default function UsuariosPage() {
    const queryClient = useQueryClient();
    const [toast, setToast] = useState<Toast | null>(null);
    const [searchTerm, setSearchTerm] = useState("");
    const [filterRole, setFilterRole] = useState<string>("");

    // ── Invite Modal State ──
    const [showInviteModal, setShowInviteModal] = useState(false);
    const [inviteEmail, setInviteEmail] = useState("");
    const [inviteNombre, setInviteNombre] = useState("");
    const [inviteRol, setInviteRol] = useState<UserRole>("SIN_ACCESO");
    const [isInviting, setIsInviting] = useState(false);

    // ── Delete Confirmation State ──
    const [deleteTarget, setDeleteTarget] = useState<Perfil | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    // ── Quick Admin Modal State ──
    const [showQuickAdminModal, setShowQuickAdminModal] = useState(false);
    const [quickAdminEmail, setQuickAdminEmail] = useState("");
    const [quickAdminNombre, setQuickAdminNombre] = useState("");
    const [isCreatingAdmin, setIsCreatingAdmin] = useState(false);

    // ── Quick Admin Handler ──
    const handleQuickAdmin = async () => {
        if (!quickAdminEmail || !quickAdminEmail.includes("@")) {
            showToast("Por favor ingresa un email válido.", "error");
            return;
        }
        setIsCreatingAdmin(true);
        try {
            const res = await fetch("/api/admin/set-admin", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: 'include',
                body: JSON.stringify({
                    email: quickAdminEmail.trim().toLowerCase(),
                    nombre_completo: quickAdminNombre.trim() || null,
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Error al crear admin.");
            showToast(`${quickAdminEmail} establecido como ADMIN.`, "success");
            setShowQuickAdminModal(false);
            setQuickAdminEmail("");
            setQuickAdminNombre("");
            queryClient.invalidateQueries({ queryKey: ["perfiles"] });
        } catch (err: any) {
            showToast(err.message || "Error al crear admin.", "error");
        } finally {
            setIsCreatingAdmin(false);
        }
    };

    // ── Fetch Profiles ──
    const { data: perfiles = [], isLoading } = useQuery<Perfil[]>({
        queryKey: ["perfiles"],
        queryFn: () => perfilesAPI.getAll(),
    });

    // ── Current user profile (check if ADMIN) ──
    const { data: currentPerfil } = useQuery<Perfil | null>({
        queryKey: ["currentPerfil"],
        queryFn: () => perfilesAPI.getCurrentProfile(),
    });
    const isAdmin = currentPerfil?.rol === "ADMIN";

    // ── Mutation: Update Role ──
    const updateRoleMutation = useMutation({
        mutationFn: ({ userId, newRole }: { userId: string; newRole: UserRole }) =>
            perfilesAPI.updateRole(userId, newRole),
        onMutate: async ({ userId, newRole }) => {
            await queryClient.cancelQueries({ queryKey: ["perfiles"] });
            const previousPerfiles = queryClient.getQueryData<Perfil[]>(["perfiles"]);
            queryClient.setQueryData<Perfil[]>(["perfiles"], (old) =>
                old?.map((p) => p.id === userId ? { ...p, rol: newRole } : p) || []
            );
            return { previousPerfiles };
        },
        onSuccess: (_, { newRole }) => {
            showToast(`Rol actualizado a "${ROLE_CONFIG[newRole].label}"`, "success");
        },
        onError: (error: any, _, context) => {
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

    // ── Invite Handler ──
    const handleInvite = async () => {
        if (!inviteEmail || !inviteEmail.includes("@")) {
            showToast("Por favor ingresa un email válido.", "error");
            return;
        }
        setIsInviting(true);
        try {
            const token = await getAuthToken();
            const headers: Record<string, string> = {
                "Content-Type": "application/json",
            };
            if (token) {
                headers["Authorization"] = `Bearer ${token}`;
            }
            const res = await fetch("/api/admin/users", {
                method: "POST",
                headers,
                credentials: 'include',  // Send cookies for Azure AD auth
                body: JSON.stringify({
                    email: inviteEmail.trim().toLowerCase(),
                    nombre_completo: inviteNombre.trim() || null,
                    rol: inviteRol,
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Error al invitar usuario.");
            showToast(`Invitación enviada a ${inviteEmail}`, "success");
            setShowInviteModal(false);
            setInviteEmail("");
            setInviteNombre("");
            setInviteRol("SIN_ACCESO");
            queryClient.invalidateQueries({ queryKey: ["perfiles"] });
        } catch (err: any) {
            showToast(err.message || "Error al enviar la invitación.", "error");
        } finally {
            setIsInviting(false);
        }
    };

    // ── Delete Handler ──
    const handleDelete = async () => {
        if (!deleteTarget) return;
        setIsDeleting(true);
        try {
            const token = await getAuthToken();
            const headers: Record<string, string> = {
                "Content-Type": "application/json",
            };
            if (token) {
                headers["Authorization"] = `Bearer ${token}`;
            }
            const res = await fetch("/api/admin/users", {
                method: "DELETE",
                headers,
                credentials: 'include',  // Send cookies for Azure AD auth
                body: JSON.stringify({ userId: deleteTarget.id }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Error al eliminar usuario.");
            showToast(`Usuario ${deleteTarget.email} eliminado correctamente.`, "success");
            setDeleteTarget(null);
            queryClient.invalidateQueries({ queryKey: ["perfiles"] });
        } catch (err: any) {
            showToast(err.message || "Error al eliminar el usuario.", "error");
        } finally {
            setIsDeleting(false);
        }
    };

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
                {/* Invite Button — visible only for ADMIN */}
                {isAdmin && (
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button
                            className={styles.inviteButton}
                            onClick={() => setShowQuickAdminModal(true)}
                            id="btn-quick-admin"
                            style={{ background: '#8B5CF6' }}
                        >
                            <Shield size={16} />
                            Crear Admin
                        </button>
                        <button
                            className={styles.inviteButton}
                            onClick={() => setShowInviteModal(true)}
                            id="btn-invite-new-user"
                        >
                            <UserPlus size={16} />
                            Invitar Usuario
                        </button>
                    </div>
                )}
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
                                {isAdmin && <th style={{ textAlign: "center" }}>Acciones</th>}
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
                                                disabled={isSaving || !isAdmin}
                                            >
                                                <option value="ADMIN">🛡️ Administrador</option>
                                                <option value="GESTORA">✅ Gestor(a) Operativo(a)</option>
                                                <option value="ESPECTADOR">👁️ Espectador</option>
                                                <option value="SIN_ACCESO">⏳ Sin acceso</option>
                                            </select>
                                        </td>

                                        {/* Delete — ADMIN only */}
                                        {isAdmin && (
                                            <td style={{ textAlign: "center" }}>
                                                <button
                                                    className={styles.deleteButton}
                                                    onClick={() => setDeleteTarget(perfil)}
                                                    title={`Eliminar ${perfil.email}`}
                                                    id={`btn-delete-user-${perfil.id}`}
                                                >
                                                    <Trash2 size={15} />
                                                </button>
                                            </td>
                                        )}
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                )}
            </div>

            {/* ── INVITE MODAL ────────────────────────────────────────────────── */}
            {showInviteModal && (
                <div className={styles.modalOverlay} onClick={() => !isInviting && setShowInviteModal(false)}>
                    <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
                        <div className={styles.modalHeader}>
                            <div className={styles.modalHeaderLeft}>
                                <div className={styles.modalIcon}>
                                    <UserPlus size={20} />
                                </div>
                                <div>
                                    <h2 className={styles.modalTitle}>Invitar Nuevo Usuario</h2>
                                    <p className={styles.modalSubtitle}>
                                        Se enviará un email de invitación al correo indicado
                                    </p>
                                </div>
                            </div>
                            <button className={styles.modalClose} onClick={() => !isInviting && setShowInviteModal(false)}>
                                <X size={18} />
                            </button>
                        </div>

                        <div className={styles.modalBody}>
                            <div className={styles.formField}>
                                <label className={styles.formLabel}>
                                    <Mail size={14} />
                                    Email corporativo <span style={{ color: "#F87171" }}>*</span>
                                </label>
                                <input
                                    id="invite-email-input"
                                    type="email"
                                    className={styles.formInput}
                                    placeholder="usuario@sinfimac.pe"
                                    value={inviteEmail}
                                    onChange={(e) => setInviteEmail(e.target.value)}
                                    disabled={isInviting}
                                    autoFocus
                                />
                            </div>

                            <div className={styles.formField}>
                                <label className={styles.formLabel}>
                                    <Users size={14} />
                                    Nombre completo (opcional)
                                </label>
                                <input
                                    id="invite-nombre-input"
                                    type="text"
                                    className={styles.formInput}
                                    placeholder="Nombre Apellido"
                                    value={inviteNombre}
                                    onChange={(e) => setInviteNombre(e.target.value)}
                                    disabled={isInviting}
                                />
                            </div>

                            <div className={styles.formField}>
                                <label className={styles.formLabel}>
                                    <Shield size={14} />
                                    Rol inicial
                                </label>
                                <select
                                    id="invite-rol-select"
                                    className={styles.formSelect}
                                    value={inviteRol}
                                    onChange={(e) => setInviteRol(e.target.value as UserRole)}
                                    disabled={isInviting}
                                >
                                    <option value="SIN_ACCESO">⏳ Sin acceso (pendiente)</option>
                                    <option value="ESPECTADOR">👁️ Espectador</option>
                                    <option value="GESTORA">✅ Gestor(a) Operativo(a)</option>
                                    <option value="ADMIN">🛡️ Administrador</option>
                                </select>
                            </div>
                        </div>

                        <div className={styles.modalFooter}>
                            <button
                                className={styles.modalCancelBtn}
                                onClick={() => !isInviting && setShowInviteModal(false)}
                                disabled={isInviting}
                            >
                                Cancelar
                            </button>
                            <button
                                id="btn-confirm-invite"
                                className={styles.modalConfirmBtn}
                                onClick={handleInvite}
                                disabled={isInviting || !inviteEmail}
                            >
                                {isInviting ? (
                                    <><Loader2 size={15} style={{ animation: "spin 1s linear infinite" }} />Enviando...</>
                                ) : (
                                    <><Mail size={15} />Enviar Invitación</>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── QUICK ADMIN MODAL ─────────────────────────────────────────────── */}
            {showQuickAdminModal && (
                <div className={styles.modalOverlay} onClick={() => !isCreatingAdmin && setShowQuickAdminModal(false)}>
                    <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
                        <div className={styles.modalHeader}>
                            <div className={styles.modalHeaderLeft}>
                                <div className={styles.modalIcon} style={{ background: "rgba(139, 92, 246, 0.15)", color: "#8B5CF6" }}>
                                    <Shield size={20} />
                                </div>
                                <div>
                                    <h2 className={styles.modalTitle}>Crear Usuario Admin</h2>
                                    <p className={styles.modalSubtitle}>
                                        Agregar usuario directamente como Administrador
                                    </p>
                                </div>
                            </div>
                            <button className={styles.modalClose} onClick={() => !isCreatingAdmin && setShowQuickAdminModal(false)}>
                                <X size={18} />
                            </button>
                        </div>

                        <div className={styles.modalBody}>
                            <div className={styles.formField}>
                                <label className={styles.formLabel}>
                                    <Mail size={14} />
                                    Email <span style={{ color: "#F87171" }}>*</span>
                                </label>
                                <input
                                    id="quick-admin-email"
                                    type="email"
                                    className={styles.formInput}
                                    placeholder="usuario@ejemplo.com"
                                    value={quickAdminEmail}
                                    onChange={(e) => setQuickAdminEmail(e.target.value)}
                                    disabled={isCreatingAdmin}
                                    autoFocus
                                />
                            </div>

                            <div className={styles.formField}>
                                <label className={styles.formLabel}>
                                    <Users size={14} />
                                    Nombre completo (opcional)
                                </label>
                                <input
                                    id="quick-admin-nombre"
                                    type="text"
                                    className={styles.formInput}
                                    placeholder="Nombre Apellido"
                                    value={quickAdminNombre}
                                    onChange={(e) => setQuickAdminNombre(e.target.value)}
                                    disabled={isCreatingAdmin}
                                />
                            </div>

                            <p style={{ fontSize: "0.85rem", color: "#6B7280", marginTop: "0.5rem" }}>
                                El usuario será creado directamente con rol ADMIN sin enviar invitación por email.
                            </p>
                        </div>

                        <div className={styles.modalFooter}>
                            <button
                                className={styles.modalCancelBtn}
                                onClick={() => !isCreatingAdmin && setShowQuickAdminModal(false)}
                                disabled={isCreatingAdmin}
                            >
                                Cancelar
                            </button>
                            <button
                                id="btn-confirm-quick-admin"
                                className={styles.modalConfirmBtn}
                                onClick={handleQuickAdmin}
                                disabled={isCreatingAdmin || !quickAdminEmail}
                                style={{ background: "#8B5CF6" }}
                            >
                                {isCreatingAdmin ? (
                                    <><Loader2 size={15} style={{ animation: "spin 1s linear infinite" }} />Creando...</>
                                ) : (
                                    <><Shield size={15} />Crear como Admin</>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── DELETE CONFIRMATION MODAL ────────────────────────────────────── */}
            {deleteTarget && (
                <div className={styles.modalOverlay} onClick={() => !isDeleting && setDeleteTarget(null)}>
                    <div className={styles.modal} onClick={(e) => e.stopPropagation()} style={{ maxWidth: "440px" }}>
                        <div className={styles.modalHeader}>
                            <div className={styles.modalHeaderLeft}>
                                <div className={styles.modalIcon} style={{ background: "rgba(239,68,68,0.15)", color: "#F87171" }}>
                                    <Trash2 size={20} />
                                </div>
                                <div>
                                    <h2 className={styles.modalTitle}>Confirmar Eliminación</h2>
                                    <p className={styles.modalSubtitle}>Esta acción no se puede deshacer</p>
                                </div>
                            </div>
                            <button className={styles.modalClose} onClick={() => !isDeleting && setDeleteTarget(null)}>
                                <X size={18} />
                            </button>
                        </div>

                        <div className={styles.modalBody}>
                            <div className={styles.deleteConfirmInfo}>
                                <div className={`${styles.userAvatar} ${ROLE_CONFIG[deleteTarget.rol].avatarClass}`} style={{ width: 48, height: 48, fontSize: "1.1rem" }}>
                                    {getInitials(deleteTarget.nombre_completo, deleteTarget.email)}
                                </div>
                                <div>
                                    <p className={styles.userName} style={{ fontSize: "1rem" }}>
                                        {deleteTarget.nombre_completo || deleteTarget.email.split("@")[0]}
                                    </p>
                                    <p className={styles.userEmail} style={{ fontSize: "0.85rem" }}>
                                        {deleteTarget.email}
                                    </p>
                                </div>
                            </div>
                            <p className={styles.deleteWarning}>
                                Se eliminará permanentemente el acceso de este usuario al sistema.
                                Los datos de tickets y operaciones asociados se mantendrán en los registros históricos.
                            </p>
                        </div>

                        <div className={styles.modalFooter}>
                            <button
                                className={styles.modalCancelBtn}
                                onClick={() => !isDeleting && setDeleteTarget(null)}
                                disabled={isDeleting}
                            >
                                Cancelar
                            </button>
                            <button
                                id="btn-confirm-delete"
                                className={styles.modalDeleteBtn}
                                onClick={handleDelete}
                                disabled={isDeleting}
                            >
                                {isDeleting ? (
                                    <><Loader2 size={15} style={{ animation: "spin 1s linear infinite" }} />Eliminando...</>
                                ) : (
                                    <><Trash2 size={15} />Sí, eliminar usuario</>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

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
