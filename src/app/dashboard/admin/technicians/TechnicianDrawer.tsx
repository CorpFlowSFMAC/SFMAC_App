"use client";

import { useState, useEffect } from "react";
import { X, User, Wrench, CreditCard, ChevronRight, CheckCircle, MapPin, Compass, CreditCard as CardIcon, FileText, Landmark, Sun, Mountain, Map, Trees, Phone } from "lucide-react";
import styles from "./technicianDrawer.module.css";
import { SERVICE_TYPES, getServicesAsOptions } from "@/lib/serviceTypes";
import { ZONES as STANDARDIZED_ZONES } from "@/lib/zones";

interface TechnicianDrawerProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (technician: any) => void;
    technician?: any;
}

const STEPS = [
    { id: 1, label: "Perfil & Identidad", icon: User },
    { id: 2, label: "Skills & Zona", icon: Wrench },
    { id: 3, label: "Bóveda Bancaria", icon: CreditCard }
];

// 🔧 ESPECIALIDADES DESDE SERVICE_TYPES (Sincronizado con tickets)
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
        zona: "LIMA",
        banco: "BCP",
        tipoCuenta: "Ahorros",
        numeroCuenta: "",
        cci: "",
        yape: "",
        plin: ""
    });

    useEffect(() => {
        if (technician) {
            // Lógica de extracción para técnicos antiguos que solo tienen 'name'
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
                zona: technician.zone || technician.zona || "LIMA",
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
                zona: "LIMA",
                banco: "BCP",
                tipoCuenta: "Ahorros",
                numeroCuenta: "",
                cci: "",
                yape: "",
                plin: ""
            });
            setCurrentStep(1);
        }
    }, [technician, isOpen]);

    if (!isOpen) return null;

    const handleNext = () => {
        if (currentStep < 3) {
            setCurrentStep(currentStep + 1);
        }
    };

    const handlePrevious = () => {
        if (currentStep > 1) {
            setCurrentStep(currentStep - 1);
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
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

        // Transformar datos al formato de Supabase
        const supabaseData = {
            name: `${formData.nombre} ${formData.apellido}`.trim(),
            first_name: formData.nombre,
            last_name: formData.apellido,
            document_type: formData.tipoDoc,
            document_number: formData.numeroDoc,
            phone: formData.celular,
            phone_secondary: formData.celular2,
            email: formData.email,
            address: formData.direccion,
            zone: formData.zona,
            specialties: formData.especialidades,
            photo: formData.foto,
            rating: technician?.rating || technician?.calificacion || 5,
            bank_name: formData.banco,
            account_type: formData.tipoCuenta,
            account_number: formData.numeroCuenta,
            cci: formData.cci,
            yape_number: formData.yape,
            plin_number: formData.plin,
            status: 'active'
        };

        onSave(supabaseData);
    };

    const toggleSpecialty = (specialty: string) => {
        if (formData.especialidades.includes(specialty)) {
            setFormData({ ...formData, especialidades: formData.especialidades.filter(s => s !== specialty) });
        } else {
            setFormData({ ...formData, especialidades: [...formData.especialidades, specialty] });
        }
    };

    return (
        <div className={styles.overlay}>
            <div className={styles.drawer}>
                <div className={styles.header}>
                    <div>
                        <h2 className={styles.title}>{technician ? "Editar Técnico" : "Contratar Nuevo Técnico"}</h2>
                        <p className={styles.subtitle}>Complete la información en 3 pasos</p>
                    </div>
                    <button onClick={onClose} className={styles.closeBtn}>
                        <X size={24} />
                    </button>
                </div>

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
                    {/* PASO 1: Perfil & Identidad */}
                    {currentStep === 1 && (
                        <div className={styles.stepContent}>
                            <h3 className={styles.stepTitle}>👤 Perfil & Identidad</h3>

                            {/* Doc Type integrado con input */}
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
                                    <label>📧 Email *</label>
                                    <input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value.toLowerCase() })} placeholder="tecnico@sinfimac.com" required />
                                </div>

                                <div className={styles.formGroup}>
                                    <label>🏠 Dirección *</label>
                                    <input type="text" value={formData.direccion} onChange={(e) => setFormData({ ...formData, direccion: e.target.value.toUpperCase() })} placeholder="AV. LOS INCAS 234" style={{ textTransform: 'uppercase' }} required />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* PASO 2: Skills & Zona */}
                    {currentStep === 2 && (
                        <div className={styles.stepContent}>
                            <h3 className={styles.stepTitle}>🛠️ Skills & Zona de Cobertura</h3>

                            <div className={styles.sectionLabel}>Especialidades Habilitadas *</div>
                            <div className={styles.skillsGridCompact}>
                                {SPECIALTIES.map((spec) => {
                                    const Icon = spec.icon;
                                    const isSelected = formData.especialidades.includes(spec.id);

                                    return (
                                        <div key={spec.id} className={`${styles.skillCardCompact} ${isSelected ? styles.skillSelected : ''}`} onClick={() => toggleSpecialty(spec.id)} style={{ borderColor: isSelected ? spec.color : 'transparent', background: isSelected ? `${spec.color}15` : 'white' }}>
                                            <Icon size={16} color={spec.color} />
                                            <span style={{ color: isSelected ? spec.color : '#475569' }}>{spec.label}</span>
                                        </div>
                                    );
                                })}
                            </div>

                            <div className={styles.sectionLabel} style={{ marginTop: '1.25rem' }}>📍 Zona de Operación *</div>
                            <div className={styles.zoneGrid}>
                                {ZONES.map((zone) => {
                                    const isSelected = formData.zona === zone.id;
                                    const Icon = zone.icon;

                                    return (
                                        <div
                                            key={zone.id}
                                            className={`${styles.zoneCard} ${isSelected ? styles.zoneSelected : ''}`}
                                            onClick={() => setFormData({ ...formData, zona: zone.id })}
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
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* PASO 3: Bóveda Bancaria */}
                    {currentStep === 3 && (
                        <div className={styles.stepContent}>
                            <h3 className={styles.stepTitle}>💳 Bóveda Bancaria</h3>

                            {/* Premium Preview & Selector Row */}
                            <div className={styles.bankPreviewRow}>
                                {/* Bank Card Preview Premium */}
                                {(() => {
                                    const selectedBank = BANKS.find(b => b.id === formData.banco) || BANKS[0];
                                    return (
                                        <>
                                            {/* Left: Bank Card Preview */}
                                            <div
                                                className={styles.compactBankCard}
                                                style={{
                                                    background: `linear-gradient(135deg, ${selectedBank.gradient[0]}, ${selectedBank.gradient[1]})`
                                                }}
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
                                                                <span>{formData.zona}</span>
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

                                            {/* Middle: Integrated Inputs Column */}
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

                                {/* Interactive Bank Selector */}
                                <div className={styles.sideBankSelector}>
                                    <div className={styles.bankSelectorGridCompact}>
                                        {BANKS.map(bank => (
                                            <div
                                                key={bank.id}
                                                className={`${styles.bankOptionMini} ${formData.banco === bank.id ? styles.bankSelectedMini : ''}`}
                                                onClick={() => setFormData({ ...formData, banco: bank.id })}
                                                style={{
                                                    '--bank-color': bank.color,
                                                    '--bank-accent': bank.accent
                                                } as any}
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
                                    <div className={styles.sectionLabelMini}>Ecosistema de Pago Móvil</div>
                                    <div className={styles.walletsRow}>
                                        <div className={`${styles.walletMiniCard} ${formData.yape ? styles.yapeActive : ''}`}>
                                            <div className={styles.walletBrand} style={{ background: '#7C3AED' }}>Y</div>
                                            <input
                                                type="tel"
                                                value={formData.yape}
                                                onChange={(e) => setFormData({ ...formData, yape: e.target.value.replace(/\D/g, '').slice(0, 9) })}
                                                placeholder="Yape"
                                                maxLength={9}
                                            />
                                        </div>
                                        <div className={`${styles.walletMiniCard} ${formData.plin ? styles.plinActive : ''}`}>
                                            <div className={styles.walletBrand} style={{ background: '#00D1FF' }}>P</div>
                                            <input
                                                type="tel"
                                                value={formData.plin}
                                                onChange={(e) => setFormData({ ...formData, plin: e.target.value.replace(/\D/g, '').slice(0, 9) })}
                                                placeholder="Plin"
                                                maxLength={9}
                                            />
                                        </div>
                                    </div>
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
