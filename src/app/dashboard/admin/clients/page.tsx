"use client";

import { useState, useEffect } from "react";
import { Plus, Search, Building2, MapPin, TrendingUp, Sparkles, Trash2, Pencil } from "lucide-react";
import { useRouter } from "next/navigation";
import styles from "./clients.module.css";
import ClientDrawer from "./ClientDrawer";
import { useLocalStorage } from "@/hooks/useLocalStorage";

// Mock Data inicial - solo se usa si no hay datos en localStorage
import { INITIAL_CLIENTS, INITIAL_CLIENTS_DATA } from "@/lib/data/clients";

export default function ClientsPage() {
    const router = useRouter();
    const [clients, setClients, isLoaded] = useLocalStorage<any[]>("clients", INITIAL_CLIENTS);
    const [clientsData, setClientsData] = useLocalStorage<any>("clientsData", INITIAL_CLIENTS_DATA);
    const [searchTerm, setSearchTerm] = useState("");
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);
    const [editClient, setEditClient] = useState<any>(null);

    // Derivar contador real de sedes de clientsData si existe
    const clientsWithUpdatedCounts = clients.map(client => {
        const detail = clientsData[client.id.toString()];
        return {
            ...client,
            totalBranches: detail ? detail.branches.length : client.totalBranches
        };
    });

    const filteredClients = clientsWithUpdatedCounts.filter((client: any) =>
        client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        client.ruc.includes(searchTerm)
    );

    const handleClientCreated = (newClient: any) => {
        // Validar que el RUC no exista
        const rucExists = clients.some((client: any) => client.ruc === newClient.ruc);
        if (rucExists) {
            alert(`❌ El RUC ${newClient.ruc} ya está registrado en el sistema`);
            return;
        }

        const clientId = Date.now();
        const clientWithId = {
            ...newClient,
            id: clientId,
            totalBranches: 0,
            status: "active"
        };

        // 1. Guardar en la lista de clientes
        setClients([...clients, clientWithId]);

        // 2. Guardar en clientsData con estructura completa
        const newClientData = {
            ...clientWithId,
            createdAt: new Date().toISOString().split('T')[0],
            branches: []
        };

        setClientsData({
            ...clientsData,
            [clientId.toString()]: newClientData
        });
    };

    const handleClientUpdated = (updatedClient: any) => {
        // 1. Actualizar en la lista de clientes
        setClients(clients.map((c: any) => c.id === updatedClient.id ? updatedClient : c));

        // 2. Actualizar en clientsData preservando las sedes
        const currentDetail = clientsData[updatedClient.id.toString()];
        setClientsData({
            ...clientsData,
            [updatedClient.id.toString()]: {
                ...currentDetail,
                ...updatedClient,
            }
        });
        setEditClient(null);
        setIsDrawerOpen(false);
    };

    const handleEditClient = (client: any, e: React.MouseEvent) => {
        e.stopPropagation();
        setEditClient(client);
        setIsDrawerOpen(true);
    };

    const handleDeleteClient = (clientId: number, e: React.MouseEvent) => {
        e.stopPropagation(); // Evitar que se abra el detalle del cliente

        const client = clients.find((c: any) => c.id === clientId);
        if (!client) return;

        if (confirm(`¿Está seguro de eliminar el cliente "${client.name}"?\n\nEsta acción eliminará también todas sus sedes.`)) {
            // Eliminar de la lista
            setClients(clients.filter((c: any) => c.id !== clientId));

            // Eliminar de clientsData
            const newClientsData = { ...clientsData };
            delete newClientsData[clientId.toString()];
            setClientsData(newClientsData);
        }
    };

    // Mostrar loading mientras se carga localStorage
    if (!isLoaded) {
        return (
            <div className={styles.container}>
                <div className={styles.loadingState}>
                    <Sparkles className={styles.loadingIcon} size={48} />
                    <p>Cargando clientes...</p>
                </div>
            </div>
        );
    }

    return (
        <div className={styles.container}>
            <ClientDrawer
                isOpen={isDrawerOpen}
                onClose={() => {
                    setIsDrawerOpen(false);
                    setEditClient(null);
                }}
                onClientCreated={handleClientCreated}
                onClientUpdated={handleClientUpdated}
                editClient={editClient}
            />

            {/* Animated Header */}
            <div className={styles.pageHeader}>
                <div className={styles.headerContent}>
                    <div className={styles.titleGroup}>
                        <Sparkles className={styles.sparkleIcon} size={24} />
                        <div>
                            <h1 className={styles.pageTitle}>Gestión de Clientes</h1>
                            <p className={styles.pageSubtitle}>
                                Directorio nacional de clientes y redes de sedes corporativas
                            </p>
                        </div>
                    </div>
                    <button className={styles.createButton} onClick={() => {
                        setEditClient(null);
                        setIsDrawerOpen(true);
                    }}>
                        <Plus size={16} />
                        Nuevo Cliente
                    </button>
                </div>
            </div>

            {/* Search Bar */}
            <div className={styles.searchSection}>
                <div className={styles.searchBar}>
                    <Search size={18} />
                    <input
                        type="text"
                        placeholder="Buscar por nombre o RUC..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className={styles.resultCount}>
                    <TrendingUp size={14} />
                    {filteredClients.length} cliente{filteredClients.length !== 1 ? 's' : ''}
                </div>
            </div>

            {/* Client Cards Grid */}
            <div className={styles.grid}>
                {filteredClients.map((client) => (
                    <div
                        key={client.id}
                        className={styles.clientCard}
                        onClick={() => router.push(`/dashboard/admin/clients/${client.id}`)}
                        style={{
                            '--card-color': client.colorAura,
                            '--card-glow': `${client.colorAura}40`
                        } as any}
                    >
                        {/* Animated Background */}
                        <div className={styles.cardBg}></div>

                        {/* Card Content */}
                        <div className={styles.cardHeader}>
                            <div className={styles.clientLogo}>
                                {client.logo ? (
                                    <img src={client.logo} alt={client.name} />
                                ) : (
                                    <span className={styles.clientEmoji}>{client.icon}</span>
                                )}
                            </div>
                            <div className={styles.glowOrb} style={{ background: client.colorAura }}></div>
                            <div className={styles.cardActions}>
                                <button
                                    className={styles.editCardBtn}
                                    onClick={(e) => handleEditClient(client, e)}
                                    title="Editar cliente"
                                >
                                    <Pencil size={16} />
                                </button>
                                <button
                                    className={styles.deleteCardBtn}
                                    onClick={(e) => handleDeleteClient(client.id, e)}
                                    title="Eliminar cliente"
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        </div>

                        <div className={styles.cardBody}>
                            <h3 className={styles.clientName}>{client.name}</h3>
                            <span className={styles.clientRuc}>RUC: {client.ruc}</span>

                            <div className={styles.infoRow}>
                                <MapPin size={14} />
                                <span>{client.address}</span>
                            </div>
                        </div>

                        <div className={styles.cardFooter}>
                            <div className={styles.statBadge}>
                                <Building2 size={14} />
                                <span>{client.totalBranches} sedes</span>
                            </div>
                            <div className={styles.zoneBadge}>{client.zone}</div>
                        </div>

                        {/* Interactive Hover Effect */}
                        <div className={styles.hoverOverlay}>
                            <span className={styles.viewDetails}>Ver Detalle</span>
                        </div>
                    </div>
                ))}
            </div>

            {filteredClients.length === 0 && (
                <div className={styles.emptyState}>
                    <div className={styles.emptyIcon}>🔍</div>
                    <p>No se encontraron clientes</p>
                    <button className={styles.createButton} onClick={() => setIsDrawerOpen(true)}>
                        <Plus size={18} />
                        Crear Primer Cliente
                    </button>
                </div>
            )}
        </div>
    );
}
