"use client";

import { useState, useEffect } from "react";
import { X, Search, MapPin, Phone, Star, DollarSign, CheckCircle, RefreshCw, Building2 } from "lucide-react";
import { useAppData } from "@/lib/AppDataContext";
import { SKILL_ICONS, getServiceById } from "@/lib/serviceTypes";
import { normalizeZone, getZoneFullName, ZONES } from "@/lib/zones";
import { techniciansAPI } from "@/lib/supabase-api";
import styles from "./TechnicianDrawer.module.css";

interface TechnicianDrawerProps {
    isOpen: boolean;
    onClose: () => void;
    ticket: any;
    onAssign: (data: any) => void;
    onShowToast?: (title: string, message: string, type: 'success' | 'error' | 'info') => void;
}

export default function TechnicianDrawer({ isOpen, onClose, ticket, onAssign, onShowToast }: TechnicianDrawerProps) {
    const { technicians, loadingTechnicians: loading } = useAppData();
    const [selectedTechnician, setSelectedTechnician] = useState<any>(null);
    const [searchTerm, setSearchTerm] = useState("");

    // The branch ID of the ticket
    const branchId = ticket?.branch_id || ticket?.sede?.id || null;

    // Normalizar datos del ticket para el filtro
    const ticketZone = normalizeZone(ticket?.sede?.zona || ticket?.sede?.zone || ticket?.branch_offices?.zone);
    const ticketZoneDisplay = getZoneFullName(ticketZone);
    const ticketBranchName = ticket?.sede?.nombre || ticket?.sede?.name || ticket?.branch_offices?.name || 'Agencia del ticket';

    // Get standardized skill name for matching
    const getStandardizedSkill = () => {
        if (!ticket) return "";
        if (ticket.tipoServicioNombre) return ticket.tipoServicioNombre.toUpperCase();
        const service = getServiceById(ticket.tipoServicio || ticket.service_type);
        if (service) return service.nombreCorto;
        return (ticket.tipoServicio || ticket.service_type || "").toUpperCase();
    };

    const requiredSkill = getStandardizedSkill();

    // Build the pool of technicians - optimizado para evitar latencia:
    // - SIEMPRE usar técnicos de useAppData directamente (cargados al iniciar app)
    // - Filtrar localmente por zona + skill (sin llamada extra a BD)
    const techPool = technicians?.filter((tech: any) => {
        // Filtro por zona
        const techZones: string[] = tech.assigned_zones?.length
            ? tech.assigned_zones
            : (tech.zone ? [tech.zone] : []);
        const matchesZone = techZones.some(z => normalizeZone(z) === ticketZone);

        // Filtro por skill
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

        // Solo activos
        const status = (tech.status || tech.estado || '').toLowerCase();
        const isActive = status === 'active' || status === 'activo';

        return matchesZone && matchesSkill && matchesSearch && isActive;
    }) || [];

    // Debug: ver estructura del primer técnico
    if (technicians && technicians.length > 0) {
        console.log('[TechnicianDrawer] Primer técnico - todas las keys:', Object.keys(technicians[0]));
        console.log('[TechnicianDrawer] Primer técnico - datos:', technicians[0]);
    }

    const handleAssign = () => {
        if (!selectedTechnician) return;

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
                        <p>Técnicos habilitados para esta agencia y servicio</p>
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
                        <span className={styles.label}>Agencia</span>
                        <span className={styles.value}><Building2 size={12} /> {ticketBranchName}</span>
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
                    {techPool.length === 0 ? (
                        <div className={styles.emptyState}>
                            <p>❌ No hay técnicos habilitados para esta agencia</p>
                            <small>
                                Agencia: {ticketBranchName}<br />
                                Zona: {ticketZoneDisplay}<br />
                                Especialidad: {ticket?.tipoServicioNombre || ticket?.tipoServicio}<br />
                                <em>Asigne zonas/agencias al técnico en el módulo de gestión.</em>
                            </small>
                        </div>
                    ) : (
                        techPool.map((tech: any) => {
                            const specialties = tech.specialties || tech.especialidades || [];
                            const SkillIcon = SKILL_ICONS[specialties[0]];
                            const isSelected = selectedTechnician?.id === tech.id;
                            const photo = tech.photo || tech.foto;
                            const name = tech.name || `${tech.first_name || tech.nombre} ${tech.last_name || tech.apellido}`;
                            // Zone pills for display
                            const techZones: string[] = tech.assigned_zones?.length
                                ? tech.assigned_zones
                                : (tech.zone ? [tech.zone] : []);
                            const zoneObjs = techZones.map(zId => ZONES.find(z => z.id === zId)).filter(Boolean);

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
                                                <span>{tech.phone || tech.celular || tech.telefono || tech.numero_telefono || tech.contact_phone || tech.mobile || '---'}</span>
                                            </div>
                                            <div className={styles.detailItem}>
                                                <MapPin size={12} />
                                                <span>{zoneObjs.map((z: any) => `${z.icon} ${z.label}`).join(', ') || tech.zone || tech.zona}</span>
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
