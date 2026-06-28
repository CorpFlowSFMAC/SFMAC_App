"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
    RefreshCw, CheckCircle2, XCircle, AlertTriangle, QrCode,
    MessageSquare, Clock, Settings, Wifi, WifiOff, Send, History,
    ChevronRight, Server, Phone
} from "lucide-react";
import styles from "./whatsapp-admin.module.css";

interface WhatsAppStatus {
    connected: boolean;
    service: string;
    version: string;
    qrAvailable: boolean;
    lastError?: string;
    lastCheck: string;
}

interface NotificationLog {
    id: string;
    ticket_code: string;
    recipient_name: string;
    recipient_type: string;
    destination: string;
    message_body: string;
    status: string;
    error_details?: string;
    created_at: string;
}

export default function WhatsAppAdminPage() {
    const [status, setStatus] = useState<WhatsAppStatus | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [qrImage, setQrImage] = useState<string | null>(null);
    const [recentLogs, setRecentLogs] = useState<NotificationLog[]>([]);
    const [testPhone, setTestPhone] = useState("");
    const [testMessage, setTestMessage] = useState("Test de conexión - SINFIMAC");
    const [sending, setSending] = useState(false);
    const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

    const fetchStatus = useCallback(async () => {
        try {
            const response = await fetch("/api/whatsapp/send?action=status");
            if (response.ok) {
                const data = await response.json();
                setStatus(data);
                setError(null);
            } else {
                throw new Error(`HTTP ${response.status}`);
            }
        } catch (err: any) {
            setError(err.message);
            setStatus({
                connected: false,
                service: "SINFIMAC WhatsApp Bridge",
                version: "2.0.0",
                qrAvailable: false,
                lastError: err.message,
                lastCheck: new Date().toISOString()
            });
        } finally {
            setLoading(false);
        }
    }, []);

    const fetchQR = useCallback(async () => {
        try {
            const response = await fetch("/api/whatsapp/send?action=qr");
            if (response.ok) {
                const blob = await response.blob();
                const url = URL.createObjectURL(blob);
                setQrImage(url);
            }
        } catch (err) {
            console.error("Error fetching QR:", err);
        }
    }, []);

    const fetchRecentLogs = useCallback(async () => {
        try {
            const response = await fetch(
                "https://api.sinfimac.pe/rest/v1/notification_logs?select=*&order=created_at.desc&limit=20",
                {
                    headers: {
                        "apikey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNvcnBmbG93c2ZtYWMtaGV0em5lciIsInJvbGUiOiJhbm9uIiwiaWF0IjoxNzc4NzQ4NTY5LCJleHAiOjIwODU3MjkyOTR9.UVpFZwAHuUFXKEwZANp58HP3x-9wgFGrvVY12yoC9MI",
                        "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNvcnBmbG93c2ZtYWMtaGV0em5lciIsInJvbGUiOiJhbm9uIiwiaWF0IjoxNzc4NzQ4NTY5LCJleHAiOjIwODU3MjkyOTR9.UVpFZwAHuUFXKEwZANp58HP3x-9wgFGrvVY12yoC9MI"
                    }
                }
            );
            if (response.ok) {
                const data = await response.json();
                setRecentLogs(data);
            }
        } catch (err) {
            console.error("Error fetching logs:", err);
        }
    }, []);

    const sendTestMessage = async () => {
        if (!testPhone || !testMessage) {
            setTestResult({ success: false, message: "Complete todos los campos" });
            return;
        }

        setSending(true);
        setTestResult(null);

        try {
            const response = await fetch("/api/whatsapp/send", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    phone: testPhone,
                    message: testMessage,
                    skipStatusCheck: false
                })
            });

            const data = await response.json();

            if (data.success) {
                setTestResult({ success: true, message: "Mensaje enviado exitosamente" });
            } else {
                setTestResult({
                    success: false,
                    message: data.details?.message || data.error || "Error desconocido"
                });
            }
        } catch (err: any) {
            setTestResult({ success: false, message: err.message });
        } finally {
            setSending(false);
        }
    };

    useEffect(() => {
        fetchStatus();
        fetchRecentLogs();

        // Refrescar estado cada 30 segundos
        const interval = setInterval(fetchStatus, 30000);
        return () => clearInterval(interval);
    }, [fetchStatus, fetchRecentLogs]);

    const handleRefresh = () => {
        setLoading(true);
        fetchStatus();
        fetchRecentLogs();
    };

    const handleShowQR = () => {
        fetchQR();
    };

    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        return date.toLocaleString("es-PE", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit"
        });
    };

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <div className={styles.headerTitle}>
                    <Settings size={24} />
                    <h1>Administración de WhatsApp</h1>
                </div>
                <button
                    className={styles.refreshButton}
                    onClick={handleRefresh}
                    disabled={loading}
                >
                    <RefreshCw size={18} className={loading ? styles.spinning : ""} />
                    Actualizar
                </button>
            </div>

            {/* Estado del Servicio */}
            <div className={styles.section}>
                <h2 className={styles.sectionTitle}>
                    <Server size={20} />
                    Estado del Servicio
                </h2>

                <div className={styles.statusCard}>
                    {loading ? (
                        <div className={styles.loading}>
                            <RefreshCw size={24} className={styles.spinning} />
                            <span>Cargando estado...</span>
                        </div>
                    ) : status ? (
                        <>
                            <div className={styles.statusHeader}>
                                <div className={`${styles.statusIndicator} ${status.connected ? styles.connected : styles.disconnected}`}>
                                    {status.connected ? (
                                        <Wifi size={32} />
                                    ) : (
                                        <WifiOff size={32} />
                                    )}
                                </div>
                                <div className={styles.statusInfo}>
                                    <h3>{status.connected ? "Conectado" : "Desconectado"}</h3>
                                    <p>{status.service} v{status.version}</p>
                                    <p className={styles.lastCheck}>
                                        Última verificación: {formatDate(status.lastCheck)}
                                    </p>
                                </div>
                            </div>

                            {status.lastError && (
                                <div className={styles.errorBox}>
                                    <AlertTriangle size={18} />
                                    <span>{status.lastError}</span>
                                </div>
                            )}

                            {!status.connected && (
                                <div className={styles.disconnectedActions}>
                                    <p className={styles.disconnectedMessage}>
                                        El servicio de WhatsApp está desconectado. Para reconnectar,
                                        necesita escanear el código QR en el servidor Hetzner.
                                    </p>
                                    <button
                                        className={styles.qrButton}
                                        onClick={handleShowQR}
                                    >
                                        <QrCode size={18} />
                                        Ver Código QR
                                    </button>
                                </div>
                            )}
                        </>
                    ) : (
                        <div className={styles.error}>
                            <XCircle size={24} />
                            <span>Error al cargar estado</span>
                        </div>
                    )}
                </div>
            </div>

            {/* Código QR */}
            {qrImage && (
                <div className={styles.section}>
                    <h2 className={styles.sectionTitle}>
                        <QrCode size={20} />
                        Código QR para Reconectar
                    </h2>
                    <div className={styles.qrContainer}>
                        <img src={qrImage} alt="WhatsApp QR Code" className={styles.qrImage} />
                        <p className={styles.qrInstructions}>
                            Escanee este código QR con la aplicación de WhatsApp en su teléfono
                        </p>
                    </div>
                </div>
            )}

            {/* Prueba de Mensajes */}
            <div className={styles.section}>
                <h2 className={styles.sectionTitle}>
                    <Send size={20} />
                    Prueba de Envío
                </h2>
                <div className={styles.testForm}>
                    <div className={styles.inputGroup}>
                        <label>
                            <Phone size={16} />
                            Número de teléfono
                        </label>
                        <input
                            type="text"
                            value={testPhone}
                            onChange={(e) => setTestPhone(e.target.value)}
                            placeholder="Ej: 932085184"
                        />
                    </div>
                    <div className={styles.inputGroup}>
                        <label>
                            <MessageSquare size={16} />
                            Mensaje
                        </label>
                        <textarea
                            value={testMessage}
                            onChange={(e) => setTestMessage(e.target.value)}
                            placeholder="Mensaje de prueba"
                            rows={3}
                        />
                    </div>
                    <button
                        className={styles.sendButton}
                        onClick={sendTestMessage}
                        disabled={sending || !status?.connected}
                    >
                        {sending ? (
                            <>
                                <RefreshCw size={18} className={styles.spinning} />
                                Enviando...
                            </>
                        ) : (
                            <>
                                <Send size={18} />
                                Enviar Mensaje
                            </>
                        )}
                    </button>

                    {testResult && (
                        <div className={`${styles.testResult} ${testResult.success ? styles.success : styles.failure}`}>
                            {testResult.success ? <CheckCircle2 size={18} /> : <XCircle size={18} />}
                            <span>{testResult.message}</span>
                        </div>
                    )}
                </div>
            </div>

            {/* Historial de Notificaciones */}
            <div className={styles.section}>
                <h2 className={styles.sectionTitle}>
                    <History size={20} />
                    Historial de Notificaciones Recientes
                </h2>
                <div className={styles.logsTable}>
                    {recentLogs.length > 0 ? (
                        <table>
                            <thead>
                                <tr>
                                    <th>Fecha</th>
                                    <th>Ticket</th>
                                    <th>Destinatario</th>
                                    <th>Teléfono</th>
                                    <th>Estado</th>
                                    <th>Error</th>
                                </tr>
                            </thead>
                            <tbody>
                                {recentLogs.map((log) => (
                                    <tr key={log.id}>
                                        <td>{formatDate(log.created_at)}</td>
                                        <td>{log.ticket_code}</td>
                                        <td>{log.recipient_name}</td>
                                        <td>{log.destination}</td>
                                        <td>
                                            <span className={`${styles.statusBadge} ${styles[log.status]}`}>
                                                {log.status === "enviado" ? (
                                                    <CheckCircle2 size={14} />
                                                ) : (
                                                    <XCircle size={14} />
                                                )}
                                                {log.status}
                                            </span>
                                        </td>
                                        <td className={styles.errorCell}>
                                            {log.error_details || "-"}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    ) : (
                        <div className={styles.noLogs}>
                            <Clock size={24} />
                            <span>No hay notificaciones recientes</span>
                        </div>
                    )}
                </div>
            </div>

            {/* Instrucciones */}
            <div className={styles.section}>
                <h2 className={styles.sectionTitle}>
                    <AlertTriangle size={20} />
                    Instrucciones para Reconectar
                </h2>
                <div className={styles.instructions}>
                    <ol>
                        <li>
                            <strong>Conéctese al servidor Hetzner:</strong>
                            <code>ssh root@87.99.137.96</code>
                        </li>
                        <li>
                            <strong>Navegue al directorio del servicio:</strong>
                            <code>cd /opt/sinfimac/whatsapp-bridge</code>
                        </li>
                        <li>
                            <strong>Reinicie el servicio:</strong>
                            <code>pm2 restart sinfimac-whatsapp</code>
                            <span>o</span>
                            <code>./restart-whatsapp-service.sh restart</code>
                        </li>
                        <li>
                            <strong>Obtenga el código QR:</strong>
                            <code>./restart-whatsapp-service.sh qr</code>
                        </li>
                        <li>
                            <strong>Escanee el QR con WhatsApp:</strong>
                            Abra WhatsApp → Configuración → Dispositivos vinculados → Escanear QR
                        </li>
                        <li>
                            <strong>Verifique la conexión:</strong>
                            Use el botón "Probar Envío" arriba para verificar
                        </li>
                    </ol>
                </div>
            </div>
        </div>
    );
}