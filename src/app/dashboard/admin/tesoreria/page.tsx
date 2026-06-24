"use client";

import { useState, useMemo, useEffect } from "react";
import { 
    Search, Filter, DollarSign, Clock, AlertCircle, CheckCircle2, 
    ArrowRight, ChevronRight, FileText, Download, User, Building2,
    Calendar, Inbox, Wallet, History, ShieldCheck, Zap, X, Upload, Trash2, ExternalLink, TrendingUp
} from "lucide-react";
import { useAppData } from "@/lib/AppDataContext";
import { supabase } from "@/lib/supabase";
import { ticketsAPI } from "@/lib/supabase-api";
import styles from "./tesoreria.module.css";
import Image from "next/image";

// --- Types ---
interface PendingCost {
    id: string;
    ticket_id: string;
    ticket_number: number;
    client_ticket_number: string;
    concepto: string;
    categoria: string;
    monto: number;
    estado_pago: string;
    created_at: string;
    specialist_id: string;
    specialist_name: string;
    client_name?: string;
    sede_name?: string;
    motivo?: string;
    solicitado_por_nombre?: string;
}

export default function TesoreriaPage() {
    const { tickets, technicians, clients, refreshTickets } = useAppData();
    const [pendingCosts, setPendingCosts] = useState<PendingCost[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<"pending" | "approvals" | "history">("pending");
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedCategory, setSelectedCategory] = useState<string>("all");

    // Modal states
    const [selectedCost, setSelectedCost] = useState<PendingCost | null>(null);
    const [showApprovalModal, setShowApprovalModal] = useState(false);
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [voucherFile, setVoucherFile] = useState<string | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);

    // Toast state
    const [toast, setToast] = useState<{ message: string, type: 'success' | 'error' } | null>(null);

    const showToast = (message: string, type: 'success' | 'error' = 'success') => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 3000);
    };

    // Fetch pending costs directly from ticket_costs joined with tickets
    const fetchCosts = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('ticket_costs')
                .select(`
                    *,
                    tickets!ticket_costs_ticket_id_fkey (
                        ticket_number,
                        client_ticket_number,
                        branch_id,
                        client_id
                    ),
                    technicians!ticket_costs_specialist_id_fkey (
                        name
                    )
                `)
                .order('created_at', { ascending: false });

            if (error) throw error;

            const mapped: PendingCost[] = (data || []).map(c => ({
                id: c.id,
                ticket_id: c.ticket_id,
                ticket_number: c.tickets?.ticket_number,
                client_ticket_number: c.tickets?.client_ticket_number,
                concepto: c.concepto,
                categoria: c.categoria,
                monto: parseFloat(c.monto),
                estado_pago: c.estado_pago,
                created_at: c.created_at,
                specialist_id: c.specialist_id,
                specialist_name: c.technicians?.name || 'Sin asignar',
                motivo: c.motivo
            }));

            setPendingCosts(mapped);
        } catch (err) {
            console.error("Error fetching costs:", err);
            showToast("Error al cargar la bandeja", "error");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchCosts();
        
        // Realtime subscription
        const channel = supabase
            .channel('tesoreria_changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'ticket_costs' }, () => {
                fetchCosts();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    // Filtered lists
    const filteredCosts = useMemo(() => {
        return pendingCosts.filter(c => {
            const matchesSearch = 
                c.ticket_number?.toString().includes(searchTerm) ||
                c.client_ticket_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                c.specialist_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                c.concepto?.toLowerCase().includes(searchTerm.toLowerCase());
            
            const matchesCategory = selectedCategory === "all" || c.categoria === selectedCategory;
            
            const matchesTab = 
                activeTab === "approvals" ? c.estado_pago === 'REQUIERE_APROBACION_ADMIN' :
                activeTab === "pending" ? c.estado_pago === 'pendiente' :
                c.estado_pago === 'pagado';

            return matchesSearch && matchesCategory && matchesTab;
        });
    }, [pendingCosts, searchTerm, selectedCategory, activeTab]);

    const stats = useMemo(() => {
        const pending = pendingCosts.filter(c => c.estado_pago === 'pendiente');
        const approvals = pendingCosts.filter(c => c.estado_pago === 'REQUIERE_APROBACION_ADMIN');
        return {
            pendingTotal: pending.reduce((acc, c) => acc + c.monto, 0),
            pendingCount: pending.length,
            approvalsTotal: approvals.reduce((acc, c) => acc + c.monto, 0),
            approvalsCount: approvals.length,
        };
    }, [pendingCosts]);

    // Handlers
    const handleApprove = async () => {
        if (!selectedCost) return;
        setIsProcessing(true);
        try {
            const { error } = await supabase
                .from('ticket_costs')
                .update({ estado_pago: 'pendiente' })
                .eq('id', selectedCost.id);
            
            if (error) throw error;
            showToast("Solicitud aprobada y lista para pago");
            setShowApprovalModal(false);
            setSelectedCost(null);
        } catch (err) {
            console.error(err);
            showToast("Error al aprobar", "error");
        } finally {
            setIsProcessing(false);
        }
    };

    const handleReject = async () => {
        if (!selectedCost) return;
        setIsProcessing(true);
        try {
            const { error } = await supabase
                .from('ticket_costs')
                .update({ estado_pago: 'RECHAZADO' })
                .eq('id', selectedCost.id);
            
            if (error) throw error;
            showToast("Solicitud rechazada");
            setShowApprovalModal(false);
            setSelectedCost(null);
        } catch (err) {
            console.error(err);
            showToast("Error al rechazar", "error");
        } finally {
            setIsProcessing(false);
        }
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setVoucherFile(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleConfirmPayment = async () => {
        if (!selectedCost) return;
        setIsProcessing(true);
        try {
            // 1. Update ticket_costs table
            const { error: costErr } = await supabase
                .from('ticket_costs')
                .update({ 
                    estado_pago: 'pagado',
                    fecha_pago: new Date().toISOString(),
                    url_comprobante: voucherFile
                })
                .eq('id', selectedCost.id);
            
            if (costErr) throw costErr;

            // 2. Update tickets metadata (historialPagosTecnico)
            const nuevoPago = {
                id: selectedCost.id,
                monto: selectedCost.monto,
                fecha: new Date().toISOString(),
                tipo: selectedCost.categoria,
                estado: 'pagado',
                referencia: `Autorizado Admin: ${selectedCost.concepto}`,
                voucherRef: voucherFile || null,
            };

            await ticketsAPI.updatePaymentSafe(selectedCost.ticket_id, nuevoPago);

            showToast("Pago registrado exitosamente");
            setShowPaymentModal(false);
            setSelectedCost(null);
            setVoucherFile(null);
            refreshTickets();
        } catch (err) {
            console.error(err);
            showToast("Error al procesar pago", "error");
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <div className={styles.container}>
            {/* Toast */}
            {toast && (
                <div className={`${styles.toast} ${styles[`toast_${toast.type}`]}`}>
                    {toast.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
                    {toast.message}
                </div>
            )}

            {/* Header Section */}
            <header className={styles.header}>
                <div className={styles.headerTitle}>
                    <div className={styles.iconBox}>
                        <Wallet size={24} className={styles.mainIcon} />
                    </div>
                    <div>
                        <h1>Bandeja de Tesorería</h1>
                        <p>Gestión centralizada de pagos, rescates y aprobaciones financieras</p>
                    </div>
                </div>

                <div className={styles.statsGrid}>
                    <div className={styles.statCard}>
                        <span className={styles.statLabel}>Pendientes de Pago</span>
                        <div className={styles.statValue}>S/ {stats.pendingTotal.toLocaleString('es-PE', { minimumFractionDigits: 2 })}</div>
                        <span className={styles.statSub}>{stats.pendingCount} documentos</span>
                    </div>
                    <div className={styles.statCardApproval}>
                        <span className={styles.statLabel}>Por Aprobar (Admin)</span>
                        <div className={styles.statValue}>S/ {stats.approvalsTotal.toLocaleString('es-PE', { minimumFractionDigits: 2 })}</div>
                        <span className={styles.statSub}>{stats.approvalsCount} solicitudes</span>
                    </div>
                </div>
            </header>

            {/* Controls */}
            <div className={styles.controls}>
                <div className={styles.tabs}>
                    <button 
                        className={`${styles.tab} ${activeTab === 'pending' ? styles.activeTab : ''}`}
                        onClick={() => setActiveTab('pending')}
                    >
                        <Clock size={18} />
                        Pendientes
                        {stats.pendingCount > 0 && <span className={styles.badge}>{stats.pendingCount}</span>}
                    </button>
                    <button 
                        className={`${styles.tab} ${activeTab === 'approvals' ? styles.activeTab : ''}`}
                        onClick={() => setActiveTab('approvals')}
                    >
                        <ShieldCheck size={18} />
                        Aprobaciones
                        {stats.approvalsCount > 0 && <span className={styles.badgeDanger}>{stats.approvalsCount}</span>}
                    </button>
                    <button 
                        className={`${styles.tab} ${activeTab === 'history' ? styles.activeTab : ''}`}
                        onClick={() => setActiveTab('history')}
                    >
                        <History size={18} />
                        Historial
                    </button>
                    <button 
                        className={`${styles.tab} ${activeTab === 'opex' as any ? styles.activeTab : ''}`}
                        onClick={() => setActiveTab('opex' as any)}
                        style={{ color: '#8B5CF6' }}
                    >
                        <TrendingUp size={18} />
                        Control OPEX & EBITDA
                    </button>
                </div>

                <div className={styles.filters}>
                    <div className={styles.searchBox}>
                        <Search size={18} />
                        <input 
                            type="text" 
                            placeholder="Buscar por ticket, técnico o concepto..." 
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <select 
                        className={styles.select}
                        value={selectedCategory}
                        onChange={(e) => setSelectedCategory(e.target.value)}
                    >
                        <option value="all">Todas las categorías</option>
                        <option value="Rescate Financiero">Rescate Financiero</option>
                        <option value="Mano de Obra">Mano de Obra</option>
                        <option value="Materiales">Materiales</option>
                        <option value="Viáticos / Movilidad">Viáticos / Movilidad</option>
                        <option value="Otros">Otros</option>
                    </select>
                </div>
            </div>

            {/* Content Area */}
            <div className={styles.content}>
                {activeTab === 'opex' as any ? (
                    <div className={styles.emptyState}>
                        <TrendingUp size={48} color="#8B5CF6" />
                        <h3 style={{ marginTop: '1rem', color: '#FFF' }}>Panel Financiero CFO</h3>
                        <p style={{ color: 'rgba(255,255,255,0.7)', maxWidth: '400px', marginBottom: '1.5rem' }}>
                            El control de OPEX, Cuentas por Cobrar (Aging), EBITDA y Capital Inmovilizado (WIP) se gestiona de forma centralizada en el Dashboard Principal.
                        </p>
                        <button 
                            onClick={() => window.location.href = '/dashboard/admin'}
                            style={{ background: '#8B5CF6', color: '#FFF', border: 'none', padding: '0.8rem 1.5rem', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}
                        >
                            Ir al Dashboard CFO
                        </button>
                    </div>
                ) : loading ? (
                    <div className={styles.loadingState}>
                        <div className={styles.spinner}></div>
                        <p>Cargando bandeja...</p>
                    </div>
                ) : filteredCosts.length === 0 ? (
                    <div className={styles.emptyState}>
                        <Inbox size={48} />
                        <h3>Bandeja vacía</h3>
                        <p>No se encontraron registros pendientes con los filtros actuales</p>
                    </div>
                ) : (
                    <div className={styles.grid}>
                        {filteredCosts.map(cost => (
                            <CostCard 
                                key={cost.id} 
                                cost={cost} 
                                onAction={() => {
                                    setSelectedCost(cost);
                                    if (cost.estado_pago === 'REQUIERE_APROBACION_ADMIN') {
                                        setShowApprovalModal(true);
                                    } else {
                                        setShowPaymentModal(true);
                                    }
                                }}
                            />
                        ))}
                    </div>
                )}
            </div>

            {/* Approval Modal */}
            {showApprovalModal && selectedCost && (
                <div className={styles.modalOverlay}>
                    <div className={styles.modal}>
                        <div className={styles.modalHeader}>
                            <h2>Revisar Solicitud de {selectedCost.categoria}</h2>
                            <button onClick={() => setShowApprovalModal(false)}><X size={20} /></button>
                        </div>
                        <div className={styles.modalBody}>
                            <div className={styles.modalInfoGrid}>
                                <div><strong>Ticket:</strong> TK-{selectedCost.ticket_number}</div>
                                <div><strong>Técnico:</strong> {selectedCost.specialist_name}</div>
                                <div><strong>Concepto:</strong> {selectedCost.concepto}</div>
                                <div><strong>Monto:</strong> S/ {selectedCost.monto.toFixed(2)}</div>
                            </div>
                            {selectedCost.motivo && (
                                <div className={styles.modalMotivo}>
                                    <strong>Justificación:</strong>
                                    <p>{selectedCost.motivo}</p>
                                </div>
                            )}
                            <p className={styles.warningText}>
                                <AlertCircle size={14} />
                                Al aprobar, el gasto pasará a estado "Pendiente" para que Tesorería pueda liquidarlo.
                            </p>
                        </div>
                        <div className={styles.modalFooter}>
                            <button 
                                className={styles.btnDanger} 
                                onClick={handleReject}
                                disabled={isProcessing}
                            >
                                <Trash2 size={16} /> Rechazar
                            </button>
                            <button 
                                className={styles.btnSuccess} 
                                onClick={handleApprove}
                                disabled={isProcessing}
                            >
                                <CheckCircle2 size={16} /> Aprobar Solicitud
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Payment Modal */}
            {showPaymentModal && selectedCost && (
                <div className={styles.modalOverlay}>
                    <div className={styles.modal}>
                        <div className={styles.modalHeader}>
                            <h2>Confirmar Pago</h2>
                            <button onClick={() => setShowPaymentModal(false)}><X size={20} /></button>
                        </div>
                        <div className={styles.modalBody}>
                            <div className={styles.paymentSummary}>
                                <div className={styles.paymentMain}>
                                    <span>Total a Pagar</span>
                                    <h3>S/ {selectedCost.monto.toLocaleString('es-PE', { minimumFractionDigits: 2 })}</h3>
                                </div>
                                <div className={styles.paymentDetails}>
                                    <p><strong>Beneficiario:</strong> {selectedCost.specialist_name}</p>
                                    <p><strong>Concepto:</strong> {selectedCost.concepto}</p>
                                </div>
                            </div>

                            <div className={styles.voucherSection}>
                                <h4>Adjuntar Comprobante (Voucher)</h4>
                                <div className={styles.uploadArea}>
                                    {voucherFile ? (
                                        <div className={styles.previewContainer}>
                                            <img src={voucherFile} alt="Voucher" className={styles.preview} />
                                            <button className={styles.removeVoucher} onClick={() => setVoucherFile(null)}>
                                                <X size={14} />
                                            </button>
                                        </div>
                                    ) : (
                                        <label className={styles.uploadLabel}>
                                            <Upload size={24} />
                                            <span>Click para subir o arrastra un archivo</span>
                                            <input type="file" hidden accept="image/*" onChange={handleFileUpload} />
                                        </label>
                                    )}
                                </div>
                            </div>
                        </div>
                        <div className={styles.modalFooter}>
                            <button 
                                className={styles.btnGhost} 
                                onClick={() => setShowPaymentModal(false)}
                                disabled={isProcessing}
                            >
                                Cancelar
                            </button>
                            <button 
                                className={styles.btnPrimary} 
                                onClick={handleConfirmPayment}
                                disabled={isProcessing}
                            >
                                {isProcessing ? "Procesando..." : "Confirmar y Cerrar Pago"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function CostCard({ cost, onAction }: { cost: PendingCost, onAction: () => void }) {
    const isRescue = cost.categoria === 'Rescate Financiero';
    
    return (
        <div className={`${styles.card} ${isRescue ? styles.rescueCard : ''}`}>
            <div className={styles.cardHeader}>
                <div className={styles.ticketBadge}>
                    <Zap size={14} />
                    TK-{cost.ticket_number}
                </div>
                <span className={`${styles.statusBadge} ${styles[cost.estado_pago.toLowerCase()] || ''}`}>
                    {cost.estado_pago === 'REQUIERE_APROBACION_ADMIN' ? 'POR APROBAR' : cost.estado_pago.replace(/_/g, ' ')}
                </span>
            </div>

            <div className={styles.cardBody}>
                <h3 className={styles.concepto}>{cost.concepto}</h3>
                <div className={styles.metaRow}>
                    <User size={14} />
                    <span>{cost.specialist_name}</span>
                </div>
                <div className={styles.metaRow}>
                    <Calendar size={14} />
                    <span>{new Date(cost.created_at).toLocaleDateString('es-PE', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                </div>
                
                {cost.motivo && (
                    <div className={styles.motivoBox}>
                        <strong>Motivo:</strong> {cost.motivo}
                    </div>
                )}
            </div>

            <div className={styles.cardFooter}>
                <div className={styles.amountBox}>
                    <span className={styles.currency}>S/</span>
                    <span className={styles.amount}>{cost.monto.toLocaleString('es-PE', { minimumFractionDigits: 2 })}</span>
                </div>
                
                {cost.estado_pago !== 'pagado' && (
                    <button className={styles.actionButton} onClick={onAction}>
                        {cost.estado_pago === 'REQUIERE_APROBACION_ADMIN' ? 'Revisar' : 'Pagar'}
                        <ChevronRight size={16} />
                    </button>
                )}
                
                {cost.estado_pago === 'pagado' && (
                    <div className={styles.paidCheck}>
                        <CheckCircle2 size={16} />
                        Liquidado
                    </div>
                )}
            </div>
        </div>
    );
}
