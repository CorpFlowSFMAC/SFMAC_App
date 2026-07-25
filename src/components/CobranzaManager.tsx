"use client";

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * COBRANZA MANAGER - V4 (Eventos de Pérdida + Sincronización Instantánea)
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * ARQUITECTURA: Single Source of Truth
 * - Tickets: Estado del ciclo de vida del servicio (estado_cobranza)
 * - Invoices: Estado de la facturación/cobranza
 * - Trigger en BD: estado_cobranza se actualiza automáticamente al crear invoice
 * 
 * MODALIDADES DE COBRO:
 * 1. Con OC (Orden de Compra): Requiere número de OC
 * 2. Con Evento de Pérdida: Sin número de OC, se marca como "EP-{timestamp}"
 * 
 * SINCRONIZACIÓN INSTANTÁNEA:
 * - Optimistic updates: UI se actualiza inmediatamente
 * - paid_date: Se asigna automáticamente al registrar
 * 
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import React, { useState, useCallback, useMemo, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/useQueryHooks";
import { round2 } from "@/lib/formatters";
import { CheckCircle2, X, RefreshCw, Download, Loader2, AlertTriangle, FileText } from "lucide-react";
import * as XLSX from "xlsx";

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS & CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────
const fmt = (n: number) => n.toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const IGV_RATE = 0.18;
const IGV_MULTIPLIER = 1.18;

// ─────────────────────────────────────────────────────────────────────────────
// TYPE DEFINITIONS
// ─────────────────────────────────────────────────────────────────────────────
interface Invoice {
    id: string;
    ticket_id: string;
    amount_base: number;
    amount_total: number;
    status: 'emitida' | 'cobrada' | 'anulada';
    invoice_number: string | null;
    paid_date: string | null;
    created_at: string;
}

interface Ticket {
    id: string;
    client_ticket_number: string | null;
    status_id: string;
    total_quoted_amount: number;
    montoFinal: number;
    mas_igv: boolean;
    metadata: any;
    clients?: { name: string };
    branch_offices?: { name: string };
    estado_cobranza: 'pendiente' | 'facturado' | 'cobrado';
}

// ─────────────────────────────────────────────────────────────────────────────
// PROPS
// ─────────────────────────────────────────────────────────────────────────────
interface CobranzaManagerProps {
    tickets: Ticket[];
    onToast: (title: string, desc: string) => void;
    onClose?: () => void; // Callback para cerrar el modal padre
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENTE PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────
export default function CobranzaManager({ tickets, onToast, onClose }: CobranzaManagerProps) {
    const queryClient = useQueryClient();

    // ── ESTADOS LOCALES ──
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [localTickets, setLocalTickets] = useState<Ticket[]>([]); // Copia local para optimistic updates
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'pendientes' | 'historial'>('pendientes');
    const [searchTerm, setSearchTerm] = useState('');
    const [processing, setProcessing] = useState<string | null>(null);

    // Estados del modal de creación
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
    const [invoiceOc, setInvoiceOc] = useState('');
    const [invoiceAmountBase, setInvoiceAmountBase] = useState('');
    // Tipo de cobro: 'oc' = Orden de Compra, 'evento_perdida' = Evento de Pérdida
    const [cobroTipo, setCobroTipo] = useState<'oc' | 'evento_perdida'>('oc');

    // Sincronizar tickets de props con estado local
    useEffect(() => {
        setLocalTickets(tickets);
    }, [tickets]);

    // ── CARGA DE DATOS ──
    const loadInvoices = useCallback(async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('invoices')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;
            setInvoices(data || []);
        } catch (err: any) {
            console.error('[CobranzaManager] Error cargando invoices:', err);
            onToast('Error', 'No se pudieron cargar las facturas');
        } finally {
            setLoading(false);
        }
    }, [onToast]);

    // Cargar invoices al montar
    useEffect(() => {
        loadInvoices();
    }, [loadInvoices]);

    // ── CÁLCULOS DERIVADOS (FASE 3: Single Source of Truth) ──
    //
    // Lógica simplificada usando estado_cobranza como fuente única:
    // - Pendientes: Tickets cerrados con estado_cobranza !== 'cobrado'
    // - Historial: Invoices con status 'cobrada'

    // Mapa de invoices por ticket_id para acceso O(1)
    const invoicesByTicketId = useMemo(() => {
        const map = new Map<string, Invoice[]>();
        invoices.forEach(inv => {
            const existing = map.get(inv.ticket_id) || [];
            map.set(inv.ticket_id, [...existing, inv]);
        });
        return map;
    }, [invoices]);

    // Tickets pendientes de cobrar (estado_cobranza !== 'cobrado')
    // Usa localTickets para permitir optimistic updates instantáneos
    const pendingTickets = useMemo(() => {
        return localTickets
            .filter(t => {
                const statusId = (t.status_id || '').toLowerCase();
                const isClosed = statusId === 'ticket_cerrado' || statusId === 'liquidado' || statusId === 'cerrado';
                const isPending = t.estado_cobranza !== 'cobrado';
                return isClosed && isPending;
            })
            .map(ticket => {
                // Calcular monto base con IGV
                const rawAmount = ticket.total_quoted_amount || ticket.montoFinal || 0;
                const esMasIGV = ticket.mas_igv === true;
                const montoBase = esMasIGV ? rawAmount : rawAmount / IGV_MULTIPLIER;
                const montoConIGV = montoBase * IGV_MULTIPLIER;

                return {
                    ...ticket,
                    _montoBase: round2(montoBase),
                    _montoConIGV: round2(montoConIGV),
                    _invoices: invoicesByTicketId.get(ticket.id) || []
                };
            });
    }, [localTickets, invoicesByTicketId]);

    // Historial de invoices cobradas
    // Usa localTickets para permitir optimistic updates instantáneos
    const collectedInvoices = useMemo(() => {
        return invoices
            .filter(inv => inv.status === 'cobrada')
            .map(inv => {
                const ticket = localTickets.find(t => t.id === inv.ticket_id);
                return { ...inv, _ticket: ticket };
            })
            .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }, [invoices, localTickets]);

    // Helper para formatear mes en español
    const getMonthName = (month: number) => {
        const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
                       'Julio', 'Agosto', 'Setiembre', 'Octubre', 'Noviembre', 'Diciembre'];
        return months[month];
    };

    // Métricas calculadas
    const metrics = useMemo(() => {
        const totalPendiente = pendingTickets.reduce((acc, t) => acc + (t._montoConIGV || 0), 0);
        const totalCobrado = collectedInvoices.reduce((acc, inv) => acc + (inv.amount_total || 0), 0);
        
        // Métricas mensuales basadas en created_at (fecha de registro de OC)
        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth(); // 0-11
        
        // Cobros del mes actual (usando created_at como fecha de registro)
        const cobrosMesActual = collectedInvoices
            .filter(inv => {
                const regDate = new Date(inv.created_at);
                return regDate.getFullYear() === currentYear && regDate.getMonth() === currentMonth;
            });
        
        const totalMesActual = cobrosMesActual.reduce((acc, inv) => acc + (inv.amount_total || 0), 0);
        
        // Cobros del mes anterior (para referencia)
        const mesAnterior = currentMonth === 0 ? 11 : currentMonth - 1;
        const añoMesAnterior = currentMonth === 0 ? currentYear - 1 : currentYear;
        
        const cobrosMesAnterior = collectedInvoices
            .filter(inv => {
                const regDate = new Date(inv.created_at);
                return regDate.getFullYear() === añoMesAnterior && regDate.getMonth() === mesAnterior;
            });
        
        const totalMesAnterior = cobrosMesAnterior.reduce((acc, inv) => acc + (inv.amount_total || 0), 0);
        
        return {
            totalPendiente: round2(totalPendiente),
            totalCobrado: round2(totalCobrado),
            countPending: pendingTickets.length,
            countCollected: collectedInvoices.length,
            // Métricas mensuales
            mesActualNombre: getMonthName(currentMonth),
            mesAnteriorNombre: getMonthName(mesAnterior),
            totalMesActual: round2(totalMesActual),
            countMesActual: cobrosMesActual.length,
            totalMesAnterior: round2(totalMesAnterior),
            countMesAnterior: cobrosMesAnterior.length,
        };
    }, [pendingTickets, collectedInvoices]);

    // Filtrado por búsqueda
    const filteredPending = useMemo(() => {
        if (!searchTerm.trim()) return pendingTickets;
        const term = searchTerm.toLowerCase();
        return pendingTickets.filter(t =>
            (t.client_ticket_number || '').toLowerCase().includes(term) ||
            (t.clients?.name || '').toLowerCase().includes(term) ||
            (t.branch_offices?.name || '').toLowerCase().includes(term)
        );
    }, [pendingTickets, searchTerm]);

    const filteredHistorial = useMemo(() => {
        if (!searchTerm.trim()) return collectedInvoices;
        const term = searchTerm.toLowerCase();
        return collectedInvoices.filter(inv =>
            (inv.invoice_number || '').toLowerCase().includes(term) ||
            (inv._ticket?.client_ticket_number || '').toLowerCase().includes(term) ||
            (inv._ticket?.clients?.name || '').toLowerCase().includes(term)
        );
    }, [collectedInvoices, searchTerm]);

    // ── HANDLERS ──

    /**
     * FASE 4: Transacción Atómica para crear invoice
     * 
     * Flujo:
     * 1. Validar inputs (Monto base obligatorio, N° OC obligatorio)
     * 2. Calcular IGV y Monto Total
     * 3. INSERT en invoices (status: 'cobrada')
     * 4. Trigger BD actualiza estado_cobranza en tickets
     * 5. Actualización optimista: agregar invoice al estado local
     * 6. Notificación y cierre de modal
     */
    const handleCreateInvoice = async () => {
        // PASO 1: Validación de inputs
        if (!selectedTicket) return;

        const montoBase = parseFloat(invoiceAmountBase) || selectedTicket._montoBase;
        if (isNaN(montoBase) || montoBase <= 0) {
            onToast('Error', 'Ingrese un monto válido');
            return;
        }

        // Verificar si el ticket ya fue cobrado
        if (selectedTicket.estado_cobranza === 'cobrado') {
            onToast('Info', 'Este ticket ya tiene una cobranza registrada');
            return;
        }

        // Determinar el número de documento según el tipo de cobro
        let docNumber: string;
        const ticketId = selectedTicket.id;
        const ticketNum = selectedTicket.client_ticket_number || ticketId;
        const now = new Date().toISOString();
        const montoTotal = round2(montoBase * IGV_MULTIPLIER);

        if (cobroTipo === 'evento_perdida') {
            // Evento de Pérdida: Generar identificador automático
            const timestamp = Date.now();
            docNumber = `EP-${timestamp}`;
        } else {
            // Con OC: Validar que se haya ingresado el número
            if (!invoiceOc.trim()) {
                onToast('Error', 'Ingrese el número de OC');
                return;
            }
            docNumber = invoiceOc.trim().toUpperCase();
        }

        // Payload para INSERT
        const invoicePayload = {
            ticket_id: ticketId,
            amount_base: round2(montoBase),
            amount_total: montoTotal,
            status: 'cobrada' as const,
            invoice_number: docNumber,
            paid_date: now
        };

        // Feedback visual inmediato
        setProcessing(ticketId);

        // Actualización optimista: agregar invoice temporal al estado
        const tempInvoiceId = 'temp_' + Date.now();
        const tempInvoice: Invoice = { ...invoicePayload, id: tempInvoiceId, created_at: now };
        setInvoices(prev => [...prev, tempInvoice]);

        try {
            // PASO 2: INSERT en invoices (única llamada esencial a BD)
            const { data: createdInvoice, error: insertError } = await supabase
                .from('invoices')
                .insert(invoicePayload)
                .select()
                .single();

            if (insertError) throw insertError;

            // PASO 3: Invalidar caché de React Query para forzar re-fetch
            queryClient.invalidateQueries({ queryKey: queryKeys.tickets });

            // Reemplazar invoice temporal con el real
            setInvoices(prev => prev.map(inv => inv.id === tempInvoiceId ? createdInvoice : inv));

            // ACTUALIZACIÓN INSTANTÁNEA: Marcar ticket como cobrado en localTickets
            // Esto recalcula inmediatamente pendingTickets y collectedInvoices
            setLocalTickets(prev => prev.map(t => 
                t.id === ticketId ? { ...t, estado_cobranza: 'cobrado' as const } : t
            ));

            // PASO 4: Cerrar modal y limpiar estados
            setShowCreateModal(false);
            setSelectedTicket(null);
            setInvoiceOc('');
            setInvoiceAmountBase('');

            onToast('✓ Cobranza Registrada', `Ticket ${ticketNum} cobrado: S/ ${fmt(montoTotal)}`);

        } catch (err: any) {
            console.error('[CobranzaManager] Error creando invoice:', err);

            // Revertir: quitar invoice temporal
            setInvoices(prev => prev.filter(inv => inv.id !== tempInvoiceId));

            // Revertir: restaurar estado_cobranza del ticket
            setLocalTickets(prev => prev.map(t => 
                t.id === ticketId ? { ...t, estado_cobranza: 'pendiente' as const } : t
            ));

            onToast('Error', err.message || 'No se pudo registrar la cobranza');
        } finally {
            setProcessing(null);
        }
    };

    const handleOpenCreateModal = (ticket: typeof pendingTickets[0]) => {
        setSelectedTicket(ticket);
        setInvoiceOc('');
        setInvoiceAmountBase(ticket._montoBase ? String(ticket._montoBase) : '');
        setCobroTipo('oc'); // Por defecto, tipo OC
        setShowCreateModal(true);
    };

    const handleCloseModal = () => {
        setShowCreateModal(false);
        setSelectedTicket(null);
        setInvoiceOc('');
        setInvoiceAmountBase('');
        setCobroTipo('oc');
    };

    // Exportar a Excel
    const exportToExcel = () => {
        const data = activeTab === 'pendientes'
            ? filteredPending.map(t => ({
                'Ticket': t.client_ticket_number || t.id,
                'Cliente': t.clients?.name || 'N/A',
                'Sede': t.branch_offices?.name || 'N/A',
                'Monto Base': t._montoBase,
                'Monto c/IGV': t._montoConIGV,
                'Estado': t.estado_cobranza,
            }))
            : filteredHistorial.map(inv => ({
                'Ticket': inv._ticket?.client_ticket_number || inv.ticket_id,
                'Cliente': inv._ticket?.clients?.name || 'N/A',
                'N° OC': inv.invoice_number || 'N/A',
                'Fecha Cobro': inv.paid_date ? new Date(inv.paid_date).toLocaleDateString() : 'N/A',
                'Monto': inv.amount_total,
            }));

        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Cobranzas');
        XLSX.writeFile(wb, `Cobranzas_${new Date().toISOString().split('T')[0]}.xlsx`);
    };

    // ─────────────────────────────────────────────────────────────────────────────
    // RENDER
    // ─────────────────────────────────────────────────────────────────────────────
    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(10px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 10000, padding: '2rem'
        }}>
            <div style={{
                background: '#0F0F1A', border: '1px solid rgba(255,255,255,0.1)',
                width: '100%', maxWidth: '1100px', maxHeight: '85vh',
                borderRadius: '24px', display: 'flex', flexDirection: 'column',
                overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
            }}>
                {/* HEADER */}
                <div style={{
                    padding: '1rem 1.5rem',
                    background: 'rgba(255,255,255,0.02)',
                    borderBottom: '1px solid rgba(255,255,255,0.05)',
                    display: 'flex', flexDirection: 'column', gap: '0.75rem'
                }}>
                    {/* Métricas */}
                    <div style={{ display: 'flex', gap: '1rem' }}>
                        <div style={{
                            flex: 1, background: 'rgba(239,68,68,0.15)',
                            border: '1px solid rgba(239,68,68,0.3)',
                            borderRadius: '12px', padding: '0.75rem 1rem'
                        }}>
                            <div style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.6)', fontWeight: 600, textTransform: 'uppercase' }}>
                                Total por Cobrar
                            </div>
                            <div style={{ fontSize: '1.3rem', color: '#EF4444', fontWeight: 900 }}>
                                S/ {fmt(metrics.totalPendiente)}
                            </div>
                            <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.4)' }}>
                                {metrics.countPending} tickets
                            </div>
                        </div>
                        <div style={{
                            flex: 1, background: 'rgba(16,185,129,0.15)',
                            border: '1px solid rgba(16,185,129,0.3)',
                            borderRadius: '12px', padding: '0.75rem 1rem'
                        }}>
                            <div style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.6)', fontWeight: 600, textTransform: 'uppercase' }}>
                                Total Cobrado
                            </div>
                            <div style={{ fontSize: '1.3rem', color: '#10B981', fontWeight: 900 }}>
                                S/ {fmt(metrics.totalCobrado)}
                            </div>
                            <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.4)' }}>
                                {metrics.countCollected} facturas
                            </div>
                        </div>
                        <div style={{
                            flex: 1, background: 'rgba(59,130,246,0.15)',
                            border: '1px solid rgba(59,130,246,0.3)',
                            borderRadius: '12px', padding: '0.75rem 1rem'
                        }}>
                            <div style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.6)', fontWeight: 600, textTransform: 'uppercase' }}>
                                Cobrado {metrics.mesActualNombre}
                            </div>
                            <div style={{ fontSize: '1.3rem', color: '#3B82F6', fontWeight: 900 }}>
                                S/ {fmt(metrics.totalMesActual)}
                            </div>
                            <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.4)' }}>
                                {metrics.countMesActual} cobros este mes
                            </div>
                        </div>
                    </div>

                    {/* Controles */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <h3 style={{ margin: 0, color: 'white', fontWeight: 900, fontSize: '0.9rem' }}>
                                Administración de Cobranzas
                            </h3>
                            <div style={{ display: 'flex', gap: '0.25rem' }}>
                                <button
                                    onClick={() => setActiveTab('pendientes')}
                                    style={{
                                        background: activeTab === 'pendientes' ? '#3B82F6' : 'rgba(255,255,255,0.05)',
                                        border: 'none', color: 'white', padding: '4px 12px', borderRadius: '6px',
                                        fontSize: '0.7rem', fontWeight: 700, cursor: 'pointer',
                                    }}
                                >
                                    📋 Pendientes ({filteredPending.length})
                                </button>
                                <button
                                    onClick={() => setActiveTab('historial')}
                                    style={{
                                        background: activeTab === 'historial' ? '#10B981' : 'rgba(255,255,255,0.05)',
                                        border: 'none', color: 'white', padding: '4px 12px', borderRadius: '6px',
                                        fontSize: '0.7rem', fontWeight: 700, cursor: 'pointer',
                                    }}
                                >
                                    ✓ Historial ({filteredHistorial.length})
                                </button>
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                            <input
                                type="text"
                                placeholder="🔍 Buscar..."
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                style={{
                                    background: 'rgba(0,0,0,0.3)',
                                    border: '1px solid rgba(255,255,255,0.15)',
                                    borderRadius: '8px', padding: '6px 10px',
                                    color: 'white', fontSize: '0.75rem', width: '200px'
                                }}
                            />
                            <button
                                onClick={loadInvoices}
                                disabled={loading}
                                style={{
                                    background: 'rgba(255,255,255,0.05)',
                                    border: 'none', color: 'white', padding: '6px',
                                    borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center'
                                }}
                            >
                                <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                            </button>
                            <button
                                onClick={exportToExcel}
                                style={{
                                    background: 'rgba(16,185,129,0.1)', color: '#10B981',
                                    border: '1px solid rgba(16,185,129,0.2)', padding: '6px 12px',
                                    borderRadius: '8px', fontSize: '0.75rem', fontWeight: 600,
                                    cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px'
                                }}
                            >
                                <Download size={12} /> Exportar
                            </button>
                            <button
                                onClick={() => {
                                    if (showCreateModal) {
                                        handleCloseModal();
                                    } else if (onClose) {
                                        onClose();
                                    }
                                }}
                                style={{
                                    background: 'rgba(239,68,68,0.15)',
                                    border: '1px solid rgba(239,68,68,0.3)',
                                    color: '#EF4444',
                                    padding: '6px 10px',
                                    borderRadius: '6px',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                }}
                            >
                                <X size={16} />
                            </button>
                        </div>
                    </div>
                </div>

                {/* CONTENT */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '1rem 2rem' }}>
                    {loading ? (
                        <div style={{ textAlign: 'center', padding: '3rem', color: 'rgba(255,255,255,0.5)' }}>
                            <Loader2 size={32} className="animate-spin" style={{ margin: '0 auto' }} />
                            <p style={{ marginTop: '1rem' }}>Cargando...</p>
                        </div>
                    ) : activeTab === 'pendientes' ? (
                        filteredPending.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '3rem', color: 'rgba(255,255,255,0.5)' }}>
                                {searchTerm ? 'No se encontraron tickets' : '✓ No hay tickets pendientes de cobranza'}
                            </div>
                        ) : (
                            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '800px' }}>
                                <thead>
                                    <tr style={{ textAlign: 'left', borderBottom: '2px solid rgba(255,255,255,0.05)' }}>
                                        <th style={{ padding: '12px 8px', fontSize: '0.7rem', fontWeight: 800, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase' }}>N° Ticket</th>
                                        <th style={{ padding: '12px 8px', fontSize: '0.7rem', fontWeight: 800, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase' }}>Cliente</th>
                                        <th style={{ padding: '12px 8px', fontSize: '0.7rem', fontWeight: 800, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase' }}>Sede</th>
                                        <th style={{ padding: '12px 8px', fontSize: '0.7rem', fontWeight: 800, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', textAlign: 'right' }}>Monto</th>
                                        <th style={{ padding: '12px 8px', fontSize: '0.7rem', fontWeight: 800, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', textAlign: 'center' }}>Acción</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredPending.map(ticket => (
                                        <tr key={ticket.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                                            <td style={{ padding: '12px 8px', color: '#60A5FA', fontWeight: 700, fontSize: '0.85rem' }}>
                                                {ticket.client_ticket_number || ticket.id.substring(0, 8)}
                                            </td>
                                            <td style={{ padding: '12px 8px', color: 'rgba(255,255,255,0.7)', fontSize: '0.85rem' }}>
                                                {ticket.clients?.name || 'N/A'}
                                            </td>
                                            <td style={{ padding: '12px 8px', color: 'rgba(255,255,255,0.5)', fontSize: '0.85rem' }}>
                                                {ticket.branch_offices?.name || 'N/A'}
                                            </td>
                                            <td style={{ padding: '12px 8px', textAlign: 'right', fontWeight: 700, color: '#EF4444' }}>
                                                S/ {fmt(ticket._montoConIGV)}
                                            </td>
                                            <td style={{ padding: '12px 8px', textAlign: 'center' }}>
                                                <button
                                                    onClick={() => handleOpenCreateModal(ticket)}
                                                    disabled={processing === ticket.id}
                                                    style={{
                                                        background: '#10B981', border: 'none', color: 'white',
                                                        padding: '6px 12px', borderRadius: '6px',
                                                        fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer',
                                                        opacity: processing === ticket.id ? 0.5 : 1
                                                    }}
                                                >
                                                    {processing === ticket.id ? '...' : 'Registrar OC'}
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )
                    ) : (
                        filteredHistorial.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '3rem', color: 'rgba(255,255,255,0.5)' }}>
                                {searchTerm ? 'No se encontraron registros' : '✓ No hay historial de cobranzas'}
                            </div>
                        ) : (
                            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '600px' }}>
                                <thead>
                                    <tr style={{ textAlign: 'left', borderBottom: '2px solid rgba(255,255,255,0.05)' }}>
                                        <th style={{ padding: '12px 8px', fontSize: '0.7rem', fontWeight: 800, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase' }}>Ticket</th>
                                        <th style={{ padding: '12px 8px', fontSize: '0.7rem', fontWeight: 800, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase' }}>Cliente</th>
                                        <th style={{ padding: '12px 8px', fontSize: '0.7rem', fontWeight: 800, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase' }}>N° OC</th>
                                        <th style={{ padding: '12px 8px', fontSize: '0.7rem', fontWeight: 800, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase' }}>Fecha Cobro</th>
                                        <th style={{ padding: '12px 8px', fontSize: '0.7rem', fontWeight: 800, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', textAlign: 'right' }}>Monto</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredHistorial.map(inv => (
                                        <tr key={inv.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                                            <td style={{ padding: '12px 8px', color: '#60A5FA', fontWeight: 700, fontSize: '0.85rem' }}>
                                                {inv._ticket?.client_ticket_number || inv.ticket_id?.substring(0, 8) || 'N/A'}
                                            </td>
                                            <td style={{ padding: '12px 8px', color: 'rgba(255,255,255,0.7)', fontSize: '0.85rem' }}>
                                                {inv._ticket?.clients?.name || 'N/A'}
                                            </td>
                                            <td style={{ padding: '12px 8px', color: 'rgba(255,255,255,0.5)', fontSize: '0.85rem' }}>
                                                {inv.invoice_number || '-'}
                                            </td>
                                            <td style={{ padding: '12px 8px', color: 'rgba(255,255,255,0.5)', fontSize: '0.85rem' }}>
                                                {inv.paid_date ? new Date(inv.paid_date).toLocaleDateString() : '-'}
                                            </td>
                                            <td style={{ padding: '12px 8px', textAlign: 'right', fontWeight: 700, color: '#10B981' }}>
                                                S/ {fmt(inv.amount_total)}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )
                    )}
                </div>
            </div>

            {/* MODAL: Crear Invoice */}
            {showCreateModal && selectedTicket && (
                <div
                    style={{
                        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                        background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        zIndex: 11000
                    }}
                    onClick={handleCloseModal}
                >
                    <div
                        style={{
                            background: '#0F0F1A', border: '1px solid rgba(255,255,255,0.15)',
                            width: '100%', maxWidth: '450px', borderRadius: '20px', padding: '2rem',
                            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)'
                        }}
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Header con título y botón X */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                            <h3 style={{ margin: 0, color: 'white', fontWeight: 900, fontSize: '1.1rem' }}>
                                {cobroTipo === 'evento_perdida' ? 'Registrar Evento de Pérdida' : 'Registrar Cobro / OC'}
                            </h3>
                            <button
                                onClick={handleCloseModal}
                                style={{
                                    background: 'rgba(255,255,255,0.05)',
                                    border: '1px solid rgba(255,255,255,0.1)',
                                    color: 'rgba(255,255,255,0.7)',
                                    padding: '6px 8px',
                                    borderRadius: '6px',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                }}
                            >
                                <X size={16} />
                            </button>
                        </div>

                        <div style={{ marginBottom: '1rem' }}>
                            <label style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)', display: 'block', marginBottom: '4px' }}>
                                Ticket
                            </label>
                            <div style={{ color: '#60A5FA', fontWeight: 700 }}>
                                {selectedTicket.client_ticket_number || selectedTicket.id}
                            </div>
                        </div>

                        {/* Selector de tipo de cobro */}
                        <div style={{ marginBottom: '1rem' }}>
                            <label style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)', display: 'block', marginBottom: '8px' }}>
                                Tipo de Cobro
                            </label>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <button
                                    type="button"
                                    onClick={() => setCobroTipo('oc')}
                                    style={{
                                        flex: 1,
                                        background: cobroTipo === 'oc' ? 'rgba(16,185,129,0.2)' : 'rgba(0,0,0,0.3)',
                                        border: `1px solid ${cobroTipo === 'oc' ? '#10B981' : 'rgba(255,255,255,0.15)'}`,
                                        color: cobroTipo === 'oc' ? '#10B981' : 'rgba(255,255,255,0.7)',
                                        padding: '10px 12px',
                                        borderRadius: '10px',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '6px',
                                        fontWeight: 700,
                                        fontSize: '0.8rem'
                                    }}
                                >
                                    <FileText size={14} /> Con OC
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setCobroTipo('evento_perdida')}
                                    style={{
                                        flex: 1,
                                        background: cobroTipo === 'evento_perdida' ? 'rgba(239,68,68,0.2)' : 'rgba(0,0,0,0.3)',
                                        border: `1px solid ${cobroTipo === 'evento_perdida' ? '#EF4444' : 'rgba(255,255,255,0.15)'}`,
                                        color: cobroTipo === 'evento_perdida' ? '#EF4444' : 'rgba(255,255,255,0.7)',
                                        padding: '10px 12px',
                                        borderRadius: '10px',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '6px',
                                        fontWeight: 700,
                                        fontSize: '0.8rem'
                                    }}
                                >
                                    <AlertTriangle size={14} /> Evento de Pérdida
                                </button>
                            </div>
                        </div>

                        {/* Campo N° OC (solo visible si es tipo OC) */}
                        {cobroTipo === 'oc' && (
                            <div style={{ marginBottom: '1rem' }}>
                                <label style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)', display: 'block', marginBottom: '4px' }}>
                                    Número de OC *
                                </label>
                                <input
                                    type="text"
                                    value={invoiceOc}
                                    onChange={e => setInvoiceOc(e.target.value)}
                                    placeholder="Ej: OC-2026-001"
                                    style={{
                                        width: '100%', background: 'rgba(0,0,0,0.3)',
                                        border: '1px solid rgba(255,255,255,0.15)', borderRadius: '10px',
                                        padding: '10px 14px', color: 'white', fontSize: '0.9rem',
                                        boxSizing: 'border-box'
                                    }}
                                />
                            </div>
                        )}

                        {/* Aviso de Evento de Pérdida */}
                        {cobroTipo === 'evento_perdida' && (
                            <div style={{
                                marginBottom: '1rem',
                                padding: '10px 12px',
                                background: 'rgba(239,68,68,0.1)',
                                border: '1px solid rgba(239,68,68,0.3)',
                                borderRadius: '8px',
                                fontSize: '0.75rem',
                                color: 'rgba(255,255,255,0.7)'
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                                    <AlertTriangle size={14} color="#EF4444" />
                                    <span style={{ color: '#EF4444', fontWeight: 700 }}>Evento de Pérdida</span>
                                </div>
                                El cobro se registrará sin número de OC. La fecha de cobro se asignará automáticamente.
                            </div>
                        )}

                        {/* Fecha de cobro (solo lectura, automática) */}
                        <div style={{ marginBottom: '1rem' }}>
                            <label style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)', display: 'block', marginBottom: '4px' }}>
                                Fecha de Cobro
                            </label>
                            <div style={{
                                width: '100%', background: 'rgba(16,185,129,0.1)',
                                border: '1px solid rgba(16,185,129,0.3)', borderRadius: '10px',
                                padding: '10px 14px', color: '#10B981', fontSize: '0.9rem',
                                fontWeight: 600
                            }}>
                                📅 {new Date().toLocaleString('es-PE')}
                            </div>
                        </div>

                        <div style={{ marginBottom: '1.5rem' }}>
                            <label style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)', display: 'block', marginBottom: '4px' }}>
                                Monto Base (S/)
                            </label>
                            <input
                                type="number"
                                value={invoiceAmountBase}
                                onChange={e => setInvoiceAmountBase(e.target.value)}
                                placeholder={`Default: S/ ${fmt(selectedTicket._montoBase)}`}
                                style={{
                                    width: '100%', background: 'rgba(0,0,0,0.3)',
                                    border: '1px solid rgba(255,255,255,0.15)', borderRadius: '10px',
                                    padding: '10px 14px', color: 'white', fontSize: '0.9rem',
                                    boxSizing: 'border-box'
                                }}
                            />

                            {/* Desglose de IGV en tiempo real */}
                            {(() => {
                                const base = parseFloat(invoiceAmountBase) || selectedTicket._montoBase || 0;
                                const igv = round2(base * IGV_RATE);
                                const total = round2(base * IGV_MULTIPLIER);
                                return (
                                    <div style={{
                                        marginTop: '8px', padding: '10px 12px',
                                        background: 'rgba(16,185,129,0.1)',
                                        border: '1px solid rgba(16,185,129,0.2)',
                                        borderRadius: '8px', fontSize: '0.75rem'
                                    }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                                            <span style={{ color: 'rgba(255,255,255,0.5)' }}>Base Imponible:</span>
                                            <span style={{ color: 'white', fontWeight: 600 }}>S/ {fmt(base)}</span>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                                            <span style={{ color: 'rgba(255,255,255,0.5)' }}>IGV (18%):</span>
                                            <span style={{ color: 'white', fontWeight: 600 }}>S/ {fmt(igv)}</span>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid rgba(16,185,129,0.3)', paddingTop: '4px' }}>
                                            <span style={{ color: '#10B981', fontWeight: 700 }}>TOTAL:</span>
                                            <span style={{ color: '#10B981', fontWeight: 900, fontSize: '1rem' }}>S/ {fmt(total)}</span>
                                        </div>
                                    </div>
                                );
                            })()}
                        </div>

                        <div style={{ display: 'flex', gap: '1rem' }}>
                            <button
                                onClick={handleCloseModal}
                                disabled={processing === selectedTicket.id}
                                style={{
                                    flex: 1, background: 'rgba(255,255,255,0.05)', border: 'none',
                                    color: 'white', padding: '10px', borderRadius: '10px',
                                    fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer'
                                }}
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleCreateInvoice}
                                disabled={processing === selectedTicket.id}
                                style={{
                                    flex: 1,
                                    background: processing === selectedTicket.id ? '#0d8a5a' : '#10B981',
                                    border: 'none', color: 'white', padding: '10px', borderRadius: '10px',
                                    fontSize: '0.85rem', fontWeight: 700,
                                    cursor: processing === selectedTicket.id ? 'not-allowed' : 'pointer',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
                                }}
                            >
                                {processing === selectedTicket.id ? (
                                    <><Loader2 size={14} className="animate-spin" /> Procesando...</>
                                ) : (
                                    <><CheckCircle2 size={14} /> Registrar Cobro</>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <style>{`
                @keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
                .animate-spin { animation: spin 1s linear infinite; }
            `}</style>
        </div>
    );
}
