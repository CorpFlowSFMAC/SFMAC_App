"use client";

import { useState } from "react";
import { Plus, Search, Users, Sparkles, Filter, Trash2, Wrench } from "lucide-react";
import { useRouter } from "next/navigation";
import styles from "./technicians.module.css";
import TechnicianDrawer from "./TechnicianDrawer";
import { useAppData } from "@/lib/AppDataContext";
import { SKILL_ICONS, SKILL_COLORS, SERVICE_TYPES } from "@/lib/serviceTypes";

export default function TechniciansPage() {
    const router = useRouter();
    const { technicians, loadingTechnicians: loading, createTechnician, updateTechnician, deleteTechnician } = useAppData();
    const [searchTerm, setSearchTerm] = useState("");
    const [filterZone, setFilterZone] = useState("");
    const [filterSkill, setFilterSkill] = useState("");
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);
    const [editingTech, setEditingTech] = useState<any>(null);

    const zones = Array.from(new Set(technicians.map((t: any) => t.zone || t.zona).filter(Boolean)));
    const allSkills = SERVICE_TYPES.map(s => s.nombreCorto);

    const filteredTechnicians = technicians.filter((tech: any) => {
        const firstName = tech.first_name || tech.nombre || '';
        const lastName = tech.last_name || tech.apellido || '';
        const fullName = (tech.name || `${firstName} ${lastName}`.trim() || '').toLowerCase();
        const docNumber = tech.document_number || tech.numeroDoc || '';

        const matchesSearch =
            fullName.includes(searchTerm.toLowerCase()) ||
            docNumber.includes(searchTerm);
        const matchesZone = !filterZone || (tech.zone || tech.zona) === filterZone;
        const matchesSkill = !filterSkill || (tech.specialties || tech.especialidades || []).includes(filterSkill);
        return matchesSearch && matchesZone && matchesSkill;
    });

    const handleCreate = () => {
        setEditingTech(null);
        setIsDrawerOpen(true);
    };

    const handleEdit = (tech: any) => {
        setEditingTech(tech);
        setIsDrawerOpen(true);
    };

    const handleSave = async (techData: any) => {
        try {
            if (editingTech) {
                await updateTechnician(editingTech.id, techData);
            } else {
                // Validar DNI duplicado
                const docExists = technicians.some((t: any) =>
                    (t.document_number || t.numeroDoc) === (techData.document_number || techData.numeroDoc)
                );
                if (docExists) {
                    alert(`❌ El documento ${techData.document_number || techData.numeroDoc} ya está registrado`);
                    return;
                }
                await createTechnician(techData);
            }
            setIsDrawerOpen(false);
            setEditingTech(null);
        } catch (error) {
            console.error('Error saving technician:', error);
            alert('❌ Error al guardar el técnico. Por favor intenta nuevamente.');
        }
    };

    const handleDelete = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();

        const tech = technicians.find((t: any) => t.id === id);
        if (!tech) return;

        const firstName = tech.first_name || tech.nombre || '';
        const lastName = tech.last_name || tech.apellido || '';
        const fullName = tech.name || `${firstName} ${lastName}`.trim() || 'Técnico';

        if (confirm(`¿Está seguro de eliminar al técnico "${fullName}"?\n\nEsta acción no se puede deshacer.`)) {
            try {
                await deleteTechnician(id);
            } catch (error) {
                console.error('Error deleting technician:', error);
                alert('❌ Error al eliminar el técnico. Por favor intenta nuevamente.');
            }
        }
    };

    if (loading) {
        return (
            <div className={styles.container}>
                <div className={styles.loadingState}>
                    <Sparkles className={styles.loadingIcon} size={48} />
                    <p>Cargando técnicos...</p>
                </div>
            </div>
        );
    }

    return (
        <div className={styles.container}>
            <TechnicianDrawer isOpen={isDrawerOpen} onClose={() => setIsDrawerOpen(false)} onSave={handleSave} technician={editingTech} />

            {/* Header Luminoso */}
            <div className={styles.pageHeader}>
                <div className={styles.headerContent}>
                    <div className={styles.titleGroup}>
                        <Users className={styles.usersIcon} size={40} />
                        <div>
                            <h1 className={styles.pageTitle}>Equipo de Técnicos</h1>
                            <p className={styles.pageSubtitle}>{technicians.length} técnicos activos • {allSkills.length} especialidades</p>
                        </div>
                    </div>
                    <button className={styles.createButton} onClick={handleCreate}>
                        <Plus size={20} />
                        Nuevo Técnico
                    </button>
                </div>
            </div>

            {/* Toolbar con Filtros */}
            <div className={styles.toolbar}>
                <div className={styles.searchBox}>
                    <Search size={20} />
                    <input type="text" placeholder="Buscar por nombre o documento..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                </div>

                <div className={styles.filterGroup}>
                    <Filter size={18} />
                    <select value={filterZone} onChange={(e) => setFilterZone(e.target.value)} className={styles.filterSelect}>
                        <option value="">Todas las Zonas</option>
                        {zones.map((z) => <option key={z} value={z}>{z}</option>)}
                    </select>

                    <select value={filterSkill} onChange={(e) => setFilterSkill(e.target.value)} className={styles.filterSelect}>
                        <option value="">Todas las Especialidades</option>
                        {allSkills.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                </div>

                <div className={styles.resultCount}>
                    <Users size={16} />
                    {filteredTechnicians.length} técnico{filteredTechnicians.length !== 1 ? 's' : ''}
                </div>
            </div>

            {/* Grid de Tarjetas Luminosas */}
            <div className={styles.grid}>
                {filteredTechnicians.map((tech: any) => {
                    const firstName = tech.first_name || tech.nombre || '';
                    const lastName = tech.last_name || tech.apellido || '';
                    const fullName = tech.name || `${firstName} ${lastName}`.trim() || 'Técnico sin nombre';
                    const docType = tech.document_type || tech.tipoDoc || 'DNI';
                    const docNumber = tech.document_number || tech.numeroDoc || '---';
                    const phone = tech.phone || tech.celular || tech.yape_number || tech.plin_number || '---';
                    const zone = tech.zone || tech.zona || 'PAN PERÚ';
                    const photo = tech.photo || tech.foto || null;
                    const rating = tech.rating || tech.calificacion || 5;
                    const specialties = tech.specialties || tech.especialidades || [];

                    return (
                        <div key={tech.id} className={styles.techCard}>
                            <div className={styles.cardHeader}>
                                <div className={styles.photoCircle}>
                                    {photo ? (
                                        <img src={photo} alt={fullName} />
                                    ) : (
                                        <Users size={32} />
                                    )}
                                </div>
                            </div>

                            <div className={styles.cardBody}>
                                <h3 className={styles.techName}>{fullName}</h3>
                                <div className={styles.techDoc}>
                                    <span>{docType}: {docNumber}</span>
                                    <span className={styles.techPhone}>📱 {phone}</span>
                                </div>

                                <div className={styles.skillsGrid}>
                                    {specialties.map((skill: string) => {
                                        const Icon = SKILL_ICONS[skill] || Wrench;
                                        return (
                                            <div key={skill} className={styles.skillBadge} style={{ background: `${SKILL_COLORS[skill]}20`, borderColor: SKILL_COLORS[skill] }}>
                                                <Icon size={12} color={SKILL_COLORS[skill]} />
                                                <span style={{ color: SKILL_COLORS[skill] }}>{skill}</span>
                                            </div>
                                        );
                                    })}
                                </div>

                                <div className={styles.zoneBadge}>
                                    📍 {zone}
                                </div>

                                <div className={styles.rating}>
                                    {"⭐".repeat(rating)}
                                </div>
                            </div>

                            <div className={styles.cardActions}>
                                <button onClick={() => handleEdit(tech)} className={styles.editBtn}>
                                    ✏️ Editar
                                </button>
                                <button onClick={(e) => handleDelete(tech.id, e)} className={styles.deleteBtn} title="Eliminar técnico">
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>

            {filteredTechnicians.length === 0 && (
                <div className={styles.emptyState}>
                    <div className={styles.emptyIcon}>👷</div>
                    <p>No se encontraron técnicos</p>
                    <button className={styles.createButton} onClick={handleCreate}>
                        <Plus size={18} />
                        Contratar Primer Técnico
                    </button>
                </div>
            )}
        </div>
    );
}
