"use client";

import { useState, useEffect } from "react";
import { X, MapPin, Building2, Upload, FileImage, Unlock, Lock } from "lucide-react";
import styles from "./createTicketModal.module.css";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { compressImage } from "@/lib/imageCompression";

interface CreateTicketModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (ticket: any) => void;
}

// Mapeo de especialidades a iconos y colores
const SKILL_ICONS: Record<string, string> = {
    "ELECTRICIDAD": "⚡",
    "CARPINTERÍA": "🪚",
    "GASFITERÍA": "🚰",
    "AIRE ACONDICIONADO": "❄️",
    "CERRAJERÍA": "🔒",
    "OBRAS CIVILES": "🏗️",
    "PINTURA": "🎨",
    "ALBAÑILERÍA": "🧱",
    "VIDRIERÍA": "🪟",
    "VISITA TÉCNICA": "🔍"
};

const SKILL_COLORS: Record<string, string> = {
    "ELECTRICIDAD": "#F59E0B",
    "CARPINTERÍA": "#8B5CF6",
    "GASFITERÍA": "#3B82F6",
    "AIRE ACONDICIONADO": "#06B6D4",
    "CERRAJERÍA": "#EC4899",
    "OBRAS CIVILES": "#EF4444",
    "PINTURA": "#10B981",
    "ALBAÑILERÍA": "#F97316",
    "VIDRIERÍA": "#14B8A6",
    "VISITA TÉCNICA": "#10B981"
};

