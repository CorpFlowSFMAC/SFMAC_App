"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
    Route, Building2, MapPin, Users, Search, Filter,
    Loader2, CheckCircle2, XCircle, ChevronRight,
    Globe, Map, Store, Sparkles, ArrowRight, UserCheck,
    Plus, Trash2, Info, ChevronDown, ChevronUp
} from "lucide-react";
import styles from "./routing.module.css";
import { routingAPI, gestorasAPI, zonasAPI, gestoraBranchAPI } from "@/lib/routing-api";

interface Toast {
    message: string;
    type: "success" | "error";
}

export default function RoutingPage() {
    // ── State ──
    const [activeTab, setActiveTab] = useState<"cliente" | "zona" | "agencia" | "gestora">("cliente");
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState<string | null>(null);
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
        setTimeout(() => setToast(null), 4000);
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
            // Recargar zonas para tener datos frescos después del upsert
            const updatedZonas = await zonasAPI.getAll();
            setZonas(updatedZonas);
            const gestoraName = value ? gestoras.find(g => g.id === value)?.name : "ninguna";
            showToast(`✅ Zona actualizada → Gestora: ${gestoraName}`, "success");
        } catch (err: any) {
            console.error("Error assigning gestora to zona:", err);
            showToast(`❌ Error al asignar gestora a la zona: ${err?.message || ''}`, "error");
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

    const filteredGestoras = useMemo(() => {
        return gestoras.filter(g =>
            g.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            g.email?.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [gestoras, searchTerm]);

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
                <span className={styles.cascadeLevel}><Store size={12} /> Agencia directa</span>
                <span className={styles.cascadeArrow}>→</span>
                <span className={styles.cascadeLevel}><UserCheck size={12} /> Asignación específica</span>
                <span className={styles.cascadeArrow}>→</span>
                <span className={styles.cascadeLevel}><Map size={12} /> Zona</span>
                <span className={styles.cascadeArrow}>→</span>
                <span className={styles.cascadeLevel}><Globe size={12} /> Cliente</span>
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
                <button
                    className={`${styles.tab} ${activeTab === "gestora" ? styles.tabActive : ""}`}
                    onClick={() => { setActiveTab("gestora"); setSearchTerm(""); setFilterClient(""); }}
                    style={{ borderColor: activeTab === "gestora" ? "#8B5CF6" : "transparent" }}
                >
                    <UserCheck size={16} />
                    Por Gestora
                    <span className={styles.tabBadge} style={{ background: activeTab === "gestora" ? "#8B5CF620" : undefined }}>{stats.totalGestoras}</span>
                </button>
            </div>

            {/* Filter Bar */}
            <div className={styles.filterBar}>
                <div className={styles.searchInput}>
                    <Search size={16} />
                    <input
                        type="text"
                        placeholder={
                            activeTab === "cliente" ? "Buscar cliente..." :
                            activeTab === "zona" ? "Buscar zona..." :
                            activeTab === "gestora" ? "Buscar gestora..." :
                            "Buscar agencia..."
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

            {activeTab === "gestora" && (
                <GestoraTab
                    gestoras={filteredGestoras}
                    branches={branches}
                    zonas={zonas}
                    onToast={showToast}
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
                        {saving === zona.id ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#8B5CF6' }}>
                                <Loader2 size={16} className={styles.loadingIcon} />
                                <span style={{ fontSize: '0.8rem' }}>Guardando...</span>
                            </div>
                        ) : (
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
                        )}
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

// ════════════════════════════════════════════════
// TAB: Por Gestora (Nueva regla: zona + agencias específicas)
// ════════════════════════════════════════════════
function GestoraTab({ gestoras, branches, zonas, onToast }: {
    gestoras: any[];
    branches: any[];
    zonas: any[];
    onToast: (msg: string, type: "success" | "error") => void;
}) {
    const [expandedGestora, setExpandedGestora] = useState<string | null>(null);
    const [gestoraAssignments, setGestoraAssignments] = useState<Record<string, string[]>>({});
    const [loadingGestora, setLoadingGestora] = useState<string | null>(null);
    const [savingGestora, setSavingGestora] = useState<string | null>(null);
    const [branchSearch, setBranchSearch] = useState("");

    const loadGestoraAssignments = useCallback(async (gestoraId: string) => {
        setLoadingGestora(gestoraId);
        try {
            const assignedBranches = await gestoraBranchAPI.getByGestora(gestoraId);
            setGestoraAssignments(prev => ({
                ...prev,
                [gestoraId]: assignedBranches.map((b: any) => b.id)
            }));
        } catch (err) {
            console.error("Error loading gestora assignments:", err);
        } finally {
            setLoadingGestora(null);
        }
    }, []);

    const handleExpandGestora = (gestoraId: string) => {
        if (expandedGestora === gestoraId) {
            setExpandedGestora(null);
        } else {
            setExpandedGestora(gestoraId);
            if (!gestoraAssignments[gestoraId]) {
                loadGestoraAssignments(gestoraId);
            }
        }
    };

    const toggleBranch = (gestoraId: string, branchId: string) => {
        setGestoraAssignments(prev => {
            const current = prev[gestoraId] || [];
            if (current.includes(branchId)) {
                return { ...prev, [gestoraId]: current.filter(id => id !== branchId) };
            } else {
                return { ...prev, [gestoraId]: [...current, branchId] };
            }
        });
    };

    const handleSaveAssignments = async (gestoraId: string) => {
        setSavingGestora(gestoraId);
        try {
            const branchIds = gestoraAssignments[gestoraId] || [];
            await gestoraBranchAPI.syncBranchAssignments(gestoraId, branchIds);
            onToast(`✅ Asignaciones de agencias guardadas correctamente`, "success");
        } catch (err: any) {
            console.error("Error saving gestora assignments:", err);
            onToast(`❌ Error al guardar: ${err?.message || ''}`, "error");
        } finally {
            setSavingGestora(null);
        }
    };

    // Get zonas assigned to a gestora
    const getGestoraZonas = (gestoraId: string) => {
        return zonas.filter(z => {
            const gId = z.gestora?.id || z.gestora_asignada_id;
            return gId === gestoraId;
        });
    };

    // Get branches filtered by search
    const filteredBranches = branches.filter(b =>
        !branchSearch ||
        b.name?.toLowerCase().includes(branchSearch.toLowerCase()) ||
        b.zone?.toLowerCase().includes(branchSearch.toLowerCase()) ||
        b.departamento?.toLowerCase().includes(branchSearch.toLowerCase())
    );

    if (gestoras.length === 0) {
        return (
            <div className={styles.emptyState}>
                <div className={styles.emptyIcon}>👤</div>
                <p>No hay gestoras registradas en el sistema</p>
            </div>
        );
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {/* Regla explicada */}
            <div style={{
                background: 'rgba(139,92,246,0.08)',
                border: '1px solid rgba(139,92,246,0.25)',
                borderRadius: '12px',
                padding: '0.9rem 1.2rem',
                display: 'flex',
                gap: '0.7rem',
                alignItems: 'flex-start',
                fontSize: '0.83rem',
                color: '#C4B5FD'
            }}>
                <Info size={16} style={{ marginTop: '2px', flexShrink: 0 }} />
                <div>
                    <strong>Regla de asignación mixta:</strong> Una gestora puede ser responsable de una <strong>zona completa</strong> (configurada en la pestaña "Por Zona")
                    y adicionalmente tener <strong>agencias específicas</strong> de otras zonas asignadas aquí.
                    El sistema resolverá la gestora correcta en cascada al llegar un ticket.
                </div>
            </div>

            {gestoras.map(gestora => {
                const isExpanded = expandedGestora === gestora.id;
                const gestoraZonas = getGestoraZonas(gestora.id);
                const assignedBranchIds = gestoraAssignments[gestora.id] || [];
                const isLoading = loadingGestora === gestora.id;
                const isSaving = savingGestora === gestora.id;

                return (
                    <div
                        key={gestora.id}
                        style={{
                            background: 'rgba(255,255,255,0.03)',
                            border: `1px solid ${isExpanded ? 'rgba(139,92,246,0.5)' : 'rgba(255,255,255,0.06)'}`,
                            borderRadius: '14px',
                            overflow: 'hidden',
                            transition: 'border-color 0.2s'
                        }}
                    >
                        {/* Header gestora */}
                        <button
                            onClick={() => handleExpandGestora(gestora.id)}
                            style={{
                                width: '100%',
                                padding: '1rem 1.25rem',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '1rem',
                                background: isExpanded ? 'rgba(139,92,246,0.06)' : 'transparent',
                                border: 'none',
                                cursor: 'pointer',
                                textAlign: 'left',
                                color: 'inherit'
                            }}
                        >
                            <div style={{
                                width: '42px', height: '42px', borderRadius: '50%',
                                background: 'linear-gradient(135deg, #8B5CF6, #6366F1)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: '1.1rem', fontWeight: 700, color: 'white', flexShrink: 0
                            }}>
                                {(gestora.name || 'G')[0].toUpperCase()}
                            </div>

                            <div style={{ flex: 1 }}>
                                <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>{gestora.name}</div>
                                <div style={{ fontSize: '0.78rem', opacity: 0.6 }}>{gestora.email}</div>
                            </div>

                            {/* Zona badges */}
                            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', flexShrink: 0 }}>
                                {gestoraZonas.length > 0 ? (
                                    gestoraZonas.map(z => (
                                        <span key={z.id} style={{
                                            background: `${z.color || '#8B5CF6'}20`,
                                            color: z.color || '#8B5CF6',
                                            border: `1px solid ${z.color || '#8B5CF6'}40`,
                                            borderRadius: '6px', padding: '0.2rem 0.5rem',
                                            fontSize: '0.72rem', fontWeight: 600
                                        }}>
                                            {z.icon || '📍'} {z.nombre}
                                        </span>
                                    ))
                                ) : (
                                    <span style={{ fontSize: '0.75rem', opacity: 0.4 }}>Sin zona asignada</span>
                                )}
                                {assignedBranchIds.length > 0 && (
                                    <span style={{
                                        background: 'rgba(16,185,129,0.15)', color: '#10B981',
                                        border: '1px solid rgba(16,185,129,0.3)',
                                        borderRadius: '6px', padding: '0.2rem 0.5rem',
                                        fontSize: '0.72rem', fontWeight: 600
                                    }}>
                                        +{assignedBranchIds.length} ag. específicas
                                    </span>
                                )}
                            </div>

                            {isExpanded ? <ChevronUp size={18} style={{ opacity: 0.5 }} /> : <ChevronDown size={18} style={{ opacity: 0.5 }} />}
                        </button>

                        {/* Expanded panel */}
                        {isExpanded && (
                            <div style={{ padding: '0 1.25rem 1.25rem' }}>
                                <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '1rem' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                                        <div>
                                            <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>Agencias específicas asignadas</div>
                                            <div style={{ fontSize: '0.77rem', opacity: 0.5, marginTop: '0.15rem' }}>
                                                Estas agencias estarán a cargo de esta gestora, aunque pertenezcan a otra zona.
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => handleSaveAssignments(gestora.id)}
                                            disabled={isSaving}
                                            style={{
                                                background: 'linear-gradient(135deg, #8B5CF6, #6366F1)',
                                                color: 'white', border: 'none', borderRadius: '8px',
                                                padding: '0.5rem 1.1rem', cursor: 'pointer',
                                                fontSize: '0.82rem', fontWeight: 600,
                                                display: 'flex', alignItems: 'center', gap: '0.4rem',
                                                opacity: isSaving ? 0.6 : 1
                                            }}
                                        >
                                            {isSaving ? <Loader2 size={14} className={styles.loadingIcon} /> : <CheckCircle2 size={14} />}
                                            {isSaving ? 'Guardando...' : 'Guardar cambios'}
                                        </button>
                                    </div>

                                    {/* Buscador de agencias */}
                                    <div style={{
                                        display: 'flex', alignItems: 'center', gap: '0.5rem',
                                        background: 'rgba(255,255,255,0.05)', borderRadius: '8px',
                                        padding: '0.45rem 0.75rem', marginBottom: '0.75rem'
                                    }}>
                                        <Search size={14} style={{ opacity: 0.5 }} />
                                        <input
                                            type="text"
                                            placeholder="Buscar agencia por nombre, zona o departamento..."
                                            value={branchSearch}
                                            onChange={e => setBranchSearch(e.target.value)}
                                            style={{
                                                background: 'transparent', border: 'none', outline: 'none',
                                                color: 'inherit', fontSize: '0.82rem', width: '100%'
                                            }}
                                        />
                                    </div>

                                    {isLoading ? (
                                        <div style={{ textAlign: 'center', padding: '2rem', opacity: 0.5 }}>
                                            <Loader2 size={24} className={styles.loadingIcon} />
                                        </div>
                                    ) : (
                                        <div style={{
                                            maxHeight: '320px', overflowY: 'auto',
                                            display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
                                            gap: '0.4rem'
                                        }}>
                                            {filteredBranches.map(branch => {
                                                const isChecked = assignedBranchIds.includes(branch.id);
                                                // Si esta agencia pertenece a una zona de esta gestora, mostrarlo
                                                const branchZona = zonas.find(z => {
                                                    const gId = z.gestora?.id || z.gestora_asignada_id;
                                                    return gId === gestora.id && (branch.zone === z.nombre || branch.zone === z.codigo);
                                                });

                                                return (
                                                    <label
                                                        key={branch.id}
                                                        style={{
                                                            display: 'flex', alignItems: 'center', gap: '0.6rem',
                                                            padding: '0.5rem 0.75rem', borderRadius: '8px', cursor: 'pointer',
                                                            background: isChecked ? 'rgba(16,185,129,0.1)' : 'rgba(255,255,255,0.02)',
                                                            border: `1px solid ${isChecked ? 'rgba(16,185,129,0.3)' : 'rgba(255,255,255,0.06)'}`,
                                                            transition: 'all 0.15s'
                                                        }}
                                                    >
                                                        <input
                                                            type="checkbox"
                                                            checked={isChecked}
                                                            onChange={() => toggleBranch(gestora.id, branch.id)}
                                                            style={{ accentColor: '#10B981' }}
                                                        />
                                                        <div style={{ flex: 1, minWidth: 0 }}>
                                                            <div style={{ fontSize: '0.82rem', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                                {branch.name}
                                                            </div>
                                                            <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap', marginTop: '0.15rem' }}>
                                                                {branch.zone && (
                                                                    <span style={{ fontSize: '0.68rem', opacity: 0.6 }}>
                                                                        {branchZona ? '✅' : '📍'} {branch.zone}
                                                                    </span>
                                                                )}
                                                                {branch.departamento && (
                                                                    <span style={{ fontSize: '0.68rem', opacity: 0.5 }}>
                                                                        · {branch.departamento}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </label>
                                                );
                                            })}
                                        </div>
                                    )}
                                    <div style={{ fontSize: '0.75rem', opacity: 0.4, marginTop: '0.5rem', textAlign: 'right' }}>
                                        {assignedBranchIds.length} agencias específicas seleccionadas de {branches.length} totales
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}
