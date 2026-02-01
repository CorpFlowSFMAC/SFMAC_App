"use client";

import { useState } from "react";
import { Plus, Search, Users, Sparkles, Filter, Trash2, Wrench } from "lucide-react";
import { useRouter } from "next/navigation";
import styles from "./technicians.module.css";
import TechnicianDrawer from "./TechnicianDrawer";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { SKILL_ICONS, SKILL_COLORS, SERVICE_TYPES } from "@/lib/serviceTypes";


// Mock Data inicial
const INITIAL_TECHNICIANS = [
    {
        id: 1,
        nombre: "JUAN CARLOS",
        apellido: "PÉREZ LÓPEZ",
        tipoDoc: "DNI",
        numeroDoc: "12345678",
        celular: "987654321",
        email: "juan.perez@sinfimac.com",
        direccion: "AV. LOS INCAS 234, SAN JUAN DE LURIGANCHO",
        foto: null,
        especialidades: ["ELECTRICIDAD", "GASFITERÍA"],
        zona: "LIMA",
        banco: "BCP",
        tipoCuenta: "Ahorros",
        numeroCuenta: "191-12345678-0-12",
        cci: "00219100123456780112",
        yape: "987654321",
        estado: "Activo",
        calificacion: 5
    },
    {
        id: 2,
        nombre: "MARÍA FERNANDA",
        apellido: "GARCÍA TORRES",
        tipoDoc: "DNI",
        numeroDoc: "87654321",
        celular: "998765432",
        email: "maria.garcia@sinfimac.com",
        direccion: "JR. HUANCAYO 567, LA VICTORIA",
        foto: null,
        especialidades: ["PINTURA", "VIDRIO"],
        zona: "SUR",
        banco: "Interbank",
        tipoCuenta: "Corriente",
        numeroCuenta: "200-98765432-1-00",
        cci: "",
        yape: "998765432",
        estado: "Activo",
        calificacion: 5
    },
    {
        id: 3,
        nombre: "CARLOS ALBERTO",
        apellido: "MENDOZA SALAS",
        tipoDoc: "DNI",
        numeroDoc: "23456789",
        celular: "912345678",
        email: "carlos.mendoza@sinfimac.com",
        direccion: "AV. JORGE CHÁVEZ 890, MIRAFLORES",
        foto: null,
        especialidades: ["SOLDADURA", "CARPINTERÍA"],
        zona: "LIMA",
        banco: "BBVA",
        tipoCuenta: "Ahorros",
        numeroCuenta: "001-23456789-0-01",
        cci: "01100123456789001",
        yape: "912345678",
        estado: "Activo",
        calificacion: 5
    },
    {
        id: 4,
        nombre: "ANA LUCÍA",
        apellido: "RAMÍREZ CRUZ",
        tipoDoc: "DNI",
        numeroDoc: "34567890",
        celular: "923456789",
        email: "ana.ramirez@sinfimac.com",
        direccion: "JR. LIBERTAD 123, CALLAO",
        foto: null,
        especialidades: ["VISITA TÉCNICA", "REFRIGERACIÓN"],
        zona: "CENTRO",
        banco: "Scotiabank",
        tipoCuenta: "Ahorros",
        numeroCuenta: "300-34567890-0-12",
        cci: "",
        yape: "923456789",
        estado: "Activo",
        calificacion: 5
    }
];

export default function TechniciansPage() {
    const router = useRouter();
    const [technicians, setTechnicians, isLoaded] = useLocalStorage("technicians", INITIAL_TECHNICIANS);
    const [searchTerm, setSearchTerm] = useState("");
    const [filterZone, setFilterZone] = useState("");
    const [filterSkill, setFilterSkill] = useState("");
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);
    const [editingTech, setEditingTech] = useState<any>(null);

    const zones = Array.from(new Set(technicians.map((t: any) => t.zona)));
    // ✅ Usar especialidades desde SERVICE_TYPES en vez de las del array
    const allSkills = SERVICE_TYPES.map(s => s.nombreCorto);

    const filteredTechnicians = technicians.filter((tech: any) => {
        const matchesSearch =
            tech.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
            tech.apellido.toLowerCase().includes(searchTerm.toLowerCase()) ||
            tech.numeroDoc.includes(searchTerm);
        const matchesZone = !filterZone || tech.zona === filterZone;
        const matchesSkill = !filterSkill || tech.especialidades.includes(filterSkill);
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

    const handleSave = (techData: any) => {
        if (editingTech) {
            setTechnicians(technicians.map((t: any) => (t.id === editingTech.id ? { ...techData, id: editingTech.id, calificacion: editingTech.calificacion } : t)));
        } else {
            // Validar DNI duplicado
            const docExists = technicians.some((t: any) => t.numeroDoc === techData.numeroDoc);
            if (docExists) {
                alert(`❌ El documento ${techData.numeroDoc} ya está registrado`);
                return;
            }
            setTechnicians([...technicians, { ...techData, id: Date.now(), calificacion: 5 }]);
        }
        setIsDrawerOpen(false);
    };

    const handleDelete = (id: number, e: React.MouseEvent) => {
        e.stopPropagation();

        const tech = technicians.find((t: any) => t.id === id);
        if (!tech) return;

        if (confirm(`¿Está seguro de eliminar al técnico "${tech.nombre} ${tech.apellido}"?\n\nEsta acción no se puede deshacer.`)) {
            setTechnicians(technicians.filter((t: any) => t.id !== id));
        }
    };

    if (!isLoaded) {
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
                {filteredTechnicians.map((tech: any) => (
                    <div key={tech.id} className={styles.techCard}>
                        <div className={styles.cardHeader}>
                            <div className={styles.photoCircle}>
                                {tech.foto ? (
                                    <img src={tech.foto} alt={tech.nombre} />
                                ) : (
                                    <Users size={32} />
                                )}
                            </div>
                        </div>

                        <div className={styles.cardBody}>
                            <h3 className={styles.techName}>{tech.nombre} {tech.apellido}</h3>
                            <div className={styles.techDoc}>
                                <span>{tech.tipoDoc}: {tech.numeroDoc}</span>
                                <span className={styles.techPhone}>📱 {tech.celular}</span>
                            </div>

                            <div className={styles.skillsGrid}>
                                {tech.especialidades.map((skill: string) => {
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
                                📍 {tech.zona}
                            </div>

                            <div className={styles.rating}>
                                {"⭐".repeat(tech.calificacion)}
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
                ))}
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
