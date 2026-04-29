"use client";
// Forced redeploy: v1.2 - Sincronizado con Flujo de Cotización y Borrado Inteligente

import { useState, useRef, useEffect, useCallback, useMemo } from "react";

// 🚧 DEBUG: Mostrar logs de gestión de tickets en pantalla
const DEBUG_GESTION = typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('debug');
import * as XLSX from 'xlsx';
import { X, Minimize2, Maximize2, Square, FileText, ArrowRight, Calendar, Camera, ClipboardCheck, DollarSign, Percent, Package, Split, Coins, FileSpreadsheet, Download, Send, Upload, Clock, CheckCircle, CheckCircle2, ThumbsUp, Hammer, Wallet, Plus, Calculator, Receipt, Sparkles, AlertTriangle, Trash2, User, UserPlus, Ban, CreditCard, Lock, Edit3, ArrowDownLeft, Stethoscope, ShieldAlert, AlertCircle, RefreshCw, XCircle, Truck } from "lucide-react";
import TechnicianDrawer from "./TechnicianDrawer";
import TicketStateNavigator from "./TicketStateNavigator";
import { TicketSummary, InfoBarBase, TechnicianSchedulingBar, DiagnosisInfoBar, QuotationInfoBar, FinancialLiquidationBar, UnifiedEvidenceBar, DocumentationSummaryBar, QuoteAssistantBar, PaymentHistoryBar, GestoraAssignmentBar } from "./TicketSummary";
import GestoraDrawer from "./GestoraDrawer";

