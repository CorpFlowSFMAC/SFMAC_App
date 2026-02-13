"use client";

import { useState } from "react";
import { X, Search, MapPin, Phone, Star, DollarSign, CheckCircle, RefreshCw } from "lucide-react";
import { useTechnicians } from "@/hooks/useSupabaseData";
import { SKILL_ICONS, getServiceById } from "@/lib/serviceTypes";
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
    const { technicians, loading } = useTechnicians();
    const [selectedTechnician, setSelectedTechnician] = useState<any>(null);
    const [costoVisita, setCostoVisita] = useState("");
    const [searchTerm, setSearchTerm] = useState("");

    // Normalizar datos del ticket para el filtro
    const ticketZone = normalizeZone(ticket?.sede?.zona || ticket?.sede?.zone);
    const ticketZoneDisplay = getZoneFullName(ticketZone);

    // Obtener el nombre corto estandarizado del servicio (ej: "ELECTRICIDAD")
    const getStandardizedSkill = () => {
        if (!ticket) return "";

        // 1. Intentar con tipoServicioNombre (que ya debería ser el nombre corto)
        if (ticket.tipoServicioNombre) return ticket.tipoServicioNombre.toUpperCase();

        // 2. Intentar buscar por ID
        const service = getServiceById(ticket.tipoServicio || ticket.service_type);
        if (service) return service.nombreCorto;

        // 3. Fallback al ID en mayúsculas
        return (ticket.tipoServicio || ticket.service_type || "").toUpperCase();
    };

    const requiredSkill = getStandardizedSkill();

    // Filtrar técnicos compatibles
    const compatibleTechnicians = (technicians || []).filter((tech: any) => {
        // Normalizar zona del técnico
        const techZone = normalizeZone(tech.zone || tech.zona);

        // Filtro por zona (usando sistema normalizado)
        const matchesZone = areZonesCompatible(ticketZone, techZone);

        // Filtro por especialidad/servicio (normalizado a mayúsculas)
        const specialties = tech.specialties || tech.especialidades || [];
        const techSkills = specialties.map((s: string) => s.toUpperCase());
        const matchesSkill = requiredSkill === "" || techSkills.includes(requiredSkill);

        // Filtro por búsqueda
        const firstName = tech.first_name || tech.nombre || '';
        const lastName = tech.last_name || tech.apellido || '';
        const fullName = (tech.name || `${firstName} ${lastName}`).toLowerCase();
        const docNumber = tech.document_number || tech.numeroDoc || '';

        const matchesSearch = searchTerm === "" ||
            fullName.includes(searchTerm.toLowerCase()) ||
            docNumber.includes(searchTerm);

        // Filtro de estado Activo
        const status = (tech.status || tech.estado || '').toLowerCase();
        const isActive = status === 'active' || status === 'activo';

        return matchesZone && matchesSkill && matchesSearch && isActive;
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
                name: selectedTechnician.name,
                nombre: selectedTechnician.name || `${selectedTechnician.first_name || ''} ${selectedTechnician.last_name || ''}`.trim(),
                apellido: selectedTechnician.last_name || selectedTechnician.apellido,
                celular: selectedTechnician.phone || selectedTechnician.celular,
                zona: selectedTechnician.zone || selectedTechnician.zona,
                especialidades: selectedTechnician.specialties || selectedTechnician.especialidades,
                foto: selectedTechnician.photo || selectedTechnician.foto,
                banco: selectedTechnician.bank_name || selectedTechnician.banco,
                numeroCuenta: selectedTechnician.account_number || selectedTechnician.numeroCuenta,
                cci: selectedTechnician.cci,
                yape: selectedTechnician.yape_number || selectedTechnician.yape,
                plin: selectedTechnician.plin_number || selectedTechnician.plin
            },
            costoVisita: visita,
            fechaAsignacion: new Date().toISOString()
        };

        onAssign(assignmentData);
    };

    if (!isOpen) return null;

    if (loading) {
        return (
            <div className={styles.loadingOverlay}>
                <div className={styles.loadingContent}>
                    <RefreshCw className={styles.spin} size={40} />
                    <p>Cargando técnicos autorizados...</p>
                </div>
            </div>
        );
    }

    const handleOverlayClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        onClose();
    };

    return (
        <>
            <div className={styles.overlay} onClick={handleOverlayClick} />

            <div className={`${styles.drawer} ${isOpen ? styles.open : ''}`} onClick={(e) => e.stopPropagation()}>
                <div className={styles.header}>
                    <div className={styles.headerContent}>
                        <h2>Asignar Técnico</h2>
                        <p>Selecciona un técnico compatible con la zona y servicio</p>
                    </div>
                    <button className={styles.closeBtn} onClick={onClose}>
                        <X size={20} />
                    </button>
                </div>

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

                <div className={styles.searchBox}>
                    <Search size={18} />
                    <input
                        type="text"
                        placeholder="Buscar por nombre o documento..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>

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
                            const specialties = tech.specialties || tech.especialidades || [];
                            const SkillIcon = SKILL_ICONS[specialties[0]];
                            const isSelected = selectedTechnician?.id === tech.id;
                            const photo = tech.photo || tech.foto;
                            const name = tech.name || `${tech.first_name || tech.nombre} ${tech.last_name || tech.apellido}`;

                            return (
                                <div
                                    key={tech.id}
                                    className={`${styles.techCard} ${isSelected ? styles.selected : ''}`}
                                    onClick={() => setSelectedTechnician(tech)}
                                >
                                    <div className={styles.techAvatar}>
                                        {photo ? (
                                            <img src={photo} alt={name} />
                                        ) : (
                                            <div className={styles.avatarPlaceholder}>
                                                {name.substring(0, 2).toUpperCase()}
                                            </div>
                                        )}
                                        {isSelected && (
                                            <div className={styles.checkmark}>
                                                <CheckCircle size={20} />
                                            </div>
                                        )}
                                    </div>

                                    <div className={styles.techInfo}>
                                        <h3>{name}</h3>
                                        <div className={styles.techDetails}>
                                            <div className={styles.detailItem}>
                                                <Phone size={12} />
                                                <span>{tech.phone || tech.celular || '---'}</span>
                                            </div>
                                            <div className={styles.detailItem}>
                                                <MapPin size={12} />
                                                <span>{tech.zone || tech.zona}</span>
                                            </div>
                                            <div className={styles.detailItem}>
                                                <Star size={12} />
                                                <span>{tech.rating || tech.calificacion || 5}/5</span>
                                            </div>
                                        </div>

                                        <div className={styles.skills}>
                                            {specialties.map((skill: string) => {
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
