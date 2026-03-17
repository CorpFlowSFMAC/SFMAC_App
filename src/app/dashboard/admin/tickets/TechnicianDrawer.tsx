"use client";

import { useState, useEffect } from "react";
import { X, Search, MapPin, Phone, Star, DollarSign, CheckCircle, RefreshCw, Building2, Globe } from "lucide-react";
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
    const [costoVisita, setCostoVisita] = useState("");
    const [searchTerm, setSearchTerm] = useState("");

    // State for microzonification-filtered technicians
    const [microzonTechs, setMicrozonTechs] = useState<any[] | null>(null);
    const [loadingMicrozon, setLoadingMicrozon] = useState(false);
    const [microzonError, setMicrozonError] = useState(false);

    // The branch ID of the ticket
    const branchId = ticket?.branch_id || ticket?.sede?.id || null;

    // Normalizar datos del ticket para el filtro
    const ticketZone = normalizeZone(ticket?.sede?.zona || ticket?.sede?.zone || ticket?.branch_offices?.zone);
    const ticketZoneDisplay = getZoneFullName(ticketZone);
    const ticketBranchName = ticket?.sede?.nombre || ticket?.sede?.name || ticket?.branch_offices?.name || 'Agencia del ticket';

    // Load microzonification-aware technicians when branch is known
    useEffect(() => {
        if (!isOpen || !branchId) return;
        setLoadingMicrozon(true);
        setMicrozonError(false);
        techniciansAPI.getAvailableForBranch(branchId)
            .then(data => setMicrozonTechs(data || []))
            .catch(err => {
                console.error('[TechnicianDrawer] Error loading microzon techs:', err);
                setMicrozonError(true);
                setMicrozonTechs(null); // fallback to local filter
            })
            .finally(() => setLoadingMicrozon(false));
    }, [isOpen, branchId]);

    // Get standardized skill name for matching
    const getStandardizedSkill = () => {
        if (!ticket) return "";
        if (ticket.tipoServicioNombre) return ticket.tipoServicioNombre.toUpperCase();
        const service = getServiceById(ticket.tipoServicio || ticket.service_type);
        if (service) return service.nombreCorto;
        return (ticket.tipoServicio || ticket.service_type || "").toUpperCase();
    };

    const requiredSkill = getStandardizedSkill();

    // Build the pool of technicians to show:
    // - If microzonification data loaded → use it (already filtered by branch coverage)
    // - If no branch or error → fallback to zone-based filter
    const techPool = (() => {
        const base = microzonTechs !== null ? microzonTechs : (technicians || []).filter((tech: any) => {
            const techZones: string[] = tech.assigned_zones?.length
                ? tech.assigned_zones
                : (tech.zone ? [tech.zone] : []);
            return techZones.some(z => normalizeZone(z) === ticketZone);
        });

        return base.filter((tech: any) => {
            // Apply skill filter
            const specialties = tech.specialties || tech.especialidades || [];
            const techSkills = specialties.map((s: string) => s.toUpperCase());
            const matchesSkill = requiredSkill === "" || techSkills.includes(requiredSkill);

            // Apply search filter
            const firstName = tech.first_name || tech.nombre || '';
            const lastName = tech.last_name || tech.apellido || '';
            const fullName = (tech.name || `${firstName} ${lastName}`).toLowerCase();
            const docNumber = tech.document_number || tech.numeroDoc || '';
            const matchesSearch = searchTerm === "" ||
                fullName.includes(searchTerm.toLowerCase()) ||
                docNumber.includes(searchTerm);

            // Status
            const status = (tech.status || tech.estado || '').toLowerCase();
            const isActive = status === 'active' || status === 'activo';

            return matchesSkill && matchesSearch && isActive;
        });
    })();

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

    if (loading || loadingMicrozon) {
        return (
            <div className={styles.loadingOverlay}>
                <div className={styles.loadingContent}>
                    <RefreshCw className={styles.spin} size={40} />
                    <p>{loadingMicrozon ? 'Calculando técnicos para esta agencia...' : 'Cargando técnicos autorizados...'}</p>
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
                    {!microzonError && microzonTechs !== null && (
                        <div className={styles.microzonBadge}>
                            <Globe size={12} />
                            Microzonificación activa · {techPool.length} técnico{techPool.length !== 1 ? 's' : ''} habilitado{techPool.length !== 1 ? 's' : ''}
                        </div>
                    )}
                    {microzonError && (
                        <div className={styles.microzonFallback}>
                            ⚠️ Filtro por zona general (microzonificación no disponible)
                        </div>
                    )}
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
                                                <span>{tech.phone || tech.celular || '---'}</span>
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
