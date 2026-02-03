"use client";

import { useState, useEffect } from "react";
import { X, User, Wrench, CreditCard, ChevronRight, CheckCircle, MapPin, Compass, CreditCard as CardIcon, FileText, Landmark, Sun, Mountain, Map, Trees } from "lucide-react";
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
    { id: "BCP", name: "BCP", logo: "🏦", color: "#FF6600", gradient: ["#002A8F", "#0047AB"] },
    { id: "Interbank", name: "Interbank", logo: "💳", color: "#00A859", gradient: ["#00A859", "#008B4E"] },
    { id: "BBVA", name: "BBVA", logo: "🏧", color: "#004481", gradient: ["#004481", "#043263"] },
    { id: "Scotiabank", name: "Scotiabank", logo: "💰", color: "#EC1C24", gradient: ["#EC1C24", "#C4121A"] }
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
            setFormData({
                nombre: technician.nombre || "",
                apellido: technician.apellido || "",
                tipoDoc: technician.tipoDoc || "DNI",
                numeroDoc: technician.numeroDoc || "",
                celular: technician.celular || "",
                celular2: technician.celular2 || "",
                email: technician.email || "",
                direccion: technician.direccion || "",
                foto: technician.foto || null,
                especialidades: technician.especialidades || [],
                zona: technician.zona || "LIMA",
                banco: technician.banco || "BCP",
                tipoCuenta: technician.tipoCuenta || "Ahorros",
                numeroCuenta: technician.numeroCuenta || "",
                cci: technician.cci || "",
                yape: technician.yape || "",
                plin: technician.plin || ""
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

        onSave(formData);
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

                            {/* Bank Card Preview Premium */}
                            {(() => {
                                const selectedBank = BANKS.find(b => b.id === formData.banco) || BANKS[0];
                                return (
                                    <div
                                        className={styles.bankCard}
                                        style={{
                                            background: `linear-gradient(135deg, ${selectedBank.gradient[0]}, ${selectedBank.gradient[1]})`
                                        }}
                                    >
                                        <div className={styles.bankChip}></div>
                                        <div className={styles.bankLogo}>{selectedBank.logo}</div>
                                        <div className={styles.bankInfoPreview}>
                                            <div className={styles.bankName}>{selectedBank.name}</div>
                                            <div className={styles.accountNumber}>{formData.numeroCuenta || "XXXX - XXXX - XXXX - XXXX"}</div>
                                            <div className={styles.cardFooter}>
                                                <div className={styles.accountType}>{formData.tipoCuenta.toUpperCase()}</div>
                                                <div className={styles.contactPoint}>{formData.celular}</div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })()}

                            <div className={styles.sectionLabel}>Seleccione Entidad Financiera *</div>
                            <div className={styles.bankSelectorGrid}>
                                {BANKS.map(bank => (
                                    <div
                                        key={bank.id}
                                        className={`${styles.bankOption} ${formData.banco === bank.id ? styles.bankSelected : ''}`}
                                        onClick={() => setFormData({ ...formData, banco: bank.id })}
                                        style={{
                                            borderColor: formData.banco === bank.id ? bank.color : 'transparent',
                                            background: formData.banco === bank.id ? `${bank.color}10` : 'white'
                                        }}
                                    >
                                        <span className={styles.bankOptionLogo}>{bank.logo}</span>
                                        <span className={styles.bankOptionName} style={{ color: formData.banco === bank.id ? bank.color : '#475569' }}>{bank.name}</span>
                                        {formData.banco === bank.id && <div className={styles.checkIcon}>✓</div>}
                                    </div>
                                ))}
                            </div>

                            <div className={styles.formGrid}>
                                <div className={styles.formGroup}>
                                    <label><MapPin size={14} /> Tipo de Cuenta *</label>
                                    <select value={formData.tipoCuenta} onChange={(e) => setFormData({ ...formData, tipoCuenta: e.target.value })} required>
                                        <option value="Ahorros">Ahorros</option>
                                        <option value="Corriente">Corriente</option>
                                    </select>
                                </div>

                                <div className={styles.formGroup} style={{ gridColumn: '1 / -1' }}>
                                    <label><Compass size={14} /> Número de Cuenta *</label>
                                    <input type="text" value={formData.numeroCuenta} onChange={(e) => setFormData({ ...formData, numeroCuenta: e.target.value })} placeholder="Ej: 191-12345678-0-12" required />
                                </div>

                                <div className={styles.formGroup} style={{ gridColumn: '1 / -1' }}>
                                    <label><Map size={14} /> CCI (Opcional)</label>
                                    <input type="text" value={formData.cci} onChange={(e) => setFormData({ ...formData, cci: e.target.value })} placeholder="Ej: 00219100123456780112" maxLength={20} />
                                </div>

                                <div className={styles.walletsContainer} style={{ gridColumn: '1 / -1' }}>
                                    <div className={styles.sectionLabelMini}>Billeteras Digitales</div>
                                    <div className={styles.walletsSelector}>
                                        <div className={`${styles.walletCard} ${formData.yape ? styles.walletActiveYape : ''}`}>
                                            <div className={styles.walletBrandIcon} style={{ background: '#7C3AED' }}>
                                                Y
                                            </div>
                                            <div className={styles.walletInfo}>
                                                <label>YAPE</label>
                                                <input
                                                    type="tel"
                                                    value={formData.yape}
                                                    onChange={(e) => { const value = e.target.value.replace(/\D/g, '').slice(0, 9); setFormData({ ...formData, yape: value }); }}
                                                    placeholder="987..."
                                                    maxLength={9}
                                                />
                                            </div>
                                        </div>

                                        <div className={`${styles.walletCard} ${formData.plin ? styles.walletActivePlin : ''}`}>
                                            <div className={styles.walletBrandIcon} style={{ background: '#00D1FF' }}>
                                                P
                                            </div>
                                            <div className={styles.walletInfo}>
                                                <label>PLIN</label>
                                                <input
                                                    type="tel"
                                                    value={formData.plin}
                                                    onChange={(e) => { const value = e.target.value.replace(/\D/g, '').slice(0, 9); setFormData({ ...formData, plin: value }); }}
                                                    placeholder="912..."
                                                    maxLength={9}
                                                />
                                            </div>
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
