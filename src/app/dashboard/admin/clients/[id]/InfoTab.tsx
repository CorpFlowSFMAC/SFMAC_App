"use client";

import { MapPin, Mail, Phone, Calendar, Globe } from "lucide-react";
import styles from "./infoTab.module.css";

interface InfoTabProps {
    client: any;
}

export default function InfoTab({ client }: InfoTabProps) {
    return (
        <div className={styles.container} style={{ '--client-color': client.colorAura } as any}>
            <div className={styles.grid}>
                {/* Left Card */}
                <div className={styles.infoCard}>
                    <h3 className={styles.cardTitle}>Datos Corporativos</h3>

                    <div className={styles.infoRow}>
                        <div className={styles.iconBox} style={{ background: `${client.colorAura}20` }}>
                            {client.icon}
                        </div>
                        <div>
                            <div className={styles.label}>Razón Social</div>
                            <div className={styles.value}>{client.name}</div>
                        </div>
                    </div>

                    <div className={styles.infoRow}>
                        <div className={styles.iconCircle} style={{ borderColor: client.colorAura }}>
                            <span className={styles.iconText}>RUC</span>
                        </div>
                        <div>
                            <div className={styles.label}>Registro Único</div>
                            <div className={styles.value}>{client.ruc}</div>
                        </div>
                    </div>

                    <div className={styles.infoRow}>
                        <div className={styles.iconCircle} style={{ borderColor: client.colorAura }}>
                            <div className={styles.colorPreview} style={{ background: client.colorAura }}></div>
                        </div>
                        <div>
                            <div className={styles.label}>Color Corporativo</div>
                            <div className={styles.value}>{client.colorAura}</div>
                        </div>
                    </div>

                    <div className={styles.infoRow}>
                        <Calendar size={24} color={client.colorAura} />
                        <div>
                            <div className={styles.label}>Fecha de Alta</div>
                            <div className={styles.value}>{new Date(client.createdAt).toLocaleDateString('es-PE', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
                        </div>
                    </div>
                </div>

                {/* Right Card */}
                <div className={styles.infoCard}>
                    <h3 className={styles.cardTitle}>Información de Contacto</h3>

                    <div className={styles.infoRow}>
                        <MapPin size={24} color={client.colorAura} />
                        <div>
                            <div className={styles.label}>Sede Principal</div>
                            <div className={styles.value}>{client.address}</div>
                            <div className={styles.subValue}>{client.zone}</div>
                        </div>
                    </div>

                    <div className={styles.infoRow}>
                        <Mail size={24} color={client.colorAura} />
                        <div>
                            <div className={styles.label}>Correo Electrónico</div>
                            <div className={styles.value}>{client.email}</div>
                        </div>
                    </div>

                    <div className={styles.infoRow}>
                        <Phone size={24} color={client.colorAura} />
                        <div>
                            <div className={styles.label}>Teléfono</div>
                            <div className={styles.value}>{client.phone}</div>
                        </div>
                    </div>

                    <div className={styles.infoRow}>
                        <Globe size={24} color={client.colorAura} />
                        <div>
                            <div className={styles.label}>Cobertura</div>
                            <div className={styles.value}>Nacional</div>
                            <div className={styles.subValue}>Presencia en todas las regiones del Perú</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
