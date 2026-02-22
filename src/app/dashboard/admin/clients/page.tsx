"use client";

import { useState, useEffect } from "react";
import { Plus, Search, Building2, MapPin, TrendingUp, Sparkles, Trash2, Pencil } from "lucide-react";
import { useRouter } from "next/navigation";
import styles from "./clients.module.css";
import ClientDrawer from "./ClientDrawer";
import { useAppData } from "@/lib/AppDataContext";

export default function ClientsPage() {
    const router = useRouter();
    const { clients, loadingClients: loading, createClient: createClientAPI, updateClient: updateClientAPI, deleteClient: deleteClientAPI } = useAppData();
    const [searchTerm, setSearchTerm] = useState("");
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);
    const [editClient, setEditClient] = useState<any>(null);
    const [userRole, setUserRole] = useState<string | null>(null);

    useEffect(() => {
        if (typeof window !== 'undefined') {
            setUserRole(localStorage.getItem("userRole"));
        }
    }, []);

    const filteredClients = clients.filter((client: any) =>
        client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (client.ruc && client.ruc.includes(searchTerm))
    );

    const handleClientCreated = async (newClient: any) => {
        try {
            // Validar que el RUC no exista
            const rucExists = clients.some((client: any) => client.ruc === newClient.ruc);
            if (rucExists) {
                alert(`❌ El RUC ${newClient.ruc} ya está registrado en el sistema`);
                return;
            }

            // Crear cliente en Supabase
            await createClientAPI(newClient);
            setIsDrawerOpen(false);
        } catch (error) {
            console.error('Error creating client:', error);
            alert('❌ Error al crear el cliente. Por favor intenta nuevamente.');
        }
    };

    const handleClientUpdated = async (updatedClient: any) => {
        try {
            const { id, created_at, totalBranches, ...updateData } = updatedClient;
            await updateClientAPI(id, updateData);
            setEditClient(null);
            setIsDrawerOpen(false);
        } catch (error) {
            console.error('Error updating client:', error);
            alert('❌ Error al actualizar el cliente. Por favor intenta nuevamente.');
        }
    };

    const handleEditClient = (client: any, e: React.MouseEvent) => {
        e.stopPropagation();
        setEditClient(client);
        setIsDrawerOpen(true);
    };

    const handleDeleteClient = async (clientId: number, e: React.MouseEvent) => {
        e.stopPropagation();

        const client = clients.find((c: any) => c.id === clientId);
        if (!client) return;

        if (confirm(`¿Está seguro de eliminar el cliente "${client.name}"?\n\nEsta acción eliminará también todas sus sedes.`)) {
            try {
                await deleteClientAPI(clientId.toString());
            } catch (error) {
                console.error('Error deleting client:', error);
                alert('❌ Error al eliminar el cliente. Por favor intenta nuevamente.');
            }
        }
    };

    // Mostrar loading mientras se cargan los datos de Supabase
    if (loading) {
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
                    {userRole === 'admin' && (
                        <button className={styles.createButton} onClick={() => {
                            setEditClient(null);
                            setIsDrawerOpen(true);
                        }}>
                            <Plus size={16} />
                            Nuevo Cliente
                        </button>
                    )}
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
                            '--card-color': client.color_aura || '#0066CC',
                            '--card-glow': `${client.color_aura || '#0066CC'}40`
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
                                    <span className={styles.clientEmoji}>{client.icon || '🏢'}</span>
                                )}
                            </div>
                            <div className={styles.glowOrb} style={{ background: client.color_aura || '#0066CC' }}></div>
                            {userRole === 'admin' && (
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
                            )}
                        </div>

                        <div className={styles.cardBody}>
                            <h3 className={styles.clientName}>{client.name}</h3>
                            <span className={styles.clientRuc}>RUC: {client.ruc || 'No especificado'}</span>

                            <div className={styles.infoRow}>
                                <MapPin size={14} />
                                <span>{client.address || 'Dirección no especificada'}</span>
                            </div>
                        </div>

                        <div className={styles.cardFooter}>
                            <div className={styles.statBadge}>
                                <Building2 size={14} />
                                <span>{client.totalBranches || 0} sedes</span>
                            </div>
                            <div className={styles.zoneBadge}>{client.zone || 'LIMA'}</div>
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
