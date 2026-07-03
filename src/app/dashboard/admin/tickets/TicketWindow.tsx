"use client";
import { useState, useRef, useEffect, useCallback, useMemo, memo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys, normalizeTicket } from "@/lib/useQueryHooks";
import * as XLSX from 'xlsx';
import { X, Minimize2, Maximize2, Square, FileText, ArrowRight, Calendar, Camera, ClipboardCheck, DollarSign, Percent, Package, Split, Coins, FileSpreadsheet, Download, Send, Upload, Clock, CheckCircle, CheckCircle2, ThumbsUp, Hammer, Wallet, Plus, Calculator, Receipt, Sparkles, AlertTriangle, Trash2, User, UserPlus, Ban, CreditCard, Lock, Edit3, ArrowDownLeft, Stethoscope, ShieldAlert, AlertCircle, RefreshCw, XCircle, Truck, TrendingUp, Pencil } from "lucide-react";
import TechnicianDrawer from "./TechnicianDrawer";
import TicketStateNavigator from "./TicketStateNavigator";
import { TicketSummary, InfoBarBase, TechnicianSchedulingBar, DiagnosisInfoBar, QuotationInfoBar, FinancialLiquidationBar, UnifiedEvidenceBar, DocumentationSummaryBar, QuoteAssistantBar, PaymentHistoryBar, GestoraAssignmentBar } from "./TicketSummary";
import GestoraDrawer from "./GestoraDrawer";
import OnlineQuotationEditor from "./OnlineQuotationEditor";
import { normalizeStateId, TICKET_STATE_ORDER } from "@/lib/ticketStates";
import { calculateTicketFinances, toNum, generateTransactionToken, sanitizeTicketMetadata } from "@/lib/calculations";
import { supabase } from "@/lib/supabase";
import { DuplicateTicketCostError, ticketsAPI, branchesAPI, ticketCostsAPI, techniciansAPI } from "@/lib/supabase-api";
import { SERVICE_TYPES } from "@/lib/serviceTypes";
import { round2, formatSoles } from "@/lib/formatters";
import { compressImage } from "@/lib/imageCompression";
import { ticketsCache } from "@/lib/tickets-cache";
import styles from "./TicketWindow.module.css";
import VirtualSecretaryFab from "./VirtualSecretaryFab";
const MIBANCO_ID = "b65727ed-94d3-46ef-ab7d-62621ec46acb";
const SANTANDER_ID = "419d87c8-65e1-434f-8253-d8a226ca5f62";
interface TicketData {
    id: string;
    ticket_number?: number;
    client_id: string;
    branch_id?: string;
    technician_id?: string | null;
    status_id: string;
    description?: string;
    client_ticket_number?: string | null;
    created_at?: string;
    updated_at?: string;
    labor_cost?: number;
    materials_cost?: number;
    visit_cost?: number | null;
    total_quoted_amount?: number;
    diagnosis?: string;
    priority?: string;
    service_type?: string;
    created_by?: string;
    current_step?: number;
    quotation_date?: string;
    execution_date?: string;
    closure_date?: string;
    is_sla_paused?: boolean;
    sla_pause_date?: string;
    sla_reactivation_date?: string;
    sede_reportada_cliente?: string | null;
    gestora_id?: string | null;
    technician: any;
    gestora: any;
    cliente: any;
    sede: any;
    metadata: any;
    costos: any[];
    [key: string]: any;
}
interface TicketWindowProps {
    ticket: any;
    onClose: () => void;
    onUpdate?: (id: string, updates: any) => Promise<any>;
    index?: number;
    children?: React.ReactNode;
    gestoraMetrics?: import("./VirtualSecretaryFab").GestoraMetrics;
}
const SLATimerHeader = memo(({ ticket }: { ticket: any }) => {
    const [now, setNow] = useState(new Date());
    useEffect(() => {
        if (ticket.pausadoSLA) return;
        const interval = setInterval(() => setNow(new Date()), 1000);
        return () => clearInterval(interval);
    }, [ticket.pausadoSLA]);
    const formatElapsed = () => {
        const start = new Date(ticket.fechaCreacion);
        const end = (ticket.pausadoSLA && ticket.fechaPausa)
            ? new Date(ticket.fechaPausa)
            : now;
        const diffMs = Math.max(0, end.getTime() - start.getTime());
        const hrs = Math.floor(diffMs / 3600000);
        const mins = Math.floor((diffMs % 3600000) / 60000);
        const secs = Math.floor((diffMs % 60000) / 1000);
        return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };
    return (
        <div className={`${styles.slaTimerHeader} ${ticket.pausadoSLA ? styles.paused : ''}`}>
            <Clock size={14} />
            <span>{formatElapsed()}</span>
            {ticket.pausadoSLA && <span className={styles.pausedLabel}>PAUSADO</span>}
        </div>
    );
});
function TicketWindow({ ticket, onClose, onUpdate, index = 0, children, gestoraMetrics }: TicketWindowProps) {
    const [ticketData, setTicketData] = useState<any>(() => ({
        ...ticket,
        status_id: ticket.status_id || normalizeStateId(ticket.status_id || "nuevo")
    }));
    const isSantander = ticketData.client_id === SANTANDER_ID || (ticketData.client_ticket_number || "").startsWith("STD");
    const isBCP = ticketData.cliente?.nombre?.toUpperCase().includes("BCP") || ticketData.cliente?.name?.toUpperCase().includes("BCP");
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
    const [isRealtimeConnected, setIsRealtimeConnected] = useState(false);
    const queryClient = useQueryClient();
    useEffect(() => {
        if (typeof window !== 'undefined') {
            localStorage.setItem(`ticket_ui_${ticket.id}`, JSON.stringify({
                isMaximized,
                isMinimized,
                position
            }));
        }
    }, [isMaximized, isMinimized, position, ticket.id]);
    const [diagnosis, setDiagnosis] = useState("");
    const [laborCost, setLaborCost] = useState("");
    const [materialsCost, setMaterialsCost] = useState("");
    const [modalidad, setModalidad] = useState("todo_costo");
    const [evidenciasCampo, setEvidenciasCampo] = useState<any[]>([]);
    const [totalQuotedAmount, setTotalQuotedAmount] = useState(() => {
        const meta = ticket.metadata || {};
        return parseFloat(ticket.total_quoted_amount || meta.total_quoted_amount || 0);
    });
    const [montoSubtotal, setMontoSubtotal] = useState(ticket.montoSubtotal || ticket.metadata?.montoSubtotal || 0);
    const [montoIGV, setMontoIGV] = useState(ticket.montoIGV || ticket.metadata?.montoIGV || 0);
    const quotationEditorRef = useRef<any>(null);
    const [partidasCotización, setPartidasCotización] = useState<any[]>(() => {
        return ticket.partidas || ticket.metadata?.partidas || [];
    });
    const [isQuotationCollapsed, setIsQuotationCollapsed] = useState(true);
    const [isSavingCost, setIsSavingCost] = useState(false);
    const [isSendingQuote, setIsSendingQuote] = useState(false);
    const [isSavingNegotiation, setIsSavingNegotiation] = useState(false);
    const [porcentajeAdelanto, setPorcentajeAdelanto] = useState<number | null>(null);
    const [montoAdelantoManual, setMontoAdelantoManual] = useState<string>("");
    const quotationDraftRef = useRef<{ items: any[]; total: number } | null>(null);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [showTransferModal, setShowTransferModal] = useState(false);
    const [showLiquidationConfirm, setShowLiquidationConfirm] = useState(false);
    const [advanceClassification, setAdvanceClassification] = useState<'pocket' | 'materials'>('pocket');
    const [advanceRefreshKey, setAdvanceRefreshKey] = useState(0); // Force re-render after payment confirmation
    const [showExceedApprovalConfirm, setShowExceedApprovalConfirm] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [isTransferring, setIsTransferring] = useState(false);
    const [targetTicketSearch, setTargetTicketSearch] = useState("");
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [selectedTargetTicket, setSelectedTargetTicket] = useState<any>(null);
    const [riskAlert, setRiskAlert] = useState<{ show: boolean, title: string, message: string, onConfirm: () => void }>({
        show: false,
        title: "",
        message: "",
        onConfirm: () => {}
    });
    
    // CONCILIACIÓN RETROACTIVA STATES
    const [isRetroactiveClosure, setIsRetroactiveClosure] = useState(false);
    const [retroactiveDate, setRetroactiveDate] = useState("2026-06-30T23:59:59");

    // CLOSED TICKET EDIT STATES
    const [isEditingClosedData, setIsEditingClosedData] = useState(false);
    const [closedDataEdits, setClosedDataEdits] = useState({ client_ticket_number: "", closure_date: "" });
    
    const checkAndHardDelete = async () => {
        if (!ticketData?.id) return;
        setIsDeleting(true);
        try {
            const costs = await ticketCostsAPI.getByTicket(ticketData.id);
            if (costs && ticket_costs ?.length > 0) {
                const pendingCount = ticket_costs ?.filter((c: any) => c.estado_pago === 'pendiente').length;
                const paidCount = ticket_costs ?.filter((c: any) => c.estado_pago === 'pagado').length;
                setShowDeleteModal(false);
                setShowTransferModal(true);
                showToast(
                    "Bloqueo de Seguridad", 
                    `Este ticket tiene ${ticket_costs ?.length} registros en costos (${paidCount} pagados, ${pendingCount} pendientes). Debe eliminarlos o trasladarlos antes de borrar el ticket.`, 
                    "info"
                );
                return;
            }
            if (!confirm(`¿FINALMENTE SEGURO? Esta acción es irreversible y eliminará el ticket ${ticketData.client_ticket_number || ticketData.id} de TODO el sistema (incluyendo fotos y chat).`)) {
                return;
            }
            await ticketsAPI.delete(ticketData.id);
            // Actualización optimista en RAM: basta con setQueryData para ambas variantes de la key.
            // NO usar invalidateQueries aquí: dispararía refetch de TicketWindow ya desmontada
            // causando errores PGRST116 (0 rows) y bloqueos HTTP 406.
            const deletedId = ticketData.id;
            queryClient.setQueryData(
                queryKeys.tickets.summary(),
                (old: any[] | undefined) => old ? old.filter((t: any) => t.id !== deletedId) : old
            );
            queryClient.removeQueries({ queryKey: queryKeys.tickets.detail(deletedId) });
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
            const transferResult: any = await ticketCostsAPI.transferAllToTicket(ticketData.id, selectedTargetTicket.id);
            let movedCostsCount = 0;
            let movedPaymentsCount = 0;
            if (Array.isArray(transferResult)) {
                movedCostsCount = transferResult.length;
            } else {
                movedCostsCount = transferResult?.movedCosts?.length || 0;
                movedPaymentsCount = transferResult?.movedPayments?.length || 0;
            }
            showToast(
                "Gastos Trasladados",
                `Se trasladaron ${movedCostsCount} costos y ${movedPaymentsCount} pagos al ticket ${selectedTargetTicket.client_ticket_number || selectedTargetTicket.id}.`,
                "success"
            );
            // Eliminar el ticket automáticamente tras el traslado exitoso.
            setShowTransferModal(false);
            await ticketsAPI.delete(ticketData.id);
            // Actualización optimista en RAM. Sin invalidateQueries: evita bucle de red
            // y errores PGRST116 en TicketWindow que aún está en el árbol de React.
            const deletedId = ticketData.id;
            queryClient.setQueryData(
                queryKeys.tickets.summary(),
                (old: any[] | undefined) => old ? old.filter((t: any) => t.id !== deletedId) : old
            );
            queryClient.removeQueries({ queryKey: queryKeys.tickets.detail(deletedId) });
            showToast("Ticket Eliminado", `El ticket y sus ${movedCostsCount} gasto(s) han sido trasladados y el ticket ha sido eliminado.`, "success");
            onClose();
        } catch (err) {
            console.error("Transfer error:", err);
            showToast("Error", "No se pudo trasladar los gastos.", "error");
        } finally {
            setIsTransferring(false);
        }
    };
    const [showReportUpdateModal, setShowReportUpdateModal] = useState(false);
    const [isSavingReport, setIsSavingReport] = useState(false);
    const [reportForm, setReportForm] = useState({
        diagnosis: "",
        laborCost: "",
        materialsCost: ""
    });
    const handleOpenReportUpdate = () => {
        setReportForm({
            diagnosis: ticketData.diagnosis || "",
            laborCost: (ticketData.labor_cost || 0).toString(),
            materialsCost: (ticketData.materials_cost || 0).toString()
        });
        setShowReportUpdateModal(true);
    };
    const handleSaveReportUpdate = async () => {
        if (isSavingReport) return;
        const SEALED_STATES = ['cotizacion_aprobada', 'en_ejecucion', 'documentacion_enviada', 'por_liquidar', 'pago_realizado', 'ticket_cerrado'];
        const isSealedState = SEALED_STATES.includes(ticketData.status_id);
        const userRole = localStorage.getItem('userRole');
        const isAdminUser = userRole?.toLowerCase() === 'admin' || userRole?.toLowerCase() === 'superadmin';
        if (isSealedState && !isAdminUser) {
            showToast("Presupuesto Sellado", "No se puede modificar el reporte técnico de un ticket aprobado. Contacte al Administrador.", "error");
            setShowReportUpdateModal(false);
            return;
        }
        setIsSavingReport(true);
        try {
            const oldMO = parseFloat(String(ticketData.labor_cost || "0"));
            const oldMAT = parseFloat(String(ticketData.materials_cost || "0"));
            const newMO = parseFloat(reportForm.laborCost || "0");
            const newMAT = parseFloat(reportForm.materialsCost || "0");
            const updatedMetadata = sanitizeTicketMetadata({
                ...(ticketData.metadata || {}),
                diagnosis: reportForm.diagnosis,
                labor_cost: newMO,
                materials_cost: newMAT
            });
            const { error } = await supabase
                .from('tickets')
                .update({
                    diagnosis: reportForm.diagnosis,
                    labor_cost: newMO,
                    materials_cost: newMAT,
                    metadata: updatedMetadata
                })
                .eq('id', ticketData.id);
            if (error) throw error;
            await supabase.from('debug_logs').insert({
                log_data: {
                    action: 'UPDATE_TECHNICAL_REPORT',
                    ticket_id: ticketData.id,
                    ticket_number: ticketData.client_ticket_number,
                    user_email: localStorage.getItem('userEmail'),
                    changes: {
                        diagnosis: { old: ticketData.diagnosis, new: reportForm.diagnosis },
                        mo: { old: oldMO, new: newMO },
                        mat: { old: oldMAT, new: newMAT }
                    },
                    timestamp: new Date().toISOString()
                }
            });
            setDiagnosis(reportForm.diagnosis);
            setLaborCost(newMO.toString());
            setMaterialsCost(newMAT.toString());
            setTicketData((prev: any) => ({
                ...prev,
                diagnosis: reportForm.diagnosis,
                labor_cost: newMO,
                materials_cost: newMAT,
                metadata: updatedMetadata
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
            if (!email || typeof email !== 'string' || !email.includes('@')) return;
            const { data: gestoraData, error: errG } = await supabase.from('gestoras').select('id').eq('email', email.toLowerCase()).maybeSingle();
            if (errG) console.warn('[TicketWindow] Error gestoras:', errG.message);
            if (gestoraData?.id) setMyGestoraId(gestoraData.id);
            const { data: profileData, error: errP } = await supabase.from('perfiles').select('id').eq('email', email.toLowerCase()).maybeSingle();
            if (errP) console.warn('[TicketWindow] Error perfiles:', errP.message);
            if (profileData?.id) setMyProfileId(profileData.id);
        };
        fetchMe();
    }, []);
    const [toast, setToast] = useState<{ visible: boolean; title: string; message: string; type: 'success' | 'error' | 'info' }>({ visible: false, title: '', message: '', type: 'info' });
    const [ticketCosts, setTicketCosts] = useState<any[]>([]);
    const finances = useMemo(
        () => calculateTicketFinances(ticketData, ticketCosts),
        [ticketData, ticketCosts]  // ✅ Recalcular cuando cambien los costs
    );
    const {
        pactedMO: techPactedTotal,
        totalLaborConfirmed: unifiedPaymentsSum,
        totalLaborPending,
        netLaborBalance: finalBalance,
        realProfitability: grossMargin,
        margenReal: pctReal,
        laborItems,
        operatingItems,
        pendingLaborItems,
        pendingOpItems,
        operatingExpenses,
        totalOpPending,
        totalRequested,
        pactedMO,
        balance: baseRescue,
        netIncome
    } = finances;
    const advanceRequestPending = pendingLaborItems.some((item: any) => {
        const text = `${item.categoria || ''} ${item.concepto || ''}`.toLowerCase();
        return text.includes('adelanto') || text.includes('rescate financiero');
    });
    const canProceedWithExecution = ticketData.status_id === "en_ejecucion" || unifiedPaymentsSum > 0;
    let availableRescue = baseRescue;
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
    if (pactedMO > 0 && RESCUE_ELIGIBLE_STATES.has(ticketData.status_id)) {
        const computed = Math.max(0, pactedMO - finances.laborRequested);
        availableRescue = (availableRescue > 0)
            ? Math.min(availableRescue, computed)
            : computed;
    }
    if (pactedMO <= 0 && ['visita_realizada', 'en_cotizacion', 'cotizacion_enviada', 'cotizacion_aprobada', 'en_ejecucion'].includes(ticketData.status_id)) {
        if (availableRescue <= 0) availableRescue = 100;
    }
    const isVisitPaid = ticketCosts.some(c =>
        (c.categoria || '').toLowerCase().includes('movilidad') && 
        (c.estado_pago || '').toLowerCase() === 'pagado'
    );
    const [loadingCosts, setLoadingCosts] = useState(false);
    const [isConfirmingPayment, setIsConfirmingPayment] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const showToast = (title: string, message: string, type: 'success' | 'error' | 'info' = 'success') => {
        setToast({ visible: true, title, message, type });
        setTimeout(() => setToast(prev => ({ ...prev, visible: false })), 4000);
    };
    const hasLoadedRef = useRef<string | null>(null);
    const loadCosts = useCallback(async () => {
        if (!ticketData?.id) return;
        setLoadingCosts(true);
        try {
            // Cláusula de guardia: si el ticket fue eliminado, la API devuelve 404/vacío.
            // Absorber silenciosamente en lugar de propagar PGRST116 a la consola.
            let costs: any[] = [];
            try {
                costs = await ticketCostsAPI.getByTicket(ticketData.id);
            } catch (costsErr: any) {
                // 404, 406 o cualquier error de red cuando el ticket ya no existe
                setLoadingCosts(false);
                return;
            }
            setTicketCosts(costs || []);
            try {
                const rawTicket = await ticketsAPI.getById(ticketData.id);
                // rawTicket es null cuando .maybeSingle() no encuentra filas (ticket borrado)
                if (rawTicket) {
                    const updatedTicket = normalizeTicket(rawTicket);
                    const localCosts = Array.isArray(updatedTicket.ticket_costs) ? updatedTicket.ticket_costs : (costs || []);
                    const v3Finances = calculateTicketFinances(updatedTicket, localCosts);
                    setTicketData((prev: TicketData) => ({
                        ...prev,
                        estadoId: updatedTicket.status_id,
                        status_id: updatedTicket.status_id,
                        diagnosis: updatedTicket.diagnosis,
                        costoManoObra: updatedTicket.labor_cost,
                        costoMateriales: updatedTicket.materials_cost,
                        costoVisita: updatedTicket.visit_cost,
                        montoFinal: updatedTicket.total_quoted_amount,
                        numeroTicketCliente: updatedTicket.client_ticket_number,
                        technician: updatedTicket.technician,
                        gestora: updatedTicket.gestora,
                        cliente: updatedTicket.cliente || prev.cliente || null,
                        sede: updatedTicket.sede || prev.sede || null,
                        solicitudAdelanto: updatedTicket.solicitudAdelanto,
                        solicitudPago: updatedTicket.solicitudPago,
                        solicitudLiquidacion: updatedTicket.solicitudLiquidacion,
                        pagoRechazado: updatedTicket.pagoRechazado,
                        solicitudesDeposito: updatedTicket.solicitudesDeposito,
                        adelantoPagado: updatedTicket.adelantoPagado,
                        metadata: updatedTicket.metadata || prev.metadata,
                        saldo_tecnico: v3Finances.netLaborBalance,
                        utilidad_neta: v3Finances.netProfit,
                        margen_real: v3Finances.profitMargin,
                        ingresos_reales: v3Finances.netIncome,
                        monto_pactado_mo: v3Finances.laborPactado,
                        total_costs_agg: v3Finances.totalExpenses,
                        gastos_flujo_a: v3Finances.operatingExpenses,
                        adelantos_flujo_b: v3Finances.laborExpenses
                    }));
                }
            } catch (e) {
                console.error("Error updating local V3 finances:", e);
            }
        } catch (err) {
            console.error("Error loading costs:", err);
        } finally {
            setLoadingCosts(false);
        }
    }, [ticketData.id]);
    const loadCostsRef = useRef(loadCosts);
    useEffect(() => { loadCostsRef.current = loadCosts; }, [loadCosts]);
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
                    loadCostsRef.current();
                }
            )
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'ticket_payments',
                    filter: `ticket_id=eq.${ticketData.id}`
                },
                () => {
                    loadCostsRef.current();
                }
            )
            .subscribe();
        return () => {
            supabase.removeChannel(channel);
        };
    }, [ticketData.id]);
    useEffect(() => {
        if (!ticket?.id || hasLoadedRef.current === ticket.id) return;
        hasLoadedRef.current = ticket.id;
        const load = async () => {
            try {
                loadCosts();
                const rawTicket = await ticketsAPI.getById(ticket.id);
                if (!rawTicket) return;
                const fullTicket = normalizeTicket(rawTicket);
                if (fullTicket.labor_cost != null) setLaborCost(fullTicket.labor_cost.toString());
                if (fullTicket.materials_cost != null) setMaterialsCost(fullTicket.materials_cost.toString());
                let meta = fullTicket.metadata || {};
                while (meta.metadata && typeof meta.metadata === 'object') {
                    meta = { ...meta, ...meta.metadata };
                    delete meta.metadata;
                }
                const rawEstadoId = normalizeStateId(fullTicket.status_id || meta.status_id || 'nuevo');
                const visitConfirmed = (fullTicket.ticket_costs || []).some((c: any) => {
                    const text = `${c.categoria || ''} ${c.concepto || ''}`.toLowerCase();
                    return (c.estado_pago || '').toLowerCase() === 'pagado' && (text.includes('movilidad') || text.includes('visita'));
                });
                const advanceConfirmed = (fullTicket.ticket_costs || []).some((c: any) => {
                    const text = `${c.categoria || ''} ${c.concepto || ''}`.toLowerCase();
                    return (c.estado_pago || '').toLowerCase() === 'pagado' && text.includes('adelanto');
                });
                const PRE_INSPECTION_STATES = ['nuevo', 'tecnico_asignado', 'esperando_pago_visita'];
                const corregidoEstadoId = (visitConfirmed && PRE_INSPECTION_STATES.includes(rawEstadoId))
                    ? 'en_inspeccion'
                    : rawEstadoId;
                    const savedState = localStorage.getItem(`ticket_state_${ticket.id}`);
                    let cachedMetadata: any = {};
                    let cachedEstadoId: string | undefined;
                    if (savedState) {
                        try {
                            const parsed = JSON.parse(savedState);
                            cachedEstadoId = parsed.status_id;
                            const isTriage = !fullTicket.status_id || ['nuevo', 'borrador', 'pendiente'].includes(fullTicket.status_id);
                            if (isTriage) {
                                cachedMetadata = parsed;
                            } else {
                                const { estadoId: _, status_id: __, ...safe } = parsed;
                                cachedMetadata = safe;
                            }
                        } catch(e) {}
                    }
                    const serverStateOrder = TICKET_STATE_ORDER[corregidoEstadoId] ?? 0;
                    const cachedStateOrder = TICKET_STATE_ORDER[cachedEstadoId ?? ''] ?? 0;
                    const finalEstadoId = cachedStateOrder >= serverStateOrder 
                        ? (cachedEstadoId || corregidoEstadoId) 
                        : corregidoEstadoId;
                    const finalStatusId = finalEstadoId;
                    setTicketData((prev: TicketData) => {
                        const {
                            adelantoPagado,
                            visitPaymentConfirmed,
                            montoAdelanto,
                            fechaPagoAdelanto,
                            AdelantoPagado,
                            ...safeMeta
                        } = meta;
                        const {
                            adelantoPagado: cachedAdelantoPagado,
                            visitPaymentConfirmed: cachedVisitPaymentConfirmed,
                            montoAdelanto: cachedMontoAdelanto,
                            fechaPagoAdelanto: cachedFechaPagoAdelanto,
                            AdelantoPagado: cachedUpperAdelantoPagado,
                            solicitudAdelanto: _cachedSolicitudAdelanto,
                            solicitudPago: _cachedSolicitudPago,
                            solicitudLiquidacion: _cachedSolicitudLiquidacion,
                            solicitudAdelantoExtra: _cachedSolicitudAdelantoExtra,
                            solicitudesDeposito: _cachedSolicitudesDeposito,
                            pagoRechazado: _cachedPagoRechazado,
                            ...safeCachedMetadata
                        } = cachedMetadata;
                        const merged: TicketData = {
                            ...prev,
                            id: fullTicket.id,
                            ticket_number: fullTicket.ticket_number,
                            client_ticket_number: fullTicket.client_ticket_number || safeMeta.client_ticket_number || safeCachedMetadata.client_ticket_number || prev.client_ticket_number,
                            status_id: finalStatusId,
                            diagnosis: fullTicket.diagnosis,
                            descripcionProblema: fullTicket.descripcionProblema,
                            labor_cost: fullTicket.labor_cost,
                            materials_cost: fullTicket.materials_cost,
                            visit_cost: fullTicket.visit_cost,
                            total_quoted_amount: fullTicket.total_quoted_amount,
                            saldo_tecnico: fullTicket.saldo_technician,
                            margen_real: fullTicket.margen_real,
                            utilidad_neta: fullTicket.utilidad_neta,
                            inversion_ejecutada: fullTicket.inversion_ejecutada,
                            total_costs_agg: fullTicket.total_costs_agg,
                            ingresos_reales: fullTicket.ingresos_reales,
                            monto_pactado_mo: fullTicket.monto_pactado_mo,
                            cliente: fullTicket.cliente || prev.cliente || null,
                            sede: fullTicket.sede || prev.sede || null,
                            technician: fullTicket.technician,
                            gestora: fullTicket.gestora,
                            metadata: {
                                ...safeMeta, ...safeCachedMetadata,
                                solicitudAdelanto: safeMeta.solicitudAdelanto ?? null,
                                solicitudPago: safeMeta.solicitudPago ?? null,
                                solicitudLiquidacion: safeMeta.solicitudLiquidacion ?? null,
                                solicitudAdelantoExtra: safeMeta.solicitudAdelantoExtra ?? null,
                                solicitudesDeposito: safeMeta.solicitudesDeposito ?? null,
                                pagoRechazado: safeMeta.pagoRechazado ?? null,
                            },
                            adelantoPagado: advanceConfirmed,
                            visitPaymentConfirmed: visitConfirmed,
                            solicitudAdelanto: safeMeta.solicitudAdelanto !== undefined ? safeMeta.solicitudAdelanto : null,
                            solicitudPago: visitConfirmed ? null : (safeMeta.solicitudPago ?? null),
                            solicitudLiquidacion: safeMeta.solicitudLiquidacion ?? null,
                            pagoRechazado: safeMeta.pagoRechazado ?? null,
                            solicitudesDeposito: safeMeta.solicitudesDeposito ?? null,
                        };
                        if (cachedMetadata.labor_cost > 0 && (merged.labor_cost || 0) <= 20) {
                            merged.labor_cost = cachedMetadata.labor_cost;
                        }
                        if (cachedMetadata.total_quoted_amount > 0 && (merged.total_quoted_amount || 0) <= 20) {
                            merged.total_quoted_amount = cachedMetadata.total_quoted_amount;
                        }
                        return merged;
                    });
                    const finalPartidas = (meta.partidas && meta.partidas.length > 0) ? meta.partidas : (cachedMetadata.partidas || []);
                    if (finalPartidas.length > 0) {
                        setPartidasCotización(finalPartidas);
                        quotationDraftRef.current = null;
                    }
                    const finalMonto = parseFloat(meta.total_quoted_amount || cachedMetadata.total_quoted_amount || 0);
                    if (finalMonto > 0) setTotalQuotedAmount(finalMonto);
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
    useEffect(() => {
        if (!ticket || !isInitialLoadComplete) return;
        if (isTransitioning.current) return;
        if (isReassigning.current) return;
        if (isProcessingAdvance.current) {
            return;
        }
        const propTechId = ticket.technician_id;
        const localTechId = ticketData.technician?.id;
        if (localTechId && propTechId && propTechId !== localTechId) {
            return;
        }
        setTicketData((prev: any) => {
            const hasStatusChanged = ticket.status_id !== prev.status_id;
            const hasTechChanged = ticket.technician_id !== prev.technician_id;
            const hasTechObjectChanged = (ticket.technicians?.id || ticket.technician?.id) !== (prev.technician?.id);
            const hasGestoraChanged = ticket.gestora_id !== prev.gestora_id;
            const hasMetaChanged = JSON.stringify(ticket.metadata) !== JSON.stringify(prev.metadata);
            const hasLaborCostChanged = ticket.labor_cost !== prev.labor_cost;
            const hasMaterialsCostChanged = ticket.materials_cost !== prev.materials_cost;
            const hasDiagnosisChanged = ticket.diagnosis !== prev.diagnosis;
            if (!hasStatusChanged && !hasTechChanged && !hasTechObjectChanged && !hasGestoraChanged && !hasMetaChanged && !hasLaborCostChanged && !hasMaterialsCostChanged && !hasDiagnosisChanged) return prev;
            let meta = ticket.metadata || {};
            const rawEstadoId = normalizeStateId(ticket.status_id || meta.status_id || 'nuevo');
            const visitConfirmed = (ticket.ticket_costs || []).some((c: any) => {
                const text = `${c.categoria || ''} ${c.concepto || ''}`.toLowerCase();
                return (c.estado_pago || '').toLowerCase() === 'pagado' && (text.includes('movilidad') || text.includes('visita'));
            });
            const advanceConfirmed = (ticket.ticket_costs || []).some((c: any) => {
                const text = `${c.categoria || ''} ${c.concepto || ''}`.toLowerCase();
                return (c.estado_pago || '').toLowerCase() === 'pagado' && text.includes('adelanto');
            });
            const {
                adelantoPagado,
                visitPaymentConfirmed,
                montoAdelanto,
                fechaPagoAdelanto,
                AdelantoPagado,
                ...safeMeta
            } = meta;
            const PRE_INSPECTION_STATES = ['nuevo', 'tecnico_asignado', 'esperando_pago_visita'];
            const corregidoEstadoId = (visitConfirmed && PRE_INSPECTION_STATES.includes(rawEstadoId))
                ? 'en_inspeccion'
                : rawEstadoId;
            const serverStatusOrder = TICKET_STATE_ORDER[corregidoEstadoId] || 0;
            const prevStatusOrder = TICKET_STATE_ORDER[prev.status_id] || 0;
            const hasRejection = !!safeMeta.pagoRechazado;
            const shouldPreservePrevState = (prevStatusOrder > serverStatusOrder && !hasRejection && !isProcessingAdvance.current && !isIntentionalRollback.current)
                                          || (prevStatusOrder < serverStatusOrder && isIntentionalRollback.current);
            const finalModificacionAutorizada = isIntentionalRollback.current ? true : (ticket.modificacionAutorizada || safeMeta.modificacionAutorizada || prev.modificacionAutorizada);
            const finalSolicitud = safeMeta.solicitudAdelanto !== undefined ? safeMeta.solicitudAdelanto : (ticket.solicitudAdelanto ?? null);
            const finalStatusId = shouldPreservePrevState ? prev.status_id : corregidoEstadoId;
            return {
                ...prev,
                status_id: finalStatusId,
                ...ticket,
                saldo_tecnico: prev.saldo_tecnico !== undefined ? prev.saldo_tecnico : ticket.saldo_tecnico,
                utilidad_neta: prev.utilidad_neta !== undefined ? prev.utilidad_neta : ticket.utilidad_neta,
                margen_real: prev.margen_real !== undefined ? prev.margen_real : ticket.margen_real,
                ingresos_reales: prev.ingresos_reales !== undefined ? prev.ingresos_reales : ticket.ingresos_reales,
                monto_pactado_mo: prev.monto_pactado_mo !== undefined ? prev.monto_pactado_mo : ticket.monto_pactado_mo,
                partidas: prev.partidas || prev.metadata?.partidas || safeMeta.partidas,
                total_quoted_amount: prev.total_quoted_amount || prev.metadata?.total_quoted_amount || safeMeta.total_quoted_amount,
                labor_cost: prev.labor_cost !== undefined ? prev.labor_cost : ticket.labor_cost,
                materials_cost: prev.materials_cost !== undefined ? prev.materials_cost : ticket.materials_cost,
                diagnosis: prev.diagnosis !== undefined ? prev.diagnosis : ticket.diagnosis,
                evidenciasEjecucion: prev.evidenciasEjecucion || prev.metadata?.evidenciasEjecucion || safeMeta.evidenciasEjecucion,
                documentosChecklist: prev.documentosChecklist || prev.metadata?.documentosChecklist || safeMeta.documentosChecklist,
                client_ticket_number: prev.client_ticket_number || ticket.client_ticket_number || safeMeta.client_ticket_number,
                technician: (() => {
                    const incomingTech = ticket.technicians || ticket.technician
                    const incomingTechId = incomingTech?.id;
                    const localTechId = prev.technician?.id;
                    const propTechId = ticket.technician_id;
                    if (incomingTechId && propTechId && incomingTechId === propTechId && incomingTechId === localTechId) {
                        return incomingTech;
                    }
                    if (localTechId && localTechId === propTechId) {
                        return prev.technician
                    }
                    if (incomingTechId && incomingTechId !== localTechId) {
                        return incomingTech;
                    }
                    return prev.technician || incomingTech;
                })(),
                gestora: (() => {
                    const incomingGestora = ticket.gestoras || ticket.gestora || ticket.gestoraAsignado || safeMeta.gestora;
                    if (incomingGestora?.id === ticket.gestora_id && incomingGestora?.id === prev.gestora?.id) {
                        return incomingGestora;
                    }
                    return prev.gestora || incomingGestora;
                })(),
                metadata: {
                    ...safeMeta,
                    diagnosis: (prev.diagnosis !== undefined) ? prev.diagnosis : (prev.metadata?.diagnosis ?? safeMeta.diagnosis),
                    costoManoObra: (prev.labor_cost !== undefined) ? prev.labor_cost : (prev.metadata?.labor_cost ?? safeMeta.labor_cost),
                    costoMateriales: (prev.materials_cost !== undefined) ? prev.materials_cost : (prev.metadata?.materials_cost ?? safeMeta.materials_cost),
                    partidas: (prev.partidas !== undefined) ? prev.partidas : (prev.metadata?.partidas ?? safeMeta.partidas),
                    montoFinal: (prev.total_quoted_amount !== undefined) ? prev.total_quoted_amount : (prev.metadata?.total_quoted_amount ?? safeMeta.total_quoted_amount),
                    documentosChecklist: (prev.documentosChecklist !== undefined) ? prev.documentosChecklist : (prev.metadata?.documentosChecklist ?? safeMeta.documentosChecklist),
                    pagoRechazado: safeMeta.pagoRechazado !== undefined ? safeMeta.pagoRechazado : prev.pagoRechazado,
                    solicitudAdelanto: finalSolicitud,
                    solicitudPago: safeMeta.solicitudPago !== undefined ? safeMeta.solicitudPago : (prev.solicitudPago ?? prev.metadata?.solicitudPago ?? null),
                    solicitudLiquidacion: safeMeta.solicitudLiquidacion !== undefined ? safeMeta.solicitudLiquidacion : (prev.solicitudLiquidacion ?? prev.metadata?.solicitudLiquidacion ?? null),
                    solicitudesDeposito: safeMeta.solicitudesDeposito !== undefined ? safeMeta.solicitudesDeposito : (prev.solicitudesDeposito ?? prev.metadata?.solicitudesDeposito ?? null),
                },
                solicitudAdelanto: finalSolicitud,
                solicitudPago: safeMeta.solicitudPago !== undefined ? safeMeta.solicitudPago : (prev.solicitudPago ?? prev.metadata?.solicitudPago ?? null),
                solicitudLiquidacion: safeMeta.solicitudLiquidacion !== undefined ? safeMeta.solicitudLiquidacion : (prev.solicitudLiquidacion ?? prev.metadata?.solicitudLiquidacion ?? null),
                solicitudesDeposito: safeMeta.solicitudesDeposito !== undefined ? safeMeta.solicitudesDeposito : (prev.solicitudesDeposito ?? prev.metadata?.solicitudesDeposito ?? null),
                pagoRechazado: safeMeta.pagoRechazado !== undefined ? safeMeta.pagoRechazado : prev.pagoRechazado,
                modificacionAutorizada: finalModificacionAutorizada,
                solicitudModificacion: ticket.solicitudModificacion || safeMeta.solicitudModificacion || prev.solicitudModificacion,
                visitPaymentConfirmed: visitConfirmed,
                adelantoPagado: advanceConfirmed,
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
    const isProcessingAdvance = useRef(false);
    const isIntentionalRollback = useRef(false);
    const isTransitioning = useRef(false);
    const isReassigning = useRef(false);
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
            specialistName: ticketData.technician?.name || '',
            searchQuery: ticketData.technician?.name || '',
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
        if (ticketData.status_id === 'borrador' && ticketData.client_id === MIBANCO_ID) {
            setLoadingSedes(true);
            setTriageDescription(ticketData.description || ticketData.descripcionProblema || '');
            branchesAPI.getByClient(MIBANCO_ID)
                .then(data => setSedesMibanco(data))
                .catch(err => console.error(err))
                .finally(() => setLoadingSedes(false));
        }
    }, [ticketData.status_id, ticketData.client_id]);
    const windowRef = useRef<HTMLDivElement>(null);
    const lastSyncData = useRef<string>("");
    const advanceTransactionToken = useRef<string | null>(null);
    const liquidationTransactionToken = useRef<string | null>(null);
    const confirmAdvanceRef = useRef(false); // sigue siendo bool; solo para admin confirm
    const [isSubmittingAdvance, setIsSubmittingAdvance] = useState(false);
    const [isSubmittingLiquidation, setIsSubmittingLiquidation] = useState(false);
    const syncToSupabase = useCallback(async (dataOverride?: any, options?: { allowStateRollback?: boolean, manual?: boolean }) => {
        const dataToProcess = dataOverride || ticketData;
        if (!dataToProcess || !isInitialLoadComplete || isSyncing.current) return false;
        const isEditingMonto = !!montoAdelantoManual || !!porcentajeAdelanto;
        if (isEditingMonto && !dataOverride) {
            return false;
        }
        const {
            isMaximized: _isMaximized, isMinimized: _isMinimized, position: _position, zIndex: _zIndex,
            cliente: _cliente, sede: _sede, technician,
            clients: _clients, branch_offices: _branch_offices, technicians: _technicians, gestoras: _gestoras, gestora: _gestora,
            costos: _costos, pendingCosts: _pendingCosts, paidCosts: _paidCosts, exceedanceRequests: _exceedanceRequests, exceedanceRequestsCount: _exceedanceRequestsCount,
            metadata: _unusedMetadata,
            ...businessData
        } = dataToProcess;
        const cleanedBusinessData = { ...businessData };
        delete cleanedBusinessData.clients;
        delete cleanedBusinessData.branch_offices;
        delete cleanedBusinessData.technicians;
        delete cleanedBusinessData.gestoras;
        delete cleanedBusinessData.gestora;
        delete cleanedBusinessData.ticket_costs;
        delete cleanedBusinessData.pendingCosts;
        delete cleanedBusinessData.paidCosts;
        delete cleanedBusinessData.exceedanceRequests;
        delete cleanedBusinessData.exceedanceRequestsCount;
        const sourceForPayments = cleanedBusinessData;
        const sourceMetadata = cleanedBusinessData;
        const cleanedClientTicketNumber = (() => {
            const val = businessData.client_ticket_number;
            if (!val || val.trim() === "") return null;
            return val.trim();
        })();
        const { data: serverTicket } = await supabase
            .from('tickets')
            .select('metadata, status_id, technician_id, gestora_id, updated_at')
            .eq('id', ticketData.id)
            .single();

        // TIMESTAMPT GUARD: Prevents realtime listener from overwriting DB rollbacks
        const serverTime = serverTicket?.updated_at ? new Date(serverTicket.updated_at).getTime() : 0;
        const localTime = ticketData.updated_at ? new Date(ticketData.updated_at).getTime() : 0;
        if (serverTime > localTime + 5000 && !options?.manual && !dataOverride) {
            console.warn("Timestamp guard active: Server is newer than local state. Aborting silent sync to protect DB rollbacks.");
            return false;
        }
        const serverMeta = serverTicket?.metadata || {};
        const serverStatusId = serverTicket?.status_id;
        const localStateOrder = TICKET_STATE_ORDER[businessData.status_id] ?? 0;
        const serverStateOrder = TICKET_STATE_ORDER[serverStatusId] ?? 0;
        const hasActiveRejection = !!serverMeta.pagoRechazado && businessData.pagoRechazado !== null;
        const resolvedStatusId = hasActiveRejection
            ? serverStatusId
            : options?.allowStateRollback
                ? businessData.status_id
                : (localStateOrder >= serverStateOrder ? businessData.status_id : serverStatusId);
        const localHasNewSolLiq = businessData.solicitudLiquidacion !== undefined 
            && businessData.solicitudLiquidacion !== null 
            && serverMeta.solicitudLiquidacion === undefined;
        const localHasNewSolPago = businessData.solicitudPago !== undefined 
            && businessData.solicitudPago !== null 
            && serverMeta.solicitudPago === undefined;
        const localHasNewSolAde = businessData.solicitudAdelanto !== undefined 
            && businessData.solicitudAdelanto !== null 
            && serverMeta.solicitudAdelanto === undefined;
        const resLiq = (hasActiveRejection || options?.allowStateRollback === false || localHasNewSolLiq)
            ? (localHasNewSolLiq ? businessData.solicitudLiquidacion : serverMeta.solicitudLiquidacion)
            : (businessData.solicitudLiquidacion !== undefined ? businessData.solicitudLiquidacion : (serverMeta.solicitudLiquidacion ?? null));
        const resAde = (hasActiveRejection || options?.allowStateRollback === false || localHasNewSolAde)
            ? (localHasNewSolAde ? businessData.solicitudAdelanto : serverMeta.solicitudAdelanto)
            : (businessData.solicitudAdelanto !== undefined ? businessData.solicitudAdelanto : (serverMeta.solicitudAdelanto ?? null));
        const resPago = (hasActiveRejection || options?.allowStateRollback === false || localHasNewSolPago)
            ? (localHasNewSolPago ? businessData.solicitudPago : serverMeta.solicitudPago)
            : (businessData.solicitudPago !== undefined ? businessData.solicitudPago : (serverMeta.solicitudPago ?? null));
        const cleanServerMeta = { ...serverMeta };
        delete cleanServerMeta.clients;
        delete cleanServerMeta.cliente;
        delete cleanServerMeta.branch_offices;
        delete cleanServerMeta.sede;
        delete cleanServerMeta.technicians;
        delete cleanServerMeta.technician;
        delete cleanServerMeta.gestoras;
        delete cleanServerMeta.gestora;
        delete cleanServerMeta.ticket_costs;
        delete cleanServerMeta.pendingCosts;
        delete cleanServerMeta.paidCosts;
        delete cleanServerMeta.exceedanceRequests;
        delete cleanServerMeta.exceedanceRequestsCount;
        const updates: any = {
            status_id: resolvedStatusId || businessData.status_id,
            description: businessData.description || businessData.descripcionProblema,
            client_ticket_number: cleanedClientTicketNumber || businessData.client_ticket_number,
            diagnosis: businessData.diagnosis,
            labor_cost: parseFloat(sourceForPayments?.labor_cost || 0),
            materials_cost: parseFloat(sourceForPayments?.materials_cost || 0),
            visit_cost: parseFloat(sourceForPayments?.visit_cost || 0),
            total_quoted_amount: parseFloat(sourceForPayments?.total_quoted_amount ?? sourceForPayments?.total_quoted_amount ?? totalQuotedAmount ?? 0),
            technician_id: technician?.id || serverTicket?.technician_id || businessData.technician_id,
            gestora_id: businessData?.gestora?.id || serverTicket?.gestora_id || businessData.gestora_id,
            execution_date: businessData.execution_date,
            metadata: {
                ...cleanServerMeta,
                ...sourceMetadata,
                diagnosis: businessData.diagnosis || sourceMetadata.diagnosis || serverMeta.diagnosis,
                partidas: businessData.partidas || sourceMetadata.partidas || serverMeta.partidas,
                montoFinal: businessData.total_quoted_amount ?? sourceMetadata.total_quoted_amount ?? serverMeta.total_quoted_amount,
                documentosChecklist: businessData.documentosChecklist || sourceMetadata.documentosChecklist || serverMeta.documentosChecklist,
                pagoRechazado: (sourceMetadata.pagoRechazado === null) ? null : serverMeta.pagoRechazado,
                estadoId: resolvedStatusId,
                status_id: resolvedStatusId,
                solicitudLiquidacion: resLiq,
                solicitudAdelanto: resAde,
                solicitudPago: resPago,
                solicitudesDeposito: businessData.solicitudesDeposito !== undefined ? businessData.solicitudesDeposito : (serverMeta.solicitudesDeposito ?? null),
                evidenciasEjecucion,
                metadata: undefined
            },
            ...(businessData.closure_date ? { closure_date: businessData.closure_date } : {})
        };
        const currentDataStr = JSON.stringify(updates);
        if (currentDataStr === lastSyncData.current && !dataOverride) return false;
        isSyncing.current = true;
        let success = false;
        try {
            if (onUpdate) {
                await onUpdate(ticketData.id, updates);
            } else {
                await ticketsAPI.update(ticketData.id, updates);
            }
            lastSyncData.current = currentDataStr;
            success = true;
        } catch (err) {
            console.error("Error syncing ticket to Supabase:", err);
            success = false;
        } finally {
            isSyncing.current = false;
        }
        return success;
    }, [ticketData, onUpdate, evidenciasEjecucion, documentosChecklist, totalQuotedAmount, partidasCotización, isInitialLoadComplete]);
    const syncToSupabaseRef = useRef(syncToSupabase);
    useEffect(() => {
        syncToSupabaseRef.current = syncToSupabase;
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
                        montoAdelanto,
                        AdelantoPagado,
                        estadoId,
                        status_id,
                        visitPaymentConfirmed,
                        solicitudAdelanto,
                        fechaPagoVisita,
                        solicitudPago,
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
    useEffect(() => {
        if (!ticketData?.id) return;
        const channel = supabase
            .channel(`ticket_realtime_${ticketData.id}`)
            .on('postgres_changes',
                { 
                    event: 'UPDATE', 
                    schema: 'public', 
                    table: 'tickets', 
                    filter: `id=eq.${ticketData.id}` 
                },
                (payload) => {
                    const freshServerData = payload.new as any;
                    // ⚡ FIX: Usar la ref estable para no crear una closure sobre
                    // una versión desactualizada de loadCosts (que habría cambiado
                    // si advanceRefreshKey era una dependencia del useCallback).
                    // El guard isTransitioning evita GETs dobles durante cambios de estado.
                    if (!isTransitioning.current) {
                        loadCostsRef.current();
                    }
                    setTicketData((prev: any) => {
                        if (isTransitioning.current) return prev;
                        const serverMeta = freshServerData.metadata || {};
                        const prevMeta = prev.metadata || {};
                        const incomingStatus = freshServerData.status_id || 'nuevo';
                        const incomingOrder = TICKET_STATE_ORDER[incomingStatus] || 0;
                        const currentOrder = TICKET_STATE_ORDER[prev.status_id] || 0;
                        const hasNewRejection = !!serverMeta.pagoRechazado;
                        if (incomingOrder < currentOrder && !hasNewRejection) {
                            console.warn(`[Realtime] Ignorando regresión de estado: ${incomingStatus} → ${prev.status_id}`);
                            return prev;
                        }
                        const serverFields = {
                            status_id: incomingOrder >= currentOrder ? incomingStatus : prev.status_id,
                            estadoId: incomingOrder >= currentOrder ? normalizeStateId(incomingStatus) : prev.status_id,
                            technician_id: freshServerData.technician_id,
                            gestora_id: freshServerData.gestora_id,
                            labor_cost: freshServerData.labor_cost,
                            materials_cost: freshServerData.materials_cost,
                            visit_cost: freshServerData.visit_cost,
                            total_quoted_amount: freshServerData.total_quoted_amount,
                        };
                        const mergedMeta = {
                            ...prevMeta,
                            ...serverMeta,
                            diagnosis: prevMeta.diagnosis,
                            partidas: prevMeta.partidas,
                            montoFinal: prevMeta.total_quoted_amount,
                            documentosChecklist: prevMeta.documentosChecklist,
                            pagoRechazado: serverMeta.pagoRechazado ?? null,
                            solicitudAdelanto: serverMeta.solicitudAdelanto ?? null,
                            solicitudPago: serverMeta.solicitudPago ?? null,
                            solicitudLiquidacion: serverMeta.solicitudLiquidacion ?? null,
                            solicitudAdelantoExtra: serverMeta.solicitudAdelantoExtra ?? null,
                            solicitudesDeposito: serverMeta.solicitudesDeposito ?? null,
                            adelantoPagado: serverMeta.adelantoPagado ?? null,
                            visitPaymentConfirmed: serverMeta.visitPaymentConfirmed ?? null,
                            historialPagosTecnico: serverMeta.historialPagosTecnico ?? prevMeta.historialPagosTecnico,
                        };
                        return {
                            ...prev,
                            ...serverFields,
                            metadata: mergedMeta,
                            solicitudAdelanto: mergedMeta.solicitudAdelanto,
                            solicitudPago: mergedMeta.solicitudPago,
                            solicitudLiquidacion: mergedMeta.solicitudLiquidacion,
                            pagoRechazado: mergedMeta.pagoRechazado,
                            adelantoPagado: mergedMeta.adelantoPagado,
                            visitPaymentConfirmed: mergedMeta.visitPaymentConfirmed,
                        };
                    });
                }
            )
            .subscribe((status) => {
                if (status === 'SUBSCRIBED') setIsRealtimeConnected(true);
                if (status === 'CLOSED' || status === 'CHANNEL_ERROR') setIsRealtimeConnected(false);
            });
        return () => {
            setIsRealtimeConnected(false);
            supabase.removeChannel(channel);
        };
    }, [ticketData?.id]);
    const handleAssignment = async (assignmentData: any) => {
        isReassigning.current = true;
        const isInitialAssignment = ['nuevo', 'pendiente', 'borrador'].includes(ticketData.status_id);
        const newEstadoId = isInitialAssignment ? 'en_inspeccion' : ticketData.status_id;
        const newTechnicianObj = assignmentData.technician || assignmentData.tecnico || null;
        const technician_id = newTechnicianObj?.id || null;
        const dbUpdates: any = {
            technician_id: technician_id,
            status_id: newEstadoId,
            metadata: {
                ...ticketData.metadata,
                technician: newTechnicianObj,
                fechaAsignacion: assignmentData.fechaAsignacion || assignmentData.fechaReasignacion,
                status_id: newEstadoId
            }
        };
        try {
            if (onUpdate) {
                await onUpdate(ticketData.id, dbUpdates);
            } else {
                const { metadata, ...columnUpdates } = dbUpdates;
                const response = await fetch('/api/v3/tickets-server?accion=parchar_ticket', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        id: ticketData.id,
                        columnUpdates,
                        metadataUpdates: metadata
                    })
                });
                const result = await response.json();
                if (!response.ok || !result.success) {
                    throw new Error(result.error || 'Error al actualizar en el servidor seguro');
                }
            }

            // Actualizar estado local ANTES de invalidar queries
            setTicketData((prev: any) => ({
                ...prev,
                technician: newTechnicianObj,
                technicians: newTechnicianObj,
                tecnico: newTechnicianObj,
                technician_id: technician_id,
                status_id: newEstadoId
            }));
            setShowAssignmentDrawer(false);

            // Invalidar queries para actualizar datos del servidor
            queryClient.invalidateQueries({ queryKey: ['tickets'] });

            // Resetear flag SOLO después de que la actualización local se haya aplicado
            // y las queries se hayan invalidado. El flag protege contra sobreescrituras
            // del useEffect mientras la data del servidor no ha sido refrescada.
            isReassigning.current = false;
        } catch (err: any) {
            console.error('Error persisting assignment to Supabase:', err);
            alert("❌ Error al asignar el técnico: " + (err.message || "Error en el servidor"));
            isReassigning.current = false;
            return;
        }
    };
    const handleDismissRejection = async () => {
        try {
            setTicketData((prev: any) => ({
                ...prev,
                pagoRechazado: null
            }));
            const { error } = await supabase
                .from('tickets')
                .update({ 
                    metadata: sanitizeTicketMetadata({ 
                        ...(ticketData.metadata || {}), 
                        pagoRechazado: null,
                        mensajeRechazo: null,
                        motivoRechazo: null 
                    }) 
                })
                .eq('id', ticketData.id);
            if (error) throw error;
            showToast("Observación Archivada", "Ya puede generar una nueva solicitud.", "success");
        } catch (err) {
            console.error("Error dismiss rejection:", err);
            showToast("Error", "No se pudo archivar la observación.", "error");
        }
    };
    const handleProceedToAssignment = () => {
        setShowAssignmentDrawer(true);
    };
    const handleFieldEvidenceUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            const rawFiles = Array.from(e.target.files);
            try {
                const compressedFiles = await Promise.all(
                    rawFiles.map(file => compressImage(file))
                );
                const uploadPromises = compressedFiles.map(async (file) => {
                    const fileExt = file.name.split('.').pop() || 'jpg';
                    const fileName = `${ticketData.id}_field_${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${fileExt}`;
                    const { data, error } = await supabase.storage
                        .from('evidencias')
                        .upload(fileName, file, {
                            contentType: file.type,
                            upsert: true
                        });
                    if (error) {
                        console.error('[Storage Field Evidence Upload Error]:', error.message);
                        throw error;
                    }
                    const { data: urlData } = supabase.storage
                        .from('evidencias')
                        .getPublicUrl(fileName);
                    return {
                        url: urlData.publicUrl,
                        name: file.name,
                        type: file.type,
                        fecha: new Date().toISOString()
                    };
                });
                const results = await Promise.all(uploadPromises);
                setEvidenciasCampo(prev => [...prev, ...results]);
                showToast("Éxito", "Evidencias de campo subidas correctamente.", "success");
            } catch (err: any) {
                console.error("Error al subir evidencias de campo:", err);
                alert("No se pudieron subir las evidencias de campo: " + (err.message || err));
            }
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
        if (!diagnosis) {
            showToast("Diagnóstico Requerido", "Por favor ingrese el diagnóstico técnico antes de enviar.", "error");
            return;
        }
        const mo = parseFloat(laborCost) || 0;
        const mat = modalidad === 'todo_costo' ? 0 : (parseFloat(materialsCost) || 0);
        if (mo + mat <= 0) {
            showToast("Costo Requerido", "El monto total a cobrar (Mano de Obra + Materiales) debe ser mayor a cero para generar el reporte.", "error");
            return;
        }
        const reportData = {
            ...ticketData,
            diagnosis,
            labor_cost: round2(mo),
            materials_cost: modalidad === 'todo_costo' ? 0 : round2(mat),
            modalidad,
            evidenciasCampo: evidenciasCampo,
            status_id: "en_cotizacion",
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
        const currentDraft = quotationDraftRef.current;
        const currentPartidas = currentDraft?.items || partidasCotización;
        const currentMontoTotal = currentDraft?.total ?? totalQuotedAmount;
        const editorTotal = currentPartidas.reduce((s: any, i: any) => s + (Number(i.total) || 0), 0);
        if (isBCP) {
            if (!bcpQuotationFile) {
                showToast("Archivo Faltante", "Debe adjuntar la plantilla Excel BCP antes de enviar.", "error");
                return;
            }
        } else {
            if (currentPartidas.length === 0 || editorTotal <= 0) {
                showToast("Partidas Vacías", "Debe ingresar el detalle y precio de las partidas en la cotización antes de enviarla.", "error");
                return;
            }
            if (quotationEditorRef.current) {
                try {
                    await quotationEditorRef.current.downloadPDF();
                } catch (err) {
                    console.error("Error al descargar PDF:", err);
                }
            }
        }
        setIsSendingQuote(true);
        try {
            const updated = {
                ...ticketData,
                status_id: "cotizacion_enviada",
                fechaCotización: new Date().toISOString(),
                partidas: currentPartidas,
                total_quoted_amount: currentMontoTotal,
                labor_cost: parseFloat(laborCost) || 0,
                materials_cost: parseFloat(materialsCost) || 0,
                montoFinal: currentMontoTotal,
                montoSubtotal: round2(currentMontoTotal / 1.18),
                montoIGV: round2(currentMontoTotal - round2(currentMontoTotal / 1.18)),
                pausadoSLA: true,
                fechaPausa: new Date().toISOString(),
                archivoCotizaciónBCP: isBCP ? bcpQuotationFile : null
            };
            let success = await syncToSupabase(updated);
            if (!success && onUpdate) {
                try {
                    const directUpdates = {
                        status_id: "cotizacion_enviada",
                        total_quoted_amount: currentMontoTotal,
                        labor_cost: parseFloat(laborCost) || 0,
                        materials_cost: parseFloat(materialsCost) || 0,
                        quotation_date: new Date().toISOString(),
                        is_sla_paused: true,
                        sla_pause_date: new Date().toISOString(),
                        metadata: {
                            ...ticketData.metadata,
                            status_id: "cotizacion_enviada",
                            partidas: currentPartidas,
                            montoFinal: currentMontoTotal,
                            montoSubtotal: round2(currentMontoTotal / 1.18),
                            montoIGV: round2(currentMontoTotal - round2(currentMontoTotal / 1.18)),
                            archivoCotizaciónBCP: isBCP ? bcpQuotationFile : null
                        }
                    };
                    await onUpdate(ticketData.id, directUpdates);
                    success = true;
                } catch (fallbackErr) {
                    console.error("Error en fallback de sync:", fallbackErr);
                }
            }
            if (success) {
                setTicketData(updated);
                showToast("Cotización Enviada", isBCP ? "Plantilla BCP registrada." : "Presupuesto formal enviado.", "success");
            } else {
                showToast("Error de Conexión", "No se pudo sincronizar la cotización con el servidor.", "error");
            }
        } catch (err) {
            console.error("Error en handleSendQuote:", err);
            showToast("Error de Conexión", "No se pudo sincronizar la cotización con el servidor.", "error");
        } finally {
            setIsSendingQuote(false);
        }
    };
    const handleApproveQuote = async () => {
        const currentDraft = quotationDraftRef.current;
        const currentPartidas = currentDraft?.items || partidasCotización;
        const currentMontoTotal = currentDraft?.total ?? totalQuotedAmount;
        const previousTicketData = { ...ticketData };
        const approved = {
            ...ticketData,
            status_id: "cotizacion_aprobada",
            fechaAprobación: new Date().toISOString(),
            pausadoSLA: false,
            fechaReactivacion: new Date().toISOString(),
            modificacionAutorizada: false,
            costoAjustadoPostAprobación: false,
            omitirAjusteTécnico: false,
            montoFinal: currentMontoTotal,
            total_quoted_amount: currentMontoTotal,
            labor_cost: parseFloat(laborCost) || 0,
            materials_cost: parseFloat(materialsCost) || 0,
            partidas: currentPartidas
        };
        setTicketData(approved);
        try {
            const success = await syncToSupabase(approved);
            if (success) {
                showToast("Cotización Aprobada", "El ticket ha pasado al estado APROBADA y el presupuesto se ha formalizado.", "success");
            } else {
                setTicketData(previousTicketData);
                showToast("Error de Conexión", "No se pudo sincronizar la aprobación de la cotización con el servidor. Se realizó un rollback al estado anterior.", "error");
            }
        } catch (err) {
            console.error("Error approving quote:", err);
            setTicketData(previousTicketData);
            showToast("Error de Conexión", "No se pudo sincronizar la aprobación de la cotización con el servidor. Se realizó un rollback al estado anterior.", "error");
        }
    };
    const handleReadjustQuote = async () => {
        isTransitioning.current = true;
        isIntentionalRollback.current = true;
        ticketsCache.remove(ticketData.id);
        ticketsCache.invalidate();
        try { localStorage.removeItem(`ticket_state_${ticketData.id}`); } catch(_) {}
        showToast("⏳ Sincronizando Reajuste", "Devolviendo cotización al modo edición...", "info");
        const readjust = {
            ...ticketData,
            status_id: "en_cotizacion",
            pausadoSLA: false,
            fechaReactivacion: new Date().toISOString(),
            modificacionAutorizada: true,
            fechaCotización: null,
            solicitudModificacion: false,
            pagoRechazado: null
        };
        setTicketData(readjust);
        queryClient.setQueryData(
            queryKeys.tickets.summary(),
            (old: any[] | undefined) => old
                ? old.map((t: any) => t.id === ticketData.id
                    ? { ...t, status_id: "en_cotizacion", metadata: { ...(t.metadata || {}), modificacionAutorizada: true } }
                    : t)
                : old
        );
        queryClient.setQueryData(
            queryKeys.tickets.detail(ticketData.id),
            (old: any) => old ? { ...old, status_id: "en_cotizacion", metadata: { ...(old.metadata || {}), modificacionAutorizada: true } } : old
        );
        if (readjust.metadata?.partidas) setPartidasCotización(readjust.metadata.partidas);
        if (readjust.metadata?.total_quoted_amount) setTotalQuotedAmount(readjust.metadata.total_quoted_amount);
        if (readjust.labor_cost) setLaborCost(readjust.labor_cost.toString());
        if (readjust.materials_cost) setMaterialsCost(readjust.materials_cost.toString());
        try {
            setIsSaving(true);
            const success = await syncToSupabase(readjust, { allowStateRollback: true, manual: true });
            if (success) {
                showToast("✅ Reajuste Listo", "La cotización está abierta para edición.", "success");
            } else {
                showToast("Error", "No se pudo revertir la cotización. Intente nuevamente.", "error");
            }
        } catch (err) {
            showToast("Error", "No se pudo revertir la cotización. Intente nuevamente.", "error");
        } finally {
            setIsSaving(false);
            setTimeout(() => {
                isTransitioning.current = false;
                isIntentionalRollback.current = false;
            }, 3000);
        }
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
        if (isSaving) {
            showToast("⏳ Operacion Pendiente", "Por favor espere a que la sincronización termine.", "error");
            return;
        }
        setIsCancelling(true);
        setIsSaving(true);
        try {
            const currentId = ticket.id || ticketData.id;
            const technicianId = ticketData.technician?.id || ticketData.technician_id;
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
            const cancelled = {
                ...ticketData,
                status_id: "ticket_cancelado",
                total_quoted_amount: 0,
                closure_date: new Date().toISOString(),
                metadata: {
                    ...ticketData.metadata,
                    motivoCancelacion: cancelForm.reason,
                    gastoMovilidadAnulacion: mobility
                }
            };
            setTicketData(cancelled);
            const success = await syncToSupabase(cancelled, { manual: true });
            if (success) {
                showToast("Ticket Anulado", mobility > 0 
                    ? `Servicio cancelado. Se registró un egreso de S/ ${mobility.toFixed(2)} por movilidad.`
                    : "Servicio cancelado sin costos asociados.", "info");
            } else {
                showToast("Error", "No se pudo sincronizar la anulación.", "error");
            }
            setShowCancelModal(false);
        } catch (err) {
            console.error("Error cancelling ticket:", err);
            showToast("Error", "No se pudo anular el ticket correctamente.", "error");
        } finally {
            setIsCancelling(false);
            setIsSaving(false);
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
        setIsSaving(true);
        try {
            const success = await syncToSupabase(authorized, { manual: true });
            if (success) {
                showToast("Edición Habilitada", "La cotización ha sido desbloqueada para realizar ajustes.", "info");
            } else {
                showToast("Error", "No se pudo guardar la autorización.", "error");
            }
        } catch (err) {
            console.error("Error authorizing modification:", err);
            showToast("Error", "No se pudo guardar la autorización.", "error");
        } finally {
            setIsSaving(false);
        }
    };
    const handleRequestModification = async () => {
        const requested = {
            ...ticketData,
            solicitudModificacion: true
        };
        setTicketData(requested);
        setIsSaving(true);
        try {
            const success = await syncToSupabase(requested, { manual: true });
            if (success) {
                showToast("Solicitud Enviada", "Se ha solicitado autorización a Gerencia para modificar esta cotización.", "success");
            } else {
                showToast("Error", "No se pudo enviar la solicitud.", "error");
            }
        } catch (err) {
            console.error("Error requesting modification:", err);
            showToast("Error", "No se pudo enviar la solicitud.", "error");
        } finally {
            setIsSaving(false);
        }
    };
    const handleProceedToExecution = () => {
        const updated = {
            ...ticketData,
            status_id: "en_ejecucion",
            fechaInicioEjecucion: new Date().toISOString(),
            montoFinal: totalQuotedAmount,
            partidas: partidasCotización
        };
        setTicketData(updated);
    };
    const handleAdjustTechnicianCost = () => {
        const currentMO = parseFloat(ticketData.labor_cost || 0);
        const currentMAT = parseFloat(ticketData.materials_cost || 0);
        const currentTotal = (currentMO + currentMAT).toFixed(2);
        setNegotiationNewCost(currentTotal);
        setShowNegotiationModal(true);
    };
    const confirmNegotiatedCost = () => {
        if (negotiationNewCost && !isNaN(parseFloat(negotiationNewCost))) {
            const val = parseFloat(negotiationNewCost);
            const currentMO = parseFloat(ticketData.labor_cost || 0);
            const currentMAT = parseFloat(ticketData.materials_cost || 0);
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
        if (confirmAdvanceRef.current) return;
        confirmAdvanceRef.current = true;
        let amount = 0;
        const rawManual = parseFloat(montoAdelantoManual);
        let costoReferencia = 0;
        if (advanceClassification === 'materials') {
            costoReferencia = parseFloat(ticketData.materials_cost || 0);
        } else {
            costoReferencia = finances.pactedMO > 0 ? finances.pactedMO : parseFloat(ticketData.labor_cost || 0);
        }

        if (montoAdelantoManual && !isNaN(rawManual)) {
            amount = rawManual;
        } else {
            const pctReal = ticketData.solicitudAdelanto ? ticketData.solicitudAdelanto.porcentaje : porcentajeAdelanto;
            if (pctReal) {
                amount = costoReferencia * pctReal;
            } else if (ticketData.solicitudAdelanto?.monto) {
                amount = ticketData.solicitudAdelanto.monto;
            }
        }
        if (isNaN(amount) || amount <= 0) {
            showToast("Monto Inválido", "El monto del adelanto debe ser mayor a cero. Seleccione un % o ingrese un monto manual.", "error");
            confirmAdvanceRef.current = false;
            return;
        }
        const isForMaterialsFlag = ticketData.solicitudAdelanto?.classification === 'materials' || advanceClassification === 'materials';
        const totalCostLimit = isForMaterialsFlag 
            ? parseFloat(ticketData.materials_cost || 0) 
            : (finances.pactedMO > 0 ? finances.pactedMO : parseFloat(ticketData.labor_cost || 0));
        const currentSum = isForMaterialsFlag ? finances.operatingExpenses : unifiedPaymentsSum;

        if (currentSum + amount > totalCostLimit + 0.01) {
            showToast("Exceso de Pago", `El pago de S/ ${amount.toFixed(2)} excedería el límite permitido.`, "error");
            confirmAdvanceRef.current = false;
            return;
        }
        const technicianId = ticketData.technician?.id || ticketData.technician_id || ticket.technician_id || ticketData.specialist_id;
        const currentId = ticket.id || ticketData.id;
        if (!technicianId) {
            showToast("Técnico no Asignado", "No se encontró el ID del técnico para registrar el pago.", "error");
            confirmAdvanceRef.current = false;
            return;
        }

        const triggerNotifications = () => {
            const techObj = ticketData.technician || ticketData.technicians;
            const techName = techObj?.name || 
                             [techObj?.first_name, techObj?.last_name].filter(Boolean).join(' ') || 
                             'Técnico';
            const techPhone = techObj?.phone || '';
            const ticketCode = ticketData.client_ticket_number || ticketData.id;
            const clientName = ticketData.clients?.name || 'Cliente';
            const monto = parseFloat(String(amount || 0)).toFixed(2);
            
            // Determinar categoría del abono
            const categoriaMsg = isForMaterials ? 'Materiales' : 'Mano de Obra';

            console.log('[Notifications] Iniciando envío de alertas desde TicketWindow...');

            // Alerta 1: WhatsApp
            const sendWhatsApp = async () => {
                const message = `SINFIMAC NOTIFICACIONES: Hola ${techName}, se ha registrado un depósito de S/. ${monto} por concepto de ${categoriaMsg} para el Ticket ${ticketCode} (${clientName}). Por favor, verifica tu banca móvil.`;
                
                const phoneDigits = (techPhone || '').replace(/\D/g, '');
                const hasValidLength = phoneDigits.length === 9 || (phoneDigits.length === 11 && phoneDigits.startsWith('51'));
                
                if (!techPhone || !techPhone.trim() || !hasValidLength) {
                    console.warn('[Notifications] No se pudo enviar WhatsApp: Técnico sin celular o longitud inválida');
                    try {
                        await supabase.from('notification_logs').insert({
                            ticket_code: ticketCode,
                            recipient_type: 'tecnico',
                            recipient_name: techName,
                            destination: techPhone || 'VACÍO',
                            message_body: message,
                            status: 'error_numero_vacio',
                            error_details: 'El número de celular está vacío o no tiene una longitud válida de 9 u 11 dígitos (con código de país).'
                        });
                    } catch (logErr) {
                        console.error('[Notifications] Error guardando log error_numero_vacio desde TicketWindow:', logErr);
                    }
                    return;
                }
                
                try {
                    const res = await fetch('/api/whatsapp/send', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ phone: techPhone, message })
                    });
                    
                    if (!res.ok) {
                        const errorText = await res.text().catch(() => '');
                        throw new Error(`WhatsApp API responded with status ${res.status}: ${errorText}`);
                    }
                    
                    try {
                        await supabase.from('notification_logs').insert({
                            ticket_code: ticketCode,
                            recipient_type: 'tecnico',
                            recipient_name: techName,
                            destination: techPhone,
                            message_body: message,
                            status: 'enviado'
                        });
                    } catch (logErr) {
                        console.error('[Notifications] Error guardando log enviado desde TicketWindow:', logErr);
                    }
                    
                    return res.json();
                } catch (err: any) {
                    console.error('[Notifications] Error al enviar WhatsApp desde TicketWindow:', err);
                    try {
                        await supabase.from('notification_logs').insert({
                            ticket_code: ticketCode,
                            recipient_type: 'tecnico',
                            recipient_name: techName,
                            destination: techPhone,
                            message_body: message,
                            status: 'fallido',
                            error_details: err?.message || String(err)
                        });
                    } catch (logErr) {
                        console.error('[Notifications] Error guardando log fallido desde TicketWindow:', logErr);
                    }
                    throw err;
                }
            };

            // Alerta 2: Supabase Realtime Broadcast a la Gestora
            const sendBroadcast = async () => {
                const gestoraId = ticketData.gestora_id;
                const gestoraObj = ticketData.gestora || ticketData.gestoras;
                const gestoraName = gestoraObj?.name || 'Gestora';
                const broadcastMessage = `Broadcast new_deposit: S/. ${monto} para el Ticket ${ticketCode}`;
                
                if (!gestoraId) {
                    console.warn('[Notifications] No se pudo enviar Broadcast: Ticket sin gestora asignada');
                    try {
                        await supabase.from('notification_logs').insert({
                            ticket_code: ticketCode,
                            recipient_type: 'gestora',
                            recipient_name: gestoraName,
                            destination: 'SIN_ASIGNAR',
                            message_body: broadcastMessage,
                            status: 'error_numero_vacio',
                            error_details: 'Ticket sin gestora asignada.'
                        });
                    } catch (logErr) {
                        console.error('[Notifications] Error guardando log broadcast vacío desde TicketWindow:', logErr);
                    }
                    return;
                }
                
                try {
                    const channel = supabase.channel('realtime:deposits');
                    await channel.send({
                        type: 'broadcast',
                        event: 'new_deposit',
                        payload: {
                            monto,
                            codigo_ticket: ticketCode,
                            gestora_id: gestoraId
                        }
                    });
                    
                    try {
                        await supabase.from('notification_logs').insert({
                            ticket_code: ticketCode,
                            recipient_type: 'gestora',
                            recipient_name: gestoraName,
                            destination: gestoraId,
                            message_body: broadcastMessage,
                            status: 'enviado'
                        });
                    } catch (logErr) {
                        console.error('[Notifications] Error guardando log broadcast enviado desde TicketWindow:', logErr);
                    }
                } catch (err: any) {
                    console.error('[Notifications] Error al enviar Broadcast desde TicketWindow:', err);
                    try {
                        await supabase.from('notification_logs').insert({
                            ticket_code: ticketCode,
                            recipient_type: 'gestora',
                            recipient_name: gestoraName,
                            destination: gestoraId,
                            message_body: broadcastMessage,
                            status: 'fallido',
                            error_details: err?.message || String(err)
                        });
                    } catch (logErr) {
                        console.error('[Notifications] Error guardando log broadcast fallido desde TicketWindow:', logErr);
                    }
                }
            };

            Promise.allSettled([sendWhatsApp(), sendBroadcast()]).then((results) => {
                console.log('[Notifications] Alertas finalizadas desde TicketWindow con resultados:', results);
            });
        };
        const pendingRequest = ticketData.solicitudAdelanto;
        const isForMaterials = pendingRequest?.classification === 'materials' || advanceClassification === 'materials';
        if (isAdmin) {
            const matchingPendingCost = ticketCosts.find((cost: any) => {
                const status = (cost.estado_pago || '').toUpperCase();
                const text = `${cost.categoria || ''} ${cost.concepto || ''}`.toLowerCase();
                const sameAmount = Math.abs((parseFloat(cost.monto || 0) || 0) - amount) < 0.01;
                const sameKind = isForMaterials
                    ? (text.includes('material') || text.includes('operativo'))
                    : (text.includes('mano de obra') || text.includes('adelanto') || text.includes('rescate financiero'));
                return status === 'PENDIENTE' && sameAmount && sameKind;
            });
            if (matchingPendingCost?.id) {
                const newState = ticketData.status_id === 'cotizacion_aprobada' ? 'en_ejecucion' : ticketData.status_id;
                setIsConfirmingPayment(true);
                isProcessingAdvance.current = true;
                isTransitioning.current = true;
                try {
                    await ticketCostsAPI.update(matchingPendingCost.id, {
                        estado_pago: 'pagado',
                        solicitado_por: myProfileId || undefined
                    });
                    const patchResult = await ticketsAPI.patchMetadata(ticketData.id, { solicitudAdelanto: null }, { status_id: newState });
                    if (!patchResult) {
                        throw new Error('API rejected metadata patch');
                    }
                    setTicketData((prev: any) => ({
                        ...prev,
                        estadoId: newState,
                        status_id: newState,
                        adelantoPagado: !isForMaterials || prev.adelantoPagado,
                        solicitudAdelanto: null,
                        metadata: {
                            ...(prev.metadata || {}),
                            solicitudAdelanto: null,
                        },
                    }));
                    localStorage.removeItem(`ticket_state_${ticketData.id}`);
                    setTicketCosts((prev: any[]) => 
                        prev.map((c: any) => c.id === matchingPendingCost.id ? { ...c, estado_pago: 'pagado' } : c)
                    );
                    setAdvanceRefreshKey((k: number) => k + 1);
                    await loadCosts();
                    setMontoAdelantoManual("");
                    setPorcentajeAdelanto(null);
                    showToast("Adelanto Confirmado", `Se ha registrado el depósito de S/ ${amount.toFixed(2)}.`, "success");
                    triggerNotifications();
                } catch (err: any) {
                    console.error("Error confirming pending advance:", err);
                    const isBadRequest = err?.message?.includes('400') || err?.message?.includes('rejected') || err?.message?.includes('API rejected');
                    const message = err instanceof DuplicateTicketCostError
                        ? "Ya existe un pago confirmado con el mismo ticket, monto y concepto."
                        : isBadRequest
                            ? "El servidor rechó la actualización. Verifica los datos e intenta de nuevo."
                            : "No se pudo confirmar el adelanto pendiente.";
                    showToast("Error de Conexión", message, "error");
            isTransitioning.current = false;
                    isTransitioning.current = false;
                } finally {
                    setIsConfirmingPayment(false);
                    confirmAdvanceRef.current = false;
                    setTimeout(() => { isTransitioning.current = false; }, 1500);
                    setTimeout(() => { isProcessingAdvance.current = false; }, 3000);
                }
                return;
            }
        }
        setIsConfirmingPayment(true);
        isProcessingAdvance.current = true;
        isTransitioning.current = true;
        try {
            const newState = ticketData.status_id === 'cotizacion_aprobada' ? 'en_ejecucion' : ticketData.status_id;
            const category = isForMaterials ? "Materiales" : "Mano de Obra";
            const conceptPrefix = isForMaterials ? "Adelanto Operativo (MATERIALES)" : "Adelanto Operativo (MANO DE OBRA)";
            const createResult = await ticketCostsAPI.create({
                ticket_id: currentId,
                concepto: conceptPrefix,
                categoria: category,
                specialist_id: technicianId,
                monto: amount,
                estado_pago: "pagado",
                solicitado_por: myProfileId || undefined
            });
            if (!createResult) {
                throw new Error('API rejected cost creation');
            }
            const patchResult = await ticketsAPI.patchMetadata(ticketData.id, { solicitudAdelanto: null }, { status_id: newState });
            if (!patchResult) {
                throw new Error('API rejected metadata patch');
            }
            const updated = {
                ...ticketData,
                estadoId: newState,
                status_id: newState,
                adelantoPagado: !isForMaterials || ticketData.adelantoPagado,
                solicitudAdelanto: null,
                metadata: {
                    ...(ticketData.metadata || {}),
                    solicitudAdelanto: null,
                },
            };
            setTicketData(updated);
            localStorage.removeItem(`ticket_state_${ticketData.id}`);
            await loadCosts();
            setMontoAdelantoManual("");
            setPorcentajeAdelanto(null);
            showToast("Depósito Confirmado", `Adelanto de S/ ${amount.toFixed(2)} registrado exitosamente.`, "success");
            triggerNotifications();
        } catch (err) {
            console.error("Error registering pending advance:", err);
            const message = err instanceof DuplicateTicketCostError
                ? "Ya existe un pago confirmado con el mismo ticket, monto y concepto."
                : "No se pudo registrar la solicitud de adelanto.";
            showToast("Error de Conexión", message, "error");
            isTransitioning.current = false;
        } finally {
            setIsConfirmingPayment(false);
            confirmAdvanceRef.current = false;
            setTimeout(() => { isTransitioning.current = false; }, 1500);
            setTimeout(() => { isProcessingAdvance.current = false; }, 3000);
        }
    };
    const handleRequestAdvance = async () => {
        if (isSubmittingAdvance) return;
        const currentStageOrder = TICKET_STATE_ORDER[ticketData.status_id] || 0;
        if (currentStageOrder < 7) {
            setRiskAlert({
                show: true,
                title: "⚠️ RIESGO FINANCIERO DETECTADO",
                message: "Esta cotización aún no ha sido aprobada por el cliente. Realizar una solicitud de adelanto en esta fase representa un riesgo para la rentabilidad de la empresa. ¿Desea proceder bajo su responsabilidad?",
                onConfirm: () => {
                    setRiskAlert(prev => ({ ...prev, show: false }));
                    executeRequestAdvance();
                }
            });
            return;
        }
        executeRequestAdvance();
    };
    const executeRequestAdvance = async () => {
        const txToken = generateTransactionToken();
        advanceTransactionToken.current = txToken;
        setIsSubmittingAdvance(true);
        let amount = 0;
        let pctVal = 0;
        const rawManual = parseFloat(montoAdelantoManual);
        let costRef = 0;
        if (advanceClassification === 'materials') {
            costRef = parseFloat(ticketData.materials_cost || 0);
        } else {
            costRef = finances.pactedMO > 0 ? finances.pactedMO : parseFloat(ticketData.labor_cost || 0);
        }

        if (montoAdelantoManual && !isNaN(rawManual)) {
            amount = rawManual;
            pctVal = costRef > 0 ? amount / costRef : 0;
        } else if (porcentajeAdelanto) {
            amount = costRef * porcentajeAdelanto;
            pctVal = porcentajeAdelanto;
        }
        if (isNaN(amount) || amount <= 0) {
            showToast("Monto Inválido", "Por favor ingrese un monto válido mayor a cero.", "error");
            advanceTransactionToken.current = null;
            setIsSubmittingAdvance(false);
            return;
        }
        const technicianId = ticketData.technician?.id || ticketData.technician_id || ticket.technician_id || ticketData.specialist_id;
        const currentId = ticketData.id;
        if (!technicianId) {
            showToast("Técnico no Asignado", "Debe asignar un técnico antes de solicitar un adelanto.", "error");
            advanceTransactionToken.current = null;
            setIsSubmittingAdvance(false);
            return;
        }
        isProcessingAdvance.current = true;
        let advanceCreated = false;
        try {
            const isForMaterials = advanceClassification === 'materials';
            const category = isForMaterials ? "Materiales" : "Mano de Obra";
            const concepto = isForMaterials
                ? "Adelanto Operativo (MATERIALES)"
                : "Adelanto Operativo (MANO DE OBRA)";
            try {
                const existingCosts = await ticketCostsAPI.getByTicket(currentId);
                const tokenAlreadyProcessed = (existingCosts || []).some(
                    (c: any) => c.transaction_token === txToken
                );
                if (tokenAlreadyProcessed) {
                    advanceCreated = true;
                    console.warn('[executeRequestAdvance] Token ya procesado:', txToken);
                } else {
                    if (advanceTransactionToken.current !== txToken) {
                        console.warn('[executeRequestAdvance] Token invalidado por operación más reciente. Abortando.');
                        return;
                    }
                    await ticketCostsAPI.create({
                        ticket_id: currentId,
                        concepto,
                        categoria: category,
                        specialist_id: technicianId,
                        monto: amount,
                        estado_pago: 'pendiente',
                        transaction_token: txToken,
                        solicitado_por: myProfileId || undefined
                    });
                    advanceCreated = true;
                }
            } catch (costErr: any) {
                console.error('Error creando ticket_cost:', costErr);
                if (costErr?.message?.includes('400') || costErr?.message?.includes('Duplicate') || costErr?.message?.includes('transaction_token')) {
                    showToast('Solicitud Duplicada', 'Esta solicitud ya fue registrada. Espere la respuesta de Tesorería.', 'info');
                    advanceTransactionToken.current = null;
                    setIsSubmittingAdvance(false);
                    return;
                }
                console.warn('Continuando sin ticket_cost, usando solo metadata...');
            }
            const metadataUpdates = {
                pagoRechazado: null,
                riesgoFinanciero: (TICKET_STATE_ORDER[ticketData.status_id] || 0) < 7 ? true : ticketData.metadata?.riesgoFinanciero,
                solicitudAdelanto: !advanceCreated ? {
                    monto: amount,
                    porcentaje: pctVal,
                    fecha: new Date().toISOString(),
                    categoria: category,
                    concepto: concepto
                } : null,
            };
            const updated = {
                ...ticketData,
                solicitudAdelanto: !advanceCreated ? metadataUpdates.solicitudAdelanto : null,
                pagoRechazado: null,
                metadata: {
                    ...(ticketData.metadata || {}),
                    ...metadataUpdates,
                }
            };
            setTicketData(updated);
            localStorage.removeItem(`ticket_state_${ticketData.id}`);
            try {
                await ticketsAPI.patchMetadata(ticketData.id, metadataUpdates);
            } catch (metaErr: any) {
                console.error("Error actualizando metadata:", metaErr);
                try {
                    await ticketsAPI.update(ticketData.id, {
                        metadata: updated.metadata
                    });
                } catch (fallbackErr) {
                    console.error("Error en fallback update:", fallbackErr);
                }
            }
            await loadCosts();
            await new Promise(resolve => setTimeout(resolve, 1200));
            setMontoAdelantoManual("");
            setPorcentajeAdelanto(null);
            showToast("Solicitud Enviada", `Se ha solicitado el adelanto de S/ ${amount.toFixed(2)}.`, "success");
        } catch (err: any) {
            console.error("Error general en executeRequestAdvance:", err);
            const message = err?.message || "No se pudo registrar la solicitud.";
            showToast("Error", message, "error");
        } finally {
            advanceTransactionToken.current = null;
            setIsSubmittingAdvance(false);
            setTimeout(() => { isProcessingAdvance.current = false; }, 3000);
        }
    };
    const handleRequestFinalLiquidation = () => {
        // ✅ CANDADO 1 (UI): validar client_ticket_number antes de abrir el modal de confirmación.
        // isSantander exime de este requisito (su número STD ya lo captura el sistema).
        if (!isSantander && !isClientTicketFormatValid(ticketData.client_ticket_number)) {
            showToast(
                "Número de Ticket Obligatorio",
                "Debe ingresar y guardar un número de ticket del cliente válido (Formato: MB000000.26) antes de pasar a liquidación.",
                "error"
            );
            return;
        }
        setShowLiquidationConfirm(true);
    };
    const handleActualLiquidation = async () => {
        // =====================================================================
        // 🔐 RACE CONDITION GUARD: Disable button IMMEDIATELY to prevent double-clicks
        // =====================================================================
        if (isSubmittingLiquidation || isSavingNegotiation) {
            console.warn('[handleActualLiquidation] Doble clic detectado. Abortando.');
            return;
        }
        
        // ✅ CANDADO 2 (Server-side): segunda línea de defensa por si el modal se abrió por otro flujo.
        if (!isSantander && !isClientTicketFormatValid(ticketData.client_ticket_number)) {
            showToast(
                "Bloqueo de Seguridad",
                "No se puede liquidar sin un número de ticket del cliente válido. Regrese a DOCUMENTACIÓN e ingrese el código MB.",
                "error"
            );
            setShowLiquidationConfirm(false);
            return;
        }
        const txToken = generateTransactionToken();
        liquidationTransactionToken.current = txToken;
        setIsSavingNegotiation(true);
        setIsSubmittingLiquidation(true);
        setShowLiquidationConfirm(false);
        isTransitioning.current = true;
        try {
            const amount = finances.netLaborBalance;
            const costRef = finances.pactedMO;
            if (amount <= 0 && costRef > 0 && finances.totalLaborConfirmed < costRef) {
                console.warn("[Liquidación] Saldo 0 con deuda pactada. Revisar costos.");
            }
            const isExceeding = (finances.totalLaborConfirmed + amount > costRef + 1);
            const newState = isExceeding ? "requiere_revision_admin" : "por_liquidar";
            const currentTicketId = ticketData.id;
            const technicianId = ticketData.technician?.id || ticketData.technician_id || ticket.technician_id;
            let costCreated = false;
            try {
                if (amount > 0.01 && technicianId) {
                    if (liquidationTransactionToken.current !== txToken) {
                        console.warn('[handleActualLiquidation] Token invalidado. Abortando para evitar duplicado.');
                        return;
                    }
                    const existingCosts = await ticketCostsAPI.getByTicket(currentTicketId);
                    const tokenAlreadyProcessed = (existingCosts || []).some(
                        (c: any) => c.transaction_token === txToken
                    );
                    if (tokenAlreadyProcessed) {
                        costCreated = true;
                        console.warn('[handleActualLiquidation] Token ya procesado (idempotente):', txToken);
                    } else {
                        await ticketCostsAPI.create({
                            ticket_id: currentTicketId,
                            monto: amount,
                            categoria: 'Mano de Obra',
                            concepto: 'Liquidación Final - Saldo de Mano de Obra',
                            specialist_id: technicianId,
                            estado_pago: isExceeding ? 'REQUIERE_APROBACION_ADMIN' : 'pendiente',
                            transaction_token: txToken,
                            solicitado_por: myProfileId || undefined
                        });
                        costCreated = true;
                        console.log('[handleActualLiquidation] ticket_cost creado OK:', { amount, newState, txToken });
                    }
                }
            } catch (costErr) {
                console.warn("[handleActualLiquidation] Error creando ticket_cost:", costErr);
                throw costErr;
            }
            const solicitudLiquidacionMeta = costCreated ? null : {
                fecha: new Date().toISOString(),
                monto: amount,
                excedeTope: isExceeding
            };
            
            // =====================================================================
            // 🔥 PASO 1: CÁLCULOS FRESCOS EN TIEMPO REAL (Evitar Stale Closures)
            // =====================================================================
            // Inyectar calculateTicketFinances con los costos actuales para 
            // garantizar que saldo_tecnico, netLaborBalance y final_balance
            // se calculen con datos reales de la DB, no con estado congelado.
            // Esto soluciona el bug donde metadata.stale sobreescribía el saldo.
            // =====================================================================
            const freshFinances = calculateTicketFinances(ticketData, ticketCosts);
            const guaranteedNetBalance = freshFinances.netLaborBalance ?? 0;
            
            const finalMetadata = {
                ...(ticketData.metadata || {}),
                solicitudLiquidacion: solicitudLiquidacionMeta,
                isAdminRevision: isExceeding,
                estadoId: newState,
                // ✅ Forzar valores frescos del motor financiero (no stale closures)
                saldo_tecnico: guaranteedNetBalance,       // Garantiza 0 real si corresponde
                netLaborBalance: guaranteedNetBalance,     // Alias para compatibilidad
                totalLaborConfirmed: freshFinances.totalLaborConfirmed,
                totalVenta: freshFinances.totalVenta,
                utilidad_neta: freshFinances.realProfitability,
                margen_real: freshFinances.margenReal,
            };
            
            // =====================================================================
            // 🔄 PASO 2: PERSISTENCIA ATÓMICA CON MATEMÁTICA FRESCA
            // =====================================================================
            // Preparar el objeto actualizado con valores financieros recalculados
            // y enviar ATÓMICAMENTE junto con el cambio de estado a syncToSupabase.
            // =====================================================================
            const updated = {
                ...ticketData,
                estadoId: newState,
                status_id: newState,
                final_balance: guaranteedNetBalance,  // Usar el saldo garantizado, no 'amount'
                solicitudLiquidacion: solicitudLiquidacionMeta,
                metadata: finalMetadata
            };
            
            // ✅ Update síncrono del estado local ANTES del sync atómico
            setTicketData(updated);
            
            // ✅ Sync atómico que incluye client_ticket_number + status_id en un solo envío
            const syncSuccess = await syncToSupabase(updated, { allowStateRollback: true, manual: true });
            
            if (!syncSuccess) {
                console.error("[handleActualLiquidation] syncToSupabase retornó false. Ticket puede no estar persistido.");
            }
            
            try {
                await loadCosts();
            } catch (loadErr) {
                console.warn("[handleActualLiquidation] Error recargando costos:", loadErr);
            }
            showToast(
                isExceeding ? "Revisión Requerida" : "Liquidación Solicitada",
                isExceeding
                    ? "El monto excede el costo pactado. Se ha enviado a revisión del administrador."
                    : "La solicitud ha sido enviada a la bandeja de pagos del administrador.",
                isExceeding ? "info" : "success"
            );
        } catch (err) {
            console.error("Error in liquidation request:", err);
            showToast("Error", "No se pudo procesar la liquidación. Intente nuevamente.", "error");
        } finally {
            setIsSavingNegotiation(false);
            setIsSubmittingLiquidation(false);
            liquidationTransactionToken.current = null;
            setTimeout(() => { isTransitioning.current = false; }, 3000);
        }
    };
    const handleFinishExecution = () => {
        if (evidenciasEjecucion.length < 1) {
            showToast("Evidencia Mandataria", "Debe adjuntar al menos 1 foto de la ejecución del trabajo.", "error");
            return;
        }
        const updated = {
            ...ticketData,
            status_id: "documentacion_enviada",
            fechaFinEjecucion: new Date().toISOString(),
            gastos: gastos,
            evidenciasEjecucion: evidenciasEjecucion,
            evidenciasCampo: ticketData.evidenciasCampo || [],
            evidencias: ticketData.evidencias || [],
            total_quoted_amount: totalQuotedAmount,
            partidas: partidasCotización
        };
        setTicketData(updated);
        syncToSupabase(updated);
        showToast("¡Ejecución Finalizada!", "Se ha generado el expediente del servicio correctamente.", "success");
    };
    const handleApproveBudgetExceed = () => {
        setShowExceedApprovalConfirm(true);
    };
    const handleActualExceedApproval = async () => {
        if (!isSantander && !isClientTicketFormatValid(ticketData.client_ticket_number)) {
            showToast("Error de Control", "No se puede liberar el ticket sin un número válido de MiBanco (Formato: MB000000.26).", "error");
            setShowExceedApprovalConfirm(false);
            return;
        }
        setIsSavingNegotiation(true);
        setShowExceedApprovalConfirm(false);
        try {
            const newMetadata = {
                ...(ticketData.metadata || {}),
                excepcionPresupuestoAprobada: true,
                fechaAprobacionExcepcion: new Date().toISOString(),
                aprobadoPor: myProfileId,
                isAdminRevision: false,
                is_frozen: false // Asegurar limpieza de bandera si existe
            };
            const updated = {
                ...ticketData,
                status_id: "por_liquidar",
                metadata: newMetadata
            };
            setTicketData(updated);
            if (onUpdate) {
                const result = await onUpdate(ticketData.id, { 
                    status_id: "por_liquidar",
                    metadata: newMetadata
                });
                if (result) {
                    setTicketData((prev: any) => ({ ...prev, ...result, status_id: "por_liquidar" }));
                }
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
                status_id: 'nuevo',
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
        if (!rawFiles || rawFiles.length === 0) return;
        const files = Array.from(rawFiles);
        try {
            const compressedFiles = await Promise.all(
                files.map(file => compressImage(file))
            );
            const uploadPromises = compressedFiles.map(async (file) => {
                const fileExt = file.name.split('.').pop() || 'jpg';
                const fileName = `${ticketData.id}_${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${fileExt}`;
                const { data, error } = await supabase.storage
                    .from('evidencias')
                    .upload(fileName, file, {
                        contentType: file.type,
                        upsert: true
                    });
                if (error) {
                    console.error('[Storage Upload Error]:', error.message);
                    throw error;
                }
                const { data: urlData } = supabase.storage
                    .from('evidencias')
                    .getPublicUrl(fileName);
                return {
                    url: urlData.publicUrl,
                    name: file.name,
                    size: file.size,
                    type: file.type
                };
            });
            const uploadedEvidences = await Promise.all(uploadPromises);
            setEvidenciasEjecucion(prev => {
                const updated = [...prev, ...uploadedEvidences];
                setTicketData((current: any) => ({ ...current, evidenciasEjecucion: updated }));
                return updated;
            });
            showToast("Éxito", "Evidencias subidas correctamente.", "success");
        } catch (err: any) {
            console.error("Error al procesar y subir evidencias:", err);
            alert("No se pudieron subir las evidencias: " + (err.message || err));
        }
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
        const currentStageOrder = TICKET_STATE_ORDER[ticketData.status_id] || 0;
        if (currentStageOrder < 7) {
            setRiskAlert({
                show: true,
                title: "⚠️ ALERTA DE COSTO PREMATURO",
                message: "Usted está registrando una compra o gasto operativo antes de la aprobación formal del presupuesto por el cliente. Esto podría generar pérdidas si el ticket es rechazado. ¿Desea continuar?",
                onConfirm: () => {
                    setRiskAlert(prev => ({ ...prev, show: false }));
                    executeSubmitMaterials();
                }
            });
            return;
        }
        executeSubmitMaterials();
    };
    const executeSubmitMaterials = async () => {
        setIsSavingMaterials(true);
        try {
            const montoGasto = parseFloat(materialsForm.monto);
            const excedePresupuesto = (unifiedPaymentsSum + montoGasto > techPactedTotal + 0.01);
            await ticketCostsAPI.create({
                ticket_id: ticket.id,
                monto: montoGasto,
                categoria: materialsForm.categoria || "Materiales",
                concepto: materialsForm.concepto.trim(),
                specialist_id: materialsForm.specialist_id,
                proveedor: materialsForm.specialistName,
                estado_pago: excedePresupuesto ? "REQUIERE_APROBACION_ADMIN" : "pendiente",
                solicitado_por: myProfileId || undefined
            });
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
    const visitPayment = finances.operatingItems
        .filter((c: any) => `${c.categoria || ''} ${c.concepto || ''}`.toLowerCase().includes('visita'))
        .reduce((sum: number, c: any) => round2(sum + (parseFloat(c.monto || 0) || 0)), 0);
    const classicAdvance = finances.laborItems
        .filter((c: any) => `${c.categoria || ''} ${c.concepto || ''}`.toLowerCase().includes('adelanto'))
        .reduce((sum: number, c: any) => round2(sum + (parseFloat(c.monto || 0) || 0)), 0);
    const rentabilidadReal = grossMargin;
    const paymentsSummary = unifiedPaymentsSum;
    const costPercentage = 100 - pctReal;
    const isClientTicketFormatValid = useCallback((num?: string) => {
        if (!num || num.trim() === "") return false;
        if (num.startsWith('STD')) return /^STD\d{4}\.\d{2}$/.test(num);
        if (num.startsWith('#')) return true; 
        return /^MB[A-Z0-9]{6}\.\d{2}$/.test(num);
    }, []);
    const capitalExposed = finances.totalExpenses;
    const handleCloseInternal = () => {
        if (isSaving) {
            showToast("⏳ Operacion Pendiente", "Por favor espere a que la sincronización termine.", "error");
            return;
        }
        syncToSupabase().catch(err => console.error("Sync error on close:", err));
        if (['ticket_cerrado', 'liquidado', 'cerrado'].includes(ticketData.status_id)) {
            localStorage.removeItem(`ticket_state_${ticketData.id}`);
            localStorage.removeItem(`ticket_ui_${ticketData.id}`);
        }
        onClose();
    };
    const handleCompleteClosure = async () => {
        if (isSaving) {
            showToast("⏳ Operacion Pendiente", "Por favor espere a que la sincronización termine.", "error");
            return;
        }

        // PASO 1: Inyección del Guardián de Consistencia Matemática
        const freshFinances = calculateTicketFinances(ticketData, ticketCosts);
        if (freshFinances.netLaborBalance !== 0) {
            const diff = freshFinances.netLaborBalance;
            showToast(
                "❌ Descuadre de Saldo", 
                `No se puede realizar el cierre definitivo. Saldo técnico descuadrado: S/. ${diff.toFixed(2)}. Debe ser S/. 0.00.`, 
                "error"
            );
            alert(`No se puede realizar el cierre definitivo. Saldo técnico descuadrado: S/. ${diff.toFixed(2)}. Debe ser S/. 0.00.`);
            return;
        }

        setIsSaving(true);
        try {
            // PASO 2: Mutación y Payload de Cierre Real
            const updatedTicketData = {
                ...ticketData,
                estadoId: "ticket_cerrado",
                status_id: "ticket_cerrado",
                fechaCierre: new Date().toISOString(),
                closure_date: isRetroactiveClosure ? new Date(retroactiveDate + "-05:00").toISOString() : undefined,
                saldo_tecnico: 0,
                metadata: {
                    ...(ticketData.metadata || {}),
                    saldo_tecnico: 0,
                    netLaborBalance: 0
                }
            };
            localStorage.removeItem(`ticket_state_${ticketData.id}`);
            localStorage.removeItem(`ticket_ui_${ticketData.id}`);
            setTicketData(updatedTicketData);
            
            const success = await syncToSupabase(updatedTicketData, { manual: true });
            if (success) {
                showToast("Ticket Cerrado", "El ticket ha sido cerrado y archivado correctamente.", "success");
                
                // PASO 2.5: Inyectar síncronamente la creación de factura (CFO)
                try {
                    const terms = ticketData.cliente?.default_payment_terms || 30;
                    const dueDate = new Date();
                    dueDate.setDate(dueDate.getDate() + terms);
                    
                    const invoicePayload = {
                        ticket_id: ticketData.id,
                        client_id: ticketData.client_id,
                        amount_base: freshFinances.totalVenta / 1.18, // Added amount_base
                        amount_total: freshFinances.totalVenta,
                        amount_igv: freshFinances.totalVenta * 0.18,
                        status: 'emitida',
                        due_date: dueDate.toISOString(),
                        issued_date: new Date().toISOString()
                    };
                    
                    const { error: invoiceErr } = await supabase.from('invoices').insert([invoicePayload]);
                    if (invoiceErr) console.error("Error creating CFO invoice:", invoiceErr);
                } catch (e) {
                    console.error("CFO Sync Error:", e);
                }

                // PASO 3: Disparar el Broadcast de Actualización de Métricas del Dashboard
                try {
                    const channel = supabase.channel('realtime:dashboard_metrics');
                    await channel.send({
                        type: 'broadcast',
                        event: 'ticket_closed_balance_zero',
                        payload: {
                            codigo_ticket: ticketData.client_ticket_number || ticketData.id,
                            gestora_id: ticketData.gestora_id,
                            montoNetoTransferido: freshFinances.netLaborBalance,
                            grossProductivity: freshFinances.totalVenta
                        }
                    });
                } catch (broadcastErr) {
                    console.error("Error sending realtime broadcast:", broadcastErr);
                }

                onClose();
            } else {
                showToast("Error", "No se pudo cerrar el ticket.", "error");
            }
        } catch (err) {
            console.error("Error al cerrar ticket:", err);
            showToast("Error", "No se pudo cerrar el ticket.", "error");
        } finally {
            setIsSaving(false);
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
        if (isExceeding && !rescueForm.motivo.trim()) {
            showToast("Motivo Obligatorio", "Para solicitudes que exceden el saldo pactado, debe indicar el motivo detallado.", "error");
            return;
        }
        const currentStageOrder = TICKET_STATE_ORDER[ticketData.status_id] || 0;
        if (currentStageOrder < 7) {
            setRiskAlert({
                show: true,
                title: "⚠️ ALERTA DE RESCATE FINANCIERO",
                message: "La cotización no ha sido aprobada por el cliente. Solicitar un rescate financiero ahora es prematuro y riesgoso. ¿Está seguro de autorizar esta solicitud?",
                onConfirm: () => {
                    setRiskAlert(prev => ({ ...prev, show: false }));
                    executeSubmitRescue(montoNum, isExceeding);
                }
            });
            return;
        }
        executeSubmitRescue(montoNum, isExceeding);
    };
    const executeSubmitRescue = async (montoNum: number, isExceeding: boolean) => {
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
            if ((TICKET_STATE_ORDER[ticketData.status_id] || 0) < 7) {
                await supabase.from('tickets').update({
                    metadata: sanitizeTicketMetadata({ ...ticketData.metadata, riesgoFinanciero: true })
                }).eq('id', ticketData.id);
            }
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
    const totalPactadoTecnico = pactedMO;
    const totalAdelantadoAlTecnico = finances.totalLaborConfirmed + finances.totalLaborPending;
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
                                            (ticketData.client_ticket_number
                                                ? ticketData.client_ticket_number
                                                : `Ticket #${ticketData.id.slice(-6)}`)
                                        }
                                    </h3>
                                    <span>
                                        {ticket.cliente?.nombre || 'Sin cliente'} 
                                        <span style={{ 
                                            opacity: 1, 
                                            fontSize: '0.65rem', 
                                            marginLeft: '8px',
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: '6px',
                                            background: isRealtimeConnected ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.1)',
                                            color: isRealtimeConnected ? '#10B981' : '#ef4444',
                                            padding: '3px 8px',
                                            borderRadius: '20px',
                                            fontWeight: 800,
                                            border: `1px solid ${isRealtimeConnected ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                                            transition: 'all 0.3s ease',
                                            boxShadow: isRealtimeConnected ? '0 0 10px rgba(16, 185, 129, 0.2)' : 'none'
                                        }}>
                                            <span style={{ 
                                                width: '8px', 
                                                height: '8px', 
                                                borderRadius: '50%', 
                                                backgroundColor: isRealtimeConnected ? '#10B981' : '#ef4444',
                                                boxShadow: isRealtimeConnected ? '0 0 8px #10B981' : 'none',
                                                animation: isRealtimeConnected ? 'pulse-green 2s infinite' : 'none'
                                            }} />
                                            {isRealtimeConnected ? 'CONECTADO' : 'DESCONECTADO'}
                                        </span>
                                        <style dangerouslySetInnerHTML={{ __html: `
                                            @keyframes pulse-green {
                                                0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7); }
                                                70% { transform: scale(1); box-shadow: 0 0 0 6px rgba(16, 185, 129, 0); }
                                                100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); }
                                            }
                                        `}} />
                                    </span>
                                </div>
                            </>
                        ) : (
                            <div className={styles.titleInfoMinimized}>
                                <h3 className={styles.minimizedTicketNumber}>
                                    {ticket.client_ticket_number
                                        ? ticket.client_ticket_number
                                        : `TKT-${ticket.id.slice(-6).toUpperCase()}`
                                    }
                                </h3>
                            </div>
                        )}
                    </div>
                    {!isMinimized && (
                        <SLATimerHeader ticket={ticketData} />
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
                                currentStateId={ticketData.status_id || "nuevo"}
                            />
                        </div>
                        <div className={styles.infoHistory}>
                            {useMemo(() => (
                                <>
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
                                        onReassign={() => setShowAssignmentDrawer(true)}
                                        onEditSchedule={() => {
                                            setTicketData({ ...ticketData, estadoId: 'en_inspeccion', status_id: 'en_inspeccion', execution_date: undefined });
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
                                </>
                            ), [ticketData, ticketCosts, availableRescue, isQuotationCollapsed, userRole, myGestoraId, isAdmin])}
                        </div>
                        {/* REJECTION BANNER - MOVED ABOVE FOR VISIBILITY */}
                        {ticketData.pagoRechazado && (
                            <div className={styles.rejectionBanner}>
                                <div className={styles.rejectionIcon}><Ban size={24} /></div>
                                <div className={styles.rejectionContent}>
                                    <h4>SOLICITUD DE PAGO DENEGADA</h4>
                                    <p>La solicitud de <strong>{ticketData.pagoRechazado.tipo}</strong> por <strong>S/ {formatSoles(ticketData.pagoRechazado.monto)}</strong> fue denegada.</p>
                                    <div style={{ background: '#FFF1F2', padding: '8px 12px', borderRadius: '8px', borderLeft: '4px solid #E11D48', marginTop: '8px' }}>
                                        <span style={{ color: '#9F1239', fontWeight: 800, fontSize: '11px', display: 'block', marginBottom: '2px' }}>MOTIVO DEL RECHAZO:</span>
                                        <p style={{ margin: 0, color: '#BE123C', fontSize: '13px', fontWeight: 600 }}>
                                            {ticketData.pagoRechazado.motivo || ticketData.pagoRechazado.mensajeRechazo || "No se especificó un motivo."}
                                        </p>
                                    </div>
                                    <span style={{ display: 'block', marginTop: '8px', fontSize: '11px', color: '#64748B' }}>Acción Requerida: Revise las observaciones y genere una nueva solicitud corregida.</span>
                                </div>
                                <button onClick={handleDismissRejection} className={styles.dismissRejection}>Entendido</button>
                            </div>
                        )}
                        <div className={styles.operationalArea}>
                            {children || (
                                <>
                                    {ticketData.status_id === "borrador" && (
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
                                    {ticketData.status_id === "nuevo" && (
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
                                    {ticketData.status_id === "esperando_pago_visita" && !isVisitPaid && (
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
                                    {(ticketData.status_id === "en_inspeccion" || (ticketData.status_id === "esperando_pago_visita" && isVisitPaid)) && (
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
                                                        onClick={async () => {
                                                            const today = new Date();
                                                            const updated = {
                                                                ...ticketData,
                                                                execution_date: today.toISOString(),
                                                                programacionLabel: "HOY",
                                                                estadoId: "visita_realizada",
                                                                status_id: "visita_realizada"
                                                            };
                                                            setTicketData(updated);
                                                            await syncToSupabase(updated, { manual: true, allowStateRollback: true });
                                                        }}
                                                    >
                                                        <span className={styles.optLabel}>HOY</span>
                                                        <span className={styles.optDate}>
                                                            {new Date().toLocaleDateString('es-PE', { day: '2-digit', month: 'long' })}
                                                        </span>
                                                    </button>
                                                    <button
                                                        className={styles.scheduleOptionBtn}
                                                        onClick={async () => {
                                                            const tomorrow = new Date();
                                                            tomorrow.setDate(tomorrow.getDate() + 1);
                                                            const updated = {
                                                                ...ticketData,
                                                                execution_date: tomorrow.toISOString(),
                                                                programacionLabel: "MAÑANA",
                                                                estadoId: "visita_realizada",
                                                                status_id: "visita_realizada"
                                                            };
                                                            setTicketData(updated);
                                                            await syncToSupabase(updated, { manual: true, allowStateRollback: true });
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
                                    {ticketData.status_id === "visita_realizada" && (
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
                                            <div className={styles.diagnosisArea}>
                                                <label className={styles.optimisticLabel}>Diagnóstico Técnico Final</label>
                                                <textarea
                                                    placeholder="Describa el hallazgo y la solución técnica..."
                                                    value={diagnosis}
                                                    onChange={(e) => setDiagnosis(e.target.value)}
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
                                                                value={laborCost}
                                                                onChange={(e) => setLaborCost(e.target.value)}
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
                                                                    value={materialsCost}
                                                                    onChange={(e) => setMaterialsCost(e.target.value)}
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
                                    {(ticketData.status_id === "en_cotizacion" || ["cotizacion_enviada", "cotizacion_aprobada", "en_ejecucion", "documentacion_enviada", "por_liquidar", "pago_realizado", "ticket_cerrado"].includes(ticketData.status_id)) && (
                                        <div className={`${styles.quotationBox} ${isQuotationCollapsed && ticketData.status_id !== "en_cotizacion" ? styles.collapsedQuotation : ''}`}>
                                            <div className={styles.quotationHeader} onClick={() => ticketData.status_id !== "en_cotizacion" && setIsQuotationCollapsed(!isQuotationCollapsed)}>
                                                <FileSpreadsheet size={28} color="#10B981" />
                                                <div style={{ textAlign: 'left', flex: 1 }}>
                                                    <h3 className={styles.quotationTitle} style={{ fontSize: '18px', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.02em' }}>
                                                        {ticketData.status_id === "en_cotizacion" 
                                                            ? "Elaboración de Cotización Formal" 
                                                            : (ticketData.status_id === "cotizacion_enviada" 
                                                                ? "Cotización Emitida al Cliente (Pendiente Aprobación)" 
                                                                : (["cotizacion_aprobada", "en_ejecucion", "documentacion_enviada", "por_liquidar", "ticket_cerrado"].includes(ticketData.status_id)
                                                                    ? "Cotización Aprobada y Registrada"
                                                                    : "Estado de Cotización Desconocido"))}
                                                    </h3>
                                                    <p className={styles.quotationSubtitle} style={{ fontSize: '13px', color: '#64748b', marginTop: '2px', fontWeight: 500 }}>
                                                        {ticketData.status_id === "en_cotizacion"
                                                            ? "Prepare el presupuesto final usando la plantilla oficial"
                                                            : isQuotationCollapsed ? "Pulse para ver detalles de la cotización" : "Documento oficial del servicio. Los cambios requieren Autorización."
                                                        }
                                                    </p>
                                                </div>
                                                {["cotizacion_enviada", "cotizacion_aprobada", "en_ejecucion", "documentacion_enviada", "por_liquidar", "pago_realizado", "ticket_cerrado"].includes(ticketData.status_id) && (
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
                                            {(!isQuotationCollapsed || ticketData.status_id === "en_cotizacion") && (
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
                                                                            <span>S/ {formatSoles(ticketData.labor_cost)}</span>
                                                                        </div>
                                                                        <div className={styles.techRow}>
                                                                            <label>Materiales:</label>
                                                                            <span>S/ {formatSoles(ticketData.materials_cost)}</span>
                                                                        </div>
                                                                        {parseFloat(ticketData.visit_cost || 0) > 0 && (
                                                                            <div className={styles.techRow}>
                                                                                <label>Gasto de Visita:</label>
                                                                                <span>S/ {formatSoles(ticketData.visit_cost)}</span>
                                                                            </div>
                                                                        )}
                                                                        <div className={styles.techRowTotal}>
                                                                            <label>Costo Directo Total:</label>
                                                                            <strong>S/ {formatSoles((round2(ticketData.labor_cost || 0) + round2(ticketData.materials_cost || 0)) || round2(ticketData.visit_cost || 0))}</strong>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                                <div className={styles.suggestedTotal}>
                                                                    <span>PRECIO OBJETIVO (55% MARGEN)</span>
                                                                    <div className={styles.suggestedValue}>
                                                                        S/ {formatSoles(round2(((round2(ticketData.labor_cost || 0) + round2(ticketData.materials_cost || 0)) || round2(ticketData.visit_cost || 0)) / 0.45))}
                                                                    </div>
                                                                </div>
                                                                <div className={styles.missingAmountCard}>
                                                                    <div className={styles.missingHeader}>
                                                                        <span>CUMPLIMIENTO DE META</span>
                                                                        <strong>
                                                                            {((totalQuotedAmount / (((parseFloat(ticketData.labor_cost || 0) + parseFloat(ticketData.materials_cost || 0)) / 0.45) || 1)) * 100).toFixed(0)}%
                                                                        </strong>
                                                                    </div>
                                                                    <div className={styles.missingValue}>
                                                                        {(() => {
                                                                            const totalCostoTécnico = (parseFloat(ticketData.labor_cost || 0) + parseFloat(ticketData.materials_cost || 0)) || parseFloat(ticketData.visit_cost || 0);
                                                                            const meta55 = totalCostoTécnico / 0.45;
                                                                            if (totalQuotedAmount < totalCostoTécnico) {
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
                                                                            if (totalQuotedAmount < meta55) {
                                                                                return (
                                                                                    <>
                                                                                        <span className={styles.missingLabel}>FALTAN PARA META 55%:</span>
                                                                                        <strong className={styles.missingAmount}>
                                                                                            S/ {formatSoles(meta55 - totalQuotedAmount)}
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
                                                            {ticketData.status_id === "en_cotizacion" && (
                                                                <p className={styles.profitabilityHint}>
                                                                    💡 Ajuste los precios en el editor de la derecha para cubrir el costo técnico y alcanzar el margen operativo sugerido.
                                                                </p>
                                                            )}
                                                            {["cotizacion_enviada", "cotizacion_aprobada", "en_ejecucion", "documentacion_enviada", "por_liquidar", "pago_realizado", "ticket_cerrado"].includes(ticketData.status_id) && !ticketData.modificacionAutorizada && (
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
                                                                            disabled={isSaving}
                                                                        >
                                                                            {isSaving ? <Clock size={18} className={styles.spinner} /> : (ticketData.solicitudModificacion ? <Sparkles size={18} /> : null)}
                                                                            <span>{isSaving ? 'GUARDANDO...' : (ticketData.solicitudModificacion ? 'APROBAR SOLICITUD DE CAMBIO' : 'AUTORIZAR MODIFICACIÓN')}</span>
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
                                                                                disabled={isSaving}
                                                                            >
                                                                                {isSaving ? <Clock size={18} className={styles.spinner} /> : <Send size={18} />}
                                                                                <span>{isSaving ? 'ENVIANDO...' : 'SOLICITAR AUTORIZACIÓN PARA EDITAR'}</span>
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
                                                                        onClick={() => (ticketData.status_id === 'en_cotizacion' || ticketData.modificacionAutorizada) && bcpFileInputRef.current?.click()}
                                                                        style={{
                                                                            cursor: (ticketData.status_id === 'en_cotizacion' || ticketData.modificacionAutorizada) ? 'pointer' : 'not-allowed',
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
                                                                            {(ticketData.status_id === "en_cotizacion" || ticketData.modificacionAutorizada) && (
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
                                                                        {(!["en_cotizacion"].includes(ticketData.status_id) && !ticketData.modificacionAutorizada) && (
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
                                                                                    setTotalQuotedAmount(totalValue);
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
                                                                                value={totalQuotedAmount || ''}
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
                                                            <OnlineQuotationEditor
                                                                ref={quotationEditorRef}
                                                                isLocked={["cotizacion_enviada", "cotizacion_aprobada", "en_ejecucion", "documentacion_enviada", "por_liquidar", "pago_realizado", "ticket_cerrado"].includes(ticketData.status_id) && !ticketData.modificacionAutorizada}
                                                                clientInfo={ticketData.cliente}
                                                                sedeInfo={ticketData.sede}
                                                                servicioId={ticketData.servicioId}
                                                                ticketId={ticketData.client_ticket_number || ticketData.id}
                                                                numeroTicketCliente={ticketData.client_ticket_number}
                                                                initialItems={partidasCotización}
                                                                suggestedTotal={round2((round2(ticketData.labor_cost || 0) + round2(ticketData.materials_cost || 0) + round2(ticketData.visit_cost || 0)) / 0.45)}
                                                                onUpdate={(items: any[], total: number) => {
                                                                    quotationDraftRef.current = { items, total };
                                                                    setTotalQuotedAmount(prev => prev === total ? prev : total);
                                                                    setPartidasCotización(items);
                                                                }}
                                                            />
                                                        )}
                                                        <div className={styles.finalActionsOptimistic}>
                                                            {ticketData.status_id === "en_cotizacion" ? (
                                                                <button
                                                                    className={styles.sendQuoteBtnFinal}
                                                                    disabled={isSendingQuote || totalQuotedAmount <= 0 || (partidasCotización.length === 0 && !isBCP)}
                                                                    onClick={handleSendQuote}
                                                                >
                                                                    {isSendingQuote ? <Clock size={18} className={styles.spinner} /> : <Send size={18} />}
                                                                    <span>{isSendingQuote ? 'ENVIANDO...' : 'ENVIAR PRESUPUESTO FORMAL AL CLIENTE'}</span>
                                                                </button>
                                                            ) : ticketData.modificacionAutorizada ? (
                                                                <button
                                                                    className={styles.saveChangesBtn}
                                                                    onClick={async () => {
                                                                        const updatedEdits = {
                                                                            ...ticketData,
                                                                            modificacionAutorizada: false,
                                                                            montoFinal: totalQuotedAmount,
                                                                            total_quoted_amount: totalQuotedAmount,
                                                                            labor_cost: parseFloat(laborCost) || 0,
                                                                            materials_cost: parseFloat(materialsCost) || 0,
                                                                            partidas: partidasCotización,
                                                                            fechaUltimaModificacion: new Date().toISOString()
                                                                        };
                                                                        setTicketData(updatedEdits);
                                                                        await syncToSupabase(updatedEdits);
                                                                        await queryClient.invalidateQueries({ queryKey: ['tickets'] });
                                                                        await queryClient.invalidateQueries({ queryKey: ['payments'] });
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
                                    {(ticketData.status_id === "cotizacion_enviada") && (
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
                                                    disabled={isSaving}
                                                    style={{ background: '#F8FAFC', border: '1.5px solid #CBD5E1', color: '#475569' }}
                                                >
                                                    {isSaving ? <Clock size={18} className={styles.spinner} /> : <RefreshCw size={18} />}
                                                    <span>{isSaving ? 'REAJUSTANDO...' : 'SOLICITA REAJUSTE / REPROGRAMAR'}</span>
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
                                    {["cotizacion_aprobada", "en_ejecucion"].includes(ticketData.status_id) && (
                                        <div 
                                            className={styles.stepActions}
                                            key={`pay_form_${ticketData.solicitudAdelanto ? 'pending' : 'new'}_${ticketData.pagoRechazado ? 'rejected' : 'ok'}`}
                                        >
                                            <div className={styles.operationalFlowCard}>
                                                {ticketData.status_id === "cotizacion_aprobada" && (
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
                                                        {/* SECCIÓN DE ADELANTO — ocultar si ya fue pagado */}
                                                        {(!canProceedWithExecution || !isAdmin) && !ticketData.adelantoPagado && (
                                                            <div className={styles.advanceRequestPremium}>
                                                                <div className={styles.advanceInfoGrid}>
                                                                    <div className={styles.advanceMeta}>
                                                                        <div className={styles.metaIcon}><CreditCard size={18} /></div>
                                                                        <div>
                                                                            <span className={styles.metaLabel}>Adelanto al Técnico</span>
                                                                            <span className={styles.metaValue}>
                                                                                {ticketData.solicitudAdelanto 
                                                                                    ? `Solicitado: ${(ticketData.solicitudAdelanto.porcentaje * 100).toFixed(0)}% (S/ ${formatSoles(ticketData.solicitudAdelanto.monto)})`
                                                                                    : advanceRequestPending
                                                                                        ? `Pendiente en Tesorería: S/ ${formatSoles(totalLaborPending)}`
                                                                                        : "Seleccione el monto deseado"}
                                                                            </span>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                                {!ticketData.solicitudAdelanto && !advanceRequestPending && (
                                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', width: '100%' }}>
                                                                        <div className={styles.percentageSelectorPremium} style={{ display: 'flex', flexWrap: 'nowrap', gap: '12px', alignItems: 'stretch' }}>
                                                                          {[0.4, 0.5, 0.6].map(p => (
                                                                              <button
                                                                                  key={p}
                                                                                  className={`${styles.pctBtnPremium} ${porcentajeAdelanto === p && !montoAdelantoManual ? styles.pctActivePremium : ''}`}
                                                                                  style={{ 
                                                                                      flex: 1,
                                                                                      background: porcentajeAdelanto === p && !montoAdelantoManual ? 'linear-gradient(135deg, #1D4ED8, #2563EB)' : '#F1F5F9',
                                                                                      color: porcentajeAdelanto === p && !montoAdelantoManual ? 'white' : '#334155',
                                                                                      border: porcentajeAdelanto === p && !montoAdelantoManual ? 'none' : '1px solid #CBD5E1',
                                                                                      boxShadow: porcentajeAdelanto === p && !montoAdelantoManual ? '0 4px 6px -1px rgba(37, 99, 235, 0.3)' : 'none',
                                                                                      fontWeight: 'bold',
                                                                                      fontSize: '1rem',
                                                                                      borderRadius: '8px',
                                                                                      cursor: 'pointer',
                                                                                      transition: 'all 0.2s ease'
                                                                                  }}
                                                                                  onClick={() => {
                                                                                      setPorcentajeAdelanto(p);
                                                                                      setMontoAdelantoManual("");
                                                                                  }}
                                                                              >
                                                                                  {(p * 100).toFixed(0)}%
                                                                              </button>
                                                                          ))}
                                                                          <div style={{ position: 'relative', flex: 1.5 }}>
                                                                              <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', fontWeight: 900, color: '#64748B' }}>S/</span>
                                                                              <input
                                                                                  type="number"
                                                                                  className={styles.advanceInputPremium}
                                                                                  style={{ 
                                                                                      height: '100%', 
                                                                                      minHeight: '44px', 
                                                                                      width: '100%',
                                                                                      padding: '10px 16px 10px 45px',
                                                                                      borderRadius: '8px',
                                                                                      border: '2px solid #E2E8F0',
                                                                                      fontSize: '1rem',
                                                                                      fontWeight: 'bold',
                                                                                      color: '#1E293B',
                                                                                      outline: 'none',
                                                                                      transition: 'border-color 0.2s',
                                                                                      boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.05)'
                                                                                  }}
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
                                                                    </div>
                                                                )}
                                                                {isAdmin ? (
                                                                    <button
                                                                        className={styles.confirmAdvanceBtnPremium}
                                                                        onClick={handleConfirmAdvance}
                                                                        disabled={isConfirmingPayment || (!ticketData.solicitudAdelanto && !porcentajeAdelanto && !montoAdelantoManual)}
                                                                    >
                                                                        {isConfirmingPayment ? <Clock size={18} className={styles.spinner} /> : <CheckCircle size={18} />}
                                                                        <span>{isConfirmingPayment ? 'Cargando...' : (ticketData.solicitudAdelanto ? 'Confirmar Depósito' : 'Registrar Depósito Directo')}</span>
                                                                    </button>
                                                                ) : (
                                                                    !ticketData.solicitudAdelanto && !advanceRequestPending && (
                                                                        <button
                                                                            className={styles.requestAdvanceBtnPremium}
                                                                            onClick={handleRequestAdvance}
                                                                            disabled={isSubmittingAdvance || !!ticketData.solicitudAdelanto || advanceRequestPending || (!porcentajeAdelanto && !montoAdelantoManual)}
                                                                        >
                                                                            {isSubmittingAdvance
                                                                                ? <Clock size={18} className={styles.spinner} />
                                                                                : <Send size={18} />}
                                                                            <span>{isSubmittingAdvance ? 'Enviando...' : 'Solicitar Adelanto a Gerencia'}</span>
                                                                        </button>
                                                                    )
                                                                )}
                                                                {(ticketData.solicitudAdelanto || advanceRequestPending) && !ticketData.adelantoPagado && !isAdmin && (
                                                                    <div className={styles.waitingNoticePremium}>
                                                                        <Clock size={16} />
                                                                        <span>Esperando confirmación de Tesorería...</span>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                                {canProceedWithExecution && (
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
                                                        <p style={{ fontSize: '0.75rem', color: '#94A3B8', marginTop: '10px', textAlign: 'center' }}>
                                                            La gestión financiera de este ticket se realiza exclusivamente en el panel inferior.
                                                        </p>
                                                    </div>
                                                </div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                    {ticketData.status_id === "documentacion_enviada" && (
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
                                                        className={`${styles.checkItem} ${isClientTicketFormatValid(ticketData.client_ticket_number) ? styles.checkItemActive : styles.checkItemAlert}`}
                                                        style={{ cursor: 'default' }}
                                                    >
                                                        <div className={styles.checkSquare}>
                                                            {isClientTicketFormatValid(ticketData.client_ticket_number) ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} color="#EF4444" />}
                                                        </div>
                                                        <div className={styles.checkText}>
                                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                                <strong>5. NÚMERO DE TICKET DEL CLIENTE</strong>
                                                                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                                                    {!ticketData.client_ticket_number && !isSantander && (
                                                                        <button 
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                const year = new Date().getFullYear().toString().slice(-2);
                                                                                setTicketData((prev: any) => ({ ...prev, client_ticket_number: `MB000000.${year}` }));
                                                                            }}
                                                                            style={{ fontSize: '0.6rem', background: '#F3F4F6', border: '1px solid #D1D5DB', padding: '1px 4px', borderRadius: '4px', cursor: 'pointer' }}
                                                                        >
                                                                            Auto-completar
                                                                        </button>
                                                                    )}
                                                                    {ticketData.client_ticket_number && isClientTicketFormatValid(ticketData.client_ticket_number) && (
                                                                        <span style={{ fontSize: '0.65rem', color: '#059669', background: '#DCFCE7', padding: '1px 6px', borderRadius: '4px' }}>VALIDADO</span>
                                                                    )}
                                                                </div>
                                                            </div>
                                                            <input
                                                                type="text"
                                                                className={styles.inlineTicketInput}
                                                                placeholder={isSantander 
                                                                    ? `EJ: STD0001.${new Date().getFullYear().toString().slice(-2)}`
                                                                    : `EJ: MB000025.${new Date().getFullYear().toString().slice(-2)}`
                                                                }
                                                                value={ticketData.client_ticket_number || ""}
                                                                autoComplete="off"
                                                                spellCheck={false}
                                                                disabled={(ticketData.status_id !== "documentacion_enviada" && !isAdmin) || isSantander}
                                                                style={(ticketData.status_id !== "documentacion_enviada" && !isAdmin) || isSantander ? { background: '#F1F5F9', color: '#64748B', cursor: 'not-allowed', border: '1px solid #E2E8F0' } : {}}
                                                                onChange={async (e) => {
                                                                    const val = e.target.value.toUpperCase().replace(/[^A-Z0-9.#-]/g, '');
                                                                    setTicketData((prev: any) => ({ ...prev, client_ticket_number: val }));
                                                                    // ✅ AUTO-GUARDADO: persistir en Supabase cuando el formato es válido.
                                                                    // Sin esto, al cambiar de ventana o reabrir el ticket el número se pierde
                                                                    // y el ticket pasa a liquidación sin el código del cliente.
                                                                    if (isClientTicketFormatValid(val)) {
                                                                        try {
                                                                            await ticketsAPI.update(ticketData.id, { client_ticket_number: val });
                                                                        } catch (saveErr) {
                                                                            console.error('[client_ticket_number] Error guardando en Supabase:', saveErr);
                                                                        }
                                                                    }
                                                                }}
                                                                onClick={(e) => e.stopPropagation()}
                                                                readOnly={isSantander}
                                                            />
                                                            {!ticketData.client_ticket_number && !isSantander && (
                                                                <span style={{ color: '#EF4444', fontSize: '0.65rem', fontWeight: 800, marginTop: '4px' }}>
                                                                    ¡OBLIGATORIO: PENDIENTE DE ASIGNAR!
                                                                </span>
                                                            )}
                                                            {ticketData.client_ticket_number && !isClientTicketFormatValid(ticketData.client_ticket_number) && !ticketData.client_ticket_number.startsWith('#') && (
                                                                <span style={{ color: '#F59E0B', fontSize: '0.65rem', fontWeight: 700, marginTop: '4px', lineHeight: '1.2' }}>
                                                                    {isSantander ? (
                                                                        <>
                                                                            FORMATO REQUERIDO: STD + 4 DÍGITOS + PUNTO + AÑO (26)<br />
                                                                            Ejemplo: STD0001.{new Date().getFullYear().toString().slice(-2)}
                                                                        </>
                                                                    ) : (
                                                                        <>
                                                                            FORMATO REQUERIDO: MB + 6 DÍGITOS + PUNTO + AÑO (26)<br />
                                                                            Ejemplo: MB000025.{new Date().getFullYear().toString().slice(-2)}
                                                                        </>
                                                                    )}
                                                                </span>
                                                            )}
                                                            {ticketData.client_ticket_number && isClientTicketFormatValid(ticketData.client_ticket_number) && (
                                                                <span style={{ color: '#059669', fontSize: '0.65rem', fontWeight: 800, marginTop: '4px' }}>
                                                                    ✔ FORMATO VÁLIDO {isSantander ? '(STD)' : ''}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                                <button
                                                    className={styles.proceedToLiquidationBtn}
                                                    disabled={
                                                        isSubmittingLiquidation ||
                                                        isSavingNegotiation ||
                                                        (!isSantander && !Object.values(documentosChecklist).every(v => v)) ||
                                                        (!isSantander && !isClientTicketFormatValid(ticketData.client_ticket_number))
                                                    }
                                                    onClick={handleRequestFinalLiquidation}
                                                >
                                                    {isSubmittingLiquidation
                                                        ? <><Clock size={20} className={styles.spinner} /><span>Procesando...</span></>
                                                        : <><span>PASAR A LIQUIDACIÓN FINAL</span><ArrowRight size={20} /></>
                                                    }
                                                </button>
                                                {(!isSantander && (!Object.values(documentosChecklist).every(v => v) || !ticketData.client_ticket_number)) && (
                                                    <p className={styles.checklistAlert}>
                                                        {isSantander 
                                                            ? "* Verifique los documentos para continuar."
                                                            : "* Todos los documentos y el número de ticket del cliente son obligatorios para continuar."
                                                        }
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                    {["por_liquidar", "ticket_cerrado", "requiere_revision_admin"].includes(ticketData.status_id) && (
                                        <div className={styles.liquidationContainerPremium}>
                                            {ticketData.status_id === "requiere_revision_admin" && (
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
                                                        disabled={!isSantander && !isClientTicketFormatValid(ticketData.client_ticket_number)}
                                                        style={{ 
                                                            background: (!isSantander && !isClientTicketFormatValid(ticketData.client_ticket_number)) ? '#9CA3AF' : '#EF4444', 
                                                            color: 'white', 
                                                            border: 'none', 
                                                            padding: '10px 20px', 
                                                            borderRadius: '10px', 
                                                            fontSize: '13px', 
                                                            fontWeight: 700,
                                                            cursor: (!isSantander && !isClientTicketFormatValid(ticketData.client_ticket_number)) ? 'not-allowed' : 'pointer',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            gap: '8px',
                                                            opacity: (!isSantander && !isClientTicketFormatValid(ticketData.client_ticket_number)) ? 0.7 : 1
                                                        }}
                                                        title={(!isSantander && !isClientTicketFormatValid(ticketData.client_ticket_number)) ? "Debe ingresar un número de ticket válido" : ""}
                                                    >
                                                        <ThumbsUp size={16} />
                                                        APROBAR EXCEPCIÓN Y LIBERAR PAGO
                                                    </button>
                                                </div>
                                            )}
                                                </div>
                                            )}
                                            {ticketData.status_id === "por_liquidar" && (
                                                <div className={styles.adminReviewAlert} style={{ 
                                                    background: '#F0F9FF', 
                                                    border: '1.5px solid #7DD3FC', 
                                                    borderRadius: '16px', 
                                                    padding: '24px', 
                                                    marginBottom: '20px',
                                                    display: 'flex',
                                                    flexDirection: 'column',
                                                    gap: '16px',
                                                    boxShadow: '0 4px 12px rgba(14, 165, 233, 0.1)'
                                                }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                        <div style={{ background: '#0EA5E9', color: 'white', padding: '10px', borderRadius: '12px' }}>
                                                            <Clock size={24} />
                                                        </div>
                                                        <div>
                                                            <h4 style={{ color: '#075985', fontSize: '16px', fontWeight: 800, margin: 0 }}>LIQUIDACIÓN EN PROCESO DE PAGO</h4>
                                                            <p style={{ color: '#0369A1', fontSize: '13px', margin: '4px 0 0 0', fontWeight: 500 }}>
                                                                El expediente ha sido validado y se encuentra en la bandeja de Tesorería para el depósito final.
                                                            </p>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                            <div className={styles.concludedServiceContainer}>
                                                <div className={styles.concludedHeader}>
                                                    <div className={styles.concludedHeaderLeft}>
                                                        <div className={styles.concludedIconBadge}>
                                                            <CheckCircle2 size={22} />
                                                        </div>
                                                        <div className={styles.concludedTitleGroup}>
                                                            <h3>Servicio Concluido y Liquidado</h3>
                                                            <span>Informacion financiera auditada y cerrada</span>
                                                        </div>
                                                    </div>
                                                    <div className={styles.concludedHeaderStats}>
                                                        <div className={styles.statBadge}>
                                                            <span className={styles.statLabel}>Ticket Cliente</span>
                                                            <span className={styles.statValue}>
                                                                {ticketData.client_ticket_number && ticketData.client_ticket_number.trim() !== "" 
                                                                    ? ticketData.client_ticket_number 
                                                                    : "PENDIENTE"}
                                                            </span>
                                                        </div>
                                                        <div className={styles.statBadge}>
                                                            <span className={styles.statLabel}>Cierre Real</span>
                                                            <span className={styles.statValue} style={{ fontSize: '11px', color: '#475569' }}>
                                                                {ticketData.closure_date ? new Date(ticketData.closure_date).toLocaleString('es-PE') : (ticketData.updated_at ? new Date(ticketData.updated_at).toLocaleString('es-PE') : '—')}
                                                            </span>
                                                        </div>
                                                        {isAdmin && (
                                                            <button 
                                                                onClick={() => {
                                                                    if (isEditingClosedData) {
                                                                        handleUpdateClosedData();
                                                                    } else {
                                                                        const defaultDate = ticketData.closure_date ? new Date(ticketData.closure_date).toISOString().slice(0,16) : new Date().toISOString().slice(0,16);
                                                                        setClosedDataEdits({
                                                                            client_ticket_number: ticketData.client_ticket_number || "",
                                                                            closure_date: defaultDate
                                                                        });
                                                                        setIsEditingClosedData(true);
                                                                    }
                                                                }}
                                                                style={{
                                                                    background: isEditingClosedData ? '#10B981' : '#F1F5F9',
                                                                    color: isEditingClosedData ? 'white' : '#475569',
                                                                    border: isEditingClosedData ? 'none' : '1px solid #CBD5E1',
                                                                    padding: '4px 10px', borderRadius: '6px', fontSize: '10px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', alignSelf: 'center'
                                                                }}
                                                            >
                                                                {isEditingClosedData ? <CheckCircle2 size={12}/> : <Pencil size={12}/>}
                                                                {isEditingClosedData ? "GUARDAR" : "EDITAR MÉTRICAS"}
                                                            </button>
                                                        )}
                                                        {isEditingClosedData && (
                                                            <button onClick={() => setIsEditingClosedData(false)} style={{ background: '#FEE2E2', color: '#DC2626', border: 'none', padding: '4px 8px', borderRadius: '6px', cursor: 'pointer', alignSelf: 'center' }}>
                                                                <X size={12}/>
                                                            </button>
                                                        )}
                                                        {!isEditingClosedData && (
                                                            <div className={styles.statBadgeGreen}>
                                                                <span className={styles.statLabelGreen}>Liquidado</span>
                                                                <CheckCircle size={14} color="#059669" />
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                                {isEditingClosedData && (
                                                    <div style={{ background: '#F8FAFC', padding: '12px', borderRadius: '12px', border: '1px solid #E2E8F0', marginBottom: '15px', display: 'flex', gap: '15px', flexWrap: 'wrap' }}>
                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1, minWidth: '200px' }}>
                                                            <label style={{ fontSize: '10px', fontWeight: 700, color: '#475569' }}>TICKET CLIENTE (Mibanco/Santander)</label>
                                                            <input 
                                                                type="text" 
                                                                value={closedDataEdits.client_ticket_number}
                                                                onChange={(e) => setClosedDataEdits(prev => ({...prev, client_ticket_number: e.target.value.toUpperCase()}))}
                                                                style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '12px', outline: 'none' }}
                                                                placeholder="Ej. MB000000.26"
                                                            />
                                                        </div>
                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1, minWidth: '200px' }}>
                                                            <label style={{ fontSize: '10px', fontWeight: 700, color: '#475569' }}>FECHA DE CIERRE (Métrica Contable)</label>
                                                            <input 
                                                                type="datetime-local" 
                                                                value={closedDataEdits.closure_date}
                                                                onChange={(e) => setClosedDataEdits(prev => ({...prev, closure_date: e.target.value}))}
                                                                style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '12px', outline: 'none' }}
                                                            />
                                                        </div>
                                                    </div>
                                                )}
                                                <div className={styles.financialAuditGrid}>
                                                    {/* Card 1: PRESUPUESTO APROBADO */}
                                                    <div className={styles.financeCard} style={{
                                                        background: 'linear-gradient(135deg, #F8FAFC, #F1F5F9)',
                                                        border: '1px solid #CBD5E1'
                                                    }}>
                                                        <div className={styles.financeCardHeader} style={{ color: '#475569' }}>
                                                            <TrendingUp size={16} />
                                                            <span>PRESUPUESTO APROBADO</span>
                                                        </div>
                                                        <div className={styles.financeMainValue} style={{ color: '#1E293B' }}>
                                                            <span className={styles.currencySymbol}>S/</span>
                                                            <span className={styles.mainAmount}>{netIncome.toLocaleString('es-PE', { minimumFractionDigits: 2 })}</span>
                                                        </div>
                                                        <div className={styles.financeSubRow}>
                                                            <span style={{ color: '#64748B', fontWeight: 600 }}>Ingreso total (Sin IGV)</span>
                                                        </div>
                                                    </div>
                                                    {/* Card 2: COSTO MANO DE OBRA */}
                                                    <div className={styles.financeCard} style={{
                                                        background: 'linear-gradient(135deg, #FFF7ED, #FFEDD5)',
                                                        border: '1px solid #FDBA74'
                                                    }}>
                                                        <div className={styles.financeCardHeader} style={{ color: '#C2410C' }}>
                                                            <CreditCard size={16} />
                                                            <span>EGRESOS MANO DE OBRA</span>
                                                        </div>
                                                        <div className={styles.financeMainValue} style={{ color: '#EA580C' }}>
                                                            <span className={styles.currencySymbol}>S/</span>
                                                            <span className={styles.mainAmount}>{unifiedPaymentsSum.toLocaleString('es-PE', { minimumFractionDigits: 2 })}</span>
                                                        </div>
                                                        <div className={styles.financeSubRow}>
                                                            <span style={{ color: '#C2410C', fontWeight: 600 }}>Pago pactado al Técnico</span>
                                                        </div>
                                                    </div>
                                                    {/* Card 3: GASTOS OPERATIVOS */}
                                                    <div className={styles.financeCard} style={{
                                                        background: 'linear-gradient(135deg, #FEF2F2, #FEE2E2)',
                                                        border: '1px solid #FCA5A5'
                                                    }}>
                                                        <div className={styles.financeCardHeader} style={{ color: '#991B1B' }}>
                                                            <ArrowDownLeft size={16} />
                                                            <span>GASTOS OPERATIVOS</span>
                                                        </div>
                                                        <div className={styles.financeMainValue} style={{ color: '#DC2626' }}>
                                                            <span className={styles.currencySymbol}>S/</span>
                                                            <span className={styles.mainAmount}>{operatingExpenses.toLocaleString('es-PE', { minimumFractionDigits: 2 })}</span>
                                                        </div>
                                                        <div className={styles.financeSubRow}>
                                                            <span style={{ color: '#991B1B', fontWeight: 600 }}>Materiales, viáticos, otros</span>
                                                        </div>
                                                    </div>
                                                    {/* Card 4: UTILIDAD DEL TICKET */}
                                                    <div className={styles.financeCard} style={{
                                                        background: grossMargin >= 0 ? 'linear-gradient(135deg, #ECFDF5, #D1FAE5)' : 'linear-gradient(135deg, #FEF2F2, #FEE2E2)',
                                                        border: grossMargin >= 0 ? '1px solid #6EE7B7' : '1px solid #FCA5A5'
                                                    }}>
                                                        <div className={styles.financeCardHeader} style={{ color: grossMargin >= 0 ? '#065F46' : '#991B1B' }}>
                                                            <Sparkles size={16} />
                                                            <span>UTILIDAD DEL TICKET</span>
                                                        </div>
                                                        <div className={styles.financeMainValue} style={{ color: grossMargin >= 0 ? '#047857' : '#DC2626' }}>
                                                            <span className={styles.currencySymbol}>S/</span>
                                                            <span className={styles.mainAmount}>{grossMargin.toLocaleString('es-PE', { minimumFractionDigits: 2 })}</span>
                                                        </div>
                                                        <div className={styles.profitMarginBadge} style={{
                                                            background: grossMargin >= 0 ? '#A7F3D0' : '#FEE2E2',
                                                            color: grossMargin >= 0 ? '#047857' : '#b91c1c',
                                                            border: grossMargin >= 0 ? '1px solid #6EE7B7' : '1px solid #FCA5A5'
                                                        }}>
                                                            <Percent size={12} />
                                                            <span>{(pctReal || 0).toFixed(1)}% margen</span>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className={styles.depositsSection}>
                                                    <div className={styles.depositsSectionHeader}>
                                                        <div className={styles.depositsSectionTitle}>
                                                            <Coins size={16} />
                                                            <span>Depositos Realizados</span>
                                                        </div>
                                                        <div className={styles.depositsTotal}>
                                                            <span>Total Depositado:</span>
                                                            <strong>S/ {(unifiedPaymentsSum + operatingExpenses).toLocaleString('es-PE', { minimumFractionDigits: 2 })}</strong>
                                                        </div>
                                                    </div>
                                                    <div className={styles.depositsListCompact}>
                                                        {[...laborItems, ...operatingItems].length > 0 ? [...laborItems, ...operatingItems].sort((a, b) => new Date(b.fecha || b.created_at).getTime() - new Date(a.fecha || a.created_at).getTime()).map((p: any, i: number) => (
                                                            <div key={`dep-${i}`} className={styles.depositRowCompact}>
                                                                <div className={styles.depositRowLeft}>
                                                                    <div className={styles.depositStatusDot} style={{ background: '#10B981' }} />
                                                                    <div className={styles.depositInfo}>
                                                                        <span className={styles.depositConcept}>{p.concepto || p.categoria || p.tipo || 'Pago MO'}</span>
                                                                        <span className={styles.depositDate}>{new Date(p.created_at || p.fecha).toLocaleDateString('es-PE')}</span>
                                                                    </div>
                                                                </div>
                                                                <span className={styles.depositAmountCompact}>S/ {toNum(p.monto).toLocaleString('es-PE', { minimumFractionDigits: 2 })}</span>
                                                            </div>
                                                        )) : (
                                                            <div className={styles.emptyDeposits}>
                                                                <span>Sin depositos registrados</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className={styles.paymentDestinationPanel}>
                                                    <div className={styles.destinationHeader}>
                                                        <CreditCard size={16} />
                                                        <span>Destino del Pago</span>
                                                    </div>
                                                    <div className={styles.destinationContent}>
                                                        <div className={styles.destinationMain}>
                                                            <div className={styles.destinationField}>
                                                                <span className={styles.destFieldLabel}>Tecnico</span>
                                                                <span className={styles.destFieldValue}>
                                                                    {(ticketData.tecnico || ticketData.technician)?.nombre || (ticketData.tecnico || ticketData.technician)?.name || 'Sin Técnico'}
                                                                </span>
                                                            </div>
                                                            <div className={styles.destinationField}>
                                                                <span className={styles.destFieldLabel}>Banco</span>
                                                                <span className={styles.destFieldValue}>{(ticketData.tecnico || ticketData.technician)?.banco || (ticketData.tecnico || ticketData.technician)?.bank_name || 'N/A'}</span>
                                                            </div>
                                                            <div className={styles.destinationField} style={{ flex: 2 }}>
                                                                <span className={styles.destFieldLabel}>Cuenta</span>
                                                                <span className={styles.destFieldValueMono}>{(ticketData.tecnico || ticketData.technician)?.numeroCuenta || (ticketData.tecnico || ticketData.technician)?.account_number || '---'}</span>
                                                            </div>
                                                            {((ticketData.tecnico || ticketData.technician)?.cci || (ticketData.tecnico || ticketData.technician)?.cci_number) && (
                                                                <div className={styles.destinationField} style={{ flex: 2 }}>
                                                                    <span className={styles.destFieldLabel}>CCI</span>
                                                                    <span className={styles.destFieldValueMono}>{(ticketData.tecnico || ticketData.technician)?.cci || (ticketData.tecnico || ticketData.technician)?.cci_number}</span>
                                                                </div>
                                                            )}
                                                        </div>
                                                        {((ticketData.tecnico || ticketData.technician)?.yape || (ticketData.tecnico || ticketData.technician)?.yape_number || (ticketData.tecnico || ticketData.technician)?.plin || (ticketData.tecnico || ticketData.technician)?.plin_number) && (
                                                            <div className={styles.destinationWallets}>
                                                                {((ticketData.tecnico || ticketData.technician)?.yape || (ticketData.tecnico || ticketData.technician)?.yape_number) && (
                                                                    <span className={styles.walletChip} style={{ background: '#7C3AED' }}>YAPE: {(ticketData.tecnico || ticketData.technician)?.yape || (ticketData.tecnico || ticketData.technician)?.yape_number}</span>
                                                                )}
                                                                {((ticketData.tecnico || ticketData.technician)?.plin || (ticketData.tecnico || ticketData.technician)?.plin_number) && (
                                                                    <span className={styles.walletChip} style={{ background: '#00D1FF' }}>PLIN: {(ticketData.tecnico || ticketData.technician)?.plin || (ticketData.tecnico || ticketData.technician)?.plin_number}</span>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className={styles.finalSettledRow}>
                                                    <div className={styles.settledInfo}>
                                                        <CheckCircle size={18} />
                                                        <div className={styles.settledText}>
                                                            <span className={styles.settledLabel}>SALDO FINAL LIQUIDADO</span>
                                                            <span className={styles.settledNote}>Pago completado y confirmado</span>
                                                        </div>
                                                    </div>
                                                    <div className={styles.settledAmount}>
                                                        <span className={styles.settledCurrency}>S/</span>
                                                        <span className={styles.settledValue}>{(techPactedTotal - unifiedPaymentsSum).toLocaleString('es-PE', { minimumFractionDigits: 2 })}</span>
                                                    </div>
                                                </div>
                                                <div className={styles.closedFooterActions}>
                                                    <div className={styles.closedStatusBanner}>
                                                        <CheckCircle size={18} />
                                                        TICKET CERRADO Y ARCHIVADO
                                                    </div>
                                                    <button onClick={onClose} className={styles.returnDashboardBtn}>
                                                        VOLVER AL DASHBOARD
                                                        <ArrowRight size={16} />
                                                    </button>
                                                </div>
                                            </div>
                                            {ticketData.status_id === "por_liquidar" && (
                                                <div className={styles.waitingForManager} style={{ padding: '30px', background: '#F8FAFC', borderRadius: '20px', border: '1px solid #E2E8F0', marginTop: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                                                    <Clock size={28} color="#3B82F6" />
                                                    <span style={{ fontSize: '1.2rem', color: '#1E293B', fontWeight: 800 }}>LIQUIDACIÓN EN PROCESO</span>
                                                    <span style={{ fontSize: '0.9rem', color: '#64748B', fontWeight: 500, maxWidth: '400px', textAlign: 'center' }}>
                                                        Registre el depósito final en el panel de <strong>Tesorería</strong> inferior para cerrar este ticket definitivamente.
                                                    </span>
                                                    {isAdmin && (techPactedTotal - unifiedPaymentsSum) <= 0.01 && (
                                                        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '15px', alignItems: 'center', marginTop: '15px' }}>
                                                            <div style={{ background: 'rgba(255, 241, 242, 0.5)', border: '1px solid #FECDD3', padding: '15px', borderRadius: '12px', width: '100%', maxWidth: '400px' }}>
                                                                <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontWeight: 600, color: '#9F1239', fontSize: '0.9rem' }}>
                                                                    <input 
                                                                        type="checkbox" 
                                                                        checked={isRetroactiveClosure} 
                                                                        onChange={(e) => setIsRetroactiveClosure(e.target.checked)}
                                                                        style={{ width: '16px', height: '16px', accentColor: '#E11D48' }}
                                                                    />
                                                                    Ajustar Fecha Contable por Conciliación de Cliente
                                                                </label>
                                                                {isRetroactiveClosure && (
                                                                    <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '5px' }}>
                                                                        <span style={{ fontSize: '0.8rem', color: '#BE123C' }}>Seleccione la fecha límite de cierre del mes anterior:</span>
                                                                        <input 
                                                                            type="datetime-local" 
                                                                            value={retroactiveDate}
                                                                            onChange={(e) => setRetroactiveDate(e.target.value)}
                                                                            style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #FDA4AF', width: '100%', outline: 'none' }}
                                                                        />
                                                                    </div>
                                                                )}
                                                            </div>

                                                            <button 
                                                                onClick={handleCompleteClosure}
                                                                className={styles.approveExceedBtn}
                                                                style={{
                                                                    background: '#10B981',
                                                                    color: 'white',
                                                                    border: 'none',
                                                                    padding: '12px 24px',
                                                                    borderRadius: '10px',
                                                                    fontWeight: 700,
                                                                    cursor: 'pointer',
                                                                    boxShadow: '0 4px 6px -1px rgba(16, 185, 129, 0.2)',
                                                                    width: '100%',
                                                                    maxWidth: '400px'
                                                                }}
                                                            >
                                                                SINFIMAC CORP - TESORERÍA v1.3.4<br/>
                                                                CONFIRMAR CIERRE DEFINITIVO (SALDO 0)
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                            {ticketData.status_id === "ticket_cerrado" && (
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
                                    {["ticket_cancelado", "ticket_rechazado"].includes(ticketData.status_id || "") && (
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
                                                    SERVICIO {ticketData.status_id === "ticket_cancelado" ? "ANULADO" : "RECHAZADO"}
                                                </h3>
                                                <p style={{ color: '#9F1239', fontWeight: 500, maxWidth: '500px' }}>
                                                    Este ticket ha sido finalizado sin ejecución de trabajo. 
                                                    Si el técnico realizó un triaje o visita presencial, debe registrar el pago de movilidad aquí.
                                                </p>
                                            </div>
                                            <div style={{ display: 'flex', gap: '16px', marginTop: '10px' }}>
                                                <button 
                                                    onClick={() => handleOpenExpenseModal('Viáticos / Movilidad', `Pago por Movilidad / Triaje (Ticket ${ticketData.status_id === "ticket_cancelado" ? "Anulado" : "Rechazado"})`)}
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
                                    {!["nuevo", "en_inspeccion", "esperando_pago_visita", "visita_realizada", "en_cotizacion", "cotizacion_enviada", "cotizacion_aprobada", "en_ejecucion", "documentacion_enviada", "por_liquidar", "ticket_cerrado", "ticket_cancelado", "ticket_rechazado"].includes(ticketData.status_id || "") && (
                                        <div className={styles.stepPlaceholder}>
                                            <div className={styles.statusBadge}>{ticketData.status_id?.replace('_', ' ')}</div>
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
                                        S/ {(parseFloat(ticketData.labor_cost || 0) + parseFloat(ticketData.materials_cost || 0)).toFixed(2)}
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
                                            value={reportForm.diagnosis}
                                            onChange={(e) => setReportForm({ ...reportForm, diagnosis: e.target.value })}
                                            placeholder="Detalle técnico de lo encontrado en sede..."
                                        />
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                                        <div className={styles.transferSearchContainer}>
                                            <label style={{ fontSize: '12px', fontWeight: 800, color: '#334155' }}>🛠️ MANO DE OBRA (S/):</label>
                                            <input 
                                                type="number"
                                                className={styles.transferInput}
                                                value={reportForm.laborCost}
                                                onChange={(e) => setReportForm({ ...reportForm, laborCost: e.target.value })}
                                            />
                                        </div>
                                        <div className={styles.transferSearchContainer}>
                                            <label style={{ fontSize: '12px', fontWeight: 800, color: '#334155' }}>📦 MATERIALES (S/):</label>
                                            <input 
                                                type="number"
                                                className={styles.transferInput}
                                                value={reportForm.materialsCost}
                                                onChange={(e) => setReportForm({ ...reportForm, materialsCost: e.target.value })}
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
                                    Usted está por eliminar el ticket <strong>{ticketData.client_ticket_number || ticketData.id}</strong>. 
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
                                    Usted está por enviar el ticket <strong>{ticketData.client_ticket_number}</strong> a Tesorería para su liquidación financiera.
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
                {/* --- MODAL DE ALERTA DE RIESGO (PROFESIONAL) --- */}
                {riskAlert.show && (
                    <div className={styles.modalOverlay} style={{ zIndex: 20000 }}>
                        <div className={styles.negotiationModalCard} style={{ maxWidth: '450px', border: '2px solid #F59E0B' }}>
                            <div className={styles.negotiationModalHeader} style={{ background: 'linear-gradient(135deg, #F59E0B, #D97706)', display: 'flex', alignItems: 'center', gap: '16px' }}>
                                <div className={styles.negoIconWrapper} style={{ backgroundColor: 'white', color: '#D97706' }}>
                                    <ShieldAlert size={24} />
                                </div>
                                <div className={styles.negoTitleGroup}>
                                    <h3 style={{ color: '#FFF', margin: 0 }}>{riskAlert.title}</h3>
                                    <span style={{ color: 'rgba(255,255,255,0.8)', fontSize: '0.75rem' }}>Validación de Seguridad Financiera</span>
                                </div>
                                <button className={styles.closeNegoBtn} onClick={() => setRiskAlert(prev => ({ ...prev, show: false }))} style={{ color: 'white', marginLeft: 'auto' }}>
                                    <X size={20} />
                                </button>
                            </div>
                            <div className={styles.negotiationModalContent}>
                                <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
                                    <div style={{ background: '#FFF7ED', padding: '12px', borderRadius: '12px' }}>
                                        <AlertTriangle size={32} color="#D97706" />
                                    </div>
                                    <p style={{ fontSize: '14px', color: '#475569', lineHeight: 1.6, margin: 0 }}>
                                        {riskAlert.message}
                                    </p>
                                </div>
                            </div>
                            <div className={styles.negotiationModalActions} style={{ background: '#FFF7ED', borderTop: '1px solid #FFEDD5', padding: '20px' }}>
                                <button className={styles.negoCancelBtn} onClick={() => setRiskAlert(prev => ({ ...prev, show: false }))} style={{ color: '#9A3412', fontWeight: 800, border: '1px solid #FED7AA' }}>
                                    CANCELAR OPERACIÓN
                                </button>
                                <button 
                                    className={styles.negoConfirmBtn} 
                                    onClick={riskAlert.onConfirm}
                                    style={{ background: 'linear-gradient(135deg, #F59E0B, #D97706)', boxShadow: '0 4px 12px rgba(217, 119, 6, 0.3)', padding: '12px 24px', gap: '8px' }}
                                >
                                    <CheckCircle2 size={18} />
                                    <span>PROCEDER BAJO MI RESPONSABILIDAD</span>
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
                {/* ── Secretario Virtual Flotante ─────────────────────────────── */}
                {!isMinimized && (
                    <VirtualSecretaryFab
                        mibancoClientId={MIBANCO_ID}
                        clientId={ticketData.client_id}
                        clientTicketNumber={ticketData.client_ticket_number}
                        isSantander={isSantander}
                        gestoraMetrics={gestoraMetrics}
                        margenTicketActual={typeof pctReal === 'number' ? pctReal : undefined}
                        ticketStatusId={ticketData.status_id}
                        ticketData={ticketData}
                        ticketCosts={ticketCosts}
                        moTicketActual={typeof techPactedTotal === 'number' && techPactedTotal > 0 ? techPactedTotal : undefined}
                        onApplyTicketNumber={async (val: string) => {
                            setTicketData((prev: any) => ({ ...prev, client_ticket_number: val }));
                            try {
                                await ticketsAPI.update(ticketData.id, { client_ticket_number: val });
                                showToast("Ticket Registrado", `Se ha asignado el número de ticket: ${val}`, "success");
                            } catch (err) {
                                console.error('Error guardando ticket desde el secretario virtual:', err);
                            }
                        }}
                    />
                )}
            </div>
        </>
    );
}
export default memo(TicketWindow);
