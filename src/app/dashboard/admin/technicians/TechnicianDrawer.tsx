"use client";

import { useState, useEffect } from "react";
import {
    X, User, Wrench, CreditCard, ChevronRight, CheckCircle, MapPin, Compass,
    CreditCard as CardIcon, FileText, Landmark, Sun, Mountain, Map, Trees,
    Phone, Building2, Search, ChevronDown, ChevronUp, Globe, Layers
} from "lucide-react";
import styles from "./technicianDrawer.module.css";
import { SERVICE_TYPES } from "@/lib/serviceTypes";
import { ZONES as STANDARDIZED_ZONES, normalizeZone } from "@/lib/zones";
import { techniciansAPI, branchesAPI } from "@/lib/supabase-api";

interface TechnicianDrawerProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (technician: any) => void;
    technician?: any;
}

const STEPS = [
    { id: 1, label: "Perfil & Identidad", icon: User },
    { id: 2, label: "Skills & Microzona", icon: Layers },
    { id: 3, label: "Bóveda Bancaria", icon: CreditCard }
];

const SPECIALTIES = SERVICE_TYPES.map(service => ({
    id: service.nombreCorto,
    label: service.nombreCorto,
    icon: service.icon,
    color: service.color
}));

const ZONE_ICONS: { [key: string]: any } = {
    "LIMA": Landmark,
    "NORTE": Sun,
    "SUR": Mountain,
    "CENTRO": Map,
    "ORIENTE": Trees
};

const ZONES = STANDARDIZED_ZONES.map(z => ({
    id: z.id,
    label: z.label.toUpperCase(),
    icon: ZONE_ICONS[z.id] || MapPin,
    color: z.color,
    emoji: z.icon
}));

const BANKS = [
    { id: "BCP", name: "BCP", logo: "/banks/bcp.png", color: "#FF6600", accent: "#002A8F", gradient: ["#002A8F", "#0047AB"] },
    { id: "Interbank", name: "Interbank", logo: "/banks/interbank.png", color: "#00A859", accent: "#00A859", gradient: ["#00A859", "#008B4E"] },
    { id: "BBVA", name: "BBVA", logo: "/banks/bbva.png", color: "#004481", accent: "#004481", gradient: ["#004481", "#043263"] },
    { id: "Scotiabank", name: "Scotiabank", logo: "/banks/scotiabank.png", color: "#EC1C24", accent: "#EC1C24", gradient: ["#EC1C24", "#C4121A"] }
];

const ACCOUNT_TYPES = [
    { id: "Ahorros", label: "Ahorros", icon: Landmark, color: "#0EA5E9" },
    { id: "Corriente", label: "Corriente", icon: Landmark, color: "#8B5CF6" }
];

