"use client";

import { useState, useRef, useEffect } from "react";
import { X, Minimize2, Maximize2, Square, FileText, ArrowRight, Calendar, Camera, ClipboardCheck, DollarSign, Package, Split, Coins, FileSpreadsheet, Download, Send, Upload, Clock, CheckCircle, CheckCircle2, ThumbsUp, Hammer, Wallet, Plus, Calculator, Receipt, Sparkles, AlertTriangle } from "lucide-react";
import TechnicianDrawer from "./TechnicianDrawer";
import TicketStateNavigator from "./TicketStateNavigator";
import { TicketSummary, InfoBarBase, TechnicianSchedulingBar, DiagnosisInfoBar, QuotationInfoBar, FinancialLiquidationBar, UnifiedEvidenceBar, DocumentationSummaryBar } from "./TicketSummary";
import OnlineQuotationEditor from "./OnlineQuotationEditor";
import { normalizeStateId } from "@/lib/ticketStates";
import styles from "./TicketWindow.module.css";

interface TicketWindowProps {
    ticket: any;
    onClose: () => void;
    index?: number;
    children?: React.ReactNode;
}

export default function TicketWindow({ ticket, onClose, index = 0, children }: TicketWindowProps) {
    const [isMaximized, setIsMaximized] = useState(true);
    const [isMinimized, setIsMinimized] = useState(false);
    const [position, setPosition] = useState({ x: 100, y: 50 });
    const [isDragging, setIsDragging] = useState(false);
    const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
    const [showAssignmentDrawer, setShowAssignmentDrawer] = useState(false);

    // Cargar estado persistido del ticket (MOVIDO ARRIBA para evitar ReferenceError)
    const [ticketData, setTicketData] = useState(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem(`ticket_state_${ticket.id}`);
            if (saved) {
                try {
                    const parsed = JSON.parse(saved);
                    return {
                        ...ticket,
                        ...parsed,
                        estadoId: normalizeStateId(parsed.estadoId || ticket.estadoId)
                    };
                } catch (e) {
                    console.error('Error parsing saved ticket state:', e);
                }
            }
        }
        return {
            ...ticket,
            estadoId: normalizeStateId(ticket.estadoId)
        };
    });

    // Estados para el reporte de campo (Paso 4)
    const [diagnostico, setDiagnostico] = useState("");
    const [costoManoObra, setCostoManoObra] = useState("");
    const [costoMateriales, setCostoMateriales] = useState("");
    const [modalidad, setModalidad] = useState("todo_costo");
    const [evidenciasCampo, setEvidenciasCampo] = useState<any[]>([]);
    const [montoTotalCotizado, setMontoTotalCotizado] = useState(ticketData.montoFinal || 0);
    const quotationEditorRef = useRef<any>(null);
    const [partidasCotizacion, setPartidasCotizacion] = useState<any[]>(ticketData.partidas || []);
    const [currentTime, setCurrentTime] = useState<Date | null>(null);
    const [isQuotationCollapsed, setIsQuotationCollapsed] = useState(true); // Por defecto colapsada si está aprobada
    const [porcentajeAdelanto, setPorcentajeAdelanto] = useState(0.5); // 40%, 50% o 60%
    const [userRole, setUserRole] = useState<string | null>(null);

    useEffect(() => {
        if (typeof window !== 'undefined') {
            setUserRole(localStorage.getItem("userRole"));
        }
    }, []);

    // Estados para Ejecución (Paso 11)
    const [gastos, setGastos] = useState<any[]>(ticketData.gastos || []);
    // Estados para Cierre y Documentación (Paso 9)
    const [documentosChecklist, setDocumentosChecklist] = useState({
        actaConformidad: false,
        ats: false,
        declaracionJurada: false,
        excelSeguridad: false
    });
    const [evidenciasEjecucion, setEvidenciasEjecucion] = useState<any[]>(ticketData.evidenciasEjecucion || []);
    const [newExpense, setNewExpense] = useState({ concepto: "", monto: "", tipo: "Gasto Operativo" });
    const fileInputRef = useRef<HTMLInputElement>(null);
    const fieldEvidenceRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const interval = setInterval(() => {
            setCurrentTime(new Date());
        }, 1000);

        // Auto-reparar datos del técnico si faltan
        if (ticketData.tecnico?.id && (!ticketData.tecnico.banco || !ticketData.tecnico.numeroCuenta || !ticketData.tecnico.cci)) {
            const storedTechs = localStorage.getItem('technicians');
            if (storedTechs) {
                try {
                    const allTechs = JSON.parse(storedTechs);
                    const fullTech = allTechs.find((t: any) => t.id === ticketData.tecnico.id);
                    if (fullTech) {
                        setTicketData((prev: any) => ({
                            ...prev,
                            tecnico: {
                                ...prev.tecnico,
                                banco: fullTech.banco,
                                numeroCuenta: fullTech.numeroCuenta,
                                cci: fullTech.cci,
                                yape: fullTech.yape,
                                plin: fullTech.plin
                            }
                        }));
                    }
                } catch (e) {
                    console.error("Error repairing tech data:", e);
                }
            }
        }

        return () => clearInterval(interval);
    }, [ticketData.tecnico?.id]);

    const formatElapsedTime = () => {
        const start = new Date(ticketData.fechaCreacion);
        const end = (ticketData.pausadoSLA && ticketData.fechaPausa)
            ? new Date(ticketData.fechaPausa)
            : (currentTime || new Date());

        const diffMs = Math.max(0, end.getTime() - start.getTime());
        const hrs = Math.floor(diffMs / 3600000);
        const mins = Math.floor((diffMs % 3600000) / 60000);
        const secs = Math.floor((diffMs % 60000) / 1000);

        return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    const windowRef = useRef<HTMLDivElement>(null);

    // Guardar estado del ticket cuando cambia y sincronizar con la lista maestra
    useEffect(() => {
        if (typeof window !== 'undefined' && ticketData) {
            // 1. Guardar en el storage individual
            localStorage.setItem(`ticket_state_${ticket.id}`, JSON.stringify(ticketData));

            // 2. Sincronizar con la lista maestra 'tickets' para reflejar cambios en el Dashboard/Kanban
            const savedTickets = localStorage.getItem("tickets");
            if (savedTickets) {
                try {
                    const allTickets = JSON.parse(savedTickets);
                    const index = allTickets.findIndex((t: any) => t.id === ticket.id);
                    if (index !== -1) {
                        // Solo actualizar si hay cambios reales para evitar bucles
                        if (JSON.stringify(allTickets[index]) !== JSON.stringify(ticketData)) {
                            allTickets[index] = { ...allTickets[index], ...ticketData };
                            localStorage.setItem("tickets", JSON.stringify(allTickets));

                            // Disparar eventos para que el Dashboard/Kanban se actualicen inmediatamente
                            window.dispatchEvent(new Event('storage'));
                            window.dispatchEvent(new Event('local-storage-update'));
                        }
                    }
                } catch (e) {
                    console.error("Error syncing ticket with master list:", e);
                }
            }
        }
    }, [ticketData, ticket.id]);


    const handleAssignment = (assignmentData: any) => {
        // Actualizar el ticket con los datos de asignación
        const updatedTicket = {
            ...ticketData,
            ...assignmentData,
            // Si hay costo de visita > 0, requerimos pago de gerencia antes de inspección
            // Si no hay costo, procedemos normal
            estadoId: ticketData.estadoId === "nuevo"
                ? (parseFloat(assignmentData.costoVisita || 0) > 0 ? "esperando_pago_visita" : "en_inspeccion")
                : ticketData.estadoId
        };

        setTicketData(updatedTicket);
        setShowAssignmentDrawer(false); // Cerrar el drawer


    };

    const handleProceedToAssignment = () => {
        setShowAssignmentDrawer(true);
    };

    const handleFieldEvidenceUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            const newfiles = Array.from(e.target.files);
            const promises = newfiles.map(file => {
                return new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.readAsDataURL(file);
                    reader.onload = () => resolve({
                        name: file.name,
                        url: reader.result as string,
                        type: file.type,
                        fecha: new Date().toISOString()
                    });
                    reader.onerror = error => reject(error);
                });
            });

            Promise.all(promises).then(results => {
                setEvidenciasCampo(prev => [...prev, ...results]);
            }).catch(err => console.error("Error reading files:", err));
        }
    };

    const handleSendFieldReport = () => {
        if (!diagnostico) {
            alert("Por favor ingrese el diagnóstico técnico.");
            return;
        }

        const reportData = {
            ...ticketData,
            diagnostico,
            costoManoObra: parseFloat(costoManoObra) || 0,
            costoMateriales: modalidad === 'todo_costo' ? 0 : (parseFloat(costoMateriales) || 0),
            modalidad,
            evidenciasCampo: evidenciasCampo,
            estadoId: "en_cotizacion",
            fechaReporteCampo: new Date().toISOString()
        };

        setTicketData(reportData);
    };

    const handleSendQuote = async () => {
        if (quotationEditorRef.current) {
            try {
                await quotationEditorRef.current.downloadPDF();
            } catch (err) {
                console.error("Error al descargar PDF:", err);
            }
        }

        const updated = {
            ...ticketData,
            estadoId: "cotizacion_enviada",
            fechaCotizacion: new Date().toISOString(),
            partidas: partidasCotizacion,
            montoFinal: montoTotalCotizado,
            pausadoSLA: true,
            fechaPausa: new Date().toISOString()
        };

        setTicketData(updated);
    };

    const handleApproveQuote = () => {
        const approved = {
            ...ticketData,
            estadoId: "cotizacion_aprobada",
            fechaAprobacion: new Date().toISOString(),
            pausadoSLA: false,
            fechaReactivacion: new Date().toISOString(),
            modificacionAutorizada: false,
            costoAjustadoPostAprobacion: false,
            omitirAjusteTecnico: false
        };
        setTicketData(approved);
    };

    const handleAuthorizeModification = () => {
        const authorized = {
            ...ticketData,
            modificacionAutorizada: true
        };
        setTicketData(authorized);
        setIsQuotationCollapsed(false);
        alert("Modificación autorizada por Gerencia. La cotización ha sido desbloqueada.");
    };

    const handleProceedToExecution = () => {
        const updated = {
            ...ticketData,
            estadoId: "en_ejecucion",
            fechaInicioEjecucion: new Date().toISOString()
        };
        setTicketData(updated);
    };

    const handleAdjustTechnicianCost = () => {
        const currentMO = parseFloat(ticketData.costoManoObra || 0);
        const currentMAT = parseFloat(ticketData.costoMateriales || 0);
        const currentTotal = currentMO + currentMAT;

        const nuevoTotal = prompt(`Costo actual del técnico: S/ ${currentTotal.toFixed(2)}\nIngrese el NUEVO costo negociado (Total MO + MAT):`, currentTotal.toString());

        if (nuevoTotal && !isNaN(parseFloat(nuevoTotal))) {
            const val = parseFloat(nuevoTotal);
            // Proporcionalmente ajustamos MO y MAT o simplemente lo ponemos en MO si es más simple, 
            // pero para ser precisos intentaremos mantener la proporción o pedir desglosado.
            // Para simplicidad del flujo solicitado:
            const updated = {
                ...ticketData,
                costoManoObra: val, // Ponemos el total en MO por ahora o podrías pedir ambos
                costoMateriales: 0,
                costoAjustadoPostAprobacion: true,
                costoAnteriorTecnico: currentTotal
            };
            setTicketData(updated);
            alert(`Costo ajustado exitosamente a S/ ${val.toFixed(2)}. Ahora puede proceder con el adelanto.`);
        }
    };

    const handleAddExpense = () => {
        if (!newExpense.concepto || !newExpense.monto) return;
        const updatedGastos = [...gastos, { ...newExpense, id: Date.now(), monto: parseFloat(newExpense.monto) }];
        setGastos(updatedGastos);
        setNewExpense({ concepto: "", monto: "", tipo: "Gasto Operativo" });
        setTicketData({ ...ticketData, gastos: updatedGastos });
    };

    const handleFinishExecution = () => {
        if (evidenciasEjecucion.length < 2) {
            alert("Es obligatorio adjuntar al menos 2 fotos (DURANTE y DESPUÉS) para finalizar.");
            return;
        }
        const updated = {
            ...ticketData,
            estadoId: "documentacion_enviada",
            fechaFinEjecucion: new Date().toISOString(),
            gastos: gastos,
            evidenciasEjecucion: evidenciasEjecucion,
            evidenciasCampo: ticketData.evidenciasCampo || [], // Asegurar persistencia del antes
            evidencias: ticketData.evidencias || [] // Asegurar fotos del cliente
        };
        setTicketData(updated);
        alert("¡Trabajo finalizado! Se ha generado el expediente fotográfico unificado.");
    };

    const handleRequestExtraAdvance = () => {
        const monto = prompt("Ingrese el monto del adelanto adicional solicitado por el técnico (Petición al Gerente):");
        if (monto && !isNaN(parseFloat(monto))) {
            const val = parseFloat(monto);
            const pagosPrevios = ticketData.historialPagosTecnico || [];
            const totalPagado = pagosPrevios.reduce((sum: number, p: any) => sum + p.monto, 0);
            const costoRef = (parseFloat(ticketData.costoManoObra || 0) + parseFloat(ticketData.costoMateriales || 0));

            if (totalPagado + val > costoRef + 0.01) {
                alert("Error: El monto solicitado excede el saldo pendiente del técnico.");
                return;
            }

            setTicketData({
                ...ticketData,
                solicitudAdelantoExtra: {
                    monto: val,
                    fecha: new Date().toISOString()
                }
            });
            alert("Solicitud registrada. El Gerente debe realizar el depósito para poder confirmarlo.");
        }
    };

    const handleConfirmExtraAdvance = () => {
        const solicitud = ticketData.solicitudAdelantoExtra;
        if (!solicitud) return;

        const pagosPrevios = ticketData.historialPagosTecnico || [];
        const totalPagado = pagosPrevios.reduce((sum: number, p: any) => sum + p.monto, 0);

        const nuevoPago = {
            id: Math.random().toString(36).substr(2, 9),
            fecha: new Date().toISOString(),
            monto: solicitud.monto,
            referencia: "Adelanto Adicional (Ejecución)"
        };

        setTicketData({
            ...ticketData,
            historialPagosTecnico: [...pagosPrevios, nuevoPago],
            montoAdelanto: totalPagado + solicitud.monto,
            solicitudAdelantoExtra: null
        });
        alert(`Se ha confirmado que el Gerente depositó S/ ${solicitud.monto.toFixed(2)}.`);
    };

    const handleConfirmVisitPayment = () => {
        const amount = parseFloat(ticketData.costoVisita || 0);
        const pagosPrevios = ticketData.historialPagosTecnico || [];

        const nuevoPago = {
            id: Math.random().toString(36).substr(2, 9),
            fecha: new Date().toISOString(),
            monto: amount,
            referencia: "Pago de Visita Técnica (Gerencia)"
        };

        setTicketData({
            ...ticketData,
            estadoId: "en_inspeccion",
            visitPaymentConfirmed: true,
            historialPagosTecnico: [...pagosPrevios, nuevoPago],
            montoAdelanto: (ticketData.montoAdelanto || 0) + amount,
            fechaPagoVisita: new Date().toISOString()
        });
        alert(`Se ha confirmado el pago de visita de S/ ${amount.toFixed(2)}. El técnico ahora puede proceder con la inspección.`);
    };

    const handleConfirmAdvance = () => {
        const costoReferencia = (parseFloat(ticketData.costoManoObra || 0) + parseFloat(ticketData.costoMateriales || 0));
        const amount = costoReferencia * porcentajeAdelanto;

        const pagosPrevios = ticketData.historialPagosTecnico || [];
        const totalPagado = pagosPrevios.reduce((sum: number, p: any) => sum + p.monto, 0);

        if (totalPagado + amount > costoReferencia + 0.01) {
            alert(`Error: El pago de S/ ${amount.toFixed(2)} excedería el costo total pactado de S/ ${costoReferencia.toFixed(2)} (Ya se pagó S/ ${totalPagado.toFixed(2)}).`);
            return;
        }

        const nuevoPago = {
            id: Math.random().toString(36).substr(2, 9),
            fecha: new Date().toISOString(),
            monto: amount,
            porcentaje: porcentajeAdelanto,
            referencia: "Adelanto Operativo"
        };

        const updated = {
            ...ticketData,
            adelantoPagado: true,
            historialPagosTecnico: [...pagosPrevios, nuevoPago],
            montoAdelanto: totalPagado + amount,
            fechaPagoAdelanto: new Date().toISOString()
        };

        setTicketData(updated);
        alert(`Se ha confirmado el depósito de S/ ${amount.toFixed(2)} (${(porcentajeAdelanto * 100).toFixed(0)}% del costo ref.) al técnico.`);
    };

    const handleFinalLiquidationPay = () => {
        const costoReferencia = (parseFloat(ticketData.costoManoObra || 0) + parseFloat(ticketData.costoMateriales || 0));
        const pagosPrevios = ticketData.historialPagosTecnico || [];
        const totalPagado = pagosPrevios.reduce((sum: number, p: any) => sum + p.monto, 0);
        const amount = costoReferencia - totalPagado;

        if (amount < 0) {
            alert("Error: El saldo es negativo. Verifique los depósitos previos.");
            return;
        }

        const nuevoPago = {
            id: Math.random().toString(36).substr(2, 9),
            fecha: new Date().toISOString(),
            monto: amount,
            referencia: "Liquidación Final del Servicio"
        };

        const updated = {
            ...ticketData,
            estadoId: "ticket_cerrado",
            historialPagosTecnico: [...pagosPrevios, nuevoPago],
            montoAdelanto: totalPagado + amount,
            fechaPagoFinal: new Date().toISOString()
        };

        setTicketData(updated);
        alert(`Se ha registrado el pago final de S/ ${amount.toFixed(2)}. El ticket ha sido LIQUIDADO Y CERRADO satisfactoriamente.`);
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files) return;

        Array.from(files).forEach(file => {
            const reader = new FileReader();
            reader.onload = (event) => {
                const url = event.target?.result as string;
                const newEvidence = { url, name: file.name, size: file.size, type: file.type };

                setEvidenciasEjecucion(prev => {
                    const updated = [...prev, newEvidence];
                    // Actualizar también en ticketData para persistencia
                    setTicketData((current: any) => ({ ...current, evidenciasEjecucion: updated }));
                    return updated;
                });
            };
            reader.readAsDataURL(file);
        });

        // Resetear el input para permitir subir el mismo archivo si se desea
        if (fileInputRef.current) fileInputRef.current.value = "";
    };

    const handleDownloadTemplate = () => {
        const link = document.createElement('a');
        link.href = '/templates/PLANTILLA_COTIZACION.xlsx';
        link.download = 'PLANTILLA_COTIZACION_SINFIMAC.xlsx';
        link.click();
    };

    const handleMouseDown = (e: React.MouseEvent) => {
        if (isMaximized) return;

        const rect = windowRef.current?.getBoundingClientRect();
        if (rect) {
            setDragOffset({
                x: e.clientX - rect.left,
                y: e.clientY - rect.top
            });
            setIsDragging(true);
        }
    };

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (isDragging && !isMaximized) {
                setPosition({
                    x: e.clientX - dragOffset.x,
                    y: e.clientY - dragOffset.y
                });
            }
        };

        const handleMouseUp = () => {
            setIsDragging(false);
        };

        if (isDragging) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
        }

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isDragging, dragOffset, isMaximized]);

    const handleMaximize = () => {
        setIsMaximized(!isMaximized);
        setIsMinimized(false);
    };

    const handleMinimize = () => {
        setIsMinimized(!isMinimized);
    };

    return (
        <>
            {isMaximized && !isMinimized && <div className={styles.overlay} onClick={onClose} />}

            <div
                ref={windowRef}
                className={`${styles.window} ${isMaximized ? styles.maximized : ''} ${isMinimized ? styles.minimized : ''}`}
                style={
                    isMinimized
                        ? { left: `${20 + (index * 410)}px`, bottom: '20px' }
                        : (!isMaximized ? { left: `${position.x}px`, top: `${position.y}px` } : {})
                }
            >
                <div
                    className={styles.titleBar}
                    onMouseDown={handleMouseDown}
                    style={{ cursor: isMaximized ? 'default' : 'move' }}
                >
                    <div className={styles.titleLeft}>
                        {ticket.cliente?.logo ? (
                            <div className={styles.clientLogoHeader}>
                                <img src={ticket.cliente.logo} alt={ticket.cliente.nombre} />
                            </div>
                        ) : (
                            <div className={styles.ticketIcon}>🎫</div>
                        )}
                        <div className={styles.titleInfo}>
                            <h3>
                                {ticket.numeroTicketCliente
                                    ? ticket.numeroTicketCliente
                                    : `Ticket #${ticket.id.slice(-6)}`
                                }
                            </h3>
                            <span>{ticket.cliente?.nombre || 'Sin cliente'}</span>
                        </div>
                    </div>

                    <div className={`${styles.slaTimerHeader} ${ticketData.pausadoSLA ? styles.paused : ''}`}>
                        <Clock size={14} />
                        <span>{formatElapsedTime()}</span>
                        {ticketData.pausadoSLA && <span className={styles.pausedLabel}>PAUSADO</span>}
                    </div>

                    <div className={styles.windowControls}>
                        <button
                            className={styles.controlBtn}
                            onClick={handleMinimize}
                            title="Minimizar"
                        >
                            <Minimize2 size={16} />
                        </button>
                        <button
                            className={styles.controlBtn}
                            onClick={handleMaximize}
                            title={isMaximized ? "Restaurar" : "Maximizar"}
                        >
                            {isMaximized ? <Square size={14} /> : <Maximize2 size={16} />}
                        </button>
                        <button
                            className={`${styles.controlBtn} ${styles.closeBtn}`}
                            onClick={onClose}
                            title="Cerrar"
                        >
                            <X size={16} />
                        </button>
                    </div>
                </div>

                {!isMinimized && (
                    <div className={styles.windowContent}>
                        <div className={styles.navigatorWrapper}>
                            <TicketStateNavigator
                                currentStateId={ticketData.estadoId || "nuevo"}
                            />
                        </div>

                        <div className={styles.infoHistory}>
                            <InfoBarBase
                                ticket={ticketData}
                                title="Revisión Inicial"
                                icon={FileText}
                                color="#8B5CF6"
                                gradient="linear-gradient(135deg, #F5F3FF, #EDE9FE)"
                            />

                            <TechnicianSchedulingBar
                                ticket={ticketData}
                                onReassign={() => {
                                    // Abrir el drawer sin resetear el estado del ticket
                                    setShowAssignmentDrawer(true);
                                }}
                                onEditSchedule={() => {
                                    setTicketData({ ...ticketData, estadoId: 'en_inspeccion', fechaVisita: undefined });
                                }}
                            />

                            <DiagnosisInfoBar ticket={ticketData} />
                            <QuotationInfoBar ticket={ticketData} />
                            <FinancialLiquidationBar ticket={ticketData} />
                            <UnifiedEvidenceBar ticket={ticketData} />
                            <DocumentationSummaryBar ticket={ticketData} />
                        </div>

                        <div className={styles.operationalArea}>
                            {children || (
                                <>
                                    {ticketData.estadoId === "nuevo" && (
                                        <div className={styles.stepActions}>
                                            <p className={styles.stepHint}>
                                                Revise la información y proceda a la asignación del especialista.
                                            </p>
                                            <button className={styles.mainActionBtn} onClick={handleProceedToAssignment}>
                                                <span>Asignar Técnico</span>
                                                <ArrowRight size={18} />
                                            </button>
                                        </div>
                                    )}

                                    {ticketData.estadoId === "esperando_pago_visita" && (
                                        <div className={styles.stepPlaceholder}>
                                            <div className={styles.advanceRequestCard}>
                                                <div className={styles.advanceHeader}>
                                                    <div className={styles.titleIcon} style={{ background: '#F59E0B' }}>
                                                        <Coins size={20} />
                                                    </div>
                                                    <div className={styles.advanceTitleGroup}>
                                                        <h4>ORDEN DE PAGO: VISITA TÉCNICA</h4>
                                                        <span>Requiere confirmación de Gerencia</span>
                                                    </div>
                                                    <div className={styles.advanceAmountBadge}>
                                                        S/ {parseFloat(ticketData.costoVisita || 0).toFixed(2)}
                                                    </div>
                                                </div>

                                                <div className={styles.techBankDetails}>
                                                    <div className={styles.bankRow}>
                                                        <strong>Técnico:</strong>
                                                        <span>{ticketData.tecnico?.nombre} {ticketData.tecnico?.apellido}</span>
                                                    </div>
                                                    <div className={styles.bankRow}>
                                                        <strong>Banco:</strong>
                                                        <span>{ticketData.tecnico?.banco || '---'}</span>
                                                    </div>
                                                    <div className={styles.bankRow}>
                                                        <strong>Nº Cuenta:</strong>
                                                        <span>{ticketData.tecnico?.numeroCuenta || '---'}</span>
                                                    </div>
                                                    <div className={styles.bankRow}>
                                                        <strong>CCI:</strong>
                                                        <span>{ticketData.tecnico?.cci || '---'}</span>
                                                    </div>
                                                    {(ticketData.tecnico?.yape || ticketData.tecnico?.plin) && (
                                                        <div className={styles.bankRow} style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid #E2E8F0' }}>
                                                            <strong>Billeteras:</strong>
                                                            <div style={{ display: 'flex', gap: '10px' }}>
                                                                {ticketData.tecnico?.yape && <span style={{ color: '#7C3AED' }}>Yape: {ticketData.tecnico.yape}</span>}
                                                                {ticketData.tecnico?.plin && <span style={{ color: '#00D1FF' }}>Plin: {ticketData.tecnico.plin}</span>}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>

                                                {userRole === 'admin' ? (
                                                    <button className={styles.confirmAdvanceBtn} onClick={handleConfirmVisitPayment}>
                                                        <CheckCircle size={18} />
                                                        CONFIRMAR QUE GERENCIA YA PAGÓ LA VISITA
                                                    </button>
                                                ) : (
                                                    <div className={styles.adminOnlyMessage}>
                                                        <Clock size={18} />
                                                        <span>Esperando que el Administrador confirme el depósito</span>
                                                    </div>
                                                )}

                                                <div className={styles.bankNote}>
                                                    * Solo el Administrador puede confirmar depósitos bancarios.
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {ticketData.estadoId === "en_inspeccion" && (
                                        <div className={styles.stepPlaceholder}>
                                            <div className={styles.schedulingBox}>
                                                <div className={styles.schedulingHeader}>
                                                    <Calendar size={28} color="#8B5CF6" />
                                                    <div style={{ textAlign: 'left' }}>
                                                        <h3 style={{ margin: 0, fontSize: '18px', color: '#1F2937' }}>Agendar Visita Técnica</h3>
                                                        <p style={{ margin: '4px 0 0 0', fontSize: '14px', color: '#6B7280' }}>
                                                            Seleccione la fecha de ejecución acordada
                                                        </p>
                                                    </div>
                                                </div>

                                                <div className={styles.scheduleOptions}>
                                                    <button
                                                        className={styles.scheduleOptionBtn}
                                                        onClick={() => {
                                                            const today = new Date();
                                                            const updated = {
                                                                ...ticketData,
                                                                fechaVisita: today.toISOString(),
                                                                programacionLabel: "HOY",
                                                                estadoId: "visita_realizada"
                                                            };
                                                            setTicketData(updated);
                                                        }}
                                                    >
                                                        <span className={styles.optLabel}>HOY</span>
                                                        <span className={styles.optDate}>
                                                            {new Date().toLocaleDateString('es-PE', { day: '2-digit', month: 'long' })}
                                                        </span>
                                                    </button>

                                                    <button
                                                        className={styles.scheduleOptionBtn}
                                                        onClick={() => {
                                                            const tomorrow = new Date();
                                                            tomorrow.setDate(tomorrow.getDate() + 1);
                                                            const updated = {
                                                                ...ticketData,
                                                                fechaVisita: tomorrow.toISOString(),
                                                                programacionLabel: "MAÑANA",
                                                                estadoId: "visita_realizada"
                                                            };
                                                            setTicketData(updated);
                                                        }}
                                                    >
                                                        <span className={styles.optLabel}>MAÑANA</span>
                                                        <span className={styles.optDate}>
                                                            {new Date(Date.now() + 86400000).toLocaleDateString('es-PE', { day: '2-digit', month: 'long' })}
                                                        </span>
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {ticketData.estadoId === "visita_realizada" && (
                                        <div className={styles.reportFormBox}>
                                            <div className={styles.reportHeader}>
                                                <div className={styles.headerTitleRow}>
                                                    <ClipboardCheck size={24} className={styles.optimisticIcon} />
                                                    <div style={{ textAlign: 'left' }}>
                                                        <h3 className={styles.reportMainTitle}>Reporte Técnico de Campo</h3>
                                                        <p className={styles.reportSubtitle}>Evaluación técnica y solución propuesta</p>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className={styles.diagnosticoArea}>
                                                <label className={styles.optimisticLabel}>Diagnóstico Técnico Final</label>
                                                <textarea
                                                    placeholder="Describa el hallazgo y la solución técnica..."
                                                    value={diagnostico}
                                                    onChange={(e) => setDiagnostico(e.target.value)}
                                                    className={styles.formTextareaOptimistic}
                                                />
                                            </div>

                                            <div className={styles.compactSettingsGrid}>
                                                <div className={styles.settingsRow}>
                                                    <div className={styles.formGroupCompact}>
                                                        <label>Modalidad de Trabajo</label>
                                                        <div className={styles.modalityToggleOptimistic}>
                                                            <div
                                                                className={`${styles.modalityItemOptimistic} ${modalidad === 'todo_costo' ? styles.modalityActiveTodoCosto : ''}`}
                                                                onClick={() => setModalidad('todo_costo')}
                                                            >
                                                                <Package size={16} />
                                                                <span>Todo Costo</span>
                                                            </div>
                                                            <div
                                                                className={`${styles.modalityItemOptimistic} ${modalidad === 'desagregado' ? styles.modalityActiveDesagregado : ''}`}
                                                                onClick={() => setModalidad('desagregado')}
                                                            >
                                                                <Split size={16} />
                                                                <span>Por Partes</span>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className={styles.formGroupCompact}>
                                                        <label>Adjuntos</label>
                                                        <div className={styles.thumbnailsWrapper}>
                                                            {evidenciasCampo.length > 0 ? (
                                                                evidenciasCampo.map((evidence, idx) => (
                                                                    <div key={idx} className={styles.uploadBoxMini} title={evidence.name}>
                                                                        <img src={evidence.url} alt="evidencia" />
                                                                    </div>
                                                                ))
                                                            ) : (
                                                                <div
                                                                    className={styles.uploadBoxMini}
                                                                    onClick={() => fieldEvidenceRef.current?.click()}
                                                                    style={{ cursor: 'pointer' }}
                                                                >
                                                                    <Camera size={20} />
                                                                    <span style={{ fontSize: '0.65rem', fontWeight: 700 }}>FOTOS</span>
                                                                </div>
                                                            )}
                                                            {/* Botón flotante para agregar más si ya hay fotos */}
                                                            {evidenciasCampo.length > 0 && (
                                                                <div
                                                                    className={styles.uploadBoxMini}
                                                                    onClick={() => fieldEvidenceRef.current?.click()}
                                                                    style={{ cursor: 'pointer', background: '#F1F5F9' }}
                                                                >
                                                                    <Plus size={20} />
                                                                </div>
                                                            )}
                                                            <input
                                                                type="file"
                                                                multiple
                                                                accept="image/*"
                                                                ref={fieldEvidenceRef}
                                                                style={{ display: 'none' }}
                                                                onChange={handleFieldEvidenceUpload}
                                                            />
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className={styles.settingsRow}>
                                                    <div className={styles.formGroupCompact}>
                                                        <label>{modalidad === 'todo_costo' ? 'Monto Total Estimado' : 'Mano de Obra'}</label>
                                                        <div className={styles.inputWithIconOptimistic}>
                                                            <span className={styles.currencyPrefix}>S/</span>
                                                            <input
                                                                type="number"
                                                                step="0.01"
                                                                placeholder="0.00"
                                                                value={costoManoObra}
                                                                onChange={(e) => setCostoManoObra(e.target.value)}
                                                            />
                                                        </div>
                                                    </div>

                                                    {modalidad === 'desagregado' && (
                                                        <div className={styles.formGroupCompact}>
                                                            <label>Costo Materiales</label>
                                                            <div className={styles.inputWithIconOptimistic}>
                                                                <span className={styles.currencyPrefix}>S/</span>
                                                                <input
                                                                    type="number"
                                                                    step="0.01"
                                                                    placeholder="0.00"
                                                                    value={costoMateriales}
                                                                    onChange={(e) => setCostoMateriales(e.target.value)}
                                                                />
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            <div className={styles.formActionsOptimistic}>
                                                <button
                                                    className={styles.sendReportBtnOptimistic}
                                                    onClick={handleSendFieldReport}
                                                >
                                                    <span>FINALIZAR REPORTE TÉCNICO</span>
                                                    <ArrowRight size={18} />
                                                </button>
                                            </div>
                                        </div>
                                    )}

                                    {(ticketData.estadoId === "en_cotizacion" || ["cotizacion_aprobada", "en_ejecucion", "documentacion_enviada", "por_liquidar", "pago_realizado", "ticket_cerrado"].includes(ticketData.estadoId)) && (
                                        <div className={`${styles.quotationBox} ${isQuotationCollapsed && ticketData.estadoId !== "en_cotizacion" ? styles.collapsedQuotation : ''}`}>
                                            <div className={styles.quotationHeader} onClick={() => ticketData.estadoId !== "en_cotizacion" && setIsQuotationCollapsed(!isQuotationCollapsed)}>
                                                <FileSpreadsheet size={28} color="#10B981" />
                                                <div style={{ textAlign: 'left', flex: 1 }}>
                                                    <h3 className={styles.quotationTitle}>
                                                        {ticketData.estadoId === "en_cotizacion" ? "Elaboración de Cotización Formal" : "Cotización Aprobada y Registrada"}
                                                    </h3>
                                                    <p className={styles.quotationSubtitle}>
                                                        {ticketData.estadoId === "en_cotizacion"
                                                            ? "Prepare el presupuesto final usando la plantilla oficial"
                                                            : isQuotationCollapsed ? "Pulse para ver detalles de la cotización" : "Documento oficial del servicio. Los cambios requieren autorización."
                                                        }
                                                    </p>
                                                </div>

                                                {["cotizacion_aprobada", "en_ejecucion", "documentacion_enviada", "por_liquidar", "pago_realizado", "ticket_cerrado"].includes(ticketData.estadoId) && (
                                                    <div className={styles.headerRightActions}>
                                                        {!ticketData.modificacionAutorizada && (
                                                            <div className={styles.lockedBadge}>
                                                                <X size={14} />
                                                                BLOQUEADA
                                                            </div>
                                                        )}
                                                        {ticketData.modificacionAutorizada && (
                                                            <div className={styles.authorizedBadge}>
                                                                <CheckCircle size={14} />
                                                                AUTORIZADA
                                                            </div>
                                                        )}
                                                        <button
                                                            className={styles.collapseToggleBtn}
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setIsQuotationCollapsed(!isQuotationCollapsed);
                                                            }}
                                                        >
                                                            {isQuotationCollapsed ? "Mostrar Detalles" : "Ocultar Detalles"}
                                                        </button>
                                                    </div>
                                                )}
                                            </div>

                                            {(!isQuotationCollapsed || ticketData.estadoId === "en_cotizacion") && (
                                                <div className={styles.quotationLayout}>
                                                    <div className={styles.quotationSidebar}>
                                                        <div className={styles.budgetSummaryCard}>
                                                            <h4 className={styles.summaryTitle}>Meta de Rentabilidad</h4>
                                                            <div className={styles.profitabilityGrid}>
                                                                <div className={styles.techCostCard}>
                                                                    <span className={styles.techCostLabel}>PRESUPUESTO TÉCNICO</span>
                                                                    <div className={styles.techCostDetail}>
                                                                        <div className={styles.techRow}>
                                                                            <label>Mano de Obra:</label>
                                                                            <span>S/ {parseFloat(ticketData.costoManoObra || 0).toFixed(2)}</span>
                                                                        </div>
                                                                        <div className={styles.techRow}>
                                                                            <label>Materiales:</label>
                                                                            <span>S/ {parseFloat(ticketData.costoMateriales || 0).toFixed(2)}</span>
                                                                        </div>
                                                                        {parseFloat(ticketData.costoVisita || 0) > 0 && (
                                                                            <div className={styles.techRow}>
                                                                                <label>Gasto de Visita:</label>
                                                                                <span>S/ {parseFloat(ticketData.costoVisita || 0).toFixed(2)}</span>
                                                                            </div>
                                                                        )}
                                                                        <div className={styles.techRowTotal}>
                                                                            <label>Costo Directo Total:</label>
                                                                            <strong>S/ {(parseFloat(ticketData.costoManoObra || 0) + parseFloat(ticketData.costoMateriales || 0) + parseFloat(ticketData.costoVisita || 0)).toFixed(2)}</strong>
                                                                        </div>
                                                                    </div>
                                                                </div>

                                                                <div className={styles.suggestedTotal}>
                                                                    <span>PRECIO OBJETIVO (55% MARGEN)</span>
                                                                    <div className={styles.suggestedValue}>
                                                                        S/ {((parseFloat(ticketData.costoManoObra || 0) + parseFloat(ticketData.costoMateriales || 0) + parseFloat(ticketData.costoVisita || 0)) / 0.45).toFixed(2)}
                                                                    </div>
                                                                </div>

                                                                <div className={styles.missingAmountCard}>
                                                                    <div className={styles.missingHeader}>
                                                                        <span>CUMPLIMIENTO DE META</span>
                                                                        <strong>
                                                                            {((montoTotalCotizado / (((parseFloat(ticketData.costoManoObra || 0) + parseFloat(ticketData.costoMateriales || 0) + parseFloat(ticketData.costoVisita || 0)) / 0.45) || 1)) * 100).toFixed(0)}%
                                                                        </strong>
                                                                    </div>
                                                                    <div className={styles.missingValue}>
                                                                        {(() => {
                                                                            const totalCostoTecnico = (parseFloat(ticketData.costoManoObra || 0) + parseFloat(ticketData.costoMateriales || 0) + parseFloat(ticketData.costoVisita || 0));
                                                                            const meta55 = totalCostoTecnico / 0.45;

                                                                            if (montoTotalCotizado < totalCostoTecnico) {
                                                                                return (
                                                                                    <div className={styles.lossWarning}>
                                                                                        <div className={styles.lossTitle}>
                                                                                            <X size={16} /> {/* O AlertTriangle si estuviera importado, pero X está disponible */}
                                                                                            <span>⚠️ PERDIDA DETECTADA</span>
                                                                                        </div>
                                                                                        <span className={styles.lossValue}>
                                                                                            El presupuesto es menor al costo técnico (S/ {totalCostoTecnico.toFixed(2)})
                                                                                        </span>
                                                                                    </div>
                                                                                );
                                                                            }

                                                                            if (montoTotalCotizado < meta55) {
                                                                                return (
                                                                                    <>
                                                                                        <span className={styles.missingLabel}>FALTAN PARA META 55%:</span>
                                                                                        <strong className={styles.missingAmount}>
                                                                                            S/ {(meta55 - montoTotalCotizado).toFixed(2)}
                                                                                        </strong>
                                                                                    </>
                                                                                );
                                                                            }

                                                                            return (
                                                                                <div className={styles.goalReached}>
                                                                                    <CheckCircle size={14} />
                                                                                    <span>META ALCANZADA</span>
                                                                                </div>
                                                                            );
                                                                        })()}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                            {ticketData.estadoId === "en_cotizacion" && (
                                                                <p className={styles.profitabilityHint}>
                                                                    💡 Ajuste los precios en el editor de la derecha para cubrir el costo técnico y alcanzar el margen operativo sugerido.
                                                                </p>
                                                            )}

                                                            {["cotizacion_aprobada", "en_ejecucion", "documentacion_enviada", "por_liquidar", "pago_realizado", "ticket_cerrado"].includes(ticketData.estadoId) && !ticketData.modificacionAutorizada && (
                                                                <div className={styles.authorizationSection}>
                                                                    <div className={styles.authLockIcon}>🔒</div>
                                                                    <p className={styles.authText}>
                                                                        La cotización ya fue aprobada por el cliente. Para realizar cambios, se requiere el visto bueno de Gerencia.
                                                                    </p>
                                                                    <button
                                                                        className={styles.authorizeBtn}
                                                                        onClick={handleAuthorizeModification}
                                                                    >
                                                                        Autorizar Modificación
                                                                    </button>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>

                                                    <div className={styles.quotationMainEditor}>
                                                        <OnlineQuotationEditor
                                                            ref={quotationEditorRef}
                                                            isLocked={["cotizacion_aprobada", "en_ejecucion", "documentacion_enviada", "por_liquidar", "pago_realizado", "ticket_cerrado"].includes(ticketData.estadoId) && !ticketData.modificacionAutorizada}
                                                            clientInfo={ticketData.cliente}
                                                            sedeInfo={ticketData.sede}
                                                            servicioId={ticketData.servicioId}
                                                            ticketId={ticketData.numeroTicketCliente || ticketData.id}
                                                            initialItems={partidasCotizacion}
                                                            suggestedTotal={(parseFloat(ticketData.costoManoObra || 0) + parseFloat(ticketData.costoMateriales || 0) + parseFloat(ticketData.costoVisita || 0)) / 0.45}
                                                            onUpdate={(items: any[], total: number) => {
                                                                setPartidasCotizacion(items);
                                                                setMontoTotalCotizado(total);
                                                            }}
                                                        />

                                                        <div className={styles.finalActionsOptimistic}>
                                                            {ticketData.estadoId === "en_cotizacion" ? (
                                                                <button
                                                                    className={styles.sendQuoteBtnFinal}
                                                                    disabled={montoTotalCotizado <= 0}
                                                                    onClick={handleSendQuote}
                                                                >
                                                                    <Send size={18} />
                                                                    <span>ENVIAR PRESUPUESTO FORMAL AL CLIENTE</span>
                                                                </button>
                                                            ) : ticketData.modificacionAutorizada ? (
                                                                <button
                                                                    className={styles.saveChangesBtn}
                                                                    onClick={() => {
                                                                        setTicketData({
                                                                            ...ticketData,
                                                                            modificacionAutorizada: false,
                                                                            montoFinal: montoTotalCotizado,
                                                                            partidas: partidasCotizacion,
                                                                            fechaUltimaModificacion: new Date().toISOString()
                                                                        });
                                                                        alert("Cambios guardados y cotización bloqueada nuevamente.");
                                                                    }}
                                                                >
                                                                    <CheckCircle size={18} />
                                                                    <span>GUARDAR CAMBIOS Y VOLVER A BLOQUEAR</span>
                                                                </button>
                                                            ) : (
                                                                <div className={styles.readonlyNotice}>
                                                                    La cotización se encuentra en modo lectura.
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {ticketData.estadoId === "cotizacion_enviada" && (
                                        <div className={styles.successStepBox}>
                                            <div className={styles.successIconAnim}>✅</div>
                                            <h3 className={styles.successTitleFormal}>Cotización Enviada con Éxito</h3>
                                            <p className={styles.successDescFormal}>
                                                El presupuesto formal ha sido enviado al correo del cliente.
                                                <br />El ticket entrará en pausa hasta recibir la aprobación o solicitud de ajuste.
                                            </p>
                                            <div className={styles.waitingBadge}>
                                                <Clock size={14} />
                                                <span>ESPERANDO APROBACIÓN DEL CLIENTE</span>
                                            </div>
                                            <div className={styles.waitingActions}>
                                                <button className={styles.approveQuoteBtn} onClick={handleApproveQuote}>
                                                    <ThumbsUp size={18} />
                                                    <span>REGISTRAR APROBACIÓN DEL CLIENTE</span>
                                                </button>
                                                <button className={styles.backToQuoteBtn} onClick={() => setTicketData({ ...ticketData, estadoId: 'en_cotizacion' })}>
                                                    Corregir Presupuesto o Reenviar
                                                </button>
                                            </div>
                                        </div>
                                    )}

                                    {["cotizacion_aprobada", "en_ejecucion"].includes(ticketData.estadoId) && (
                                        <div className={styles.stepActions}>
                                            {ticketData.estadoId === "cotizacion_aprobada" && (
                                                <div className={styles.approvedStatusNotice}>
                                                    <div className={styles.approvedIcon}>🎉</div>
                                                    <h3 style={{ margin: 0, color: '#065F46' }}>¡Presupuesto Aprobado!</h3>
                                                    <p style={{ margin: '8px 0 20px 0', fontSize: '14px', color: '#059669' }}>
                                                        {ticketData.adelantoPagado
                                                            ? "El depósito técnico ha sido realizado. Puede proceder con la ejecución."
                                                            : "Se requiere confirmar el depósito del técnico para iniciar el servicio."
                                                        }
                                                    </p>

                                                    <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
                                                        {!ticketData.adelantoPagado && (
                                                            <div className={styles.negotiationWrapper}>
                                                                {!ticketData.costoAjustadoPostAprobacion && !ticketData.omitirAjusteTecnico ? (
                                                                    <div className={styles.negotiationCard}>
                                                                        <div className={styles.negotiationIcon}>🤝</div>
                                                                        <h4>Negociación con Técnico</h4>
                                                                        <p>El presupuesto ha sido aprobado por el cliente. ¿Desea ajustar el costo con el técnico antes de generar el adelanto?</p>
                                                                        <div className={styles.negotiationActions}>
                                                                            <button className={styles.adjustBtn} onClick={handleAdjustTechnicianCost}>
                                                                                <DollarSign size={16} />
                                                                                SI, REAJUSTAR COSTO
                                                                            </button>
                                                                            <button className={styles.keepBtn} onClick={() => setTicketData({ ...ticketData, omitirAjusteTecnico: true })}>
                                                                                <CheckCircle size={16} />
                                                                                NO, MANTENER COSTO
                                                                            </button>
                                                                        </div>
                                                                    </div>
                                                                ) : (
                                                                    <div className={styles.advanceRequestCard}>
                                                                        <div className={styles.advanceHeader}>
                                                                            <div className={styles.advanceTitleGroup}>
                                                                                <h4>Orden de Adelanto</h4>
                                                                                <span>Pago operativo para el técnico</span>
                                                                                {ticketData.costoAjustadoPostAprobacion && (
                                                                                    <span className={styles.adjustedBadge}>¡COSTO REAJUSTADO!</span>
                                                                                )}
                                                                            </div>
                                                                            <div className={styles.percentageSelector}>
                                                                                {[0.4, 0.5, 0.6].map(p => (
                                                                                    <button
                                                                                        key={p}
                                                                                        className={`${styles.pctBtn} ${porcentajeAdelanto === p ? styles.pctActive : ''}`}
                                                                                        onClick={() => setPorcentajeAdelanto(p)}
                                                                                    >
                                                                                        {(p * 100).toFixed(0)}%
                                                                                    </button>
                                                                                ))}
                                                                            </div>
                                                                        </div>

                                                                        <div className={styles.techBankDetails}>
                                                                            <div className={styles.bankRow}>
                                                                                <strong>Técnico:</strong>
                                                                                <span>{ticketData.tecnico?.nombre} {ticketData.tecnico?.apellido}</span>
                                                                            </div>
                                                                            <div className={styles.bankRow}>
                                                                                <strong>Banco:</strong>
                                                                                <span>{ticketData.tecnico?.banco || '---'}</span>
                                                                            </div>
                                                                            <div className={styles.bankRow}>
                                                                                <strong>Nº Cuenta:</strong>
                                                                                <span>{ticketData.tecnico?.numeroCuenta || '---'}</span>
                                                                            </div>
                                                                            <div className={styles.bankRow}>
                                                                                <strong>CCI:</strong>
                                                                                <span>{ticketData.tecnico?.cci || '---'}</span>
                                                                            </div>
                                                                            {(ticketData.tecnico?.yape || ticketData.tecnico?.plin) && (
                                                                                <div className={styles.bankRow} style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid #E2E8F0' }}>
                                                                                    <strong>Billeteras:</strong>
                                                                                    <div style={{ display: 'flex', gap: '10px' }}>
                                                                                        {ticketData.tecnico?.yape && <span style={{ color: '#7C3AED' }}>Yape: {ticketData.tecnico.yape}</span>}
                                                                                        {ticketData.tecnico?.plin && <span style={{ color: '#00D1FF' }}>Plin: {ticketData.tecnico.plin}</span>}
                                                                                    </div>
                                                                                </div>
                                                                            )}
                                                                            <div className={styles.bankRow}>
                                                                                <strong>Monto Base Re-pactado:</strong>
                                                                                <span style={{ color: '#10B981', fontWeight: 800 }}>S/ {(parseFloat(ticketData.costoManoObra || 0) + parseFloat(ticketData.costoMateriales || 0)).toFixed(2)}</span>
                                                                            </div>
                                                                        </div>

                                                                        {userRole === 'admin' ? (
                                                                            <button className={styles.confirmAdvanceBtn} onClick={handleConfirmAdvance}>
                                                                                <Wallet size={18} />
                                                                                <span>CONFIRMAR DEPÓSITO S/ {((parseFloat(ticketData.costoManoObra || 0) + parseFloat(ticketData.costoMateriales || 0)) * porcentajeAdelanto).toFixed(2)}</span>
                                                                            </button>
                                                                        ) : (
                                                                            <div className={styles.adminOnlyMessage}>
                                                                                <Clock size={18} />
                                                                                <span>Esperando confirmación de Gerencia</span>
                                                                            </div>
                                                                        )}
                                                                        <p className={styles.bankNote}>⚠️ Solo el Administrador puede confirmar transferencias.</p>

                                                                        {ticketData.costoAjustadoPostAprobacion && (
                                                                            <button className={styles.resetNegotiationBtn} onClick={() => setTicketData({ ...ticketData, costoAjustadoPostAprobacion: false, costoManoObra: ticketData.costoAnteriorTecnico, costoMateriales: 0 })}>
                                                                                Deshacer Reajuste
                                                                            </button>
                                                                        )}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )}

                                                        {ticketData.adelantoPagado && (
                                                            <button className={styles.startExecutionBtn} onClick={handleProceedToExecution}>
                                                                <Hammer size={24} />
                                                                <span>INICIAR EJECUCIÓN EN SEDE</span>
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            )}

                                            {ticketData.estadoId === "en_ejecucion" && (
                                                <div className={styles.executionContainer}>
                                                    <div className={styles.executionHeader}>
                                                        <Hammer size={32} />
                                                        <div style={{ textAlign: 'left' }}>
                                                            <h3 style={{ margin: 0, fontSize: '1.2rem' }}>Trabajos en Ejecución</h3>
                                                            <p style={{ margin: '4px 0 0 0', opacity: 0.9 }}>Sede: {ticketData.sede?.nombre}</p>
                                                        </div>
                                                    </div>

                                                    <div className={styles.executionMainGrid}>
                                                        <div className={styles.executionCard}>
                                                            <h4><Package size={18} /> GASTOS Y MATERIALES (FACTURAS/COMPRAS)</h4>
                                                            <div className={styles.expenseEntryRow}>
                                                                <input
                                                                    type="text"
                                                                    placeholder="Concepto (ej: Factura Pintura)"
                                                                    className={styles.expenseInput}
                                                                    value={newExpense.concepto}
                                                                    onChange={(e) => setNewExpense({ ...newExpense, concepto: e.target.value })}
                                                                />
                                                                <input
                                                                    type="number"
                                                                    placeholder="Monto"
                                                                    className={styles.expenseInput}
                                                                    value={newExpense.monto}
                                                                    onChange={(e) => setNewExpense({ ...newExpense, monto: e.target.value })}
                                                                />
                                                                <select
                                                                    className={styles.expenseInput}
                                                                    value={newExpense.tipo}
                                                                    onChange={(e) => setNewExpense({ ...newExpense, tipo: e.target.value })}
                                                                >
                                                                    <option>Gasto Operativo</option>
                                                                    <option>Compra Material</option>
                                                                    <option>Factura Técnico</option>
                                                                </select>
                                                                <button className={styles.addExpenseBtn} onClick={handleAddExpense}><Plus size={16} /></button>
                                                            </div>

                                                            {gastos.length > 0 && (
                                                                <table className={styles.expenseTable}>
                                                                    <thead>
                                                                        <tr>
                                                                            <th>Concepto</th>
                                                                            <th>Tipo</th>
                                                                            <th>Monto</th>
                                                                        </tr>
                                                                    </thead>
                                                                    <tbody>
                                                                        {gastos.map((g: any) => (
                                                                            <tr key={g.id}>
                                                                                <td>{g.concepto}</td>
                                                                                <td>{g.tipo}</td>
                                                                                <td style={{ fontWeight: 800 }}>S/ {g.monto.toFixed(2)}</td>
                                                                            </tr>
                                                                        ))}
                                                                    </tbody>
                                                                </table>
                                                            )}
                                                        </div>

                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                                                            <div className={`${styles.executionCard} ${styles.extraAdvanceRequest}`}>
                                                                <h4><Coins size={18} /> GESTIÓN DE ANTICIPOS</h4>
                                                                {!ticketData.solicitudAdelantoExtra ? (
                                                                    <>
                                                                        <p style={{ fontSize: '0.8rem', color: '#92400E' }}>La Gestora envía la petición al Gerente para fondos extra.</p>
                                                                        <button className={styles.extraAdvanceBtn} onClick={handleRequestExtraAdvance}>
                                                                            <Wallet size={16} />
                                                                            SOLICITAR ADELANTO AL GERENTE
                                                                        </button>
                                                                    </>
                                                                ) : (
                                                                    <div className={styles.pendingAdvanceBox}>
                                                                        <div className={styles.pendingBadge}>ESPERANDO DEPÓSITO</div>
                                                                        <p style={{ fontSize: '0.75rem', fontWeight: 700, color: '#92400E' }}>Monto solicitado: S/ {ticketData.solicitudAdelantoExtra.monto.toFixed(2)}</p>
                                                                        <button className={styles.confirmManagerDepositBtn} onClick={handleConfirmExtraAdvance}>
                                                                            <CheckCircle size={14} />
                                                                            CONFIRMAR QUE GERENTE YA DEPOSITÓ
                                                                        </button>
                                                                        <button className={styles.cancelRequestBtn} onClick={() => setTicketData({ ...ticketData, solicitudAdelantoExtra: null })}>
                                                                            Cancelar Petición
                                                                        </button>
                                                                    </div>
                                                                )}
                                                            </div>

                                                            <div className={styles.executionCard}>
                                                                <h4><Camera size={18} /> EVIDENCIAS (DURANTE Y DESPUÉS)</h4>
                                                                <div className={styles.evidenceGridExecution}>
                                                                    {evidenciasEjecucion.map((ev, idx) => (
                                                                        <div key={idx} className={styles.evidenceThumbExecution}>
                                                                            <img src={ev.url} alt={`Evidencia ${idx + 1}`} />
                                                                            <button
                                                                                className={styles.removeEvidenceBtn}
                                                                                onClick={() => {
                                                                                    const updated = evidenciasEjecucion.filter((_, i) => i !== idx);
                                                                                    setEvidenciasEjecucion(updated);
                                                                                    setTicketData({ ...ticketData, evidenciasEjecucion: updated });
                                                                                }}
                                                                            >
                                                                                <X size={12} />
                                                                            </button>
                                                                        </div>
                                                                    ))}
                                                                    <div
                                                                        className={styles.dropZoneExecution}
                                                                        onClick={() => fileInputRef.current?.click()}
                                                                    >
                                                                        <Upload size={20} />
                                                                        <span style={{ fontSize: '0.65rem' }}>Adjuntar Foto</span>
                                                                        <input
                                                                            type="file"
                                                                            ref={fileInputRef}
                                                                            style={{ display: 'none' }}
                                                                            accept="image/*"
                                                                            multiple
                                                                            onChange={handleFileChange}
                                                                        />
                                                                    </div>
                                                                </div>
                                                                <p style={{ fontSize: '0.7rem', color: '#64748B', marginTop: '8px' }}>
                                                                    * Mínimo 2 fotos obligatorias para finalizar.
                                                                </p>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <button
                                                        className={styles.finishWorkBtn}
                                                        onClick={handleFinishExecution}
                                                        disabled={evidenciasEjecucion.length < 2}
                                                    >
                                                        <CheckCircle size={20} />
                                                        FINALIZAR TODOS LOS TRABAJOS Y ENVIAR DOCUMENTACIÓN
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {ticketData.estadoId === "documentacion_enviada" && (
                                        <div className={styles.checklistContainer}>
                                            <div className={styles.checklistCard}>
                                                <div className={styles.checklistHeader}>
                                                    <ClipboardCheck size={32} color="#6366F1" />
                                                    <div style={{ textAlign: 'left' }}>
                                                        <h3 className={styles.checklistTitle}>Checklist de Cierre y Documentación</h3>
                                                        <p className={styles.checklistSubtitle}>Valide los documentos obligatorios para proceder a la liquidación</p>
                                                    </div>
                                                </div>

                                                <div className={styles.checklistGrid}>
                                                    <div
                                                        className={`${styles.checkItem} ${documentosChecklist.actaConformidad ? styles.checkItemActive : ''}`}
                                                        onClick={() => setDocumentosChecklist(prev => ({ ...prev, actaConformidad: !prev.actaConformidad }))}
                                                    >
                                                        <div className={styles.checkSquare}>
                                                            {documentosChecklist.actaConformidad && <CheckCircle2 size={18} />}
                                                        </div>
                                                        <div className={styles.checkText}>
                                                            <strong>1. ACTA DE CONFORMIDAD FIRMADA</strong>
                                                            <span>Sustento de recepción del cliente</span>
                                                        </div>
                                                    </div>

                                                    <div
                                                        className={`${styles.checkItem} ${documentosChecklist.ats ? styles.checkItemActive : ''}`}
                                                        onClick={() => setDocumentosChecklist(prev => ({ ...prev, ats: !prev.ats }))}
                                                    >
                                                        <div className={styles.checkSquare}>
                                                            {documentosChecklist.ats && <CheckCircle2 size={18} />}
                                                        </div>
                                                        <div className={styles.checkText}>
                                                            <strong>2. ATS LLENADA Y FIRMADA</strong>
                                                            <span>Seguridad y Salud en el Trabajo</span>
                                                        </div>
                                                    </div>

                                                    <div
                                                        className={`${styles.checkItem} ${documentosChecklist.declaracionJurada ? styles.checkItemActive : ''}`}
                                                        onClick={() => setDocumentosChecklist(prev => ({ ...prev, declaracionJurada: !prev.declaracionJurada }))}
                                                    >
                                                        <div className={styles.checkSquare}>
                                                            {documentosChecklist.declaracionJurada && <CheckCircle2 size={18} />}
                                                        </div>
                                                        <div className={styles.checkText}>
                                                            <strong>3. DECLARACIÓN JURADA</strong>
                                                            <span>Conformidad administrativa</span>
                                                        </div>
                                                    </div>

                                                    <div
                                                        className={`${styles.checkItem} ${documentosChecklist.excelSeguridad ? styles.checkItemActive : ''}`}
                                                        onClick={() => setDocumentosChecklist(prev => ({ ...prev, excelSeguridad: !prev.excelSeguridad }))}
                                                    >
                                                        <div className={styles.checkSquare}>
                                                            {documentosChecklist.excelSeguridad && <CheckCircle2 size={18} />}
                                                        </div>
                                                        <div className={styles.checkText}>
                                                            <strong>4. EXCEL DE SEGURIDAD</strong>
                                                            <span>Reporte de condiciones de seguridad</span>
                                                        </div>
                                                    </div>

                                                    {/* Nuevo Item: Número de Ticket del Cliente */}
                                                    <div
                                                        className={`${styles.checkItem} ${ticketData.numeroTicketCliente ? styles.checkItemActive : styles.checkItemAlert}`}
                                                        style={{ cursor: 'default' }}
                                                    >
                                                        <div className={styles.checkSquare}>
                                                            {ticketData.numeroTicketCliente ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} color="#EF4444" />}
                                                        </div>
                                                        <div className={styles.checkText}>
                                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                                <strong>5. NÚMERO DE TICKET DEL CLIENTE</strong>
                                                                {ticketData.numeroTicketCliente && (
                                                                    <span style={{ fontSize: '0.65rem', color: '#059669', background: '#DCFCE7', padding: '1px 6px', borderRadius: '4px' }}>VALIDADO</span>
                                                                )}
                                                            </div>
                                                            <input
                                                                type="text"
                                                                className={styles.inlineTicketInput}
                                                                placeholder={`EJ: MB000025.${new Date().getFullYear().toString().slice(-2)}`}
                                                                value={ticketData.numeroTicketCliente || ""}
                                                                autoFocus={!ticketData.numeroTicketCliente}
                                                                onChange={(e) => {
                                                                    const val = e.target.value.toUpperCase().replace(/[^A-Z0-9.]/g, '');
                                                                    setTicketData({ ...ticketData, numeroTicketCliente: val });
                                                                }}
                                                                onClick={(e) => e.stopPropagation()}
                                                            />
                                                            {!ticketData.numeroTicketCliente && (
                                                                <span style={{ color: '#EF4444', fontSize: '0.65rem', fontWeight: 800, marginTop: '4px' }}>
                                                                    ¡OBLIGATORIO: PENDIENTE DE ASIGNAR!
                                                                </span>
                                                            )}
                                                            {ticketData.numeroTicketCliente && !(/^MB\d{6}\.\d{2}$/.test(ticketData.numeroTicketCliente)) && (
                                                                <span style={{ color: '#F59E0B', fontSize: '0.65rem', fontWeight: 700, marginTop: '4px', lineHeight: '1.2' }}>
                                                                    FORMATO REQUERIDO: MB + 6 DÍGITOS + PUNTO + AÑO (26)<br />
                                                                    Ejemplo: MB000025.{new Date().getFullYear().toString().slice(-2)}
                                                                </span>
                                                            )}
                                                            {ticketData.numeroTicketCliente && (/^MB\d{6}\.\d{2}$/.test(ticketData.numeroTicketCliente)) && (
                                                                <span style={{ color: '#059669', fontSize: '0.65rem', fontWeight: 800, marginTop: '4px' }}>
                                                                    ✓ FORMATO VÁLIDO
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>

                                                <button
                                                    className={styles.proceedToLiquidationBtn}
                                                    disabled={!Object.values(documentosChecklist).every(v => v) || !(/^MB\d{6}\.\d{2}$/.test(ticketData.numeroTicketCliente || ""))}
                                                    onClick={() => {
                                                        const updated = {
                                                            ...ticketData,
                                                            estadoId: "por_liquidar",
                                                            fechaValidacionDocumental: new Date().toISOString(),
                                                            documentosValidados: documentosChecklist
                                                        };
                                                        setTicketData(updated);
                                                        alert("¡Documentación validada! El ticket ha pasado a liquidación final.");
                                                    }}
                                                >
                                                    <span>PASAR A LIQUIDACIÓN FINAL</span>
                                                    <ArrowRight size={20} />
                                                </button>

                                                {(!Object.values(documentosChecklist).every(v => v) || !ticketData.numeroTicketCliente) && (
                                                    <p className={styles.checklistAlert}>
                                                        * Todos los documentos y el número de ticket del cliente son obligatorios para continuar.
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    {["por_liquidar", "ticket_cerrado"].includes(ticketData.estadoId) && (
                                        <div className={styles.liquidationContainer}>
                                            <div className={styles.liquidationCard}>
                                                <div className={styles.liquidationHeader} style={ticketData.estadoId === "ticket_cerrado" ? { background: 'linear-gradient(135deg, #065F46, #059669)', color: 'white' } : {}}>
                                                    <div className={styles.liquidationIconBox} style={ticketData.estadoId === "ticket_cerrado" ? { background: 'rgba(255,255,255,0.2)', color: 'white' } : {}}>
                                                        <Calculator size={32} />
                                                    </div>
                                                    <div className={styles.liquidationTitles}>
                                                        <h3 style={ticketData.estadoId === "ticket_cerrado" ? { color: 'white' } : {}}>
                                                            {ticketData.estadoId === "ticket_cerrado" ? "Servicio Concluido y Liquidado" : "Liquidación Final de Servicio"}
                                                        </h3>
                                                        <span style={ticketData.estadoId === "ticket_cerrado" ? { color: 'rgba(255,255,255,0.8)' } : {}}>
                                                            {ticketData.estadoId === "ticket_cerrado" ? "Toda la información financiera ha sido auditada y cerrada." : "Cálculo automático del saldo pendiente para el técnico"}
                                                        </span>
                                                    </div>
                                                    <div className={styles.liquidationTotalBadge}>
                                                        S/ {(parseFloat(ticketData.costoManoObra || 0) + parseFloat(ticketData.costoMateriales || 0)).toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                                                    </div>
                                                </div>

                                                <div className={styles.liquidationGrid}>
                                                    <div className={styles.liquidationItem}>
                                                        <span className={styles.liquidationLabel}>Costo Total Pactado (MO + MAT)</span>
                                                        <span className={styles.liquidationValue}>
                                                            S/ {(parseFloat(ticketData.costoManoObra || 0) + parseFloat(ticketData.costoMateriales || 0)).toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                                                        </span>
                                                    </div>

                                                    <div className={styles.liquidationItem}>
                                                        <span className={styles.liquidationLabel}>Total Depósitos Realizados</span>
                                                        <span className={styles.liquidationValue} style={{ color: '#059669' }}>
                                                            - S/ {(ticketData.historialPagosTecnico || []).reduce((sum: number, p: any) => sum + p.monto, 0).toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                                                        </span>
                                                    </div>

                                                    <div className={styles.liquidationSummary}>
                                                        <div className={styles.summaryRow}>
                                                            <span>{ticketData.estadoId === "ticket_cerrado" ? "TOTAL TRANSFERIDO:" : "SALDO A DEPOSITAR:"}</span>
                                                            <strong>
                                                                S/ {ticketData.estadoId === "ticket_cerrado"
                                                                    ? (ticketData.historialPagosTecnico || []).reduce((sum: number, p: any) => sum + p.monto, 0).toLocaleString('es-PE', { minimumFractionDigits: 2 })
                                                                    : ((parseFloat(ticketData.costoManoObra || 0) + parseFloat(ticketData.costoMateriales || 0)) - (ticketData.historialPagosTecnico || []).reduce((sum: number, p: any) => sum + p.monto, 0)).toLocaleString('es-PE', { minimumFractionDigits: 2 })
                                                                }
                                                            </strong>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className={styles.techBankDetailsLiquidation}>
                                                    <h4>Datos de Pago del Técnico: {ticketData.tecnico?.nombre} {ticketData.tecnico?.apellido}</h4>
                                                    <div className={styles.bankGrid}>
                                                        <div className={styles.bankField}>
                                                            <strong>BANCO:</strong>
                                                            <span>{ticketData.tecnico?.banco || '---'}</span>
                                                        </div>
                                                        <div className={styles.bankField}>
                                                            <strong>NRO. CUENTA:</strong>
                                                            <span>{ticketData.tecnico?.numeroCuenta || '---'}</span>
                                                        </div>
                                                        <div className={styles.bankField}>
                                                            <strong>CCI:</strong>
                                                            <span>{ticketData.tecnico?.cci || '---'}</span>
                                                        </div>
                                                        <div className={styles.bankField} style={{ display: 'flex', flexDirection: 'row', gap: '8px', alignItems: 'center' }}>
                                                            {ticketData.tecnico?.yape && (
                                                                <div className={styles.miniWalletBadge} style={{ background: '#7C3AED' }}>
                                                                    <span>Y</span>
                                                                    <strong>{ticketData.tecnico.yape}</strong>
                                                                </div>
                                                            )}
                                                            {ticketData.tecnico?.plin && (
                                                                <div className={styles.miniWalletBadge} style={{ background: '#00D1FF' }}>
                                                                    <span>P</span>
                                                                    <strong>{ticketData.tecnico.plin}</strong>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className={styles.profitabilityLiquidationCard}>
                                                    <div className={styles.profitHeader}>
                                                        <Sparkles size={20} color="#F59E0B" />
                                                        <h4>Resumen de Rentabilidad Final</h4>
                                                    </div>

                                                    <div className={styles.profitMainGrid}>
                                                        <div className={styles.profitStat}>
                                                            <span className={styles.statLabel}>INGRESO (CLIENTE)</span>
                                                            <span className={styles.statValue}>S/ {(parseFloat(ticketData.montoFinal || 0)).toLocaleString('es-PE', { minimumFractionDigits: 2 })}</span>
                                                        </div>

                                                        <div className={styles.profitStat}>
                                                            <span className={styles.statLabel}>COSTO OPERATIVO</span>
                                                            <span className={styles.statValue} style={{ color: '#EF4444' }}>
                                                                - S/ {(parseFloat(ticketData.costoManoObra || 0) + parseFloat(ticketData.costoMateriales || 0) + parseFloat(ticketData.costoVisita || 0)).toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                                                            </span>
                                                        </div>

                                                        <div className={`${styles.profitStat} ${styles.highlightedStat}`}>
                                                            <span className={styles.statLabel}>UTILIDAD BRUTA</span>
                                                            <span className={styles.statValue} style={{ color: (parseFloat(ticketData.montoFinal || 0) - (parseFloat(ticketData.costoManoObra || 0) + parseFloat(ticketData.costoMateriales || 0) + parseFloat(ticketData.costoVisita || 0))) >= 0 ? '#10B981' : '#EF4444' }}>
                                                                S/ {(parseFloat(ticketData.montoFinal || 0) - (parseFloat(ticketData.costoManoObra || 0) + parseFloat(ticketData.costoMateriales || 0) + parseFloat(ticketData.costoVisita || 0))).toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                                                            </span>
                                                        </div>

                                                        <div className={styles.profitStat}>
                                                            <span className={styles.statLabel}>MARGEN %</span>
                                                            <span className={styles.percentBadge} style={{
                                                                background: (parseFloat(ticketData.montoFinal || 0) > 0 && (((parseFloat(ticketData.montoFinal || 0) - (parseFloat(ticketData.costoManoObra || 0) + parseFloat(ticketData.costoMateriales || 0) + parseFloat(ticketData.costoVisita || 0))) / parseFloat(ticketData.montoFinal)) * 100) >= 55) ? '#DCFCE7' : '#FEE2E2',
                                                                color: (parseFloat(ticketData.montoFinal || 0) > 0 && (((parseFloat(ticketData.montoFinal || 0) - (parseFloat(ticketData.costoManoObra || 0) + parseFloat(ticketData.costoMateriales || 0) + parseFloat(ticketData.costoVisita || 0))) / parseFloat(ticketData.montoFinal)) * 100) >= 55) ? '#166534' : '#991B1B'
                                                            }}>
                                                                {parseFloat(ticketData.montoFinal || 0) > 0
                                                                    ? (((parseFloat(ticketData.montoFinal || 0) - (parseFloat(ticketData.costoManoObra || 0) + parseFloat(ticketData.costoMateriales || 0) + parseFloat(ticketData.costoVisita || 0))) / parseFloat(ticketData.montoFinal)) * 100).toFixed(1)
                                                                    : '0.0'}%
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>

                                                {ticketData.estadoId === "por_liquidar" ? (
                                                    <>
                                                        {userRole === 'admin' ? (
                                                            <button
                                                                className={styles.confirmFinalPaymentBtn}
                                                                onClick={handleFinalLiquidationPay}
                                                            >
                                                                <DollarSign size={20} />
                                                                CONFIRMAR DEPÓSITO DE SALDO FINAL
                                                            </button>
                                                        ) : (
                                                            <div className={styles.adminOnlyMessage} style={{ marginBottom: '20px' }}>
                                                                <Clock size={18} />
                                                                <span>Esperando que el Administrador liquide el saldo</span>
                                                            </div>
                                                        )}

                                                        <p className={styles.liquidationNote}>
                                                            * Solo el Administrador puede cerrar financieramente el ticket mediante el depósito final.
                                                        </p>
                                                    </>
                                                ) : (
                                                    <div className={styles.closedFooterActions}>
                                                        <div className={styles.closedStatusBanner}>
                                                            <CheckCircle size={20} />
                                                            TICKET CERRADO Y ARCHIVADO
                                                        </div>
                                                        <button
                                                            onClick={onClose}
                                                            className={styles.backToDashboardBtn}
                                                        >
                                                            <ArrowRight size={20} />
                                                            VOLVER AL DASHBOARD
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    {!["nuevo", "en_inspeccion", "esperando_pago_visita", "visita_realizada", "en_cotizacion", "cotizacion_enviada", "cotizacion_aprobada", "en_ejecucion", "documentacion_enviada", "por_liquidar", "ticket_cerrado"].includes(ticketData.estadoId || "") && (
                                        <div className={styles.stepPlaceholder}>
                                            <div className={styles.statusBadge}>{ticketData.estadoId?.replace('_', ' ')}</div>
                                            <p>Este módulo operativo se encuentra en preparación.</p>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    </div>
                )}

                {showAssignmentDrawer && (
                    <TechnicianDrawer
                        isOpen={showAssignmentDrawer}
                        ticket={ticketData}
                        onClose={() => setShowAssignmentDrawer(false)}
                        onAssign={handleAssignment}
                    />
                )}
            </div >
        </>
    );
}
