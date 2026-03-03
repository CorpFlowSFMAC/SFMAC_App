"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
    Route, Building2, MapPin, Users, Search, Filter,
    Loader2, CheckCircle2, XCircle, ChevronRight,
    Globe, Map, Store, Sparkles, ArrowRight, UserCheck
} from "lucide-react";
import styles from "./routing.module.css";
import { routingAPI, gestorasAPI, zonasAPI } from "@/lib/routing-api";

interface Toast {
    message: string;
    type: "success" | "error";
}

export default function RoutingPage() {
    // ── State ──
    const [activeTab, setActiveTab] = useState<"cliente" | "zona" | "agencia">("cliente");
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState<string | null>(null); // ID of item being saved
    const [toast, setToast] = useState<Toast | null>(null);
    const [searchTerm, setSearchTerm] = useState("");
    const [filterClient, setFilterClient] = useState("");

    // ── Data ──
    const [gestoras, setGestoras] = useState<any[]>([]);
    const [clients, setClients] = useState<any[]>([]);
    const [zonas, setZonas] = useState<any[]>([]);
    const [branches, setBranches] = useState<any[]>([]);

    // ── Load Data ──
    const loadData = useCallback(async () => {
        try {
            setLoading(true);
            const summary = await routingAPI.getRoutingSummary();
            setClients(summary.clients);
            setZonas(summary.zonas);
            setBranches(summary.branches);
            setGestoras(summary.gestoras);
        } catch (err) {
            console.error("Error loading routing data:", err);
            showToast("Error al cargar datos de enrutamiento", "error");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadData();
    }, [loadData]);

    // ── Toast ──
    const showToast = (message: string, type: "success" | "error") => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 3000);
    };

    // ── Stats ──
    const stats = useMemo(() => ({
        totalClients: clients.length,
        clientsAssigned: clients.filter((c: any) => c.gestora_asignada_id).length,
        totalZonas: zonas.length,
        zonasAssigned: zonas.filter((z: any) => z.gestora_asignada_id).length,
        totalBranches: branches.length,
        branchesAssigned: branches.filter((b: any) => b.gestora_asignada_id).length,
        totalGestoras: gestoras.length,
    }), [clients, zonas, branches, gestoras]);

    // ── Assignment Handlers ──
    const handleAssignClient = async (clientId: string, gestoraId: string) => {
        setSaving(clientId);
        try {
            const value = gestoraId === "" ? null : gestoraId;
            await routingAPI.assignGestoraToClient(clientId, value);
            setClients(prev => prev.map(c =>
                c.id === clientId
                    ? { ...c, gestora_asignada_id: value, gestora: value ? gestoras.find(g => g.id === value) : null }
                    : c
            ));
            const gestoraName = value ? gestoras.find(g => g.id === value)?.name : "ninguna";
            showToast(`✅ Cliente actualizado → Gestora: ${gestoraName}`, "success");
        } catch (err) {
            console.error("Error assigning gestora to client:", err);
            showToast("❌ Error al asignar gestora al cliente", "error");
        } finally {
            setSaving(null);
        }
    };

    const handleAssignZona = async (zonaId: string, gestoraId: string) => {
        setSaving(zonaId);
        try {
            const value = gestoraId === "" ? null : gestoraId;
            await routingAPI.assignGestoraToZona(zonaId, value);
            setZonas(prev => prev.map(z =>
                z.id === zonaId
                    ? { ...z, gestora_asignada_id: value, gestora: value ? gestoras.find(g => g.id === value) : null }
                    : z
            ));
            const gestoraName = value ? gestoras.find(g => g.id === value)?.name : "ninguna";
            showToast(`✅ Zona actualizada → Gestora: ${gestoraName}`, "success");
        } catch (err) {
            console.error("Error assigning gestora to zona:", err);
            showToast("❌ Error al asignar gestora a la zona", "error");
        } finally {
            setSaving(null);
        }
    };

    const handleAssignBranch = async (branchId: string, gestoraId: string) => {
        setSaving(branchId);
        try {
            const value = gestoraId === "" ? null : gestoraId;
            await routingAPI.assignGestoraToBranch(branchId, value);
            setBranches(prev => prev.map(b =>
                b.id === branchId
                    ? { ...b, gestora_asignada_id: value, gestora: value ? gestoras.find(g => g.id === value) : null }
                    : b
            ));
            const gestoraName = value ? gestoras.find(g => g.id === value)?.name : "ninguna";
            showToast(`✅ Agencia actualizada → Gestora: ${gestoraName}`, "success");
        } catch (err) {
            console.error("Error assigning gestora to branch:", err);
            showToast("❌ Error al asignar gestora a la agencia", "error");
        } finally {
            setSaving(null);
        }
    };

    // ── Filtered Data ──
    const filteredClients = useMemo(() => {
        return clients.filter(c =>
            c.name?.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [clients, searchTerm]);

    const filteredZonas = useMemo(() => {
        return zonas.filter(z => {
            const matchesSearch = z.nombre?.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesClient = !filterClient || z.client_id === filterClient;
            return matchesSearch && matchesClient;
        });
    }, [zonas, searchTerm, filterClient]);

    const filteredBranches = useMemo(() => {
        return branches.filter(b => {
            const matchesSearch =
                b.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                b.zone?.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesClient = !filterClient || b.client_id === filterClient;
            return matchesSearch && matchesClient;
        });
    }, [branches, searchTerm, filterClient]);

    // ── Loading State ──
    if (loading) {
        return (
            <div className={styles.container}>
                <div className={styles.loadingState}>
                    <Loader2 className={styles.loadingIcon} size={48} />
                    <p>Cargando motor de enrutamiento...</p>
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
                        <Route size={24} />
                    </div>
                    <div>
                        <h1 className={styles.pageTitle}>Reglas de Enrutamiento</h1>
                        <p className={styles.pageSubtitle}>
                            Configura la asignación automática de tickets por jerarquía: Cliente → Zona → Agencia
                        </p>
                    </div>
                </div>
            </div>

            {/* Stats Bar */}
            <div className={styles.statsBar}>
                <div className={styles.statItem}>
                    <div className={styles.statIconWrap} style={{ background: 'rgba(139, 92, 246, 0.2)' }}>
                        <UserCheck size={18} color="#8B5CF6" />
                    </div>
                    <div className={styles.statData}>
                        <span className={styles.statValue}>{stats.totalGestoras}</span>
                        <span className={styles.statLabel}>Gestoras</span>
                    </div>
                </div>
                <div className={styles.statItem}>
                    <div className={styles.statIconWrap} style={{ background: 'rgba(59, 130, 246, 0.2)' }}>
                        <Building2 size={18} color="#3B82F6" />
                    </div>
                    <div className={styles.statData}>
                        <span className={styles.statValue}>{stats.clientsAssigned}/{stats.totalClients}</span>
                        <span className={styles.statLabel}>Clientes Asignados</span>
                    </div>
                </div>
                <div className={styles.statItem}>
                    <div className={styles.statIconWrap} style={{ background: 'rgba(236, 72, 153, 0.2)' }}>
                        <Map size={18} color="#EC4899" />
                    </div>
                    <div className={styles.statData}>
                        <span className={styles.statValue}>{stats.zonasAssigned}/{stats.totalZonas}</span>
                        <span className={styles.statLabel}>Zonas Asignadas</span>
                    </div>
                </div>
                <div className={styles.statItem}>
                    <div className={styles.statIconWrap} style={{ background: 'rgba(16, 185, 129, 0.2)' }}>
                        <Store size={18} color="#10B981" />
                    </div>
                    <div className={styles.statData}>
                        <span className={styles.statValue}>{stats.branchesAssigned}/{stats.totalBranches}</span>
                        <span className={styles.statLabel}>Agencias Asignadas</span>
                    </div>
                </div>
            </div>

            {/* Cascade Info */}
            <div className={styles.cascadeInfo}>
                <Sparkles size={14} color="#8B5CF6" />
                <span>Resolución en cascada:</span>
                <span className={styles.cascadeLevel}><Store size={12} /> Agencia</span>
                <span className={styles.cascadeArrow}>→</span>
                <span className={styles.cascadeLevel}><Map size={12} /> Zona</span>
                <span className={styles.cascadeArrow}>→</span>
                <span className={styles.cascadeLevel}><Globe size={12} /> Cliente</span>
                <span style={{ marginLeft: '0.5rem', opacity: 0.5 }}>
                    | Si la agencia no tiene gestora, busca en la zona, luego en el cliente.
                </span>
            </div>

            {/* Tabs */}
            <div className={styles.tabsContainer}>
                <button
                    className={`${styles.tab} ${activeTab === "cliente" ? styles.tabActive : ""}`}
                    onClick={() => { setActiveTab("cliente"); setSearchTerm(""); setFilterClient(""); }}
                >
                    <Globe size={16} />
                    Por Cliente
                    <span className={styles.tabBadge}>{stats.totalClients}</span>
                </button>
                <button
                    className={`${styles.tab} ${activeTab === "zona" ? styles.tabActive : ""}`}
                    onClick={() => { setActiveTab("zona"); setSearchTerm(""); setFilterClient(""); }}
                >
                    <Map size={16} />
                    Por Zona
                    <span className={styles.tabBadge}>{stats.totalZonas}</span>
                </button>
                <button
                    className={`${styles.tab} ${activeTab === "agencia" ? styles.tabActive : ""}`}
                    onClick={() => { setActiveTab("agencia"); setSearchTerm(""); setFilterClient(""); }}
                >
                    <Store size={16} />
                    Por Agencia
                    <span className={styles.tabBadge}>{stats.totalBranches}</span>
                </button>
            </div>

            {/* Filter Bar */}
            <div className={styles.filterBar}>
                <div className={styles.searchInput}>
                    <Search size={16} />
                    <input
                        type="text"
                        placeholder={
                            activeTab === "cliente"
                                ? "Buscar cliente..."
                                : activeTab === "zona"
                                    ? "Buscar zona..."
                                    : "Buscar agencia..."
                        }
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                {(activeTab === "zona" || activeTab === "agencia") && (
                    <select
                        className={styles.filterSelect}
                        value={filterClient}
                        onChange={(e) => setFilterClient(e.target.value)}
                    >
                        <option value="">Todos los clientes</option>
                        {clients.map((c: any) => (
                            <option key={c.id} value={c.id}>{c.icon || '🏢'} {c.name}</option>
                        ))}
                    </select>
                )}
            </div>

            {/* Tab Content */}
            {activeTab === "cliente" && (
                <ClientTab
                    clients={filteredClients}
                    gestoras={gestoras}
                    saving={saving}
                    onAssign={handleAssignClient}
                />
            )}

            {activeTab === "zona" && (
                <ZonaTab
                    zonas={filteredZonas}
                    gestoras={gestoras}
                    saving={saving}
                    onAssign={handleAssignZona}
                />
            )}

            {activeTab === "agencia" && (
                <AgenciaTab
                    branches={filteredBranches}
                    gestoras={gestoras}
                    saving={saving}
                    onAssign={handleAssignBranch}
                />
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

// ════════════════════════════════════════════════
// TAB: Por Cliente
// ════════════════════════════════════════════════
function ClientTab({ clients, gestoras, saving, onAssign }: {
    clients: any[];
    gestoras: any[];
    saving: string | null;
    onAssign: (clientId: string, gestoraId: string) => void;
}) {
    if (clients.length === 0) {
        return (
            <div className={styles.emptyState}>
                <div className={styles.emptyIcon}>🏢</div>
                <p>No hay clientes registrados</p>
            </div>
        );
    }

    return (
        <div className={styles.assignmentsGrid}>
            {clients.map((client: any) => (
                <div
                    key={client.id}
                    className={styles.assignmentCard}
                    style={{ '--card-color': client.color_aura || '#3B82F6' } as any}
                >
                    {client.logo ? (
                        <img src={client.logo} alt={client.name} className={styles.itemIconImg} />
                    ) : (
                        <div className={styles.itemIcon}>
                            {client.icon || '🏢'}
                        </div>
                    )}

                    <div className={styles.itemInfo}>
                        <span className={styles.itemName}>{client.name}</span>
                        <div className={styles.itemMeta}>
                            <span className={styles.metaBadge}>
                                <Globe size={10} /> Nivel Nacional
                            </span>
                            <span className={`${styles.statusDot} ${client.gestora_asignada_id ? styles.statusDotActive : styles.statusDotInactive}`} />
                            <span>{client.gestora_asignada_id ? 'Asignada' : 'Sin asignar'}</span>
                        </div>
                    </div>

                    <div className={styles.gestoraSelector}>
                        <select
                            className={`${styles.gestoraSelect} ${client.gestora_asignada_id ? styles.gestoraAssigned : styles.gestoraUnassigned}`}
                            value={client.gestora_asignada_id || ""}
                            onChange={(e) => onAssign(client.id, e.target.value)}
                            disabled={saving === client.id}
                        >
                            <option value="">— Sin gestora asignada —</option>
                            {gestoras.map((g: any) => (
                                <option key={g.id} value={g.id}>
                                    👤 {g.name} ({g.email})
                                </option>
                            ))}
                        </select>
                    </div>
                </div>
            ))}
        </div>
    );
}

// ════════════════════════════════════════════════
// TAB: Por Zona
// ════════════════════════════════════════════════
function ZonaTab({ zonas, gestoras, saving, onAssign }: {
    zonas: any[];
    gestoras: any[];
    saving: string | null;
    onAssign: (zonaId: string, gestoraId: string) => void;
}) {
    if (zonas.length === 0) {
        return (
            <div className={styles.emptyState}>
                <div className={styles.emptyIcon}>🗺️</div>
                <p>No hay zonas configuradas</p>
            </div>
        );
    }

    return (
        <div className={styles.assignmentsGrid}>
            {zonas.map((zona: any) => (
                <div
                    key={zona.id}
                    className={styles.assignmentCard}
                    style={{ '--card-color': zona.color || '#EC4899' } as any}
                >
                    <div className={styles.itemIcon} style={{ background: `${zona.color || '#EC4899'}20`, border: `1px solid ${zona.color || '#EC4899'}40` }}>
                        {zona.icon || '📍'}
                    </div>

                    <div className={styles.itemInfo}>
                        <span className={styles.itemName}>{zona.nombre}</span>
                        <div className={styles.itemMeta}>
                            {zona.client && (
                                <span
                                    className={styles.clientBadge}
                                    style={{
                                        background: `${zona.client.color_aura || '#3B82F6'}15`,
                                        color: zona.client.color_aura || '#3B82F6',
                                        borderColor: `${zona.client.color_aura || '#3B82F6'}30`
                                    }}
                                >
                                    {zona.client.icon || '🏢'} {zona.client.name}
                                </span>
                            )}
                            <span className={styles.zoneBadge}>
                                <Map size={10} /> Nivel Regional
                            </span>
                            <span className={`${styles.statusDot} ${zona.gestora_asignada_id ? styles.statusDotActive : styles.statusDotInactive}`} />
                            <span>{zona.gestora_asignada_id ? 'Asignada' : 'Sin asignar'}</span>
                        </div>
                    </div>

                    <div className={styles.gestoraSelector}>
                        <select
                            className={`${styles.gestoraSelect} ${zona.gestora_asignada_id ? styles.gestoraAssigned : styles.gestoraUnassigned}`}
                            value={zona.gestora_asignada_id || ""}
                            onChange={(e) => onAssign(zona.id, e.target.value)}
                            disabled={saving === zona.id}
                        >
                            <option value="">— Sin gestora asignada —</option>
                            {gestoras.map((g: any) => (
                                <option key={g.id} value={g.id}>
                                    👤 {g.name} ({g.email})
                                </option>
                            ))}
                        </select>
                    </div>
                </div>
            ))}
        </div>
    );
}

// ════════════════════════════════════════════════
// TAB: Por Agencia
// ════════════════════════════════════════════════
function AgenciaTab({ branches, gestoras, saving, onAssign }: {
    branches: any[];
    gestoras: any[];
    saving: string | null;
    onAssign: (branchId: string, gestoraId: string) => void;
}) {
    if (branches.length === 0) {
        return (
            <div className={styles.emptyState}>
                <div className={styles.emptyIcon}>🏦</div>
                <p>No hay agencias registradas</p>
            </div>
        );
    }

    return (
        <div className={styles.assignmentsGrid}>
            {branches.map((branch: any) => (
                <div
                    key={branch.id}
                    className={styles.assignmentCard}
                    style={{ '--card-color': branch.client?.color_aura || '#10B981' } as any}
                >
                    <div className={styles.itemIcon}>
                        <Store size={20} color={branch.client?.color_aura || '#10B981'} />
                    </div>

                    <div className={styles.itemInfo}>
                        <span className={styles.itemName}>{branch.name}</span>
                        <div className={styles.itemMeta}>
                            {branch.client && (
                                <span
                                    className={styles.clientBadge}
                                    style={{
                                        background: `${branch.client.color_aura || '#3B82F6'}15`,
                                        color: branch.client.color_aura || '#3B82F6',
                                        borderColor: `${branch.client.color_aura || '#3B82F6'}30`
                                    }}
                                >
                                    {branch.client.icon || '🏢'} {branch.client.name}
                                </span>
                            )}
                            {branch.zone && (
                                <span className={styles.zoneBadge}>
                                    <MapPin size={10} /> {branch.zone}
                                </span>
                            )}
                            {branch.departamento && (
                                <span className={styles.metaBadge}>
                                    📍 {branch.departamento}
                                </span>
                            )}
                            <span className={`${styles.statusDot} ${branch.gestora_asignada_id ? styles.statusDotActive : styles.statusDotInactive}`} />
                            <span>{branch.gestora_asignada_id ? 'Asignada' : 'Hereda'}</span>
                        </div>
                    </div>

                    <div className={styles.gestoraSelector}>
                        <select
                            className={`${styles.gestoraSelect} ${branch.gestora_asignada_id ? styles.gestoraAssigned : styles.gestoraUnassigned}`}
                            value={branch.gestora_asignada_id || ""}
                            onChange={(e) => onAssign(branch.id, e.target.value)}
                            disabled={saving === branch.id}
                        >
                            <option value="">— Hereda de zona/cliente —</option>
                            {gestoras.map((g: any) => (
                                <option key={g.id} value={g.id}>
                                    👤 {g.name} ({g.email})
                                </option>
                            ))}
                        </select>
                    </div>
                </div>
            ))}
        </div>
    );
}
