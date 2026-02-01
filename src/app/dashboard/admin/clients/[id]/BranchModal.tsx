"use client";

import { useState, useEffect } from "react";
import { X, Save, MapPin, Building2, Hash } from "lucide-react";
import styles from "./branchModal.module.css";
import { getDepartments, getProvinces, getDistricts } from "@/lib/peru-locations";

interface BranchModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (branch: any) => void;
    branch?: any;
    clientColor: string;
    isViewOnly?: boolean;
}

const BRANCH_TYPES = [
    { id: "Matriz", label: "Matriz", icon: "🏛️", color: "#EE82EE" },
    { id: "Agencia", label: "Agencia", icon: "🏢", color: "#00FF00" },
    { id: "Oficina", label: "Oficina", icon: "📍", color: "#00B8D4" }
];

// Mapeo automático de Departamento → Zona
const DEPARTMENT_TO_ZONE: { [key: string]: string } = {
    // Lima
    "Lima": "LIMA",
    "Callao": "LIMA",

    // Norte
    "Tumbes": "NORTE",
    "Piura": "NORTE",
    "Lambayeque": "NORTE",
    "La Libertad": "NORTE",
    "Cajamarca": "NORTE",
    "Amazonas": "NORTE",

    // Sur
    "Arequipa": "SUR",
    "Moquegua": "SUR",
    "Tacna": "SUR",
    "Puno": "SUR",
    "Cusco": "SUR",
    "Apurímac": "SUR",
    "Madre de Dios": "SUR",

    // Centro
    "Ancash": "CENTRO",
    "Huánuco": "CENTRO",
    "Pasco": "CENTRO",
    "Junín": "CENTRO",
    "Huancavelica": "CENTRO",
    "Ica": "CENTRO",
    "Ayacucho": "CENTRO",

    // Oriente
    "San Martín": "ORIENTE",
    "Loreto": "ORIENTE",
    "Ucayali": "ORIENTE"
};

