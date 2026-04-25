"use client";

import { useState, useEffect } from "react";
import {
    X, ChevronLeft, ChevronRight, Check, Search, MapPin, Building2,
    Upload, Image as ImageIcon, FileText, Trash2, CheckCircle, Wrench, Users, Monitor, Sparkles,
    ShieldCheck, UserCheck, RefreshCw
} from "lucide-react";
import styles from "./CreateTicketWizard.module.css";
import { SERVICE_TYPES } from "@/lib/serviceTypes";
import { useAppData } from "@/lib/AppDataContext";
import { useBranches } from "@/hooks/useSupabaseData";
import { gestorasAPI } from "@/lib/routing-api";

interface CreateTicketWizardProps {
    onClose: () => void;
    onCreateTicket: (ticket: any) => void;
    // Assignment policy context
    creatorRole?: 'ADMIN' | 'GESTORA' | string;
    creatorGestoraId?: string | null;
    creatorGestoraNombre?: string | null;
}

export default function CreateTicketWizard({ onClose, onCreateTicket, creatorRole, creatorGestoraId, creatorGestoraNombre }: CreateTicketWizardProps) {
    // Policy: ADMIN starts at step 0 (gestor selection), GESTORA starts at step 1
    const isAdmin = creatorRole === 'ADMIN' || creatorRole === 'SUPERADMIN';
    const startStep = isAdmin ? 0 : 1;
    const [currentStep, setCurrentStep] = useState(startStep);
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    // Gestor selection state (step 0 - Admin only)
    const [availableGestores, setAvailableGestores] = useState<any[]>([]);
    const [loadingGestores, setLoadingGestores] = useState(false);
    const [gestorSearch, setGestorSearch] = useState("");
    const [selectedGestor, setSelectedGestor] = useState<any | null>(null);

    const [formData, setFormData] = useState({
        cliente: null as any,
        clienteId: "",
        sede: null as any,
        sedeId: "",
        tipoServicio: "",
        tipoServicioNombre: "",
        descripcionProblema: "",
        tieneNumeroCliente: false,
        numeroTicketCliente: "",
        evidencias: [] as File[],
        creadoPor: typeof window !== 'undefined' ? (localStorage.getItem("userRole") === 'admin' ? "Administrador" : "Gestor(a) Operativo(a)") : "Sistema",
        fechaCreacion: new Date().toISOString(),
    });

    // Load gestores for Admin step 0
    useEffect(() => {
        if (!isAdmin) return;
        setLoadingGestores(true);
        gestorasAPI.getAll()
            .then(data => setAvailableGestores(data || []))
            .catch(err => console.error("Error loading gestores:", err))
            .finally(() => setLoadingGestores(false));
    }, [isAdmin]);

    // Auto-assign if Gestora role (Regla 1)
    useEffect(() => {
        if (!isAdmin && creatorGestoraId) {
            setSelectedGestor({ id: creatorGestoraId, name: creatorGestoraNombre || 'Mi cuenta' });
        }
    }, [isAdmin, creatorGestoraId, creatorGestoraNombre]);

    const filteredGestores = availableGestores.filter(g =>
        (g.name || "").toLowerCase().includes(gestorSearch.toLowerCase()) ||
        (g.email || "").toLowerCase().includes(gestorSearch.toLowerCase())
    );

    // 📙 INTEGRACIÓN CON CONTEXTO GLOBAL (Realtime compartido)
    const { clients: rawClients, loadingClients, tickets: allExistingTickets } = useAppData();
    
    // ⚡️ OPTIMIZACIÓN: Solo cargar sedes del cliente seleccionado para reducir latencia
    const { branches: sedesFiltradas, loading: loadingBranches } = useBranches(formData.clienteId);

    // Mapear clientes al formato esperado por el Wizard
    const clientes = (rawClients || []).map((c: any) => ({
        id: c.id.toString(),
        nombre: c.name || "Sin Nombre",
        ruc: c.ruc || "---",
        color: c.color_aura || "#8B5CF6",
        logo: c.logo || null
    }));

    const [searchTerm, setSearchTerm] = useState("");
    const [searchTermSede, setSearchTermSede] = useState("");
    const [isDraftRestored, setIsDraftRestored] = useState(false);
    const [showRestoreDraft, setShowRestoreDraft] = useState(false);
    const [draftData, setDraftData] = useState<any>(null);

    // Auto-guardar borrador
    useEffect(() => {
        const saveInterval = setInterval(() => {
            if (currentStep > 1) {
                localStorage.setItem("ticket_draft", JSON.stringify({
                    step: currentStep,
                    data: formData,
                    timestamp: new Date().toISOString()
                }));
            }
        }, 2000);
        return () => clearInterval(saveInterval);
    }, [currentStep, formData]);

    // Restaurar borrador (Lógica no intrusiva)
    useEffect(() => {
        const savedDraft = localStorage.getItem("ticket_draft");
        if (savedDraft && !isDraftRestored) {
            try {
                const draft = JSON.parse(savedDraft);
                const draftDate = new Date(draft.timestamp);
                const now = new Date();
                const diffHours = (now.getTime() - draftDate.getTime()) / (1000 * 60 * 60);

                // Solo ofrecer restaurar si el borrador tiene menos de 24 horas
                if (diffHours < 24) {
                    setDraftData(draft);
                    setShowRestoreDraft(true);
                } else {
                    // Si es muy viejo, lo eliminamos silenciosamente
                    localStorage.removeItem("ticket_draft");
                }
            } catch (e) {
                console.error("Error parsing draft:", e);
                localStorage.removeItem("ticket_draft");
            }
            setIsDraftRestored(true);
        }
    }, [isDraftRestored]);

    const handleRestoreDraft = () => {
        if (draftData) {
            setFormData(draftData.data);
            setCurrentStep(draftData.step);
            setShowRestoreDraft(false);
        }
    };

    const handleDismissDraft = () => {
        localStorage.removeItem("ticket_draft");
        setShowRestoreDraft(false);
    };

    const isTicketClienteDuplicate = (): boolean => {
        if (!formData.tieneNumeroCliente || !formData.numeroTicketCliente) return false;
        
        const search = formData.numeroTicketCliente.trim().toUpperCase();
        return (allExistingTickets || []).some((t: any) => 
            t.client_ticket_number?.trim().toUpperCase() === search ||
            t.metadata?.numeroTicketCliente?.trim().toUpperCase() === search
        );
    };

    const isTicketClienteValid = (): boolean => {
        if (!formData.tieneNumeroCliente) return true;
        if (isTicketClienteDuplicate()) return false;
        const currentYearSuffix = new Date().getFullYear().toString().slice(-2);
        const regex = new RegExp(`^MB\\d{6}\\.${currentYearSuffix}$`);
        return regex.test(formData.numeroTicketCliente);
    };

    const canProceed = (): boolean => {
        switch (currentStep) {
            case 0: return isAdmin ? !!selectedGestor : true; // Admin must pick a gestor
            case 1: return !!formData.clienteId;
            case 2: return !!formData.sedeId;
            case 3: return (
                !!formData.tipoServicio &&
                formData.descripcionProblema.trim().length >= 10 &&
                isTicketClienteValid() &&
                !isTicketClienteDuplicate()
            );
            case 4: return true;
            case 5: return true;
            default: return false;
        }
    };

    const TOTAL_STEPS = isAdmin ? 6 : 5; // Admin has extra step 0
    const displayStep = isAdmin ? currentStep + 1 : currentStep; // For display "Paso X/Y"

    const handleNext = () => {
        if (canProceed() && currentStep < 5) setCurrentStep(currentStep + 1);
    };

    const handleBack = () => {
        if (currentStep > startStep) setCurrentStep(currentStep - 1);
    };

    const handleSelectCliente = (cliente: any) => {
        setFormData({
            ...formData,
            cliente,
            clienteId: cliente.id,
            sede: null,
            sedeId: ""
        });
        setSearchTermSede(""); // Limpiar búsqueda de sede al cambiar de cliente
    };

    const handleSelectSede = (sede: any) => {
        setFormData({ ...formData, sede, sedeId: sede.id });
    };

    const handleGenerarTicket = async () => {
        if (isSubmitting) return;

        if (formData.tieneNumeroCliente && isTicketClienteDuplicate()) {
            alert("✘ Error: El número de ticket de cliente ya existe en el sistema. Por favor use uno único.");
            setCurrentStep(3);
            return;
        }

        setIsSubmitting(true);

        // Convertir evidencias a Base64 para guardarlas en Supabase (metadata)
        const processFiles = async () => {
            const results = await Promise.all(
                formData.evidencias.map(file => {
                    return new Promise((resolve) => {
                        const reader = new FileReader();
                        reader.onload = (e) => resolve({
                            name: file.name,
                            type: file.type,
                            size: file.size,
                            url: e.target?.result
                        });
                        reader.readAsDataURL(file);
                    });
                })
            );
            return results;
        };

        const evidenciasBase64 = await processFiles();

        const now = new Date().toISOString();
        // Resolve gestor assignment according to policy:
        // Regla 1: Gestor → forced self-assignment
        // Regla 2: Admin → selected gestor from list
        const assignedGestora = selectedGestor;

        // Build audit log entry (for traceability, Sección 4)
        const assignmentLog = {
            tipo: isAdmin ? 'ASIGNACION_MANUAL_ADMIN' : 'AUTOASIGNACION_GESTOR',
            gestora_id: assignedGestora?.id || null,
            gestora_nombre: assignedGestora?.name || null,
            realizado_por: formData.creadoPor,
            fecha: now,
        };

        const cleanedTicketNumber = (formData.tieneNumeroCliente && formData.numeroTicketCliente?.trim()) 
            ? formData.numeroTicketCliente.trim() 
            : null;

        const supabaseTicket = {
            client_id: formData.clienteId || null,
            branch_id: formData.sedeId || null,
            status_id: "nuevo",
            service_type: formData.tipoServicio,
            description: formData.descripcionProblema,
            client_ticket_number: cleanedTicketNumber,
            created_by: formData.creadoPor,
            // Apply assignment policy
            gestora_id: assignedGestora?.id || null,
            metadata: {
                evidencias: evidenciasBase64,
                service_type_name: formData.tipoServicioNombre,
                estadoId: "nuevo",
                descripcionProblema: formData.descripcionProblema,
                numeroTicketCliente: cleanedTicketNumber,
                fechaCreacion: now,
                gestora: assignedGestora || null,
                asignacionLog: [assignmentLog], // Immutable audit log (Regla de Trazabilidad)
            }
        };

        try {
            localStorage.removeItem("ticket_draft");
            await onCreateTicket(supabaseTicket);
            onClose();
        } catch (error: any) {
            console.error("Error al crear ticket:", error);
            alert(`Hubo un error al crear el ticket: ${error.message || "Error desconocido"}`);
        } finally {
            setIsSubmitting(false);
        }
    };

    const getFilePreview = (file: File) => {
        if (file.type.startsWith('image/')) {
            return URL.createObjectURL(file);
        }
        return null;
    };

    const filteredClientes = clientes.filter((c: any) =>
        c.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.ruc.includes(searchTerm)
    );

    // 📙 Sedes filtradas del cliente seleccionado
    const sedesDisponibles = (sedesFiltradas || [])
        .filter((b: any) =>
            b.name.toLowerCase().includes(searchTermSede.toLowerCase()) ||
            (b.address && b.address.toLowerCase().includes(searchTermSede.toLowerCase())) ||
            (b.zone && b.zone.toLowerCase().includes(searchTermSede.toLowerCase()))
        )
        .map((b: any) => ({
            id: b.id,
            tipo: "Agencia",
            nombre: b.name,
            direccion: b.address,
            distrito: "",
            codigoTopaz: "",
            zona: b.zone || ""
        }));

    return (
        <div className={styles.overlay}>
            <div className={styles.wizard}>
                {/* HEADER COMPACTO VIBRANTE */}
                <div className={styles.wizardHeader}>
                    <div className={styles.headerLeft}>
                        <h2>✨ Crear Ticket</h2>
                        <span className={styles.stepIndicator}>Paso {displayStep}/{TOTAL_STEPS}</span>
                    </div>
                    <button className={styles.closeBtn} onClick={onClose}>
                        <X size={20} />
                    </button>
                </div>

                {/* PROGRESS BAR VIBRANTE - ICONOS INTERACTIVOS */}
                <div className={styles.progressBar}>
                    {(isAdmin ? [
                        { id: 0, icon: UserCheck, label: "Asignar" },
                        { id: 1, icon: Users, label: "Cliente" },
                        { id: 2, icon: MapPin, label: "Sede" },
                        { id: 3, icon: Wrench, label: "Servicio" },
                        { id: 4, icon: Upload, label: "Multimedia" },
                        { id: 5, icon: CheckCircle, label: "Finalizar" }
                    ] : [
                        { id: 1, icon: Users, label: "Cliente" },
                        { id: 2, icon: MapPin, label: "Sede" },
                        { id: 3, icon: Wrench, label: "Servicio" },
                        { id: 4, icon: Upload, label: "Multimedia" },
                        { id: 5, icon: CheckCircle, label: "Finalizar" }
                    ]).map(step => {
                        const Icon = step.icon;
                        const isActive = step.id === currentStep;
                        const isCompleted = step.id < currentStep;

                        return (
                            <div key={step.id} className={styles.progressStepWrapper}>
                                <div
                                    className={`${styles.progressStep} ${isActive ? styles.progressStepActive : ''} ${isCompleted ? styles.progressStepCompleted : ''}`}
                                >
                                    {isCompleted ? <Check size={14} /> : <Icon size={isActive ? 20 : 16} />}
                                </div>
                                <span className={`${styles.progressLabel} ${isActive ? styles.progressLabelActive : ''}`}>
                                    {step.label}
                                </span>
                            </div>
                        );
                    })}
                </div>

                {/* CONTENT */}
                <div className={styles.wizardContent}>
                    {/* 📙 PASO 0: SELECCIÓN DE GESTOR(A) – Solo Admin (Regla 2) 📙 */}
                    {isAdmin && currentStep === 0 && (
                        <div className={styles.step}>
                            <h3 className={styles.stepTitle}>
                                <ShieldCheck size={20} color="#6366f1" />
                                Asignar Gestor(a) Responsable
                            </h3>
                            <p className={styles.stepDescription} style={{ color: '#6366f1', fontWeight: 600, fontSize: '13px', marginBottom: '12px' }}>
                                📋 <strong>Regla 2 – Asignación Abierta:</strong> Como Administrador, selecciona el/la gestor(a) que gestionará este ticket.
                            </p>

                            <div className={styles.searchBox}>
                                <Search size={18} />
                                <input
                                    type="text"
                                    placeholder="Buscar gestor(a) por nombre o email..."
                                    value={gestorSearch}
                                    onChange={(e) => setGestorSearch(e.target.value)}
                                    autoFocus
                                />
                            </div>

                            {loadingGestores ? (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '1rem', color: '#6366f1' }}>
                                    <RefreshCw size={16} style={{ animation: 'spin 1s linear infinite' }} />
                                    <span>Cargando gestores activos...</span>
                                </div>
                            ) : (
                                <div className={styles.clientesList}>
                                    {filteredGestores.map((g: any) => (
                                        <div
                                            key={g.id}
                                            className={`${styles.clienteCard} ${selectedGestor?.id === g.id ? styles.clienteCardSelected : ''}`}
                                            onClick={() => setSelectedGestor(g)}
                                            style={{ cursor: 'pointer' }}
                                        >
                                            <div className={styles.clienteLogo} style={{ background: 'linear-gradient(135deg,#6366f1,#a855f7)', fontSize: '1rem', fontWeight: 900, color: 'white' }}>
                                                {(g.name || 'G').substring(0, 1).toUpperCase()}
                                            </div>
                                            <div className={styles.clienteInfo}>
                                                <h4>{g.name}</h4>
                                                <p style={{ color: '#64748b', fontSize: '12px' }}>{g.email}</p>
                                            </div>
                                            {selectedGestor?.id === g.id && (
                                                <CheckCircle size={20} className={styles.checkIcon} />
                                            )}
                                        </div>
                                    ))}
                                    {filteredGestores.length === 0 && !loadingGestores && (
                                        <div className={styles.emptyMessage}>
                                            <p>⚠️ No se encontraron gestores(as) activos(as).</p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {/* 📙 PASO 0 (Gestor): Confirmación de Autoasignación (Regla 1) 📙 */}
                    {!isAdmin && currentStep === 1 && creatorGestoraId && (
                        <div style={{ background: 'linear-gradient(135deg,#f0fdf4,#dcfce7)', border: '1px solid #86efac', borderRadios: '10px', padding: '10px 14px', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <UserCheck size={16} color="#16a34a" />
                            <span style={{ fontSize: '12px', fontWeight: 700, color: '#15803d' }}>
                                📋 Regla 1 – Autoasignación: Este ticket quedará asignado a <strong>{creatorGestoraNombre || 'tu cuenta'}</strong>.
                            </span>
                        </div>
                    )}

                    {/* PASO 1: CLIENTES */}
                    {currentStep === 1 && (
                        <div className={styles.step}>
                            <h3 className={styles.stepTitle}>
                                <Search size={20} />
                                Selecciona el Cliente
                            </h3>

                            <div className={styles.searchBox}>
                                <Search size={18} />
                                <input
                                    type="text"
                                    placeholder="Buscar por nombre o RUC..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    autoFocus
                                />
                            </div>

                            {/* 💡 BANNER DE BORRADOR (No intrusivo) */}
                            {showRestoreDraft && draftData && (
                                <div className={styles.draftBanner}>
                                    <div className={styles.draftInfo}>
                                        <Sparkles size={18} />
                                        <span>Tienes un borrador del {new Date(draftData.timestamp).toLocaleTimeString()}</span>
                                    </div>
                                    <div className={styles.draftActions}>
                                        <button className={styles.restoreBtn} onClick={handleRestoreDraft}>
                                            Recuperar
                                        </button>
                                        <button className={styles.dismissBtn} onClick={handleDismissDraft}>
                                            Ignorar
                                        </button>
                                    </div>
                                </div>
                            )}

                            {clientes.length === 0 ? (
                                <div className={styles.emptyMessage}>
                                    <p>⚠️ No hay clientes registrados en el sistema.</p>
                                    <p>Por favor, crea un cliente primero en el módulo de Gestión de Clientes.</p>
                                </div>
                            ) : (
                                <div className={styles.clientesList}>
                                    {filteredClientes.map((cliente: any) => (
                                        <div
                                            key={cliente.id}
                                            className={`${styles.clienteCard} ${formData.clienteId === cliente.id ? styles.clienteCardSelected : ''}`}
                                            onClick={() => handleSelectCliente(cliente)}
                                        >
                                            <div className={styles.clienteLogo} style={{ background: cliente.color, padding: cliente.logo ? '0' : 'inherit' }}>
                                                {cliente.logo ? (
                                                    <img src={cliente.logo} alt={cliente.nombre} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                                                ) : (
                                                    cliente.nombre.substring(0, 2)
                                                )}
                                            </div>
                                            <div className={styles.clienteInfo}>
                                                <h4>{cliente.nombre}</h4>
                                                <p>RUC: {cliente.ruc}</p>
                                            </div>
                                            {formData.clienteId === cliente.id && (
                                                <CheckCircle size={20} className={styles.checkIcon} />
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* PASO 2: SEDES COMO TARJETAS */}
                    {currentStep === 2 && (
                        <div className={styles.step}>
                            <h3 className={styles.stepTitle}>
                                <Building2 size={20} />
                                Selecciona la Sede
                            </h3>

                            {formData.cliente && (
                                <div className={styles.fichaCliente}>
                                    <div className={styles.clienteLogo} style={{ background: formData.cliente.color, padding: formData.cliente.logo ? '0' : 'inherit' }}>
                                        {formData.cliente.logo ? (
                                            <img src={formData.cliente.logo} alt={formData.cliente.nombre} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                                        ) : (
                                            formData.cliente.nombre.substring(0, 2)
                                        )}
                                    </div>
                                    <div className={styles.clienteMainInfo}>
                                        <h4>{formData.cliente.nombre}</h4>
                                        <p>RUC: {formData.cliente.ruc}</p>
                                    </div>

                                    {/* 🔎 BUSCADOR DE SEDES */}
                                    <div className={styles.searchBoxSede}>
                                        <Search size={16} />
                                        <input
                                            type="text"
                                            placeholder={`Buscar en ${sedesDisponibles.length} sedes...`}
                                            value={searchTermSede}
                                            onChange={(e) => setSearchTermSede(e.target.value)}
                                        />
                                    </div>
                                </div>
                            )}

                            {loadingBranches ? (
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '3rem', gap: '1rem', color: '#6366f1' }}>
                                    <RefreshCw size={40} style={{ animation: 'spin 1.5s linear infinite' }} />
                                    <p style={{ fontWeight: 600 }}>Cargando sedes de {formData.cliente?.nombre}...</p>
                                </div>
                            ) : sedesDisponibles.length === 0 ? (
                                <div className={styles.emptyMessage}>
                                    <p>⚠️ Este cliente no tiene sedes registradas.</p>
                                    <p>Por favor, agrega sedes en el módulo de Gestión de Clientes.</p>
                                </div>
                            ) : (
                                <div className={styles.sedesGrid}>
                                    {sedesDisponibles.map((sede: any) => (
                                        <div
                                            key={sede.id}
                                            className={`${styles.sedeCard} ${formData.sedeId === sede.id ? styles.sedeCardSelected : ''}`}
                                            onClick={() => handleSelectSede(sede)}
                                        >
                                            <div className={styles.sedeCardHeader}>
                                                <div className={styles.sedeIconWrapper}>
                                                    <Building2 size={24} />
                                                </div>
                                                {formData.sedeId === sede.id && (
                                                    <CheckCircle size={20} className={styles.checkIconSede} />
                                                )}
                                            </div>
                                            <div className={styles.sedeCardBody}>
                                                <span className={styles.sedeTipo}>{sede.tipo}</span>
                                                <h4>{sede.nombre}</h4>
                                                <div className={styles.sedeLocation}>
                                                    <MapPin size={14} />
                                                    <span>{sede.direccion}</span>
                                                </div>
                                                {sede.distrito && (
                                                    <p className={styles.sedeDistrito}>{sede.distrito}</p>
                                                )}
                                                {sede.codigoTopaz && (
                                                    <span className={styles.sedeCode}>CÓDIGO: {sede.codigoTopaz}</span>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* PASO 3: SERVICIO (DESDE MÓDULO DE TÉCNICOS) */}
                    {currentStep === 3 && (
                        <div className={styles.step}>
                            <h3 className={styles.stepTitle}>
                                <Wrench size={20} />
                                Tipo de Servicio
                            </h3>
                            <p className={styles.stepDescription}>
                                Servicios disponibles según especialidades de técnicos
                            </p>

                            <div className={styles.serviceMainRow}>
                                <div className={styles.serviceSelectionColumn}>
                                    <div className={styles.serviciosGridCompact}>
                                        {SERVICE_TYPES.map(tipo => {
                                            const IconComponent = tipo.icon;
                                            const isSelected = formData.tipoServicio === tipo.id;
                                            return (
                                                <div
                                                    key={tipo.id}
                                                    className={`${styles.servicioCardCompact} ${isSelected ? styles.servicioCardSelected : ''}`}
                                                    style={{
                                                        borderColor: isSelected ? tipo.color : 'transparent',
                                                        background: isSelected ? `${tipo.color}15` : '#F8FAFC'
                                                    }}
                                                    onClick={() => setFormData({
                                                        ...formData,
                                                        tipoServicio: tipo.id,
                                                        tipoServicioNombre: tipo.nombreCorto
                                                    })}
                                                >
                                                    <div
                                                        className={styles.compactIconWrapper}
                                                        style={{
                                                            background: isSelected ? tipo.color : '#E2E8F0',
                                                            color: isSelected ? 'white' : '#64748B'
                                                        }}
                                                    >
                                                        <IconComponent
                                                            size={24}
                                                            className={!isSelected ? styles.iconPulsing : ''}
                                                        />
                                                    </div>
                                                    <span style={{ color: isSelected ? '#1E293B' : '#64748B' }}>
                                                        {tipo.nombre}
                                                    </span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>

                                <div className={styles.diagnosticoColumn}>
                                    <div className={styles.diagnosticoSectionCompact}>
                                        <label className={styles.compactLabel}>
                                            <FileText size={16} />
                                            Descripción del Problema *
                                        </label>
                                        <textarea
                                            placeholder="Describa el problema detalladamente. Ejemplo: Falla en compresor, fuga de refrigerante, etc."
                                            value={formData.descripcionProblema}
                                            onChange={(e) => setFormData({ ...formData, descripcionProblema: e.target.value })}
                                            rows={5}
                                        />
                                        <div className={styles.textCounter}>
                                            <span style={{ color: formData.descripcionProblema.length >= 10 ? '#10B981' : '#EF4444' }}>
                                                {formData.descripcionProblema.length}
                                            </span>
                                            <span> / 500 caracteres</span>
                                        </div>
                                    </div>

                                    <div className={styles.ticketClienteSection}>
                                        <label>
                                            <input
                                                type="checkbox"
                                                checked={formData.tieneNumeroCliente}
                                                onChange={(e) => setFormData({ ...formData, tieneNumeroCliente: e.target.checked })}
                                            />
                                            ¿Ticket del Cliente?
                                        </label>
                                        {formData.tieneNumeroCliente && (
                                            <div className={styles.ticketClienteInputWrapper}>
                                                <input
                                                    type="text"
                                                    placeholder={`Ej: MB000000.${new Date().getFullYear().toString().slice(-2)}`}
                                                    value={formData.numeroTicketCliente}
                                                    onChange={(e) => setFormData({ ...formData, numeroTicketCliente: e.target.value.toUpperCase() })}
                                                    className={`${styles.ticketClienteInput} ${formData.numeroTicketCliente && (!isTicketClienteValid() || isTicketClienteDuplicate()) ? styles.inputError : ''}`}
                                                    maxLength={11}
                                                />
                                                {formData.numeroTicketCliente && isTicketClienteDuplicate() && (
                                                    <span className={styles.errorHint} style={{ color: '#EF4444' }}>
                                                        ✘ Este número de ticket ya existe. Debe ser único.
                                                    </span>
                                                )}
                                                {formData.numeroTicketCliente && !isTicketClienteValid() && !isTicketClienteDuplicate() && (
                                                    <span className={styles.errorHint}>
                                                        Formato: MB + 6 dígitos + .{new Date().getFullYear().toString().slice(-2)}
                                                    </span>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* PASO 4: EVIDENCIAS - REDISEÑADO CON MINIATURAS */}
                    {currentStep === 4 && (
                        <div className={styles.step}>
                            <h3 className={styles.stepTitle}>
                                <Upload size={18} />
                                Multimedia e Inteligencia
                            </h3>

                            <div className={styles.multimediaContainer}>
                                <div className={styles.dropZoneCompact}>
                                    <input
                                        type="file"
                                        multiple
                                        accept="image/*,video/*,.pdf"
                                        onChange={(e) => {
                                            if (e.target.files) {
                                                const newFiles = Array.from(e.target.files);
                                                setFormData({ ...formData, evidencias: [...formData.evidencias, ...newFiles] });
                                            }
                                        }}
                                        style={{ display: 'none' }}
                                        id="file-upload"
                                    />
                                    <label htmlFor="file-upload" className={styles.dropZoneContent}>
                                        <div className={styles.dropZoneIcon}>
                                            <Upload size={24} />
                                        </div>
                                        <div className={styles.dropZoneText}>
                                            <strong>Subir Evidencias</strong>
                                            <span>Imágenes, Videos o PDF</span>
                                        </div>
                                    </label>
                                </div>

                                {formData.evidencias.length > 0 && (
                                    <div className={styles.thumbnailsGrid}>
                                        {formData.evidencias.map((file, index) => {
                                            const preview = getFilePreview(file);
                                            return (
                                                <div key={index} className={styles.thumbnailItem}>
                                                    <div className={styles.thumbnailPreview}>
                                                        {preview ? (
                                                            <img src={preview} alt="preview" />
                                                        ) : (
                                                            <div className={styles.filePlaceholder}>
                                                                {file.type.includes('pdf') ? <FileText size={24} /> : <ImageIcon size={24} />}
                                                            </div>
                                                        )}
                                                        <button
                                                            className={styles.removeThumbnail}
                                                            onClick={() => setFormData({
                                                                ...formData,
                                                                evidencias: formData.evidencias.filter((_, i) => i !== index)
                                                            })}
                                                        >
                                                            <X size={12} />
                                                        </button>
                                                    </div>
                                                    <span className={styles.thumbnailName}>{file.name}</span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}

                                {formData.evidencias.length === 0 && (
                                    <div className={styles.noEvidenciasTip}>
                                        <ImageIcon size={40} />
                                        <p>Adjunte fotos del equipo o falla para un mejor diagnóstico</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* PASO 5: CONFIRMACIÓN Y RESUMEN FINAL */}
                    {currentStep === 5 && (
                        <div className={styles.step}>
                            <h3 className={styles.stepTitle}>
                                <CheckCircle size={20} />
                                Resumen del Requerimiento
                            </h3>

                            <div className={styles.resumenPremiumContainer}>
                                {/* SECCIÓN 1: IDENTIDAD Y UBICACIÓN */}
                                <div className={styles.resumenGrid}>
                                    <div className={styles.resumenColumn}>
                                        <div className={styles.resumenLabelGroup}>
                                            <Users size={14} />
                                            <span>Cliente</span>
                                        </div>
                                        <div className={styles.resumenValueCard}>
                                            <div className={styles.miniLogo} style={{ background: formData.cliente?.color, padding: formData.cliente?.logo ? '0' : 'inherit' }}>
                                                {formData.cliente?.logo ? (
                                                    <img src={formData.cliente.logo} alt={formData.cliente.nombre} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                                                ) : (
                                                    formData.cliente?.nombre.substring(0, 2)
                                                )}
                                            </div>
                                            <div className={styles.miniInfo}>
                                                <strong>{formData.cliente?.nombre}</strong>
                                                <span>RUC: {formData.cliente?.ruc}</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className={styles.resumenColumn}>
                                        <div className={styles.resumenLabelGroup}>
                                            <MapPin size={14} />
                                            <span>Sede / Ubicación</span>
                                        </div>
                                        <div className={styles.resumenValueCard}>
                                            <div className={styles.miniIconBox}>
                                                <Building2 size={18} />
                                            </div>
                                            <div className={styles.miniInfo}>
                                                <strong>{formData.sede?.nombre}</strong>
                                                <span>{formData.sede?.direccion}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* SECCIÓN 2: DETALLES DEL SERVICIO */}
                                <div className={styles.resumenMainContent}>
                                    <div className={styles.resumenDetailHeader}>
                                        <div className={styles.detailBadge}>
                                            <Wrench size={14} />
                                            {formData.tipoServicioNombre}
                                        </div>
                                        {formData.tieneNumeroCliente && (
                                            <div className={styles.ticketClienteBadge}>
                                                Ticket Cliente: {formData.numeroTicketCliente}
                                            </div>
                                        )}
                                    </div>

                                    <div className={styles.resumenDescriptionBox}>
                                        <div className={styles.quoteIcon}>"</div>
                                        <p>{formData.descripcionProblema}</p>
                                    </div>
                                </div>

                                {/* SECCIÓN 3: EVIDENCIAS Y META */}
                                <div className={styles.resumenFooterRow}>
                                    <div className={styles.metaItem}>
                                        <ImageIcon size={14} />
                                        <span>{formData.evidencias.length} Archivos Adjuntos</span>
                                    </div>
                                    <div className={styles.metaItem}>
                                        <Search size={14} />
                                        <span>Creado por {formData.creadoPor}</span>
                                    </div>
                                </div>
                            </div>

                            <div className={styles.confirmationAction}>
                                <p className={styles.confirmationTip}>🚀 Al presionar el botón se notificará automáticamente al área técnica.</p>
                                <button 
                                    className={styles.generarBtn} 
                                    onClick={handleGenerarTicket}
                                    disabled={isSubmitting}
                                >
                                    {isSubmitting ? (
                                        <>
                                            <Sparkles size={18} className={styles.spinning} />
                                            GENERANDO...
                                        </>
                                    ) : (
                                        <>
                                            <CheckCircle size={18} />
                                            CONFIRMAR Y GENERAR TICKET
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* FOOTER COMPACTO */}
                <div className={styles.wizardFooter}>
                    <button className={styles.backBtn} onClick={handleBack} disabled={currentStep === startStep}>
                        <ChevronLeft size={18} />
                        Atrás
                    </button>
                    {currentStep < 5 && (
                        <button className={styles.nextBtn} onClick={handleNext} disabled={!canProceed()}>
                            Siguiente
                            <ChevronRight size={18} />
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
