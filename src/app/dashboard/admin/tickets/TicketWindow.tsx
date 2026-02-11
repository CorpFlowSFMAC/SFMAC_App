"use client";

import { useState, useRef, useEffect } from "react";
import { X, Minimize2, Maximize2, Square, FileText, ArrowRight, Calendar, Camera, ClipboardCheck, DollarSign, Package, Split, Coins, FileSpreadsheet, Download, Send, Upload, Clock, CheckCircle, CheckCircle2, ThumbsUp, Hammer, Wallet, Plus, Calculator, Receipt, Sparkles, AlertTriangle } from "lucide-react";
import TechnicianDrawer from "./TechnicianDrawer";
import TicketStateNavigator from "./TicketStateNavigator";
import { TicketSummary, InfoBarBase, TechnicianSchedulingBar, DiagnosisInfoBar, QuotationInfoBar, FinancialLiquidationBar, UnifiedEvidenceBar, DocumentationSummaryBar, QuoteAssistantBar } from "./TicketSummary";
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

    const [isMaximized, setIsMaximized] = useState(() => ticketData?.isMaximized !== undefined ? ticketData.isMaximized : true);
    const [isMinimized, setIsMinimized] = useState(() => ticketData?.isMinimized !== undefined ? ticketData.isMinimized : false);
    const [position, setPosition] = useState(() => ticketData?.position || { x: 100 + (index * 30), y: 50 + (index * 30) });
    const [isDragging, setIsDragging] = useState(false);
    const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
    const [zIndex, setZIndex] = useState(1001 + (index || 0));
    const [showAssignmentDrawer, setShowAssignmentDrawer] = useState(false);

    // Sincronizar estados de UI con ticketData para persistencia
    useEffect(() => {
        setTicketData((prev: any) => ({
            ...prev,
            isMaximized,
            isMinimized,
            position
        }));
    }, [isMaximized, isMinimized, isDragging]); // Sincronizar cuando cambian banderas o termina drag (vía isDragging)

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
    const [porcentajeAdelanto, setPorcentajeAdelanto] = useState<number | null>(null); // Null forces explicit selection
    const [userRole, setUserRole] = useState<string | null>(null);

    // Toast Notification System
    const [toast, setToast] = useState<{ visible: boolean; title: string; message: string; type: 'success' | 'error' | 'info' }>({ visible: false, title: '', message: '', type: 'info' });

    const showToast = (title: string, message: string, type: 'success' | 'error' | 'info' = 'success') => {
        setToast({ visible: true, title, message, type });
        setTimeout(() => setToast(prev => ({ ...prev, visible: false })), 4000);
    };

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
    const [showExtraAdvanceInput, setShowExtraAdvanceInput] = useState(false);
    const [extraAdvanceAmount, setExtraAdvanceAmount] = useState("");

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
                                nombre: fullTech.nombre,
                                apellido: fullTech.apellido,
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
            // 1. Guardar en el storage individual (detalle completo)
            try {
                localStorage.setItem(`ticket_state_${ticket.id}`, JSON.stringify(ticketData));
            } catch (e) {
                console.error("Error saving individual ticket state (quota?):", e);
            }

            // 2. Sincronizar con la lista maestra 'tickets' para reflejar cambios en el Dashboard/Kanban
            const savedTickets = localStorage.getItem("tickets");
            if (savedTickets) {
                try {
                    const allTickets = JSON.parse(savedTickets);
                    const index = allTickets.findIndex((t: any) => t.id === ticket.id);
                    if (index !== -1) {
                        // ⚠️ OPTIMIZACIÓN: Excluir campos pesados al sincronizar con la lista maestra
                        // para evitar "QuotaExceededError". El detalle vive en `ticket_state_${id}`.
                        const { evidenciasCampo, voucher, photos, archivosAdjuntos, cotizacionFormal, ...lightTicketData } = ticketData;

                        // Preparar el objeto candidato para la lista maestra
                        const candidateTicket = { ...allTickets[index], ...lightTicketData };

                        // Limpieza de seguridad: Asegurar que NO entren campos pesados
                        delete candidateTicket.evidenciasCampo;
                        delete candidateTicket.voucher;
                        delete candidateTicket.photos;
                        delete candidateTicket.archivosAdjuntos;
                        delete candidateTicket.cotizacionFormal;

                        // Comparar con la versión actual en lista maestra (también limpiando por si acaso)
                        const currentInMaster = { ...allTickets[index] };
                        delete currentInMaster.evidenciasCampo;
                        delete currentInMaster.voucher;
                        delete currentInMaster.photos;
                        delete currentInMaster.archivosAdjuntos;
                        delete currentInMaster.cotizacionFormal;

                        if (JSON.stringify(currentInMaster) !== JSON.stringify(candidateTicket)) {
                            allTickets[index] = candidateTicket;
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

    // Listener para sincronizar cambios externos (ej: confirmación del Gerente desde otra pestaña)
    useEffect(() => {
        const handleStorageUpdate = (e: any) => {
            // Si es un evento de storage real, verificamos la key
            if (e.type === 'storage' && e.key !== `ticket_state_${ticket.id}` && e.key !== 'tickets') {
                return;
            }

            // Recargar datos desde localStorage
            const saved = localStorage.getItem(`ticket_state_${ticket.id}`);
            if (saved) {
                try {
                    const parsed = JSON.parse(saved);
                    // Actualizamos el estado local para reflejar los cambios externos (ej: adelantoPagado: true)
                    setTicketData((prev: any) => {
                        // Evitar updates innecesarios si ya son iguales
                        if (JSON.stringify(prev) === JSON.stringify(parsed)) return prev;
                        return { ...prev, ...parsed };
                    });
                } catch (err) {
                    console.error("Error syncing external state:", err);
                }
            }
        };

        const handleReopen = (e: any) => {
            if (e.detail?.ticketId === ticket.id) {
                setIsMaximized(true);
                setIsMinimized(false);
                setZIndex(Date.now() % 10000000);
            }
        };

        window.addEventListener('storage', handleStorageUpdate);
        window.addEventListener('local-storage-update', handleStorageUpdate);
        window.addEventListener('ticket-reopen', handleReopen as EventListener);

        return () => {
            window.removeEventListener('storage', handleStorageUpdate);
            window.removeEventListener('local-storage-update', handleStorageUpdate);
            window.removeEventListener('ticket-reopen', handleReopen as EventListener);
        };
    }, [ticket.id]);


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
            showToast("Diagnóstico Requerido", "Por favor ingrese el diagnóstico técnico antes de enviar.", "error");
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
        showToast("Edición Habilitada", "La cotización ha sido desbloqueada para realizar ajustes.", "info");
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
            showToast("Costo Reacordado", `Nuevo monto técnico ajustado a S/ ${val.toFixed(2)}.`, "success");
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
            showToast("Evidencias Insuficientes", "Debe adjuntar al menos 2 fotos (DURANTE y DESPUÉS).", "error");
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
        showToast("¡Ejecución Finalizada!", "Se ha generado el expediente del servicio correctamente.", "success");
    };

    const handleRequestExtraAdvance = () => {
        // Toggle input visibility instead of using prompt
        setShowExtraAdvanceInput(true);
    };

    const submitExtraAdvanceRequest = () => {
        const monto = extraAdvanceAmount;
        if (monto && !isNaN(parseFloat(monto))) {
            const val = parseFloat(monto);
            const pagosPrevios = ticketData.historialPagosTecnico || [];
            const totalPagado = pagosPrevios.reduce((sum: number, p: any) => sum + p.monto, 0);
            const costoRef = (parseFloat(ticketData.costoManoObra || 0) + parseFloat(ticketData.costoMateriales || 0));

            if (totalPagado + val > costoRef + 0.01) {
                showToast("Saldo Insuficiente", "El adelanto solicitado excede el saldo pendiente del técnico.", "error");
                return;
            }

            setTicketData({
                ...ticketData,
                solicitudAdelantoExtra: {
                    monto: val,
                    fecha: new Date().toISOString()
                }
            });
            setShowExtraAdvanceInput(false);
            setExtraAdvanceAmount("");
            showToast("Petición Enviada", "Solicitud registrada. Esperando aprobación de Gerencia.", "info");
        } else {
            showToast("Monto Inválido", "Por favor ingrese un monto válido.", "error");
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
        showToast("Depósito Confirmado", `Se registró el adelanto extra de S/ ${solicitud.monto.toFixed(2)}.`, "success");
    };

    const handleRequestVisitPayment = () => {
        const amount = parseFloat(ticketData.costoVisita || 0);
        const updated = {
            ...ticketData,
            solicitudPagoVisita: {
                monto: amount,
                fecha: new Date().toISOString()
            }
        };
        setTicketData(updated);
        showToast("Solicitud Enviada", `Se solicitó pago de visita por S/ ${amount.toFixed(2)}.`, "info");
    };

    const handleConfirmVisitPayment = () => {
        // Solo permitir si hay solicitud o si es admin forzando (pero idealmente debería haber solicitud)
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
            fechaPagoVisita: new Date().toISOString(),
            solicitudPagoVisita: null // Limpiar solicitud
        });
        showToast("Pago de Visita Exitoso", `Se confirmó el depósito de S/ ${amount.toFixed(2)}.`, "success");
    };

    const handleConfirmAdvance = () => {
        // Usar el porcentaje solicitado si existe, de lo contrario usar el seleccionado localmente
        const pctReal = ticketData.solicitudAdelanto?.porcentaje || porcentajeAdelanto;

        if (!pctReal) {
            showToast("Selección Requerida", "Por favor seleccione un porcentaje de adelanto (40%, 50% o 60%) para continuar.", "error");
            return;
        }

        const costoReferencia = (parseFloat(ticketData.costoManoObra || 0) + parseFloat(ticketData.costoMateriales || 0));
        const amount = costoReferencia * pctReal;

        const pagosPrevios = ticketData.historialPagosTecnico || [];
        const totalPagado = pagosPrevios.reduce((sum: number, p: any) => sum + p.monto, 0);

        if (totalPagado + amount > costoReferencia + 0.01) {
            showToast("Exceso de Pago", `El pago de S/ ${amount.toFixed(2)} excedería el costo total pactado.`, "error");
            return;
        }

        const nuevoPago = {
            id: Math.random().toString(36).substr(2, 9),
            fecha: new Date().toISOString(),
            monto: amount,
            porcentaje: pctReal,
            referencia: "Adelanto Operativo"
        };

        const updated = {
            ...ticketData,
            adelantoPagado: true,
            historialPagosTecnico: [...pagosPrevios, nuevoPago],
            montoAdelanto: totalPagado + amount,
            fechaPagoAdelanto: new Date().toISOString(),
            // Limpiamos la solicitud ya que se atendió
            solicitudAdelanto: null
        };

        setTicketData(updated);
        showToast("Adelanto Confirmado", `Se ha confirmado el depósito de S/ ${amount.toFixed(2)} (${(pctReal * 100).toFixed(0)}% del costo ref.).`, "success");
    };

    const handleRequestAdvance = () => {
        if (!porcentajeAdelanto) {
            showToast("Selección Requerida", "Debe seleccionar un porcentaje (40%, 50% o 60%) antes de solicitar.", "error");
            return;
        }

        const costoReferencia = (parseFloat(ticketData.costoManoObra || 0) + parseFloat(ticketData.costoMateriales || 0));
        const amount = costoReferencia * porcentajeAdelanto;

        const updated = {
            ...ticketData,
            solicitudAdelanto: {
                porcentaje: porcentajeAdelanto,
                monto: amount,
                fecha: new Date().toISOString()
            }
        };
        setTicketData(updated);
        showToast("Solicitud Enviada", `Solicitud enviada a Gerencia: Adelanto del ${(porcentajeAdelanto * 100).toFixed(0)}% (S/ ${amount.toFixed(2)}).`, "info");
    };

    const handleRequestFinalLiquidation = () => {
        const costoReferencia = (parseFloat(ticketData.costoManoObra || 0) + parseFloat(ticketData.costoMateriales || 0));
        const pagosPrevios = ticketData.historialPagosTecnico || [];
        const totalPagado = pagosPrevios.reduce((sum: number, p: any) => sum + p.monto, 0);
        const amount = costoReferencia - totalPagado;

        const updated = {
            ...ticketData,
            solicitudLiquidacion: {
                monto: amount,
                fecha: new Date().toISOString()
            }
        };
        setTicketData(updated);
        showToast("Liquidación Solicitada", `Solicitud de liquidación final enviada por S/ ${amount.toFixed(2)}.`, "info");
    };

    const handleFinalLiquidationPay = () => {
        const costoReferencia = (parseFloat(ticketData.costoManoObra || 0) + parseFloat(ticketData.costoMateriales || 0));
        const pagosPrevios = ticketData.historialPagosTecnico || [];
        const totalPagado = pagosPrevios.reduce((sum: number, p: any) => sum + p.monto, 0);
        const amount = costoReferencia - totalPagado;

        if (amount < 0) {
            showToast("Balance Negativo", "El saldo es negativo. Verifique los depósitos previos.", "error");
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
        showToast("Ticket Liquidado", `Se registró el pago final de S/ ${amount.toFixed(2)}. Ticket CERRADO.`, "success");
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
        setZIndex(Date.now() % 10000000); // Traer al frente al hacer click
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
        const nextState = !isMaximized;
        setIsMaximized(nextState);
        setIsMinimized(false);
    };

    const handleMinimize = () => {
        const nextState = !isMinimized;
        setIsMinimized(nextState);
    };

    return (
        <>
            {isMaximized && !isMinimized && <div className={styles.overlay} onClick={onClose} style={{ zIndex: zIndex - 1 }} />}

            <div
                ref={windowRef}
                className={`${styles.window} ${isMaximized ? styles.maximized : ''} ${isMinimized ? styles.minimized : ''}`}
                onClick={() => setZIndex(Date.now() % 10000000)}
                style={
                    isMinimized
                        ? { left: `${20 + (index * 270)}px`, bottom: '20px', zIndex: zIndex }
                        : (!isMaximized
                            ? { left: `${position.x}px`, top: `${position.y}px`, zIndex: zIndex }
                            : { zIndex: zIndex }
                        )
                }
            >
                <div
                    className={styles.titleBar}
                    onMouseDown={handleMouseDown}
                    onClick={() => {
                        if (isMinimized) {
                            setIsMinimized(false);
                            if (!isMaximized) setIsMaximized(false);
                        }
                    }}
                    style={{ cursor: (isMaximized && !isMinimized) ? 'default' : 'move' }}
                >
                    <div className={styles.titleLeft}>
                        {!isMinimized ? (
                            <>
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
                            </>
                        ) : (
                            <div className={styles.titleInfoMinimized}>
                                <h3 className={styles.minimizedTicketNumber}>
                                    {ticket.numeroTicketCliente
                                        ? ticket.numeroTicketCliente
                                        : `TKT-${ticket.id.slice(-6).toUpperCase()}`
                                    }
                                </h3>
                            </div>
                        )}
                    </div>

                    {!isMinimized && (
                        <div className={`${styles.slaTimerHeader} ${ticketData.pausadoSLA ? styles.paused : ''}`}>
                            <Clock size={14} />
                            <span>{formatElapsedTime()}</span>
                            {ticketData.pausadoSLA && <span className={styles.pausedLabel}>PAUSADO</span>}
                        </div>
                    )}

                    <div className={styles.windowControls}>
                        {!isMinimized && (
                            <>
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
                            </>
                        )}
                        <button
                            className={`${styles.controlBtn} ${styles.closeBtn} ${isMinimized ? styles.minimizedClose : ''}`}
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
                            <QuoteAssistantBar ticket={ticketData} />
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
                                                        <span>
                                                            CONFIRMAR DEPÓSITO VISITA
                                                            {ticketData.solicitudPagoVisita && " (SOLICITADO)"}
                                                        </span>
                                                    </button>
                                                ) : (
                                                    !ticketData.solicitudPagoVisita ? (
                                                        <button
                                                            className={styles.sendReportBtnOptimistic}
                                                            onClick={handleRequestVisitPayment}
                                                            style={{ width: '100%', marginTop: '12px', background: '#3B82F6', justifyContent: 'center' }}
                                                        >
                                                            <Send size={18} />
                                                            <span>SOLICITAR PAGO A GERENCIA</span>
                                                        </button>
                                                    ) : (
                                                        <div className={styles.waitingForManager}>
                                                            <Clock size={24} color="#3B82F6" />
                                                            <span style={{ fontSize: '1.1rem' }}>¡ SOLICITUD ENVIADA !</span>
                                                            <span style={{ fontSize: '0.8rem', fontWeight: 500 }}>Estamos gestionando el pago de la visita con Gerencia.</span>
                                                        </div>
                                                    )
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
                                                                        showToast("Cotización Guardada", "Cambios guardados y cotización bloqueada nuevamente.", "success");
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
                                                                            {!ticketData.solicitudAdelanto ? (
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
                                                                            ) : (
                                                                                <div style={{ background: '#ECFDF5', padding: '4px 8px', borderRadius: '4px', border: '1px solid #10B981', color: '#047857', fontWeight: 'bold' }}>
                                                                                    SOLICITADO: {(ticketData.solicitudAdelanto.porcentaje * 100).toFixed(0)}%
                                                                                </div>
                                                                            )}
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
                                                                            <button
                                                                                className={styles.confirmAdvanceBtn}
                                                                                onClick={handleConfirmAdvance}
                                                                                disabled={!ticketData.solicitudAdelanto && porcentajeAdelanto === null}
                                                                                style={(!ticketData.solicitudAdelanto && porcentajeAdelanto === null) ? { opacity: 0.5, cursor: 'not-allowed', filter: 'grayscale(1)' } : {}}
                                                                            >
                                                                                <Wallet size={18} />
                                                                                <span>
                                                                                    {ticketData.solicitudAdelanto ?
                                                                                        `CONFIRMAR DEPÓSITO (SOLICITUD: ${(ticketData.solicitudAdelanto.porcentaje * 100).toFixed(0)}%)` :
                                                                                        porcentajeAdelanto !== null ?
                                                                                            `CONFIRMAR DEPÓSITO S/ ${((parseFloat(ticketData.costoManoObra || 0) + parseFloat(ticketData.costoMateriales || 0)) * porcentajeAdelanto).toFixed(2)}` :
                                                                                            "SELECCIONE % PARA CONFIRMAR"
                                                                                    }
                                                                                </span>
                                                                            </button>
                                                                        ) : (
                                                                            !ticketData.solicitudAdelanto ? (
                                                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                                                    {porcentajeAdelanto === null && (
                                                                                        <p style={{ fontSize: '0.75rem', color: '#EF4444', textAlign: 'center', margin: 0, fontWeight: 700 }}>
                                                                                            * Seleccione 40%, 50% o 60% arriba
                                                                                        </p>
                                                                                    )}
                                                                                    <button
                                                                                        className={styles.sendReportBtnOptimistic}
                                                                                        onClick={handleRequestAdvance}
                                                                                        disabled={porcentajeAdelanto === null}
                                                                                        style={{
                                                                                            width: '100%',
                                                                                            marginTop: '4px',
                                                                                            background: '#3B82F6',
                                                                                            justifyContent: 'center',
                                                                                            opacity: porcentajeAdelanto === null ? 0.5 : 1,
                                                                                            cursor: porcentajeAdelanto === null ? 'not-allowed' : 'pointer'
                                                                                        }}
                                                                                    >
                                                                                        <Send size={18} />
                                                                                        <span>SOLICITAR PAGO A GERENCIA</span>
                                                                                    </button>
                                                                                </div>
                                                                            ) : (
                                                                                <div className={styles.waitingForManager}>
                                                                                    <Clock size={24} color="#3B82F6" />
                                                                                    <span style={{ fontSize: '1.1rem' }}>¡ ADELANTO SOLICITADO !</span>
                                                                                    <span style={{ fontSize: '0.8rem', fontWeight: 500 }}>El pago está en proceso de aprobación por Gerencia.</span>
                                                                                </div>
                                                                            )
                                                                        )}

                                                                        {ticketData.solicitudAdelanto && userRole !== 'admin' && (
                                                                            <button
                                                                                style={{ marginTop: '8px', background: 'none', border: 'none', color: '#64748B', cursor: 'pointer', fontSize: '0.75rem', textDecoration: 'underline', width: '100%' }}
                                                                                onClick={() => setTicketData({ ...ticketData, solicitudAdelanto: null })}
                                                                            >
                                                                                Cancelar o Modificar Solicitud
                                                                            </button>
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

                                                                {/* Historial de refuerzos realizados */}
                                                                {(() => {
                                                                    const refuerzos = (ticketData.historialPagosTecnico || []).filter((p: any) =>
                                                                        p.referencia?.includes("Adelanto Adicional") || p.tipo === "Refuerzo"
                                                                    );
                                                                    if (refuerzos.length === 0) return null;
                                                                    return (
                                                                        <div className={styles.reinforcementHistory}>
                                                                            {refuerzos.map((r: any, idx: number) => (
                                                                                <div key={r.id || idx} className={styles.reinforcementItem}>
                                                                                    <CheckCircle size={14} color="#059669" />
                                                                                    <span>S/ {r.monto.toFixed(2)}</span>
                                                                                    <small>{new Date(r.fecha).toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit' })}</small>
                                                                                </div>
                                                                            ))}
                                                                        </div>
                                                                    );
                                                                })()}

                                                                {!ticketData.solicitudAdelantoExtra ? (
                                                                    <>
                                                                        <p style={{ fontSize: '0.8rem', color: '#92400E' }}>Solicite fondos extra si el técnico requiere refuerzo operativo.</p>
                                                                        {!showExtraAdvanceInput ? (
                                                                            <button className={styles.extraAdvanceBtn} onClick={handleRequestExtraAdvance}>
                                                                                <Wallet size={16} />
                                                                                SOLICITAR REFUERZO ECONÓMICO
                                                                            </button>
                                                                        ) : (
                                                                            <div className={styles.extraAdvanceForm}>
                                                                                <input
                                                                                    type="number"
                                                                                    placeholder="Monto a solicitar (S/)"
                                                                                    value={extraAdvanceAmount}
                                                                                    onChange={(e) => setExtraAdvanceAmount(e.target.value)}
                                                                                    className={styles.expenseInput}
                                                                                    autoFocus
                                                                                />
                                                                                <div className={styles.miniActions}>
                                                                                    <button
                                                                                        className={styles.confirmSmallBtn}
                                                                                        onClick={submitExtraAdvanceRequest}
                                                                                    >
                                                                                        <CheckCircle size={14} /> Enviar
                                                                                    </button>
                                                                                    <button
                                                                                        className={styles.cancelSmallBtn}
                                                                                        onClick={() => {
                                                                                            setShowExtraAdvanceInput(false);
                                                                                            setExtraAdvanceAmount("");
                                                                                        }}
                                                                                    >
                                                                                        <X size={14} />
                                                                                    </button>
                                                                                </div>
                                                                            </div>
                                                                        )}
                                                                    </>
                                                                ) : (
                                                                    <div className={styles.pendingAdvanceBox}>
                                                                        <div className={styles.pendingBadge}>ESPERANDO DEPÓSITO</div>
                                                                        <p style={{ fontSize: '0.75rem', fontWeight: 700, color: '#92400E' }}>Monto solicitado: S/ {ticketData.solicitudAdelantoExtra.monto.toFixed(2)}</p>

                                                                        {userRole === 'admin' ? (
                                                                            <button className={styles.confirmManagerDepositBtn} onClick={handleConfirmExtraAdvance}>
                                                                                <CheckCircle size={14} />
                                                                                CONFIRMAR DEPÓSITO MANUALMENTE
                                                                            </button>
                                                                        ) : (
                                                                            <div className={styles.waitingForManager} style={{ marginTop: '0', padding: '12px' }}>
                                                                                <Clock size={20} color="#B45309" />
                                                                                <span style={{ color: '#B45309' }}>¡ PETICIÓN ENVIADA !</span>
                                                                                <span style={{ fontSize: '0.7rem', color: '#B45309', fontWeight: 500 }}>Esperando depósito extra del Gerente.</span>
                                                                            </div>
                                                                        )}

                                                                        {userRole !== 'admin' && (
                                                                            <button className={styles.cancelRequestBtn} onClick={() => setTicketData({ ...ticketData, solicitudAdelantoExtra: null })}>
                                                                                Cancelar Petición
                                                                            </button>
                                                                        )}
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
                                                                // Si el ticket ya venía con número asignado (desde props), bloquear edición
                                                                disabled={!!ticket.numeroTicketCliente}
                                                                style={ticket.numeroTicketCliente ? { background: '#F1F5F9', color: '#64748B', cursor: 'not-allowed', border: '1px solid #E2E8F0' } : {}}
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
                                                        showToast("Documentación Validada", "El ticket ha pasado a liquidación final.", "success");
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
                                                                <span>
                                                                    CONFIRMAR DEPÓSITO FINAL
                                                                    {ticketData.solicitudLiquidacion && " (SOLICITADO)"}
                                                                </span>
                                                            </button>
                                                        ) : (
                                                            !ticketData.solicitudLiquidacion ? (
                                                                <button
                                                                    className={styles.proceedToLiquidationBtn}
                                                                    onClick={handleRequestFinalLiquidation}
                                                                    style={{ background: '#3B82F6', marginTop: '0' }}
                                                                >
                                                                    <Send size={20} />
                                                                    <span>SOLICITAR LIQUIDACIÓN FINAL</span>
                                                                </button>
                                                            ) : (
                                                                <div className={styles.waitingForManager}>
                                                                    <Clock size={24} color="#3B82F6" />
                                                                    <span style={{ fontSize: '1.1rem' }}>¡ LIQUIDACIÓN EN PROCESO !</span>
                                                                    <span style={{ fontSize: '0.8rem', fontWeight: 500 }}>Solicitud de cierre enviada a Gerencia.</span>
                                                                </div>
                                                            )
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
                        onShowToast={showToast}
                    />
                )}

                {/* Toast Notification Render */}
                {toast.visible && (
                    <div className={styles.toastOverlay}>
                        <div className={`${styles.toastCard} ${toast.type === 'success' ? styles.toastSuccess : toast.type === 'error' ? styles.toastError : styles.toastInfo}`}>
                            <div className={styles.toastIcon}>
                                {toast.type === 'success' && <CheckCircle2 size={24} color="white" />}
                                {toast.type === 'error' && <AlertTriangle size={24} color="white" />}
                                {toast.type === 'info' && <Sparkles size={24} color="white" />}
                            </div>
                            <div className={styles.toastContent}>
                                <h4>{toast.title}</h4>
                                <p>{toast.message}</p>
                            </div>
                        </div>
                    </div>
                )}
            </div >
        </>
    );
}
