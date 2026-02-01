"use client";

import { useState, useEffect } from "react";
import {
    X, ChevronLeft, ChevronRight, Check, Search, MapPin, Building2,
    Upload, Image as ImageIcon, FileText, Trash2, CheckCircle, Wrench, Users, Monitor
} from "lucide-react";
import styles from "./CreateTicketWizard.module.css";
import { SERVICE_TYPES } from "@/lib/serviceTypes";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { INITIAL_CLIENTS, INITIAL_CLIENTS_DATA } from "@/lib/data/clients";

interface CreateTicketWizardProps {
    onClose: () => void;
    onCreateTicket: (ticket: any) => void;
}

export default function CreateTicketWizard({ onClose, onCreateTicket }: CreateTicketWizardProps) {
    const [currentStep, setCurrentStep] = useState(1);
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
        creadoPor: "Gestora Actual",
        fechaCreacion: new Date().toISOString(),
    });

    // 🔗 INTEGRACIÓN REAL: Cargar datos persistentes con fallbacks
    const [rawClients] = useLocalStorage<any[]>("clients", INITIAL_CLIENTS);
    const [clientsData] = useLocalStorage<any>("clientsData", INITIAL_CLIENTS_DATA);

    // Mapear clientes al formato esperado por el Wizard
    const clientes = (rawClients || []).map((c: any) => ({
        id: (c.id || "").toString(),
        nombre: c.name || "Sin Nombre",
        ruc: c.ruc || "---",
        prioridad: "Alta",
        color: c.colorAura || "#8B5CF6"
    }));

    const [searchTerm, setSearchTerm] = useState("");
    const [searchTermSede, setSearchTermSede] = useState("");
    const [isDraftRestored, setIsDraftRestored] = useState(false);

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

    // Restaurar borrador
    useEffect(() => {
        const savedDraft = localStorage.getItem("ticket_draft");
        if (savedDraft && !isDraftRestored) {
            const draft = JSON.parse(savedDraft);
            if (window.confirm(`Tienes un borrador del ${new Date(draft.timestamp).toLocaleString()}.\n¿Continuar?`)) {
                setFormData(draft.data);
                setCurrentStep(draft.step);
            } else {
                localStorage.removeItem("ticket_draft");
            }
            setIsDraftRestored(true);
        }
    }, [isDraftRestored]);

    const isTicketClienteValid = (): boolean => {
        if (!formData.tieneNumeroCliente) return true;
        const currentYearSuffix = new Date().getFullYear().toString().slice(-2);
        const regex = new RegExp(`^MB\\d{6}\\.${currentYearSuffix}$`);
        return regex.test(formData.numeroTicketCliente);
    };

    const canProceed = (): boolean => {
        switch (currentStep) {
            case 1: return !!formData.clienteId;
            case 2: return !!formData.sedeId;
            case 3: return (
                !!formData.tipoServicio &&
                formData.descripcionProblema.trim().length >= 10 &&
                isTicketClienteValid()
            );
            case 4: return true;
            case 5: return true;
            default: return false;
        }
    };

    const handleNext = () => {
        if (canProceed() && currentStep < 5) setCurrentStep(currentStep + 1);
    };

    const handleBack = () => {
        if (currentStep > 1) setCurrentStep(currentStep - 1);
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

    const handleGenerarTicket = () => {
        const nuevoTicket = {
            id: `TKT-${Date.now()}`,
            ...formData,
            estado: "Nuevo Ticket",
            estadoId: "nuevo", // Aseguramos sincronía con TICKET_STATES
            fechaCreacion: new Date().toISOString(),
        };
        localStorage.removeItem("ticket_draft");
        onCreateTicket(nuevoTicket);
        onClose();
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

    // 🔗 CORREGIDA: Obtener sedes del cliente seleccionado
    const sedesDisponibles = formData.clienteId ?
        (clientsData[formData.clienteId]?.branches || [])
            .filter((b: any) =>
                b.nombre.toLowerCase().includes(searchTermSede.toLowerCase()) ||
                b.direccion.toLowerCase().includes(searchTermSede.toLowerCase()) ||
                (b.distrito && b.distrito.toLowerCase().includes(searchTermSede.toLowerCase())) ||
                (b.codigoTopaz && b.codigoTopaz.toLowerCase().includes(searchTermSede.toLowerCase()))
            )
            .map((b: any) => ({
                id: b.id,
                tipo: b.tipo || "Agencia",
                nombre: b.nombre,
                direccion: b.direccion,
                distrito: b.distrito || "",
                codigoTopaz: b.codigoTopaz || "",
                zona: b.zona || ""
            })) : [];

    return (
        <div className={styles.overlay}>
            <div className={styles.wizard}>
                {/* HEADER COMPACTO VIBRANTE */}
                <div className={styles.wizardHeader}>
                    <div className={styles.headerLeft}>
                        <h2>✨ Crear Ticket</h2>
                        <span className={styles.stepIndicator}>Paso {currentStep}/5</span>
                    </div>
                    <button className={styles.closeBtn} onClick={onClose}>
                        <X size={20} />
                    </button>
                </div>

                {/* PROGRESS BAR VIBRANTE - ICONOS INTERACTIVOS */}
                <div className={styles.progressBar}>
                    {[
                        { id: 1, icon: Users, label: "Cliente" },
                        { id: 2, icon: MapPin, label: "Sede" },
                        { id: 3, icon: Wrench, label: "Servicio" },
                        { id: 4, icon: Upload, label: "Multimedia" },
                        { id: 5, icon: CheckCircle, label: "Finalizar" }
                    ].map(step => {
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
                                            <div className={styles.clienteLogo} style={{ background: cliente.color }}>
                                                {cliente.nombre.substring(0, 2)}
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
                                    <div className={styles.clienteLogo} style={{ background: formData.cliente.color }}>
                                        {formData.cliente.nombre.substring(0, 2)}
                                    </div>
                                    <div className={styles.clienteMainInfo}>
                                        <h4>{formData.cliente.nombre}</h4>
                                        <p>RUC: {formData.cliente.ruc}</p>
                                    </div>

                                    {/* 🔍 BUSCADOR DE SEDES */}
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

                            {sedesDisponibles.length === 0 ? (
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
                                                    <span className={styles.sedeCode}>Código: {sede.codigoTopaz}</span>
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
                                ✨ Servicios disponibles según especialidades de técnicos
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
                                                            size={18}
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
                                            rows={8}
                                        />
                                        <div className={styles.textCounter}>
                                            <span style={{ color: formData.descripcionProblema.length >= 10 ? '#10B981' : '#EF4444' }}>
                                                {formData.descripcionProblema.length}
                                            </span>
                                            <span> / 500 caracteres</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className={styles.ticketClienteSection}>
                                <label>
                                    <input
                                        type="checkbox"
                                        checked={formData.tieneNumeroCliente}
                                        onChange={(e) => setFormData({ ...formData, tieneNumeroCliente: e.target.checked })}
                                    />
                                    ¿El cliente ya asignó un número de ticket?
                                </label>
                                {formData.tieneNumeroCliente && (
                                    <div className={styles.ticketClienteInputWrapper}>
                                        <input
                                            type="text"
                                            placeholder={`Ej: MB000000.${new Date().getFullYear().toString().slice(-2)}`}
                                            value={formData.numeroTicketCliente}
                                            onChange={(e) => setFormData({ ...formData, numeroTicketCliente: e.target.value.toUpperCase() })}
                                            className={`${styles.ticketClienteInput} ${formData.numeroTicketCliente && !isTicketClienteValid() ? styles.inputError : ''}`}
                                            maxLength={11}
                                        />
                                        {formData.numeroTicketCliente && !isTicketClienteValid() && (
                                            <span className={styles.errorHint}>
                                                Formato inválido: MB + 6 dígitos + .{new Date().getFullYear().toString().slice(-2)}
                                            </span>
                                        )}
                                    </div>
                                )}
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
                                            <div className={styles.miniLogo} style={{ background: formData.cliente?.color }}>
                                                {formData.cliente?.nombre.substring(0, 2)}
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
                                <button className={styles.generarBtn} onClick={handleGenerarTicket}>
                                    <CheckCircle size={18} />
                                    CONFIRMAR Y GENERAR TICKET
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* FOOTER COMPACTO */}
                <div className={styles.wizardFooter}>
                    <button className={styles.backBtn} onClick={handleBack} disabled={currentStep === 1}>
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
