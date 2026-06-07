"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Search, Users, Sparkles, Filter, Trash2, Wrench, MapPin, Building2, Globe } from "lucide-react";
import styles from "./technicians.module.css";
import TechnicianDrawer from "./TechnicianDrawer";
import { useAppData } from "@/lib/AppDataContext";
import { SKILL_ICONS, SKILL_COLORS, SERVICE_TYPES } from "@/lib/serviceTypes";
import { ZONES } from "@/lib/zones";
import { techniciansAPI } from "@/lib/supabase-api";
import { syncQueue, startBackgroundSync, stopBackgroundSync, getTechStatusBadge, type PendingTech } from "@/lib/sync-queue";

export default function TechniciansPage() {
    const { technicians, loadingTechnicians: loading, createTechnician, updateTechnician, deleteTechnician, refreshTechnicians } = useAppData();
    const [searchTerm, setSearchTerm] = useState("");
    const [filterZone, setFilterZone] = useState("");
    const [filterSkill, setFilterSkill] = useState("");
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);
    const [editingTech, setEditingTech] = useState<any>(null);
    const [pendingOps, setPendingOps] = useState<PendingTech[]>([]);

    const allSkills = SERVICE_TYPES.map(s => s.nombreCorto);

    // ── OFFLINE-FIRST: Sync en background ──
    useEffect(() => {
        const pending = syncQueue.getPending();
        setPendingOps(pending);
        
        // Iniciar sync en background
        startBackgroundSync(
            async (op) => {
                try {
                    if (op.action === 'create') {
                        await createTechnician(op.data);
                    } else if (op.action === 'update') {
                        await updateTechnician(op.id, op.data);
                    }
                    // Refrescar datos después de sync
                    refreshTechnicians();
                    return true;
                } catch (error) {
                    console.error('[Sync] Error:', error);
                    return false;
                }
            },
            (op, error) => {
                alert(`⚠️ Error de sincronización: ${error}. Por favor verifica los datos y reintenta.`);
            }
        );
        
        return () => stopBackgroundSync();
    }, [createTechnician, updateTechnician, refreshTechnicians]);

    const filteredTechnicians = technicians.filter((tech: any) => {
        const firstName = tech.first_name || tech.nombre || '';
        const lastName = tech.last_name || tech.apellido || '';
        const fullName = (tech.name || `${firstName} ${lastName}`.trim() || '').toLowerCase();
        const docNumber = tech.document_number || tech.numeroDoc || '';

        const matchesSearch =
            fullName.includes(searchTerm.toLowerCase()) ||
            docNumber.includes(searchTerm);

        // Support multi-zone lookup
        const techZones: string[] = tech.assigned_zones?.length
            ? tech.assigned_zones
            : (tech.zone ? [tech.zone] : []);

        const matchesZone = !filterZone || techZones.includes(filterZone);
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
            // Extract branch assignments from the hidden field
            const agenciasAsignadas: string[] = techData._agenciasAsignadas || [];
            const { _agenciasAsignadas, ...cleanData } = techData;

            console.log('[handleSave] Saving technician, agenciasAsignadas:', agenciasAsignadas);

            if (editingTech) {
                // Modo edición - siempre actualizar datos del técnico
                try {
                    const updated = await updateTechnician(editingTech.id, cleanData);
                    console.log('[handleSave] Technician updated, syncing branches...');
                } catch (updateError) {
                    console.error('[handleSave] Error updating technician:', updateError);
                    // Continuar con sync de branches aunque falle update básico
                }
                
                // SIEMPRE intentar sync de branches (importante para microzonificación)
                try {
                    await techniciansAPI.syncBranchAssignments(editingTech.id, agenciasAsignadas);
                    console.log('[handleSave] Branch assignments synced successfully');
                } catch (branchError) {
                    console.error('[handleSave] Error syncing branch assignments:', branchError);
                    alert("⚠️ Error al guardar la microzonificación. Las agencias seleccionadas pueden no haberse guardado.");
                }
            } else {
                // Modo creación - validación local
                const docExists = technicians.some((t: any) =>
                    (t.document_number || t.numeroDoc) === (cleanData.document_number || cleanData.numeroDoc)
                );
                if (docExists) {
                    alert(`❌ El documento ${cleanData.document_number || cleanData.numeroDoc} ya está registrado`);
                    return;
                }
                
                // AGREGAR A COLA FIRST (Offline-First)
                const queueId = syncQueue.add({ action: 'create', data: cleanData });
                
                // Intentar sync inmediato
                try {
                    const newTech = await createTechnician(cleanData);
                    syncQueue.remove(queueId); // Éxito - remover de cola
                    console.log('[handleSave] Technician created:', newTech?.id);
                    
                    if (newTech?.id && agenciasAsignadas.length > 0) {
                        await techniciansAPI.syncBranchAssignments(newTech.id, agenciasAsignadas);
                        console.log('[handleSave] Branch assignments synced for new technician');
                    }
                } catch (netError) {
                    console.log('[handleSave] Saved to offline queue, will sync later');
                    // Mantener en cola para sync automático
                }
                
                // Refrescar UI inmediatamente
                refreshTechnicians();
            }
            
            setIsDrawerOpen(false);
            setEditingTech(null);
        } catch (error) {
            console.error('Error saving technician:', error);
            alert("❌ Error al guardar. Los datos se han guardado en cola para sincronizar cuando haya conexión.");
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

            {/* Header */}
            <div className={styles.pageHeader}>
                <div className={styles.headerContent}>
                    <div className={styles.titleGroup}>
                        <Users className={styles.usersIcon} size={40} />
                        <div>
                            <h1 className={styles.pageTitle}>Equipo de Técnicos</h1>
                            <p className={styles.pageSubtitle}>{technicians.length} técnicos activos • Microzonificación activa</p>
                        </div>
                    </div>
                    <button className={styles.createButton} onClick={handleCreate}>
                        <Plus size={20} />
                        Nuevo Técnico
                    </button>
                </div>
            </div>

            {/* Toolbar */}
            <div className={styles.toolbar}>
                <div className={styles.searchBox}>
                    <Search size={20} />
                    <input type="text" placeholder="Buscar por nombre o documento..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                </div>

                <div className={styles.filterGroup}>
                    <Filter size={18} />
                    <select value={filterZone} onChange={(e) => setFilterZone(e.target.value)} className={styles.filterSelect}>
                        <option value="">Todas las Zonas</option>
                        {ZONES.map((z) => (
                            <option key={z.id} value={z.id}>{z.icon} {z.label}</option>
                        ))}
                    </select>

                    <select value={filterSkill} onChange={(e) => setFilterSkill(e.target.value)} className={styles.filterSelect}>
                        <option value="">Todas las Especialidades</option>
                        {allSkills.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                </div>

                <div className={styles.resultCount}>
                    <Users size={16} />
                    {filteredTechnicians.length} técnico{filteredTechnicians.length !== 1 ? 's' : ''}
                    {pendingOps.length > 0 && (
                        <span style={{ marginLeft: '0.5rem', color: '#F59E0B', fontWeight: 600, fontSize: '0.85rem' }}>
                            🔄 {pendingOps.length} sincronizando
                        </span>
                    )}
                </div>
            </div>

            {/* Grid */}
            <div className={styles.grid}>
                {filteredTechnicians.map((tech: any) => {
                    const firstName = tech.first_name || tech.nombre || '';
                    const lastName = tech.last_name || tech.apellido || '';
                    const fullName = tech.name || `${firstName} ${lastName}`.trim() || 'Técnico sin nombre';
                    const docType = tech.document_type || tech.tipoDoc || 'DNI';
                    const docNumber = tech.document_number || tech.numeroDoc || '---';
                    const phone = tech.phone || tech.celular || tech.yape_number || tech.plin_number || '---';
                    const photo = tech.photo || tech.foto || null;
                    const rating = tech.rating || tech.calificacion || 5;
                    const specialties = tech.specialties || tech.especialidades || [];

                    // Multi-zone support
                    const techZones: string[] = tech.assigned_zones?.length
                        ? tech.assigned_zones
                        : (tech.zone ? [tech.zone] : ['PAN PERÚ']);

                    const zoneObjects = techZones.map(zId =>
                        ZONES.find(z => z.id === zId)
                    ).filter(Boolean);

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
                                    {specialties.slice(0, 4).map((skill: string) => {
                                        const Icon = SKILL_ICONS[skill] || Wrench;
                                        return (
                                            <div key={skill} className={styles.skillBadge} style={{ background: `${SKILL_COLORS[skill]}20`, borderColor: SKILL_COLORS[skill] }}>
                                                <Icon size={12} color={SKILL_COLORS[skill]} />
                                                <span style={{ color: SKILL_COLORS[skill] }}>{skill}</span>
                                            </div>
                                        );
                                    })}
                                    {specialties.length > 4 && (
                                        <div className={styles.skillBadge} style={{ background: '#F1F5F920', borderColor: '#94A3B8' }}>
                                            <span style={{ color: '#64748B' }}>+{specialties.length - 4} más</span>
                                        </div>
                                    )}
                                </div>

                                {/* Multi-zone badges */}
                                <div className={styles.zonesRow}>
                                    {zoneObjects.map((z: any) => (
                                        <span
                                            key={z.id}
                                            className={styles.zonePill}
                                            style={{ background: `${z.color}18`, color: z.color, borderColor: `${z.color}40` }}
                                        >
                                            {z.icon} {z.label}
                                        </span>
                                    ))}
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
