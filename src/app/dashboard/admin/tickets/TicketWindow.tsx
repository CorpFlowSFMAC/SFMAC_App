"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import * as XLSX from 'xlsx';
import { X, Minimize2, Maximize2, Square, FileText, ArrowRight, Calendar, Camera, ClipboardCheck, DollarSign, Percent, Package, Split, Coins, FileSpreadsheet, Download, Send, Upload, Clock, CheckCircle, CheckCircle2, ThumbsUp, Hammer, Wallet, Plus, Calculator, Receipt, Sparkles, AlertTriangle, Trash2, User } from "lucide-react";
import TechnicianDrawer from "./TechnicianDrawer";
import TicketStateNavigator from "./TicketStateNavigator";
import { TicketSummary, InfoBarBase, TechnicianSchedulingBar, DiagnosisInfoBar, QuotationInfoBar, FinancialLiquidationBar, UnifiedEvidenceBar, DocumentationSummaryBar, QuoteAssistantBar, PaymentHistoryBar, GestoraAssignmentBar } from "./TicketSummary";
import GestoraDrawer from "./GestoraDrawer";

import OnlineQuotationEditor from "./OnlineQuotationEditor";
import { normalizeStateId } from "@/lib/ticketStates";
import { ticketsAPI, branchesAPI, ticketCostsAPI, techniciansAPI } from "@/lib/supabase-api";
import { SERVICE_TYPES } from "@/lib/serviceTypes";
import { round2, formatSoles } from "@/lib/formatters";
import styles from "./TicketWindow.module.css";

const MIBANCO_ID = "b65727ed-94d3-46ef-ab7d-62621ec46acb";

interface TicketWindowProps {
    ticket: any;
    onClose: () => void;
    onUpdate?: (id: string, updates: any) => Promise<any>;
    index?: number;
    children?: React.ReactNode;
}