export default function CreateTicketModal({ isOpen, onClose, onSave }: CreateTicketModalProps) {
    const [clients] = useLocalStorage("clients", []);
    const [clientsData] = useLocalStorage<any>("clientsData", {});
    const [technicians] = useLocalStorage("technicians", []);

    const [formData, setFormData] = useState({
        clienteId: null as number | null,
        sedeId: null as number | null,
        tipoServicio: "",
        urgencia: "Urgente", // FIJO - Siempre urgente
        asunto: "",
        descripcion: "",
        idBanco: "",
        idPendiente: false,
        evidenciaFoto: null as string | null
    });

    const [searchSede, setSearchSede] = useState("");
    const [selectedClient, setSelectedClient] = useState<any>(null);
    const [selectedSede, setSelectedSede] = useState<any>(null);

    // Extraer servicios únicos de los técnicos (DINÁMICO - NO HARDCODED)
    const availableServices = Array.from(
        new Set(
            technicians.flatMap((tech: any) => tech.especialidades || [])
        )
    ).sort();


    useEffect(() => {
        if (!isOpen) {
            setFormData({
                clienteId: null,
                sedeId: null,
                tipoServicio: "",
                urgencia: "Urgente",
                asunto: "",
                descripcion: "",
                idBanco: "",
                idPendiente: false,
                evidenciaFoto: null
            });
            setSelectedClient(null);
            setSelectedSede(null);
            setSearchSede("");
        }
    }, [isOpen]);

    // Soporte para pegar imágenes (Ctrl+V)
    useEffect(() => {
        const handlePaste = (e: ClipboardEvent) => {
            if (!isOpen) return;

            const items = e.clipboardData?.items;
            if (!items) return;

            for (let i = 0; i < items.length; i++) {
                if (items[i].type.indexOf('image') !== -1) {
                    const blob = items[i].getAsFile();
                    if (blob) {
                        compressImage(blob).then(compressed => {
                            const reader = new FileReader();
                            reader.onload = (event) => {
                                setFormData(prev => ({ ...prev, evidenciaFoto: event.target?.result as string }));
                            };
                            reader.readAsDataURL(compressed);
                        });
                    }
                }
            }
        };

        document.addEventListener('paste', handlePaste);
        return () => document.removeEventListener('paste', handlePaste);
    }, [isOpen]);

    if (!isOpen) return null;

    const handleClientSelect = (client: any) => {
        const clientWithData = {
            ...client,
            sedes: clientsData[client.id]?.branches || [] // Usar 'branches' en lugar de 'sedes'
        };
        setSelectedClient(clientWithData);
        setFormData({ ...formData, clienteId: client.id, sedeId: null });
        setSelectedSede(null);
        setSearchSede("");
    };

    const handleSedeSelect = (sede: any) => {
        setSelectedSede(sede);
        setFormData({ ...formData, sedeId: sede.id });
    };

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const compressed = await compressImage(file);
            const reader = new FileReader();
            reader.onloadend = () => {
                setFormData({ ...formData, evidenciaFoto: reader.result as string });
            };
            reader.readAsDataURL(compressed);
        }
    };

    const filteredSedes = selectedClient?.sedes?.filter((sede: any) =>
        sede.nombre.toLowerCase().includes(searchSede.toLowerCase()) ||
        sede.codigoTopaz.includes(searchSede)
    ) || [];

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        if (!formData.clienteId || !formData.sedeId) {
            alert("❌ Debe seleccionar un cliente y una sede");
            return;
        }

        if (!formData.tipoServicio) {
            alert("❌ Debe seleccionar un tipo de servicio");
            return;
        }

        if (!formData.asunto.trim()) {
            alert("❌ Debe agregar un asunto");
            return;
        }

        if (!formData.descripcion.trim()) {
            alert("❌ Debe agregar una descripción del problema");
            return;
        }

        if (!formData.idBanco && !formData.idPendiente) {
            alert("❌ Debe ingresar el ID del banco o marcarlo como pendiente");
            return;
        }

        const ticketData = {
            ...formData,
            clienteNombre: selectedClient?.name || 'Sin nombre',
            clienteColor: selectedClient?.colorAura || '#94A3B8',
            sedeNombre: selectedSede?.nombre || 'Sin nombre',
            sedeZona: selectedSede?.zona || 'Sin zona',
        };

        onSave(ticketData);
    };

    return (
        <div className={styles.overlay}>
            <div
                className={styles.modalWide}
                style={{
                    borderColor: selectedClient?.colorAura || '#E2E8F0',
                    borderWidth: '4px',
                    borderStyle: 'solid'
                }}
            >
                {/* Header */}
                <div className={styles.header}>
                    <div>
                        <h2 className={styles.title}>📋 TRÍPTICO DE CONTROL - CREACIÓN DE TICKET</h2>
                        <p className={styles.subtitle}>Contexto → Servicio → Evidencia</p>
                    </div>
                    <button onClick={onClose} className={styles.closeBtn}>
                        <X size={24} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className={styles.content}>
                    {/* 3 COLUMNAS */}
                    <div className={styles.threeColumns}>

                        {/* COLUMNA 1: EL CONTEXTO (ORIGEN) 🌎 */}
                        <div className={styles.column}>
                            <div className={styles.columnHeader} style={{ background: '#002A8F' }}>
                                <MapPin size={20} />
                                <h3>🌎 EL CONTEXTO (ORIGEN)</h3>
                            </div>

                            <div className={styles.columnContent}>
                                <label className={styles.label}>Seleccione el Cliente *</label>
                                {clients.length === 0 ? (
                                    <div className={styles.emptyMessage}>
                                        ⚠️ No hay clientes registrados
                                    </div>
                                ) : (
                                    <div className={styles.clientGrid}>
                                        {clients.map((client: any) => (
                                            <div
                                                key={client.id}
                                                className={`${styles.clientCard} ${formData.clienteId === client.id ? styles.clientCardActive : ''}`}
                                                onClick={() => handleClientSelect(client)}
                                                style={{
                                                    borderColor: formData.clienteId === client.id ? (client.colorAura || '#002A8F') : '#E2E8F0'
                                                }}
                                            >
                                                {client.logo ? (
                                                    <img src={client.logo} alt={client.name} className={styles.clientLogo} />
                                                ) : (
                                                    <div className={styles.clientInitial} style={{ background: client.colorAura || '#94A3B8' }}>
                                                        {client.icon || client.name?.[0] || '?'}
                                                    </div>
                                                )}
                                                <div className={styles.clientName}>
                                                    {client.name}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {selectedClient && (
                                    <>
                                        <label className={styles.label} style={{ marginTop: '1.5rem' }}>Buscar Agencia, Matriz o CÓdigo *</label>
                                        <input
                                            type="text"
                                            value={searchSede}
                                            onChange={(e) => setSearchSede(e.target.value)}
                                            placeholder="🔍 Nombre o cÓdigo..."
                                            className={styles.input}
                                        />

                                        {filteredSedes.length > 0 && (
                                            <div className={styles.sedesGrid}>
                                                {filteredSedes.map((sede: any) => (
                                                    <div
                                                        key={sede.id}
                                                        className={`${styles.sedeCard} ${formData.sedeId === sede.id ? styles.sedeCardActive : ''}`}
                                                        onClick={() => handleSedeSelect(sede)}
                                                    >
                                                        <Building2 size={16} />
                                                        <div>
                                                            <div className={styles.sedeName}>{sede.nombre}</div>
                                                            <div className={styles.sedeInfo}>{sede.direccion}</div>
                                                            <div className={styles.zoneChip}>📍 {sede.zona}</div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                        </div>

                        {/* COLUMNA 2: EL SERVICIO (INTEGRACIÓN) 🛠️ */}
                        <div className={styles.column}>
                            <div className={styles.columnHeader} style={{ background: '#FF6600' }}>
                                <Building2 size={20} />
                                <h3>🛠️ EL SERVICIO (INTEGRACIÓN)</h3>
                            </div>

                            <div className={styles.columnContent}>
                                <label className={styles.label}>Catálogo de Servicios (Dinámico) *</label>
                                {availableServices.length === 0 ? (
                                    <div className={styles.emptyMessage}>
                                        ⚠️ No hay servicios disponibles.<br />
                                        <small style={{ fontSize: '0.75rem', marginTop: '0.5rem', display: 'block' }}>
                                            Técnicos registrados: {technicians.length}<br />
                                            {technicians.length === 0 ?
                                                'Debe registrar técnicos con especialidades en el Módulo de RRHH.' :
                                                'Los técnicos no tienen especialidades asignadas.'
                                            }
                                        </small>
                                    </div>
                                ) : (
                                    <div className={styles.serviceGrid}>
                                        {availableServices.map((servicio: string) => (
                                            <div
                                                key={servicio}
                                                className={`${styles.serviceCard} ${formData.tipoServicio === servicio ? styles.serviceCardActive : ''}`}
                                                onClick={() => setFormData({ ...formData, tipoServicio: servicio })}
                                                style={{
                                                    borderColor: formData.tipoServicio === servicio ? (SKILL_COLORS[servicio] || '#FF6600') : '#E2E8F0',
                                                    background: formData.tipoServicio === servicio ? `${SKILL_COLORS[servicio] || '#FF6600'}15` : 'white'
                                                }}
                                            >
                                                <span className={styles.serviceIcon}>{SKILL_ICONS[servicio] || '🔧'}</span>
                                                <span className={styles.serviceLabel} style={{ color: formData.tipoServicio === servicio ? (SKILL_COLORS[servicio] || '#FF6600') : '#475569' }}>
                                                    {servicio}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* Prioridad Fija */}
                                <div className={styles.priorityBadge}>
                                    🔥 PRIORIDAD: URGENTE (SLA ESTÁNDAR)
                                </div>

                                <label className={styles.label} style={{ marginTop: '1.5rem' }}>Asunto *</label>
                                <input
                                    type="text"
                                    value={formData.asunto}
                                    onChange={(e) => setFormData({ ...formData, asunto: e.target.value })}
                                    placeholder="Ej: Falla eléctrica en caja principal"
                                    className={styles.input}
                                    required
                                />

                                <label className={styles.label} style={{ marginTop: '1rem' }}>Descripción del Problema *</label>
                                <textarea
                                    value={formData.descripcion}
                                    onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
                                    placeholder="Describa detalladamente el problema reportado..."
                                    className={styles.textarea}
                                    rows={4}
                                    required
                                />

                                {/* LA REGLA DE ORO */}
                                <div className={styles.goldenRule}>
                                    <label className={styles.label}>🔑 LA REGLA DE ORO - N° Ticket Banco</label>

                                    <div className={styles.idToggle}>
                                        <button
                                            type="button"
                                            className={`${styles.idOption} ${!formData.idPendiente ? styles.idOptionActive : ''}`}
                                            onClick={() => setFormData({ ...formData, idPendiente: false })}
                                        >
                                            <Lock size={16} /> Tengo el ID
                                        </button>
                                        <button
                                            type="button"
                                            className={`${styles.idOption} ${formData.idPendiente ? styles.idOptionActive : ''}`}
                                            onClick={() => setFormData({ ...formData, idPendiente: true, idBanco: "" })}
                                        >
                                            <Unlock size={16} /> Pendiente
                                        </button>
                                    </div>

                                    {!formData.idPendiente ? (
                                        <input
                                            type="text"
                                            value={formData.idBanco}
                                            onChange={(e) => setFormData({ ...formData, idBanco: e.target.value.toUpperCase() })}
                                            placeholder="INC-100299"
                                            className={styles.input}
                                            style={{ textTransform: 'uppercase' }}
                                            required={!formData.idPendiente}
                                        />
                                    ) : (
                                        <div className={styles.warningBox}>
                                            <Unlock size={20} color="#F59E0B" />
                                            <span>🔓 GENERAR BLOQUEO: El ticket no podrá cerrarse sin este dato</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* COLUMNA 3: LA EVIDENCIA (SOPORTE) 📸 */}
                        <div className={styles.column}>
                            <div className={styles.columnHeader} style={{ background: '#00FF00', color: '#000' }}>
                                <FileImage size={20} />
                                <h3>📸 LA EVIDENCIA (SOPORTE)</h3>
                            </div>

                            <div className={styles.columnContent}>
                                <label className={styles.label}>Zona de Carga 📷</label>
                                <div className={styles.pasteHint}>
                                    💡 Presione <kbd>Ctrl+V</kbd> para pegar capturas
                                </div>

                                {!formData.evidenciaFoto ? (
                                    <div className={styles.uploadArea}>
                                        <input
                                            type="file"
                                            accept="image/*"
                                            onChange={handleImageUpload}
                                            className={styles.fileInput}
                                            id="evidencia"
                                        />
                                        <label htmlFor="evidencia" className={styles.uploadLabel}>
                                            <Upload size={40} />
                                            <span className={styles.uploadText}>
                                                Arrastre o click para subir
                                            </span>
                                            <span className={styles.uploadHint}>
                                                JPG, PNG (Max 5MB)
                                            </span>
                                        </label>
                                    </div>
                                ) : (
                                    <div className={styles.imagePreview}>
                                        <img src={formData.evidenciaFoto} alt="Evidencia" />
                                        <button
                                            type="button"
                                            className={styles.removeImageBtn}
                                            onClick={() => setFormData({ ...formData, evidenciaFoto: null })}
                                        >
                                            ✕ Eliminar
                                        </button>
                                    </div>
                                )}

                                <div className={styles.infoBox}>
                                    <div className={styles.infoTitle}>💡 Recomendaciones</div>
                                    <ul className={styles.infoList}>
                                        <li>Tome fotos claras del problema</li>
                                        <li>Incluya vista general y detalles</li>
                                        <li>Use Ctrl+V para pegar capturas</li>
                                        <li>Puede agregar más fotos después</li>
                                    </ul>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Footer con Estado */}
                    <div className={styles.footer}>
                        <div className={styles.footerStatus}>
                            {selectedClient && (
                                <span>Creando ticket Urgente para <strong>{selectedClient.name}</strong>...</span>
                            )}
                        </div>
                        <div className={styles.footerActions}>
                            <button type="button" onClick={onClose} className={styles.cancelBtn}>
                                Cancelar
                            </button>
                            <button type="submit" className={styles.submitBtn}>
                                CREAR Y ASIGNAR 🚀
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
}
