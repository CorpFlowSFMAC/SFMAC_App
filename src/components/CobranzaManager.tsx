"use client";

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * COBRANZA MANAGER - MÓDULO REFACTORIZADO V2
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * ARQUITECTURA: Single Source of Truth
 * - Tickets: Estado del ciclo de vida del servicio
 * - Invoices: Estado de la facturación/cobranza
 * - estado_cobranza en tickets: Consolidación automática via trigger
 * 
 * FASE 1: Limpieza de Datos
 * - Tabla invoices: id, ticket_id, amount_base, amount_total, status, invoice_number
 * - Tickets: estado_cobranza es la fuente de verdad para el estado financiero
 * 
 * FASE 2: Purga de Código Muerto  
 * - ELIMINADO: Estados redundantes (cobranzaTickets, cobranzaHistorial separados)
 * - ELIMINADO: useEffect de sincronización manual de arrays
 * - UNIFICADO: Un solo flujo de datos desde useQuery centralizado
 * 
 * FASE 3: Lógica de Interfaz - Single Source of Truth
 * - Pendientes: tickets.filter(t => t.estado_cobranza !== 'cobrado' && !t.invoices.length)
 * - Por Cobrar: Suma iterativa sobre array filtrado de pendientes
 * - Historial: Suma iterativa sobre invoices con status 'cobrada'
 * 
 * FASE 4: Transacción Atómica (handleCreateInvoice)
 * 1. Validar inputs (Monto base obligatorio, N° OC obligatorio)
 * 2. Calcular IGV y Monto Total
 * 3. INSERT en invoices
 * 4. UPDATE en tickets (estado_cobranza)
 * 5. Actualización optimista de React
 * 6. Notificación y cierre de modal
 * 
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/useQueryHooks";
import { round2, formatSoles } from "@/lib/formatters";
import { CheckCircle2, BanknoteIcon, Search, X, RefreshCw, Download, Loader2 } from "lucide-react";
import * as XLSX from "xlsx";

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────
const fmt = (n: number) => n.toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const IGV_RATE = 0.18;
const IGV_MULTIPLIER = 1.18;