export default function BranchModal({ isOpen, onClose, onSave, branch, clientColor, isViewOnly }: BranchModalProps) {
    const [formData, setFormData] = useState({
        tipo: "Agencia",
        codigoTopaz: "",
        nombre: "",
        direccion: "",
        distrito: "",
        provincia: "",
        departamento: "",
        zona: "LIMA"
    });

    useEffect(() => {
        if (branch) {
            setFormData(branch);
        } else {
            setFormData({
                tipo: "Agencia",
                codigoTopaz: "",
                nombre: "",
                direccion: "",
                distrito: "",
                provincia: "",
                departamento: "",
                zona: "LIMA"
            });
        }
    }, [branch, isOpen]);

    if (!isOpen) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (isViewOnly) return;

        // Validación adicional del código Topaz
        if (!/^[0-9]{3}$/.test(formData.codigoTopaz)) {
            alert("❌ El Código Topaz debe tener exactamente 3 dígitos numéricos");
            return;
        }

        onSave(formData);
    };

    const handleDeptChange = (dept: string) => {
        if (isViewOnly) return;
        // Zona automática basada en el departamento
        const autoZone = DEPARTMENT_TO_ZONE[dept] || "Lima Centro";
        setFormData({ ...formData, departamento: dept, provincia: "", distrito: "", zona: autoZone });
    };

    const handleProvChange = (prov: string) => {
        if (isViewOnly) return;
        setFormData({ ...formData, provincia: prov, distrito: "" });
    };

    const selectedTypeConfig = BRANCH_TYPES.find(t => t.id === formData.tipo) || BRANCH_TYPES[1];

    return (
        <div className={styles.overlay}>
            <div className={styles.modal} style={{ '--client-color': clientColor, '--type-color': selectedTypeConfig.color } as any}>
                <div className={styles.header}>
                    <div>
                        <h2>{isViewOnly ? "Detalles de Sede" : branch ? "Editar Sede" : "Nueva Sede"}</h2>
                        <p>{isViewOnly ? "Información detallada de la sede seleccionada" : "Complete la información de la sede"}</p>
                    </div>
                    <button onClick={onClose} className={styles.closeBtn}>
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className={styles.form}>
                    <div className={styles.grid}>
                        {/* Tipo de Sede con iconos interactivos */}
                        <div className={styles.formGroup} style={{ gridColumn: "1 / -1" }}>
                            <label><Building2 size={16} /> Tipo de Sede *</label>
                            <div className={styles.typeSelector}>
                                {BRANCH_TYPES.map(type => (
                                    <div
                                        key={type.id}
                                        className={`${styles.typeOption} ${formData.tipo === type.id ? styles.typeSelected : ''}`}
                                        onClick={() => !isViewOnly && setFormData({ ...formData, tipo: type.id })}
                                        style={{
                                            borderColor: formData.tipo === type.id ? type.color : 'transparent',
                                            background: formData.tipo === type.id ? `${type.color}20` : 'transparent',
                                            cursor: isViewOnly ? 'default' : 'pointer',
                                            opacity: isViewOnly && formData.tipo !== type.id ? 0.3 : 1
                                        }}
                                    >
                                        <span className={styles.typeIcon}>{type.icon}</span>
                                        <span className={styles.typeLabel}>{type.label}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className={styles.formGroup}>
                            <label><Hash size={16} /> Código Topaz *</label>
                            <input
                                type="text"
                                value={formData.codigoTopaz}
                                onChange={(e) => {
                                    if (isViewOnly) return;
                                    const value = e.target.value.replace(/\D/g, '').slice(0, 3);
                                    setFormData({ ...formData, codigoTopaz: value });
                                }}
                                placeholder="001"
                                maxLength={3}
                                pattern="[0-9]{3}"
                                title="El código debe tener 3 dígitos numéricos"
                                required
                                readOnly={isViewOnly}
                            />
                        </div>

                        <div className={styles.formGroup}>
                            <label><MapPin size={16} /> Zona (Automática)</label>
                            <input
                                type="text"
                                value={formData.zona}
                                readOnly
                                className={styles.readonlyField}
                                style={{ background: `${clientColor}20`, borderColor: clientColor }}
                            />
                        </div>

                        <div className={styles.formGroup} style={{ gridColumn: "1 / 3" }}>
                            <label>Nombre de la Sede *</label>
                            <input
                                type="text"
                                value={formData.nombre}
                                onChange={(e) => !isViewOnly && setFormData({ ...formData, nombre: e.target.value.toUpperCase() })}
                                placeholder="AGENCIA MIRAFLORES"
                                style={{ textTransform: 'uppercase' }}
                                required
                                readOnly={isViewOnly}
                            />
                        </div>

                        <div className={styles.formGroup} style={{ gridColumn: "1 / -1" }}>
                            <label>Dirección *</label>
                            <input
                                type="text"
                                value={formData.direccion}
                                onChange={(e) => !isViewOnly && setFormData({ ...formData, direccion: e.target.value.toUpperCase() })}
                                placeholder="AV. LARCO 1234"
                                style={{ textTransform: 'uppercase' }}
                                required
                                readOnly={isViewOnly}
                            />
                        </div>

                        <div className={styles.formGroup}>
                            <label>Departamento *</label>
                            <select
                                value={formData.departamento}
                                onChange={(e) => handleDeptChange(e.target.value)}
                                required
                                disabled={isViewOnly}
                            >
                                <option value="">Seleccione...</option>
                                {getDepartments().map(d => <option key={d} value={d}>{d}</option>)}
                            </select>
                        </div>

                        <div className={styles.formGroup}>
                            <label>Provincia *</label>
                            <select
                                value={formData.provincia}
                                onChange={(e) => handleProvChange(e.target.value)}
                                disabled={!formData.departamento || isViewOnly}
                                required
                            >
                                <option value="">Seleccione...</option>
                                {getProvinces(formData.departamento).map(p => <option key={p} value={p}>{p}</option>)}
                            </select>
                        </div>

                        <div className={styles.formGroup}>
                            <label>Distrito *</label>
                            <select
                                value={formData.distrito}
                                onChange={(e) => !isViewOnly && setFormData({ ...formData, distrito: e.target.value })}
                                disabled={!formData.provincia || isViewOnly}
                                required
                            >
                                <option value="">Seleccione...</option>
                                {getDistricts(formData.departamento, formData.provincia).map(d => <option key={d} value={d}>{d}</option>)}
                            </select>
                        </div>
                    </div>

                    <div className={styles.footer}>
                        <button type="button" onClick={onClose} className={styles.cancelBtn}>
                            {isViewOnly ? "Cerrar" : "Cancelar"}
                        </button>
                        {!isViewOnly && (
                            <button type="submit" className={styles.saveBtn}>
                                <Save size={18} />
                                {branch ? "Actualizar" : "Crear"} Sede
                            </button>
                        )}
                    </div>
                </form>
            </div>
        </div>
    );
}
