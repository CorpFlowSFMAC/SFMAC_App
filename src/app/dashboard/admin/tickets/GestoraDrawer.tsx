"use client";

import { useState, useEffect } from "react";
import { X, Search, UserCheck, RefreshCw, Mail, ShieldCheck } from "lucide-react";
import { gestorasAPI } from "@/lib/routing-api";
import styles from "./TechnicianDrawer.module.css"; // Reutilizamos estilos base de drawers

interface GestoraDrawerProps {
    isOpen: boolean;
    onClose: () => void;
    onAssign: (gestora: any) => void;
}

export default function GestoraDrawer({ isOpen, onClose, onAssign }: GestoraDrawerProps) {
    const [gestoras, setGestoras] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedId, setSelectedId] = useState<string | null>(null);

    useEffect(() => {
        if (!isOpen) return;
        setLoading(true);
        gestorasAPI.getAll()
            .then(data => setGestoras(data || []))
            .catch(err => console.error("Error loading gestoras:", err))
            .finally(() => setLoading(false));
    }, [isOpen]);

    const filtered = gestoras.filter(g => 
        (g.name || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (g.email || "").toLowerCase().includes(searchTerm.toLowerCase())
    );

    const handleConfirm = () => {
        const gestora = gestoras.find(g => g.id === selectedId);
        if (gestora) {
            onAssign(gestora);
            onClose();
        }
    };

    if (!isOpen) return null;

    return (
        <>
            <div className={styles.overlay} onClick={onClose} />
            <div className={`${styles.drawer} ${styles.open}`}>
                <div className={styles.header}>
                    <div className={styles.headerContent}>
                        <h2>Derivar Ticket</h2>
                        <p>Seleccione el/la gestor(a) responsable para este servicio</p>
                    </div>
                    <button className={styles.closeBtn} onClick={onClose}>
                        <X size={20} />
                    </button>
                </div>

                <div className={styles.searchBox}>
                    <Search size={18} />
                    <input
                        type="text"
                        placeholder="Buscar gestor(a) por nombre o correo..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>

                <div className={styles.techniciansList}>
                    {loading ? (
                        <div className={styles.loadingContent}>
                            <RefreshCw className={styles.spin} />
                            <p>Cargando gestores(as)...</p>
                        </div>
                    ) : filtered.length === 0 ? (
                        <div className={styles.emptyState}>
                            <p>No se encontraron gestores(as) activos(as)</p>
                        </div>
                    ) : (
                        filtered.map(g => (
                            <div 
                                key={g.id} 
                                className={`${styles.techCard} ${selectedId === g.id ? styles.selected : ""}`}
                                onClick={() => setSelectedId(g.id)}
                                style={{ padding: "12px" }}
                            >
                                <div className={styles.techAvatar}>
                                    <div className={styles.avatarPlaceholder} style={{ background: "linear-gradient(135deg, #6366f1, #a855f7)" }}>
                                        {(g.name || "G").substring(0, 1).toUpperCase()}
                                    </div>
                                    {selectedId === g.id && (
                                        <div className={styles.checkmark}>
                                            <UserCheck size={18} />
                                        </div>
                                    )}
                                </div>
                                <div className={styles.techInfo}>
                                    <h3 style={{ fontSize: "14px", marginBottom: "2px" }}>{g.name}</h3>
                                    <div className={styles.detailItem}>
                                        <Mail size={12} />
                                        <span>{g.email}</span>
                                    </div>
                                    <div className={styles.detailItem} style={{ marginTop: "4px" }}>
                                        <ShieldCheck size={12} color="#10b981" />
                                        <span style={{ color: "#10b981", fontWeight: 700, fontSize: "10px" }}>ROL GESTOR(A)</span>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                <div className={styles.footer}>
                    <button 
                        className={styles.assignBtn} 
                        disabled={!selectedId}
                        onClick={handleConfirm}
                        style={{ background: "linear-gradient(135deg, #4f46e5, #7c3aed)" }}
                    >
                        <UserCheck size={18} />
                        Derivar Ticket a Responsable
                    </button>
                </div>
            </div>
        </>
    );
}