import OnlineQuotationEditor from "./OnlineQuotationEditor";
import { normalizeStateId, TICKET_STATE_ORDER } from "@/lib/ticketStates";
import { calculateTicketFinances } from "@/lib/calculations";
import { supabase } from "@/lib/supabase";
import { ticketsAPI, branchesAPI, ticketCostsAPI, techniciansAPI } from "@/lib/supabase-api";
import { SERVICE_TYPES } from "@/lib/serviceTypes";
import { round2, formatSoles } from "@/lib/formatters";
import { compressImage } from "@/lib/imageCompression";
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

    useEffect(() => {
        if (typeof window !== 'undefined') {
            localStorage.setItem(`ticket_ui_${ticket.id}`, JSON.stringify({
                isMaximized,
                isMinimized,
                position
            }));
        }
    }, [isMaximized, isMinimized, position, ticket.id]);

    const [diagnostico, setDiagnostico] = useState("");
    const [costoManoObra, setCostoManoObra] = useState("");
    const [costoMateriales, setCostoMateriales] = useState("");
    const [modalidad, setModalidad] = useState("todo_costo");
    const [evidenciasCampo, setEvidenciasCampo] = useState<any[]>([]);
    const [montoTotalCotizado, setMontoTotalCotizado] = useState(() => {
        const meta = ticket.metadata || {};
        return parseFloat(ticket.montoFinal || meta.montoFinal || 0);
    });
    const [montoSubtotal, setMontoSubtotal] = useState(ticket.montoSubtotal || ticket.metadata?.montoSubtotal || 0);
    const [montoIGV, setMontoIGV] = useState(ticket.montoIGV || ticket.metadata?.montoIGV || 0);
    const quotationEditorRef = useRef<any>(null);
    const [partidasCotización, setPartidasCotización] = useState<any[]>(() => {
        return ticket.partidas || ticket.metadata?.partidas || [];
    });
    const [currentTime, setCurrentTime] = useState<Date | null>(null);
    const [isQuotationCollapsed, setIsQuotationCollapsed] = useState(true);
    const [isSavingCost, setIsSavingCost] = useState(false);
    const [isSavingNegotiation, setIsSavingNegotiation] = useState(false);
    const [porcentajeAdelanto, setPorcentajeAdelanto] = useState<number | null>(null);
    const [montoAdelantoManual, setMontoAdelantoManual] = useState<string>("");

    // --- HARD DELETE & TRANSFER LOGIC ---
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [showTransferModal, setShowTransferModal] = useState(false);
    const [showLiquidationConfirm, setShowLiquidationConfirm] = useState(false);
    const [showExceedApprovalConfirm, setShowExceedApprovalConfirm] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [isTransferring, setIsTransferring] = useState(false);
    const [targetTicketSearch, setTargetTicketSearch] = useState("");
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [selectedTargetTicket, setSelectedTargetTicket] = useState<any>(null);

    const checkAndHardDelete = async () => {
        if (!ticketData?.id) return;
        setIsDeleting(true);
        try {
            // 1. Verificar si hay gastos
            const costs = await ticketCostsAPI.getByTicket(ticketData.id);
            if (costs && costs.length > 0) {
                const pendingCount = costs.filter((c: any) => c.estado_pago === 'pendiente').length;
                const paidCount = costs.filter((c: any) => c.estado_pago === 'pagado').length;
                
                setShowDeleteModal(false);
                setShowTransferModal(true);
                showToast(
                    "Bloqueo de Seguridad", 
                    `Este ticket tiene ${costs.length} registros en costos (${paidCount} pagados, ${pendingCount} pendientes). Debe eliminarlos o trasladarlos antes de borrar el ticket.`, 
                    "info"
                );
                return;
            }

            // 2. Ejecutar Hard Delete
            if (!confirm(`¿FINALMENTE SEGURO? Esta acción es irreversible y eliminará el ticket ${ticketData.numeroTicketCliente || ticketData.id} de TODO el sistema (incluyendo fotos y chat).`)) {
                return;
            }

            await ticketsAPI.delete(ticketData.id);
            showToast("Ticket Eliminado", "El registro ha sido borrado definitivamente.", "success");
            onClose();
        } catch (err: any) {
            console.error("Error in hard delete:", err);
            showToast("Error", "No se pudo eliminar el ticket.", "error");
        } finally {
            setIsDeleting(false);
        }
    };

    const handleSearchTargetTicket = async (query: string) => {
        setTargetTicketSearch(query);
        if (query.length < 3) {
            setSearchResults([]);
            return;
        }
        try {
            const { data, error } = await supabase
                .from('tickets')
                .select('id, ticket_number, client_ticket_number, description, status_id, clients(name)')
                .or(`client_ticket_number.ilike.%${query}%, description.ilike.%${query}%`)
                .neq('id', ticketData.id)
                .limit(5);

            if (error) throw error;
            setSearchResults(data || []);
        } catch (err) {
            console.error("Search error:", err);
        }
    };

    const executeTransferAndClear = async () => {
        if (!selectedTargetTicket) {
            showToast("Error", "Debe seleccionar un ticket de destino.", "error");
            return;
        }
        setIsTransferring(true);
        try {
            await ticketCostsAPI.transferAllToTicket(ticketData.id, selectedTargetTicket.id);
            showToast("Gastos Trasladados", `Los gastos se movieron al ticket ${selectedTargetTicket.client_ticket_number || selectedTargetTicket.id}.`, "success");
            
            // Ahora que está limpio, intentar el borrado automático? 
            // Mejor dejar que el admin lo confirme de nuevo para evitar sorpresas.
            setShowTransferModal(false);
            setShowDeleteModal(true);
        } catch (err) {
            console.error("Transfer error:", err);
            showToast("Error", "No se pudo trasladar los gastos.", "error");
        } finally {
            setIsTransferring(false);
        }
    };

    // --- REPORT UPDATE LOGIC ---
    const [showReportUpdateModal, setShowReportUpdateModal] = useState(false);
    const [isSavingReport, setIsSavingReport] = useState(false);
    const [reportForm, setReportForm] = useState({
        diagnostico: "",
        costoManoObra: "",
        costoMateriales: ""
    });

    const handleOpenReportUpdate = () => {
        setReportForm({
            diagnostico: ticketData.diagnostico || "",
            costoManoObra: ticketData.costoManoObra || "0",
            costoMateriales: ticketData.costoMateriales || "0"
        });
        setShowReportUpdateModal(true);
    };

    const handleSaveReportUpdate = async () => {
        if (isSavingReport) return;
        setIsSavingReport(true);
        try {
            const oldMO = parseFloat(String(ticketData.costoManoObra || "0"));
            const oldMAT = parseFloat(String(ticketData.costoMateriales || "0"));
            const newMO = parseFloat(reportForm.costoManoObra || "0");
            const newMAT = parseFloat(reportForm.costoMateriales || "0");

            // 1. Actualizar en Base de Datos
            const { error } = await supabase
                .from('tickets')
                .update({
                    diagnosis: reportForm.diagnostico,
                    labor_cost: newMO,
                    materials_cost: newMAT,
                })
                .eq('id', ticketData.id);

            if (error) throw error;

            // 2. Auditoría Silenciosa
            await supabase.from('debug_logs').insert({
                log_data: {
                    action: 'UPDATE_TECHNICAL_REPORT',
                    ticket_id: ticketData.id,
                    ticket_number: ticketData.numeroTicketCliente,
                    user_email: localStorage.getItem('userEmail'),
                    changes: {
                        diagnostico: { old: ticketData.diagnostico, new: reportForm.diagnostico },
                        mo: { old: oldMO, new: newMO },
                        mat: { old: oldMAT, new: newMAT }
                    },
                    timestamp: new Date().toISOString()
                }
            });

            // 3. Recálculo Reactivo (State Sync)
            setTicketData((prev: any) => ({
                ...prev,
                diagnostico: reportForm.diagnostico,
                costoManoObra: newMO,
                costoMateriales: newMAT,
                // Provocar refresco en dependencias
                metadata: {
                    ...prev.metadata,
                    diagnostico: reportForm.diagnostico,
                    costoManoObra: newMO,
                    costoMateriales: newMAT
                }
            }));

            showToast("Reporte Actualizado", "Los cambios han sido guardados y los cálculos financieros sincronizados.", "success");
            setShowReportUpdateModal(false);
        } catch (err: any) {
            console.error("Error updating report:", err);
            showToast("Error", "No se pudo actualizar el reporte.", "error");
        } finally {
            setIsSavingReport(false);
        }
    };

    const [userRole, setUserRole] = useState<string | null>(() => {
        if (typeof window !== 'undefined') return localStorage.getItem('userRole');
        return null;
    });

    const isAdmin = userRole?.toLowerCase() === 'admin' || userRole?.toLowerCase() === 'superadmin';

    const [myGestoraId, setMyGestoraId] = useState<string | null>(null);
    const [myProfileId, setMyProfileId] = useState<string | null>(null);
    const [isInitialLoadComplete, setIsInitialLoadComplete] = useState(false);

    useEffect(() => {
        const fetchMe = async () => {
            const email = localStorage.getItem('userEmail');
            if (!email) return;

            // Intentar obtener ID de gestora (para permisos operativas)
            const { data: gestoraData } = await supabase.from('gestoras').select('id').ilike('email', email).maybeSingle();
            if (gestoraData?.id) setMyGestoraId(gestoraData.id);

            // Intentar obtener ID de perfil (para registros de tesorería solicitado_por)
            const { data: profileData } = await supabase.from('perfiles').select('id').ilike('email', email).maybeSingle();
            if (profileData?.id) setMyProfileId(profileData.id);
        };
        fetchMe();
    }, []);

    const [toast, setToast] = useState<{ visible: boolean; title: string; message: string; type: 'success' | 'error' | 'info' }>({ visible: false, title: '', message: '', type: 'info' });

    const [ticketCosts, setTicketCosts] = useState<any[]>([]);

    // ─────────────────────────────────────────────────────────────────────────────
    // LÓGICA FINANCIERA CENTRALIZADA (calculateTicketFinances) - se recalcula con ticketCosts
    // ─────────────────────────────────────────────────────────────────────────────
    const finances = useMemo(
        () => calculateTicketFinances(ticketData, ticketCosts),
        [ticketData, ticketCosts]  // ✅ Recalcular cuando cambien los costs
    );
    const {
        totalPactedDebt: techPactedTotal,
        totalPaidCalculated: unifiedPaymentsSum,
        balance: finalBalance,
        grossMargin,
        marginPercent: pctReal,
        paidModernArr,
        paidModernPendingArr = [], // ✅ NUEVO:pendientes
        totalRequested = 0, // ✅ NUEVO:total solicitado pendiente
        legacyPaymentsFiltered,
        extraCosts: extraPactedCosts,
        totalInvestment: totalTicketCosts,
        pactedMO,
        balance: baseRescue
    } = finances;

    let availableRescue = baseRescue;
    // 🔓 RESCATE FINANCIERO – DESBLOQUEO DESDE COTIZACIÓN ENVIADA (Estado 6 en adelante).
    // Regla de negocio: la MO pactada con el técnico ya está definida internamente al enviar
    // la cotización al cliente. El técnico no debe esperar a la aprobación bancaria del cliente
    // para tener liquidez. Si pactedMO > 0, el saldo disponible se calcula sobre la MO interna
    // menos los adelantos ya pagados, sin depender del saldo_tecnico del backend (que se
    // estabiliza recién al aprobarse la cotización).
    const RESCUE_ELIGIBLE_STATES = new Set([
        'cotizacion_enviada',      // Estado 6 ← desbloqueo
        'cotizacion_aprobada',     // Estado 7
        'en_ejecucion',            // Estado 8
        'documentacion_enviada',
        'por_liquidar',
        'liquidado',
        'visitado',
        'visita_realizada',
        'requiere_revision_admin',
    ]);
    if (pactedMO > 0 && RESCUE_ELIGIBLE_STATES.has(ticketData.estadoId)) {
        // 🔄 REACTIVIDAD: usar paidModernArr (excluye ANULADO/RECHAZADO, incluye
        // pendiente + REQUIERE_APROBACION + pagado). Esto hace que al crear una
        // solicitud de rescate, availableRescue baje de inmediato sin necesidad
        // de cerrar/abrir la ventana.
        const totalRequestedToTech = (paidModernArr || []).reduce(
            (sum: number, c: any) => sum + (parseFloat(c.monto) || 0),
            0
        );
        const computed = Math.max(0, pactedMO - totalRequestedToTech);
        // Tomamos el mínimo entre saldo del backend y el computado client-side
        // para evitar sobre-otorgar liquidez.
        availableRescue = (availableRescue > 0)
            ? Math.min(availableRescue, computed)
            : computed;
    }
    // REFUERZO: Emergencias o estados activos sin pactado definido aún (para permitir solicitud base)
    if (pactedMO <= 0 && ['visita_realizada', 'en_cotizacion', 'cotizacion_enviada', 'cotizacion_aprobada', 'en_ejecucion'].includes(ticketData.estadoId)) {
        if (availableRescue <= 0) availableRescue = 100;
    }
    const isVisitPaid = ticketData.visitPaymentConfirmed || ticketCosts.some(c => 
        (c.categoria || '').toLowerCase().includes('movilidad') && 
        (c.estado_pago || '').toLowerCase() === 'pagado'
    );
    const [loadingCosts, setLoadingCosts] = useState(false);

    const [isConfirmingPayment, setIsConfirmingPayment] = useState(false);
    
    const showToast = (title: string, message: string, type: 'success' | 'error' | 'info' = 'success') => {
        setToast({ visible: true, title, message, type });
        setTimeout(() => setToast(prev => ({ ...prev, visible: false })), 4000);
    };

    const hasLoadedRef = useRef<string | null>(null);

    const loadCosts = useCallback(async () => {
        if (!ticketData?.id) return;
        setLoadingCosts(true);
        try {
            const costs = await ticketCostsAPI.getByTicket(ticketData.id);
            setTicketCosts(costs || []);
            
            // Actualizar silenciosamente los cálculos financieros del backend
            // Solo actualizar si hay valores válidos (no 0, no undefined)
            try {
                const updatedTicket = await ticketsAPI.getById(ticketData.id);
                if (updatedTicket && updatedTicket.utilidad_neta != null) {
                    setTicketData((prev: any) => ({
                        ...prev,
                        saldo_tecnico: updatedTicket.saldo_tecnico ?? prev.saldo_tecnico,
                        utilidad_neta: updatedTicket.utilidad_neta ?? prev.utilidad_neta,
                        margen_real: updatedTicket.margen_real ?? prev.margen_real,
                        ingresos_reales: updatedTicket.ingresos_reales ?? prev.ingresos_reales,
                        monto_pactado_mo: updatedTicket.monto_pactado_mo ?? prev.monto_pactado_mo,
                        total_costs_agg: updatedTicket.total_costs_agg ?? prev.total_costs_agg,
                        gastos_flujo_a: updatedTicket.gastos_flujo_a ?? prev.gastos_flujo_a,
                        adelantos_flujo_b: updatedTicket.adelantos_flujo_b ?? prev.adelantos_flujo_b
                    }));
                }
            } catch (e) {
                console.error("Error silently updating financial details:", e);
            }
        } catch (err) {
            console.error("Error loading costs:", err);
        } finally {
            setLoadingCosts(false);
        }
    }, [ticketData.id]);

    // Suscripción granular a COSTOS (el ticket se actualiza vía props)
    useEffect(() => {
        if (!ticketData?.id) return;

        const channel = supabase
            .channel(`ticket_window_costs_${ticketData.id}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'ticket_costs',
                    filter: `ticket_id=eq.${ticketData.id}`
                },
                () => {
                    loadCosts();
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [ticketData.id, loadCosts]);

    // Carga inicial de detalles completos (no incluidos en el summary)
    useEffect(() => {
        if (!ticket?.id || hasLoadedRef.current === ticket.id) return;
        hasLoadedRef.current = ticket.id;

        const load = async () => {
            try {
                loadCosts();
                // Solo un fetch al abrir para traer campos pesados (partidas, evidencias)
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

                    // Restaurar desde cache local O использовать el más avanzado entre cache y servidor
                    const savedState = localStorage.getItem(`ticket_state_${ticket.id}`);
                    let cachedMetadata: any = {};
                    let cachedEstadoId: string | undefined;
                    if (savedState) {
                        try {
                            const parsed = JSON.parse(savedState);
                            cachedEstadoId = parsed.estadoId;
                            // Para tickets activos, preservar el estado local cacheado para evitar regresiones
                            const isTriage = !fullTicket.status_id || ['nuevo', 'borrador', 'pendiente'].includes(fullTicket.status_id);
                            if (isTriage) {
                                cachedMetadata = parsed;
                            } else {
                                // Para tickets ya avanzados, usar metadata del cache pero NO perder el estado más avanzado
                                const { estadoId: _, status_id: __, ...safe } = parsed;
                                cachedMetadata = safe;
                            }
                        } catch(e) {}
                    }

                    // DETERMINAR EL ESTADO FINAL: Nunca retroceder
                    const serverStateOrder = TICKET_STATE_ORDER[corregidoEstadoId] ?? 0;
                    const cachedStateOrder = TICKET_STATE_ORDER[cachedEstadoId ?? ''] ?? 0;
                    // GANA el más avanzado
                    const finalEstadoId = cachedStateOrder >= serverStateOrder 
                        ? (cachedEstadoId || corregidoEstadoId) 
                        : corregidoEstadoId;
                    const finalStatusId = finalEstadoId;

                    setTicketData((prev: any) => {
                        const merged = {
                            ...prev, ...fullTicket, ...meta, ...cachedMetadata,
                            metadata: { ...meta, ...cachedMetadata },
                            estadoId: finalEstadoId,
                            status_id: finalStatusId,
                            adelantoPagado: meta.adelantoPagado ?? false,
                            visitPaymentConfirmed: visitConfirmed,
                            solicitudAdelanto: meta.solicitudAdelanto ?? null,
                            solicitudPagoVisita: visitConfirmed ? null : (meta.solicitudPagoVisita ?? null),
                            historialPagosTécnico: meta.historialPagosTécnico ?? [],
                            gestora: fullTicket.gestora || meta.gestora || null
                        };
                        // PRESERVACIÓN CRÍTICA: No dejar que el servidor borre lo que la gestora puso localmente si el servidor aún tiene 0/20
                        if (cachedMetadata.costoManoObra > 0 && merged.costoManoObra <= 20) {
                            merged.costoManoObra = cachedMetadata.costoManoObra;
                        }
                        if (cachedMetadata.montoFinal > 0 && merged.montoFinal <= 20) {
                            merged.montoFinal = cachedMetadata.montoFinal;
                        }
                        return merged;
                    });

                    // SYNC QUOTATION STATE
                    const finalPartidas = (meta.partidas && meta.partidas.length > 0) ? meta.partidas : (cachedMetadata.partidas || []);
                    if (finalPartidas.length > 0) setPartidasCotización(finalPartidas);
                    
                    const finalMonto = parseFloat(meta.montoFinal || cachedMetadata.montoFinal || 0);
                    if (finalMonto > 0) setMontoTotalCotizado(finalMonto);

                    // SYNC DOCUMENTATION STATE
                    if (meta.evidenciasEjecucion) setEvidenciasEjecucion(meta.evidenciasEjecucion);
                    if (meta.documentosChecklist) setDocumentosChecklist(meta.documentosChecklist);

                    setIsInitialLoadComplete(true);
                } catch (err) {
                    console.error('Error fetching full ticket data:', err);
                    setIsInitialLoadComplete(true);
                }
            };
        load();
    }, [ticket?.id]);

    // Efecto de sincronización con el prop 'ticket' (viene del contexto global realtime)
    useEffect(() => {
        if (!ticket || !isInitialLoadComplete) return;
        // Si hay una transacción de adelanto en curso, ignorar el update del prop
        // para evitar el parpadeo entre pantallas por race condition
        if (isProcessingAdvance.current) return;

        // Solo actualizar si el estado o metadata importante cambió en el prop
        setTicketData((prev: any) => {
            const hasStatusChanged = ticket.status_id !== prev.status_id;
            const hasMetaChanged = JSON.stringify(ticket.metadata) !== JSON.stringify(prev.metadata);
            
            if (!hasStatusChanged && !hasMetaChanged) return prev;
            
            let meta = ticket.metadata || {};
            const rawEstadoId = normalizeStateId(ticket.status_id || meta.estadoId || 'nuevo');
            const visitConfirmed = meta.visitPaymentConfirmed ?? false;
            
            const PRE_INSPECTION_STATES = ['nuevo', 'tecnico_asignado', 'esperando_pago_visita'];
            const corregidoEstadoId = (visitConfirmed && PRE_INSPECTION_STATES.includes(rawEstadoId))
                ? 'en_inspeccion'
                : rawEstadoId;

            // PREVENIR PARPADEO Y REGRESIONES: Comparar el avance del flujo
            const serverStatusOrder = TICKET_STATE_ORDER[corregidoEstadoId] || 0;
            const prevStatusOrder = TICKET_STATE_ORDER[prev.estadoId] || 0;
            // SIEMPRE gana el más avanzado (nunca retroceder de estado automáticamente)
            const shouldPreservePrevState = prevStatusOrder > serverStatusOrder;

            // BLINDAJE DE SOLICITUDES: Si tenemos una solicitud local y el servidor aún no la ve, preservarla
            // Esto elimina el parpadeo "Solicitar -> Esperando -> Solicitar"
            const localSolicitud = prev.solicitudAdelanto || prev.metadata?.solicitudAdelanto;
            const serverSolicitud = meta.solicitudAdelanto;
            const finalSolicitud = (localSolicitud && !serverSolicitud) ? localSolicitud : serverSolicitud;

            return {
                ...prev,
                ...ticket,
                // PREVENIR PARPADEO: Conservar valores financieros del backend si el prop no los tiene actualizados
                saldo_tecnico: prev.saldo_tecnico !== undefined ? prev.saldo_tecnico : ticket.saldo_tecnico,
                utilidad_neta: prev.utilidad_neta !== undefined ? prev.utilidad_neta : ticket.utilidad_neta,
                margen_real: prev.margen_real !== undefined ? prev.margen_real : ticket.margen_real,
                ingresos_reales: prev.ingresos_reales !== undefined ? prev.ingresos_reales : ticket.ingresos_reales,
                monto_pactado_mo: prev.monto_pactado_mo !== undefined ? prev.monto_pactado_mo : ticket.monto_pactado_mo,
                
                // BLINDAJE DE EDICIÓN LOCAL: No permitir que el caché global borre lo que el usuario está escribiendo o cargó vía getById
                partidas: prev.partidas || prev.metadata?.partidas || meta.partidas,
                montoFinal: prev.montoFinal || prev.metadata?.montoFinal || meta.montoFinal,
                costoManoObra: prev.costoManoObra || prev.metadata?.costoManoObra || meta.costoManoObra,
                diagnostico: prev.diagnostico || prev.metadata?.diagnostico || meta.diagnostico,
                evidenciasEjecucion: prev.evidenciasEjecucion || prev.metadata?.evidenciasEjecucion || meta.evidenciasEjecucion,
                documentosChecklist: prev.documentosChecklist || prev.metadata?.documentosChecklist || meta.documentosChecklist,
                historialPagosTécnico: prev.historialPagosTécnico || prev.metadata?.historialPagosTécnico || meta.historialPagosTécnico,
                gestora: prev.gestora || meta.gestora || ticket.gestora,
                
                metadata: {
                    ...meta,
                    ...prev.metadata, // La metadata local (con los cambios del usuario) GANA
                    solicitudAdelanto: finalSolicitud,
                    solicitudPagoVisita: meta.solicitudPagoVisita !== undefined ? meta.solicitudPagoVisita : (prev.solicitudPagoVisita || prev.metadata?.solicitudPagoVisita),
                    solicitudLiquidacion: meta.solicitudLiquidacion !== undefined ? meta.solicitudLiquidacion : (prev.solicitudLiquidacion || prev.metadata?.solicitudLiquidacion),
                },
                
                // Mapeo a nivel de raíz para que la UI lo detecte correctamente y no parpadee
                solicitudAdelanto: finalSolicitud,
                solicitudPagoVisita: meta.solicitudPagoVisita !== undefined ? meta.solicitudPagoVisita : (prev.solicitudPagoVisita || prev.metadata?.solicitudPagoVisita),
                solicitudLiquidacion: meta.solicitudLiquidacion !== undefined ? meta.solicitudLiquidacion : (prev.solicitudLiquidacion || prev.metadata?.solicitudLiquidacion),
                
                // Extraer pagoRechazado desde metadata para que la UI lo detecte
                pagoRechazado: meta.pagoRechazado || prev.pagoRechazado,

                // Si el local está más avanzado, NO LO RETROCEDEMOS
                estadoId: shouldPreservePrevState ? prev.estadoId : corregidoEstadoId,
                status_id: shouldPreservePrevState ? prev.status_id : corregidoEstadoId,
                visitPaymentConfirmed: visitConfirmed || prev.visitPaymentConfirmed
            };
        });
    }, [ticket, isInitialLoadComplete]);

    const [gastos, setGastos] = useState<any[]>(ticketData.gastos || []);
    const [documentosChecklist, setDocumentosChecklist] = useState(() => {
        const meta = ticket.metadata || {};
        const saved = meta.documentosChecklist || {};
        return {
            actaConformidad: !!saved.actaConformidad,
            ats: !!saved.ats,
            declaracionJurada: !!saved.declaracionJurada,
            excelSeguridad: !!saved.excelSeguridad
        };
    });
    const [evidenciasEjecucion, setEvidenciasEjecucion] = useState<any[]>(ticketData.evidenciasEjecucion || []);
    const [allTechnicians, setAllTechnicians] = useState<any[]>([]);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const isSyncing = useRef(false);
    // Bloqueo durante transacciones de adelanto para evitar parpadeo por race condition
    const isProcessingAdvance = useRef(false);

    const [showNegotiationModal, setShowNegotiationModal] = useState(false);
    const [negotiationNewCost, setNegotiationNewCost] = useState("");
    const fieldEvidenceRef = useRef<HTMLInputElement>(null);
    const [showExtraAdvanceInput, setShowExtraAdvanceInput] = useState(false);
    const [extraAdvanceAmount, setExtraAdvanceAmount] = useState("");

    const [showMaterialsModal, setShowMaterialsModal] = useState(false);
    const [materialsForm, setMaterialsForm] = useState({
        concepto: "",
        monto: "",
        categoria: "Materiales",
        specialist_id: "",
        specialistName: "",
        searchQuery: "",
        showDropdown: false,
    });
    const [isSavingMaterials, setIsSavingMaterials] = useState(false);
    
    const handleOpenExpenseModal = (category: string = "Materiales", concepto: string = "") => {
        setMaterialsForm({
            ...materialsForm,
            categoria: category,
            concepto: concepto,
            monto: category === 'Viáticos / Movilidad' ? (ticketData.visit_cost || '').toString() : '',
            specialist_id: ticketData.technician_id || '',
            specialistName: ticketData.tecnico?.name || '',
            searchQuery: ticketData.tecnico?.name || '',
            showDropdown: false
        });
        setShowMaterialsModal(true);
    };

    const [bcpQuotationFile, setBcpQuotationFile] = useState<any>(ticketData.archivoCotizaciónBCP || null);
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
    
    // ✅ FIX 2026-04-27: Refs para prevenir ejecución doble
    const requestAdvanceRef = useRef(false);
    const confirmAdvanceRef = useRef(false);

    const syncToSupabase = useCallback(async (dataOverride?: any, options?: { allowStateRollback?: boolean }) => {
        const dataToProcess = dataOverride || ticketData;
        if (!onUpdate || !dataToProcess || !isInitialLoadComplete || isSyncing.current) return;

        const {
            isMaximized, isMinimized, position, zIndex,
            cliente, sede, tecnico,
            metadata: _unusedMetadata,
            ...businessData
        } = dataToProcess;

        const sourceForPayments = businessData;
        const sourceMetadata = businessData;

        const cleanedClientTicketNumber = (() => {
            const val = businessData.numeroTicketCliente;
            if (!val || val.trim() === "" || val.startsWith("#")) return null;
            return val.trim();
        })();

        // ★ AUDITORÍA Y SEGURIDAD: Leer metadata actual del servidor antes de sincronizar
        // Esto evita que si la ventana estuvo abierta mucho tiempo, sobreescriba pagos hechos por tesorería.
        const { data: serverTicket } = await supabase
            .from('tickets')
            .select('metadata, status_id, technician_id, gestora_id')
            .eq('id', ticketData.id)
            .single();

        const serverMeta = serverTicket?.metadata || {};
        const serverStatusId = serverTicket?.status_id;

        const localStateOrder = TICKET_STATE_ORDER[businessData.estadoId] ?? 0;
        const serverStateOrder = TICKET_STATE_ORDER[serverStatusId] ?? 0;
        // 🔁 BYPASS controlado: Reajuste/Reprogramar y otras transiciones intencionales
        // necesitan poder retroceder de estado. Si el caller lo solicita, forzamos el local.
        const resolvedStatusId = options?.allowStateRollback
            ? businessData.estadoId
            : (localStateOrder >= serverStateOrder ? businessData.estadoId : serverStatusId);

        const updates: any = {
            status_id: resolvedStatusId,
            description: businessData.descripcionProblema,
            client_ticket_number: cleanedClientTicketNumber,
            diagnosis: businessData.diagnostico,
            labor_cost: parseFloat(sourceForPayments?.costoManoObra || 0),
            materials_cost: parseFloat(sourceForPayments?.costoMateriales || 0),
            visit_cost: parseFloat(sourceForPayments?.costoVisita || 0),
            total_quoted_amount: parseFloat(montoTotalCotizado || sourceForPayments?.montoFinal || 0),
            technician_id: tecnico?.id || serverTicket?.technician_id,
            gestora_id: businessData?.gestora?.id || serverTicket?.gestora_id,
            metadata: {
                ...serverMeta,
                ...sourceMetadata,
                // PROTECCIÓN DE HISTORIAL: Nunca sobreescribir con datos locales viejos
                historialPagosTécnico: (() => {
                    const localPagos = businessData?.historialPagosTécnico || businessData?.historialPagosTecnico || [];
                    const serverPagos = serverMeta.historialPagosTécnico || serverMeta.historialPagosTecnico || [];
                    const allById = new Map();
                    [...serverPagos, ...localPagos].forEach(p => {
                        if (p?.id) allById.set(p.id, p);
                    });
                    return Array.from(allById.values());
                })(),
                estadoId: resolvedStatusId,
                visitPaymentConfirmed: serverMeta.visitPaymentConfirmed || businessData.visitPaymentConfirmed,
                adelantoPagado: serverMeta.adelantoPagado || businessData.adelantoPagado,
                evidenciasEjecucion,
                documentosChecklist,
                metadata: undefined // Evitar anidación infinita
            }
        };

        const currentDataStr = JSON.stringify(updates);
        if (currentDataStr === lastSyncData.current && !dataOverride) return;

        isSyncing.current = true;
        try {
            if (onUpdate) {
                await onUpdate(ticketData.id, updates);
            } else {
                await ticketsAPI.update(ticketData.id, updates);
            }
            lastSyncData.current = currentDataStr;
        } catch (err) {
            console.error("Error syncing ticket to Supabase:", err);
        } finally {
            isSyncing.current = false;
        }
    }, [ticketData, onUpdate, evidenciasEjecucion, documentosChecklist, montoTotalCotizado, partidasCotización, isInitialLoadComplete]);

    useEffect(() => {
        // Sync de fondo mucho menos agresivo (cada 30s) para evitar 'Sync of Death'
        const syncInterval = setInterval(() => {
            syncToSupabase();
        }, 30000);

        return () => {
            clearInterval(syncInterval);
            // Sync final al cerrar la ventana (unmount)
            syncToSupabase();
        };
    }, [syncToSupabase]);

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
                        historialPagosTécnico,
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
        // Sin costo de visita en asignación - siempre va a en_inspeccion
        const newEstadoId = 'en_inspeccion';

        const dbUpdates: any = {
            technician_id: assignmentData.tecnico?.id || null,
            visit_cost: null,
            status_id: newEstadoId,
            metadata: {
                ...ticketData.metadata,
                tecnico: assignmentData.tecnico,
                fechaAsignacion: assignmentData.fechaAsignacion,
                estadoId: newEstadoId
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
            status_id: newEstadoId
        }));
        setShowAssignmentDrawer(false);
    };

    const handleProceedToAssignment = () => {
        setShowAssignmentDrawer(true);
    };

    const handleFieldEvidenceUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            const rawFiles = Array.from(e.target.files);
            
            // Compresión de imágenes
            const compressedFiles = await Promise.all(
                rawFiles.map(file => compressImage(file))
            );

            const promises = compressedFiles.map(file => {
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
            const now = new Date().toISOString();
            const isAdmin = userRole === 'admin' || userRole === 'superadmin' || userRole === 'ADMIN' || userRole === 'SUPERADMIN';
            
            const newLogEntry = {
                tipo: 'REASIGNACION_MANUAL',
                gestora_id: gestora.id,
                gestora_nombre: gestora.name,
                realizado_por: isAdmin ? 'Administrador' : 'Gestor(a)',
                fecha: now,
                cambio: {
                    desde_id: ticketData.gestora_id || ticketData.metadata?.gestora?.id || null,
                    desde_nombre: ticketData.gestora?.name || ticketData.metadata?.gestora?.name || 'Sin asignar'
                }
            };

            const existingLogs = ticketData.metadata?.asignaciónLog || [];
            
            const metadataUpdates = {
                gestora: gestora,
                asignaciónLog: [...existingLogs, newLogEntry]
            };
            
            const columnUpdates = {
                gestora_id: gestora.id
            };
            
            // USAR parche seguro de metadata para no borrar pagos u otros campos
            await ticketsAPI.patchMetadata(ticketData.id, metadataUpdates, columnUpdates);

            setTicketData((prev: any) => ({
                ...prev,
                gestora: gestora,
                gestora_id: gestora.id,
                metadata: {
                    ...prev.metadata,
                    gestora: gestora,
                    asignaciónLog: [...existingLogs, newLogEntry]
                }
            }));
            
            showToast("Ticket Derivado", `El servicio ahora está a cargo de ${gestora.name}.`, "success");
        } catch (err) {
            console.error("Error assigned gestora:", err);
            showToast("Error", "No se pudo completar la derivación.", "error");
        }
    };

    const handleSendFieldReport = () => {
        if (!diagnostico) {
            showToast("Diagnóstico Requerido", "Por favor ingrese el diagnóstico técnico antes de enviar.", "error");
            return;
        }

        const mo = parseFloat(costoManoObra) || 0;
        const mat = modalidad === 'todo_costo' ? 0 : (parseFloat(costoMateriales) || 0);
        
        if (mo + mat <= 0) {
            showToast("Costo Requerido", "El monto total a cobrar (Mano de Obra + Materiales) debe ser mayor a cero para generar el reporte.", "error");
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
                    archivoCotizaciónBCP: {
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
            fechaCotización: new Date().toISOString(),
            partidas: partidasCotización,
            montoFinal: montoTotalCotizado,
            montoSubtotal: montoSubtotal,
            montoIGV: montoIGV,
            pausadoSLA: true,
            fechaPausa: new Date().toISOString(),
            archivoCotizaciónBCP: isBCP ? bcpQuotationFile : null
        };

        setTicketData(updated);
        showToast("Cotización Enviada", isBCP ? "Plantilla BCP registrada." : "Presupuesto formal enviado.", "success");
    };

    const handleApproveQuote = () => {
        const approved = {
            ...ticketData,
            estadoId: "cotizacion_aprobada",
            fechaAprobación: new Date().toISOString(),
            pausadoSLA: false,
            fechaReactivacion: new Date().toISOString(),
            modificacionAutorizada: false,
            costoAjustadoPostAprobación: false,
            omitirAjusteTécnico: false,
            // BLINDAJE: Asegurar que el monto aprobado se preserve en esta transición
            montoFinal: montoTotalCotizado,
            partidas: partidasCotización
        };
        setTicketData(approved);
        syncToSupabase(approved);
        showToast("Cotización Aprobada", "El ticket ha pasado al estado APROBADA y el presupuesto se ha formalizado.", "success");
    };

    const handleReadjustQuote = () => {
        const readjust = {
            ...ticketData,
            estadoId: "en_cotizacion",
            pausadoSLA: false,
            fechaReactivacion: new Date().toISOString(),
            modificacionAutorizada: true
        };
        setTicketData(readjust);
        // 🔁 Rollback intencional: cotizacion_enviada/aprobada → en_cotizacion para reajuste.
        syncToSupabase(readjust, { allowStateRollback: true });
        showToast("Reajuste Solicitado", "La cotización ha sido devuelta al estado de edición para realizar ajustes.", "info");
    };

    const [showCancelModal, setShowCancelModal] = useState(false);
    const [cancelForm, setCancelForm] = useState({ mobilityCost: '', reason: '' });
    const [isCancelling, setIsCancelling] = useState(false);

    const handleOpenCancel = () => {
        setCancelForm({ mobilityCost: '', reason: '' });
        setShowCancelModal(true);
    };

    const handleCancelQuote = async () => {
        const mobility = parseFloat(cancelForm.mobilityCost) || 0;
        
        setIsCancelling(true);
        try {
            const currentId = ticket.id || ticketData.id;
            const technicianId = ticketData.tecnico?.id || ticketData.technician_id;

            // 1. Si hay costo de movilidad, registrarlo como gasto real
            if (mobility > 0 && technicianId) {
                await ticketCostsAPI.create({
                    ticket_id: currentId,
                    concepto: `Gasto Movilidad / Triaje (Servicio Anulado): ${cancelForm.reason || 'Sin motivo'}`,
                    categoria: "Viáticos / Movilidad",
                    specialist_id: technicianId,
                    monto: mobility,
                    estado_pago: "pendiente",
                    solicitado_por: myProfileId || undefined
                });
            }

            // 2. Anular el ticket (Ingreso = 0)
            const cancelled = {
                ...ticketData,
                estadoId: "ticket_cancelado",
                status_id: "ticket_cancelado",
                total_quoted_amount: 0,
                montoFinal: 0,
                closure_date: new Date().toISOString(),
                metadata: {
                    ...ticketData.metadata,
                    motivoCancelacion: cancelForm.reason,
                    gastoMovilidadAnulacion: mobility
                }
            };

            setTicketData(cancelled);
            await syncToSupabase(cancelled);
            
            showToast("Ticket Anulado", mobility > 0 
                ? `Servicio cancelado. Se registró un egreso de S/ ${mobility.toFixed(2)} por movilidad.`
                : "Servicio cancelado sin costos asociados.", "info");
            
            setShowCancelModal(false);
            onClose();
        } catch (err) {
            console.error("Error cancelling ticket:", err);
            showToast("Error", "No se pudo anular el ticket correctamente.", "error");
        } finally {
            setIsCancelling(false);
        }
    };

    const handleAuthorizeModification = async () => {
        const authorized = {
            ...ticketData,
            modificacionAutorizada: true,
            solicitudModificacion: false
        };
        setTicketData(authorized);
        setIsQuotationCollapsed(false);
        try {
            await syncToSupabase(authorized);
            showToast("Edición Habilitada", "La cotización ha sido desbloqueada para realizar ajustes.", "info");
        } catch (err) {
            console.error("Error authorizing modification:", err);
            showToast("Error", "No se pudo guardar la autorización.", "error");
        }
    };

    const handleRequestModification = async () => {
        const requested = {
            ...ticketData,
            solicitudModificacion: true
        };
        setTicketData(requested);
        try {
            await syncToSupabase(requested);
            showToast("Solicitud Enviada", "Se ha solicitado autorización a Gerencia para modificar esta cotización.", "success");
        } catch (err) {
            console.error("Error requesting modification:", err);
            showToast("Error", "No se pudo enviar la solicitud.", "error");
        }
    };

    const handleProceedToExecution = () => {
        const updated = {
            ...ticketData,
            estadoId: "en_ejecucion",
            fechaInicioEjecucion: new Date().toISOString(),
            // BLINDAJE: Preservar datos financieros durante la transición
            montoFinal: montoTotalCotizado,
            partidas: partidasCotización
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
                costoAjustadoPostAprobación: true,
                costoAnteriorTécnico: currentMO + currentMAT
            };
            setTicketData(updated);
            setShowNegotiationModal(false);
            showToast("Costo Reacordado", `Nuevo monto técnico ajustado a S/ ${val.toFixed(2)}.`, "success");
        } else {
            showToast("Monto Inválido", "Por favor ingrese un número válido para el costo.", "error");
        }
    };

    const handleConfirmAdvance = async () => {
        // ✅ FIX 2026-04-27: Prevenir ejecución doble
        if (confirmAdvanceRef.current) return;
        confirmAdvanceRef.current = true;

        let amount = 0;
        let displayLabel = "";

        const rawManual = parseFloat(montoAdelantoManual);
        if (montoAdelantoManual && !isNaN(rawManual)) {
            amount = rawManual;
            displayLabel = `Manual (S/ ${amount.toFixed(2)})`;
        } else {
            const pctReal = ticketData.solicitudAdelanto ? ticketData.solicitudAdelanto.porcentaje : porcentajeAdelanto;
            if (pctReal) {
                const costoReferencia = (parseFloat(ticketData.costoManoObra || 0) + parseFloat(ticketData.costoMateriales || 0));
                amount = costoReferencia * pctReal;
                displayLabel = `${(pctReal * 100).toFixed(0)}% (S/ ${amount.toFixed(2)})`;
            } else if (ticketData.solicitudAdelanto?.monto) {
                amount = ticketData.solicitudAdelanto.monto;
                displayLabel = `Solicitado (S/ ${amount.toFixed(2)})`;
            }
        }

        if (isNaN(amount) || amount <= 0) {
            showToast("Monto Inválido", "El monto del adelanto debe ser mayor a cero. Seleccione un % o ingrese un monto manual.", "error");
            return;
        }

        const totalCost = (parseFloat(ticketData.costoManoObra || 0) + parseFloat(ticketData.costoMateriales || 0));
        if (unifiedPaymentsSum + amount > totalCost + 0.01) {
            showToast("Exceso de Pago", `El pago de S/ ${amount.toFixed(2)} excedería el costo total pactado.`, "error");
            return;
        }

        const technicianId = ticketData.tecnico?.id || ticketData.technician_id || ticket.technician_id || ticketData.specialist_id;
        const currentId = ticket.id || ticketData.id;

        if (!technicianId) {
            showToast("Técnico no Asignado", "No se encontró el ID del técnico para registrar el pago.", "error");
            return;
        }

        setIsConfirmingPayment(true);
        isProcessingAdvance.current = true;
        try {
            // 1. Registro Financiero Inmutable
            await ticketCostsAPI.create({
                ticket_id: currentId,
                concepto: `Adelanto Operativo - ${displayLabel}`,
                categoria: "Mano de Obra",
                specialist_id: technicianId,
                monto: amount,
                estado_pago: "pagado",
                solicitado_por: myProfileId || undefined
            });

            const newState = ticketData.estadoId === 'cotizacion_aprobada' ? 'en_ejecucion' : ticketData.estadoId;

            // ✅ FIX 2026-04-27: Agregar el pago también a historialPagosTecnico para módulo Tesorería
            const nuevoPagoHistorial = {
                id: `adv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                monto: amount,
                fecha: new Date().toISOString(),
                tipo: 'Adelanto Operativo',
                estado: 'confirmado',
                referencia: displayLabel,
                voucherRef: null
            };
            const historialActual = ticketData.historialPagosTecnico || ticketData.historialPagosTécnico || [];
            const nuevoHistorial = [...historialActual, nuevoPagoHistorial];


            const metadataUpdates = {
                AdelantoPagado: true,
                montoAdelanto: unifiedPaymentsSum + amount,
                fechaPagoAdelanto: new Date().toISOString(),
                solicitudAdelanto: null,
                historialPagosTecnico: nuevoHistorial
            };

            const columnUpdates = {
                status_id: newState
            };

            await ticketsAPI.patchMetadata(ticketData.id, metadataUpdates, columnUpdates);

            // ✅ FIX 2026-04-27: Esperar a que Supabase procese la actualización antes de recargar
            // Esto evita el parpadeo entre estados al发送确认 de adelanto
            await new Promise(resolve => setTimeout(resolve, 1200));
            
            const updated = {
                ...ticketData,
                estadoId: newState,
                adelantoPagado: true,
                montoAdelanto: unifiedPaymentsSum + amount,
                fechaPagoAdelanto: new Date().toISOString(),
                solicitudAdelanto: null
            };

            setTicketData(updated);
            await loadCosts();
            setMontoAdelantoManual("");
            setPorcentajeAdelanto(null);
            showToast("Adelanto Confirmado", `Se ha registrado el depósito de S/ ${amount.toFixed(2)} en el desglose de costos.`, "success");
        } catch (err) {
            console.error("Error confirming advance:", err);
            showToast("Error de Conexión", "No se pudo registrar el adelanto correctamente.", "error");
        } finally {
            setIsConfirmingPayment(false);
            // ✅ Limpiar flags
            confirmAdvanceRef.current = false;
            setTimeout(() => { isProcessingAdvance.current = false; }, 3000);
        }
    };
    const handleRequestAdvance = async () => {
        // ✅ FIX 2026-04-27: Prevenir ejecución doble
        if (requestAdvanceRef.current) return;
        requestAdvanceRef.current = true;

        let amount = 0;
        let pctVal = 0;

        const rawManual = parseFloat(montoAdelantoManual);
        if (montoAdelantoManual && !isNaN(rawManual)) {
            amount = rawManual;
            const costRef = (parseFloat(ticketData.costoManoObra || 0) + parseFloat(ticketData.costoMateriales || 0));
            pctVal = costRef > 0 ? amount / costRef : 0;
        } else if (porcentajeAdelanto) {
            const costRef = (parseFloat(ticketData.costoManoObra || 0) + parseFloat(ticketData.costoMateriales || 0));
            amount = costRef * porcentajeAdelanto;
            pctVal = porcentajeAdelanto;
        }

        if (isNaN(amount) || amount <= 0) {
            showToast("Monto Inválido", "Por favor ingrese un monto válido mayor a cero.", "error");
            return;
        }

        const technicianId = ticketData.tecnico?.id || ticketData.technician_id || ticket.technician_id || ticketData.specialist_id;
        const currentId = ticket.id || ticketData.id;
        
        if (!technicianId) {
            showToast("Técnico no Asignado", "Debe asignar un técnico antes de solicitar un adelanto.", "error");
            return;
        }

        // Bloquear actualizaciones del prop durante la transacción para evitar parpadeo
        isProcessingAdvance.current = true;
        try {
            const updated = {
                ...ticketData,
                solicitudAdelanto: {
                    porcentaje: pctVal,
                    monto: amount,
                    fecha: new Date().toISOString()
                },
                pagoRechazado: null
            };
            setTicketData(updated);
            await syncToSupabase(updated);
            
            // ✅ FIX 2026-04-27: Esperar a que Supabase procese antes de limpiar estado
            await new Promise(resolve => setTimeout(resolve, 1200));
            
            setMontoAdelantoManual("");
            setPorcentajeAdelanto(null);
            showToast("Solicitud Enviada", `Se ha solicitado el adelanto de S/ ${amount.toFixed(2)}.`, "success");
        } catch (err) {
            console.error("Error al solicitar adelanto:", err);
            showToast("Error de Conexión", "No se pudo registrar la solicitud.", "error");
        } finally {
            // ✅ Limpiar flags
            requestAdvanceRef.current = false;
            setTimeout(() => { isProcessingAdvance.current = false; }, 3000);
        }
    };

    const handleRequestFinalLiquidation = () => {
        setShowLiquidationConfirm(true);
    };

    const handleActualLiquidation = async () => {
        setIsSavingNegotiation(true);
        setShowLiquidationConfirm(false);
        try {
            const costsRes = await supabase.from('ticket_costs').select('monto').eq('ticket_id', ticket.id).eq('estado_pago', 'pagado');
            const modernPaymentsSum = (costsRes.data || []).reduce((acc, c) => acc + (parseFloat(c.monto) || 0), 0);
            
            // UNIFICACIÓN: Incluir historialPagosTécnico (Legacy) para evitar liquidaciones de monto 0
            const legacyPaymentsSum = (ticketData.historialPagosTecnico || ticketData.historialPagosTécnico || []).reduce((acc: number, p: any) => acc + (parseFloat(p.monto) || 0), 0);
            const unifiedPaymentsSum = round2(modernPaymentsSum + legacyPaymentsSum);

            const costRef = round2(parseFloat(montoTotalCotizado as any || ticketData.montoFinal || 0));
            const amount = Math.max(0, round2(costRef - unifiedPaymentsSum));

            // Si el monto es 0 pero el ticket NO está pagado, algo anda mal con la sincronización o los datos
            if (amount <= 0 && costRef > 0) {
                console.warn("Monto de liquidación calculado como 0 con costo pactado > 0. Revisar pagos.");
            }

            const isExceeding = (unifiedPaymentsSum + amount > costRef + 1);
            const newState = isExceeding ? "requiere_revision_admin" : "por_liquidar";

            const updated = {
                ...ticketData,
                estadoId: newState,
                status_id: newState,
                final_balance: amount,
                solicitudLiquidacion: {
                    fecha: new Date().toISOString(),
                    monto: amount,
                    excedeTope: isExceeding
                }
            };

            setTicketData(updated);
            await onUpdate?.(ticketData.id, { 
                status_id: newState,
                metadata: updated.metadata || updated
            });

            showToast(
                newState === "por_liquidar" ? "Ticket en Liquidación" : "Requiere Revisión Admin",
                newState === "por_liquidar" 
                    ? "El ticket ha sido enviado a Tesorería para el pago final." 
                    : "El monto excede lo pactado. Un administrador debe aprobar el cierre.",
                newState === "por_liquidar" ? "success" : "info"
            );
        } catch (err) {
            console.error("Error in liquidation request:", err);
            showToast("Error", "No se pudo procesar la liquidación. Intente nuevamente.", "error");
        } finally {
            setIsSavingNegotiation(false);
        }
    };

    const handleFinishExecution = () => {
        if (evidenciasEjecucion.length < 1) {
            showToast("Evidencia Mandataria", "Debe adjuntar al menos 1 foto de la ejecución del trabajo.", "error");
            return;
        }
        const updated = {
            ...ticketData,
            estadoId: "documentacion_enviada",
            status_id: "documentacion_enviada", // Asegurar consistencia
            fechaFinEjecucion: new Date().toISOString(),
            gastos: gastos,
            evidenciasEjecucion: evidenciasEjecucion,
            evidenciasCampo: ticketData.evidenciasCampo || [],
            evidencias: ticketData.evidencias || [],
            // BLINDAJE: Mantener el monto aprobado
            montoFinal: montoTotalCotizado,
            partidas: partidasCotización
        };
        setTicketData(updated);
        
        // PERSISTENCIA INMEDIATA: Forzar el sync para evitar regresiones de estado al cerrar la ventana
        syncToSupabase(updated);
        
        showToast("¡Ejecución Finalizada!", "Se ha generado el expediente del servicio correctamente.", "success");
    };

    const handleApproveBudgetExceed = () => {
        setShowExceedApprovalConfirm(true);
    };

    const handleActualExceedApproval = async () => {
        setIsSavingNegotiation(true);
        setShowExceedApprovalConfirm(false);
        try {
            // 1. Preparar metadata correcta (Evitar bug de updated.metadata || updated)
            const newMetadata = {
                ...(ticketData.metadata || {}),
                excepcionPresupuestoAprobada: true,
                fechaAprobacionExcepcion: new Date().toISOString(),
                aprobadoPor: myProfileId,
                is_frozen: false // Asegurar limpieza de bandera si existe
            };

            const updated = {
                ...ticketData,
                estadoId: "por_liquidar",
                status_id: "por_liquidar",
                metadata: newMetadata
            };

            // 2. Actualización local inmediata para respuesta instantánea de la UI
            setTicketData(updated);

            // 3. Persistencia en Servidor
            if (onUpdate) {
                const result = await onUpdate(ticketData.id, { 
                    status_id: "por_liquidar",
                    metadata: newMetadata
                });
                
                // 4. Sincronización final con el resultado del servidor y recarga de costos
                if (result) {
                    setTicketData((prev: any) => ({ ...prev, ...result, estadoId: "por_liquidar" }));
                }
                
                // Forzar recarga de costos para asegurar que los cálculos financieros se actualicen
                await loadCosts();
            }

            showToast("Excepción Aprobada", "El ticket ha sido liberado para liquidación final.", "success");
        } catch (err) {
            console.error("Error approving budget exceed:", err);
            showToast("Error", "No se pudo aprobar la excepción.", "error");
        } finally {
            setIsSavingNegotiation(false);
        }
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
                direccion: selectedSede.address || selectedSede.direccion || "Sin dirección"
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
            showToast("✅ Ticket Activado", "Ticket clasificado y enviado al flujo operativo como Nuevo.", "success");
        } catch (error: any) {
            console.error("Error en triage:", error);
            showToast("Error al Clasificar", `Detalle: ${error?.message || 'Error desconocido'}`, "error");
        }
    };


    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const rawFiles = e.target.files;
        if (!rawFiles) return;

        const files = Array.from(rawFiles);
        
        // Compresión paralela
        const compressedFiles = await Promise.all(
            files.map(file => compressImage(file))
        );

        compressedFiles.forEach(file => {
            const reader = new FileReader();
            reader.onload = (event) => {
                const url = event.target?.result as string;
                const newEvidence = { url, name: file.name, size: file.size, type: file.type };

                setEvidenciasEjecucion(prev => {
                    const updated = [...prev, newEvidence];
                    setTicketData((current: any) => ({ ...current, evidenciasEjecucion: updated }));
                    return updated;
                });
            };
            reader.readAsDataURL(file);
        });

        if (fileInputRef.current) fileInputRef.current.value = "";
    };

    const handleDownloadTemplate = () => {
        const link = document.createElement('a');
        link.href = '/templates/PLANTILLA_COTIZACION.xlsx';
        link.download = 'PLANTILLA_COTIZACION_SINFIMAC.xlsx';
        link.click();
    };

    const [isMounted, setIsMounted] = useState(false);
    useEffect(() => {
        setIsMounted(true);
    }, []);

    const bringToFront = () => {
        // Solo actualizar si no es ya el z-index más alto (estimado)
        // para evitar re-renders innecesarios que causan parpadeo
        const currentMax = parseInt(localStorage.getItem('max_z_index') || '1000000');
        if (zIndex >= currentMax && zIndex > 1000000) return; 

        const nextZ = currentMax + 1;
        setZIndex(nextZ);
        localStorage.setItem('max_z_index', nextZ.toString());
    };

    const handleMouseDown = (e: React.MouseEvent) => {
        bringToFront();
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
        if (!confirm("¿Está seguro de anular este registro de costo? Esta acción es irreversible pero mantendrá la trazabilidad.")) return;
        try {
            await ticketCostsAPI.update(costId, { estado_pago: 'ANULADO' });
            await loadCosts();
            showToast("Registro Anulado", "El costo ha sido marcado como ANULADO.", "info");
        } catch (err) {
            console.error("Error anulling cost:", err);
            showToast("Error", "No se pudo anular el registro.", "error");
        }
    };

    useEffect(() => {
        techniciansAPI.getAll()
            .then((data: any[]) => setAllTechnicians(data || []))
            .catch((e: any) => console.error("Error loading technicians:", e));
    }, []);

    const handleSubmitMaterialsRequest = async () => {
        if (!materialsForm.concepto.trim() || !materialsForm.monto) {
            showToast("Campos incompletos", "El concepto y el monto son obligatorios.", "error");
            return;
        }
        if (!materialsForm.specialist_id || materialsForm.specialist_id.trim() === '') {
            showToast("Técnico requerido", "Seleccione el técnico de la lista desplegable para esta solicitud.", "error");
            return;
        }
        setIsSavingMaterials(true);
        try {
            const montoGasto = parseFloat(materialsForm.monto);
            const costoPactado = techPactedTotal;
            
            // Si el nuevo gasto hace que el total de honorarios supere el pactado, escalar
            const excedePresupuesto = (unifiedPaymentsSum + montoGasto > techPactedTotal + 0.01);

            await ticketCostsAPI.create({
                ticket_id: ticket.id,
                monto: montoGasto,
                categoria: materialsForm.categoria || "Materiales",
                concepto: materialsForm.concepto.trim(),
                specialist_id: materialsForm.specialist_id,
                proveedor: materialsForm.specialistName,
                estado_pago: "pendiente",
                solicitado_por: myProfileId || undefined
            });

            if (excedePresupuesto) {
                const frozenTicket = {
                   ...ticketData,
                   estadoId: "requiere_revision_admin",
                };
                setTicketData(frozenTicket);
                await onUpdate?.(ticketData.id, { status_id: "requiere_revision_admin" });
            }

            await loadCosts();
            setShowMaterialsModal(false);
            setMaterialsForm({ concepto: "", monto: "", categoria: "Materiales", specialist_id: "", specialistName: "", searchQuery: "", showDropdown: false });
            showToast(
                "Solicitud Enviada a Tesorería",
                `Solicitud de ${materialsForm.categoria} registrada para ${materialsForm.specialistName}. Pendiente de abono.`,
                "success"
            );
        } catch (err: any) {
            console.error("Error saving materials request:", err);
            const detail = err?.message || err?.details || "Error desconocido";
            showToast("Error al Registrar", `No se pudo guardar: ${detail}`, "error");
        } finally {
            setIsSavingMaterials(false);
        }
    };




    const jobCostBase = finances.totalPactedDebt;
    const visitPayment = round2(parseFloat(ticketData.costoVisita || ticketData.costoPasaje || 0));
    const classicAdvance = round2(parseFloat(ticketData.montoAdelantoManual || ticketData.adelantoMonto || 0));
    const rentabilidadReal = grossMargin;
    const paymentsSummary = unifiedPaymentsSum;
    const costPercentage = 100 - pctReal;

    const isClientTicketFormatValid = useCallback((num?: string) => {
        if (!num || num.trim() === "") return false;
        if (num.startsWith('#')) return true; 
        return /^MB\d{6}\.\d{2}$/.test(num);
    }, []);

    const capitalExposed = finances.totalPaidCalculated;

    const handleCloseInternal = () => {
        // Optimismo visual: Cerramos la interfaz inmediatamente
        // y dejamos que la sincronización ocurra en segundo plano
        // si no hay transiciones de estado críticas pendientes.
        syncToSupabase().catch(err => console.error("Sync error on close:", err));
        onClose();
    };

    const handleCompleteClosure = async () => {
        try {
            const updated = {
                ...ticketData,
                estadoId: "ticket_cerrado",
                status_id: "ticket_cerrado",
                fechaCierre: new Date().toISOString()
            };
            setTicketData(updated);
            await syncToSupabase(updated);
            showToast("Ticket Cerrado", "El ticket ha sido cerrado y archivado correctamente.", "success");
            onClose();
        } catch (err) {
            console.error("Error al cerrar ticket:", err);
            showToast("Error", "No se pudo cerrar el ticket.", "error");
        }
    };

    const [showRescueModal, setShowRescueModal] = useState(false);
    const [isSavingRescue, setIsSavingRescue] = useState(false);
    const [rescueForm, setRescueForm] = useState({ monto: '', motivo: '' });

    const handleOpenRescue = () => {
        setRescueForm({ monto: '', motivo: '' });
        setShowRescueModal(true);
    };

    const handleSubmitRescueRequest = async () => {
        const montoNum = parseFloat(rescueForm.monto);
        if (isNaN(montoNum) || montoNum <= 0) {
            showToast("Monto Inválido", "Por favor ingrese un monto válido mayor a cero.", "error");
            return;
        }

        const isExceeding = montoNum > (availableRescue + 0.01);
        
        // REGLA: Si excede, el motivo es obligatorio
        if (isExceeding && !rescueForm.motivo.trim()) {
            showToast("Motivo Obligatorio", "Para solicitudes que exceden el saldo pactado, debe indicar el motivo detallado.", "error");
            return;
        }

        setIsSavingRescue(true);
        try {
            const estadoInicial = isExceeding ? 'REQUIERE_APROBACION_ADMIN' : 'pendiente';
            
            await ticketCostsAPI.create({
                ticket_id: ticketData.id,
                monto: montoNum,
                categoria: 'Rescate Financiero',
                concepto: isExceeding 
                    ? `EXCEDENTE DE MANO DE OBRA: ${rescueForm.motivo}`
                    : `Rescate Financiero: ${rescueForm.motivo || 'Sin motivo especificado'} (Prioridad Alta)`,
                motivo: rescueForm.motivo.trim(),
                estado_pago: estadoInicial,
                solicitado_por: myProfileId || undefined,
                specialist_id: ticketData.technician_id,
                proveedor: 'Rescate Financiero'
            });

            if (isExceeding) {
                showToast("Aprobación Requerida", "Esta solicitud excede el pactado. Se ha enviado al Administrador para su autorización.", "info");
            } else {
                showToast("Solicitud Enviada", "El rescate financiero ha sido registrado y enviado a Tesorería.", "success");
            }
            
            setShowRescueModal(false);
            loadCosts();
        } catch (err: any) {
            console.error("Error creating rescue request:", err);
            const detail = err?.message || err?.details || "Error desconocido";
            showToast("Error", `No se pudo registrar el rescate: ${detail}`, "error");
        } finally {
            setIsSavingRescue(false);
        }
    };

    // ✅ ADMINISTRACIÓN: Aprobación/Denegación de Rescate Financiero
    const handleApproveRescueAdmin = async (costId: string) => {
        try {
            await ticketCostsAPI.update(costId, { estado_pago: 'pendiente' });
            showToast("Solicitud Aprobada", "El rescate ha sido aprobado y enviado a Tesorería.", "success");
            loadCosts();
        } catch (err) {
            console.error("Error approving rescue:", err);
            showToast("Error", "No se pudo aprobar la solicitud.", "error");
        }
    };

    const handleRejectRescueAdmin = async (costId: string) => {
        if (!confirm("¿Está seguro de que desea DENEGAR esta solicitud de rescate?")) return;
        try {
            await ticketCostsAPI.update(costId, { estado_pago: 'RECHAZADO' });
            showToast("Solicitud Denegada", "El rescate ha sido denegado y el registro se mantiene para historial.", "info");
            loadCosts();
        } catch (err) {
            console.error("Error rejecting rescue:", err);
            showToast("Error", "No se pudo denegar la solicitud.", "error");
        }
    };

    // --- CÁLCULOS PARA RESCATE FINANCIERO (FÓRMULA ESTRICTA) ---
    // Regla: El rescate solo descuenta de la MO Pactada y los adelantos/rescates previos.
    // Las "Compras" (Materiales/Logística) NO afectan este saldo.
    const totalPactadoTecnico = pactedMO;
    const totalAdelantadoAlTecnico = finances.totalPaidCalculated;
    
    // REFUERZO: Si no hay pactado definido aún pero el ticket está en ejecución, permitir un rescate base de S/ 100
    // (Lógica movida arriba a la sección financiera centralizada)

    return (
        <>
            {isMaximized && !isMinimized && <div className={styles.overlay} style={{ zIndex: zIndex - 1 }} />}

            <div
                ref={windowRef}
                className={`${styles.window} ${!isMounted ? styles.windowMounting : ''} ${isMaximized ? styles.maximized : ''} ${isMinimized ? styles.minimized : ''}`}
                onMouseDown={bringToFront}
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
                                        {ticketData.metadata?.titulo ||
                                            (ticketData.numeroTicketCliente
                                                ? ticketData.numeroTicketCliente
                                                : `Ticket #${ticketData.id.slice(-6)}`)
                                        }
                                    </h3>
                                    <span>{ticket.cliente?.nombre || 'Sin cliente'} <span style={{ opacity: 0.5, fontSize: '0.65rem' }}>v1.3.3 - Sincronizado</span></span>
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

                    <div className={styles.windowControls} onMouseDown={(e) => { e.stopPropagation(); bringToFront(); }} onClick={(e) => e.stopPropagation()}>
                        {!isMinimized && (
                            <>
                                {isAdmin && (
                                    <button
                                        className={`${styles.controlBtn} ${styles.deleteTicketHeaderBtn}`}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setShowDeleteModal(true);
                                        }}
                                        title="ELIMINACIÓN DEFINITIVA"
                                        style={{ color: '#ef4444', marginRight: '10px' }}
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                )}
                                <button
                                    className={styles.controlBtn}
                                    onMouseDown={(e) => { e.stopPropagation(); e.preventDefault(); }}
                                    onClick={(e) => { 
                                        e.stopPropagation(); 
                                        e.preventDefault();
                                        handleMinimize(); 
                                    }}
                                    title="Minimizar"
                                >
                                    <Minimize2 size={16} />
                                </button>
                                <button
                                    className={styles.controlBtn}
                                    onMouseDown={(e) => { e.stopPropagation(); e.preventDefault(); }}
                                    onClick={(e) => { 
                                        e.stopPropagation(); 
                                        e.preventDefault();
                                        handleMaximize(); 
                                    }}
                                    title={isMaximized ? "Restaurar" : "Maximizar"}
                                >
                                    {isMaximized ? <Square size={14} /> : <Maximize2 size={16} />}
                                </button>
                            </>
                        )}
                        <button
                            className={`${styles.controlBtn} ${styles.closeBtn} ${isMinimized ? styles.minimizedClose : ''}`}
                            onMouseDown={(e) => { e.stopPropagation(); e.preventDefault(); }}
                            onClick={(e) => { 
                                e.stopPropagation(); 
                                e.preventDefault();
                                handleCloseInternal(); 
                            }}
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

                            <GestoraAssignmentBar 
                                ticket={ticketData}
                                canAssign={userRole === 'admin' || userRole === 'superadmin' || userRole === 'ADMIN' || userRole === 'SUPERADMIN' || (myGestoraId === ticketData.gestora_id)}
                                onAssign={() => setShowGestoraDrawer(true)}
                            />

                            <TechnicianSchedulingBar
                                ticket={ticketData}
                                onReassign={() => {
                                    setShowAssignmentDrawer(true);
                                }}
                                onEditSchedule={() => {
                                    setTicketData({ ...ticketData, estadoId: 'en_inspeccion', fechaVisita: undefined });
                                }}
                            />

                            <DiagnosisInfoBar 
                                ticket={ticketData} 
                                onEdit={isAdmin || (myGestoraId === ticketData.gestora_id) ? handleOpenReportUpdate : undefined}
                            />
                            <QuoteAssistantBar ticket={ticketData} />
                            <QuotationInfoBar 
                                ticket={ticketData} 
                                onToggleDetails={() => setIsQuotationCollapsed(!isQuotationCollapsed)}
                                isCollapsed={isQuotationCollapsed}
                             />
                            <FinancialLiquidationBar 
                                ticket={ticketData} 
                                onOpenMaterials={() => handleOpenExpenseModal()} 
                                onOpenRescue={handleOpenRescue}
                                costos={ticketCosts}
                                availableRescue={availableRescue}
                            />
                            <PaymentHistoryBar ticket={ticketData} costos={ticketCosts} />
                            <UnifiedEvidenceBar ticket={ticketData} />
                            <DocumentationSummaryBar ticket={ticketData} />
                        </div>

                        <div className={styles.operationalArea}>
                            {ticketData.pagoRechazado && (
                                <div className={styles.rejectionBanner}>
                                    <div className={styles.rejectionIcon}><Ban size={24} /></div>
                                    <div className={styles.rejectionContent}>
                                        <h4>SOLICITUD DE PAGO DENEGADA</h4>
                                        <p>La solicitud de <strong>{ticketData.pagoRechazado.tipo}</strong> por <strong>S/ {formatSoles(ticketData.pagoRechazado.monto)}</strong> fue denegada.</p>
                                        <span>Acción Requerida: Revise las observaciones y genere una nueva solicitud desde cero.</span>
                                    </div>
                                    <button onClick={() => setTicketData({...ticketData, pagoRechazado: null})} className={styles.dismissRejection}>Entendido</button>
                                </div>
                            )}

                            {children || (
                                <>
                                    {ticketData.estadoId === "borrador" && (
                                        <div className={styles.triageBox}>
                                            <div className={styles.triageHeader}>
                                                <Sparkles size={24} color="#8B5CF6" />
                                                <div style={{ textAlign: 'left' }}>
                                                    <h3 className={styles.triageTitle}>Bandeja de Triage - Mibanco</h3>
                                                    <p className={styles.triageSubtitle}>Clasificación y Validación de Ticket Automático</p>
                                                </div>
                                            </div>

                                            <div className={styles.triageForm}>
                                                <div className={styles.triageField}>
                                                    <label>✍️ Descripción del Problema (Editable):</label>
                                                    <textarea
                                                        value={triageDescription}
                                                        onChange={(e) => setTriageDescription(e.target.value)}
                                                        className={styles.triageSelect}
                                                        rows={4}
                                                        placeholder="Describa el problema reportado..."
                                                        style={{ resize: 'vertical', fontFamily: 'inherit', fontSize: '0.9rem', fontWeight: 500 }}
                                                    />
                                                </div>

                                                <div className={styles.triageField}>
                                                    <label>🏢 Sede Reportada por Banco:</label>
                                                    <div className={styles.readonlyValue}>
                                                        {ticketData.sede_reportada_cliente || ticketData.metadata?.codigo_sede_extraido || "No especificada"}
                                                    </div>
                                                </div>

                                                {!ticketData.branch_id && !triageSedeId && (
                                                    <div className={styles.triageAlert}>
                                                        <AlertTriangle size={16} />
                                                        <span>Sede no mapeada automáticamente. Seleccione manualmente para entrenar al sistema.</span>
                                                    </div>
                                                )}

                                                <div className={styles.triageField}>
                                                    <label>📍 Vincular a Sede Real:</label>
                                                    {ticketData.branch_id ? (
                                                        <div className={styles.readonlyValue} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                            <span>➔</span>
                                                            <span style={{ fontWeight: 700, color: '#1E293B' }}>
                                                                {sedesMibanco.find((s: any) => s.id === ticketData.branch_id)?.name
                                                                    || ticketData.sede?.nombre
                                                                    || ticketData.branch_id}
                                                            </span>
                                                            <span style={{ fontSize: '0.75rem', color: '#64748B' }}>(agencia ya consolidada — no modificable)</span>
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

                                                <div className={styles.triageField}>
                                                    <label>⚙️ Tipo de Servicio (según catálogo de técnicos):</label>
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
                                                Revise la información y proceda a la asignación del especialista.
                                            </p>
                                            <button className={styles.mainActionBtnPremium} onClick={handleProceedToAssignment}>
                                                <UserPlus size={20} />
                                                <span>Asignar Técnico</span>
                                                <ArrowRight size={18} className={styles.btnArrow} />
                                            </button>
                                        </div>
                                    )}

                                    {ticketData.estadoId === "esperando_pago_visita" && !isVisitPaid && (
                                            <div className={styles.stepPlaceholder}>
                                                <div className={styles.waitingForManager} style={{ padding: '40px', background: '#F8FAFC', borderRadius: '24px', border: '1px solid #E2E8F0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '15px' }}>
                                                    <div style={{ background: '#3B82F6', padding: '15px', borderRadius: '50%', color: 'white', display: 'flex' }}>
                                                        <Coins size={32} />
                                                    </div>
                                                    <div style={{ textAlign: 'center' }}>
                                                        <h3 style={{ margin: 0, color: '#1E293B', fontSize: '1.2rem', fontWeight: 800 }}>PAGO DE VISITA EN PROCESO</h3>
                                                        <p style={{ margin: '5px 0 0 0', color: '#64748B', fontWeight: 500 }}>
                                                            La gestión financiera se realiza exclusivamente en el panel inferior "Desglose de Costos y Pagos".
                                                        </p>
                                                    </div>
                                                    <div style={{ background: '#EFF6FF', color: '#3B82F6', padding: '8px 16px', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 700 }}>
                                                        ESPERANDO CONFIRMACIÓN DE TESORERÍA
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                    {(ticketData.estadoId === "en_inspeccion" || (ticketData.estadoId === "esperando_pago_visita" && isVisitPaid)) && (
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
                                                    <h3 className={styles.quotationTitle} style={{ fontSize: '18px', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.02em' }}>
                                                        {ticketData.estadoId === "en_cotizacion" ? "Elaboración de Cotización Formal" : "Cotización Aprobada y Registrada"}
                                                    </h3>
                                                    <p className={styles.quotationSubtitle} style={{ fontSize: '13px', color: '#64748b', marginTop: '2px', fontWeight: 500 }}>
                                                        {ticketData.estadoId === "en_cotizacion"
                                                            ? "Prepare el presupuesto final usando la plantilla oficial"
                                                            : isQuotationCollapsed ? "Pulse para ver detalles de la cotización" : "Documento oficial del servicio. Los cambios requieren Autorización."
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
                                                            <div className={styles.sidebarProfitabilityGrid}>
                                                                <div className={styles.techCostCard}>
                                                                    <span className={styles.techCostLabel}>PRESUPUESTO TÉCNICO</span>
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
                                                                            const totalCostoTécnico = (parseFloat(ticketData.costoManoObra || 0) + parseFloat(ticketData.costoMateriales || 0)) || parseFloat(ticketData.costoVisita || 0);
                                                                            const meta55 = totalCostoTécnico / 0.45;

                                                                            if (montoTotalCotizado < totalCostoTécnico) {
                                                                                return (
                                                                                    <div className={styles.lossWarning}>
                                                                                        <div className={styles.lossTitle}>
                                                                                            <span>⚠️ PÉRDIDA DETECTADA</span>
                                                                                        </div>
                                                                                        <span className={styles.lossValue}>
                                                                                            El presupuesto es menor al costo técnico (S/ {formatSoles(totalCostoTécnico)})
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
                                                                    💡 Ajuste los precios en el editor de la derecha para cubrir el costo técnico y alcanzar el margen operativo sugerido.
                                                                </p>
                                                            )}

                                                            {["cotizacion_aprobada", "en_ejecucion", "documentacion_enviada", "por_liquidar", "pago_realizado", "ticket_cerrado"].includes(ticketData.estadoId) && !ticketData.modificacionAutorizada && (
                                                                <div className={styles.authorizationSection}>
                                                                    <div className={styles.authLockIcon}>
                                                                        <Lock size={40} />
                                                                    </div>
                                                                    <p className={styles.authText}>
                                                                        La cotización ya fue aprobada por el cliente. Para realizar cambios, se requiere el visto bueno de Gerencia.
                                                                    </p>
                                                                    {isAdmin ? (
                                                                        <button
                                                                            className={`${styles.authorizeBtn} ${ticketData.solicitudModificacion ? styles.pulseAlert : ''}`}
                                                                            onClick={handleAuthorizeModification}
                                                                        >
                                                                            {ticketData.solicitudModificacion ? <Sparkles size={18} /> : null}
                                                                            <span>{ticketData.solicitudModificacion ? 'APROBAR SOLICITUD DE CAMBIO' : 'AUTORIZAR MODIFICACIÓN'}</span>
                                                                        </button>
                                                                    ) : (
                                                                        ticketData.solicitudModificacion ? (
                                                                            <div className={styles.waitingBadge}>
                                                                                <Clock size={18} className={styles.spinSlow} />
                                                                                <span>PETICIÓN ENVIADA - ESPERANDO VISTO BUENO</span>
                                                                            </div>
                                                                        ) : (
                                                                            <button
                                                                                className={styles.requestAuthBtn}
                                                                                onClick={handleRequestModification}
                                                                            >
                                                                                <Send size={18} />
                                                                                <span>SOLICITAR AUTORIZACIÓN PARA EDITAR</span>
                                                                            </button>
                                                                        )
                                                                    )}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div className={styles.quotationMainEditor}>
                                                        {/* Lógica Diferenciada: BCP vs Otros Clientes */}
                                                        {ticketData.cliente?.nombre?.toUpperCase().includes("BCP") ? (
                                                            <div style={{ background: '#ffffff', padding: '20px', borderRadius: '16px', border: '1px solid #e2e8f0', marginBottom: '20px', boxShadow: '0 4px 20px rgba(0,0,0,0.03)' }}>
                                                                <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '20px' }}>
                                                                    <div style={{ background: 'linear-gradient(135deg, #0284c7, #0369a1)', padding: '12px', borderRadius: '12px', boxShadow: '0 4px 12px rgba(2, 132, 199, 0.2)' }}>
                                                                        <FileSpreadsheet size={24} color="#ffffff" />
                                                                    </div>
                                                                    <div>
                                                                        <h4 style={{ margin: 0, color: '#0f172a', fontSize: '17px', fontWeight: 800 }}>Cotización Formato BCP</h4>
                                                                        <p style={{ margin: 0, color: '#64748b', fontSize: '13px', fontWeight: 500 }}>
                                                                            Uso obligatorio de la plantilla oficial de Excel.
                                                                        </p>
                                                                    </div>
                                                                </div>

                                                                {/* Zona de Carga / Visualización */}
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
                                                                                    <span style={{ fontSize: '12px', color: '#94a3b8' }}>• Subido el {new Date(bcpQuotationFile.fecha).toLocaleDateString()}</span>
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
                                                                    * El sistema calcula automáticamente el IGV (18%) y el Total basándose en el subtotal ingresado para garantizar la precisión.
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
                                                            // --- VISTA ESTÁNDAR (EDITOR PDF) ---
                                                            <OnlineQuotationEditor
                                                                ref={quotationEditorRef}
                                                                isLocked={["cotizacion_aprobada", "en_ejecucion", "documentacion_enviada", "por_liquidar", "pago_realizado", "ticket_cerrado"].includes(ticketData.estadoId) && !ticketData.modificacionAutorizada}
                                                                clientInfo={ticketData.cliente}
                                                                sedeInfo={ticketData.sede}
                                                                servicioId={ticketData.servicioId}
                                                                ticketId={ticketData.numeroTicketCliente || ticketData.id}
                                                                initialItems={partidasCotización}
                                                                suggestedTotal={round2((round2(ticketData.costoManoObra || 0) + round2(ticketData.costoMateriales || 0) + round2(ticketData.costoVisita || 0)) / 0.45)}
                                                                onUpdate={(items: any[], total: number) => {
                                                                    setPartidasCotización(items);
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
                                                                            partidas: partidasCotización,
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

                                    {(ticketData.estadoId === "cotizacion_enviada") && (
                                        <div className={styles.successWaitingCard}>
                                            <div className={styles.successIconWrapper}>
                                                <CheckCircle size={48} />
                                            </div>

                                            <div>
                                                <h2 className={styles.successTitle}>Cotización Enviada con Éxito</h2>
                                                <p className={styles.successDescription}>
                                                    El presupuesto formal ha sido enviado al correo del cliente. <br />
                                                    El ticket permanecerá en pausa hasta recibir su confirmación.
                                                </p>
                                            </div>

                                            <div className={styles.actionButtonGroup}>
                                                <button
                                                    className={styles.primaryActionBtn}
                                                    onClick={handleApproveQuote}
                                                    style={{ background: 'linear-gradient(135deg, #10B981, #059669)', border: 'none', color: 'white' }}
                                                >
                                                    <ThumbsUp size={22} />
                                                    <span>EL CLIENTE APRUEBA COTIZACIÓN</span>
                                                </button>

                                                <button
                                                    className={styles.secondaryActionBtn}
                                                    onClick={handleReadjustQuote}
                                                    style={{ background: '#F8FAFC', border: '1.5px solid #CBD5E1', color: '#475569' }}
                                                >
                                                    <RefreshCw size={18} />
                                                    <span>SOLICITA REAJUSTE / REPROGRAMAR</span>
                                                </button>

                                                <button
                                                    className={styles.secondaryActionBtn}
                                                    onClick={handleOpenCancel}
                                                    style={{ background: '#FEF2F2', border: '1.5px solid #FCA5A5', color: '#B91C1C' }}
                                                >
                                                    <XCircle size={18} />
                                                    <span>EL CLIENTE ANULA / RECHAZA</span>
                                                </button>
                                            </div>
                                        </div>
                                    )}

                                    {["cotizacion_aprobada", "en_ejecucion"].includes(ticketData.estadoId) && (
                                        <div className={styles.stepActions}>
                                            <div className={styles.operationalFlowCard}>
                                                {ticketData.estadoId === "cotizacion_aprobada" && (
                                                    <div className={styles.premiumApprovedNotice}>
                                                        <div className={styles.noticeTopHeader}>
                                                            <div className={styles.approvedIconGlow}>
                                                                <CheckCircle2 size={48} color="#10B981" />
                                                            </div>
                                                            <div className={styles.noticeTextContent}>
                                                                <h3 className={styles.noticeTitle}>Presupuesto Aprobado por Cliente</h3>
                                                                <p className={styles.noticeText}>
                                                                    Proceda con la <strong>ejecución</strong> de los trabajos <strong>según</strong> lo cotizado.
                                                                </p>
                                                            </div>
                                                        </div>

                                                        {/* SECCIÓN DE ADELANTO RESTAURADA */}
                                                        {!ticketData.adelantoPagado && (
                                                            <div className={styles.advanceRequestPremium}>
                                                                <div className={styles.advanceInfoGrid}>
                                                                    <div className={styles.advanceMeta}>
                                                                        <div className={styles.metaIcon}><CreditCard size={18} /></div>
                                                                        <div>
                                                                            <span className={styles.metaLabel}>Adelanto al Técnico</span>
                                                                            <span className={styles.metaValue}>
                                                                                {ticketData.solicitudAdelanto 
                                                                                    ? `Solicitado: ${(ticketData.solicitudAdelanto.porcentaje * 100).toFixed(0)}% (S/ ${formatSoles(ticketData.solicitudAdelanto.monto)})`
                                                                                    : "Seleccione el porcentaje deseado"}
                                                                            </span>
                                                                        </div>
                                                                    </div>
                                                                </div>

                                                                {!ticketData.solicitudAdelanto && (
                                                                    <div className={styles.percentageSelectorPremium}>
                                                                        {[0.4, 0.5, 0.6].map(p => (
                                                                            <button
                                                                                key={p}
                                                                                className={`${styles.pctBtnPremium} ${porcentajeAdelanto === p && !montoAdelantoManual ? styles.pctActivePremium : ''}`}
                                                                                onClick={() => {
                                                                                    setPorcentajeAdelanto(p);
                                                                                    setMontoAdelantoManual("");
                                                                                }}
                                                                            >
                                                                                {(p * 100).toFixed(0)}%
                                                                            </button>
                                                                        ))}
                                                                        <div className={styles.manualAmountContainer}>
                                                                            <span className={styles.manualCurrency}>S/</span>
                                                                            <input 
                                                                                type="number"
                                                                                className={styles.manualAmountInput}
                                                                                placeholder="Monto"
                                                                                value={montoAdelantoManual}
                                                                                onChange={(e) => {
                                                                                    setMontoAdelantoManual(e.target.value);
                                                                                    setPorcentajeAdelanto(null);
                                                                                }}
                                                                                onKeyDown={(e) => {
                                                                                    if (e.key === 'Enter') {
                                                                                        if (isAdmin) handleConfirmAdvance();
                                                                                        else handleRequestAdvance();
                                                                                    }
                                                                                }}
                                                                            />
                                                                        </div>
                                                                    </div>
                                                                )}

                                                                {isAdmin ? (
                                                                    <button
                                                                        className={styles.confirmAdvanceBtnPremium}
                                                                        onClick={handleConfirmAdvance}
                                                                        disabled={isConfirmingPayment || (!ticketData.solicitudAdelanto && !porcentajeAdelanto && !montoAdelantoManual)}
                                                                    >
                                                                        {isConfirmingPayment ? <Clock size={18} className={styles.spinner} /> : <CheckCircle size={18} />}
                                                                        <span>{ticketData.solicitudAdelanto ? 'Confirmar Depósito' : 'Registrar Depósito Directo'}</span>
                                                                    </button>
                                                                ) : (
                                                                    !ticketData.solicitudAdelanto && (
                                                                        <button
                                                                            className={styles.requestAdvanceBtnPremium}
                                                                            onClick={handleRequestAdvance}
                                                                            disabled={!porcentajeAdelanto && !montoAdelantoManual}
                                                                        >
                                                                            <Send size={18} />
                                                                            <span>Solicitar Adelanto a Gerencia</span>
                                                                        </button>
                                                                    )
                                                                )}

                                                                {ticketData.solicitudAdelanto && !isAdmin && (
                                                                    <div className={styles.waitingNoticePremium}>
                                                                        <Clock size={16} />
                                                                        <span>Esperando confirmación de Tesorería...</span>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                )}

                                                {ticketData.adelantoPagado && (
                                                    <div className={styles.executionGrid}>
                                                    <div className={styles.evidenceSection}>
                                                        <div className={styles.sectionHeaderMini}>
                                                            <Camera size={18} />
                                                            <h4>EVIDENCIAS DE EJECUCIÓN</h4>
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
                                                                className={styles.dropZoneExecutionPremium}
                                                                onClick={() => fileInputRef.current?.click()}
                                                            >
                                                                <div className={styles.dropZoneIconWrapper}>
                                                                    <Upload size={28} />
                                                                </div>
                                                                <span className={styles.dropZonePrimary}>Adjuntar Evidencias</span>
                                                                <span className={styles.dropZoneSecondary}>Haga clic aquí para subir fotos de la ejecución</span>
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
                                                            * Es obligatorio adjuntar al menos 1 evidencia para finalizar el trabajo.
                                                        </p>
                                                    </div>

                                                    <div className={styles.flowActionsSection}>
                                                        <button
                                                            className={styles.finishWorkBtn}
                                                            onClick={handleFinishExecution}
                                                            disabled={evidenciasEjecucion.length < 1}
                                                        >
                                                            <CheckCircle size={20} />
                                                            <span>FINALIZAR TRABAJOS Y ENVIAR DOCUMENTACIÓN</span>
                                                        </button>

                                                        <button
                                                            className={styles.secondaryActionBtn}
                                                            onClick={() => handleOpenExpenseModal()}
                                                            style={{ 
                                                                marginTop: '10px', 
                                                                display: 'flex', 
                                                                alignItems: 'center', 
                                                                justifyContent: 'center', 
                                                                gap: '8px', 
                                                                width: '100%', 
                                                                padding: '12px', 
                                                                borderRadius: '12px', 
                                                                border: '2px solid #E2E8F0', 
                                                                background: '#F8FAFC', 
                                                                color: '#475569', 
                                                                fontWeight: 700, 
                                                                fontSize: '0.85rem', 
                                                                cursor: 'pointer',
                                                                transition: 'all 0.2s ease'
                                                            }}
                                                        >
                                                            <Package size={18} />
                                                            <span>Solicitar Pago Materiales (Técnico Externo)</span>
                                                        </button>

                                                        <p style={{ fontSize: '0.75rem', color: '#94A3B8', marginTop: '10px', textAlign: 'center' }}>
                                                            La gestión financiera de este ticket se realiza exclusivamente en el panel inferior.
                                                        </p>
                                                    </div>
                                                </div>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    {ticketData.estadoId === "documentacion_enviada" && (
                                        <div className={styles.checklistContainer} style={{ order: -1, marginBottom: '20px' }}>
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
                                                        onClick={() => {
                                                            const updated = { ...documentosChecklist, actaConformidad: !documentosChecklist.actaConformidad };
                                                            setDocumentosChecklist(updated);
                                                            setTicketData({ ...ticketData, documentosChecklist: updated });
                                                        }}
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
                                                        onClick={() => {
                                                            const updated = { ...documentosChecklist, ats: !documentosChecklist.ats };
                                                            setDocumentosChecklist(updated);
                                                            setTicketData({ ...ticketData, documentosChecklist: updated });
                                                        }}
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
                                                        onClick={() => {
                                                            const updated = { ...documentosChecklist, declaracionJurada: !documentosChecklist.declaracionJurada };
                                                            setDocumentosChecklist(updated);
                                                            setTicketData({ ...ticketData, documentosChecklist: updated });
                                                        }}
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
                                                        onClick={() => {
                                                            const updated = { ...documentosChecklist, excelSeguridad: !documentosChecklist.excelSeguridad };
                                                            setDocumentosChecklist(updated);
                                                            setTicketData({ ...ticketData, documentosChecklist: updated });
                                                        }}
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
                                                                {isClientTicketFormatValid(ticketData.numeroTicketCliente) && (
                                                                    <span style={{ fontSize: '0.65rem', color: '#059669', background: '#DCFCE7', padding: '1px 6px', borderRadius: '4px' }}>VALIDADO</span>
                                                                )}
                                                            </div>
                                                            <input
                                                                type="text"
                                                                className={styles.inlineTicketInput}
                                                                placeholder={`EJ: MB000025.${new Date().getFullYear().toString().slice(-2)}`}
                                                                value={ticketData.numeroTicketCliente || ""}
                                                                
                                                                // Si el ticket ya venÃƒÂ­a con nÃƒÂºmero asignado (desde props), bloquear ediciÃƒÂ³n
                                                                disabled={ticketData.estadoId !== "documentacion_enviada" && !isAdmin}
                                                                style={ticketData.estadoId !== "documentacion_enviada" && !isAdmin ? { background: '#F1F5F9', color: '#64748B', cursor: 'not-allowed', border: '1px solid #E2E8F0' } : {}}
                                                                onChange={(e) => {
                                                                    const val = e.target.value.toUpperCase().replace(/[^A-Z0-9.#]/g, '');
                                                                    setTicketData({ ...ticketData, numeroTicketCliente: val });
                                                                }}
                                                                onClick={(e) => e.stopPropagation()}
                                                            />
                                                            {!ticketData.numeroTicketCliente && (
                                                                <span style={{ color: '#EF4444', fontSize: '0.65rem', fontWeight: 800, marginTop: '4px' }}>
                                                                    ¡OBLIGATORIO: PENDIENTE DE ASIGNAR!
                                                                </span>
                                                            )}
                                                            {ticketData.numeroTicketCliente && !(/^MB\d{6}\.\d{2}$/.test(ticketData.numeroTicketCliente)) && !ticketData.numeroTicketCliente.startsWith('#') && (
                                                                <span style={{ color: '#F59E0B', fontSize: '0.65rem', fontWeight: 700, marginTop: '4px', lineHeight: '1.2' }}>
                                                                    FORMATO REQUERIDO: MB + 6 DÍGITOS + PUNTO + AÑO (26)<br />
                                                                    Ejemplo: MB000025.{new Date().getFullYear().toString().slice(-2)}
                                                                </span>
                                                            )}
                                                            {ticketData.numeroTicketCliente && (/^MB\d{6}\.\d{2}$/.test(ticketData.numeroTicketCliente)) && (
                                                                <span style={{ color: '#059669', fontSize: '0.65rem', fontWeight: 800, marginTop: '4px' }}>
                                                                    ✔ FORMATO VÁLIDO
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>

                                                <button
                                                    className={styles.proceedToLiquidationBtn}
                                                    disabled={!Object.values(documentosChecklist).every(v => v) || !isClientTicketFormatValid(ticketData.numeroTicketCliente)}
                                                    onClick={handleRequestFinalLiquidation}
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

                                    {["por_liquidar", "ticket_cerrado", "requiere_revision_admin"].includes(ticketData.estadoId) && (
                                        <div className={styles.liquidationContainerPremium}>
                                            {ticketData.estadoId === "requiere_revision_admin" && (
                                                <div className={styles.adminReviewAlert} style={{ 
                                                    background: '#FEF2F2', 
                                                    border: '1.5px solid #FCA5A5', 
                                                    borderRadius: '16px', 
                                                    padding: '24px', 
                                                    marginBottom: '20px',
                                                    display: 'flex',
                                                    flexDirection: 'column',
                                                    gap: '16px',
                                                    boxShadow: '0 4px 12px rgba(239, 68, 68, 0.1)'
                                                }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                        <div style={{ background: '#EF4444', color: 'white', padding: '10px', borderRadius: '12px' }}>
                                                            <AlertTriangle size={24} />
                                                        </div>
                                                        <div>
                                                            <h4 style={{ color: '#991B1B', fontSize: '16px', fontWeight: 800, margin: 0 }}>TICKET CONGELADO: EXCESO DE PRESUPUESTO</h4>
                                                            <p style={{ color: '#B91C1C', fontSize: '13px', margin: '4px 0 0 0', fontWeight: 500 }}>
                                                                Esta liquidación excede el monto pactado originalmente. Requiere revisión y aprobación de un administrador para proceder.
                                                            </p>
                                                        </div>
                                                    </div>
                                                    
                                            {isAdmin && (
                                                <div style={{ display: 'flex', gap: '12px' }}>
                                                    <button 
                                                        onClick={handleApproveBudgetExceed}
                                                        style={{ 
                                                            background: '#EF4444', 
                                                            color: 'white', 
                                                            border: 'none', 
                                                            padding: '10px 20px', 
                                                            borderRadius: '10px', 
                                                            fontSize: '13px', 
                                                            fontWeight: 700,
                                                            cursor: 'pointer',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            gap: '8px'
                                                        }}
                                                    >
                                                        <ThumbsUp size={16} />
                                                        APROBAR EXCEPCIÓN Y LIBERAR PAGO
                                                    </button>
                                                </div>
                                            )}
                                                </div>
                                            )}
                                            <div className={styles.liquidationCardPremium}>
                                                <div className={styles.liquidationHeaderPremium} style={ticketData.estadoId === "ticket_cerrado" ? { background: 'linear-gradient(135deg, #065F46, #059669)', color: 'white' } : {}}>
                                                    <div className={styles.headerTitleWrapper}>
                                                        <div className={styles.headerIconBox} style={ticketData.estadoId === "ticket_cerrado" ? { background: 'rgba(255,255,255,0.2)', color: 'white' } : {}}>
                                                            <Calculator size={28} />
                                                        </div>
                                                        <div className={styles.headerTextGroup}>
                                                            <h3 style={ticketData.estadoId === "ticket_cerrado" ? { color: 'white' } : {}}>
                                                                {ticketData.estadoId === "ticket_cerrado" ? "Servicio Concluido y Liquidado" : "Liquidación Final de Servicio"}
                                                            </h3>
                                                            <p style={ticketData.estadoId === "ticket_cerrado" ? { color: 'rgba(255,255,255,0.8)' } : {}}>
                                                                {ticketData.estadoId === "ticket_cerrado" ? "Información financiera auditada y cerrada." : "Resumen detallado de costos y saldos pendientes."}
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <div className={styles.totalBannerBadge} style={ticketData.estadoId === "ticket_cerrado" ? { background: 'rgba(255,255,255,0.2)' } : { background: '#2563EB', color: 'white' }}>
                                                        S/ {(techPactedTotal - unifiedPaymentsSum).toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                                                    </div>
                                                </div>

                                                <div className={styles.financialDetailsBody}>
                                                    <div className={styles.summarySection}>
                                                        <div className={styles.mainFinancialRow}>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                                <span className={styles.rowLabel}>{["en_cotizacion", "cotizacion_enviada"].includes(ticketData.estadoId) ? "Presupuesto Proyectado" : "Monto Pactado Trabajo"}</span>
                                                                {ticketData.fechaCotización && (
                                                                    <span style={{ fontSize: '10px', color: '#64748B', marginLeft: '4px' }}>
                                                                        • {new Date(ticketData.fechaCotización).toLocaleDateString('es-PE')}
                                                                    </span>
                                                                )}
                                                                {availableRescue > 0 && ticketData.estadoId !== "ticket_cerrado" && (
                                                                    <button 
                                                                        onClick={handleOpenRescue}
                                                                        className={styles.rescueBtnMini}
                                                                        title="Solicitar Rescate Financiero (Adelanto de Mano de Obra)"
                                                                    >
                                                                        <Coins size={12} />
                                                                        <span>Rescate Financiero</span>
                                                                    </button>
                                                                )}
                                                                {availableRescue <= 0 && ticketData.estadoId !== "ticket_cerrado" && (
                                                                    <span style={{ fontSize: '9px', fontWeight: 800, color: '#94A3B8', padding: '2px 8px', background: '#F1F5F9', borderRadius: '6px', cursor: 'help' }} title="Se ha solicitado o pagado el 100% de la mano de obra pactada.">
                                                                        TOPE ALCANZADO
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <span className={styles.rowValue}>S/ {techPactedTotal.toLocaleString('es-PE', { minimumFractionDigits: 2 })}</span>
                                                        </div>

                                                        <div className={styles.mainFinancialRow} style={{ border: 'none', paddingBottom: '12px' }}>
                                                            <span className={styles.rowLabel} style={{ fontWeight: 800 }}>Total Pagado (Confirmado)</span>
                                                            <span className={styles.rowValue} style={{ color: '#059669', fontSize: '18px' }}>- S/ {unifiedPaymentsSum.toLocaleString('es-PE', { minimumFractionDigits: 2 })}</span>
                                                        </div>
                                                        
                                                        {/* ✅ NUEVO:Mostrar solicitudes pendientes separately */}
                                                        {totalRequested > 0 && (
                                                        <div className={styles.mainFinancialRow} style={{ border: 'none', paddingBottom: '8px' }}>
                                                            <span className={styles.rowLabel} style={{ fontWeight: 600, color: '#D97706' }}>Total Solicitado (Pendiente)</span>
                                                            <span className={styles.rowValue} style={{ color: '#D97706', fontSize: '16px' }}>S/ {totalRequested.toLocaleString('es-PE', { minimumFractionDigits: 2 })}</span>
                                                        </div>
                                                        )}

                                                        {(paymentsSummary > 0 || legacyPaymentsFiltered.length > 0 || visitPayment > 0 || classicAdvance > 0) && (
                                                            <div className={styles.depositsListPremium}>
                                                                {/* Pagos de la nueva tabla */}
                                                                {ticketCosts
                                                                    .filter(c => {
                                                                        const st = (c.estado_pago || '').toLowerCase();
                                                                        // Incluimos todos excepto los que el usuario decida ocultar (opcional), 
                                                                        // pero por ahora mostramos todo para transparencia.
                                                                        return true; 
                                                                    })
                                                                    .map((p: any, i: number) => {
                                                                        const st = (p.estado_pago || '').toLowerCase();
                                                                        const isRejected = st === 'rechazado' || st === 'anulado';
                                                                        const isPending = st === 'pendiente' || st === 'requiere_aprobacion' || st === 'requiere_aprobacion_admin';
                                                                        
                                                                        return (
                                                                         <div key={`new-${i}`} className={styles.depositEntry} style={{ 
                                                                             opacity: isPending ? 0.7 : (isRejected ? 0.5 : 1),
                                                                             textDecoration: isRejected ? 'line-through' : 'none',
                                                                             borderLeft: st === 'requiere_aprobacion_admin' ? '3px solid #6366f1' : 'none',
                                                                             background: st === 'requiere_aprobacion_admin' ? '#f5f3ff' : 'transparent',
                                                                             padding: st === 'requiere_aprobacion_admin' ? '8px' : '4px 0',
                                                                             borderRadius: '6px'
                                                                         }}>
                                                                             <div className={styles.depositLabel}>
                                                                                 <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                                                                     {isRejected ? <XCircle size={14} style={{ color: '#EF4444' }} /> : (isPending ? <Clock size={14} style={{ color: '#F59E0B' }} /> : <ArrowDownLeft size={14} style={{ color: '#10B981' }} />)}
                                                                                     <span style={{ fontWeight: 700 }}>
                                                                                        {p.categoria === 'Mano de Obra' ? 'PAGO M.O.' : p.categoria === 'Materiales' ? 'COMPRA MAT.' : p.categoria.toUpperCase()}
                                                                                     </span>
                                                                                     
                                                                                     {isRejected && <span style={{ fontSize: '9px', fontWeight: 800, color: '#EF4444', background: '#FEF2F2', padding: '1px 6px', borderRadius: '4px', textDecoration: 'none', display: 'inline-block' }}>DENIEGADO</span>}
                                                                                     {st === 'pendiente' && <span style={{ fontSize: '9px', fontWeight: 800, color: '#F59E0B', background: '#FFFBEB', padding: '1px 6px', borderRadius: '4px', textDecoration: 'none', display: 'inline-block' }}>TESORERÍA (PENDIENTE)</span>}
                                                                                     {st === 'requiere_aprobacion_admin' && (
                                                                                        <span style={{ fontSize: '9px', fontWeight: 900, color: '#6366f1', background: '#eef2ff', border: '1px solid #c7d2fe', padding: '1px 6px', borderRadius: '4px', textDecoration: 'none', display: 'inline-block' }}>
                                                                                            ESPERANDO APROBACIÓN ADMIN
                                                                                        </span>
                                                                                     )}
                                                                                 </div>
                                                                                 <span className={styles.depositMeta}>
                                                                                    {new Date(p.created_at || p.fecha || Date.now()).toLocaleDateString('es-PE')}
                                                                                    {p.motivo && <span style={{ display: 'block', fontStyle: 'italic', fontSize: '10px', color: '#64748b', marginTop: '2px' }}>"{p.motivo}"</span>}
                                                                                 </span>
                                                                             </div>
                                                                             
                                                                             <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                                                                                <span className={styles.depositAmount} style={{ color: isRejected ? '#94A3B8' : (isPending ? (st === 'requiere_aprobacion_admin' ? '#6366f1' : '#F59E0B') : '#059669') }}>
                                                                                    - S/ {(parseFloat(p.monto) || 0).toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                                                                                </span>
                                                                                
                                                                                {/* ACCIONES DE ADMINISTRADOR PARA RESCATE EXCEDENTE */}
                                                                                {isAdmin && st === 'requiere_aprobacion_admin' && (
                                                                                    <div style={{ display: 'flex', gap: '4px', marginTop: '4px' }}>
                                                                                        <button 
                                                                                            onClick={() => handleRejectRescueAdmin(p.id)}
                                                                                            style={{ background: '#fee2e2', color: '#b91c1c', border: 'none', padding: '2px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: 700, cursor: 'pointer' }}
                                                                                        >
                                                                                            DENEGAR
                                                                                        </button>
                                                                                        <button 
                                                                                            onClick={() => handleApproveRescueAdmin(p.id)}
                                                                                            style={{ background: '#dcfce7', color: '#15803d', border: 'none', padding: '2px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: 700, cursor: 'pointer' }}
                                                                                        >
                                                                                            APROBAR
                                                                                        </button>
                                                                                    </div>
                                                                                )}
                                                                             </div>
                                                                         </div>
                                                                        );
                                                                    })}

                                                                {/* Pago de Visita (Movilidad) */}
                                                                {visitPayment > 0 && (
                                                                    <div className={styles.depositEntry}>
                                                                        <div className={styles.depositLabel}>
                                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                                                <ArrowDownLeft size={14} style={{ color: '#F59E0B' }} />
                                                                                MOVILIDAD / VISITA (SISTEMA)
                                                                            </div>
                                                                            <span className={styles.depositMeta}>{ticketData.fechaPagoVisita ? new Date(ticketData.fechaPagoVisita).toLocaleDateString('es-PE') : 'Confirmado'}</span>
                                                                        </div>
                                                                        <span className={styles.depositAmount} style={{ color: '#F59E0B' }}>- S/ {visitPayment.toLocaleString('es-PE', { minimumFractionDigits: 2 })}</span>
                                                                    </div>
                                                                )}

                                                                {/* Adelanto Clásico */}
                                                                {classicAdvance > 0 && (
                                                                    <div className={styles.depositEntry}>
                                                                        <div className={styles.depositLabel}>
                                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                                                <ArrowDownLeft size={14} style={{ color: '#3B82F6' }} />
                                                                                ADELANTO INICIAL (SISTEMA)
                                                                            </div>
                                                                            <span className={styles.depositMeta}>{new Date(ticketData.fechaPagoAdelanto || ticketData.createdAt).toLocaleDateString('es-PE')}</span>
                                                                        </div>
                                                                        <span className={styles.depositAmount} style={{ color: '#3B82F6' }}>- S/ {classicAdvance.toLocaleString('es-PE', { minimumFractionDigits: 2 })}</span>
                                                                    </div>
                                                                )}

                                                                {/* Pagos históricos (Deduplicados arriba) */}
                                                                {legacyPaymentsFiltered.map((p: any, i: number) => (
                                                                    <div key={`old-${i}`} className={styles.depositEntry} style={{ opacity: 0.9 }}>
                                                                        <div className={styles.depositLabel}>
                                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                                                <ArrowDownLeft size={14} style={{ color: '#6366F1' }} />
                                                                                {p.tipo ? p.tipo.toUpperCase() : 'DEPOSITO REGISTRADO'}
                                                                            </div>
                                                                            <span className={styles.depositMeta}>{p.fecha ? new Date(p.fecha).toLocaleDateString('es-PE') : '--'}</span>
                                                                        </div>
                                                                        <span className={styles.depositAmount} style={{ color: '#4F46E5' }}>- S/ {(parseFloat(p.monto) || 0).toLocaleString('es-PE', { minimumFractionDigits: 2 })}</span>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>

                                                    <div className={styles.bankDetailsPanel}>
                                                        <h4>Transferencia a Destino</h4>
                                                        
                                                        <div className={styles.bankFieldClean}>
                                                            <strong>BENEFICIARIO</strong>
                                                            <span>{ticketData.tecnico?.nombre} {ticketData.tecnico?.apellido}</span>
                                                        </div>

                                                        <div className={styles.bankFieldClean}>
                                                            <strong>{ticketData.tecnico?.banco || 'BANCO'}</strong>
                                                            <span style={{ fontFamily: 'Monospace', letterSpacing: '1px' }}>{ticketData.tecnico?.numeroCuenta || '---'}</span>
                                                        </div>

                                                        {ticketData.tecnico?.cci && (
                                                            <div className={styles.bankFieldClean}>
                                                                <strong>CCI (INTERBANCARIO)</strong>
                                                                <span style={{ fontFamily: 'Monospace', letterSpacing: '1px' }}>{ticketData.tecnico.cci}</span>
                                                            </div>
                                                        )}

                                                        {(ticketData.tecnico?.yape || ticketData.tecnico?.plin) && (
                                                            <div className={styles.walletsRowPremium}>
                                                                {ticketData.tecnico?.yape && (
                                                                    <div className={styles.walletBadgePremium} style={{ background: '#7C3AED' }}>
                                                                        <span>YAPE: {ticketData.tecnico.yape}</span>
                                                                    </div>
                                                                )}
                                                                {ticketData.tecnico?.plin && (
                                                                    <div className={styles.walletBadgePremium} style={{ background: '#00D1FF' }}>
                                                                        <span>PLIN: {ticketData.tecnico.plin}</span>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>

                                                    {(unifiedPaymentsSum > techPactedTotal + 0.01) && (
                                                        <div className={styles.warningBannerPremium}>
                                                            <AlertTriangle size={20} />
                                                            <span>ATENCIÓN: Se han detectado excedentes en los depósitos previos.</span>
                                                        </div>
                                                    )}

                                                    <div className={styles.finalBalanceBanner} style={ticketData.estadoId === "ticket_cerrado" ? { background: '#064E3B' } : {}}>
                                                        <span className={styles.finalBalanceLabel}>
                                                            {ticketData.estadoId === "ticket_cerrado" ? "Monto Total Liquidado" : "Saldo Final a Pagar"}
                                                        </span>
                                                        <span className={styles.finalBalanceValue}>
                                                            S/ {(ticketData.estadoId === "ticket_cerrado" 
                                                                ? unifiedPaymentsSum 
                                                                : Math.max(0, techPactedTotal - unifiedPaymentsSum)
                                                            ).toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                                                        </span>
                                                    </div>

                                                    <div className={styles.profitabilityPanel} style={{ 
                                                        marginTop: '20px', 
                                                        padding: '16px', 
                                                        borderRadius: '16px', 
                                                        background: ["en_cotizacion", "cotizacion_enviada"].includes(ticketData.estadoId)
                                                            ? 'linear-gradient(135deg, #3B82F6, #1D4ED8)' 
                                                            : grossMargin > 0 ? 'linear-gradient(135deg, #059669, #047857)' : 'linear-gradient(135deg, #DC2626, #991B1B)',
                                                        color: 'white',
                                                        boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)'
                                                    }}>
                                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                                            <span style={{ fontSize: '0.75rem', fontWeight: 600, opacity: 0.9, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                                                {["en_cotizacion", "cotizacion_enviada"].includes(ticketData.estadoId)
                                                                    ? "Rentabilidad Proyectada"
                                                                    : "Rentabilidad Real"
                                                                }
                                                            </span>
                                                            <span style={{ fontSize: '0.75rem', fontWeight: 800, padding: '2px 8px', background: 'rgba(255,255,255,0.2)', borderRadius: '6px' }}>
                                                                {costPercentage.toFixed(1)}% Costo
                                                            </span>
                                                        </div>
                                                        <div style={{ fontSize: '1.6rem', fontWeight: 900, display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                                                            <span style={{ fontSize: '1rem', opacity: 0.8 }}>S/</span>
                                                            {grossMargin.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                                                        </div>
                                                        <p style={{ fontSize: '0.7rem', marginTop: '6px', opacity: 0.8, lineHeight: 1.3 }}>
                                                            Margen bruto tras descontar mano de obra pactada, materiales y rescates financieros.
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>

                                            {ticketData.estadoId === "por_liquidar" && (
                                                <div className={styles.waitingForManager} style={{ padding: '30px', background: '#F8FAFC', borderRadius: '20px', border: '1px solid #E2E8F0', marginTop: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                                                    <Clock size={28} color="#3B82F6" />
                                                    <span style={{ fontSize: '1.2rem', color: '#1E293B', fontWeight: 800 }}>LIQUIDACIÓN EN PROCESO</span>
                                                    <span style={{ fontSize: '0.9rem', color: '#64748B', fontWeight: 500, maxWidth: '400px', textAlign: 'center' }}>
                                                        Registre el depósito final en el panel de <strong>Tesorería</strong> inferior para cerrar este ticket definitivamente.
                                                    </span>
                                                    {isAdmin && (techPactedTotal - unifiedPaymentsSum) <= 0.01 && (
                                                        <button 
                                                            onClick={handleCompleteClosure}
                                                            className={styles.approveExceedBtn}
                                                            style={{
                                                                marginTop: '15px',
                                                                background: '#10B981',
                                                                color: 'white',
                                                                border: 'none',
                                                                padding: '12px 24px',
                                                                borderRadius: '10px',
                                                                fontWeight: 700,
                                                                cursor: 'pointer',
                                                                boxShadow: '0 4px 6px -1px rgba(16, 185, 129, 0.2)'
                                                            }}
                                                        >
                                                            CONFIRMAR CIERRE DEFINITIVO (SALDO 0)
                                                        </button>
                                                    )}
                                                </div>
                                            )}

                                            {ticketData.estadoId === "ticket_cerrado" && (
                                                <div className={styles.closedFooterActions} style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '15px' }}>
                                                    <div className={styles.closedStatusBanner} style={{ padding: '12px 24px', background: '#DCFCE7', color: '#166534', borderRadius: '12px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                        <CheckCircle size={20} />
                                                        TICKET CERRADO Y ARCHIVADO
                                                    </div>
                                                    <button
                                                        onClick={onClose}
                                                        style={{ background: '#F1F5F9', color: '#475569', border: 'none', padding: '12px 24px', borderRadius: '10px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
                                                    >
                                                        VOLVER AL DASHBOARD
                                                        <ArrowRight size={18} />
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {["ticket_cancelado", "ticket_rechazado"].includes(ticketData.estadoId || "") && (
                                        <div className={styles.cancelledViewPremium} style={{ 
                                            padding: '40px', 
                                            background: '#FFF1F2', 
                                            borderRadius: '24px', 
                                            border: '2px dashed #FDA4AF',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            alignItems: 'center',
                                            textAlign: 'center',
                                            gap: '20px'
                                        }}>
                                            <div style={{ background: '#BE123C', color: 'white', padding: '16px', borderRadius: '50%', boxShadow: '0 10px 15px -3px rgba(190, 18, 60, 0.2)' }}>
                                                <X size={40} />
                                            </div>
                                            <div>
                                                <h3 style={{ color: '#881337', fontSize: '24px', fontWeight: 900, marginBottom: '8px' }}>
                                                    SERVICIO {ticketData.estadoId === "ticket_cancelado" ? "ANULADO" : "RECHAZADO"}
                                                </h3>
                                                <p style={{ color: '#9F1239', fontWeight: 500, maxWidth: '500px' }}>
                                                    Este ticket ha sido finalizado sin ejecución de trabajo. 
                                                    Si el técnico realizó un triaje o visita presencial, debe registrar el pago de movilidad aquí.
                                                </p>
                                            </div>

                                            <div style={{ display: 'flex', gap: '16px', marginTop: '10px' }}>
                                                <button 
                                                    onClick={() => handleOpenExpenseModal('Viáticos / Movilidad', `Pago por Movilidad / Triaje (Ticket ${ticketData.estadoId === "ticket_cancelado" ? "Anulado" : "Rechazado"})`)}
                                                    style={{
                                                        background: '#BE123C',
                                                        color: 'white',
                                                        border: 'none',
                                                        padding: '12px 24px',
                                                        borderRadius: '12px',
                                                        fontWeight: 700,
                                                        cursor: 'pointer',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: '8px',
                                                        boxShadow: '0 4px 6px -1px rgba(190, 18, 60, 0.2)'
                                                    }}
                                                >
                                                    <Truck size={18} />
                                                    PAGAR MOVILIDAD / TRIAJE
                                                </button>
                                                
                                                <button 
                                                    onClick={onClose}
                                                    style={{
                                                        background: 'white',
                                                        color: '#475569',
                                                        border: '1.5px solid #E2E8F0',
                                                        padding: '12px 24px',
                                                        borderRadius: '12px',
                                                        fontWeight: 600,
                                                        cursor: 'pointer'
                                                    }}
                                                >
                                                    CERRAR VENTANA
                                                </button>
                                            </div>

                                            {ticketData.metadata?.motivoCancelacion && (
                                                <div style={{ marginTop: '10px', padding: '12px', background: 'rgba(255,255,255,0.5)', borderRadius: '12px', fontSize: '0.85rem', color: '#881337', maxWidth: '400px' }}>
                                                    <strong>Motivo:</strong> {ticketData.metadata.motivoCancelacion}
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {!["nuevo", "en_inspeccion", "esperando_pago_visita", "visita_realizada", "en_cotizacion", "cotizacion_enviada", "cotizacion_aprobada", "en_ejecucion", "documentacion_enviada", "por_liquidar", "ticket_cerrado", "ticket_cancelado", "ticket_rechazado"].includes(ticketData.estadoId || "") && (
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
                                    <span>Re-negociación con el técnico asignado</span>
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
                                        * Este ajuste quedará registrado como costo de ejecución final para el técnico.
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

                {/* Modal: Solicitud de Pago de Materiales */}
                {showMaterialsModal && (
                    <div className={styles.modalOverlay}>
                        <div className={styles.negotiationModalCard} style={{ maxWidth: '450px' }}>
                            <div className={styles.negotiationModalHeader}>
                                <div className={styles.negoIconWrapper} style={{ backgroundColor: '#EEF2FF', color: '#6366F1' }}>
                                    <Package size={24} />
                                </div>
                                <div className={styles.negoTitleGroup}>
                                    <h3>Solicitud de Pago / Gasto</h3>
                                    <span>Registro de egreso para técnico externo</span>
                                </div>
                                <button className={styles.closeNegoBtn} onClick={() => setShowMaterialsModal(false)}>
                                    <X size={20} />
                                </button>
                            </div>

                            <div className={styles.negotiationModalContent}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                    {/* Categoría */}
                                    <div className={styles.negoInputWrapper}>
                                        <label>Categoría del Gasto</label>
                                        <select 
                                            value={materialsForm.categoria}
                                            onChange={e => setMaterialsForm(prev => ({ ...prev, categoria: e.target.value }))}
                                            className={styles.formSelect}
                                            style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1.5px solid #E2E8F0', outline: 'none', background: 'white', color: '#1E293B', fontWeight: 600 }}
                                        >
                                            <option value="Materiales">📦 Materiales / Insumos</option>
                                            <option value="Mano de Obra">🔧 Mano de Obra (Técnico Externo)</option>
                                            <option value="Viáticos / Movilidad">🚗 Viáticos / Movilidad</option>
                                            <option value="Logística">📬 Logística / Envíos</option>
                                            <option value="Adelanto">💰 Adelanto Operativo</option>
                                            <option value="Otros">📌 Otros Egresos</option>
                                        </select>
                                    </div>

                                    {/* Concepto */}
                                    <div className={styles.negoInputWrapper}>
                                        <label>Concepto / Referencia</label>
                                        <input
                                            type="text"
                                            placeholder="Ej. Compra de pintura y brochas..."
                                            value={materialsForm.concepto}
                                            onChange={e => setMaterialsForm(prev => ({ ...prev, concepto: e.target.value }))}
                                            style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1.5px solid #E2E8F0', outline: 'none', background: 'white', color: '#1E293B', fontWeight: 500 }}
                                        />
                                    </div>

                                    {/* Monto */}
                                    <div className={styles.negoInputWrapper}>
                                        <label>Monto a Depositar</label>
                                        <div className={styles.negoInputGroup}>
                                            <div className={styles.negoInputPrefix}>S/</div>
                                            <input
                                                type="number"
                                                placeholder="0.00"
                                                value={materialsForm.monto}
                                                onChange={e => setMaterialsForm(prev => ({ ...prev, monto: e.target.value }))}
                                                style={{ width: '100%', padding: '10px 14px 10px 30px', borderRadius: '10px', border: '1.5px solid #E2E8F0', outline: 'none', color: '#1E293B', fontWeight: 700 }}
                                            />
                                        </div>
                                    </div>

                                    {/* Buscador de Técnico */}
                                    <div className={styles.negoInputWrapper}>
                                        <label>Seleccionar Técnico (Base de Datos)</label>
                                        <div style={{ position: 'relative' }}>
                                            <input
                                                type="text"
                                                placeholder="Buscar por nombre..."
                                                value={materialsForm.searchQuery}
                                                onChange={e => {
                                                    const q = e.target.value;
                                                    setMaterialsForm(prev => ({ ...prev, searchQuery: q, specialist_id: '', specialistName: '', showDropdown: true }));
                                                }}
                                                onFocus={() => setMaterialsForm(prev => ({ ...prev, showDropdown: true }))}
                                                style={{ 
                                                    width: '100%', 
                                                    padding: '10px 14px', 
                                                    borderRadius: '10px', 
                                                    border: materialsForm.specialist_id ? '2px solid #6366F1' : '1.5px solid #E2E8F0', 
                                                    outline: 'none',
                                                    background: materialsForm.specialist_id ? '#F5F7FF' : 'white',
                                                    color: '#1E293B',
                                                    fontWeight: 600
                                                }}
                                            />
                                            {materialsForm.showDropdown && materialsForm.searchQuery && (
                                                <div style={{ 
                                                    position: 'absolute', 
                                                    top: '100%', 
                                                    left: 0, 
                                                    right: 0, 
                                                    background: 'white', 
                                                    border: '1px solid #E2E8F0', 
                                                    borderRadius: '10px', 
                                                    boxShadow: '0 10px 25px rgba(0,0,0,0.1)', 
                                                    zIndex: 100, 
                                                    maxHeight: '200px', 
                                                    overflowY: 'auto',
                                                    marginTop: '5px'
                                                }}>
                                                    {allTechnicians
                                                        .filter(t => {
                                                            const n = (t.name || `${t.first_name || ''} ${t.last_name || ''}`).toLowerCase();
                                                            return n.includes(materialsForm.searchQuery.toLowerCase());
                                                        })
                                                        .map(t => {
                                                            const tname = t.name || `${t.first_name || ''} ${t.last_name || ''}`.trim();
                                                            return (
                                                                <div 
                                                                    key={t.id}
                                                                    onClick={() => {
                                                                        setMaterialsForm(prev => ({ 
                                                                            ...prev, 
                                                                            specialist_id: t.id, 
                                                                            specialistName: tname, 
                                                                            searchQuery: tname,
                                                                            showDropdown: false 
                                                                        }));
                                                                    }}
                                                                    style={{ padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid #F1F5F9', display: 'flex', alignItems: 'center', gap: '8px' }}
                                                                >
                                                                    <User size={14} color="#6366F1" />
                                                                    <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#1E293B' }}>{tname}</span>
                                                                </div>
                                                            );
                                                        })}
                                                </div>
                                            )}
                                        </div>
                                        {materialsForm.specialist_id && (
                                            <p style={{ margin: '6px 0 0 0', fontSize: '0.75rem', color: '#059669', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                <CheckCircle size={12} /> Técnico vinculado correctamente
                                            </p>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className={styles.negotiationModalActions}>
                                <button className={styles.negoCancelBtn} onClick={() => setShowMaterialsModal(false)}>
                                    Cancelar
                                </button>
                                <button 
                                    className={styles.negoConfirmBtn} 
                                    onClick={handleSubmitMaterialsRequest}
                                    disabled={isSavingMaterials}
                                    style={{ background: 'linear-gradient(135deg, #6366F1, #4F46E5)' }}
                                >
                                    {isSavingMaterials ? <Clock size={18} className={styles.spinner} /> : <Send size={18} />}
                                    <span>Enviar a Tesorería</span>
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Modal de Rescate Financiero */}
                {showRescueModal && (
                    <div className={styles.modalOverlay}>
                        <div className={styles.negotiationModalCard} style={{ maxWidth: '450px' }}>
                            <div className={styles.negotiationModalHeader} style={{ background: 'linear-gradient(135deg, #F59E0B, #D97706)' }}>
                                <div className={styles.negoIconWrapper} style={{ backgroundColor: 'white', color: '#F59E0B' }}>
                                    <Coins size={24} />
                                </div>
                                <div className={styles.negoTitleGroup}>
                                    <h3 style={{ color: 'white' }}>Rescate Financiero</h3>
                                    <span style={{ color: 'rgba(255,255,255,0.9)' }}>Adelanto adicional sobre saldo del técnico</span>
                                </div>
                                <button className={styles.closeNegoBtn} onClick={() => setShowRescueModal(false)} style={{ color: 'white' }}>
                                    <X size={20} />
                                </button>
                            </div>

                            <div className={styles.negotiationModalContent}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                                    
                                    {/* Indicador de Saldo */}
                                    <div style={{ background: '#FFFBEB', border: '1px solid #FEF3C7', borderRadius: '12px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: '#92400E' }}>
                                            <span>Monto Pactado MO:</span>
                                            <span style={{ fontWeight: 700 }}>S/ {totalPactadoTecnico.toFixed(2)}</span>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: '#92400E' }}>
                                            <span>Adelantos/Rescates Previos:</span>
                                            <span style={{ fontWeight: 700 }}>- S/ {totalAdelantadoAlTecnico.toFixed(2)}</span>
                                        </div>
                                        <div style={{ height: '1px', background: '#FEF3C7', margin: '4px 0' }} />
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', color: '#F59E0B', fontWeight: 900 }}>
                                            <span>SALDO DISPONIBLE:</span>
                                            <span>S/ {availableRescue.toFixed(2)}</span>
                                        </div>
                                    </div>

                                    <div className={styles.negoInputWrapper}>
                                        <label>Monto a Solicitar</label>
                                        <div className={styles.negoInputGroup}>
                                            <div className={styles.negoInputPrefix}>S/</div>
                                            <input
                                                type="number"
                                                placeholder="0.00"
                                                max={availableRescue}
                                                value={rescueForm.monto}
                                                onChange={e => setRescueForm(prev => ({ ...prev, monto: e.target.value }))}
                                                style={{ border: 'none', background: 'transparent' }}
                                            />
                                        </div>
                                        {parseFloat(rescueForm.monto) > availableRescue && (
                                            <div style={{ 
                                                background: '#FEF2F2', border: '1px solid #FEE2E2', borderRadius: '8px', 
                                                padding: '10px', marginTop: '10px'
                                            }}>
                                                <p style={{ fontSize: '0.75rem', color: '#EF4444', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '6px', margin: 0 }}>
                                                    <AlertTriangle size={14} /> EXCESO DE PRESUPUESTO DETECTADO
                                                </p>
                                                <p style={{ fontSize: '0.7rem', color: '#B91C1C', marginTop: '4px', lineHeight: 1.4 }}>
                                                    Atención: Este monto supera el saldo pactado. Requerirá autorización del Administrador y <strong>afectará la rentabilidad neta</strong> del ticket.
                                                </p>
                                            </div>
                                        )}
                                    </div>

                                    <div className={styles.negoInputWrapper}>
                                        <label>Motivo del Rescate {parseFloat(rescueForm.monto) > availableRescue ? <span style={{color: '#EF4444'}}>(OBLIGATORIO)</span> : '(Opcional)'}</label>
                                        <textarea
                                            placeholder={parseFloat(rescueForm.monto) > availableRescue 
                                                ? "Justifique detalladamente por qué se requiere este excedente..." 
                                                : "Indique por qué se solicita este adelanto extra..."
                                            }
                                            value={rescueForm.motivo}
                                            onChange={e => setRescueForm(prev => ({ ...prev, motivo: e.target.value }))}
                                            required={parseFloat(rescueForm.monto) > availableRescue}
                                            style={{ 
                                                width: '100%', padding: '10px 14px', borderRadius: '10px', 
                                                border: parseFloat(rescueForm.monto) > availableRescue && !rescueForm.motivo.trim() ? '1.5px solid #EF4444' : '1.5px solid #E2E8F0', 
                                                outline: 'none', background: 'white', color: '#1E293B', fontWeight: 500, minHeight: '80px', resize: 'vertical'
                                            }}
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className={styles.negotiationModalActions}>
                                <button className={styles.negoCancelBtn} onClick={() => setShowRescueModal(false)}>
                                    Cancelar
                                </button>
                                <button 
                                    className={styles.negoConfirmBtn} 
                                    onClick={handleSubmitRescueRequest}
                                    disabled={isSavingRescue || !rescueForm.monto || parseFloat(rescueForm.monto) <= 0 || (parseFloat(rescueForm.monto) > availableRescue && !rescueForm.motivo.trim())}
                                    style={{ 
                                        background: parseFloat(rescueForm.monto) > availableRescue 
                                            ? 'linear-gradient(135deg, #EF4444, #B91C1C)' 
                                            : 'linear-gradient(135deg, #F59E0B, #D97706)' 
                                    }}
                                >
                                    {isSavingRescue ? <Clock size={18} className={styles.spinner} /> : (parseFloat(rescueForm.monto) > availableRescue ? <ShieldAlert size={18} /> : <Coins size={18} />)}
                                    <span>{parseFloat(rescueForm.monto) > availableRescue ? "Solicitar Aprobación por Excedente" : "Solicitar Adelanto Extra"}</span>
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* --- MODAL: ACTUALIZACIÓN DE REPORTE TÉCNICO --- */}
                {showReportUpdateModal && (
                    <div className={styles.negotiationModal}>
                        <div className={styles.negotiationModalCard} style={{ maxWidth: '500px' }}>
                            <div className={styles.negotiationModalHeader} style={{ background: 'linear-gradient(135deg, #0D9488, #0F766E)' }}>
                                <div className={styles.negoHeaderTitle}>
                                    <Stethoscope size={24} color="#FFF" />
                                    <div>
                                        <h3 style={{ color: '#FFF' }}>Actualizar Reporte Técnico</h3>
                                        <p style={{ color: 'rgba(255,255,255,0.7)' }}>Ajuste de diagnósticos y pre-presupuesto</p>
                                    </div>
                                </div>
                                <button className={styles.negoCloseBtn} onClick={() => setShowReportUpdateModal(false)}>
                                    <X size={20} />
                                </button>
                            </div>

                            <div className={styles.negotiationModalContent}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                                    <div className={styles.transferSearchContainer}>
                                        <label style={{ fontSize: '12px', fontWeight: 800, color: '#334155' }}>DIAGNÓSTICO EN CAMPO / HALLAZGOS:</label>
                                        <textarea 
                                            className={styles.transferInput}
                                            style={{ minHeight: '120px', resize: 'vertical' }}
                                            value={reportForm.diagnostico}
                                            onChange={(e) => setReportForm({ ...reportForm, diagnostico: e.target.value })}
                                            placeholder="Detalle técnico de lo encontrado en sede..."
                                        />
                                    </div>

                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                                        <div className={styles.transferSearchContainer}>
                                            <label style={{ fontSize: '12px', fontWeight: 800, color: '#334155' }}>🛠️ MANO DE OBRA (S/):</label>
                                            <input 
                                                type="number"
                                                className={styles.transferInput}
                                                value={reportForm.costoManoObra}
                                                onChange={(e) => setReportForm({ ...reportForm, costoManoObra: e.target.value })}
                                            />
                                        </div>
                                        <div className={styles.transferSearchContainer}>
                                            <label style={{ fontSize: '12px', fontWeight: 800, color: '#334155' }}>📦 MATERIALES (S/):</label>
                                            <input 
                                                type="number"
                                                className={styles.transferInput}
                                                value={reportForm.costoMateriales}
                                                onChange={(e) => setReportForm({ ...reportForm, costoMateriales: e.target.value })}
                                            />
                                        </div>
                                    </div>

                                    <div className={styles.blockerNotice} style={{ background: '#F0FDFA', borderColor: '#CCFBF1' }}>
                                        <Sparkles className={styles.blockerIcon} size={20} color="#0D9488" />
                                        <div className={styles.blockerText}>
                                            <h4 style={{ color: '#0F766E' }}>Efecto Sincronizado</h4>
                                            <p style={{ color: '#115E59' }}>Guardar estos cambios recalculará automáticamente la rentabilidad real y el saldo pendiente del ticket.</p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className={styles.negotiationModalActions}>
                                <button className={styles.negoCancelBtn} onClick={() => setShowReportUpdateModal(false)}>
                                    Cancelar
                                </button>
                                <button 
                                    className={styles.negoConfirmBtn} 
                                    onClick={handleSaveReportUpdate}
                                    disabled={isSavingReport}
                                    style={{ background: 'linear-gradient(135deg, #0D9488, #0D9488)' }}
                                >
                                    {isSavingReport ? <Clock size={18} className={styles.spinner} /> : <CheckCircle2 size={18} />}
                                    <span>Guardar y Recalcular</span>
                                </button>
                            </div>
                        </div>
                    </div>
                )}
                {showDeleteModal && (
                    <div className={styles.negotiationModal}>
                        <div className={styles.negotiationModalCard} style={{ maxWidth: '450px' }}>
                            <div className={styles.negotiationModalHeader}>
                                <div className={styles.negoHeaderTitle}>
                                    <Trash2 size={24} color="#ef4444" />
                                    <div>
                                        <h3>Eliminación Definitiva</h3>
                                        <p>Acción crítica de administrador</p>
                                    </div>
                                </div>
                                <button className={styles.negoCloseBtn} onClick={() => setShowDeleteModal(false)}>
                                    <X size={20} />
                                </button>
                            </div>

                            <div className={styles.negotiationModalContent}>
                                <p style={{ fontSize: '14px', color: '#475569', lineHeight: 1.6, margin: 0 }}>
                                    Usted está por eliminar el ticket <strong>{ticketData.numeroTicketCliente || ticketData.id}</strong>. 
                                    Esta acción es <strong>IRREVERSIBLE</strong> y borrará:
                                </p>
                                <ul style={{ fontSize: '13px', color: '#64748b', marginTop: '10px', paddingLeft: '20px' }}>
                                    <li>Evidencias fotográficas y documentos.</li>
                                    <li>Historial de chat y registros de auditoría.</li>
                                    <li>Datos generales del servicio.</li>
                                </ul>
                                <div style={{ background: '#fef2f2', border: '1px solid #fee2e2', padding: '12px', borderRadius: '12px', marginTop: '15px' }}>
                                    <p style={{ color: '#dc2626', fontSize: '12px', fontWeight: 700, margin: 0 }}>
                                        ⚠️ EL SISTEMA SOLO PERMITIRÁ ELIMINAR SI EL TICKET NO TIENE GASTOS REGISTRADOS.
                                    </p>
                                </div>
                            </div>

                            <div className={styles.negotiationModalActions}>
                                <button className={styles.negoCancelBtn} onClick={() => setShowDeleteModal(false)}>
                                    Cancelar
                                </button>
                                <button 
                                    className={styles.negoConfirmBtn} 
                                    onClick={checkAndHardDelete}
                                    disabled={isDeleting}
                                    style={{ background: 'linear-gradient(135deg, #ef4444, #b91c1c)' }}
                                >
                                    {isDeleting ? <Clock size={18} className={styles.spinner} /> : <Trash2 size={18} />}
                                    <span>Proceder con Eliminación</span>
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* --- MODAL: TRASLADO DE GASTOS (Fallo de Deletión por Gastos) --- */}
                {showTransferModal && (
                    <div className={styles.negotiationModal}>
                        <div className={styles.negotiationModalCard} style={{ maxWidth: '550px' }}>
                            <div className={styles.negotiationModalHeader}>
                                <div className={styles.negoHeaderTitle}>
                                    <Split size={24} color="#f59e0b" />
                                    <div>
                                        <h3>Transferencia de Gastos</h3>
                                        <p>Blindaje Financiero Activo</p>
                                    </div>
                                </div>
                                <button className={styles.negoCloseBtn} onClick={() => setShowTransferModal(false)}>
                                    <X size={20} />
                                </button>
                            </div>

                            <div className={styles.negotiationModalContent}>
                                <div className={styles.blockerNotice}>
                                    <AlertTriangle className={styles.blockerIcon} size={24} />
                                    <div className={styles.blockerText}>
                                        <h4>Ticket con Carga Financiera</h4>
                                        <p>No se puede eliminar un ticket que tiene gastos o adelantos pagados. Debe trasladar estos registros a un ticket activo para no perder la trazabilidad de Tesorería.</p>
                                    </div>
                                </div>

                                <div className={styles.transferSearchContainer}>
                                    <label style={{ fontSize: '12px', fontWeight: 800, color: '#334155' }}>BUSCAR TICKET DE DESTINO:</label>
                                    <input 
                                        type="text"
                                        className={styles.transferInput}
                                        placeholder="Ej: MB004016.26 o descripción..."
                                        value={targetTicketSearch}
                                        onChange={(e) => handleSearchTargetTicket(e.target.value)}
                                    />

                                    <div className={styles.transferResultsList}>
                                        {searchResults.map(res => (
                                            <div 
                                                key={res.id}
                                                className={`${styles.transferResultItem} ${selectedTargetTicket?.id === res.id ? styles.transferResultSelected : ''}`}
                                                onClick={() => setSelectedTargetTicket(res)}
                                            >
                                                <span className={styles.transferResultMain}>{res.client_ticket_number || res.id}</span>
                                                <span className={styles.transferResultSub}>{res.clients?.name} - {res.description?.substring(0, 50)}...</span>
                                            </div>
                                        ))}
                                        {targetTicketSearch.length >= 3 && searchResults.length === 0 && (
                                            <p style={{ fontSize: '12px', color: '#94a3b8', textAlign: 'center', marginTop: '10px' }}>No se encontraron tickets activos que coincidan.</p>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className={styles.negotiationModalActions}>
                                <button className={styles.negoCancelBtn} onClick={() => setShowTransferModal(false)}>
                                    Cancelar
                                </button>
                                <button 
                                    className={styles.negoConfirmBtn} 
                                    onClick={executeTransferAndClear}
                                    disabled={isTransferring || !selectedTargetTicket}
                                    style={{ background: 'linear-gradient(135deg, #3b82f6, #2563eb)' }}
                                >
                                    {isTransferring ? <Clock size={18} className={styles.spinner} /> : <ArrowRight size={18} />}
                                    <span>Trasladar y Reintentar Borrado</span>
                                </button>
                            </div>
                        </div>
                    </div>
                )}
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

                {/* --- MODAL DE CONFIRMACIÓN: PASAR A LIQUIDACIÓN --- */}
                {showLiquidationConfirm && (
                    <div className={styles.negotiationModal}>
                        <div className={styles.negotiationModalCard} style={{ maxWidth: '450px' }}>
                            <div className={styles.negotiationModalHeader} style={{ background: 'linear-gradient(135deg, #6366F1, #4F46E5)' }}>
                                <div className={styles.negoHeaderTitle}>
                                    <ClipboardCheck size={24} color="#FFF" />
                                    <div>
                                        <h3 style={{ color: '#FFF' }}>Confirmar Envío a Liquidación</h3>
                                        <p style={{ color: 'rgba(255,255,255,0.7)' }}>Pase de estado final y manual</p>
                                    </div>
                                </div>
                                <button className={styles.negoCloseBtn} onClick={() => setShowLiquidationConfirm(false)}>
                                    <X size={20} />
                                </button>
                            </div>

                            <div className={styles.negotiationModalContent}>
                                <p style={{ fontSize: '14px', color: '#475569', lineHeight: 1.6, margin: 0 }}>
                                    Usted está por enviar el ticket <strong>{ticketData.numeroTicketCliente}</strong> a Tesorería para su liquidación financiera.
                                </p>
                                <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', padding: '15px', borderRadius: '12px', marginTop: '15px' }}>
                                    <p style={{ fontSize: '12px', color: '#64748B', fontWeight: 600, margin: 0 }}>
                                        Esta acción:
                                    </p>
                                    <ul style={{ fontSize: '12px', color: '#64748B', marginTop: '8px', paddingLeft: '20px' }}>
                                        <li>Notificará a Tesorería sobre el cierre de trabajos.</li>
                                        <li>Bloqueará cambios adicionales en la cotización.</li>
                                        <li><strong>Establecerá la fecha de cierre financiero hoy.</strong></li>
                                    </ul>
                                </div>
                            </div>

                            <div className={styles.negotiationModalActions}>
                                <button className={styles.negoCancelBtn} onClick={() => setShowLiquidationConfirm(false)}>
                                    Cancelar
                                </button>
                                <button 
                                    className={styles.negoConfirmBtn} 
                                    onClick={handleActualLiquidation}
                                    disabled={isSavingNegotiation}
                                    style={{ background: 'linear-gradient(135deg, #6366F1, #4F46E5)' }}
                                >
                                    {isSavingNegotiation ? <Clock size={18} className={styles.spinner} /> : <CheckCircle2 size={18} />}
                                    <span>SÍ, PASAR A LIQUIDACIÓN</span>
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* --- MODAL DE CONFIRMACIÓN: APROBAR EXCEPCIÓN --- */}
                {showExceedApprovalConfirm && (
                    <div className={styles.negotiationModal}>
                        <div className={styles.negotiationModalCard} style={{ maxWidth: '450px' }}>
                            <div className={styles.negotiationModalHeader} style={{ background: 'linear-gradient(135deg, #EF4444, #B91C1C)' }}>
                                <div className={styles.negoHeaderTitle}>
                                    <ShieldAlert size={24} color="#FFF" />
                                    <div>
                                        <h3 style={{ color: '#FFF' }}>Aprobar Exceso de Presupuesto</h3>
                                        <p style={{ color: 'rgba(255,255,255,0.7)' }}>Acción de Alta Autoridad</p>
                                    </div>
                                </div>
                                <button className={styles.negoCloseBtn} onClick={() => setShowExceedApprovalConfirm(false)}>
                                    <X size={20} />
                                </button>
                            </div>

                            <div className={styles.negotiationModalContent}>
                                <div className={styles.blockerNotice} style={{ background: '#FEF2F2', borderColor: '#FEE2E2' }}>
                                    <AlertTriangle className={styles.blockerIcon} size={24} color="#EF4444" />
                                    <div className={styles.blockerText}>
                                        <h4 style={{ color: '#991B1B' }}>Confirmación de Excepción</h4>
                                        <p style={{ color: '#B91C1C' }}>Al aprobar, usted autoriza el pago de un monto superior al pactado originalmente con el cliente. Esta acción quedará registrada bajo su perfil.</p>
                                    </div>
                                </div>
                            </div>

                            <div className={styles.negotiationModalActions}>
                                <button className={styles.negoCancelBtn} onClick={() => setShowExceedApprovalConfirm(false)}>
                                    Cancelar
                                </button>
                                <button 
                                    className={styles.negoConfirmBtn} 
                                    onClick={handleActualExceedApproval}
                                    disabled={isSavingNegotiation}
                                    style={{ background: 'linear-gradient(135deg, #EF4444, #B91C1C)' }}
                                >
                                    {isSavingNegotiation ? <Clock size={18} className={styles.spinner} /> : <ThumbsUp size={18} />}
                                    <span>AUTORIZAR Y LIBERAR PAGO</span>
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* --- MODAL DE ANULACIÓN / CANCELACIÓN --- */}
                {showCancelModal && (
                    <div className={styles.negotiationModal}>
                        <div className={styles.negotiationModalCard} style={{ maxWidth: '450px' }}>
                            <div className={styles.negotiationModalHeader} style={{ background: 'linear-gradient(135deg, #DC2626, #991B1B)' }}>
                                <div className={styles.negoHeaderTitle}>
                                    <XCircle size={24} color="#FFF" />
                                    <div>
                                        <h3 style={{ color: '#FFF' }}>Anulación de Servicio</h3>
                                        <p style={{ color: 'rgba(255,255,255,0.7)' }}>El cliente rechaza el presupuesto</p>
                                    </div>
                                </div>
                                <button className={styles.negoCloseBtn} onClick={() => setShowCancelModal(false)}>
                                    <X size={20} />
                                </button>
                            </div>

                            <div className={styles.negotiationModalContent}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                    <div className={styles.negoInputWrapper}>
                                        <label>Costo de Movilidad / Triaje (A pagar al técnico)</label>
                                        <div className={styles.negoInputGroup}>
                                            <div className={styles.negoInputPrefix}>S/</div>
                                            <input
                                                type="number"
                                                placeholder="0.00"
                                                value={cancelForm.mobilityCost}
                                                onChange={e => setCancelForm(prev => ({ ...prev, mobilityCost: e.target.value }))}
                                                style={{ width: '100%', padding: '10px 14px 10px 30px', borderRadius: '10px', border: '1.5px solid #E2E8F0', outline: 'none', color: '#1E293B', fontWeight: 700 }}
                                            />
                                        </div>
                                        <p style={{ fontSize: '11px', color: '#64748B', marginTop: '4px' }}>
                                            * Se registrará como un egreso para la empresa, impactando negativamente la rentabilidad del ticket.
                                        </p>
                                    </div>

                                    <div className={styles.negoInputWrapper}>
                                        <label>Motivo de la Anulación</label>
                                        <textarea
                                            placeholder="Describa brevemente por qué el cliente no aprobó..."
                                            value={cancelForm.reason}
                                            onChange={e => setCancelForm(prev => ({ ...prev, reason: e.target.value }))}
                                            style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1.5px solid #E2E8F0', outline: 'none', minHeight: '80px', color: '#1E293B', fontSize: '13px' }}
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className={styles.negotiationModalActions}>
                                <button className={styles.negoCancelBtn} onClick={() => setShowCancelModal(false)}>
                                    Volver
                                </button>
                                <button 
                                    className={styles.negoConfirmBtn} 
                                    onClick={handleCancelQuote}
                                    disabled={isCancelling}
                                    style={{ background: 'linear-gradient(135deg, #DC2626, #991B1B)' }}
                                >
                                    {isCancelling ? <Clock size={18} className={styles.spinner} /> : <Trash2 size={18} />}
                                    <span>CONFIRMAR ANULACIÓN DEFINITIVA</span>
                                </button>
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


