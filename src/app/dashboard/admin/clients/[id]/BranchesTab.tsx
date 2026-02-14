"use client";

import { useState, useEffect } from "react";
import { Plus, Search, Edit, Trash2, MapPin, Building2, Store, Filter, Eye } from "lucide-react";
import styles from "./branchesTab.module.css";
import BranchModal from "./BranchModal";

interface BranchesTabProps {
    branches: any[];
    setBranches: (branches: any[]) => void;
    clientColor: string;
    clientId: string;
    createBranch: (data: any) => Promise<any>;
    updateBranch: (id: string, data: any) => Promise<any>;
    deleteBranch: (id: string) => Promise<void>;
}

export default function BranchesTab({ branches, setBranches, clientColor, clientId, createBranch, updateBranch, deleteBranch }: BranchesTabProps) {
    const [userRole, setUserRole] = useState<string | null>(null);

    useEffect(() => {
        if (typeof window !== 'undefined') {
            setUserRole(localStorage.getItem("userRole"));
        }
    }, []);

    const [searchTerm, setSearchTerm] = useState("");
    const [filterZone, setFilterZone] = useState("");
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingBranch, setEditingBranch] = useState<any>(null);
    const [isViewOnly, setIsViewOnly] = useState(false);

    const zones = Array.from(new Set(branches.map(b => b.zone || 'Sin Zona')));
    const filteredBranches = branches.filter(branch => {
        const matchesSearch =
            (branch.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (branch.codigo_topaz || '').includes(searchTerm);
        const matchesZone = !filterZone || branch.zone === filterZone;
        return matchesSearch && matchesZone;
    });

    const branchesByZone = zones.reduce<{ [key: string]: any[] }>((acc, zone) => {
        acc[zone] = filteredBranches.filter(b => (b.zone || 'Sin Zona') === zone);
        return acc;
    }, {});

    const handleCreate = () => {
        setEditingBranch(null);
        setIsViewOnly(false);
        setIsModalOpen(true);
    };

    const handleView = (branch: any) => {
        setEditingBranch(branch);
        setIsViewOnly(true);
        setIsModalOpen(true);
    };

    const handleEdit = (branch: any) => {
        setEditingBranch(branch);
        setIsViewOnly(false);
        setIsModalOpen(true);
    };

    const handleDelete = async (id: string) => {
        if (confirm("¿Está seguro de eliminar esta sede?")) {
            try {
                await deleteBranch(id);
            } catch (error) {
                console.error('Error deleting branch:', error);
                alert('❌ Error al eliminar la sede');
            }
        }
    };

    const handleSave = async (branchData: any) => {
        try {
            if (editingBranch) {
                await updateBranch(editingBranch.id, branchData);
            } else {
                await createBranch({ ...branchData, client_id: clientId });
            }
            setIsModalOpen(false);
        } catch (error) {
            console.error('Error saving branch:', error);
            alert('❌ Error al guardar la sede');
        }
    };

    return (
        <div className={styles.container} style={{ '--client-color': clientColor } as any}>
            <BranchModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSave={handleSave}
                branch={editingBranch}
                clientColor={clientColor}
                isViewOnly={isViewOnly}
            />

            {/* Toolbar */}
            <div className={styles.toolbar}>
                <div className={styles.searchBox}>
                    <Search size={20} />
                    <input type="text" placeholder="Buscar sede por nombre o cÓdigo..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                </div>

                <div className={styles.filterBox}>
                    <Filter size={18} />
                    <select value={filterZone} onChange={(e) => setFilterZone(e.target.value)}>
                        <option value="">Todas las Zonas</option>
                        {zones.map(z => <option key={z} value={z}>{z}</option>)}
                    </select>
                </div>

                {userRole === 'admin' && (
                    <button className={styles.createBtn} onClick={handleCreate}>
                        <Plus size={20} />
                        Nueva Sede
                    </button>
                )}
            </div>

            {/* Branches by Zone */}
            <div className={styles.zonesGrid}>
                {Object.entries(branchesByZone).map(([zone, zoneBranches]) => (
                    <div key={zone} className={styles.zoneCard}>
                        <div className={styles.zoneHeader}>
                            <MapPin size={20} />
                            <h3>{zone}</h3>
                            <span className={styles.zoneBadge}>{zoneBranches.length}</span>
                        </div>

                        <div className={styles.branchList}>
                            {zoneBranches.map((branch: any) => (
                                <div key={branch.id} className={styles.branchCard}>
                                    <div className={styles.branchIcon}>
                                        {branch.tipo === "Matriz" ? <Building2 size={22} /> : <Store size={22} />}
                                    </div>
                                    <div className={styles.branchInfo}>
                                        <div className={styles.branchName}>{branch.name || 'Sin nombre'}</div>
                                        <div className={styles.branchAddress}>{branch.address || 'Sin dirección'}</div>
                                        <div className={styles.branchMeta}>
                                            <span className={styles.codeBadge}>{branch.codigo_topaz || 'N/A'}</span>
                                            <span className={`${styles.typeBadge} ${branch.tipo === "Matriz" ? styles.typeMatriz : styles.typeAgencia}`}>
                                                {branch.tipo || 'Agencia'}
                                            </span>
                                        </div>
                                    </div>
                                    <div className={styles.branchActions}>
                                        <button onClick={() => handleView(branch)} title="Visualizar" className={styles.viewBtn}>
                                            <Eye size={16} />
                                        </button>
                                        {userRole === 'admin' && (
                                            <>
                                                <button onClick={() => handleEdit(branch)} title="Editar" className={styles.editBtn}>
                                                    <Edit size={16} />
                                                </button>
                                                <button onClick={() => handleDelete(branch.id)} title="Eliminar" className={styles.deleteBtn}>
                                                    <Trash2 size={16} />
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>

            {filteredBranches.length === 0 && (
                <div className={styles.emptyState}>
                    <div className={styles.emptyIcon}>🏢</div>
                    <p>No hay sedes registradas</p>
                    {userRole === 'admin' && (
                        <button onClick={handleCreate} className={styles.createBtn}>
                            <Plus size={18} />
                            Crear Primera Sede
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}