export default function TicketWindow({ ticket, onClose, onUpdate, index = 0, children }: TicketWindowProps) {
    // Cargar estado persistido del ticket (MOVIDO ARRIBA para evitar ReferenceError)
    // Cargar estado persistido del ticket (MOVIDO ARRIBA para evitar ReferenceError)
    // Cargar posiciÃƒÂ³n y estado de ventana desde localStorage (solo UI, NO datos de negocio)
    const [ticketData, setTicketData] = useState(() => ({
        ...ticket,
        estadoId: normalizeStateId(ticket.estadoId)
    }));

    const [isMaximized, setIsMaximized] = useState(() => {
        if (typeof window !== 'undefined') {
            const ui = localStorage.getItem(`ticket_ui_${ticket.id}`);
            if (ui) return JSON.parse(ui).isMaximized;
        }
        return true;
    });

    const [isMinimized, setIsMinimized] = useState(() => {
        if (typeof window !== 'undefined') {
            const ui = localStorage.getItem(`ticket_ui_${ticket.id}`);
            if (ui) return JSON.parse(ui).isMinimized;
        }
        return false;
    });

    const [position, setPosition] = useState(() => {
        if (typeof window !== 'undefined') {
            const ui = localStorage.getItem(`ticket_ui_${ticket.id}`);
            if (ui) return JSON.parse(ui).position;
        }
        return { x: 100 + (index * 30), y: 50 + (index * 30) };
    });

    const [isDragging, setIsDragging] = useState(false);
    const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
    const [zIndex, setZIndex] = useState(1001 + (index || 0));
    const [showAssignmentDrawer, setShowAssignmentDrawer] = useState(false);
    const [showGestoraDrawer, setShowGestoraDrawer] = useState(false);

    // Solo persistimos la posiciÃƒÂ³n y el estado de la ventana en localStorage para preferencias de usuario
    useEffect(() => {
        if (typeof window !== 'undefined') {
            localStorage.setItem(`ticket_ui_${ticket.id}`, JSON.stringify({
                isMaximized,
                isMinimized,
                position
            }));
        }
    }, [isMaximized, isMinimized, position, ticket.id]);

    // Estados para el reporte de campo (Paso 4)
    const [diagnostico, setDiagnostico] = useState("");
    const [costoManoObra, setCostoManoObra] = useState("");
    const [costoMateriales, setCostoMateriales] = useState("");
    const [modalidad, setModalidad] = useState("todo_costo");
    const [evidenciasCampo, setEvidenciasCampo] = useState<any[]>([]);
    const [montoTotalCotizado, setMontoTotalCotizado] = useState(ticketData.montoFinal || 0);
    const [montoSubtotal, setMontoSubtotal] = useState(ticketData.montoSubtotal || 0);
    const [montoIGV, setMontoIGV] = useState(ticketData.montoIGV || 0);
    const quotationEditorRef = useRef<any>(null);
    const [partidasCotizacion, setPartidasCotizacion] = useState<any[]>(ticketData.partidas || []);
    const [currentTime, setCurrentTime] = useState<Date | null>(null);
    const [isQuotationCollapsed, setIsQuotationCollapsed] = useState(true);
    const [isSavingCost, setIsSavingCost] = useState(false);
    const [isSavingNegotiation, setIsSavingNegotiation] = useState(false);

    const [userRole, setUserRole] = useState<string | null>(() => {
        if (typeof window !== 'undefined') return localStorage.getItem('userRole');
        return null;
    });

    const [toast, setToast] = useState<{ visible: boolean; title: string; message: string; type: 'success' | 'error' | 'info' }>({ visible: false, title: '', message: '', type: 'info' });

    const [ticketCosts, setTicketCosts] = useState<any[]>([]);
    const [loadingCosts, setLoadingCosts] = useState(false);

    const [isConfirmingPayment, setIsConfirmingPayment] = useState(false);
    
    const showToast = (title: string, message: string, type: 'success' | 'error' | 'info' = 'success') => {
        setToast({ visible: true, title, message, type });
        setTimeout(() => setToast(prev => ({ ...prev, visible: false })), 4000);
    };

    const hasLoadedRef = useRef<string | null>(null);
    const loadCosts = useCallback(async () => {
        if (!ticket?.id) return;
        setLoadingCosts(true);
        try {
            const data = await ticketCostsAPI.getByTicket(ticket.id);
            setTicketCosts(data || []);
        } catch (err) {
            console.error("Error loading costs:", err);
        } finally {
            setLoadingCosts(false);
        }
    }, [ticket?.id]);

    useEffect(() => {
        if (!ticket?.id || hasLoadedRef.current === ticket.id) return;
        hasLoadedRef.current = ticket.id;

        const load = async () => {
            try {
                loadCosts();
                const fullTicket = await ticketsAPI.getById(ticket.id);
                if (!fullTicket) return;
                let meta = fullTicket.metadata || {};
                while (meta.metadata && typeof meta.metadata === 'object') {
                    meta = { ...meta, ...meta.metadata };
                    delete meta.metadata;
                }
                const rawEstadoId = normalizeStateId(fullTicket.status_id || meta.estadoId || 'nuevo');
                const visitConfirmed = meta.visitPaymentConfirmed ?? false;

                const PRE_INSPECTION_STATES = ['nuevo', 'tecnico_asignado', 'esperando_pago_visita'];
                const corregidoEstadoId = (visitConfirmed && PRE_INSPECTION_STATES.includes(rawEstadoId))
                    ? 'en_inspeccion'
                    : rawEstadoId;

                setTicketData((prev: any) => ({
                    ...prev, ...fullTicket, ...meta,
                    metadata: meta,
                    estadoId: corregidoEstadoId,
                    status_id: corregidoEstadoId,
                    adelantoPagado: meta.adelantoPagado ?? false,
                    visitPaymentConfirmed: visitConfirmed,
                    solicitudAdelanto: meta.solicitudAdelanto ?? null,
                    solicitudPagoVisita: visitConfirmed ? null : (meta.solicitudPagoVisita ?? null),
                    historialPagosTecnico: meta.historialPagosTecnico ?? [],
                    gestora: fullTicket.gestora || meta.gestora || null
                }));
            } catch (err) {
                console.error('Error fetching full ticket data:', err);
            }
        };
        load();
    }, [ticket?.id]);

    const prevServerStatusRef = useRef<string | null>(null);
    useEffect(() => {
        const serverStatus = ticket?.status_id || null;
        if (serverStatus === prevServerStatusRef.current) return;
        if (prevServerStatusRef.current === null) {
            prevServerStatusRef.current = serverStatus;
            return;
        }
        prevServerStatusRef.current = serverStatus;
        if (!ticket?.id) return;

        const refetch = async () => {
            try {
                const fullTicket = await ticketsAPI.getById(ticket.id);
                if (!fullTicket) return;
                let meta = fullTicket.metadata || {};
                while (meta.metadata && typeof meta.metadata === 'object') {
                    meta = { ...meta, ...meta.metadata };
                    delete meta.metadata;
                }
                const rawId2 = normalizeStateId(fullTicket.status_id || meta.estadoId || 'nuevo');
                const visitConf2 = meta.visitPaymentConfirmed ?? false;
                const PRE_STATES = ['nuevo', 'tecnico_asignado', 'esperando_pago_visita'];
                const corregidoId2 = (visitConf2 && PRE_STATES.includes(rawId2)) ? 'en_inspeccion' : rawId2;

                setTicketData((prev: any) => {
                    const E2_ORDER: Record<string, number> = {
                        'borrador': 0, 'pendiente': 1, 'nuevo': 1, 'tecnico_asignado': 2,
                        'esperando_pago_visita': 2, 'en_inspeccion': 3, 'visita_realizada': 4,
                        'en_cotizacion': 5, 'cotizacion_enviada': 6, 'cotizacion_aprobada': 7,
                        'en_ejecucion': 8, 'documentacion_enviada': 9, 'por_liquidar': 10,
                        'ticket_cerrado': 12
                    };
                    const incomingOrder = E2_ORDER[corregidoId2] ?? 0;
                    const prevOrder = E2_ORDER[prev.estadoId] ?? 0;
                    const finalEstadoId = incomingOrder >= prevOrder ? corregidoId2 : prev.estadoId;
                    const serverPagos2: any[] = meta.historialPagosTecnico || [];
                    const localPagos2: any[] = prev.historialPagosTecnico || [];
                    const mergedById2 = new Map<string, any>();
                    [...localPagos2, ...serverPagos2].forEach((p: any) => { if (p?.id) mergedById2.set(p.id, p); });
                    const mergedPagos2 = mergedById2.size > 0 ? Array.from(mergedById2.values()) : serverPagos2;

                    return {
                        ...prev, ...fullTicket, ...meta,
                        metadata: meta,
                        estadoId: finalEstadoId,
                        status_id: finalEstadoId,
                        adelantoPagado: meta.adelantoPagado ?? prev.adelantoPagado ?? false,
                        visitPaymentConfirmed: visitConf2,
                        solicitudAdelanto: meta.solicitudAdelanto ?? null,
                        solicitudPagoVisita: visitConf2 ? null : (meta.solicitudPagoVisita ?? null),
                        historialPagosTecnico: mergedPagos2,
                    };
                });
            } catch (err) {
                console.error('Error refetching ticket after Realtime status change:', err);
            }
        };
        refetch();
    }, [ticket?.status_id, ticket?.id]);

    const serverAdelantoPagado = ticket?.adelantoPagado ?? ticket?.metadata?.adelantoPagado ?? false;
    const serverVisitPaymentConfirmed = ticket?.visitPaymentConfirmed ?? ticket?.metadata?.visitPaymentConfirmed ?? false;
    const serverHistorialLen = Math.max(
        ticket?.historialPagosTecnico?.length ?? 0,
        ticket?.metadata?.historialPagosTecnico?.length ?? 0
    );
    useEffect(() => {
        setTicketData((prev: any) => {
            if (!prev) return prev;
            const overrides: any = {};
            if (serverAdelantoPagado) overrides.solicitudAdelanto = null;
            if (serverVisitPaymentConfirmed) {
                overrides.solicitudPagoVisita = null;
                const preInspectionStates = ['nuevo', 'asignado', 'esperando_pago_visita'];
                if (preInspectionStates.includes(prev.estadoId)) {
                    overrides.estadoId = 'en_inspeccion';
                }
            }
            if (prev.solicitudAdelantoExtra && serverHistorialLen > 0) {
                const reqDate = new Date(prev.solicitudAdelantoExtra.fecha).getTime();
                const pagos = prev.historialPagosTecnico || [];
                const isPaid = pagos.some((p: any) => {
                    const isRefuerzo = p.tipo === 'Refuerzo' || p.referencia?.includes('Refuerzo');
                    return isRefuerzo && new Date(p.fecha).getTime() >= reqDate;
                });
                if (isPaid) overrides.solicitudAdelantoExtra = null;
            }
            if (Object.keys(overrides).length === 0) return prev;
            return { ...prev, ...overrides };
        });
        if (ticket?.gastos) setGastos(ticket.gastos);
        if (ticket?.evidenciasEjecucion) setEvidenciasEjecucion(ticket.evidenciasEjecucion);
    }, [serverAdelantoPagado, serverVisitPaymentConfirmed, serverHistorialLen]);

    useEffect(() => {
        if (typeof window !== 'undefined') {
            const role = localStorage.getItem('userRole');
            if (role !== userRole) setUserRole(role);
        }
    }, []);

    const [gastos, setGastos] = useState<any[]>(ticketData.gastos || []);
    const [documentosChecklist, setDocumentosChecklist] = useState({
        actaConformidad: false,
        ats: false,
        declaracionJurada: false,
        excelSeguridad: false
    });
    const [evidenciasEjecucion, setEvidenciasEjecucion] = useState<any[]>(ticketData.evidenciasEjecucion || []);
    const [newExpense, setNewExpense] = useState({
        concepto: "",
        monto: "",
        categoria: "Mano de Obra",
        specialist_id: "",
        proveedor: ""
    });
    const [allTechnicians, setAllTechnicians] = useState<any[]>([]);
    const [techSearchQuery, setTechSearchQuery] = useState("");
    const [showTechDropdown, setShowTechDropdown] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [showNegotiationModal, setShowNegotiationModal] = useState(false);
    const [negotiationNewCost, setNegotiationNewCost] = useState("");
    const fieldEvidenceRef = useRef<HTMLInputElement>(null);
    const [showExtraAdvanceInput, setShowExtraAdvanceInput] = useState(false);
    const [extraAdvanceAmount, setExtraAdvanceAmount] = useState("");

    const [bcpQuotationFile, setBcpQuotationFile] = useState<any>(ticketData.archivoCotizacionBCP || null);
    const bcpFileInputRef = useRef<HTMLInputElement>(null);



    const [triageSedeId, setTriageSedeId] = useState("");
    const [triageServiceType, setTriageServiceType] = useState("");
    const [triageDescription, setTriageDescription] = useState("");
    const [sedesMibanco, setSedesMibanco] = useState<any[]>([]);
    const [loadingSedes, setLoadingSedes] = useState(false);

    useEffect(() => {
        if (ticketData.estadoId === 'borrador' && ticketData.client_id === MIBANCO_ID) {
            setLoadingSedes(true);
            setTriageDescription(ticketData.description || ticketData.descripcionProblema || '');
            branchesAPI.getByClient(MIBANCO_ID)
                .then(data => setSedesMibanco(data))
                .catch(err => console.error(err))
                .finally(() => setLoadingSedes(false));
        }
    }, [ticketData.estadoId, ticketData.client_id]);

    useEffect(() => {
        const interval = setInterval(() => {
            setCurrentTime(new Date());
        }, 1000);

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

    const lastSyncData = useRef<string>("");

    const syncToSupabase = useCallback(async (dataOverride?: any) => {
        const dataToProcess = dataOverride || ticketData;
        if (!onUpdate || !dataToProcess) return;

        const {
            isMaximized, isMinimized, position, zIndex,
            cliente, sede, tecnico,
            metadata: _unusedMetadata,
            ...businessData
        } = dataToProcess;

        const isAdmin = userRole === 'admin';
        const sourceForPayments = isAdmin ? businessData : ticket;
        const sourceMetadata = isAdmin ? businessData : (ticket.metadata || {});

        const STATE_ORDER: Record<string, number> = {
            'borrador': 0, 'pendiente': 1, 'nuevo': 1, 'tecnico_asignado': 2,
            'esperando_pago_visita': 2, 'en_inspeccion': 3, 'visita_realizada': 4,
            'en_cotizacion': 5, 'cotizacion_enviada': 6, 'cotizacion_aprobada': 7,
            'en_ejecucion': 8, 'documentacion_enviada': 9, 'por_liquidar': 10,
            'ticket_cerrado': 12
        };
        const localStateOrder = STATE_ORDER[businessData.estadoId] ?? 0;
        const serverStateOrder = STATE_ORDER[ticket.status_id] ?? 0;
        const resolvedStatusId = localStateOrder >= serverStateOrder ? businessData.estadoId : ticket.status_id;

        const updates: any = {
            status_id: resolvedStatusId,
            description: businessData.descripcionProblema,
            client_ticket_number: businessData.numeroTicketCliente,
            diagnosis: businessData.diagnostico,
            labor_cost: parseFloat(sourceForPayments.costoManoObra || 0),
            materials_cost: parseFloat(sourceForPayments.costoMateriales || 0),
            visit_cost: parseFloat(sourceForPayments.costoVisita || 0),
            total_quoted_amount: parseFloat(sourceForPayments.montoFinal || 0),
            technician_id: tecnico?.id || businessData.technician_id || ticket.technician_id,
            gestora_id: businessData.gestora?.id || ticket.gestora?.id || ticket.gestora_id,
            is_sla_paused: isAdmin ? businessData.pausadoSLA : ticket.is_sla_paused,
            sla_pause_date: isAdmin ? businessData.fechaPausa : ticket.sla_pause_date,
            sla_reactivation_date: isAdmin ? businessData.fechaReactivacion : ticket.sla_reactivation_date,
            quotation_date: businessData.fechaCotizacion,
            execution_date: sourceForPayments.fechaInicioEjecucion || ticket.execution_date,
            closure_date: sourceForPayments.fechaCierre || ticket.closure_date,
            metadata: {
                ...businessData,
                adelantoPagado: (businessData.adelantoPagado || ticket.adelantoPagado || sourceMetadata.adelantoPagado || false),
                fechaPagoAdelanto: (businessData.fechaPagoAdelanto || sourceMetadata.fechaPagoAdelanto),

                historialPagosTecnico: (() => {
                    const localPagos = businessData.historialPagosTecnico || [];
                    const serverPagos = ticket.historialPagosTecnico || ticket.metadata?.historialPagosTecnico || [];
                    const allById = new Map();
                    [...serverPagos, ...localPagos].forEach(p => {
                        if (p?.id) allById.set(p.id, p);
                    });
                    return Array.from(allById.values());
                })(),

                visitPaymentConfirmed: (businessData.visitPaymentConfirmed || ticket.visitPaymentConfirmed || sourceMetadata.visitPaymentConfirmed || false),
                fechaPagoVisita: (businessData.fechaPagoVisita || sourceMetadata.fechaPagoVisita),

                solicitudAdelanto: (businessData.adelantoPagado || ticket.adelantoPagado || sourceMetadata.adelantoPagado) ? null : businessData.solicitudAdelanto,
                solicitudPagoVisita: (businessData.visitPaymentConfirmed || ticket.visitPaymentConfirmed || sourceMetadata.visitPaymentConfirmed) ? null : businessData.solicitudPagoVisita,

                tecnico: tecnico
            }
        };

        const currentDataStr = JSON.stringify(updates);
        if (currentDataStr === lastSyncData.current && !dataOverride) return;

        try {
            await onUpdate(ticket.id, updates);
            lastSyncData.current = currentDataStr;
            localStorage.setItem(`ticket_state_${ticket.id}`, JSON.stringify(dataToProcess));
        } catch (err) {
            console.error("Error syncing ticket to Supabase:", err);
        }
    }, [ticketData, ticket.id, onUpdate]);

    useEffect(() => {
        const syncTimeout = setTimeout(() => {
            syncToSupabase();
        }, 1500);

        return () => clearTimeout(syncTimeout);
    }, [ticketData, syncToSupabase]);

    useEffect(() => {
        const handleStorageUpdate = (e: any) => {
            if (e.type === 'storage' && e.key !== `ticket_state_${ticket.id}` && e.key !== 'tickets') {
                return;
            }

            const saved = localStorage.getItem(`ticket_state_${ticket.id}`);
            if (saved) {
                try {
                    const parsed = JSON.parse(saved);

                    const {
                        adelantoPagado,
                        fechaPagoAdelanto,
                        historialPagosTecnico,
                        estadoId,
                        status_id,
                        visitPaymentConfirmed,
                        solicitudAdelanto,
                        fechaPagoVisita,
                        solicitudPagoVisita,
                        montoFinal,
                        ...safeToRestore
                    } = parsed;

                    setTicketData((prev: any) => {
                        if (JSON.stringify(prev) === JSON.stringify(parsed)) return prev;
                        return { ...prev, ...safeToRestore };
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


    const handleAssignment = async (assignmentData: any) => {
        const visitaCost = parseFloat(assignmentData.costoVisita || 0);
        const hasVisitCost = visitaCost > 0;

        const PRE_ASSIGNMENT_STATES = ['nuevo', 'borrador', 'pendiente', 'tecnico_asignado'];
        const newEstadoId = PRE_ASSIGNMENT_STATES.includes(ticketData.estadoId)
            ? (hasVisitCost ? 'esperando_pago_visita' : 'en_inspeccion')
            : ticketData.estadoId;

        const dbUpdates: any = {
            technician_id: assignmentData.tecnico?.id || null,
            visit_cost: visitaCost,
            status_id: newEstadoId,
            metadata: {
                ...ticketData.metadata,
                tecnico: assignmentData.tecnico,
                costoVisita: visitaCost,
                fechaAsignacion: assignmentData.fechaAsignacion,
                estadoId: newEstadoId,
                ...(hasVisitCost ? {
                    solicitudPagoVisita: {
                        monto: visitaCost,
                        fecha: new Date().toISOString(),
                        estado: 'pendiente'
                    }
                } : {})
            }
        };

        try {
            if (onUpdate) {
                await onUpdate(ticketData.id, dbUpdates);
            } else {
                await ticketsAPI.update(ticketData.id, dbUpdates);
            }
        } catch (err) {
            console.error('Error persisting assignment to Supabase:', err);
        }

        setTicketData((prev: any) => ({
            ...prev,
            ...assignmentData,
            estadoId: newEstadoId,
            status_id: newEstadoId,
            costoVisita: visitaCost,
            ...(hasVisitCost ? {
                solicitudPagoVisita: {
                    monto: visitaCost,
                    fecha: new Date().toISOString(),
                    estado: 'pendiente'
                }
            } : {})
        }));
        setShowAssignmentDrawer(false);
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

    const handleGestoraAssignment = async (gestora: any) => {
        try {
            const dbUpdates = {
                gestora_id: gestora.id,
                metadata: {
                    ...ticketData.metadata,
                    gestora: gestora
                }
            };
            
            if (onUpdate) {
                await onUpdate(ticketData.id, dbUpdates);
            } else {
                await ticketsAPI.update(ticketData.id, dbUpdates);
            }

            setTicketData((prev: any) => ({
                ...prev,
                gestora: gestora,
                gestora_id: gestora.id
            }));
            
            showToast("Ticket Derivado", `El servicio ahora estÃ¡ a cargo de ${gestora.name}.`, "success");
        } catch (err) {
            console.error("Error assigned gestora:", err);
            showToast("Error", "No se pudo completar la derivaciÃ³n.", "error");
        }
    };

    const handleSendFieldReport = () => {
        if (!diagnostico) {
            showToast("DiagnÃ³stico Requerido", "Por favor ingrese el diagnÃ³stico tÃ©cnico antes de enviar.", "error");
            return;
        }

        const reportData = {
            ...ticketData,
            diagnostico,
            costoManoObra: round2(costoManoObra),
            costoMateriales: modalidad === 'todo_costo' ? 0 : round2(costoMateriales),
            modalidad,
            evidenciasCampo: evidenciasCampo,
            estadoId: "en_cotizacion",
            fechaReporteCampo: new Date().toISOString()
        };

        setTicketData(reportData);
        syncToSupabase(reportData);
    };

    const handleBcpFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            const file = e.target.files[0];

            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => {
                const b64 = reader.result as string;
                setBcpQuotationFile({
                    name: file.name,
                    url: b64,
                    type: file.type,
                    fecha: new Date().toISOString()
                });

                setTicketData((prev: any) => ({
                    ...prev,
                    archivoCotizacionBCP: {
                        name: file.name,
                        url: b64,
                        type: file.type,
                        fecha: new Date().toISOString()
                    }
                }));

                showToast("Archivo Cargado", "Plantilla BCP adjuntada correctamente.", "success");
            };
            reader.onerror = error => console.error("Error reading file:", error);
        }
    };

    const handleSendQuote = async () => {
        const isBCP = ticketData.cliente?.nombre?.toUpperCase().includes("BCP");

        if (isBCP) {
            if (!bcpQuotationFile) {
                showToast("Archivo Faltante", "Debe adjuntar la plantilla Excel BCP antes de enviar.", "error");
                return;
            }
        } else {
            if (quotationEditorRef.current) {
                try {
                    await quotationEditorRef.current.downloadPDF();
                } catch (err) {
                    console.error("Error al descargar PDF:", err);
                }
            }
        }

        const updated = {
            ...ticketData,
            estadoId: "cotizacion_enviada",
            fechaCotizacion: new Date().toISOString(),
            partidas: partidasCotizacion,
            montoFinal: montoTotalCotizado,
            montoSubtotal: montoSubtotal,
            montoIGV: montoIGV,
            pausadoSLA: true,
            fechaPausa: new Date().toISOString(),
            archivoCotizacionBCP: isBCP ? bcpQuotationFile : null
        };

        setTicketData(updated);
        showToast("CotizaciÃ³n Enviada", isBCP ? "Plantilla BCP registrada." : "Presupuesto formal enviado.", "success");
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
        syncToSupabase(approved);
    };

    const handleAuthorizeModification = () => {
        const authorized = {
            ...ticketData,
            modificacionAutorizada: true
        };
        setTicketData(authorized);
        setIsQuotationCollapsed(false);
        showToast("EdiciÃ³n Habilitada", "La cotizaciÃ³n ha sido desbloqueada para realizar ajustes.", "info");
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
        const currentTotal = (currentMO + currentMAT).toFixed(2);
        setNegotiationNewCost(currentTotal);
        setShowNegotiationModal(true);
    };

    const confirmNegotiatedCost = () => {
        if (negotiationNewCost && !isNaN(parseFloat(negotiationNewCost))) {
            const val = parseFloat(negotiationNewCost);
            const currentMO = parseFloat(ticketData.costoManoObra || 0);
            const currentMAT = parseFloat(ticketData.costoMateriales || 0);

            const updated = {
                ...ticketData,
                costoManoObra: val,
                costoMateriales: 0,
                costoAjustadoPostAprobacion: true,
                costoAnteriorTecnico: currentMO + currentMAT
            };
            setTicketData(updated);
            setShowNegotiationModal(false);
            showToast("Costo Reacordado", `Nuevo monto tÃ©cnico ajustado a S/ ${val.toFixed(2)}.`, "success");
        } else {
            showToast("Monto InvÃ¡lido", "Por favor ingrese un nÃºmero vÃ¡lido para el costo.", "error");
        }
    };

    const handleFinishExecution = () => {
        if (evidenciasEjecucion.length < 2) {
            showToast("Evidencias Insuficientes", "Debe adjuntar al menos 2 fotos (DURANTE y DESPUÃ‰S).", "error");
            return;
        }
        const updated = {
            ...ticketData,
            estadoId: "documentacion_enviada",
            fechaFinEjecucion: new Date().toISOString(),
            gastos: gastos,
            evidenciasEjecucion: evidenciasEjecucion,
            evidenciasCampo: ticketData.evidenciasCampo || [],
            evidencias: ticketData.evidencias || []
        };
        setTicketData(updated);
        showToast("Â¡EjecuciÃ³n Finalizada!", "Se ha generado el expediente del servicio correctamente.", "success");
    };


    const handleClasificarYActivar = async () => {
        const finalSedeId = triageSedeId || ticketData.branch_id;
        const codigoSedeExtraido = ticketData.metadata?.codigo_sede_extraido;

        if (!triageServiceType) {
            showToast("Campo requerido", "Por favor seleccione el tipo de servicio.", "error");
            return;
        }

        if (!finalSedeId) {
            showToast("Campo requerido", "Por favor vincule el ticket a una sede real.", "error");
            return;
        }

        try {
            if (finalSedeId && codigoSedeExtraido) {
                await branchesAPI.update(finalSedeId, {
                    codigo_cliente: codigoSedeExtraido
                });
            }

            const dbUpdates = {
                branch_id: finalSedeId,
                service_type: triageServiceType,
                description: triageDescription || ticketData.description || '',
                status_id: 'nuevo',
                metadata: {
                    ...ticketData.metadata,
                    triage_completado: true,
                    fecha_triage: new Date().toISOString()
                }
            };

            await ticketsAPI.update(ticketData.id, dbUpdates);

            const selectedSede = sedesMibanco.find(s => s.id === finalSedeId);
            const normalizedSede = selectedSede ? {
                ...selectedSede,
                nombre: selectedSede.name || selectedSede.nombre || "Sin Sede",
                direccion: selectedSede.address || selectedSede.direccion || "Sin direcciÃ³n"
            } : null;

            const localUpdates = {
                ...dbUpdates,
                estadoId: 'nuevo',
                descripcionProblema: dbUpdates.description,
                tipoServicio: triageServiceType,
                sede: normalizedSede,
            };

            await onUpdate?.(ticketData.id, dbUpdates);
            setTicketData((prev: any) => ({ ...prev, ...localUpdates }));
            showToast("âœ… Ticket Activado", "Ticket clasificado y enviado al flujo operativo como Nuevo.", "success");
        } catch (error: any) {
            console.error("Error en triage:", error);
            showToast("Error al Clasificar", `Detalle: ${error?.message || 'Error desconocido'}`, "error");
        }
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
                    // Actualizar tambiÃƒÂ©n en ticketData para persistencia
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

    const handleMinimize = () => {
        setIsMinimized(!isMinimized);
    };

    const handleMaximize = () => {
        const nextState = !isMaximized;
        setIsMaximized(nextState);
        setIsMinimized(false);
    };


    const handleDeleteCost = async (costId: string) => {
        if (!confirm("Â¿EstÃ¡ seguro de eliminar este registro de costo?")) return;
        try {
            await ticketCostsAPI.delete(costId);
            await loadCosts();
            showToast("Registro Eliminado", "El costo ha sido quitado del desglose.", "info");
        } catch (err) {
            console.error("Error deleting cost:", err);
            showToast("Error", "No se pudo eliminar el registro.", "error");
        }
    };

    const handleAddExpense = async () => {
        if (!newExpense.concepto.trim() || !newExpense.monto) {
            showToast("Campos incompletos", "El concepto y el monto son obligatorios.", "error");
            return;
        }
        if (newExpense.categoria === "Mano de Obra" && !newExpense.specialist_id) {
            showToast("Especialista requerido", "Para Mano de Obra debe seleccionar un tÃ©cnico de la base de datos.", "error");
            return;
        }
        setIsSavingCost(true);
        try {
            await ticketCostsAPI.create({
                ticket_id: ticket.id,
                concepto: newExpense.concepto.trim(),
                categoria: newExpense.categoria,
                specialist_id: newExpense.specialist_id || undefined,
                proveedor: newExpense.proveedor.trim() || undefined,
                monto: parseFloat(newExpense.monto),
                estado_pago: 'pendiente',
                solicitado_por: userRole || 'gestora'
            });
            await loadCosts();
            setNewExpense({ concepto: "", monto: "", categoria: "Mano de Obra", specialist_id: "", proveedor: "" });
            setTechSearchQuery("");
            showToast("Gasto Registrado", "El egreso fue aÃ±adido y estÃ¡ pendiente de abono desde TesorerÃ­a.", "success");
        } catch (err) {
            console.error("Error adding expense:", err);
            showToast("Error", "No se pudo registrar el gasto.", "error");
        } finally {
            setIsSavingCost(false);
        }
    };

    // Cargar técnicos para el Combobox
    useEffect(() => {
        techniciansAPI.getAll()
            .then((data: any[]) => setAllTechnicians(data || []))
            .catch((e: any) => console.error("Error loading technicians:", e));
    }, []);


    // CÃƒÂ¡lculos de Rentabilidad Rel Real-Time
    const totalCosts = ticketCosts.reduce((acc, c) => acc + (parseFloat(c.monto) || 0), 0);
    const approvedAmount = parseFloat(ticketData.total_quoted_amount || ticketData.montoFinal || 0);
    const grossMargin = approvedAmount - totalCosts;
    const capitalExposed = ticketCosts
        .filter(c => c.estado_pago === 'pagado' || c.estado_pago === 'adelanto')
        .reduce((acc, c) => acc + (parseFloat(c.monto) || 0), 0);
    const costPercentage = approvedAmount > 0 ? (totalCosts / approvedAmount) * 100 : 0;

    return (
        <>
            {isMaximized && !isMinimized && <div className={styles.overlay} style={{ zIndex: zIndex - 1 }} />}

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
                                    <div className={styles.ticketIcon}>ÃƒÂ°Ã…Â¸Ã…Â½Ã‚Â«</div>
                                )}
                                <div className={styles.titleInfo}>
                                    <h3>
                                        {ticketData.metadata?.titulo ||
                                            (ticketData.numeroTicketCliente
                                                ? ticketData.numeroTicketCliente
                                                : `Ticket #${ticketData.id.slice(-6)}`)
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

                    <div className={styles.windowControls} onMouseDown={(e) => e.stopPropagation()}>
                        {!isMinimized && (
                            <>
                                <button
                                    className={styles.controlBtn}
                                    onClick={(e) => { e.stopPropagation(); handleMinimize(); }}
                                    title="Minimizar"
                                >
                                    <Minimize2 size={16} />
                                </button>
                                <button
                                    className={styles.controlBtn}
                                    onClick={(e) => { e.stopPropagation(); handleMaximize(); }}
                                    title={isMaximized ? "Restaurar" : "Maximizar"}
                                >
                                    {isMaximized ? <Square size={14} /> : <Maximize2 size={16} />}
                                </button>
                            </>
                        )}
                        <button
                            className={`${styles.controlBtn} ${styles.closeBtn} ${isMinimized ? styles.minimizedClose : ''}`}
                            onClick={(e) => { e.stopPropagation(); onClose(); }}
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
                                title="RevisiÃƒÂ³n Inicial"
                                icon={FileText}
                                color="#8B5CF6"
                                gradient="linear-gradient(135deg, #F5F3FF, #EDE9FE)"
                            />

                            <GestoraAssignmentBar 
                                ticket={ticketData}
                                isAdmin={userRole === 'admin' || userRole === 'superadmin'}
                                onAssign={() => setShowGestoraDrawer(true)}
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
                            <PaymentHistoryBar ticket={ticketData} />
                            <UnifiedEvidenceBar ticket={ticketData} />
                            <DocumentationSummaryBar ticket={ticketData} />
                        </div>

                        <div className={styles.operationalArea}>
                            {children || (
                                <>
                                    {/* El MÃƒÂ³dulo de TesorerÃƒÂ­a General ha sido removido segÃƒÂºn solicitud para evitar redundancia visual */}


                                    {ticketData.estadoId === "borrador" && (
                                        <div className={styles.triageBox}>
                                            <div className={styles.triageHeader}>
                                                <Sparkles size={24} color="#8B5CF6" />
                                                <div style={{ textAlign: 'left' }}>
                                                    <h3 className={styles.triageTitle}>Bandeja de Triage - Mibanco</h3>
                                                    <p className={styles.triageSubtitle}>ClasificaciÃƒÂ³n y ValidaciÃƒÂ³n de Ticket AutomÃƒÂ¡tico</p>
                                                </div>
                                            </div>

                                            <div className={styles.triageForm}>
                                                {/* CAMPO EDITABLE: DescripciÃƒÂ³n del Problema */}
                                                <div className={styles.triageField}>
                                                    <label>Ã¢Å“ÂÃ¯Â¸Â DescripciÃƒÂ³n del Problema (Editable):</label>
                                                    <textarea
                                                        value={triageDescription}
                                                        onChange={(e) => setTriageDescription(e.target.value)}
                                                        className={styles.triageSelect}
                                                        rows={4}
                                                        placeholder="Describa el problema reportado..."
                                                        style={{ resize: 'vertical', fontFamily: 'inherit', fontSize: '0.9rem', fontWeight: 500 }}
                                                    />
                                                </div>

                                                {/* CAMPO SOLO LECTURA: Sede Reportada por Banco */}
                                                <div className={styles.triageField}>
                                                    <label>Ã°Å¸ÂÂ¦ Sede Reportada por Banco:</label>
                                                    <div className={styles.readonlyValue}>
                                                        {ticketData.sede_reportada_cliente || ticketData.metadata?.codigo_sede_extraido || "No especificada"}
                                                    </div>
                                                </div>

                                                {!ticketData.branch_id && !triageSedeId && (
                                                    <div className={styles.triageAlert}>
                                                        <AlertTriangle size={16} />
                                                        <span>Sede no mapeada automÃƒÂ¡ticamente. Seleccione manualmente para entrenar al sistema.</span>
                                                    </div>
                                                )}

                                                {/* VINCULAR A SEDE REAL */}
                                                <div className={styles.triageField}>
                                                    <label>Ã°Å¸ÂÂ¢ Vincular a Sede Real:</label>
                                                    {ticketData.branch_id ? (
                                                        // Ã¢Ëœâ€¦ FIX: Sede ya consolidada Ã¢â‚¬â€ bloquear modificaciÃƒÂ³n
                                                        <div className={styles.readonlyValue} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                            <span>Ã°Å¸â€â€™</span>
                                                            <span style={{ fontWeight: 700, color: '#1E293B' }}>
                                                                {sedesMibanco.find((s: any) => s.id === ticketData.branch_id)?.name
                                                                    || ticketData.sede?.nombre
                                                                    || ticketData.branch_id}
                                                            </span>
                                                            <span style={{ fontSize: '0.75rem', color: '#64748B' }}>(agencia ya consolidada Ã¢â‚¬â€ no modificable)</span>
                                                        </div>
                                                    ) : (
                                                        <select
                                                            value={triageSedeId}
                                                            onChange={(e) => setTriageSedeId(e.target.value)}
                                                            className={styles.triageSelect}
                                                            disabled={loadingSedes}
                                                        >
                                                            <option value="">{loadingSedes ? 'Cargando sedes...' : 'Seleccione una sede...'}</option>
                                                            {sedesMibanco.map((sede: any) => (
                                                                <option key={sede.id} value={sede.id}>
                                                                    {sede.name}{sede.address ? ` - ${sede.address}` : ''}
                                                                </option>
                                                            ))}
                                                        </select>
                                                    )}
                                                </div>

                                                {/* TIPO DE SERVICIO - Desde mÃƒÂ³dulo de TÃƒÂ©cnicos */}
                                                <div className={styles.triageField}>
                                                    <label>Ã°Å¸â€Â§ Tipo de Servicio (segÃƒÂºn catÃƒÂ¡logo de tÃƒÂ©cnicos):</label>
                                                    <select
                                                        value={triageServiceType}
                                                        onChange={(e) => setTriageServiceType(e.target.value)}
                                                        className={styles.triageSelect}
                                                    >
                                                        <option value="">Seleccione el tipo de servicio...</option>
                                                        {SERVICE_TYPES.map(st => (
                                                            <option key={st.id} value={st.id}>
                                                                {st.nombre}
                                                            </option>
                                                        ))}
                                                    </select>
                                                </div>

                                                <button
                                                    className={styles.triageActionBtn}
                                                    onClick={handleClasificarYActivar}
                                                    disabled={!triageServiceType || (!triageSedeId && !ticketData.branch_id)}
                                                >
                                                    <CheckCircle size={18} />
                                                    <span>Clasificar y Activar Ticket</span>
                                                </button>
                                            </div>
                                        </div>
                                    )}

                                    {ticketData.estadoId === "nuevo" && (
                                        <div className={styles.stepActions}>
                                            <p className={styles.stepHint}>
                                                Revise la informaciÃƒÂ³n y proceda a la asignaciÃƒÂ³n del especialista.
                                            </p>
                                            <button className={styles.mainActionBtn} onClick={handleProceedToAssignment}>
                                                <span>Asignar TÃƒÂ©cnico</span>
                                                <ArrowRight size={18} />
                                            </button>
                                        </div>
                                    )}

                                    {/* Ã¢Ëœâ€¦ ORDEN DE PAGO DE VISITA: Solo en el paso exacto donde corresponde.
                                         La condiciÃƒÂ³n es ESTRICTA:
                                         1. El estadoId debe ser 'esperando_pago_visita' Y
                                         2. visitPaymentConfirmed debe ser falso Y
                                         3. El ticket no debe haber avanzado mÃƒÂ¡s allÃƒÂ¡ (ningÃƒÂºn estado post-inspecciÃƒÂ³n)
                                    */}
                                    {ticketData.estadoId === "esperando_pago_visita" && !ticketData.visitPaymentConfirmed && (
                                            <div className={styles.stepPlaceholder}>
                                                <div className={styles.waitingForManager} style={{ padding: '40px', background: '#F8FAFC', borderRadius: '24px', border: '1px solid #E2E8F0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '15px' }}>
                                                    <div style={{ background: '#3B82F6', padding: '15px', borderRadius: '50%', color: 'white', display: 'flex' }}>
                                                        <Coins size={32} />
                                                    </div>
                                                    <div style={{ textAlign: 'center' }}>
                                                        <h3 style={{ margin: 0, color: '#1E293B', fontSize: '1.2rem', fontWeight: 800 }}>PAGO DE VISITA EN PROCESO</h3>
                                                        <p style={{ margin: '5px 0 0 0', color: '#64748B', fontWeight: 500 }}>
                                                            La gestiÃƒÂ³n financiera se realiza exclusivamente en el panel inferior "Desglose de Costos y Pagos".
                                                        </p>
                                                    </div>
                                                    <div style={{ background: '#EFF6FF', color: '#3B82F6', padding: '8px 16px', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 700 }}>
                                                        ESPERANDO CONFIRMACIÃƒâ€œN DE TESORERÃƒâ€œA
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                    {(ticketData.estadoId === "en_inspeccion" || (ticketData.estadoId === "esperando_pago_visita" && ticketData.visitPaymentConfirmed)) && (
                                        <div className={styles.stepPlaceholder}>
                                            <div className={styles.schedulingBox}>
                                                <div className={styles.schedulingHeader}>
                                                    <Calendar size={28} color="#8B5CF6" />
                                                    <div style={{ textAlign: 'left' }}>
                                                        <h3 style={{ margin: 0, fontSize: '18px', color: '#1F2937' }}>Agendar Visita TÃƒÂ©cnica</h3>
                                                        <p style={{ margin: '4px 0 0 0', fontSize: '14px', color: '#6B7280' }}>
                                                            Seleccione la fecha de ejecuciÃƒÂ³n acordada
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
                                                                programacionLabel: "MAÃƒâ€˜ANA",
                                                                estadoId: "visita_realizada"
                                                            };
                                                            setTicketData(updated);
                                                        }}
                                                    >
                                                        <span className={styles.optLabel}>MAÃƒâ€˜ANA</span>
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
                                                        <h3 className={styles.reportMainTitle}>Reporte TÃƒÂ©cnico de Campo</h3>
                                                        <p className={styles.reportSubtitle}>EvaluaciÃƒÂ³n tÃƒÂ©cnica y soluciÃƒÂ³n propuesta</p>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className={styles.diagnosticoArea}>
                                                <label className={styles.optimisticLabel}>DiagnÃƒÂ³stico TÃƒÂ©cnico Final</label>
                                                <textarea
                                                    placeholder="Describa el hallazgo y la soluciÃƒÂ³n tÃƒÂ©cnica..."
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
                                                            {/* BotÃƒÂ³n flotante para agregar mÃƒÂ¡s si ya hay fotos */}
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
                                                    <span>FINALIZAR REPORTE TÃƒâ€°CNICO</span>
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
                                                    <h3 className={styles.quotationTitle} style={{ fontSize: '18px', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.02em' }}>
                                                        {ticketData.estadoId === "en_cotizacion" ? "ElaboraciÃƒÂ³n de CotizaciÃƒÂ³n Formal" : "CotizaciÃƒÂ³n Aprobada y Registrada"}
                                                    </h3>
                                                    <p className={styles.quotationSubtitle} style={{ fontSize: '13px', color: '#64748b', marginTop: '2px', fontWeight: 500 }}>
                                                        {ticketData.estadoId === "en_cotizacion"
                                                            ? "Prepare el presupuesto final usando la plantilla oficial"
                                                            : isQuotationCollapsed ? "Pulse para ver detalles de la cotizaciÃƒÂ³n" : "Documento oficial del servicio. Los cambios requieren autorizaciÃƒÂ³n."
                                                        }
                                                    </p>
                                                </div>

                                                {["cotizacion_aprobada", "en_ejecucion", "documentacion_enviada", "por_liquidar", "pago_realizado", "ticket_cerrado"].includes(ticketData.estadoId) && (
                                                    <div className={styles.headerRightActions}>
                                                        {!ticketData.modificacionAutorizada && (
                                                            <div style={{ background: '#fef2f2', color: '#ef4444', padding: '4px 12px', borderRadius: '20px', fontSize: '11px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '5px', border: '1px solid #fee2e2' }}>
                                                                <X size={12} />
                                                                BLOQUEADA
                                                            </div>
                                                        )}
                                                        {ticketData.modificacionAutorizada && (
                                                            <div style={{ background: '#f0fdf4', color: '#22c55e', padding: '4px 12px', borderRadius: '20px', fontSize: '11px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '5px', border: '1px solid #dcfce7' }}>
                                                                <CheckCircle size={12} />
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
                                                                    <span className={styles.techCostLabel}>PRESUPUESTO TÃƒâ€°CNICO</span>
                                                                    <div className={styles.techCostDetail}>
                                                                        <div className={styles.techRow}>
                                                                            <label>Mano de Obra:</label>
                                                                            <span>S/ {formatSoles(ticketData.costoManoObra)}</span>
                                                                        </div>
                                                                        <div className={styles.techRow}>
                                                                            <label>Materiales:</label>
                                                                            <span>S/ {formatSoles(ticketData.costoMateriales)}</span>
                                                                        </div>
                                                                        {parseFloat(ticketData.costoVisita || 0) > 0 && (
                                                                            <div className={styles.techRow}>
                                                                                <label>Gasto de Visita:</label>
                                                                                <span>S/ {formatSoles(ticketData.costoVisita)}</span>
                                                                            </div>
                                                                        )}
                                                                        <div className={styles.techRowTotal}>
                                                                            <label>Costo Directo Total:</label>
                                                                            <strong>S/ {formatSoles((round2(ticketData.costoManoObra || 0) + round2(ticketData.costoMateriales || 0)) || round2(ticketData.costoVisita || 0))}</strong>
                                                                        </div>
                                                                    </div>
                                                                </div>

                                                                <div className={styles.suggestedTotal}>
                                                                    <span>PRECIO OBJETIVO (55% MARGEN)</span>
                                                                    <div className={styles.suggestedValue}>
                                                                        S/ {formatSoles(round2(((round2(ticketData.costoManoObra || 0) + round2(ticketData.costoMateriales || 0)) || round2(ticketData.costoVisita || 0)) / 0.45))}
                                                                    </div>
                                                                </div>

                                                                <div className={styles.missingAmountCard}>
                                                                    <div className={styles.missingHeader}>
                                                                        <span>CUMPLIMIENTO DE META</span>
                                                                        <strong>
                                                                            {((montoTotalCotizado / (((parseFloat(ticketData.costoManoObra || 0) + parseFloat(ticketData.costoMateriales || 0)) / 0.45) || 1)) * 100).toFixed(0)}%
                                                                        </strong>
                                                                    </div>
                                                                    <div className={styles.missingValue}>
                                                                        {(() => {
                                                                            const totalCostoTecnico = (parseFloat(ticketData.costoManoObra || 0) + parseFloat(ticketData.costoMateriales || 0)) || parseFloat(ticketData.costoVisita || 0);
                                                                            const meta55 = totalCostoTecnico / 0.45;

                                                                            if (montoTotalCotizado < totalCostoTecnico) {
                                                                                return (
                                                                                    <div className={styles.lossWarning}>
                                                                                        <div className={styles.lossTitle}>
                                                                                            <X size={16} /> {/* O AlertTriangle si estuviera importado, pero X estÃƒÂ¡ disponible */}
                                                                                            <span>ÃƒÂ¢Ã…Â¡Ã‚Â ÃƒÂ¯Ã‚Â¸Ã‚Â PERDIDA DETECTADA</span>
                                                                                        </div>
                                                                                        <span className={styles.lossValue}>
                                                                                            El presupuesto es menor al costo tÃƒÂ©cnico (S/ {formatSoles(totalCostoTecnico)})
                                                                                        </span>
                                                                                    </div>
                                                                                );
                                                                            }

                                                                            if (montoTotalCotizado < meta55) {
                                                                                return (
                                                                                    <>
                                                                                        <span className={styles.missingLabel}>FALTAN PARA META 55%:</span>
                                                                                        <strong className={styles.missingAmount}>
                                                                                            S/ {formatSoles(meta55 - montoTotalCotizado)}
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
                                                                    ÃƒÂ°Ã…Â¸Ã¢â‚¬â„¢Ã‚Â¡ Ajuste los precios en el editor de la derecha para cubrir el costo tÃƒÂ©cnico y alcanzar el margen operativo sugerido.
                                                                </p>
                                                            )}

                                                            {["cotizacion_aprobada", "en_ejecucion", "documentacion_enviada", "por_liquidar", "pago_realizado", "ticket_cerrado"].includes(ticketData.estadoId) && !ticketData.modificacionAutorizada && (
                                                                <div className={styles.authorizationSection}>
                                                                    <div className={styles.authLockIcon}>ÃƒÂ°Ã…Â¸Ã¢â‚¬ÂÃ¢â‚¬â„¢</div>
                                                                    <p className={styles.authText}>
                                                                        La cotizaciÃƒÂ³n ya fue aprobada por el cliente. Para realizar cambios, se requiere el visto bueno de Gerencia.
                                                                    </p>
                                                                    <button
                                                                        className={styles.authorizeBtn}
                                                                        onClick={handleAuthorizeModification}
                                                                    >
                                                                        Autorizar ModificaciÃƒÂ³n
                                                                    </button>
                                                                </div>

                                                            )}
                                                        </div>
                                                    </div>
                                                    <div className={styles.quotationMainEditor}>
                                                        {/* LÃƒâ€œgica Diferenciada: BCP vs Otros Clientes */}
                                                        {ticketData.cliente?.nombre?.toUpperCase().includes("BCP") ? (
                                                            <div style={{ background: '#ffffff', padding: '20px', borderRadius: '16px', border: '1px solid #e2e8f0', marginBottom: '20px', boxShadow: '0 4px 20px rgba(0,0,0,0.03)' }}>
                                                                <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '20px' }}>
                                                                    <div style={{ background: 'linear-gradient(135deg, #0284c7, #0369a1)', padding: '12px', borderRadius: '12px', boxShadow: '0 4px 12px rgba(2, 132, 199, 0.2)' }}>
                                                                        <FileSpreadsheet size={24} color="#ffffff" />
                                                                    </div>
                                                                    <div>
                                                                        <h4 style={{ margin: 0, color: '#0f172a', fontSize: '17px', fontWeight: 800 }}>CotizaciÃƒÂ³n Formato BCP</h4>
                                                                        <p style={{ margin: 0, color: '#64748b', fontSize: '13px', fontWeight: 500 }}>
                                                                            Uso obligatorio de la plantilla oficial de Excel.
                                                                        </p>
                                                                    </div>
                                                                </div>

                                                                {/* Zona de Carga / VisualizaciÃƒÂ³n */}
                                                                {!bcpQuotationFile ? (
                                                                    <div
                                                                        onClick={() => (ticketData.estadoId === 'en_cotizacion' || ticketData.modificacionAutorizada) && bcpFileInputRef.current?.click()}
                                                                        style={{
                                                                            cursor: (ticketData.estadoId === 'en_cotizacion' || ticketData.modificacionAutorizada) ? 'pointer' : 'not-allowed',
                                                                            padding: '30px',
                                                                            background: '#f8fafc',
                                                                            borderRadius: '16px',
                                                                            textAlign: 'center',
                                                                            border: '2px dashed #cbd5e1',
                                                                            transition: 'all 0.3s ease',
                                                                            display: 'flex',
                                                                            flexDirection: 'column',
                                                                            alignItems: 'center',
                                                                            gap: '12px',
                                                                            position: 'relative'
                                                                        }}
                                                                    >
                                                                        <div style={{ background: '#ffffff', padding: '16px', borderRadius: '50%', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
                                                                            <Upload size={28} color='#0284c7' />
                                                                        </div>
                                                                        <div>
                                                                            <h5 style={{ margin: '0 0 4px 0', fontSize: '16px', fontWeight: 700, color: '#0f172a' }}>Cargar Plantilla Excel</h5>
                                                                            <span style={{ fontSize: '13px', color: '#64748b', fontWeight: 500 }}>Haga clic para adjuntar archivo .xlsx</span>
                                                                        </div>
                                                                    </div>
                                                                ) : (
                                                                    <div style={{ background: 'white', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 2px 4px rgba(0,0,0,0.03)' }}>
                                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                                                                            <div style={{ background: '#dcfce7', padding: '12px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                                                <FileSpreadsheet size={32} color="#16a34a" />
                                                                            </div>
                                                                            <div style={{ flex: 1 }}>
                                                                                <p style={{ margin: '0 0 4px 0', fontWeight: 600, fontSize: '15px', color: '#1e293b' }}>{bcpQuotationFile.name}</p>
                                                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                                                    <span style={{ fontSize: '12px', color: '#64748b', background: '#f1f5f9', padding: '2px 8px', borderRadius: '4px' }}>EXCEL</span>
                                                                                    <span style={{ fontSize: '12px', color: '#94a3b8' }}>ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢ Subido el {new Date(bcpQuotationFile.fecha).toLocaleDateString()}</span>
                                                                                </div>
                                                                            </div>
                                                                            {(ticketData.estadoId === "en_cotizacion" || ticketData.modificacionAutorizada) && (
                                                                                <button
                                                                                    onClick={() => setBcpQuotationFile(null)}
                                                                                    style={{
                                                                                        background: '#fee2e2',
                                                                                        border: 'none',
                                                                                        cursor: 'pointer',
                                                                                        color: '#ef4444',
                                                                                        padding: '10px',
                                                                                        borderRadius: '8px',
                                                                                        transition: 'background 0.2s'
                                                                                    }}
                                                                                    title="Eliminar archivo"
                                                                                >
                                                                                    <Trash2 size={20} />
                                                                                </button>
                                                                            )}
                                                                        </div>
                                                                        {/* Enlace de descarga si ya fue enviado/bloqueado */}
                                                                        {(!["en_cotizacion"].includes(ticketData.estadoId) && !ticketData.modificacionAutorizada) && (
                                                                            <div style={{ marginTop: '15px', paddingTop: '15px', borderTop: '1px solid #f1f5f9' }}>
                                                                                <a href={bcpQuotationFile.url} download={bcpQuotationFile.name} style={{ fontSize: '13px', color: '#2563eb', textDecoration: 'none', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                                                    <Download size={14} /> Descargar Archivo Original
                                                                                </a>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                )}
                                                                {/* Resumen Financiero Manual */}
                                                                <div style={{
                                                                    marginTop: '20px',
                                                                    padding: '24px',
                                                                    background: 'linear-gradient(145deg, #f8fafc, #f1f5f9)',
                                                                    borderRadius: '16px',
                                                                    border: '1px solid #e2e8f0',
                                                                    display: 'grid',
                                                                    gridTemplateColumns: 'repeat(3, 1fr)',
                                                                    gap: '24px',
                                                                    boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.02)'
                                                                }}>
                                                                    <div>
                                                                        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 700, color: '#334155', marginBottom: '10px' }}>
                                                                            <FileText size={14} color='#0284c7' /> Subtotal (S/)
                                                                        </label>
                                                                        <div style={{ position: 'relative' }}>
                                                                            <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', fontSize: '14px', fontWeight: 700 }}>S/</span>
                                                                            <input
                                                                                type='number'
                                                                                value={montoSubtotal || ''}
                                                                                onChange={(e) => {
                                                                                    const sub = round2(e.target.value);
                                                                                    const igvValue = round2(sub * 0.18);
                                                                                    const totalValue = round2(sub + igvValue);
                                                                                    setMontoSubtotal(sub);
                                                                                    setMontoIGV(igvValue);
                                                                                    setMontoTotalCotizado(totalValue);
                                                                                }}
                                                                                placeholder='0.00'
                                                                                style={{ width: '100%', padding: '12px 12px 12px 35px', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '15px', fontWeight: 700, color: '#0f172a', background: '#ffffff', outline: 'none' }}
                                                                            />
                                                                        </div>
                                                                    </div>

                                                                    <div>
                                                                        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 700, color: '#334155', marginBottom: '10px' }}>
                                                                            <Percent size={14} color='#0284c7' /> IGV (18%) (S/)
                                                                        </label>
                                                                        <div style={{ position: 'relative' }}>
                                                                            <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', fontSize: '14px', fontWeight: 700 }}>S/</span>
                                                                            <input
                                                                                type='number'
                                                                                value={montoIGV || ''}
                                                                                readOnly
                                                                                placeholder='0.00'
                                                                                style={{ width: '100%', padding: '12px 12px 12px 35px', borderRadius: '10px', border: '1px solid #e2e8f0', fontSize: '15px', fontWeight: 700, color: '#64748b', background: '#f8fafc', outline: 'none', cursor: 'not-allowed' }}
                                                                            />
                                                                        </div>
                                                                    </div>

                                                                    <div>
                                                                        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 700, color: '#334155', marginBottom: '10px' }}>
                                                                            <DollarSign size={14} color='#0369a1' /> Total Cotizado (S/)
                                                                        </label>
                                                                        <div style={{ position: 'relative' }}>
                                                                            <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#0369a1', fontWeight: 800, fontSize: '14px' }}>S/</span>
                                                                            <input
                                                                                type='number'
                                                                                value={montoTotalCotizado || ''}
                                                                                readOnly
                                                                                placeholder='0.00'
                                                                                style={{ width: '100%', padding: '12px 12px 12px 35px', borderRadius: '10px', border: '2px solid #0284c7', fontSize: '16px', fontWeight: 800, color: '#0369a1', background: '#f0f9ff', outline: 'none', cursor: 'not-allowed' }}
                                                                            />
                                                                        </div>
                                                                    </div>
                                                                </div>

                                                                <p style={{ fontSize: '12px', color: '#94a3b8', marginTop: '12px', fontStyle: 'italic' }}>
                                                                    * El sistema calcula automÃƒÂ¡ticamente el IGV (18%) y el Total basÃƒÂ¡ndose en el subtotal ingresado para garantizar la precisiÃƒÂ³n.
                                                                </p>
                                                                <input
                                                                    type='file'
                                                                    ref={bcpFileInputRef}
                                                                    onChange={handleBcpFileUpload}
                                                                    accept='.xlsx, .xls'
                                                                    style={{ display: 'none' }}
                                                                />
                                                            </div>
                                                        ) : (
                                                            // --- VISTA ESTÃƒâ€œÃ‚ÂNDAR (EDITOR PDF) ---
                                                            <OnlineQuotationEditor
                                                                ref={quotationEditorRef}
                                                                isLocked={["cotizacion_aprobada", "en_ejecucion", "documentacion_enviada", "por_liquidar", "pago_realizado", "ticket_cerrado"].includes(ticketData.estadoId) && !ticketData.modificacionAutorizada}
                                                                clientInfo={ticketData.cliente}
                                                                sedeInfo={ticketData.sede}
                                                                servicioId={ticketData.servicioId}
                                                                ticketId={ticketData.numeroTicketCliente || ticketData.id}
                                                                initialItems={partidasCotizacion}
                                                                suggestedTotal={round2((round2(ticketData.costoManoObra || 0) + round2(ticketData.costoMateriales || 0) + round2(ticketData.costoVisita || 0)) / 0.45)}
                                                                onUpdate={(items: any[], total: number) => {
                                                                    setPartidasCotizacion(items);
                                                                    setMontoTotalCotizado(total);
                                                                }}
                                                            />
                                                        )}

                                                        <div className={styles.finalActionsOptimistic}>
                                                            {ticketData.estadoId === "en_cotizacion" ? (
                                                                <button
                                                                    className={styles.sendQuoteBtnFinal}
                                                                    disabled={ticketData.cliente?.nombre?.toUpperCase().includes("BCP") ? (!bcpQuotationFile || montoTotalCotizado <= 0) : montoTotalCotizado <= 0}
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
                                                                        showToast("CotizaciÃƒÂ³n Guardada", "Cambios guardados y cotizaciÃƒÂ³n bloqueada nuevamente.", "success");
                                                                    }}
                                                                >
                                                                    <CheckCircle size={18} />
                                                                    <span>GUARDAR CAMBIOS Y VOLVER A BLOQUEAR</span>
                                                                </button>
                                                            ) : (
                                                                <div className={styles.readonlyNotice}>
                                                                    La cotizaciÃƒÂ³n se encuentra en modo lectura.
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {ticketData.estadoId === "cotizacion_enviada" && (
                                        <div style={{
                                            textAlign: 'center',
                                            padding: '60px 40px',
                                            background: '#ffffff',
                                            borderRadius: '32px',
                                            boxShadow: '0 20px 50px rgba(0,0,0,0.05)',
                                            border: '1px solid #f1f5f9',
                                            maxWidth: '650px',
                                            margin: '30px auto',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            alignItems: 'center',
                                            gap: '24px'
                                        }}>
                                            <div style={{ position: 'relative' }}>
                                                <div style={{
                                                    background: 'linear-gradient(135deg, #dcfce7, #bbf7d0)',
                                                    padding: '28px',
                                                    borderRadius: '50%',
                                                    display: 'inline-flex',
                                                    boxShadow: '0 12px 24px rgba(34, 197, 94, 0.15)'
                                                }}>
                                                    <Sparkles size={48} color='#15803d' />
                                                </div>
                                                <div style={{
                                                    position: 'absolute',
                                                    bottom: -8,
                                                    right: -8,
                                                    background: '#22c55e',
                                                    color: 'white',
                                                    borderRadius: '50%',
                                                    padding: '6px',
                                                    border: '4px solid #ffffff',
                                                    boxShadow: '0 4px 10px rgba(0,0,0,0.1)'
                                                }}>
                                                    <CheckCircle size={20} />
                                                </div>
                                            </div>

                                            <div>
                                                <h3 style={{ margin: '0 0 12px 0', fontSize: '28px', fontWeight: 900, color: '#0f172a', letterSpacing: '-0.04em' }}>
                                                    CotizaciÃ³n Enviada con Ã‰xito
                                                </h3>
                                                <p style={{ margin: 0, fontSize: '16px', color: '#64748b', lineHeight: 1.7, fontWeight: 500 }}>
                                                    El presupuesto formal ha sido enviado al correo del cliente.<br />
                                                    El ticket permanecerÃ¡ en pausa hasta esperar <strong>aprobaciÃ³n</strong> o solicitud de ajuste.
                                                </p>
                                            </div>

                                            <div style={{
                                                background: 'linear-gradient(135deg, #fff7ed, #ffedd5)',
                                                padding: '14px 28px',
                                                borderRadius: '16px',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '12px',
                                                border: '1px solid #fed7aa',
                                                boxShadow: '0 4px 12px rgba(251, 146, 60, 0.05)'
                                            }}>
                                                <Clock size={18} color='#c2410c' />
                                                <span style={{ fontSize: '14px', fontWeight: 800, color: '#c2410c', letterSpacing: '0.03em' }}>
                                                    ESPERANDO APROBACIÃ“N DEL CLIENTE
                                                </span>
                                            </div>

                                            <div style={{ display: 'flex', flexDirection: 'column', width: '100%', gap: '14px', marginTop: '10px' }}>
                                                <button
                                                    onClick={handleApproveQuote}
                                                    style={{
                                                        background: 'linear-gradient(135deg, #22c55e, #16a34a)',
                                                        color: 'white',
                                                        border: 'none',
                                                        padding: '20px 32px',
                                                        borderRadius: '18px',
                                                        fontSize: '16px',
                                                        fontWeight: 800,
                                                        cursor: 'pointer',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        gap: '12px',
                                                        boxShadow: '0 8px 20px rgba(34, 197, 94, 0.25)',
                                                        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
                                                    }}
                                                >
                                                    <ThumbsUp size={22} />
                                                    <span>REGISTRAR APROBACIÃ“N DEL CLIENTE</span>
                                                </button>

                                                <button
                                                    onClick={() => setTicketData({ ...ticketData, estadoId: 'en_cotizacion' })}
                                                    style={{
                                                        background: 'transparent',
                                                        color: '#64748b',
                                                        border: '2px solid #f1f5f9',
                                                        padding: '14px 28px',
                                                        borderRadius: '16px',
                                                        fontSize: '15px',
                                                        fontWeight: 600,
                                                        cursor: 'pointer',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: '10px',
                                                        transition: 'all 0.2s ease'
                                                    }}
                                                >
                                                    RENEGOCIAR COTIZACIÃ“N
                                                </button>
                                            </div>
                                        </div>
                                    )}

                                    {["cotizacion_aprobada", "en_ejecucion"].includes(ticketData.estadoId) && (
                                        <div className={styles.stepActions}>
                                            <div className={styles.operationalFlowCard}>
                                                {ticketData.estadoId === "cotizacion_aprobada" && (
                                                    <div className={styles.approvedStatusNotice}>
                                                        <div className={styles.approvedIcon}>Ã¢Å“â€¦</div>
                                                        <div style={{ textAlign: 'left' }}>
                                                            <h3 style={{ margin: 0, color: '#065F46', fontSize: '1.2rem', fontWeight: 800 }}>Presupuesto Aprobado por Cliente</h3>
                                                            <p style={{ margin: '4px 0 0 0', fontSize: '0.9rem', color: '#059669', fontWeight: 500 }}>
                                                                Proceda con la ejecuciÃƒÂ³n de los trabajos segÃƒÂºn lo cotizado.
                                                            </p>
                                                        </div>
                                                    </div>
                                                )}

                                                <div className={styles.executionGrid}>
                                                    <div className={styles.evidenceSection}>
                                                        <div className={styles.sectionHeaderMini}>
                                                            <Camera size={18} />
                                                            <h4>EVIDENCIAS DE EJECUCIÃƒâ€œN</h4>
                                                        </div>
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
                                                                <span>Adjuntar Foto</span>
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
                                                        <p className={styles.operationalHint}>
                                                            * Se requieren al menos 2 evidencias para finalizar el trabajo.
                                                        </p>
                                                    </div>

                                                    <div className={styles.flowActionsSection}>
                                                        <button
                                                            className={styles.finishWorkBtn}
                                                            onClick={handleFinishExecution}
                                                            disabled={evidenciasEjecucion.length < 2}
                                                        >
                                                            <CheckCircle size={20} />
                                                            <span>FINALIZAR TRABAJOS Y ENVIAR DOCUMENTACIÃƒâ€œN</span>
                                                        </button>
                                                        <p style={{ fontSize: '0.75rem', color: '#94A3B8', marginTop: '10px', textAlign: 'center' }}>
                                                            La gestiÃƒÂ³n financiera de este ticket se realiza exclusivamente en el panel inferior.
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {ticketData.estadoId === "documentacion_enviada" && (
                                        <div className={styles.checklistContainer}>
                                            <div className={styles.checklistCard}>
                                                <div className={styles.checklistHeader}>
                                                    <ClipboardCheck size={32} color="#6366F1" />
                                                    <div style={{ textAlign: 'left' }}>
                                                        <h3 className={styles.checklistTitle}>Checklist de Cierre y DocumentaciÃƒÂ³n</h3>
                                                        <p className={styles.checklistSubtitle}>Valide los documentos obligatorios para proceder a la liquidaciÃƒÂ³n</p>
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
                                                            <span>Sustento de recepciÃƒÂ³n del cliente</span>
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
                                                            <strong>3. DECLARACIÃƒâ€œN JURADA</strong>
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

                                                    {/* Nuevo Item: NÃƒÂºmero de Ticket del Cliente */}
                                                    <div
                                                        className={`${styles.checkItem} ${ticketData.numeroTicketCliente ? styles.checkItemActive : styles.checkItemAlert}`}
                                                        style={{ cursor: 'default' }}
                                                    >
                                                        <div className={styles.checkSquare}>
                                                            {ticketData.numeroTicketCliente ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} color="#EF4444" />}
                                                        </div>
                                                        <div className={styles.checkText}>
                                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                                <strong>5. NÃƒâ€œÃ…Â¡MERO DE TICKET DEL CLIENTE</strong>
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
                                                                // Si el ticket ya venÃƒÂ­a con nÃƒÂºmero asignado (desde props), bloquear ediciÃƒÂ³n
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
                                                                    Ã‚Â¡OBLIGATORIO: PENDIENTE DE ASIGNAR!
                                                                </span>
                                                            )}
                                                            {ticketData.numeroTicketCliente && !(/^MB\d{6}\.\d{2}$/.test(ticketData.numeroTicketCliente)) && (
                                                                <span style={{ color: '#F59E0B', fontSize: '0.65rem', fontWeight: 700, marginTop: '4px', lineHeight: '1.2' }}>
                                                                    FORMATO REQUERIDO: MB + 6 DÃƒâ€œÃ‚ÂGITOS + PUNTO + AÃƒâ€œÃ¢â‚¬ËœO (26)<br />
                                                                    Ejemplo: MB000025.{new Date().getFullYear().toString().slice(-2)}
                                                                </span>
                                                            )}
                                                            {ticketData.numeroTicketCliente && (/^MB\d{6}\.\d{2}$/.test(ticketData.numeroTicketCliente)) && (
                                                                <span style={{ color: '#059669', fontSize: '0.65rem', fontWeight: 800, marginTop: '4px' }}>
                                                                    ÃƒÂ¢Ã…â€œÃ¢â‚¬Å“ FORMATO VÃƒâ€œÃ‚ÂLIDO
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
                                                        showToast("DocumentaciÃƒÂ³n Validada", "El ticket ha pasado a liquidaciÃƒÂ³n final.", "success");
                                                    }}
                                                >
                                                    <span>PASAR A LIQUIDACIÃƒâ€œN FINAL</span>
                                                    <ArrowRight size={20} />
                                                </button>

                                                {(!Object.values(documentosChecklist).every(v => v) || !ticketData.numeroTicketCliente) && (
                                                    <p className={styles.checklistAlert}>
                                                        * Todos los documentos y el nÃƒÂºmero de ticket del cliente son obligatorios para continuar.
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
                                                            {ticketData.estadoId === "ticket_cerrado" ? "Servicio Concluido y Liquidado" : "LiquidaciÃƒÂ³n Final de Servicio"}
                                                        </h3>
                                                        <span style={ticketData.estadoId === "ticket_cerrado" ? { color: 'rgba(255,255,255,0.8)' } : {}}>
                                                            {ticketData.estadoId === "ticket_cerrado" ? "Toda la informaciÃƒÂ³n financiera ha sido auditada y cerrada." : "CÃƒÂ¡lculo automÃƒÂ¡tico del saldo pendiente para el tÃƒÂ©cnico"}
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
                                                        <span className={styles.liquidationLabel}>Total DepÃƒâ€œsitos Realizados</span>
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
                                                    <h4>Datos de Pago del TÃƒÂ©cnico: {ticketData.tecnico?.nombre} {ticketData.tecnico?.apellido}</h4>
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

                                                {ticketData.estadoId === "por_liquidar" && (
                                                    <div className={styles.waitingForManager} style={{ padding: '30px', background: '#F8FAFC', borderRadius: '20px', border: '1px solid #E2E8F0', marginTop: '20px' }}>
                                                        <Clock size={28} color="#3B82F6" />
                                                        <span style={{ fontSize: '1.2rem', color: '#1E293B', fontWeight: 800 }}>LIQUIDACIÃƒâ€œN EN PROCESO</span>
                                                        <span style={{ fontSize: '0.9rem', color: '#64748B', fontWeight: 500, maxWidth: '400px', textAlign: 'center' }}>
                                                            Registre el depÃƒÂ³sito final en el panel de <strong>TesorerÃƒÂ­a</strong> inferior para cerrar este ticket definitivamente.
                                                        </span>
                                                    </div>
                                                )}

                                                {ticketData.estadoId === "ticket_cerrado" && (
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
                                            <p>Este mÃƒÂ³dulo operativo se encuentra en preparaciÃƒÂ³n.</p>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>

                        {/* ========================================
                            Ã°Å¸â€œÅ  GESTIÃƒâ€œN DE COSTOS Y EGRESOS
                           ======================================== */}
                        <div className={styles.costsSection}>
                            <div className={styles.costsHeader}>
                                <div className={styles.costsTitleGroup}>
                                    <div style={{ background: '#1E293B', padding: '10px', borderRadius: '12px', color: 'white', display: 'flex' }}>
                                        <Receipt size={22} />
                                    </div>
                                    <div>
                                        <h3>Desglose de Costos y Pagos</h3>
                                        <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748B', fontWeight: 600 }}>
                                            Control de egresos y rentabilidad real del servicio
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div className={styles.costsStatsGrid}>
                                <div className={styles.costStatCard}>
                                    <span className={styles.statLabel}>Total Gastos Operativos</span>
                                    <div className={styles.statValue}>S/ {totalCosts.toFixed(2)}</div>
                                </div>
                                <div className={styles.costStatCard}>
                                    <span className={styles.statLabel}>Margen Bruto Real</span>
                                    <div className={`${styles.statValue} ${grossMargin >= 0 ? styles.positive : styles.negative}`}>
                                        S/ {grossMargin.toFixed(2)}
                                    </div>
                                </div>
                                <div className={styles.costStatCard}>
                                    <span className={styles.statLabel}>Capital Expuesto</span>
                                    <div className={styles.statValue} style={{ color: '#F59E0B' }}>
                                        S/ {capitalExposed.toFixed(2)}
                                    </div>
                                </div>
                            </div>

                            {approvedAmount > 0 && (
                                <div className={styles.profitabilityIndicator}>
                                    <div className={styles.indicatorHeader}>
                                        <span>Consumo del Presupuesto Aprobado</span>
                                        <span style={{ 
                                            color: costPercentage > 70 ? '#EF4444' : '#1E293B',
                                            fontWeight: 800,
                                            fontSize: '1rem'
                                        }}>
                                            {costPercentage.toFixed(1)}%
                                        </span>
                                    </div>
                                    <div className={styles.progressBarWrapper}>
                                        <div 
                                            className={styles.progressBar}
                                            style={{ 
                                                width: `${Math.min(100, costPercentage)}%`,
                                                backgroundColor: costPercentage > 90 ? '#EF4444' : costPercentage > 70 ? '#F59E0B' : '#10B981'
                                            }}
                                        />
                                    </div>
                                    {costPercentage > 70 && (
                                        <div className={styles.progressAlert + " " + styles.alertWarning}>
                                            <AlertTriangle size={18} />
                                            <span>¡RENTABILIDAD CRÍTICA! Los gastos han superado el presupuesto base.</span>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* -- ALERTA: M.O. excede presupuesto aprobado -- */}
                            {(() => {
                                const moAprobada = parseFloat(ticketData.labor_cost || ticketData.costoManoObra || 0);
                                const moRegistrada = ticketCosts
                                    .filter((c:any) => c.categoria === 'Mano de Obra')
                                    .reduce((s: number, c: any) => s + parseFloat(c.monto || 0), 0);
                                if (moAprobada > 0 && moRegistrada > moAprobada) {
                                    return (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '12px', padding: '12px 16px', marginBottom: '12px' }}>
                                            <AlertTriangle size={16} color="#DC2626" style={{ flexShrink: 0 }} />
                                            <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#991B1B' }}>
                                                La suma de M.O. (S/ {moRegistrada.toFixed(2)}) supera el presupuesto aprobado (S/ {moAprobada.toFixed(2)}) por S/ {(moRegistrada - moAprobada).toFixed(2)}.
                                            </span>
                                        </div>
                                    );
                                }
                                return null;
                            })()}

                            {/* â€” TABLA DE EGRESOS DETALLADA â€” */}
                            <div className={styles.costsTableContainer}>
                                {ticketCosts.length > 0 ? (
                                    <>
                                    <table className={styles.costsTable}>
                                        <thead>
                                            <tr>
                                                <th>CategorÃ­a</th>
                                                <th>Concepto / Especialista</th>
                                                <th>Monto</th>
                                                <th>Estado</th>
                                                <th>Voucher</th>
                                                <th style={{ textAlign: 'center' }}>Acciones</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {ticketCosts.map((c) => {
                                                const techName = c.technicians
                                                    ? (c.technicians.name ||
                                                       `${c.technicians.first_name || ''} ${c.technicians.last_name || ''}`.trim())
                                                    : (c.proveedor || null);
                                                return (
                                                    <tr key={c.id}>
                                                        <td>
                                                            <span className={`${styles.costCategoryBadge} ${styles['cat-' + (c.categoria || 'Otros').replace(' ', '')]}`}>
                                                                {c.categoria}
                                                            </span>
                                                        </td>
                                                        <td>
                                                            <div style={{ fontWeight: 700, color: '#1E293B' }}>{c.concepto || c.concept}</div>
                                                            {techName && (
                                                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.72rem', color: c.technicians ? '#4F46E5' : '#64748B', fontWeight: 600, marginTop: '2px' }}>
                                                                    {c.technicians ? <User size={10} /> : null}
                                                                    {techName}
                                                                </div>
                                                            )}
                                                            {!techName && <div style={{ fontSize: '0.72rem', color: '#CBD5E1' }}>Sin proveedor</div>}
                                                        </td>
                                                        <td style={{ fontWeight: 800, color: '#1E293B' }}>S/ {(parseFloat(c.monto) || 0).toFixed(2)}</td>
                                                        <td>
                                                            <span className={`${styles.costStatusBadge} ${styles['badge-' + (c.estado_pago || 'pendiente').toLowerCase()]}`}>
                                                                {c.estado_pago}
                                                            </span>
                                                        </td>
                                                        <td>
                                                            {c.url_comprobante ? (
                                                                <button
                                                                    className={styles.voucherViewBtn}
                                                                    onClick={() => window.open(c.url_comprobante, '_blank')}
                                                                >
                                                                    <Camera size={16} />
                                                                    <span>Ver</span>
                                                                </button>
                                                            ) : (
                                                                <span style={{ fontSize: '0.75rem', color: '#94A3B8' }}>Sin adjunto</span>
                                                            )}
                                                        </td>
                                                        <td style={{ textAlign: 'center' }}>
                                                            <button
                                                                className={styles.deleteCostBtn}
                                                                onClick={() => handleDeleteCost(c.id)}
                                                                title="Eliminar gasto"
                                                            >
                                                                <Trash2 size={18} />
                                                            </button>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>

                                    {/* â€” RESUMEN AGRUPADO POR ESPECIALISTA (MO) â€” */}
                                    {(() => {
                                        const moItems = ticketCosts.filter(c => c.categoria === 'Mano de Obra' && c.technicians);
                                        if (moItems.length === 0) return null;
                                        const grouped: { [id: string]: { name: string; total: number; pagado: boolean } } = {};
                                        moItems.forEach((c: any) => {
                                            const id = c.specialist_id || 'ext';
                                            const tname = c.technicians?.name || `${c.technicians?.first_name || ''} ${c.technicians?.last_name || ''}`.trim() || 'Ext';
                                            if (!grouped[id]) grouped[id] = { name: tname, total: 0, pagado: true };
                                            grouped[id].total += parseFloat(c.monto || 0);
                                            if (c.estado_pago !== 'pagado') grouped[id].pagado = false;
                                        });
                                        const moAprobada = parseFloat(ticketData.labor_cost || ticketData.costoManoObra || 0);
                                        const moTotal = Object.values(grouped).reduce((s, g) => s + g.total, 0);
                                        return (
                                            <div style={{ marginTop: '14px', background: 'linear-gradient(135deg, #EEF2FF, #F5F3FF)', border: '1px solid #C7D2FE', borderRadius: '14px', padding: '14px 18px' }}>
                                                <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#4338CA', letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                    <User size={13} /> LiquidaciÃ³n por Especialista
                                                </div>
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                    {Object.entries(grouped).map(([id, g]) => (
                                                        <div key={id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: 'white', borderRadius: '10px', border: '1px solid #E0E7FF' }}>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                                <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#6366F1', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 800 }}>
                                                                    {g.name.charAt(0).toUpperCase()}
                                                                </div>
                                                                <span style={{ fontWeight: 700, color: '#1E293B', fontSize: '0.85rem' }}>{g.name}</span>
                                                            </div>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                                <span style={{ fontSize: '0.9rem', fontWeight: 900, color: '#1E293B' }}>S/ {g.total.toFixed(2)}</span>
                                                                <span style={{ fontSize: '0.7rem', fontWeight: 700, padding: '2px 8px', borderRadius: '999px', background: g.pagado ? '#D1FAE5' : '#FEF3C7', color: g.pagado ? '#065F46' : '#92400E' }}>
                                                                    {g.pagado ? 'PAGADO' : 'PENDIENTE'}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                                <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px dashed #C7D2FE', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                    <span style={{ fontSize: '0.8rem', color: '#4338CA', fontWeight: 700 }}>Total M.O. registrada</span>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                        <span style={{ fontWeight: 900, color: '#1E293B' }}>S/ {moTotal.toFixed(2)}</span>
                                                        {moAprobada > 0 && (
                                                            <span style={{ fontSize: '0.72rem', color: '#64748B' }}>/ S/ {moAprobada.toFixed(2)} aprobado</span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })()}
                                    </>
                                ) : (
                                    <div className={styles.emptyCostsState}>
                                        <div style={{ background: '#F1F5F9', padding: '24px', borderRadius: '50%', color: '#94A3B8' }}>
                                            <Calculator size={48} />
                                        </div>
                                        <div>
                                            <p style={{ margin: 0, fontWeight: 800, color: '#475569', fontSize: '1.1rem' }}>Sin gastos registrados</p>
                                            <p style={{ margin: '4px 0 0 0', fontSize: '0.9rem', color: '#94A3B8' }}>Ingrese los costos operativos para monitorear el margen de utilidad.</p>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* â€” FORMULARIO AÃ‘ADIR GASTO â€” */}
                            <div style={{ marginTop: '20px', background: 'linear-gradient(135deg, #F8FAFC, #F1F5F9)', border: '1px solid #E2E8F0', borderRadius: '16px', padding: '20px 22px' }}>
                                <div style={{ fontSize: '0.78rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <Plus size={13} /> Registrar Egreso (Pasa por TesorerÃ­a)
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
                                    {/* Concepto */}
                                    <input
                                        type="text"
                                        placeholder="Concepto del gasto..."
                                        value={newExpense.concepto}
                                        onChange={e => setNewExpense(prev => ({ ...prev, concepto: e.target.value }))}
                                        style={{ padding: '10px 14px', borderRadius: '10px', border: '1.5px solid #E2E8F0', fontSize: '0.875rem', fontWeight: 600, color: '#1E293B', background: 'white', outline: 'none' }}
                                    />
                                    {/* CatÃ©goria */}
                                    <select
                                        value={newExpense.categoria}
                                        onChange={e => setNewExpense(prev => ({ ...prev, categoria: e.target.value, specialist_id: '', proveedor: '' }))}
                                        style={{ padding: '10px 14px', borderRadius: '10px', border: '1.5px solid #E2E8F0', fontSize: '0.875rem', fontWeight: 700, color: '#1E293B', background: 'white', outline: 'none' }}
                                    >
                                        <option value="Mano de Obra">Mano de Obra</option>
                                        <option value="Materiales">Materiales</option>
                                        <option value="Movilidad">Movilidad</option>
                                        <option value="Herramientas">Herramientas</option>
                                        <option value="Otros">Otros</option>
                                    </select>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
                                    {/* Monto */}
                                    <div style={{ position: 'relative' }}>
                                        <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', fontWeight: 800, color: '#475569', fontSize: '0.85rem' }}>S/</span>
                                        <input
                                            type="number"
                                            placeholder="0.00"
                                            value={newExpense.monto}
                                            onChange={e => setNewExpense(prev => ({ ...prev, monto: e.target.value }))}
                                            style={{ width: '100%', padding: '10px 14px 10px 30px', borderRadius: '10px', border: '1.5px solid #E2E8F0', fontSize: '0.875rem', fontWeight: 700, color: '#1E293B', background: 'white', outline: 'none', boxSizing: 'border-box' }}
                                        />
                                    </div>

                                    {/* Especialista (Combobox) / Proveedor libre */}
                                    {newExpense.categoria === 'Mano de Obra' ? (
                                        <div style={{ position: 'relative' }}>
                                            <input
                                                type="text"
                                                placeholder="Buscar tÃ©cnico..."
                                                value={techSearchQuery}
                                                onChange={e => {
                                                    setTechSearchQuery(e.target.value);
                                                    setNewExpense(prev => ({ ...prev, specialist_id: '', proveedor: '' }));
                                                    setShowTechDropdown(true);
                                                }}
                                                onFocus={() => setShowTechDropdown(true)}
                                                onBlur={() => setTimeout(() => setShowTechDropdown(false), 150)}
                                                style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: newExpense.specialist_id ? '1.5px solid #6366F1' : '1.5px solid #E2E8F0', fontSize: '0.875rem', fontWeight: 600, color: '#1E293B', background: newExpense.specialist_id ? '#EEF2FF' : 'white', outline: 'none', boxSizing: 'border-box' }}
                                            />
                                            {showTechDropdown && techSearchQuery && (
                                                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'white', border: '1px solid #E2E8F0', borderRadius: '10px', boxShadow: '0 8px 24px rgba(0,0,0,0.12)', zIndex: 9999, maxHeight: '200px', overflowY: 'auto', marginTop: '4px' }}>
                                                    {allTechnicians
                                                        .filter(t => {
                                                            const q = techSearchQuery.toLowerCase();
                                                            const n = (t.name || `${t.first_name || ''} ${t.last_name || ''}`).toLowerCase();
                                                            return n.includes(q);
                                                        })
                                                        .map(t => {
                                                            const tname = t.name || `${t.first_name || ''} ${t.last_name || ''}`.trim();
                                                            return (
                                                                <div
                                                                    key={t.id}
                                                                    onMouseDown={() => {
                                                                        setNewExpense(prev => ({ ...prev, specialist_id: t.id, proveedor: tname }));
                                                                        setTechSearchQuery(tname);
                                                                        setShowTechDropdown(false);
                                                                    }}
                                                                    style={{ padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid #F1F5F9', display: 'flex', alignItems: 'center', gap: '8px' }}
                                                                >
                                                                    <div style={{ width: 26, height: 26, borderRadius: '50%', background: '#6366F1', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 800, flexShrink: 0 }}>
                                                                        {tname.charAt(0)}
                                                                    </div>
                                                                    <div>
                                                                        <div style={{ fontWeight: 700, fontSize: '0.85rem', color: '#1E293B' }}>{tname}</div>
                                                                        {t.specialties?.length > 0 && <div style={{ fontSize: '0.7rem', color: '#64748B' }}>{t.specialties.join(', ')}</div>}
                                                                    </div>
                                                                </div>
                                                            );
                                                        })
                                                    }
                                                    {allTechnicians.filter(t => {
                                                        const q = techSearchQuery.toLowerCase();
                                                        const n = (t.name || `${t.first_name || ''} ${t.last_name || ''}`).toLowerCase();
                                                        return n.includes(q);
                                                    }).length === 0 && (
                                                        <div style={{ padding: '12px 14px', fontSize: '0.8rem', color: '#94A3B8', textAlign: 'center' }}>Sin resultados</div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <input
                                            type="text"
                                            placeholder="Proveedor externo (opcional)"
                                            value={newExpense.proveedor}
                                            onChange={e => setNewExpense(prev => ({ ...prev, proveedor: e.target.value }))}
                                            style={{ padding: '10px 14px', borderRadius: '10px', border: '1.5px solid #E2E8F0', fontSize: '0.875rem', fontWeight: 600, color: '#1E293B', background: 'white', outline: 'none' }}
                                        />
                                    )}
                                </div>

                                {newExpense.categoria === 'Mano de Obra' && !newExpense.specialist_id && (
                                    <p style={{ margin: '0 0 10px', fontSize: '0.75rem', color: '#B45309', fontWeight: 600 }}>
                                        âš ï¸ Para Mano de Obra debe seleccionar un tÃ©cnico registrado.
                                    </p>
                                )}

                                <button
                                    onClick={handleAddExpense}
                                    disabled={isSavingCost}
                                    style={{ width: '100%', padding: '12px', borderRadius: '12px', background: isSavingCost ? '#94A3B8' : 'linear-gradient(135deg, #1E293B, #334155)', color: 'white', border: 'none', fontWeight: 800, fontSize: '0.9rem', cursor: isSavingCost ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', transition: 'all 0.2s' }}
                                >
                                    {isSavingCost ? <Clock size={16} /> : <Plus size={16} />}
                                    {isSavingCost ? 'Registrando...' : 'Registrar Egreso â†’ TesorerÃ­a'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}


                {/* Modal de NegociaciÃƒÂ³n de Costo */}
                {showNegotiationModal && (
                    <div className={styles.modalOverlay}>
                        <div className={styles.negotiationModalCard}>
                            <div className={styles.negotiationModalHeader}>
                                <div className={styles.negoIconWrapper}>
                                    <Calculator size={24} />
                                </div>
                                <div className={styles.negoTitleGroup}>
                                    <h3>Ajuste de Costo Negociado</h3>
                                    <span>Re-negociaciÃƒÂ³n con el tÃƒÂ©cnico asignado</span>
                                </div>
                                <button className={styles.closeNegoBtn} onClick={() => setShowNegotiationModal(false)}>
                                    <X size={20} />
                                </button>
                            </div>

                            <div className={styles.negotiationModalContent}>
                                <div className={styles.currentCostDisplay}>
                                    <span className={styles.currentCostLabel}>COSTO ACTUAL REGISTRADO</span>
                                    <div className={styles.currentCostBig}>
                                        S/ {(parseFloat(ticketData.costoManoObra || 0) + parseFloat(ticketData.costoMateriales || 0)).toFixed(2)}
                                    </div>
                                </div>

                                <div className={styles.negoInputWrapper}>
                                    <label>Nuevo Costo Acordado (Mano de Obra + Materiales)</label>
                                    <div className={styles.negoInputGroup}>
                                        <div className={styles.negoInputPrefix}>S/</div>
                                        <input
                                            type="number"
                                            value={negotiationNewCost}
                                            onChange={(e) => setNegotiationNewCost(e.target.value)}
                                            placeholder="0.00"
                                            autoFocus
                                        />
                                    </div>
                                    <p className={styles.negoHelpText}>
                                        * Este ajuste quedarÃƒÂ¡ registrado como costo de ejecuciÃƒÂ³n final para el tÃƒÂ©cnico.
                                    </p>
                                </div>
                            </div>

                            <div className={styles.negotiationModalActions}>
                                <button className={styles.negoCancelBtn} onClick={() => setShowNegotiationModal(false)}>
                                    Cancelar
                                </button>
                                <button className={styles.negoConfirmBtn} onClick={confirmNegotiatedCost}>
                                    <CheckCircle size={18} />
                                    Confirmar Nuevo Costo
                                </button>
                            </div>
                        </div>
                    </div>
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

                <TechnicianDrawer 
                    isOpen={showAssignmentDrawer}
                    onClose={() => setShowAssignmentDrawer(false)}
                    ticket={ticketData}
                    onAssign={handleAssignment}
                    onShowToast={showToast}
                />

                <GestoraDrawer 
                    isOpen={showGestoraDrawer}
                    onClose={() => setShowGestoraDrawer(false)}
                    onAssign={handleGestoraAssignment}
                />

            </div>
        </>
    );
}


