"use client";

import { useState, useEffect } from "react";
import { ArrowLeft, Building2, Info, MapPin, BarChart3, Sparkles } from "lucide-react";
import { useRouter, useParams } from "next/navigation";
import styles from "./clientDetail.module.css";
import InfoTab from "./InfoTab";
import BranchesTab from "./BranchesTab";
import StatsTab from "./StatsTab";
import { useClient, useBranches } from "@/hooks/useSupabaseData";

export default function ClientDetailPage() {
    const router = useRouter();
    const params = useParams();
    const clientId = params.id as string;

    const { client: clientData, loading: clientLoading } = useClient(clientId);
    const { branches, loading: branchesLoading, createBranch, updateBranch, deleteBranch } = useBranches(clientId);
    const [activeTab, setActiveTab] = useState("branches");

    const loading = clientLoading || branchesLoading;

    // Función para manejar cambios en branches
    const handleBranchesChange = async (newBranches: any[]) => {
        // Esta función ya no es necesaria porque useBranches maneja el estado automáticamente
        // Pero la mantenemos por compatibilidad con BranchesTab
    };

    if (loading) {
        return (
            <div className={styles.container}>
                <div className={styles.loadingState}>
                    <Sparkles className={styles.loadingIcon} size={48} />
                    <p>Cargando cliente...</p>
                </div>
            </div>
        );
    }

    if (!clientData) {
        return (
            <div className={styles.container}>
                <div className={styles.emptyState}>
                    <div className={styles.emptyIcon}>❌</div>
                    <p>Cliente no encontrado</p>
                    <button onClick={() => router.push("/dashboard/admin/clients")} className={styles.backBtn}>
                        Volver a Clientes
                    </button>
                </div>
            </div>
        );
    }

    const tabs = [
        { id: "info", label: "Información General", icon: Info },
        { id: "branches", label: "Red de Sedes", icon: MapPin, badge: branches.length },
        { id: "stats", label: "Estadísticas", icon: BarChart3 }
    ];

    return (
        <div className={styles.container} style={{ '--client-color': clientData.color_aura || '#0066CC' } as any}>
            {/* Animated Header */}
            <div className={styles.header}>
                <button onClick={() => router.push("/dashboard/admin/clients")} className={styles.backBtn}>
                    <ArrowLeft size={20} />
                    Volver
                </button>

                <div className={styles.clientInfo}>
                    <div className={styles.clientLogo} style={{ borderColor: clientData.color_aura || '#0066CC' }}>
                        {clientData.logo ? (
                            <img src={clientData.logo} alt={clientData.name} />
                        ) : (
                            <span className={styles.clientEmoji}>{clientData.icon || '🏢'}</span>
                        )}
                    </div>
                    <div className={styles.glowOrb} style={{ background: clientData.color_aura || '#0066CC' }}></div>
                    <div>
                        <h1 className={styles.clientName}>{clientData.name}</h1>
                        <div className={styles.clientMeta}>
                            <span>RUC: {clientData.ruc || 'No especificado'}</span>
                            <span>•</span>
                            <span>{branches.length} sedes</span>
                            <span>•</span>
                            <span className={styles.statusBadge}>Activo</span>
                        </div>
                    </div>
                </div>

                <Sparkles className={styles.sparkleIcon} size={32} />
            </div>

            {/* Interactive Tabs */}
            <div className={styles.tabs}>
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        className={`${styles.tab} ${activeTab === tab.id ? styles.tabActive : ''}`}
                        onClick={() => setActiveTab(tab.id)}
                    >
                        <tab.icon size={18} />
                        <span>{tab.label}</span>
                        {tab.badge !== undefined && (
                            <span className={styles.tabBadge} style={{ background: clientData.color_aura || '#0066CC' }}>
                                {tab.badge}
                            </span>
                        )}
                    </button>
                ))}
            </div>

            {/* Tab Content */}
            <div className={styles.tabContent}>
                {activeTab === "info" && <InfoTab client={clientData} />}
                {activeTab === "branches" && <BranchesTab branches={branches} setBranches={handleBranchesChange} clientColor={clientData.color_aura || '#0066CC'} clientId={clientId} createBranch={createBranch} updateBranch={updateBranch} deleteBranch={deleteBranch} />}
                {activeTab === "stats" && <StatsTab branches={branches} clientColor={clientData.color_aura || '#0066CC'} />}
            </div>
        </div>
    );
}