export default function TechnicianDrawer({ isOpen, onClose, onSave, technician }: TechnicianDrawerProps) {
    const [currentStep, setCurrentStep] = useState(1);
    const [formData, setFormData] = useState({
        nombre: "",
        apellido: "",
        tipoDoc: "DNI",
        numeroDoc: "",
        celular: "",
        celular2: "",
        email: "",
        direccion: "",
        foto: null as string | null,
        especialidades: [] as string[],
        zonas_asignadas: [] as string[],          // ← NUEVO: array de zonas
        agencias_asignadas: [] as string[], // ← NUEVO: IDs de agencias específicas
        banco: "BCP",
        tipoCuenta: "Ahorros",
        numeroCuenta: "",
        cci: "",
        yape: "",
        plin: ""
    });

    // Branches data for microzonification
    const [allBranches, setAllBranches] = useState<any[]>([]);
    const [loadingBranches, setLoadingBranches] = useState(false);
    const [expandedZones, setExpandedZones] = useState<Record<string, boolean>>({});
    const [branchSearch, setBranchSearch] = useState("");

    // Load all branches for zone selection
    useEffect(() => {
        if (!isOpen) return;
        setLoadingBranches(true);
        branchesAPI.getAll()
            .then(data => setAllBranches(data || []))
            .catch(err => console.error("Error loading branches:", err))
            .finally(() => setLoadingBranches(false));
    }, [isOpen]);

    // Load technician data when editing
    useEffect(() => {
        if (!isOpen) return;

        const load = async () => {
            if (technician) {
                let nombre = technician.first_name || technician.nombre || "";
                let apellido = technician.last_name || technician.apellido || "";

                if (!nombre && !apellido && technician.name) {
                    const parts = technician.name.trim().split(' ');
                    if (parts.length > 1) {
                        nombre = parts[0];
                        apellido = parts.slice(1).join(' ');
                    } else {
                        nombre = parts[0];
                    }
                }

                // Build zones array from the legacy single zone field and new assigned_zones
                const existingZonas: string[] = technician.assigned_zones && technician.assigned_zones.length > 0
                    ? technician.assigned_zones
                    : (technician.zone ? [technician.zone] : []);

                // Load assigned branches
                let assignedBranchIds: string[] = [];
                if (technician.id) {
                    try {
                        const branches = await techniciansAPI.getAssignedBranches(technician.id);
                        assignedBranchIds = branches.map((b: any) => b.id);
                    } catch (err) {
                        console.error("Error loading assigned branches:", err);
                    }
                }

                setFormData({
                    nombre,
                    apellido,
                    tipoDoc: technician.document_type || technician.tipoDoc || "DNI",
                    numeroDoc: technician.document_number || technician.numeroDoc || "",
                    celular: technician.phone || technician.celular || "",
                    celular2: technician.phone_secondary || technician.celular2 || "",
                    email: technician.email || "",
                    direccion: technician.address || technician.direccion || "",
                    foto: technician.photo || technician.foto || null,
                    especialidades: technician.specialties || technician.especialidades || [],
                    zonas_asignadas: existingZonas,
                    agencias_asignadas: assignedBranchIds,
                    banco: technician.bank_name || technician.banco || "BCP",
                    tipoCuenta: technician.account_type || technician.tipoCuenta || "Ahorros",
                    numeroCuenta: technician.account_number || technician.numeroCuenta || "",
                    cci: technician.cci || "",
                    yape: technician.yape_number || technician.yape || "",
                    plin: technician.plin_number || technician.plin || ""
                });
                setCurrentStep(1);
            } else {
                setFormData({
                    nombre: "",
                    apellido: "",
                    tipoDoc: "DNI",
                    numeroDoc: "",
                    celular: "",
                    celular2: "",
                    email: "",
                    direccion: "",
                    foto: null,
                    especialidades: [],
                    zonas_asignadas: [],
                    agencias_asignadas: [],
                    banco: "BCP",
                    tipoCuenta: "Ahorros",
                    numeroCuenta: "",
                    cci: "",
                    yape: "",
                    plin: ""
                });
                setCurrentStep(1);
            }
        };

        load();
    }, [technician, isOpen]);

    if (!isOpen) return null;

    // ── Helpers: Zone & Branch selection ────────────────────────────────────
    
    /**
     * Obtiene el código de zona normalizado para una agencia (formato MiBanco).
     * Verifica el campo 'zone' de la tabla branch_offices primero (Supabase),
     * luego el join de Supabase (b.zonas.codigo), y finalmente b.zona legacy.
     * NO normaliza UUIDs directamente - usa solo valores de texto legibles.
     */
    const getBranchZoneCode = (b: any): string => {
        // 1. Campo 'zone' de la tabla branch_offices (Supabase)
        if (b.zone) {
            return normalizeZone(b.zone);
        }
        // 2. Campo b.zona (formato MiBanco legacy: "Lima", "Norte", etc.)
        if (b.zona) {
            return normalizeZone(b.zona);
        }
        // 3. Join de Supabase: b.zonas.codigo (zona relacionada)
        if (b.zonas?.codigo) {
            return normalizeZone(b.zonas.codigo);
        }
        // 4. Default: LIMA
        return "LIMA";
    };

    const toggleZone = (zoneId: string) => {
        const isSelected = formData.zonas_asignadas.includes(zoneId);
        if (isSelected) {
            // Remove zone and related branch assignments
            const branchesInZone = allBranches
                .filter(b => getBranchZoneCode(b) === normalizeZone(zoneId))
                .map((b: any) => String(b.id));
            setFormData(prev => ({
                ...prev,
                zonas_asignadas: prev.zonas_asignadas.filter((z: string) => z !== zoneId),
                agencias_asignadas: prev.agencias_asignadas.filter(id => !branchesInZone.includes(String(id)))
            }));
        } else {
            setFormData(prev => ({ ...prev, zonas_asignadas: [...prev.zonas_asignadas, zoneId] }));
        }
    };

    const toggleBranch = (branchId: string | number) => {
        const idStr = String(branchId);
        if (formData.agencias_asignadas.some((id: any) => String(id) === idStr)) {
            setFormData(prev => ({
                ...prev,
                agencias_asignadas: prev.agencias_asignadas.filter((id: any) => String(id) !== idStr)
            }));
        } else {
            setFormData(prev => ({
                ...prev,
                agencias_asignadas: [...prev.agencias_asignadas, idStr]
            }));
        }
    };

    const toggleZoneExpand = (zoneId: string) => {
        setExpandedZones(prev => ({ ...prev, [zoneId]: !prev[zoneId] }));
    };

    // Get branches for a zone, with search filter
    const getBranchesForZone = (zoneId: string) => {
        return allBranches.filter(b => {
            const branchZone = getBranchZoneCode(b);
            const matchesZone = branchZone === normalizeZone(zoneId);
            const matchesSearch = !branchSearch ||
                (b.name || '').toLowerCase().includes(branchSearch.toLowerCase()) ||
                (b.codigo_topaz || '').toLowerCase().includes(branchSearch.toLowerCase()) ||
                (b.clients?.name || '').toLowerCase().includes(branchSearch.toLowerCase());
            return matchesZone && matchesSearch;
        });
    };

    const getSelectedBranchesForZone = (zoneId: string) => {
        return allBranches.filter(b =>
            getBranchZoneCode(b) === normalizeZone(zoneId) &&
            formData.agencias_asignadas.some((id: any) => String(id) === String(b.id))
        );
    };

    // ── Navigation ────────────────────────────────────────────────────────
    const handleNext = () => {
        if (currentStep < 3) setCurrentStep(currentStep + 1);
    };

    const handlePrevious = () => {
        if (currentStep > 1) setCurrentStep(currentStep - 1);
    };

    const toggleSpecialty = (specialty: string) => {
        if (formData.especialidades.includes(specialty)) {
            setFormData({ ...formData, especialidades: formData.especialidades.filter(s => s !== specialty) });
        } else {
            setFormData({ ...formData, especialidades: [...formData.especialidades, specialty] });
        }
    };

    // ── Submit ────────────────────────────────────────────────────────────
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (formData.tipoDoc === "DNI" && !/^[0-9]{8}$/.test(formData.numeroDoc)) {
            alert("❌ El DNI debe tener 8 dígitos");
            setCurrentStep(1);
            return;
        }

        if (!/^9[0-9]{8}$/.test(formData.celular)) {
            alert("❌ El celular debe tener 9 dígitos y empezar con 9");
            setCurrentStep(1);
            return;
        }

        if (formData.especialidades.length === 0) {
            alert("❌ Debe seleccionar al menos una especialidad");
            setCurrentStep(2);
            return;
        }

        if (formData.zonas_asignadas.length === 0) {
            alert("❌ Debe seleccionar al menos una zona de operación");
            setCurrentStep(2);
            return;
        }

        // DEBUG: Verificar estado de agencias antes
        const supabaseData = {
            id: crypto.randomUUID(), // Prevenir ID huerfano inyectando UUID directamente
            name: `${formData.nombre} ${formData.apellido}`.trim(),
            nombre: formData.nombre,
            apellido: formData.apellido,
            tipoDoc: formData.tipoDoc,
            numeroDoc: formData.numeroDoc,
            celular: formData.celular,
            celular2: formData.celular2,
            email: formData.email,
            direccion: formData.direccion,
            zonas_asignadas: formData.zonas_asignadas,
            especialidades: formData.especialidades,
            foto: formData.foto,
            calificacion: technician?.rating || technician?.calificacion || 5,
            banco: formData.banco,
            tipoCuenta: formData.tipoCuenta,
            numeroCuenta: formData.numeroCuenta,
            cci: formData.cci,
            yape: formData.yape,
            plin: formData.plin,
            status: 'active',
            _agencias_asignadas: formData.agencias_asignadas.filter(id => {
                // Solo filtrar si allBranches está cargado
                if (allBranches.length === 0) {
                    console.warn('[handleSubmit] allBranches empty - passing through IDs without filter');
                    return true;
                }
                return allBranches.some(b => String(b.id) === String(id));
            })
        };

        console.log('[handleSubmit] DEBUG - supabaseData._agencias_asignadas:', supabaseData._agencias_asignadas);

        onSave(supabaseData);
    };

    // ── Coverage stats ────────────────────────────────────────────────────
    // Use getBranchZoneCode para cálculo correcto de cobertura
    const totalBranchesInSelectedZones = allBranches.filter(b => {
        const branchZone = getBranchZoneCode(b);
        return formData.zonas_asignadas.some(z => normalizeZone(z) === branchZone);
    }).length;

    const totalSelectedBranches = formData.agencias_asignadas.length;
    const hasMixedCoverage = totalSelectedBranches > 0;

    return (
        <div className={styles.overlay}>
            <div className={styles.drawer}>
                {/* Header */}
                <div className={styles.header}>
                    <div>
                        <h2 className={styles.title}>{technician ? "Editar Técnico" : "Contratar Nuevo Técnico"}</h2>
                        <p className={styles.subtitle}>Complete la información en 3 pasos</p>
                    </div>
                    <button onClick={onClose} className={styles.closeBtn}>
                        <X size={24} />
                    </button>
                </div>

                {/* Stepper */}
                <div className={styles.stepper}>
                    {STEPS.map((step, index) => {
                        const Icon = step.icon;
                        const isActive = step.id === currentStep;
                        const isCompleted = step.id < currentStep;

                        return (
                            <div key={step.id} className={styles.stepperItem}>
                                <div className={`${styles.stepCircle} ${isActive ? styles.stepActive : ''} ${isCompleted ? styles.stepCompleted : ''}`}>
                                    {isCompleted ? <CheckCircle size={20} /> : <Icon size={20} />}
                                </div>
                                <span className={`${styles.stepLabel} ${isActive ? styles.stepLabelActive : ''}`}>{step.label}</span>
                                {index < STEPS.length - 1 && <ChevronRight className={styles.stepArrow} size={16} />}
                            </div>
                        );
                    })}
                </div>

                <form onSubmit={handleSubmit} className={styles.form}>

                    {/* ── PASO 1: Perfil & Identidad ─────────────────────────── */}
                    {currentStep === 1 && (
                        <div className={styles.stepContent}>
                            <h3 className={styles.stepTitle}>👤 Perfil & Identidad</h3>

                            <div className={styles.docSelectorIntegrated}>
                                <div
                                    className={`${styles.docCardIntegrated} ${formData.tipoDoc === "DNI" ? styles.docCardActive : ''}`}
                                    onClick={() => setFormData({ ...formData, tipoDoc: "DNI", numeroDoc: "" })}
                                >
                                    <div className={styles.docCardHeader}>
                                        <CardIcon size={20} color={formData.tipoDoc === "DNI" ? "#0EA5E9" : "#94A3B8"} />
                                        <div>
                                            <div className={styles.docCardTitle}>DNI 🇵🇪</div>
                                            <div className={styles.docCardSubtitle}>Documento Peruano</div>
                                        </div>
                                    </div>
                                    {formData.tipoDoc === "DNI" && (
                                        <input
                                            type="text"
                                            value={formData.numeroDoc}
                                            onChange={(e) => {
                                                e.stopPropagation();
                                                const value = e.target.value.replace(/\D/g, '').slice(0, 8);
                                                setFormData({ ...formData, numeroDoc: value });
                                            }}
                                            onClick={(e) => e.stopPropagation()}
                                            placeholder="12345678 (8 dígitos)"
                                            className={styles.docInput}
                                            required
                                        />
                                    )}
                                </div>

                                <div
                                    className={`${styles.docCardIntegrated} ${formData.tipoDoc === "CE" ? styles.docCardActive : ''}`}
                                    onClick={() => setFormData({ ...formData, tipoDoc: "CE", numeroDoc: "" })}
                                >
                                    <div className={styles.docCardHeader}>
                                        <FileText size={20} color={formData.tipoDoc === "CE" ? "#10B981" : "#94A3B8"} />
                                        <div>
                                            <div className={styles.docCardTitle}>C.E. / PTP 🌎</div>
                                            <div className={styles.docCardSubtitle}>Carné Extranjería</div>
                                        </div>
                                    </div>
                                    {formData.tipoDoc === "CE" && (
                                        <input
                                            type="text"
                                            value={formData.numeroDoc}
                                            onChange={(e) => {
                                                e.stopPropagation();
                                                const value = e.target.value.slice(0, 12);
                                                setFormData({ ...formData, numeroDoc: value });
                                            }}
                                            onClick={(e) => e.stopPropagation()}
                                            placeholder="ABC123456789 (hasta 12 car.)"
                                            className={styles.docInput}
                                            required
                                        />
                                    )}
                                </div>
                            </div>

                            <div className={styles.formGrid}>
                                <div className={styles.formGroup}>
                                    <label>📱 Celular Principal *</label>
                                    <input type="tel" value={formData.celular} onChange={(e) => { const value = e.target.value.replace(/\D/g, '').slice(0, 9); setFormData({ ...formData, celular: value }); }} placeholder="987654321" pattern="9[0-9]{8}" maxLength={9} required />
                                </div>

                                <div className={styles.formGroup}>
                                    <label>📞 Celular Secundario</label>
                                    <input type="tel" value={formData.celular2} onChange={(e) => { const value = e.target.value.replace(/\D/g, '').slice(0, 9); setFormData({ ...formData, celular2: value }); }} placeholder="912345678" maxLength={9} />
                                </div>

                                <div className={styles.formGroup}>
                                    <label>👤 Nombres *</label>
                                    <input type="text" value={formData.nombre} onChange={(e) => setFormData({ ...formData, nombre: e.target.value.toUpperCase() })} placeholder="JUAN CARLOS" style={{ textTransform: 'uppercase' }} required />
                                </div>

                                <div className={styles.formGroup}>
                                    <label>👤 Apellidos *</label>
                                    <input type="text" value={formData.apellido} onChange={(e) => setFormData({ ...formData, apellido: e.target.value.toUpperCase() })} placeholder="PÉREZ LÓPEZ" style={{ textTransform: 'uppercase' }} required />
                                </div>

                                <div className={styles.formGroup}>
                                    <label>📧 Email <span className={styles.optionalTag}>opcional</span></label>
                                    <input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value.toLowerCase() })} placeholder="tecnico@sinfimac.com" />
                                </div>

                                <div className={styles.formGroup}>
                                    <label>🏠 Dirección <span className={styles.optionalTag}>opcional</span></label>
                                    <input type="text" value={formData.direccion} onChange={(e) => setFormData({ ...formData, direccion: e.target.value.toUpperCase() })} placeholder="AV. LOS INCAS 234" style={{ textTransform: 'uppercase' }} />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ── PASO 2: Skills & Microzonificación ─────────────────── */}
                    {currentStep === 2 && (
                        <div className={styles.stepContent}>
                            <h3 className={styles.stepTitle}>🗺️ Skills & Microzonificación</h3>

                            {/* Especialidades */}
                            <div className={styles.sectionLabel}>Especialidades Habilitadas *</div>
                            <div className={styles.skillsGridCompact}>
                                {SPECIALTIES.map((spec) => {
                                    const Icon = spec.icon;
                                    const isSelected = formData.especialidades.includes(spec.id);
                                    return (
                                        <div
                                            key={spec.id}
                                            className={`${styles.skillCardCompact} ${isSelected ? styles.skillSelected : ''}`}
                                            onClick={() => toggleSpecialty(spec.id)}
                                            style={{ borderColor: isSelected ? spec.color : 'transparent', background: isSelected ? `${spec.color}15` : 'white' }}
                                        >
                                            <Icon size={16} color={spec.color} />
                                            <span style={{ color: isSelected ? spec.color : '#475569' }}>{spec.label}</span>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* ── Zonas de operación ── */}
                            <div className={styles.sectionLabel} style={{ marginTop: '1.25rem' }}>
                                🌍 Zonas de Operación *
                                <span className={styles.sectionBadge}>
                                    {formData.zonas_asignadas.length} zona{formData.zonas_asignadas.length !== 1 ? 's' : ''} seleccionada{formData.zonas_asignadas.length !== 1 ? 's' : ''}
                                </span>
                            </div>
                            <div className={styles.zoneGrid}>
                                {ZONES.map((zone) => {
                                    const isSelected = formData.zonas_asignadas.includes(zone.id);
                                    const Icon = zone.icon;
                                    const selectedBranchCount = getSelectedBranchesForZone(zone.id).length;
                                    const totalBranchCount = getBranchesForZone(zone.id).length;

                                    return (
                                        <div
                                            key={zone.id}
                                            className={`${styles.zoneCard} ${isSelected ? styles.zoneSelected : ''}`}
                                            onClick={() => toggleZone(zone.id)}
                                            style={{
                                                borderColor: isSelected ? zone.color : 'transparent',
                                                background: isSelected ? `${zone.color}10` : 'white',
                                                boxShadow: isSelected ? `0 8px 20px ${zone.color}20` : '0 2px 8px rgba(0,0,0,0.05)'
                                            }}
                                        >
                                            <div className={styles.zoneIconWrapper} style={{ color: isSelected ? zone.color : '#94A3B8' }}>
                                                <Icon size={24} />
                                                <span className={styles.zoneEmojiOverlay}>{zone.emoji}</span>
                                            </div>
                                            <span className={styles.zoneLabel} style={{ color: isSelected ? zone.color : '#475569' }}>{zone.label}</span>
                                            {isSelected && (
                                                <span className={styles.zoneBranchCount} style={{ color: zone.color }}>
                                                    {selectedBranchCount > 0
                                                        ? `${selectedBranchCount} ag. específicas`
                                                        : `${totalBranchCount} ag. (todas)`
                                                    }
                                                </span>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>

                            {/* ── Agencias específicas (microzonificación) ── */}
                            {formData.zonas_asignadas.length > 0 && (
                                <div className={styles.microzonSection}>
                                    <div className={styles.microzonHeader}>
                                        <Building2 size={18} color="#8B5CF6" />
                                        <div>
                                            <div className={styles.microzonTitle}>Microzonificación de Agencias</div>
                                            <div className={styles.microzonSubtitle}>
                                                Si no seleccionas agencias específicas, el técnico cubrirá <strong>todas las agencias</strong> de sus zonas.
                                                Selecciona agencias para restringir su cobertura.
                                            </div>
                                        </div>
                                    </div>

                                    {/* Coverage summary */}
                                    <div className={styles.coverageSummary}>
                                        <div className={styles.coverageStat}>
                                            <Globe size={16} color="#10B981" />
                                            <span>
                                                {hasMixedCoverage
                                                    ? `${totalSelectedBranches} agencias específicas asignadas`
                                                    : `Cobertura total: ~${totalBranchesInSelectedZones} agencias en ${formData.zonas_asignadas.length} zona${formData.zonas_asignadas.length !== 1 ? 's' : ''}`
                                                }
                                            </span>
                                        </div>
                                        {hasMixedCoverage && (
                                            <button
                                                type="button"
                                                className={styles.clearBranchesBtn}
                                                onClick={() => setFormData(prev => ({ ...prev, agencias_asignadas: [] }))}
                                            >
                                                ✕ Limpiar selección (cobertura total)
                                            </button>
                                        )}
                                    </div>

                                    {/* Search */}
                                    <div className={styles.branchSearchBox}>
                                        <Search size={16} />
                                        <input
                                            type="text"
                                            placeholder="Buscar agencia por nombre o código..."
                                            value={branchSearch}
                                            onChange={(e) => setBranchSearch(e.target.value)}
                                        />
                                    </div>

                                    {/* Zones with branches */}
                                    {loadingBranches ? (
                                        <div className={styles.loadingBranches}>Cargando agencias...</div>
                                    ) : (
                                        <div className={styles.zoneAccordionList}>
                                            {formData.zonas_asignadas.map(zoneId => {
                                                const zoneInfo = ZONES.find(z => z.id === zoneId);
                                                const zoneBranches = getBranchesForZone(zoneId);
                                                const selectedInZone = getSelectedBranchesForZone(zoneId);
                                                const isExpanded = expandedZones[zoneId] ?? true;

                                                if (zoneBranches.length === 0 && !branchSearch) return null;

                                                return (
                                                    <div
                                                        key={zoneId}
                                                        className={styles.zoneAccordion}
                                                        style={{ borderColor: `${zoneInfo?.color}40` }}
                                                    >
                                                        <button
                                                            type="button"
                                                            className={styles.zoneAccordionHeader}
                                                            onClick={() => toggleZoneExpand(zoneId)}
                                                            style={{ background: `${zoneInfo?.color}08` }}
                                                        >
                                                            <div className={styles.zoneAccordionLeft}>
                                                                <span style={{ color: zoneInfo?.color }}>{zoneInfo?.emoji}</span>
                                                                <span className={styles.zoneAccordionName} style={{ color: zoneInfo?.color }}>
                                                                    {zoneInfo?.label}
                                                                </span>
                                                                <span className={styles.zoneAccordionCount}>
                                                                    {selectedInZone.length > 0
                                                                        ? `${selectedInZone.length}/${zoneBranches.length} seleccionadas`
                                                                        : `${zoneBranches.length} agencias disponibles`
                                                                    }
                                                                </span>
                                                            </div>
                                                            {selectedInZone.length > 0 && (
                                                                <span className={styles.zoneHasSelection} style={{ background: zoneInfo?.color }}>
                                                                    {selectedInZone.length} ✓
                                                                </span>
                                                            )}
                                                            {isExpanded ? <ChevronUp size={16} color="#94A3B8" /> : <ChevronDown size={16} color="#94A3B8" />}
                                                        </button>

                                                        {isExpanded && (
                                                            <div className={styles.branchesGrid}>
                                                                {/* Select all / Deselect all */}
                                                                <div className={styles.branchBulkActions}>
                                                                    <button
                                                                        type="button"
                                                                        className={styles.bulkBtn}
                                                                        onClick={() => {
                                                                            const branchIds = zoneBranches.map((b: any) => String(b.id));
                                                                            const allSelected = branchIds.every((id: string) => formData.agencias_asignadas.some((aId: any) => String(aId) === id));
                                                                            if (allSelected) {
                                                                                setFormData(prev => ({
                                                                                    ...prev,
                                                                                    agencias_asignadas: prev.agencias_asignadas.filter(id => !branchIds.includes(String(id)))
                                                                                }));
                                                                            } else {
                                                                                setFormData(prev => ({
                                                                                    ...prev,
                                                                                    agencias_asignadas: [...new Set([...prev.agencias_asignadas.map(String), ...branchIds])]
                                                                                }));
                                                                            }
                                                                        }}
                                                                        style={{ color: zoneInfo?.color, borderColor: `${zoneInfo?.color}40` }}
                                                                    >
                                                                        {zoneBranches.every((b: any) => formData.agencias_asignadas.some((id: any) => String(id) === String(b.id)))
                                                                            ? '☑ Deseleccionar todas'
                                                                            : '☐ Seleccionar todas'
                                                                        }
                                                                    </button>
                                                                </div>

                                                                {zoneBranches.length === 0 && branchSearch && (
                                                                    <p className={styles.noBranchesMsg}>No hay agencias que coincidan con la búsqueda.</p>
                                                                )}

                                                                {zoneBranches.map((branch: any) => {
                                                                    const isSelected = formData.agencias_asignadas.some((id: any) => String(id) === String(branch.id));
                                                                    return (
                                                                        <div
                                                                            key={branch.id}
                                                                            className={`${styles.branchItem} ${isSelected ? styles.branchSelected : ''}`}
                                                                            onClick={() => toggleBranch(branch.id)}
                                                                            style={isSelected ? {
                                                                                borderColor: zoneInfo?.color,
                                                                                background: `${zoneInfo?.color}10`
                                                                            } : {}}
                                                                        >
                                                                            <div className={`${styles.branchCheckbox} ${isSelected ? styles.branchCheckboxChecked : ''}`}
                                                                                style={isSelected ? { background: zoneInfo?.color, borderColor: zoneInfo?.color } : {}}>
                                                                                {isSelected && <CheckCircle size={12} color="white" />}
                                                                            </div>
                                                                            <div className={styles.branchInfo}>
                                                                                <span className={styles.branchName}>
                                                                                    {branch.name}
                                                                                    {branch.tipo && <span className={styles.branchType}>{branch.tipo}</span>}
                                                                                </span>
                                                                                <span className={styles.branchMeta}>
                                                                                    {branch.codigo_topaz && <span>#{branch.codigo_topaz}</span>}
                                                                                    {branch.distrito && <span> · {branch.distrito}</span>}
                                                                                    {branch.departamento && branch.departamento !== branch.distrito && (
                                                                                        <span> · {branch.departamento}</span>
                                                                                    )}
                                                                                </span>
                                                                            </div>
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {/* ── PASO 3: Bóveda Bancaria ─────────────────────────────── */}
                    {currentStep === 3 && (
                        <div className={styles.stepContent}>
                            <h3 className={styles.stepTitle}>💳 Bóveda Bancaria</h3>

                            <div className={styles.bankPreviewRow}>
                                {(() => {
                                    const selectedBank = BANKS.find(b => b.id === formData.banco) || BANKS[0];
                                    return (
                                        <>
                                            <div
                                                className={styles.compactBankCard}
                                                style={{ background: `linear-gradient(135deg, ${selectedBank.gradient[0]}, ${selectedBank.gradient[1]})` }}
                                            >
                                                <div className={styles.bankCardHeader}>
                                                    <div className={styles.vaultTitle}>
                                                        <Landmark size={12} />
                                                        <span>VAULT</span>
                                                    </div>
                                                    <div className={styles.bankLogoBrandWrapper}>
                                                        <div className={styles.bankLogoBadgePremium}>
                                                            <img src={selectedBank.logo} alt={selectedBank.name} />
                                                        </div>
                                                        <div className={styles.bankDetailColumn}>
                                                            <div className={styles.detailItemMini}>
                                                                <MapPin size={12} />
                                                                <span>{formData.zonas_asignadas.join(', ') || 'Sin zona'}</span>
                                                            </div>
                                                            <div className={styles.detailItemMini}>
                                                                <Phone size={12} />
                                                                <span>{formData.celular}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className={styles.bankChip}></div>
                                                <div className={styles.cardFooterCompact}>
                                                    <span className={styles.accountTypeLabelCompact}>{formData.tipoCuenta.toUpperCase()}</span>
                                                </div>
                                            </div>

                                            <div className={styles.cardInputsColumn}>
                                                <div className={styles.formGroupCompact}>
                                                    <label className={styles.microLabel}>NÚMERO DE CUENTA</label>
                                                    <div className={styles.cardInputWrapperShadow}>
                                                        <input
                                                            className={styles.cardPremiumInput}
                                                            type="text"
                                                            value={formData.numeroCuenta}
                                                            onChange={(e) => setFormData({ ...formData, numeroCuenta: e.target.value })}
                                                            placeholder="•••• •••• •••• ••••"
                                                        />
                                                    </div>
                                                </div>
                                                <div className={styles.formGroupCompact}>
                                                    <label className={styles.microLabel}>CCI INTERBANCARIO</label>
                                                    <div className={styles.cardInputWrapperShadow}>
                                                        <input
                                                            className={styles.cardPremiumInput}
                                                            type="text"
                                                            value={formData.cci}
                                                            onChange={(e) => setFormData({ ...formData, cci: e.target.value })}
                                                            placeholder="•••• •••• •••• •••• ••••"
                                                            maxLength={20}
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        </>
                                    );
                                })()}

                                <div className={styles.sideBankSelector}>
                                    <div className={styles.bankSelectorGridCompact}>
                                        {BANKS.map(bank => (
                                            <div
                                                key={bank.id}
                                                className={`${styles.bankOptionMini} ${formData.banco === bank.id ? styles.bankSelectedMini : ''}`}
                                                onClick={() => setFormData({ ...formData, banco: bank.id })}
                                                style={{ '--bank-color': bank.color, '--bank-accent': bank.accent } as any}
                                                title={bank.name}
                                            >
                                                {formData.banco === bank.id && (
                                                    <div className={styles.miniActiveIndicator}>
                                                        <CheckCircle size={10} />
                                                    </div>
                                                )}
                                                <img src={bank.logo} alt={bank.name} className={styles.bankImageMini} />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <div className={styles.bovedaGridOptimized}>
                                <div className={styles.formGroup}>
                                    <label>Tipo de Cuenta *</label>
                                    <div className={styles.accountTypeSelector}>
                                        {ACCOUNT_TYPES.map(type => (
                                            <div
                                                key={type.id}
                                                className={`${styles.accountTypeCard} ${formData.tipoCuenta === type.id ? styles.accountTypeActive : ''}`}
                                                onClick={() => setFormData({ ...formData, tipoCuenta: type.id })}
                                                style={{ '--type-color': type.color } as any}
                                            >
                                                <type.icon size={16} />
                                                <span>{type.label}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div className={styles.walletsSection}>
                                    <div className={styles.walletsSectionHeader}>
                                        <span className={styles.sectionLabelMini}>Billeteras Digitales</span>
                                        {formData.celular && (
                                            <span className={styles.celularHint}>📱 {formData.celular}</span>
                                        )}
                                    </div>
                                    <div className={styles.walletsRow}>
                                        {/* YAPE */}
                                        <div className={`${styles.walletMiniCard} ${formData.yape ? styles.yapeActive : ''}`}>
                                            <div className={styles.walletCardTop}>
                                                <div className={styles.walletBrand} style={{ background: '#7C3AED' }}>Y</div>
                                                <span className={styles.walletName}>Yape</span>
                                                {formData.celular && formData.yape !== formData.celular && (
                                                    <button
                                                        type="button"
                                                        className={styles.usarCelularBtn}
                                                        onClick={() => setFormData({ ...formData, yape: formData.celular })}
                                                        title={`Usar ${formData.celular}`}
                                                    >
                                                        📋 Usar celular
                                                    </button>
                                                )}
                                                {formData.yape && formData.yape === formData.celular && (
                                                    <span className={styles.matchBadge}>✓ Igual al cel.</span>
                                                )}
                                            </div>
                                            <input
                                                type="tel"
                                                value={formData.yape}
                                                onChange={(e) => setFormData({ ...formData, yape: e.target.value.replace(/\D/g, '').slice(0, 9) })}
                                                placeholder="N° de Yape"
                                                maxLength={9}
                                            />
                                        </div>
                                        {/* PLIN */}
                                        <div className={`${styles.walletMiniCard} ${formData.plin ? styles.plinActive : ''}`}>
                                            <div className={styles.walletCardTop}>
                                                <div className={styles.walletBrand} style={{ background: '#00AACC' }}>P</div>
                                                <span className={styles.walletName}>Plin</span>
                                                {formData.celular && formData.plin !== formData.celular && (
                                                    <button
                                                        type="button"
                                                        className={styles.usarCelularBtn}
                                                        onClick={() => setFormData({ ...formData, plin: formData.celular })}
                                                        title={`Usar ${formData.celular}`}
                                                    >
                                                        📋 Usar celular
                                                    </button>
                                                )}
                                                {formData.plin && formData.plin === formData.celular && (
                                                    <span className={styles.matchBadge}>✓ Igual al cel.</span>
                                                )}
                                            </div>
                                            <input
                                                type="tel"
                                                value={formData.plin}
                                                onChange={(e) => setFormData({ ...formData, plin: e.target.value.replace(/\D/g, '').slice(0, 9) })}
                                                placeholder="N° de Plin"
                                                maxLength={9}
                                            />
                                        </div>
                                    </div>
                                    {formData.celular && (
                                        <button
                                            type="button"
                                            className={styles.usarCelularBtnAll}
                                            onClick={() => setFormData({ ...formData, yape: formData.celular, plin: formData.celular })}
                                        >
                                            ⚡ Usar mismo número para Yape y Plin ({formData.celular})
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    <div className={styles.footer}>
                        {currentStep > 1 && (
                            <button type="button" onClick={(e) => { e.preventDefault(); handlePrevious(); }} className={styles.prevBtn}>
                                Anterior
                            </button>
                        )}
                        {currentStep < 3 ? (
                            <button type="button" onClick={(e) => { e.preventDefault(); handleNext(); }} className={styles.nextBtn}>
                                Siguiente
                            </button>
                        ) : (
                            <button type="submit" className={styles.submitBtn}>
                                🚀 {technician ? "Actualizar" : "Contratar y Guardar"}
                            </button>
                        )}
                    </div>
                </form>
            </div>
        </div>
    );
}
