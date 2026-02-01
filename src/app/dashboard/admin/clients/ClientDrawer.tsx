"use client";

import { useState, useEffect } from "react";
import { X, Building2, Upload, Palette, Save } from "lucide-react";
import styles from "./clientDrawer.module.css";

interface ClientDrawerProps {
    isOpen: boolean;
    onClose: () => void;
    onClientCreated: (client: any) => void;
    onClientUpdated?: (client: any) => void;
    editClient?: any;
}

const BRAND_COLORS = ["#FF9100", "#4F46E5", "#00D084", "#F43F5E", "#8B5CF6", "#06B6D4", "#FACC15"];

export default function ClientDrawer({ isOpen, onClose, onClientCreated, onClientUpdated, editClient }: ClientDrawerProps) {
    const [formData, setFormData] = useState({
        name: "",
        ruc: "",
        address: "",
        email: "",
        phone: "",
        zone: "Lima Centro",
        colorAura: BRAND_COLORS[0],
        icon: "🏢",
        logo: null as string | null
    });

    useEffect(() => {
        if (editClient) {
            setFormData({
                name: editClient.name || "",
                ruc: editClient.ruc || "",
                address: editClient.address || "",
                email: editClient.email || "",
                phone: editClient.phone || "",
                zone: editClient.zone || "Lima Centro",
                colorAura: editClient.colorAura || BRAND_COLORS[0],
                icon: editClient.icon || "🏢",
                logo: editClient.logo || null
            });
        } else {
            setFormData({
                name: "",
                ruc: "",
                address: "",
                email: "",
                phone: "",
                zone: "Lima Centro",
                colorAura: BRAND_COLORS[0],
                icon: "🏢",
                logo: null
            });
        }
    }, [editClient, isOpen]);

    if (!isOpen) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        // Validación adicional del teléfono
        if (!/^9[0-9]{8}$/.test(formData.phone)) {
            alert("❌ El teléfono debe tener 9 dígitos y empezar con 9");
            return;
        }

        // Validación adicional del RUC
        if (!/^[0-9]{11}$/.test(formData.ruc)) {
            alert("❌ El RUC debe tener exactamente 11 dígitos");
            return;
        }

        if (editClient && onClientUpdated) {
            onClientUpdated({ ...editClient, ...formData });
        } else {
            onClientCreated(formData);
        }

        onClose();
    };

    return (
        <div className={styles.overlay}>
            <div className={styles.drawer}>
                <div className={styles.header}>
                    <div>
                        <h2 className={styles.title}>
                            {editClient ? "Editar Cliente" : "Nuevo Cliente Corporativo"}
                        </h2>
                        <p className={styles.subtitle}>
                            {editClient ? "Actualiza la información del cliente" : "Configura la identidad corporativa"}
                        </p>
                    </div>
                    <button onClick={onClose} className={styles.closeBtn}>
                        <X size={24} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className={styles.form}>
                    <div className={styles.formGrid}>
                        <div className={styles.formGroup}>
                            <label>Razón Social *</label>
                            <input
                                type="text"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value.toUpperCase() })}
                                placeholder="MIBANCO"
                                required
                                style={{ textTransform: 'uppercase' }}
                            />
                        </div>

                        <div className={styles.formGroup}>
                            <label>RUC (11 dígitos) *</label>
                            <input
                                type="text"
                                value={formData.ruc}
                                onChange={(e) => {
                                    const value = e.target.value.replace(/\D/g, '').slice(0, 11);
                                    setFormData({ ...formData, ruc: value });
                                }}
                                placeholder="20100000000"
                                maxLength={11}
                                pattern="[0-9]{11}"
                                title="El RUC debe tener 11 dígitos"
                                required
                                disabled={!!editClient}
                                style={editClient ? { opacity: 0.7, cursor: 'not-allowed' } : {}}
                            />
                        </div>

                        <div className={styles.formGroup} style={{ gridColumn: '1 / -1' }}>
                            <label>Dirección Sede Principal *</label>
                            <input
                                type="text"
                                value={formData.address}
                                onChange={(e) => setFormData({ ...formData, address: e.target.value.toUpperCase() })}
                                placeholder="AV. PRINCIPAL 123, SAN ISIDRO"
                                required
                                style={{ textTransform: 'uppercase' }}
                            />
                        </div>

                        <div className={styles.formGroup}>
                            <label>Email Corporativo *</label>
                            <input
                                type="email"
                                value={formData.email}
                                onChange={(e) => setFormData({ ...formData, email: e.target.value.toLowerCase() })}
                                placeholder="contacto@empresa.com"
                                required
                            />
                        </div>

                        <div className={styles.formGroup}>
                            <label>Teléfono (9 dígitos, empieza con 9) *</label>
                            <input
                                type="tel"
                                value={formData.phone}
                                onChange={(e) => {
                                    const value = e.target.value.replace(/\D/g, '').slice(0, 9);
                                    setFormData({ ...formData, phone: value });
                                }}
                                placeholder="987654321"
                                pattern="9[0-9]{8}"
                                maxLength={9}
                                title="El teléfono debe tener 9 dígitos y empezar con 9"
                                required
                            />
                        </div>

                        <div className={styles.formGroup}>
                            <label>Zona Principal</label>
                            <select value={formData.zone} onChange={(e) => setFormData({ ...formData, zone: e.target.value })}>
                                <option value="Lima Centro">Lima Centro</option>
                                <option value="Norte">Norte</option>
                                <option value="Sur">Sur</option>
                                <option value="Centro">Centro</option>
                                <option value="Oriente">Oriente</option>
                            </select>
                        </div>

                        <div className={styles.formGroup} style={{ gridColumn: '1 / -1' }}>
                            <label><Palette size={16} /> Color Corporativo</label>
                            <div className={styles.colorPicker}>
                                {BRAND_COLORS.map(color => (
                                    <div
                                        key={color}
                                        className={`${styles.colorOption} ${formData.colorAura === color ? styles.colorSelected : ''}`}
                                        style={{ backgroundColor: color }}
                                        onClick={() => setFormData({ ...formData, colorAura: color })}
                                    >
                                        {formData.colorAura === color && <div className={styles.checkmark}>✓</div>}
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className={styles.formGroup} style={{ gridColumn: '1 / -1' }}>
                            <label><Upload size={16} /> Logo del Cliente (Opcional)</label>
                            <div className={styles.uploadNote}>
                                <p>Nota: Por ahora, la funcionalidad de carga de logo requiere un servidor. El sistema usará el icono predeterminado 🏢</p>
                            </div>
                        </div>
                    </div>

                    <div className={styles.footer}>
                        <button type="button" onClick={onClose} className={styles.cancelBtn}>
                            Cancelar
                        </button>
                        <button type="submit" className={styles.submitBtn}>
                            {editClient ? <Save size={18} /> : <Building2 size={18} />}
                            {editClient ? "Guardar Cambios" : "Crear Cliente"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
