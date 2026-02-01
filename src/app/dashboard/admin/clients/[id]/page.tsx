"use client";

import { useState, useEffect } from "react";
import { ArrowLeft, Building2, Info, MapPin, BarChart3, Sparkles } from "lucide-react";
import { useRouter, useParams } from "next/navigation";
import styles from "./clientDetail.module.css";
import InfoTab from "./InfoTab";
import BranchesTab from "./BranchesTab";
import StatsTab from "./StatsTab";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { INITIAL_CLIENTS_DATA, INITIAL_CLIENTS } from "@/lib/data/clients";

// Tipo para los datos de clientes
interface ClientData {
    id: number;
    name: string;
    ruc: string;
    logo: string | null;
    address: string;
    email: string;
    phone: string;
    zone: string;
    colorAura: string;
    icon: string;
    createdAt: string;
    branches: any[];
}

interface ClientsDataMap {
    [key: string]: ClientData;
}

export default function ClientDetailPage() {
    const router = useRouter();
    const params = useParams();
    const clientId = params.id as string;

    const [clientsData, setClientsData, isLoaded] = useLocalStorage<ClientsDataMap>("clientsData", INITIAL_CLIENTS_DATA);
    const [clients, setClients] = useLocalStorage<any[]>("clients", INITIAL_CLIENTS);
    const [activeTab, setActiveTab] = useState("branches");

    const clientData = clientsData[clientId];
    const [branches, setBranches] = useState(clientData?.branches || []);

    // Sincronizar branches con clientsData y asegurar que el contador en la lista principal sea correcto
    useEffect(() => {
        if (clientData && isLoaded) {
            setBranches(clientData.branches);

            // Sincronizar contador en la lista principal si es necesario
            const clientInList = clients.find(c => c.id === Number(clientId));
            if (clientInList && clientInList.totalBranches !== clientData.branches.length) {
                const updatedClients = clients.map(c =>
                    c.id === Number(clientId) ? { ...c, totalBranches: clientData.branches.length } : c
                );
                setClients(updatedClients);
            }
        }
    }, [clientId, isLoaded, clientData?.branches.length]);

    // Actualizar branches en localStorage cuando cambien
    const handleBranchesChange = (newBranches: any[]) => {
        setBranches(newBranches);
        if (clientData) {
            // 1. Actualizar detalle (clientsData)
            const updatedClientsData = {
                ...clientsData,
                [clientId]: {
                    ...clientData,
                    branches: newBranches
                }
            };
            setClientsData(updatedClientsData);

            // 2. Actualizar lista principal (clients) para que el contador sea exacto
            const updatedClientsList = clients.map(c =>
                c.id === Number(clientId) ? { ...c, totalBranches: newBranches.length } : c
            );
            setClients(updatedClientsList);
        }
    };

    if (!isLoaded) {
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
        <div className={styles.container} style={{ '--client-color': clientData.colorAura } as any}>
            {/* Animated Header */}
            <div className={styles.header}>
                <button onClick={() => router.push("/dashboard/admin/clients")} className={styles.backBtn}>
                    <ArrowLeft size={20} />
                    Volver
                </button>

                <div className={styles.clientInfo}>
                    <div className={styles.clientLogo} style={{ borderColor: clientData.colorAura }}>
                        {clientData.logo ? (
                            <img src={clientData.logo} alt={clientData.name} />
                        ) : (
                            <span className={styles.clientEmoji}>{clientData.icon}</span>
                        )}
                    </div>
                    <div className={styles.glowOrb} style={{ background: clientData.colorAura }}></div>
                    <div>
                        <h1 className={styles.clientName}>{clientData.name}</h1>
                        <div className={styles.clientMeta}>
                            <span>RUC: {clientData.ruc}</span>
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
                            <span className={styles.tabBadge} style={{ background: clientData.colorAura }}>
                                {tab.badge}
                            </span>
                        )}
                    </button>
                ))}
            </div>

            {/* Tab Content */}
            <div className={styles.tabContent}>
                {activeTab === "info" && <InfoTab client={clientData} />}
                {activeTab === "branches" && <BranchesTab branches={branches} setBranches={handleBranchesChange} clientColor={clientData.colorAura} />}
                {activeTab === "stats" && <StatsTab branches={branches} clientColor={clientData.colorAura} />}
            </div>
        </div>
    );
}
