"use client";

import { useState, useEffect } from "react";
import { User, MapPin, Zap, DollarSign, RefreshCw, CheckCircle2, AlertTriangle, Phone } from "lucide-react";
import styles from "./TechnicianAssignment.module.css";
import { useTechnicians } from "@/hooks/useSupabaseData";
import { getServiceById, SKILL_ICONS } from "@/lib/serviceTypes";

interface TechnicianAssignmentProps {
    ticket: any;
    onAssign: (data: any) => void;
}

export default function TechnicianAssignment({ ticket, onAssign }: TechnicianAssignmentProps) {
    const { technicians, loading } = useTechnicians();
    const [selectedTech, setSelectedTech] = useState<any>(ticket.tecnicoAsignado || null);
    const [costoPasaje, setCostoPasaje] = useState<number>(ticket.costoPasaje || 0);
    const [showReassign, setShowReassign] = useState(false);
    const [motivoReasignacion, setMotivoReasignacion] = useState("");

    const service = getServiceById(ticket.tipoServicio);

    // Filtrar técnicos compatibles
    const compatibleTechnicians = technicians.filter((tech: any) => {
        // 1. Filtro por zona (Normalizado)
        const techZone = (tech.zone || tech.zona || '').toUpperCase();
        const ticketZone = (ticket.sede?.zone || ticket.sede?.zona || '').toUpperCase();
        const matchesZone = techZone === ticketZone;

        // 2. Filtro por especialidad (debe tener la especialidad del servicio)
        const specialties = tech.specialties || tech.especialidades || [];
        const hasSkill = specialties.includes(service?.nombreCorto || ticket.tipoServicio);

        // 3. Filtro por estado activo (Normalizado)
        const status = (tech.status || tech.estado || '').toLowerCase();
        const isActive = status === "activo" || status === "active" || status === "Activo";

        return matchesZone && hasSkill && isActive;
    });

    if (loading) {
        return (
            <div className={styles.loadingContainer}>
                <RefreshCw className={styles.spin} size={24} />
                <p>Buscando técnicos compatibles...</p>
            </div>
        );
    }

    const handleAssign = () => {
        if (!selectedTech) {
            alert("⚠️ Debe seleccionar un técnico");
            return;
        }

        const assignmentData = {
            tecnicoAsignado: selectedTech,
            costoPasaje: costoPasaje,
            fechaAsignacion: new Date().toISOString(),
            estado: "En Inspección",
            estadoId: "visita_programada"
        };

        onAssign(assignmentData);
    };

    const handleReassign = () => {
        if (!selectedTech) {
            alert("⚠️ Debe seleccionar un nuevo técnico");
            return;
        }

        if (!motivoReasignacion.trim()) {
            alert("⚠️ Debe especificar el motivo de la reasignación");
            return;
        }

        const reassignmentData = {
            tecnicoAsignado: selectedTech,
            costoPasaje: costoPasaje,
            fechaReasignacion: new Date().toISOString(),
            motivoReasignacion: motivoReasignacion,
            tecnicoAnterior: ticket.tecnicoAsignado
        };

        onAssign(reassignmentData);
        setShowReassign(false);
        setMotivoReasignacion("");
    };

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <div className={styles.headerIcon}>
                    <User size={24} />
                </div>
                <div>
                    <h2 className={styles.title}>Asignación de Técnico</h2>
                    <p className={styles.subtitle}>
                        Seleccione el técnico según zona, especialidad y disponibilidad
                    </p>
                </div>
            </div>

            {/* Información del Ticket */}
            <div className={styles.ticketInfo}>
                <div className={styles.infoItem}>
                    <MapPin size={16} />
                    <div>
                        <strong>Zona:</strong> {ticket.sede?.zona || 'No definida'}
                    </div>
                </div>
                <div className={styles.infoItem}>
                    <Zap size={16} />
                    <div>
                        <strong>Servicio:</strong> {service?.nombre || ticket.tipoServicio}
                    </div>
                </div>
            </div>

            {/* Técnico Asignado Actual */}
            {ticket.tecnicoAsignado && !showReassign && (
                <div className={styles.currentTech}>
                    <div className={styles.currentTechHeader}>
                        <CheckCircle2 size={20} color="#10B981" />
                        <h3>Técnico Asignado</h3>
                    </div>
                    <div className={styles.techCard}>
                        <div className={styles.techAvatar}>
                            {(ticket.tecnicoAsignado.photo || ticket.tecnicoAsignado.foto) ? (
                                <img src={ticket.tecnicoAsignado.photo || ticket.tecnicoAsignado.foto} alt={ticket.tecnicoAsignado.name || ticket.tecnicoAsignado.nombre} />
                            ) : (
                                <User size={32} />
                            )}
                        </div>
                        <div className={styles.techInfo}>
                            <h4>{ticket.tecnicoAsignado.name || `${ticket.tecnicoAsignado.nombre} ${ticket.tecnicoAsignado.apellido}`}</h4>
                            <div className={styles.techMeta}>
                                <span>📱 {ticket.tecnicoAsignado.phone || ticket.tecnicoAsignado.celular}</span>
                                <span>📍 {ticket.tecnicoAsignado.zone || ticket.tecnicoAsignado.zona}</span>
                            </div>
                            <div className={styles.techSkills}>
                                {(ticket.tecnicoAsignado.specialties || ticket.tecnicoAsignado.especialidades)?.map((skill: string) => {
                                    const Icon = SKILL_ICONS[skill];
                                    return Icon ? <Icon key={skill} size={14} /> : null;
                                })}
                            </div>
                        </div>
                        <button
                            className={styles.reassignBtn}
                            onClick={() => setShowReassign(true)}
                        >
                            <RefreshCw size={16} />
                            Reasignar
                        </button>
                    </div>
                </div>
            )}

            {/* Selector de Técnico (Asignación o Reasignación) */}
            {(!ticket.tecnicoAsignado || showReassign) && (
                <>
                    {showReassign && (
                        <div className={styles.reassignAlert}>
                            <AlertTriangle size={20} />
                            <div>
                                <strong>Reasignación de Técnico</strong>
                                <p>Especifique el motivo del cambio y seleccione el nuevo técnico</p>
                            </div>
                        </div>
                    )}

                    {showReassign && (
                        <div className={styles.formGroup}>
                            <label className={styles.label}>
                                Motivo de Reasignación <span className={styles.required}>*</span>
                            </label>
                            <textarea
                                className={styles.textarea}
                                placeholder="Ej: El técnico tuvo un percance y no puede realizar la visita"
                                value={motivoReasignacion}
                                onChange={(e) => setMotivoReasignacion(e.target.value)}
                                rows={3}
                            />
                        </div>
                    )}

                    <div className={styles.formGroup}>
                        <label className={styles.label}>
                            {showReassign ? 'Nuevo Técnico' : 'Seleccionar Técnico'}{' '}
                            <span className={styles.required}>*</span>
                        </label>

                        {compatibleTechnicians.length === 0 ? (
                            <div className={styles.noTechs}>
                                <AlertTriangle size={24} color="#F59E0B" />
                                <p>No hay técnicos disponibles con la especialidad requerida en esta zona</p>
                            </div>
                        ) : (
                            <div className={styles.techGrid}>
                                {compatibleTechnicians.map((tech: any) => {
                                    const isSelected = selectedTech?.id === tech.id;
                                    return (
                                        <div
                                            key={tech.id}
                                            className={`${styles.techOption} ${isSelected ? styles.selected : ''}`}
                                            onClick={() => setSelectedTech(tech)}
                                        >
                                            <div className={styles.techAvatar}>
                                                {(tech.photo || tech.foto) ? (
                                                    <img src={tech.photo || tech.foto} alt={tech.name || tech.nombre} />
                                                ) : (
                                                    <User size={24} />
                                                )}
                                            </div>
                                            <div className={styles.techDetails}>
                                                <h4>{tech.name || `${tech.nombre} ${tech.apellido}`}</h4>
                                                <div className={styles.techContact}>
                                                    <Phone size={12} />
                                                    {tech.phone || tech.celular}
                                                </div>
                                                <div className={styles.techBadges}>
                                                    {(tech.specialties || tech.especialidades)?.slice(0, 2).map((skill: string) => (
                                                        <span key={skill} className={styles.skillBadge}>
                                                            {skill}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                            {isSelected && (
                                                <div className={styles.checkMark}>
                                                    <CheckCircle2 size={20} color="#10B981" />
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </>
            )}

            {/* Costo de Pasaje (Opcional) */}
            <div className={styles.formGroup}>
                <label className={styles.label}>
                    <DollarSign size={16} />
                    Costo de Pasajes (Opcional)
                </label>
                <div className={styles.moneyInput}>
                    <span className={styles.currency}>S/.</span>
                    <input
                        type="number"
                        min="0"
                        step="0.50"
                        value={costoPasaje}
                        onChange={(e) => setCostoPasaje(Number(e.target.value))}
                        placeholder="0.00"
                    />
                </div>
                <small className={styles.hint}>
                    💡 Este costo afectará la rentabilidad en la liquidación final
                </small>
            </div>

            {/* Botones de Acción */}
            <div className={styles.actions}>
                {showReassign && (
                    <button
                        className={styles.cancelBtn}
                        onClick={() => {
                            setShowReassign(false);
                            setSelectedTech(ticket.tecnicoAsignado);
                            setMotivoReasignacion("");
                        }}
                    >
                        Cancelar
                    </button>
                )}
                <button
                    className={styles.assignBtn}
                    onClick={showReassign ? handleReassign : handleAssign}
                    disabled={!selectedTech || (showReassign && !motivoReasignacion.trim())}
                >
                    <CheckCircle2 size={18} />
                    {showReassign ? 'Confirmar Reasignación' : 'Asignar y Continuar'}
                </button>
            </div>
        </div>
    );
}
