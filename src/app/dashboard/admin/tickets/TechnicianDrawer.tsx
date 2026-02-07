"use client";

import { useState, useEffect } from "react";
import { X, Search, MapPin, Phone, Star, DollarSign, CheckCircle } from "lucide-react";
import { SKILL_ICONS, SERVICE_TYPES, getServiceById } from "@/lib/serviceTypes";
import { normalizeZone, areZonesCompatible, getZoneFullName } from "@/lib/zones";
import styles from "./TechnicianDrawer.module.css";

interface TechnicianDrawerProps {
    isOpen: boolean;
    onClose: () => void;
    ticket: any;
    onAssign: (data: any) => void;
    onShowToast?: (title: string, message: string, type: 'success' | 'error' | 'info') => void;
}

export default function TechnicianDrawer({ isOpen, onClose, ticket, onAssign, onShowToast }: TechnicianDrawerProps) {
    const [technicians, setTechnicians] = useState<any[]>([]);
    const [selectedTechnician, setSelectedTechnician] = useState<any>(null);
    const [costoVisita, setCostoVisita] = useState("");
    const [searchTerm, setSearchTerm] = useState("");

    // Cargar técnicos desde localStorage
    useEffect(() => {
        if (typeof window !== 'undefined') {
            const stored = localStorage.getItem('technicians');
            if (stored) {
                try {
                    setTechnicians(JSON.parse(stored));
                } catch (e) {
                    console.error('Error loading technicians:', e);
                    setTechnicians([]);
                }
            }
        }
    }, [isOpen]);

    // Normalizar datos del ticket para el filtro
    const ticketZone = normalizeZone(ticket?.sede?.zona);
    const ticketZoneDisplay = getZoneFullName(ticketZone);

    // Obtener el nombre corto estandarizado del servicio (ej: "ELECTRICIDAD")
    const getStandardizedSkill = () => {
        if (!ticket) return "";

        // 1. Intentar con tipoServicioNombre (que ya debería ser el nombre corto)
        if (ticket.tipoServicioNombre) return ticket.tipoServicioNombre.toUpperCase();

        // 2. Intentar buscar por ID
        const service = getServiceById(ticket.tipoServicio);
        if (service) return service.nombreCorto;

        // 3. Fallback al ID en mayúsculas
        return (ticket.tipoServicio || "").toUpperCase();
    };

    const requiredSkill = getStandardizedSkill();

    // Filtrar técnicos compatibles
    const compatibleTechnicians = technicians.filter((tech: any) => {
        // Normalizar zona del técnico
        const techZone = normalizeZone(tech.zona);

        // Filtro por zona (usando sistema normalizado)
        const matchesZone = areZonesCompatible(ticketZone, techZone);

        // Filtro por especialidad/servicio (normalizado a mayúsculas)
        const techSkills = (tech.especialidades || []).map((s: string) => s.toUpperCase());
        const matchesSkill = requiredSkill === "" || techSkills.includes(requiredSkill);

        // Filtro por búsqueda
        const matchesSearch = searchTerm === "" ||
            tech.nombre?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            tech.apellido?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            tech.numeroDoc?.includes(searchTerm);

        return matchesZone && matchesSkill && matchesSearch;
    });

    const handleAssign = () => {
        if (!selectedTechnician) return;

        const visita = costoVisita ? parseFloat(costoVisita) : 0;
        if (visita > 20) {
            if (onShowToast) {
                onShowToast("Costo Excesivo", "El costo máximo de visita técnica es de S/ 20.00", "error");
            } else {
                alert("El costo máximo de visita técnica es de S/ 20.00");
            }
            return;
        }

        const assignmentData = {
            tecnico: {
                id: selectedTechnician.id,
                nombre: `${selectedTechnician.nombre} ${selectedTechnician.apellido}`,
                celular: selectedTechnician.celular,
                zona: selectedTechnician.zona,
                especialidades: selectedTechnician.especialidades,
                foto: selectedTechnician.foto,
                banco: selectedTechnician.banco,
                cuentaBancaria: selectedTechnician.cuentaBancaria,
                cci: selectedTechnician.cci,
                yape: selectedTechnician.yape,
                plin: selectedTechnician.plin
            },
            costoVisita: visita,
            fechaAsignacion: new Date().toISOString()
        };

        onAssign(assignmentData);
    };

    if (!isOpen) return null;

    const handleOverlayClick = (e: React.MouseEvent) => {
        e.stopPropagation(); // Evitar que el evento llegue a la ventana principal
        onClose();
    };

    return (
        <>
            {/* Overlay - Solo cierra el drawer */}
            <div className={styles.overlay} onClick={handleOverlayClick} />

            {/* Drawer Lateral */}
            <div className={`${styles.drawer} ${isOpen ? styles.open : ''}`} onClick={(e) => e.stopPropagation()}>
                {/* Header */}
                <div className={styles.header}>
                    <div className={styles.headerContent}>
                        <h2>Asignar Técnico</h2>
                        <p>Selecciona un técnico compatible con la zona y servicio</p>
                    </div>
                    <button className={styles.closeBtn} onClick={onClose}>
                        <X size={20} />
                    </button>
                </div>

                {/* Info del Ticket */}
                <div className={styles.ticketInfo}>
                    <div className={styles.infoItem}>
                        <span className={styles.label}>Zona</span>
                        <span className={styles.value}>📍 {ticketZoneDisplay}</span>
                    </div>
                    <div className={styles.infoItem}>
                        <span className={styles.label}>Servicio</span>
                        <span className={styles.value}>⚙️ {ticket?.tipoServicioNombre || ticket?.tipoServicio}</span>
                    </div>
                </div>

                {/* Búsqueda */}
                <div className={styles.searchBox}>
                    <Search size={18} />
                    <input
                        type="text"
                        placeholder="Buscar por nombre o documento..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>

                {/* Lista de Técnicos */}
                <div className={styles.techniciansList}>
                    {compatibleTechnicians.length === 0 ? (
                        <div className={styles.emptyState}>
                            <p>❌ No hay técnicos compatibles disponibles</p>
                            <small>
                                Zona requerida: {ticketZoneDisplay}<br />
                                Especialidad requerida: {ticket?.tipoServicioNombre || ticket?.tipoServicio}
                            </small>
                        </div>
                    ) : (
                        compatibleTechnicians.map((tech: any) => {
                            const SkillIcon = SKILL_ICONS[tech.especialidades?.[0]];
                            const isSelected = selectedTechnician?.id === tech.id;

                            return (
                                <div
                                    key={tech.id}
                                    className={`${styles.techCard} ${isSelected ? styles.selected : ''}`}
                                    onClick={() => setSelectedTechnician(tech)}
                                >
                                    {/* Avatar */}
                                    <div className={styles.techAvatar}>
                                        {tech.foto ? (
                                            <img src={tech.foto} alt={tech.nombre} />
                                        ) : (
                                            <div className={styles.avatarPlaceholder}>
                                                {tech.nombre?.charAt(0)}{tech.apellido?.charAt(0)}
                                            </div>
                                        )}
                                        {isSelected && (
                                            <div className={styles.checkmark}>
                                                <CheckCircle size={20} />
                                            </div>
                                        )}
                                    </div>

                                    {/* Info */}
                                    <div className={styles.techInfo}>
                                        <h3>{tech.nombre} {tech.apellido}</h3>
                                        <div className={styles.techDetails}>
                                            <div className={styles.detailItem}>
                                                <Phone size={12} />
                                                <span>{tech.celular || 'Sin teléfono'}</span>
                                            </div>
                                            <div className={styles.detailItem}>
                                                <MapPin size={12} />
                                                <span>{tech.zona}</span>
                                            </div>
                                            <div className={styles.detailItem}>
                                                <Star size={12} />
                                                <span>{tech.calificacion}/5</span>
                                            </div>
                                        </div>

                                        {/* Especialidades */}
                                        <div className={styles.skills}>
                                            {tech.especialidades?.map((skill: string) => {
                                                const Icon = SKILL_ICONS[skill];
                                                return (
                                                    <span key={skill} className={styles.skillBadge}>
                                                        {Icon && <Icon size={10} />}
                                                        {skill}
                                                    </span>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>

                {/* Costos Operativos Iniciales */}
                {selectedTechnician && (
                    <div className={styles.costoSection}>
                        <div className={styles.costItem}>
                            <label htmlFor="costoVisita">
                                <MapPin size={14} />
                                Costo de Visita (Máx. S/ 20)
                            </label>
                            <div className={styles.inputGroup}>
                                <span className={styles.currency}>S/.</span>
                                <input
                                    id="costoVisita"
                                    type="number"
                                    placeholder="0.00"
                                    max="20"
                                    value={costoVisita}
                                    onChange={(e) => setCostoVisita(e.target.value)}
                                />
                            </div>
                        </div>
                        <small>Este costo técnico se descontará de la utilidad bruta del ticket.</small>
                    </div>
                )}

                {/* Footer con botón */}
                <div className={styles.footer}>
                    <button
                        className={styles.assignBtn}
                        onClick={handleAssign}
                        disabled={!selectedTechnician}
                    >
                        <CheckCircle size={18} />
                        Asignar y Continuar
                    </button>
                </div>
            </div>
        </>
    );
}
