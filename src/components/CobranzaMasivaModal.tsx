"use client";

import React, { useState, useMemo, useCallback, useRef } from "react";
import {
    CheckSquare, Square, Search, FileText, CheckCircle2,
    AlertCircle, X, Sparkles, RefreshCw, Layers, DollarSign,
    Calendar, ArrowRight, ShieldCheck, Filter, UploadCloud,
    Paperclip, Trash2, Check, FileCheck
} from "lucide-react";
import { supabase } from "@/lib/supabase";

interface CobranzaMasivaModalProps {
    isOpen: boolean;
    onClose: () => void;
    pendingItems: any[]; // items de cobranzaItems con status !== 'cobrada'
    triggerToast: (title: string, desc: string) => void;
    handleUpdateTicket: (id: string, updates: any) => Promise<any>;
    refreshTickets: () => Promise<void>;
    setInvoices: React.Dispatch<React.SetStateAction<any[]>>;
    setRealtimeOverrides: React.Dispatch<React.SetStateAction<Record<string, any>>>;
    onSuccess?: () => void;
}

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const fmt = (n: number) => n.toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function CobranzaMasivaModal({
    isOpen,
    onClose,
    pendingItems,
    triggerToast,
    handleUpdateTicket,
    refreshTickets,
    setInvoices,
    setRealtimeOverrides,
    onSuccess
}: CobranzaMasivaModalProps) {
    if (!isOpen) return null;

    // ── Formulario de Cabecera de la OC ─────────────────────────────
    const [ocNumber, setOcNumber] = useState("");
    const [fechaOc, setFechaOc] = useState(() => new Date().toISOString().split("T")[0]);
    const [docNumber, setDocNumber] = useState(""); // N° Factura / Boleta
    const [fechaCobro, setFechaCobro] = useState(() => new Date().toISOString().split("T")[0]);
    const [expectedTotal, setExpectedTotal] = useState(""); // Total OC del PDF para cuadre
    const [observaciones, setObservaciones] = useState("");

    // ── Búsqueda y Selección de Tickets ─────────────────────────────
    const [searchTerm, setSearchTerm] = useState("");
    const [clientFilter, setClientFilter] = useState("all");
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    // ── Adjuntar Archivo PDF de la OC ───────────────────────────────
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [pdfFile, setPdfFile] = useState<File | null>(null);
    const [isParsingPdf, setIsParsingPdf] = useState(false);
    const [isDragging, setIsDragging] = useState(false);

    // ── Caja de Pegado Rápido Alternativa (Manual) ──────────────────
    const [showManualPaste, setShowManualPaste] = useState(false);
    const [pastedText, setPastedText] = useState("");
    const [detectionReport, setDetectionReport] = useState<{
        detected: number;
        matched: number;
        notFound: string[];
        source: 'pdf' | 'text';
    } | null>(null);

    // ── Estado de Procesamiento en Lote ─────────────────────────────
    const [isProcessing, setIsProcessing] = useState(false);
    const [progress, setProgress] = useState({ current: 0, total: 0 });

    // Extraer lista única de clientes para el filtro
    const clientOptions = useMemo(() => {
        const set = new Set<string>();
        pendingItems.forEach(item => {
            if (item.clientName && item.clientName !== 'N/A') set.add(item.clientName);
        });
        return Array.from(set);
    }, [pendingItems]);

    // Tickets filtrados para el listado interactivo
    const filteredItems = useMemo(() => {
        return pendingItems.filter(item => {
            if (clientFilter !== "all" && item.clientName !== clientFilter) return false;
            if (!searchTerm.trim()) return true;
            const q = searchTerm.toLowerCase();
            return (
                item.ticketNum.toLowerCase().includes(q) ||
                item.clientName.toLowerCase().includes(q) ||
                item.agencia.toLowerCase().includes(q)
            );
        });
    }, [pendingItems, clientFilter, searchTerm]);

    // ── Totales de los Tickets Seleccionados ─────────────────────────
    const selectedItems = useMemo(() => {
        return pendingItems.filter(item => selectedIds.has(item.id));
    }, [pendingItems, selectedIds]);

    const batchTotals = useMemo(() => {
        let total = 0;
        let base = 0;
        selectedItems.forEach(i => {
            total += Number(i.monto || 0);
            base += Number(i.montoSinIGV || (i.monto ? i.monto / 1.18 : 0));
        });
        total = round2(total);
        base = round2(base);
        const igv = round2(total - base);

        const expNum = expectedTotal && !isNaN(parseFloat(expectedTotal)) ? parseFloat(expectedTotal) : null;
        const diff = expNum !== null ? round2(total - expNum) : null;
        const isBalanced = diff !== null ? Math.abs(diff) < 0.05 : null;

        return { count: selectedItems.length, base, igv, total, expNum, diff, isBalanced };
    }, [selectedItems, expectedTotal]);

    // ── Toggle selección individual ─────────────────────────────────
    const toggleSelect = useCallback((id: string) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    }, []);

    // ── Seleccionar todos los visibles ──────────────────────────────
    const handleSelectAllVisible = () => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            filteredItems.forEach(item => next.add(item.id));
            return next;
        });
    };

    // ── Deseleccionar todos ─────────────────────────────────────────
    const handleClearSelection = () => {
        setSelectedIds(new Set());
    };

    // ── Manejo de Archivo PDF Seleccionado ──────────────────────────
    const handleFileSelect = (file: File) => {
        if (!file.name.toLowerCase().endsWith(".pdf")) {
            triggerToast("Error", "El archivo debe ser un documento PDF.");
            return;
        }
        setPdfFile(file);
        // Sugerir ejecutar la extracción automática
        triggerToast("PDF Adjunto", `Archivo "${file.name}" cargado. Haz clic en "Detectar y Marcar Tickets Automáticamente".`);
    };

    // ── Algoritmo Principal: Extraer y Marcar Tickets desde PDF o Texto ─
    const handleDetectAndSelectTickets = async () => {
        // Caso 1: Se adjuntó un archivo PDF
        if (pdfFile) {
            setIsParsingPdf(true);
            try {
                const formData = new FormData();
                formData.append("file", pdfFile);

                const response = await fetch("/api/v3/parse-oc-pdf", {
                    method: "POST",
                    body: formData
                });

                const data = await response.json();
                if (!response.ok || !data.success) {
                    throw new Error(data.error || "No se pudo procesar el archivo PDF.");
                }

                // 1. Auto-completar datos de la OC si no estaban llenos o desde el PDF
                if (data.ocNumber) {
                    setOcNumber(data.ocNumber);
                }
                if (data.fechaOc) {
                    setFechaOc(data.fechaOc);
                }
                if (data.total && data.total > 0) {
                    setExpectedTotal(data.total.toFixed(2));
                }

                // 2. Extraer lista de códigos de ticket encontrados en el PDF
                const detectedCodes: string[] = data.tickets || [];
                if (detectedCodes.length === 0) {
                    triggerToast("Aviso", "El PDF fue leído pero no se detectaron códigos de ticket en su contenido.");
                    return;
                }

                // 3. Buscar y marcar los tickets en la lista de pendientes
                const newSelection = new Set<string>();
                let matchedCount = 0;
                const notFoundCodes: string[] = [];

                detectedCodes.forEach(code => {
                    const cleanCode = code.replace(/[^A-Z0-9]/g, '');
                    const found = pendingItems.find(item => {
                        const itemCode = (item.ticketNum || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
                        return itemCode === cleanCode || itemCode.includes(cleanCode) || cleanCode.includes(itemCode);
                    });

                    if (found) {
                        newSelection.add(found.id);
                        matchedCount++;
                    } else {
                        notFoundCodes.push(code);
                    }
                });

                setSelectedIds(newSelection);
                setDetectionReport({
                    detected: detectedCodes.length,
                    matched: matchedCount,
                    notFound: notFoundCodes,
                    source: 'pdf'
                });

                if (data.rawText) {
                    setPastedText(data.rawText);
                }

                triggerToast(
                    "¡PDF Analizado con Éxito!",
                    `OC ${data.ocNumber || ''}: Se detectaron ${detectedCodes.length} tickets en el PDF. ${matchedCount} marcados automáticamente.`
                );

            } catch (err: any) {
                console.error("Error al procesar PDF:", err);
                triggerToast("Error al leer PDF", err?.message || "No se pudo leer el archivo PDF.");
            } finally {
                setIsParsingPdf(false);
            }
            return;
        }

        // Caso 2: No hay archivo PDF, pero el usuario pegó texto en la caja manual
        if (pastedText.trim()) {
            const regex = /([A-Z]{2,4}\d{4,8}(?:\.\d{2})?)/gi;
            const matches = pastedText.match(regex) || [];
            const detectedCodes = Array.from(new Set(matches.map(m => m.trim().toUpperCase())));

            if (detectedCodes.length === 0) {
                triggerToast("Aviso", "No se encontraron códigos de ticket válidos en el texto.");
                return;
            }

            const newSelection = new Set(selectedIds);
            let matchedCount = 0;
            const notFoundCodes: string[] = [];

            detectedCodes.forEach(code => {
                const cleanCode = code.replace(/[^A-Z0-9]/g, '');
                const found = pendingItems.find(item => {
                    const itemCode = (item.ticketNum || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
                    return itemCode === cleanCode || itemCode.includes(cleanCode) || cleanCode.includes(itemCode);
                });

                if (found) {
                    newSelection.add(found.id);
                    matchedCount++;
                } else {
                    notFoundCodes.push(code);
                }
            });

            setSelectedIds(newSelection);
            setDetectionReport({
                detected: detectedCodes.length,
                matched: matchedCount,
                notFound: notFoundCodes,
                source: 'text'
            });

            triggerToast(
                "Detección Completada",
                `Se detectaron ${detectedCodes.length} tickets en el texto. ${matchedCount} encontrados y marcados.`
            );
            return;
        }

        // Caso 3: Ni archivo ni texto
        triggerToast("Acción Requerida", "Por favor adjunte un archivo PDF de la Orden de Compra o pegue la lista de tickets.");
    };

    // ── Ejecución del Cobro Masivo ──────────────────────────────────
    const handleExecuteBatchCobro = async () => {
        if (!ocNumber.trim()) {
            triggerToast("Error", "Debe ingresar el N° de Orden de Compra (OC).");
            return;
        }
        if (selectedItems.length === 0) {
            triggerToast("Error", "Debe seleccionar al menos un ticket para registrar el cobro.");
            return;
        }

        setIsProcessing(true);
        const totalToProcess = selectedItems.length;
        setProgress({ current: 0, total: totalToProcess });

        const paidDateISO = fechaCobro ? new Date(fechaCobro + "T12:00:00Z").toISOString() : new Date().toISOString();
        const finalOcNum = ocNumber.trim();
        const finalDocNum = docNumber.trim() || null;
        const finalFechaOc = fechaOc.trim() || null;
        const finalObs = observaciones.trim() || null;

        const newOverrides: Record<string, any> = {};
        let successCount = 0;
        let failCount = 0;

        try {
            for (let i = 0; i < selectedItems.length; i++) {
                const item = selectedItems[i];
                setProgress({ current: i + 1, total: totalToProcess });

                const itemTotal = round2(item.monto || 0);
                const itemBase = round2(item.montoSinIGV || (itemTotal > 0 ? itemTotal / 1.18 : 0));
                const itemIgv = round2(itemTotal - itemBase);

                try {
                    // 1. Guardar o actualizar la factura en 'invoices'
                    if (item.rawInvoice) {
                        const { error: invErr } = await supabase
                            .from('invoices')
                            .update({
                                status: 'cobrada',
                                payment_date: paidDateISO,
                                invoice_number: finalOcNum,
                                doc_number: finalDocNum,
                                amount_base: itemBase,
                                amount_total: itemTotal,
                                amount_igv: itemIgv
                            })
                            .eq('id', item.rawInvoice.id);

                        if (invErr) throw invErr;
                    } else {
                        const invoicePayload = {
                            ticket_id: item.ticketId,
                            client_id: item.rawTicket?.client_id || item.rawTicket?.cliente_id || null,
                            amount_base: itemBase,
                            amount_total: itemTotal,
                            amount_igv: itemIgv,
                            status: 'cobrada',
                            payment_date: paidDateISO,
                            issued_date: finalFechaOc || item.fechaCreacion || paidDateISO,
                            invoice_number: finalOcNum,
                            doc_number: finalDocNum
                        };

                        const { error: insErr } = await supabase
                            .from('invoices')
                            .insert([invoicePayload]);

                        if (insErr) throw insErr;
                    }

                    // 2. Actualizar el ticket en 'tickets'
                    if (item.ticketId) {
                        const ticketMeta = item.rawTicket?.metadata || {};
                        await handleUpdateTicket(item.ticketId, {
                            total_quoted_amount: itemTotal,
                            ...(item.rawTicket?.closure_date ? {} : { closure_date: paidDateISO }),
                            metadata: {
                                ...ticketMeta,
                                is_cobrado: true,
                                estado_cobranza: 'cobrado',
                                fecha_cobro: paidDateISO,
                                fecha_oc: finalFechaOc,
                                oc_number: finalOcNum,
                                doc_number: finalDocNum,
                                tipo_cobro: 'oc',
                                monto_cobrado: itemTotal,
                                monto_base_cobrado: itemBase,
                                monto_igv_cobrado: itemIgv,
                                montoFinal: itemTotal,
                                montoSubtotal: itemBase,
                                montoIGV: itemIgv,
                                ingresos_reales: itemBase,
                                observaciones_cobranza: finalObs
                            }
                        });
                    }

                    // 3. Preparar override reactivo inmediato para el dashboard
                    newOverrides[item.ticketId] = {
                        total_quoted_amount: itemTotal,
                        montoFinal: itemTotal,
                        ingresos_reales: itemBase,
                        status_id: 'ticket_cerrado',
                        estadoId: 'ticket_cerrado',
                        closure_date: item.rawTicket?.closure_date || paidDateISO,
                        fechaCierre: item.rawTicket?.closure_date || paidDateISO,
                        estado_cobranza: 'cobrado',
                        is_cobrado: true,
                        metadata: {
                            ...(item.rawTicket?.metadata || {}),
                            is_cobrado: true,
                            estado_cobranza: 'cobrado',
                            fecha_cobro: paidDateISO,
                            fecha_oc: finalFechaOc,
                            oc_number: finalOcNum,
                            doc_number: finalDocNum,
                            tipo_cobro: 'oc',
                            monto_cobrado: itemTotal,
                            monto_base_cobrado: itemBase,
                            monto_igv_cobrado: itemIgv,
                            montoFinal: itemTotal,
                            montoSubtotal: itemBase,
                            montoIGV: itemIgv,
                            ingresos_reales: itemBase,
                            observaciones_cobranza: finalObs
                        }
                    };

                    successCount++;
                } catch (itemErr: any) {
                    console.error(`Error procesando ticket ${item.ticketNum}:`, itemErr);
                    failCount++;
                }
            }

            // 4. Actualizar estado local reactivo
            setRealtimeOverrides(prev => ({ ...prev, ...newOverrides }));

            // 5. Recargar facturas frescas desde Supabase
            const { data: freshInvoices } = await supabase.from('invoices').select('*');
            if (freshInvoices) {
                setInvoices(freshInvoices.map(inv => ({
                    ...inv,
                    paid_date: inv.payment_date || inv.paid_date
                })));
            }

            // 6. Refrescar tickets en el contexto global
            await refreshTickets();

            triggerToast(
                "¡Cobro Masivo Registrado con Éxito!",
                `Se procesaron ${successCount} tickets por un total de S/ ${fmt(batchTotals.total)} con la OC ${finalOcNum}.${failCount > 0 ? ` (${failCount} fallaron)` : ''}`
            );

            if (onSuccess) onSuccess();
            onClose();

        } catch (globalErr: any) {
            console.error("Error global en cobro masivo:", globalErr);
            triggerToast("Error", `Ocurrió un error en el proceso masivo: ${globalErr?.message || 'Error del servidor'}`);
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.88)', backdropFilter: 'blur(12px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 11000, padding: '1rem'
        }} onClick={onClose}>
            <div style={{
                background: '#0B0D14', border: '1px solid rgba(16,185,129,0.3)',
                width: '100%', maxWidth: '1150px', maxHeight: '92vh',
                borderRadius: '24px', display: 'flex', flexDirection: 'column',
                overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.85)',
                position: 'relative'
            }} onClick={e => e.stopPropagation()}>

                {/* ── HEADER MODAL ── */}
                <div style={{
                    padding: '1.25rem 1.75rem',
                    borderBottom: '1px solid rgba(255,255,255,0.08)',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    background: 'linear-gradient(90deg, rgba(16,185,129,0.1) 0%, rgba(59,130,246,0.05) 100%)'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div style={{
                            width: '42px', height: '42px', borderRadius: '12px',
                            background: 'rgba(16,185,129,0.2)', border: '1px solid rgba(16,185,129,0.4)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10B981'
                        }}>
                            <Layers size={22} />
                        </div>
                        <div>
                            <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 900, color: '#FFF' }}>
                                Registro de Cobro Masivo por Orden de Compra
                            </h2>
                            <p style={{ margin: '2px 0 0', fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)' }}>
                                Adjunta el PDF de la OC para extraer y marcar automáticamente todos los tickets asociados en un solo paso.
                            </p>
                        </div>
                    </div>

                    <button
                        onClick={onClose}
                        disabled={isProcessing}
                        style={{
                            background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
                            color: 'white', width: '36px', height: '36px', borderRadius: '10px',
                            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'
                        }}>
                        <X size={18} />
                    </button>
                </div>

                {/* ── BODY SCROLLABLE ── */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem 1.75rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

                    {/* SECCIÓN 1: DATOS GENERALES DE LA ORDEN DE COMPRA */}
                    <div style={{
                        background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)',
                        borderRadius: '16px', padding: '1.25rem'
                    }}>
                        <div style={{ fontSize: '0.8rem', fontWeight: 900, color: '#10B981', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <FileText size={16} /> DATOS DE LA ORDEN DE COMPRA (APLICAN A TODO EL LOTE)
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                            {/* N° OC */}
                            <div>
                                <label style={{ display: 'block', fontSize: '0.72rem', color: 'rgba(255,255,255,0.6)', marginBottom: '4px', fontWeight: 700 }}>
                                    N° Orden de Compra (OC): *
                                </label>
                                <input
                                    type="text"
                                    placeholder="Ej. 0046270"
                                    value={ocNumber}
                                    onChange={e => setOcNumber(e.target.value)}
                                    style={{
                                        width: '100%', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(16,185,129,0.3)',
                                        borderRadius: '8px', padding: '0.55rem 0.75rem', color: '#FFF', fontSize: '0.85rem',
                                        fontWeight: 800, outline: 'none'
                                    }}
                                />
                            </div>

                            {/* Fecha en la OC */}
                            <div>
                                <label style={{ display: 'block', fontSize: '0.72rem', color: 'rgba(255,255,255,0.6)', marginBottom: '4px', fontWeight: 700 }}>
                                    Fecha en la OC:
                                </label>
                                <input
                                    type="date"
                                    value={fechaOc}
                                    onChange={e => setFechaOc(e.target.value)}
                                    style={{
                                        width: '100%', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.1)',
                                        borderRadius: '8px', padding: '0.55rem 0.75rem', color: '#FFF', fontSize: '0.85rem', outline: 'none'
                                    }}
                                />
                            </div>

                            {/* N° Comprobante */}
                            <div>
                                <label style={{ display: 'block', fontSize: '0.72rem', color: 'rgba(255,255,255,0.6)', marginBottom: '4px', fontWeight: 700 }}>
                                    N° Comprobante (Factura/Boleta):
                                </label>
                                <input
                                    type="text"
                                    placeholder="Ej. F001-0004522"
                                    value={docNumber}
                                    onChange={e => setDocNumber(e.target.value)}
                                    style={{
                                        width: '100%', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.1)',
                                        borderRadius: '8px', padding: '0.55rem 0.75rem', color: '#FFF', fontSize: '0.85rem', outline: 'none'
                                    }}
                                />
                            </div>

                            {/* Fecha Real de Cobro */}
                            <div>
                                <label style={{ display: 'block', fontSize: '0.72rem', color: 'rgba(255,255,255,0.6)', marginBottom: '4px', fontWeight: 700 }}>
                                    Fecha Real de Cobro: *
                                </label>
                                <input
                                    type="date"
                                    value={fechaCobro}
                                    onChange={e => setFechaCobro(e.target.value)}
                                    style={{
                                        width: '100%', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(16,185,129,0.3)',
                                        borderRadius: '8px', padding: '0.55rem 0.75rem', color: '#FFF', fontSize: '0.85rem', outline: 'none'
                                    }}
                                />
                            </div>

                            {/* Total Esperado de la OC (Para verificación y cuadre) */}
                            <div>
                                <label style={{ display: 'block', fontSize: '0.72rem', color: '#38BDF8', marginBottom: '4px', fontWeight: 800 }}>
                                    Total de la OC en PDF (S/ con IGV):
                                </label>
                                <input
                                    type="number"
                                    step="0.01"
                                    placeholder="Ej. 25128.10"
                                    value={expectedTotal}
                                    onChange={e => setExpectedTotal(e.target.value)}
                                    style={{
                                        width: '100%', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(56,189,248,0.4)',
                                        borderRadius: '8px', padding: '0.55rem 0.75rem', color: '#38BDF8', fontSize: '0.85rem',
                                        fontWeight: 900, outline: 'none'
                                    }}
                                />
                            </div>
                        </div>

                        {/* Observaciones */}
                        <div style={{ marginTop: '0.75rem' }}>
                            <label style={{ display: 'block', fontSize: '0.72rem', color: 'rgba(255,255,255,0.6)', marginBottom: '4px', fontWeight: 700 }}>
                                Glosa / Observaciones del Lote:
                            </label>
                            <input
                                type="text"
                                placeholder="Ej. MiBanco CAPEX - Facturación Mantenimiento Sedes (44 tickets)"
                                value={observaciones}
                                onChange={e => setObservaciones(e.target.value)}
                                style={{
                                    width: '100%', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.1)',
                                    borderRadius: '8px', padding: '0.55rem 0.75rem', color: '#FFF', fontSize: '0.85rem', outline: 'none'
                                }}
                            />
                        </div>
                    </div>

                    {/* SECCIÓN 2: ADJUNTAR ARCHIVO PDF DE LA OC CON DETECCIÓN INTELIGENTE */}
                    <div style={{
                        background: 'linear-gradient(135deg, rgba(16,185,129,0.06) 0%, rgba(139,92,246,0.04) 100%)',
                        border: '1px solid rgba(16,185,129,0.3)',
                        borderRadius: '16px', padding: '1.25rem'
                    }}>
                        {/* Hidden File Input */}
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept=".pdf,application/pdf"
                            style={{ display: 'none' }}
                            onChange={e => {
                                const file = e.target.files?.[0];
                                if (file) handleFileSelect(file);
                            }}
                        />

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <FileCheck size={18} color="#10B981" />
                                <span style={{ fontSize: '0.85rem', fontWeight: 900, color: '#10B981', letterSpacing: '0.3px' }}>
                                    ADJUNTAR ARCHIVO PDF DE LA ORDEN DE COMPRA
                                </span>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                                <button
                                    onClick={() => fileInputRef.current?.click()}
                                    style={{
                                        background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
                                        border: 'none', color: '#FFF', padding: '0.45rem 1rem', borderRadius: '8px',
                                        fontSize: '0.78rem', fontWeight: 800, cursor: 'pointer',
                                        display: 'flex', alignItems: 'center', gap: '6px',
                                        boxShadow: '0 2px 8px rgba(16,185,129,0.3)'
                                    }}>
                                    <Paperclip size={14} />
                                    {pdfFile ? 'Cambiar Archivo PDF' : 'Adjuntar Archivo PDF'}
                                </button>

                                <button
                                    onClick={() => setShowManualPaste(!showManualPaste)}
                                    style={{
                                        background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)',
                                        color: 'rgba(255,255,255,0.7)', padding: '0.45rem 0.8rem', borderRadius: '8px',
                                        fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer'
                                    }}>
                                    {showManualPaste ? 'Ocultar Texto' : 'O pegar texto manual'}
                                </button>
                            </div>
                        </div>

                        {/* Tarjeta de Archivo PDF Adjunto o Zona de Arrastrar */}
                        {pdfFile ? (
                            <div style={{
                                background: 'rgba(16,185,129,0.1)', border: '1px dashed rgba(16,185,129,0.4)',
                                borderRadius: '12px', padding: '1rem 1.25rem', display: 'flex',
                                justifyContent: 'space-between', alignItems: 'center', gap: '1rem'
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                                    <div style={{
                                        width: '42px', height: '42px', borderRadius: '10px',
                                        background: 'rgba(16,185,129,0.2)', display: 'flex',
                                        alignItems: 'center', justifyContent: 'center', color: '#10B981'
                                    }}>
                                        <FileText size={22} />
                                    </div>
                                    <div>
                                        <div style={{ color: 'white', fontWeight: 800, fontSize: '0.88rem' }}>
                                            {pdfFile.name}
                                        </div>
                                        <div style={{ color: '#10B981', fontSize: '0.72rem', fontWeight: 700, marginTop: '2px' }}>
                                            ✓ Archivo PDF listo para extracción ({(pdfFile.size / 1024).toFixed(1)} KB)
                                        </div>
                                    </div>
                                </div>

                                <button
                                    onClick={() => {
                                        setPdfFile(null);
                                        if (fileInputRef.current) fileInputRef.current.value = "";
                                    }}
                                    title="Quitar archivo"
                                    style={{
                                        background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)',
                                        color: '#EF4444', width: '32px', height: '32px', borderRadius: '8px',
                                        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'
                                    }}>
                                    <Trash2 size={15} />
                                </button>
                            </div>
                        ) : (
                            <div
                                onClick={() => fileInputRef.current?.click()}
                                onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
                                onDragLeave={() => setIsDragging(false)}
                                onDrop={e => {
                                    e.preventDefault();
                                    setIsDragging(false);
                                    const file = e.dataTransfer.files?.[0];
                                    if (file) handleFileSelect(file);
                                }}
                                style={{
                                    background: isDragging ? 'rgba(16,185,129,0.15)' : 'rgba(0,0,0,0.3)',
                                    border: `2px dashed ${isDragging ? '#10B981' : 'rgba(255,255,255,0.15)'}`,
                                    borderRadius: '12px', padding: '1.25rem', textAlign: 'center',
                                    cursor: 'pointer', transition: 'all 0.2s'
                                }}>
                                <UploadCloud size={32} color={isDragging ? '#10B981' : 'rgba(255,255,255,0.35)'} style={{ margin: '0 auto 0.5rem' }} />
                                <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'white' }}>
                                    Haz clic aquí o arrastra tu archivo PDF de la Orden de Compra
                                </div>
                                <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.4)', marginTop: '3px' }}>
                                    Soporta órdenes de compra de MiBanco (formatos PDF estándar de 1 o más páginas)
                                </div>
                            </div>
                        )}

                        {/* Caja de Pegado Manual (Opcional si se despliega) */}
                        {showManualPaste && (
                            <div style={{ marginTop: '0.85rem' }}>
                                <textarea
                                    rows={3}
                                    placeholder="O pega aquí texto copiado de la OC (ej. MB015411.26, MB015146.26...)"
                                    value={pastedText}
                                    onChange={e => setPastedText(e.target.value)}
                                    style={{
                                        width: '100%', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)',
                                        borderRadius: '8px', padding: '0.65rem', color: '#FFF', fontSize: '0.78rem',
                                        outline: 'none', fontFamily: 'monospace', resize: 'vertical'
                                    }}
                                />
                            </div>
                        )}

                        {/* Botón de Detección y Marcado Automático */}
                        <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
                            <button
                                onClick={handleDetectAndSelectTickets}
                                disabled={isParsingPdf}
                                style={{
                                    background: isParsingPdf
                                        ? 'rgba(139,92,246,0.3)'
                                        : 'linear-gradient(135deg, #8B5CF6 0%, #6D28D9 100%)',
                                    border: 'none', color: '#FFF', padding: '0.6rem 1.4rem', borderRadius: '10px',
                                    fontSize: '0.82rem', fontWeight: 900, cursor: isParsingPdf ? 'wait' : 'pointer',
                                    display: 'flex', alignItems: 'center', gap: '8px',
                                    boxShadow: '0 4px 14px rgba(139,92,246,0.4)',
                                    transition: 'all 0.2s'
                                }}>
                                {isParsingPdf ? (
                                    <>
                                        <RefreshCw size={15} className="animate-spin" />
                                        <span>Leyendo y extrayendo tickets del PDF...</span>
                                    </>
                                ) : (
                                    <>
                                        <Sparkles size={16} />
                                        <span>✨ Detectar y Marcar Tickets Automáticamente</span>
                                    </>
                                )}
                            </button>

                            {detectionReport && (
                                <div style={{
                                    padding: '0.4rem 0.85rem', borderRadius: '8px',
                                    background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.3)',
                                    fontSize: '0.75rem', color: '#A7F3D0', fontWeight: 700
                                }}>
                                    🎯 {detectionReport.matched} de {detectionReport.detected} tickets encontrados y marcados en pendientes.
                                    {detectionReport.notFound.length > 0 && (
                                        <span style={{ color: '#FCA5A5', marginLeft: '6px' }}>
                                            ({detectionReport.notFound.length} no encontrados en pendientes)
                                        </span>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* SECCIÓN 3: CONTROL DE SELECCIÓN Y BÚSQUEDA */}
                    <div style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        flexWrap: 'wrap', gap: '0.75rem'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <div style={{ position: 'relative' }}>
                                <Search size={14} color="rgba(255,255,255,0.4)" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
                                <input
                                    type="text"
                                    placeholder="Buscar ticket, sede..."
                                    value={searchTerm}
                                    onChange={e => setSearchTerm(e.target.value)}
                                    style={{
                                        background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
                                        borderRadius: '8px', color: 'white', padding: '0.45rem 0.75rem 0.45rem 2rem',
                                        fontSize: '0.78rem', outline: 'none', width: '220px'
                                    }}
                                />
                            </div>

                            {clientOptions.length > 1 && (
                                <select
                                    value={clientFilter}
                                    onChange={e => setClientFilter(e.target.value)}
                                    style={{
                                        background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
                                        borderRadius: '8px', color: 'white', padding: '0.45rem 0.75rem',
                                        fontSize: '0.78rem', outline: 'none'
                                    }}>
                                    <option value="all">Todos los Clientes</option>
                                    {clientOptions.map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                            )}

                            <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)', fontWeight: 600 }}>
                                Mostrando {filteredItems.length} de {pendingItems.length} tickets cerrados
                            </span>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <button
                                onClick={handleSelectAllVisible}
                                style={{
                                    background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.3)',
                                    color: '#60A5FA', padding: '0.4rem 0.85rem', borderRadius: '8px',
                                    fontSize: '0.75rem', fontWeight: 800, cursor: 'pointer'
                                }}>
                                ☑️ Seleccionar Visibles ({filteredItems.length})
                            </button>

                            <button
                                onClick={handleClearSelection}
                                style={{
                                    background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)',
                                    color: '#F87171', padding: '0.4rem 0.85rem', borderRadius: '8px',
                                    fontSize: '0.75rem', fontWeight: 800, cursor: 'pointer'
                                }}>
                                ⬜ Limpiar Selección
                            </button>
                        </div>
                    </div>

                    {/* SECCIÓN 4: TABLA DE TICKETS PENDIENTES */}
                    <div style={{
                        maxHeight: '320px', overflowY: 'auto', border: '1px solid rgba(255,255,255,0.08)',
                        borderRadius: '14px', background: 'rgba(0,0,0,0.2)'
                    }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                            <thead>
                                <tr style={{ background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                                    <th style={{ padding: '10px 12px', width: '40px' }}></th>
                                    <th style={{ padding: '10px 12px', fontSize: '0.68rem', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', fontWeight: 800 }}>N° TICKET</th>
                                    <th style={{ padding: '10px 12px', fontSize: '0.68rem', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', fontWeight: 800 }}>CLIENTE / SEDE</th>
                                    <th style={{ padding: '10px 12px', fontSize: '0.68rem', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', fontWeight: 800 }}>SERVICIO</th>
                                    <th style={{ padding: '10px 12px', fontSize: '0.68rem', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', fontWeight: 800, textAlign: 'right' }}>SUBTOTAL (S/)</th>
                                    <th style={{ padding: '10px 12px', fontSize: '0.68rem', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', fontWeight: 800, textAlign: 'right' }}>TOTAL CON IGV (S/)</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredItems.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} style={{ padding: '2rem', textAlign: 'center', color: 'rgba(255,255,255,0.4)', fontSize: '0.85rem' }}>
                                            No se encontraron tickets cerrados que coincidan con la búsqueda.
                                        </td>
                                    </tr>
                                ) : (
                                    filteredItems.map(item => {
                                        const isSelected = selectedIds.has(item.id);
                                        return (
                                            <tr
                                                key={item.id}
                                                onClick={() => toggleSelect(item.id)}
                                                style={{
                                                    borderBottom: '1px solid rgba(255,255,255,0.03)',
                                                    background: isSelected ? 'rgba(16,185,129,0.08)' : 'transparent',
                                                    cursor: 'pointer', transition: 'background 0.15s'
                                                }}>
                                                <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                                                    {isSelected ? (
                                                        <CheckSquare size={17} color="#10B981" />
                                                    ) : (
                                                        <Square size={17} color="rgba(255,255,255,0.3)" />
                                                    )}
                                                </td>
                                                <td style={{ padding: '10px 12px' }}>
                                                    <span style={{
                                                        color: isSelected ? '#10B981' : '#60A5FA',
                                                        fontFamily: 'monospace', fontWeight: 800, fontSize: '0.82rem'
                                                    }}>
                                                        {item.ticketNum}
                                                    </span>
                                                </td>
                                                <td style={{ padding: '10px 12px' }}>
                                                    <div style={{ color: 'rgba(255,255,255,0.9)', fontSize: '0.78rem', fontWeight: 600 }}>
                                                        {item.clientName}
                                                    </div>
                                                    {item.agencia && (
                                                        <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.68rem' }}>
                                                            📍 {item.agencia}
                                                        </div>
                                                    )}
                                                </td>
                                                <td style={{ padding: '10px 12px' }}>
                                                    <span style={{
                                                        padding: '2px 6px', borderRadius: '4px', fontSize: '0.65rem', fontWeight: 800,
                                                        background: 'rgba(139,92,246,0.15)', color: '#A78BFA'
                                                    }}>
                                                        {item.servicio}
                                                    </span>
                                                </td>
                                                <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                                                    <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.8rem', fontWeight: 600 }}>
                                                        S/ {fmt(item.montoSinIGV)}
                                                    </span>
                                                </td>
                                                <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                                                    <span style={{ color: isSelected ? '#10B981' : '#EF4444', fontSize: '0.82rem', fontWeight: 800 }}>
                                                        S/ {fmt(item.monto)}
                                                    </span>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* ── FOOTER RESUMEN & ACCIONES ── */}
                <div style={{
                    padding: '1.25rem 1.75rem', borderTop: '1px solid rgba(255,255,255,0.08)',
                    background: '#07090F', display: 'flex', justifyContent: 'space-between',
                    alignItems: 'center', flexWrap: 'wrap', gap: '1rem'
                }}>
                    {/* PANEL DE CUADRE FINANCIERO */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
                        <div>
                            <div style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', fontWeight: 800 }}>
                                TICKETS SELECCIONADOS
                            </div>
                            <div style={{ fontSize: '1.3rem', fontWeight: 900, color: batchTotals.count > 0 ? '#10B981' : 'white' }}>
                                {batchTotals.count}
                            </div>
                        </div>

                        <div style={{ height: '36px', width: '1px', background: 'rgba(255,255,255,0.1)' }} />

                        <div>
                            <div style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', fontWeight: 800 }}>
                                SUBTOTAL (SIN IGV)
                            </div>
                            <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'rgba(255,255,255,0.85)' }}>
                                S/ {fmt(batchTotals.base)}
                            </div>
                        </div>

                        <div>
                            <div style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', fontWeight: 800 }}>
                                IGV 18%
                            </div>
                            <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#A78BFA' }}>
                                S/ {fmt(batchTotals.igv)}
                            </div>
                        </div>

                        <div>
                            <div style={{ fontSize: '0.68rem', color: '#10B981', textTransform: 'uppercase', fontWeight: 900 }}>
                                TOTAL CON IGV
                            </div>
                            <div style={{ fontSize: '1.35rem', fontWeight: 900, color: '#10B981', fontFamily: 'system-ui' }}>
                                S/ {fmt(batchTotals.total)}
                            </div>
                        </div>

                        {/* INDICADOR DE CUADRE CONTRA PDF */}
                        {batchTotals.expNum !== null && (
                            <div style={{
                                padding: '0.4rem 0.8rem', borderRadius: '10px',
                                background: batchTotals.isBalanced ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
                                border: `1px solid ${batchTotals.isBalanced ? 'rgba(16,185,129,0.4)' : 'rgba(239,68,68,0.4)'}`,
                                display: 'flex', flexDirection: 'column', gap: '2px'
                            }}>
                                <div style={{ fontSize: '0.68rem', fontWeight: 800, color: batchTotals.isBalanced ? '#10B981' : '#EF4444' }}>
                                    {batchTotals.isBalanced ? '✓ CUADRADO AL 100%' : '⚠️ DIFERENCIA OC'}
                                </div>
                                <div style={{ fontSize: '0.75rem', fontWeight: 900, color: '#FFF' }}>
                                    {batchTotals.isBalanced ? 'Coincide con OC' : `Dif: S/ ${fmt(batchTotals.diff || 0)}`}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* BOTÓN DE CONFIRMACIÓN */}
                    <div style={{ display: 'flex', gap: '0.75rem' }}>
                        <button
                            onClick={onClose}
                            disabled={isProcessing}
                            style={{
                                background: 'transparent', border: '1px solid rgba(255,255,255,0.15)',
                                color: 'rgba(255,255,255,0.7)', padding: '0.6rem 1.25rem', borderRadius: '10px',
                                fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer'
                            }}>
                            Cancelar
                        </button>

                        <button
                            onClick={handleExecuteBatchCobro}
                            disabled={isProcessing || batchTotals.count === 0 || !ocNumber.trim()}
                            style={{
                                background: isProcessing || batchTotals.count === 0 || !ocNumber.trim()
                                    ? 'rgba(255,255,255,0.08)'
                                    : 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
                                border: 'none',
                                color: isProcessing || batchTotals.count === 0 || !ocNumber.trim() ? 'rgba(255,255,255,0.3)' : '#FFF',
                                padding: '0.65rem 1.6rem', borderRadius: '10px',
                                fontSize: '0.88rem', fontWeight: 900,
                                cursor: isProcessing || batchTotals.count === 0 || !ocNumber.trim() ? 'not-allowed' : 'pointer',
                                display: 'flex', alignItems: 'center', gap: '8px',
                                boxShadow: isProcessing || batchTotals.count === 0 || !ocNumber.trim() ? 'none' : '0 4px 16px rgba(16,185,129,0.4)',
                                transition: 'all 0.2s'
                            }}>
                            {isProcessing ? (
                                <>
                                    <RefreshCw size={16} className="animate-spin" />
                                    <span>Registrando {progress.current} de {progress.total}...</span>
                                </>
                            ) : (
                                <>
                                    <ShieldCheck size={18} />
                                    <span>Confirmar y Cobrar Lote ({batchTotals.count} Tickets)</span>
                                </>
                            )}
                        </button>
                    </div>
                </div>

            </div>
        </div>
    );
}