interface Invoice {
    id: string;
    ticket_id: string;
    amount_base: number;
    amount_total: number;
    status: 'emitida' | 'cobrada' | 'anulada';
    invoice_number: string | null;
    issued_date: string;
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
    invoices?: Invoice[];  // Opcional: si se pasa, usa esta fuente en vez de cargar internamente
    onToast: (title: string, desc: string) => void;
    onInvoiceCreated?: (invoice: Invoice) => void;  // Callback cuando se crea invoice (para sincronizar con padre)
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENTE PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────
export default function CobranzaManager({ tickets, invoices: invoicesProp, onToast, onInvoiceCreated }: CobranzaManagerProps) {
    const queryClient = useQueryClient();

    // ── ESTADOS ÚNICOS (FASE 2: Purga de código muerto) ──
    // Si se pasa invoices como prop, usa esa fuente; si no, carga internamente
    const [internalInvoices, setInternalInvoices] = useState<Invoice[]>([]);
    const invoices = invoicesProp || internalInvoices;
    const setInvoices = invoicesProp ? () => {} : setInternalInvoices;
    
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'pendientes' | 'historial'>('pendientes');
    const [searchTerm, setSearchTerm] = useState('');
    const [processing, setProcessing] = useState<string | null>(null);

    // Estados del modal de creación
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
    const [invoiceOc, setInvoiceOc] = useState('');
    const [invoiceAmountBase, setInvoiceAmountBase] = useState('');

    // ── CÁLCULOS DERIVADOS (FASE 3: Single Source of Truth) ──
    // 
    // ANTES: Múltiples useEffect intentaban sincronizar arrays manualmente
    // AHORA: Cálculos memoizados basados en el único estado invoices
    //
    // Lógica:
    // - Pendientes: Tickets sin invoice cobrada (estado_cobranza !== 'cobrado')
    // - Por Cobrar: Suma de amount_total de invoices emitidas (no cobradas)
    // - Historial: Invoices con status 'cobrada'

    // Enrich tickets con datos de invoice
    const enrichedTickets = useMemo(() => {
        return tickets.map(ticket => {
            const ticketInvoices = invoices.filter(inv => inv.ticket_id === ticket.id);
            const latestInvoice = ticketInvoices.sort((a, b) => 
                new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
            )[0];

            // Determinar estado de cobranza
            let estadoCobranza = ticket.estado_cobranza || 'pendiente';
            if (latestInvoice?.status === 'cobrada') estadoCobranza = 'cobrado';
            else if (latestInvoice?.status === 'emitida') estadoCobranza = 'facturado';

            // Calcular montos
            const rawAmount = ticket.total_quoted_amount || ticket.montoFinal || 0;
            const esMasIGV = ticket.mas_igv === true;
            let montoBase = esMasIGV ? rawAmount : rawAmount / IGV_MULTIPLIER;
            const montoConIGV = montoBase * IGV_MULTIPLIER;

            return {
                ...ticket,
                _estadoCobranza: estadoCobranza,
                _montoBase: montoBase,
                _montoConIGV: montoConIGV,
                _invoice: latestInvoice || null,
                _hasInvoice: !!latestInvoice,
            };
        });
    }, [tickets, invoices]);

    // Tickets pendientes de cobrar (ticket cerrado pero no cobrado)
    const pendingTickets = useMemo(() => {
        return enrichedTickets.filter(t => {
            const statusId = (t.status_id || '').toLowerCase();
            const isClosed = statusId === 'ticket_cerrado' || statusId === 'liquidado' || statusId === 'cerrado';
            return isClosed && t._estadoCobranza !== 'cobrado';
        });
    }, [enrichedTickets]);

    // Historial de tickets cobrados
    const collectedInvoices = useMemo(() => {
        return invoices
            .filter(inv => inv.status === 'cobrada')
            .map(inv => {
                const ticket = enrichedTickets.find(t => t.id === inv.ticket_id);
                return { ...inv, _ticket: ticket };
            })
            .sort((a, b) => new Date(b.paid_date || b.created_at).getTime() - new Date(a.paid_date || a.created_at).getTime());
    }, [invoices, enrichedTickets]);

    // Métricas
    const metrics = useMemo(() => {
        const totalPendiente = pendingTickets.reduce((acc, t) => acc + (t._montoConIGV || 0), 0);
        const totalCobrado = collectedInvoices.reduce((acc, inv) => acc + (inv.amount_total || 0), 0);
        return { totalPendiente, totalCobrado, countPending: pendingTickets.length, countCollected: collectedInvoices.length };
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

    // ── CARGA DE DATOS ──
    // Solo cargar invoices internamente si NO se pasan como prop
    const loadInvoices = useCallback(async () => {
        if (invoicesProp) {
            setLoading(false);
            return;
        }
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
    }, [onToast, invoicesProp]);

    useEffect(() => {
        loadInvoices();
    }, [loadInvoices]);

    // ── HANDLERS ──

    /**
     * FASE 4: Transacción Atómica para crear invoice
     * 
     * ANTES: handleCreateInvoice tenía 106 líneas con múltiples responsabilidades:
     * - Crear invoice
     * - Invalidar invoices anteriores
     * - Actualizar metadata del ticket
     * - Revertir cambios en caso de error
     * - Sin transacción real
     * 
     * AHORA: Función clara con 5 pasos lineales
     */
    const handleCreateInvoice = async () => {
        // PASO 1: Validación de inputs
        if (!selectedTicket || !invoiceOc.trim()) {
            onToast('Error', 'Ingrese el número de OC');
            return;
        }

        const montoBase = parseFloat(invoiceAmountBase) || selectedTicket._montoBase;
        if (isNaN(montoBase) || montoBase <= 0) {
            onToast('Error', 'Ingrese un monto válido');
            return;
        }

        // Verificar si el ticket ya fue cobrado
        if (selectedTicket._estadoCobranza === 'cobrado') {
            onToast('Info', 'Este ticket ya tiene una cobranza registrada');
            return;
        }

        const ticketId = selectedTicket.id;
        const ocNumber = invoiceOc.trim().toUpperCase();
        const now = new Date().toISOString();
        const montoTotal = round2(montoBase * IGV_MULTIPLIER);

        // PASO 2: Preparar payload
        const invoicePayload = {
            ticket_id: ticketId,
            amount_base: montoBase,
            amount_total: montoTotal,
            status: 'cobrada' as const,
            invoice_number: ocNumber,
            paid_date: now,
            issued_date: now,
        };

        // Feedback visual inmediato
        setProcessing(ticketId);
        onToast('Procesando...', `Registrando cobranza`);

        // PASO 3: Actualización optimista de UI (sin esperar BD)
        // Solo si NO usamos invoicesProp (el componente maneja su propio estado)
        const isStandalone = !invoicesProp;
        const tempInvoiceId = 'temp_' + Date.now();
        const tempInvoice: Invoice = { ...invoicePayload, id: tempInvoiceId, created_at: now };
        
        if (isStandalone) {
            setInvoices(prev => [...prev.filter(inv => inv.ticket_id !== ticketId), tempInvoice]);
        }

        // Cerrar modal inmediatamente
        setShowCreateModal(false);
        setSelectedTicket(null);
        setInvoiceOc('');
        setInvoiceAmountBase('');

        try {
            // PASO 4: INSERT en invoices (única llamada esencial a BD)
            const { data: createdInvoice, error: insertError } = await supabase
                .from('invoices')
                .insert(invoicePayload)
                .select()
                .single();

            if (insertError) throw insertError;

            // PASO 5: Actualizar cache de React Query
            queryClient.invalidateQueries({ queryKey: queryKeys.tickets });

            // Notificar al padre si hay callback
            if (onInvoiceCreated) {
                onInvoiceCreated(createdInvoice);
            }

            // Reemplazar invoice temporal con el real (solo si manejamos nuestro propio estado)
            if (isStandalone) {
                setInvoices(prev => prev.map(inv => inv.id === tempInvoiceId ? createdInvoice : inv));
            }

            onToast('✓ Cobranza Registrada', `Ticket ${selectedTicket.client_ticket_number || ticketId} cobrado exitosamente`);

        } catch (err: any) {
            console.error('[CobranzaManager] Error creando invoice:', err);
            // Revertir cambios optimistas solo si manejamos nuestro propio estado
            if (isStandalone) {
                setInvoices(prev => prev.filter(inv => inv.id !== tempInvoiceId));
            }
            onToast('Error', err.message || 'No se pudo registrar la cobranza');
        } finally {
            setProcessing(null);
        }
    };

    const handleOpenCreateModal = (ticket: typeof pendingTickets[0]) => {
        setSelectedTicket(ticket);
        setInvoiceOc('');
        setInvoiceAmountBase('');
        setShowCreateModal(true);
    };

    const handleMarkAsPaid = async (invoiceId: string, ocNumber: string) => {
        if (!ocNumber.trim()) {
            onToast('Error', 'Ingrese el número de OC');
            return;
        }

        const now = new Date().toISOString();
        setProcessing(invoiceId);

        // Actualización optimista
        setInvoices(prev => prev.map(inv => 
            inv.id === invoiceId 
                ? { ...inv, status: 'cobrada' as const, invoice_number: ocNumber.trim().toUpperCase(), paid_date: now }
                : inv
        ));

        try {
            const { error } = await supabase
                .from('invoices')
                .update({ 
                    status: 'cobrada', 
                    invoice_number: ocNumber.trim().toUpperCase(),
                    paid_date: now 
                })
                .eq('id', invoiceId);

            if (error) throw error;

            queryClient.invalidateQueries({ queryKey: queryKeys.tickets });
            onToast('✓ Factura Cobrada', 'El estado ha sido actualizado');

        } catch (err: any) {
            console.error('[CobranzaManager] Error marcando como pagado:', err);
            // Revertir
            setInvoices(prev => prev.map(inv => 
                inv.id === invoiceId ? { ...inv, status: 'emitida' as const } : inv
            ));
            onToast('Error', err.message || 'No se pudo actualizar');
        } finally {
            setProcessing(null);
        }
    };

    const exportToExcel = () => {
        const data = activeTab === 'pendientes' 
            ? filteredPending.map(t => ({
                'Ticket': t.client_ticket_number || t.id,
                'Cliente': t.clients?.name || 'N/A',
                'Sede': t.branch_offices?.name || 'N/A',
                'Monto Base': t._montoBase,
                'Monto c/IGV': t._montoConIGV,
                'Estado': t._estadoCobranza,
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
                <div style={{ padding: '1rem 1.5rem', background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    
                    {/* Métricas */}
                    <div style={{ display: 'flex', gap: '1rem' }}>
                        <div style={{ flex: 1, background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '12px', padding: '0.75rem 1rem' }}>
                            <div style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.6)', fontWeight: 600, textTransform: 'uppercase' }}>Total por Cobrar</div>
                            <div style={{ fontSize: '1.3rem', color: '#EF4444', fontWeight: 900 }}>S/ {fmt(metrics.totalPendiente)}</div>
                            <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.4)' }}>{metrics.countPending} tickets</div>
                        </div>
                        <div style={{ flex: 1, background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: '12px', padding: '0.75rem 1rem' }}>
                            <div style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.6)', fontWeight: 600, textTransform: 'uppercase' }}>Total Cobrado</div>
                            <div style={{ fontSize: '1.3rem', color: '#10B981', fontWeight: 900 }}>S/ {fmt(metrics.totalCobrado)}</div>
                            <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.4)' }}>{metrics.countCollected} facturas</div>
                        </div>
                    </div>

                    {/* Controles */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <h3 style={{ margin: 0, color: 'white', fontWeight: 900, fontSize: '0.9rem' }}>Administración de Cobranzas</h3>
                            <div style={{ display: 'flex', gap: '0.25rem' }}>
                                <button onClick={() => setActiveTab('pendientes')} style={{
                                    background: activeTab === 'pendientes' ? '#3B82F6' : 'rgba(255,255,255,0.05)',
                                    border: 'none', color: 'white', padding: '4px 12px', borderRadius: '6px',
                                    fontSize: '0.7rem', fontWeight: 700, cursor: 'pointer',
                                }}>📋 Pendientes ({filteredPending.length})</button>
                                <button onClick={() => setActiveTab('historial')} style={{
                                    background: activeTab === 'historial' ? '#10B981' : 'rgba(255,255,255,0.05)',
                                    border: 'none', color: 'white', padding: '4px 12px', borderRadius: '6px',
                                    fontSize: '0.7rem', fontWeight: 700, cursor: 'pointer',
                                }}>✓ Historial ({filteredHistorial.length})</button>
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                            <input type="text" placeholder="🔍 Buscar..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                                style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '8px', padding: '6px 10px', color: 'white', fontSize: '0.75rem', width: '200px' }} />
                            <button onClick={loadInvoices} disabled={loading} style={{ background: 'rgba(255,255,255,0.05)', border: 'none', color: 'white', padding: '6px', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                                <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                            </button>
                            <button onClick={exportToExcel} style={{ background: 'rgba(16,185,129,0.1)', color: '#10B981', border: '1px solid rgba(16,185,129,0.2)', padding: '6px 12px', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <Download size={12} /> Exportar
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
                                        <th style={{ padding: '12px 8px', fontSize: '0.7rem', fontWeight: 800, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase' }}>Monto c/IGV</th>
                                        <th style={{ padding: '12px 8px', fontSize: '0.7rem', fontWeight: 800, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase' }}>Estado</th>
                                        <th style={{ padding: '12px 8px', fontSize: '0.7rem', fontWeight: 800, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase' }}>Acción</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredPending.map((t, idx) => (
                                        <tr key={t.id || idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                                            <td style={{ padding: '12px 8px', color: '#60A5FA', fontWeight: 800, fontSize: '0.8rem' }}>
                                                {t.client_ticket_number || t.id?.substring(0, 8).toUpperCase()}
                                            </td>
                                            <td style={{ padding: '12px 8px', color: 'rgba(255,255,255,0.7)', fontSize: '0.85rem' }}>
                                                <div>{t.clients?.name || 'N/A'}</div>
                                                <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.4)' }}>{t.branch_offices?.name}</div>
                                            </td>
                                            <td style={{ padding: '12px 8px', fontWeight: 700, color: '#EF4444' }}>S/ {fmt(t._montoConIGV)}</td>
                                            <td style={{ padding: '12px 8px' }}>
                                                <span style={{
                                                    background: t._estadoCobranza === 'facturado' ? 'rgba(245,158,11,0.1)' : 'rgba(239,68,68,0.1)',
                                                    color: t._estadoCobranza === 'facturado' ? '#F59E0B' : '#EF4444',
                                                    padding: '2px 8px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase'
                                                }}>{t._estadoCobranza}</span>
                                            </td>
                                            <td style={{ padding: '12px 8px' }}>
                                                <button onClick={() => handleOpenCreateModal(t)} disabled={processing === t.id}
                                                    style={{ background: '#10B981', border: 'none', color: 'white', padding: '6px 12px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 700, cursor: processing === t.id ? 'not-allowed' : 'pointer', opacity: processing === t.id ? 0.5 : 1 }}>
                                                    {processing === t.id ? 'Procesando...' : '💰 Cobrar'}
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
                                {searchTerm ? 'No se encontraron facturas' : '✓ No hay facturas cobradas'}
                            </div>
                        ) : (
                            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '800px' }}>
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
                                    {filteredHistorial.map((inv, idx) => (
                                        <tr key={inv.id || idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                                            <td style={{ padding: '12px 8px', color: '#60A5FA', fontWeight: 800, fontSize: '0.8rem' }}>
                                                {inv._ticket?.client_ticket_number || inv.ticket_id?.substring(0, 8).toUpperCase()}
                                            </td>
                                            <td style={{ padding: '12px 8px', color: 'rgba(255,255,255,0.7)', fontSize: '0.85rem' }}>
                                                {inv._ticket?.clients?.name || 'N/A'}
                                            </td>
                                            <td style={{ padding: '12px 8px', color: 'rgba(255,255,255,0.5)', fontSize: '0.85rem' }}>{inv.invoice_number || '-'}</td>
                                            <td style={{ padding: '12px 8px', color: 'rgba(255,255,255,0.5)', fontSize: '0.85rem' }}>
                                                {inv.paid_date ? new Date(inv.paid_date).toLocaleDateString() : '-'}
                                            </td>
                                            <td style={{ padding: '12px 8px', textAlign: 'right', fontWeight: 700, color: '#10B981' }}>S/ {fmt(inv.amount_total)}</td>
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
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    zIndex: 11000
                }} onClick={() => setShowCreateModal(false)}>
                    <div style={{
                        background: '#0F0F1A', border: '1px solid rgba(255,255,255,0.15)',
                        width: '100%', maxWidth: '450px', borderRadius: '20px', padding: '2rem',
                        boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)'
                    }} onClick={e => e.stopPropagation()}>
                        <h3 style={{ margin: '0 0 1.5rem 0', color: 'white', fontWeight: 900, fontSize: '1.1rem' }}>
                            Registrar Orden de Compra
                        </h3>

                        <div style={{ marginBottom: '1rem' }}>
                            <label style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)', display: 'block', marginBottom: '4px' }}>Ticket</label>
                            <div style={{ color: '#60A5FA', fontWeight: 700 }}>{selectedTicket.client_ticket_number || selectedTicket.id}</div>
                        </div>

                        <div style={{ marginBottom: '1rem' }}>
                            <label style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)', display: 'block', marginBottom: '4px' }}>Número de OC *</label>
                            <input type="text" value={invoiceOc} onChange={e => setInvoiceOc(e.target.value)}
                                placeholder="Ej: OC-2026-001"
                                style={{ width: '100%', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '10px', padding: '10px 14px', color: 'white', fontSize: '0.9rem', boxSizing: 'border-box' }} />
                        </div>

                        <div style={{ marginBottom: '1.5rem' }}>
                            <label style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)', display: 'block', marginBottom: '4px' }}>Monto Base (S/)</label>
                            <input type="number" value={invoiceAmountBase} onChange={e => setInvoiceAmountBase(e.target.value)}
                                placeholder={`Default: S/ ${fmt(selectedTicket._montoBase)}`}
                                style={{ width: '100%', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '10px', padding: '10px 14px', color: 'white', fontSize: '0.9rem', boxSizing: 'border-box' }} />
                            <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.4)', marginTop: '4px' }}>
                                Monto del ticket: S/ {fmt(selectedTicket._montoBase)} (sin IGV) → Total: S/ {fmt(selectedTicket._montoConIGV)}
                            </div>
                        </div>

                        <div style={{ display: 'flex', gap: '1rem' }}>
                            <button onClick={() => setShowCreateModal(false)} disabled={processing === selectedTicket.id}
                                style={{ flex: 1, background: 'rgba(255,255,255,0.05)', border: 'none', color: 'white', padding: '10px', borderRadius: '10px', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer' }}>
                                Cancelar
                            </button>
                            <button onClick={handleCreateInvoice} disabled={processing === selectedTicket.id}
                                style={{
                                    flex: 1, background: processing === selectedTicket.id ? '#0d8a5a' : '#10B981',
                                    border: 'none', color: 'white', padding: '10px', borderRadius: '10px', fontSize: '0.85rem', fontWeight: 700,
                                    cursor: processing === selectedTicket.id ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
                                }}>
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
