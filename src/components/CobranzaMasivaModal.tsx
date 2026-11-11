"use client";

import React, { useState, useMemo, useCallback, useRef } from "react";
import {
    CheckSquare, Square, Search, FileText, CheckCircle2,
    AlertCircle, X, Sparkles, RefreshCw, Layers, DollarSign,
    Calendar, ArrowRight, ShieldCheck, Filter, UploadCloud,
    Paperclip, Trash2, Check, FileCheck, MinusCircle, PlusCircle,
    Eye, HelpCircle, AlertTriangle, Zap, CheckCircle
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
const fmt = (n: number) => (Number(n) || 0).toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Extrae el núcleo numérico principal de un código de ticket para comparación robusta */
function extractCoreNumber(s: string): string {
    if (!s) return "";
    const clean = String(s).toUpperCase().replace(/[^A-Z0-9]/g, "");
    const m = clean.match(/\d{4,8}/);
    return m ? m[0].replace(/^0+/, "") : "";
}

/** Compara de forma tolerante y segura el código del PDF con los identificadores del ticket */
function matchTicket(candidateCode: string, item: any): boolean {
    if (!candidateCode || !item) return false;
    const cleanCandidate = candidateCode.toUpperCase().replace(/[^A-Z0-9]/g, "");
    const candidateCore = extractCoreNumber(candidateCode);

    const identifiers = [
        item.ticketNum,
        item.rawTicket?.client_ticket_number,
        item.rawTicket?.metadata?.numeroTicketCliente,
        item.rawTicket?.metadata?.client_ticket_number,
        String(item.rawTicket?.ticket_number || ""),
        item.ticketId,
        item.id
    ].filter(Boolean);

    for (const id of identifiers) {
        const cleanId = String(id).toUpperCase().replace(/[^A-Z0-9]/g, "");
        if (cleanId === cleanCandidate) return true;

        const idCore = extractCoreNumber(id);
        if (candidateCore && idCore && candidateCore === idCore && candidateCore.length >= 4) {
            return true;
        }

        if (cleanCandidate.length >= 6 && cleanId.length >= 6) {
            if (cleanCandidate.includes(cleanId) || cleanId.includes(cleanCandidate)) {
                return true;
            }
        }
    }
    return false;
}

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

    // ── Formulario de Cabecera de la OC ──────────────────────────────
    const [ocNumber, setOcNumber] = useState("");
    const [fechaOc, setFechaOc] = useState(() => new Date().toISOString().split("T")[0]);
    const [docNumber, setDocNumber] = useState(""); // N° Factura / Boleta
    const [fechaCobro, setFechaCobro] = useState(() => new Date().toISOString().split("T")[0]);
    const [expectedTotal, setExpectedTotal] = useState(""); // Total OC del PDF para cuadre
    const [observaciones, setObservaciones] = useState("");

    // ── Búsqueda y Selección de Tickets ──────────────────────────────
    const [searchTerm, setSearchTerm] = useState("");
    const [clientFilter, setClientFilter] = useState("all");
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    // ── Modo de Visualización de Tickets ────────────────────────────
    const [viewMode, setViewMode] = useState<'detected' | 'all'>('all');
    const [detectedTicketIds, setDetectedTicketIds] = useState<Set<string>>(new Set());
    const [detectedTicketCodes, setDetectedTicketCodes] = useState<string[]>([]);
    
    // Detalles extraídos de cada línea del PDF: { [ticketCode]: { subtotal: number, total: number } }
    const [pdfLineDetails, setPdfLineDetails] = useState<Record<string, { subtotal: number; total: number }>>({});
    
    // Montos ajustados por el usuario para cuadre exacto con la OC: { [itemId]: { base: number, total: number } }
    const [adjustedAmounts, setAdjustedAmounts] = useState<Record<string, { base: number; total: number }>>({});

    const tableContainerRef = useRef<HTMLDivElement>(null);

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

    // ── Estado de Procesamiento en Lote ──────────────────────────────
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

    // Busca los detalles de la línea en la OC correspondiente a este ticket
    const getPdfInfoForItem = useCallback((item: any) => {
        if (!pdfLineDetails || Object.keys(pdfLineDetails).length === 0) return null;
        for (const [code, val] of Object.entries(pdfLineDetails)) {
            if (matchTicket(code, item)) {
                return { code, ...val };
            }
        }
        return null;
    }, [pdfLineDetails]);

    // ── Filtrado interactivo de tickets según vista y buscador ──────
    const filteredItems = useMemo(() => {
        return pendingItems.filter(item => {
            // Si el modo es 'detected', solo mostrar los que pertenecen a la detección (o los que estén seleccionados)
            if (viewMode === 'detected') {
                const isDetected = detectedTicketIds.has(item.id) || (item.ticketId && detectedTicketIds.has(item.ticketId));
                const isSelected = selectedIds.has(item.id);
                if (!isDetected && !isSelected) return false;
            }

            if (clientFilter !== "all" && item.clientName !== clientFilter) return false;
            if (!searchTerm.trim()) return true;

            const q = searchTerm.toLowerCase();
            return (
                (item.ticketNum || '').toLowerCase().includes(q) ||
                (item.clientName || '').toLowerCase().includes(q) ||
                (item.agencia || '').toLowerCase().includes(q)
            );
        }).sort((a, b) => {
            // Mostrar los seleccionados primero
            const aSel = selectedIds.has(a.id) ? 1 : 0;
            const bSel = selectedIds.has(b.id) ? 1 : 0;
            if (aSel !== bSel) return bSel - aSel;
            return 0;
        });
    }, [pendingItems, viewMode, detectedTicketIds, selectedIds, clientFilter, searchTerm]);

    // ── Totales de los Tickets Seleccionados ────────────────────────
    const selectedItems = useMemo(() => {
        return pendingItems.filter(item => selectedIds.has(item.id));
    }, [pendingItems, selectedIds]);

    const batchTotals = useMemo(() => {
        let total = 0;
        let base = 0;
        selectedItems.forEach(i => {
            const adj = adjustedAmounts[i.id];
            if (adj) {
                total += adj.total;
                base += adj.base;
            } else {
                const itemTotal = Number(i.monto || 0);
                const itemBase = Number(i.montoSinIGV || (itemTotal > 0 ? itemTotal / 1.18 : 0));
                total += itemTotal;
                base += itemBase;
            }
        });
        total = round2(total);
        base = round2(base);
        const igv = round2(total - base);

        const expNum = expectedTotal && !isNaN(parseFloat(expectedTotal)) ? parseFloat(expectedTotal) : null;
        const diff = expNum !== null ? round2(total - expNum) : null;
        const isBalanced = diff !== null ? Math.abs(diff) < 0.05 : null;

        return { count: selectedItems.length, base, igv, total, expNum, diff, isBalanced };
    }, [selectedItems, adjustedAmounts, expectedTotal]);

    // Tickets seleccionados que presentan discrepancia con la OC del PDF
    const discrepantItems = useMemo(() => {
        const list: Array<{ item: any; pdfSubtotal: number; pdfTotal: number; systemTotal: number; diff: number }> = [];
        selectedItems.forEach(item => {
            const pdfInfo = getPdfInfoForItem(item);
            if (pdfInfo) {
                const currentTotal = adjustedAmounts[item.id]?.total ?? round2(item.monto || 0);
                const diff = round2(currentTotal - pdfInfo.total);
                if (Math.abs(diff) >= 0.05) {
                    list.push({
                        item,
                        pdfSubtotal: pdfInfo.subtotal,
                        pdfTotal: pdfInfo.total,
                        systemTotal: currentTotal,
                        diff
                    });
                }
            }
        });
        return list;
    }, [selectedItems, adjustedAmounts, getPdfInfoForItem]);

    // ── Toggle selección individual ──────────────────────────────────
    const toggleSelect = useCallback((id: string) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    }, []);

    const deselectTicket = useCallback((id: string, e?: React.MouseEvent) => {
        if (e) e.stopPropagation();
        setSelectedIds(prev => {
            const next = new Set(prev);
            next.delete(id);
            return next;
        });
    }, []);

    const selectTicket = useCallback((id: string, e?: React.MouseEvent) => {
        if (e) e.stopPropagation();
        setSelectedIds(prev => {
            const next = new Set(prev);
            next.add(id);
            return next;
        });
    }, []);

    // ── Ajustar monto de un ticket individual al monto de la OC ──────
    const handleAdjustSingleToOc = useCallback((item: any, pdfSubtotal: number, pdfTotal: number, e?: React.MouseEvent) => {
        if (e) e.stopPropagation();
        setAdjustedAmounts(prev => ({
            ...prev,
            [item.id]: {
                base: pdfSubtotal,
                total: pdfTotal
            }
        }));
        triggerToast("Monto Ajustado", `Ticket ${item.ticketNum} ajustado a S/ ${fmt(pdfTotal)} para cuadre exacto con la OC.`);
    }, [triggerToast]);

    // ── Ajustar automáticamente todos los tickets seleccionados a la OC ─
    const handleAdjustAllToOc = useCallback(() => {
        const nextAdjusted = { ...adjustedAmounts };
        let count = 0;
        selectedItems.forEach(item => {
            const pdfInfo = getPdfInfoForItem(item);
            if (pdfInfo) {
                nextAdjusted[item.id] = {
                    base: pdfInfo.subtotal,
                    total: pdfInfo.total
                };
                count++;
            }
        });
        setAdjustedAmounts(nextAdjusted);
        triggerToast("Lote Ajustado a la OC", `Se ajustaron los montos de ${count} tickets al valor aprobado en la Orden de Compra.`);
    }, [adjustedAmounts, selectedItems, getPdfInfoForItem, triggerToast]);

    // ── Seleccionar todos los visibles ──────────────────────────────
    const handleSelectAllVisible = () => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            filteredItems.forEach(item => next.add(item.id));
            return next;
        });
    };

    // ── Deseleccionar todos ──────────────────────────────────────────
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
        triggerToast("PDF Adjunto", `Archivo "${file.name}" cargado. Haz clic en "Detectar y Marcar Tickets Automáticamente".`);
    };

    // ── Algoritmo Principal: Extraer, Desplegar y Marcar Tickets ────
    const handleDetectAndSelectTickets = async () => {
        if (pdfFile) {
            setIsParsingPdf(true);
            try {
                const formData = new FormData();
                formData.append("file", pdfFile);

                const response = await fetch("/api/v3/parse-oc-pdf", {
                    method: "POST",
                    body: formData
                });

                let data: any = null;
                const rawResp = await response.text();
                try {
                    data = JSON.parse(rawResp);
                } catch {
                    throw new Error(`Respuesta inválida del servidor (${response.status}): ${rawResp.substring(0, 120)}`);
                }

                if (!response.ok || !data?.success) {
                    throw new Error(data?.error || "No se pudo procesar el archivo PDF.");
                }

                // 1. Auto-completar datos de la OC desde el PDF
                if (data.ocNumber) setOcNumber(data.ocNumber);
                if (data.fechaOc) setFechaOc(data.fechaOc);
                if (data.total && data.total > 0) setExpectedTotal(data.total.toFixed(2));

                // 2. Extraer lista de códigos de ticket encontrados en el PDF
                const detectedCodes: string[] = data.tickets || [];
                setDetectedTicketCodes(detectedCodes);

                // 3. Guardar detalles de líneas individuales (subtotales y totales de la OC)
                if (data.ticketDetails) {
                    setPdfLineDetails(data.ticketDetails);
                }

                if (detectedCodes.length === 0) {
                    triggerToast("Aviso", "El PDF fue leído pero no se detectaron códigos de ticket en su contenido.");
                    return;
                }

                // 4. Buscar y marcar los tickets en la lista de pendientes usando matchTicket robusto
                const newSelection = new Set<string>();
                let matchedCount = 0;
                const notFoundCodes: string[] = [];

                detectedCodes.forEach(code => {
                    const found = pendingItems.find(item => matchTicket(code, item));
                    if (found) {
                        newSelection.add(found.id);
                        matchedCount++;
                    } else {
                        notFoundCodes.push(code);
                    }
                });

                setSelectedIds(newSelection);
                setDetectedTicketIds(newSelection);
                
                // DESPLEGAR Y VISUALIZAR LA LISTA DE TICKETS DE LA OC INMEDIATAMENTE
                setViewMode('detected');

                setDetectionReport({
                    detected: detectedCodes.length,
                    matched: matchedCount,
                    notFound: notFoundCodes,
                    source: 'pdf'
                });

                if (data.rawText) {
                    setPastedText(data.rawText);
                }

                // Foco suave hacia la tabla visible
                setTimeout(() => {
                    tableContainerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }, 150);

                triggerToast(
                    "¡Tickets Desplegados con Éxito!",
                    `OC ${data.ocNumber || ''}: Se desplegaron y marcaron ${matchedCount} tickets encontrados (${detectedCodes.length} en el PDF).`
                );

            } catch (err: any) {
                console.error("Error al procesar PDF:", err);
                triggerToast("Error al leer PDF", err?.message || "No se pudo leer el archivo PDF.");
            } finally {
                setIsParsingPdf(false);
            }
            return;
        }

        // Caso 2: Pegado manual
        if (pastedText.trim()) {
            const regex = /([A-Z]{2,4}\d{4,8}(?:\.\d{2})?)/gi;
            const matches = pastedText.match(regex) || [];
            const detectedCodes = Array.from(new Set(matches.map(m => m.trim().toUpperCase())));
            setDetectedTicketCodes(detectedCodes);

            if (detectedCodes.length === 0) {
                triggerToast("Aviso", "No se encontraron códigos de ticket válidos en el texto.");
                return;
            }

            const newSelection = new Set<string>();
            let matchedCount = 0;
            const notFoundCodes: string[] = [];

            detectedCodes.forEach(code => {
                const found = pendingItems.find(item => matchTicket(code, item));
                if (found) {
                    newSelection.add(found.id);
                    matchedCount++;
                } else {
                    notFoundCodes.push(code);
                }
            });

            setSelectedIds(newSelection);
            setDetectedTicketIds(newSelection);
            setViewMode('detected');

            setDetectionReport({
                detected: detectedCodes.length,
                matched: matchedCount,
                notFound: notFoundCodes,
                source: 'text'
            });

            setTimeout(() => {
                tableContainerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, 150);

            triggerToast(
                "Tickets Desplegados",
                `Se desplegaron y marcaron ${matchedCount} tickets encontrados en pendientes.`
            );
            return;
        }

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

                // Tomar el monto ajustado si existe, o el monto original
                const adj = adjustedAmounts[item.id];
                const itemTotal = adj ? adj.total : round2(item.monto || 0);
                const itemBase = adj ? adj.base : round2(item.montoSinIGV || (itemTotal > 0 ? itemTotal / 1.18 : 0));
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

                    // 3. Registrar override en tiempo real
                    newOverrides[item.ticketId] = {
                        is_cobrado: true,
                        estado_cobranza: 'cobrado',
                        oc_number: finalOcNum,
                        doc_number: finalDocNum,
                        fecha_cobro: paidDateISO,
                        fecha_oc: finalFechaOc,
                        tipo_cobro: 'oc',
                        monto_cobrado: itemTotal,
                        monto_base_cobrado: itemBase,
                        monto_igv_cobrado: itemIgv,
                        montoFinal: itemTotal,
                        montoSubtotal: itemBase,
                        montoIGV: itemIgv,
                        ingresos_reales: itemBase
                    };

                    successCount++;
                } catch (itemErr: any) {
                    console.error(`Error procesando ticket ${item.ticketNum}:`, itemErr);
                    failCount++;
                }
            }

            // 4. Aplicar overrides globales
            setRealtimeOverrides(prev => ({ ...prev, ...newOverrides }));

            // 5. Refrescar facturas en memoria
            const { data: updatedInvoices } = await supabase
                .from('invoices')
                .select('*')
                .order('created_at', { ascending: false });

            if (updatedInvoices) {
                setInvoices(updatedInvoices.map((inv: any) => ({
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
            zIndex: 11000, padding: '0.75rem'
        }} onClick={onClose}>
            <div style={{
                background: '#0B0D14', border: '1px solid rgba(16,185,129,0.35)',
                width: '100%', maxWidth: '1280px', maxHeight: '96vh',
                borderRadius: '20px', display: 'flex', flexDirection: 'column',
                overflow: 'hidden', boxShadow: '0 25px 60px -12px rgba(0,0,0,0.95)',
                position: 'relative'
            }} onClick={e => e.stopPropagation()}>

                {/* ── HEADER MODAL ── */}
                <div style={{
                    padding: '0.9rem 1.5rem',
                    borderBottom: '1px solid rgba(255,255,255,0.08)',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    background: 'linear-gradient(90deg, rgba(16,185,129,0.15) 0%, rgba(59,130,246,0.08) 100%)'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div style={{
                            width: '38px', height: '38px', borderRadius: '10px',
                            background: 'rgba(16,185,129,0.25)', border: '1px solid rgba(16,185,129,0.4)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10B981'
                        }}>
                            <Layers size={20} />
                        </div>
                        <div>
                            <h2 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 900, color: '#FFF' }}>
                                Registro de Cobro Masivo por Orden de Compra
                            </h2>
                            <p style={{ margin: '1px 0 0', fontSize: '0.74rem', color: 'rgba(255,255,255,0.55)' }}>
                                Vincula una misma OC a múltiples tickets cerrados, verifica montos contra el PDF y sincroniza en un solo clic.
                            </p>
                        </div>
                    </div>

                    <button
                        onClick={onClose}
                        disabled={isProcessing}
                        style={{
                            background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
                            color: 'white', width: '34px', height: '34px', borderRadius: '8px',
                            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'
                        }}>
                        <X size={17} />
                    </button>
                </div>

                {/* ── BODY SCROLLABLE PRINCIPAL ── */}
                <div style={{
                    flex: 1, overflowY: 'auto', padding: '1rem 1.5rem',
                    display: 'flex', flexDirection: 'column', gap: '0.85rem'
                }}>

                    {/* SECCIÓN 1: DATOS CABECERA DE LA ORDEN DE COMPRA (COMPACTA) */}
                    <div style={{
                        background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)',
                        borderRadius: '14px', padding: '0.85rem 1rem'
                    }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
                            {/* N° OC */}
                            <div>
                                <label style={{ display: 'block', fontSize: '0.7rem', color: '#10B981', marginBottom: '3px', fontWeight: 800 }}>
                                    N° Orden de Compra (OC): *
                                </label>
                                <input
                                    type="text"
                                    placeholder="Ej. 0046096"
                                    value={ocNumber}
                                    onChange={e => setOcNumber(e.target.value)}
                                    style={{
                                        width: '100%', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(16,185,129,0.4)',
                                        borderRadius: '7px', padding: '0.45rem 0.65rem', color: '#FFF', fontSize: '0.82rem',
                                        fontWeight: 800, outline: 'none'
                                    }}
                                />
                            </div>

                            {/* Fecha en la OC */}
                            <div>
                                <label style={{ display: 'block', fontSize: '0.7rem', color: 'rgba(255,255,255,0.6)', marginBottom: '3px', fontWeight: 700 }}>
                                    Fecha en la OC:
                                </label>
                                <input
                                    type="date"
                                    value={fechaOc}
                                    onChange={e => setFechaOc(e.target.value)}
                                    style={{
                                        width: '100%', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.1)',
                                        borderRadius: '7px', padding: '0.45rem 0.65rem', color: '#FFF', fontSize: '0.82rem', outline: 'none'
                                    }}
                                />
                            </div>

                            {/* N° Comprobante */}
                            <div>
                                <label style={{ display: 'block', fontSize: '0.7rem', color: 'rgba(255,255,255,0.6)', marginBottom: '3px', fontWeight: 700 }}>
                                    N° Comprobante (Factura/Boleta):
                                </label>
                                <input
                                    type="text"
                                    placeholder="Ej. F001-0004522"
                                    value={docNumber}
                                    onChange={e => setDocNumber(e.target.value)}
                                    style={{
                                        width: '100%', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.1)',
                                        borderRadius: '7px', padding: '0.45rem 0.65rem', color: '#FFF', fontSize: '0.82rem', outline: 'none'
                                    }}
                                />
                            </div>

                            {/* Fecha Real de Cobro */}
                            <div>
                                <label style={{ display: 'block', fontSize: '0.7rem', color: '#10B981', marginBottom: '3px', fontWeight: 800 }}>
                                    Fecha Real de Cobro: *
                                </label>
                                <input
                                    type="date"
                                    value={fechaCobro}
                                    onChange={e => setFechaCobro(e.target.value)}
                                    style={{
                                        width: '100%', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(16,185,129,0.4)',
                                        borderRadius: '7px', padding: '0.45rem 0.65rem', color: '#FFF', fontSize: '0.82rem', outline: 'none'
                                    }}
                                />
                            </div>

                            {/* Total Esperado de la OC */}
                            <div>
                                <label style={{ display: 'block', fontSize: '0.7rem', color: '#38BDF8', marginBottom: '3px', fontWeight: 800 }}>
                                    Total en OC PDF (S/ con IGV):
                                </label>
                                <input
                                    type="number"
                                    step="0.01"
                                    placeholder="Ej. 16587.26"
                                    value={expectedTotal}
                                    onChange={e => setExpectedTotal(e.target.value)}
                                    style={{
                                        width: '100%', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(56,189,248,0.4)',
                                        borderRadius: '7px', padding: '0.45rem 0.65rem', color: '#38BDF8', fontSize: '0.82rem',
                                        fontWeight: 900, outline: 'none'
                                    }}
                                />
                            </div>
                        </div>

                        {/* Glosa / Observaciones */}
                        <div style={{ marginTop: '0.5rem' }}>
                            <input
                                type="text"
                                placeholder="Glosa / Observaciones del Lote (Ej. MiBanco OPEX - Facturación Mantenimiento Sedes)"
                                value={observaciones}
                                onChange={e => setObservaciones(e.target.value)}
                                style={{
                                    width: '100%', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.08)',
                                    borderRadius: '7px', padding: '0.4rem 0.65rem', color: '#FFF', fontSize: '0.78rem', outline: 'none'
                                }}
                            />
                        </div>
                    </div>

                    {/* SECCIÓN 2: BARRA DE ADJUNTAR PDF Y DETECCIÓN AUTOMÁTICA */}
                    <div style={{
                        background: 'linear-gradient(135deg, rgba(16,185,129,0.06) 0%, rgba(139,92,246,0.04) 100%)',
                        border: '1px solid rgba(16,185,129,0.25)',
                        borderRadius: '14px', padding: '0.85rem 1rem'
                    }}>
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

                        {pdfFile ? (
                            /* Vista compacta cuando hay archivo adjunto */
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                    <div style={{
                                        width: '36px', height: '36px', borderRadius: '8px',
                                        background: 'rgba(16,185,129,0.2)', display: 'flex',
                                        alignItems: 'center', justifyContent: 'center', color: '#10B981'
                                    }}>
                                        <FileCheck size={20} />
                                    </div>
                                    <div>
                                        <div style={{ color: 'white', fontWeight: 800, fontSize: '0.84rem' }}>
                                            {pdfFile.name} <span style={{ color: '#10B981', fontSize: '0.72rem', fontWeight: 600 }}>({(pdfFile.size / 1024).toFixed(1)} KB)</span>
                                        </div>
                                        <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.7rem' }}>
                                            Archivo listo para extracción de tickets y validación de montos
                                        </div>
                                    </div>
                                </div>

                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                                    <button
                                        onClick={handleDetectAndSelectTickets}
                                        disabled={isParsingPdf}
                                        style={{
                                            background: isParsingPdf
                                                ? 'rgba(139,92,246,0.3)'
                                                : 'linear-gradient(135deg, #8B5CF6 0%, #6D28D9 100%)',
                                            border: 'none', color: '#FFF', padding: '0.5rem 1.15rem', borderRadius: '8px',
                                            fontSize: '0.8rem', fontWeight: 900, cursor: isParsingPdf ? 'wait' : 'pointer',
                                            display: 'flex', alignItems: 'center', gap: '6px',
                                            boxShadow: '0 3px 12px rgba(139,92,246,0.4)'
                                        }}>
                                        {isParsingPdf ? (
                                            <>
                                                <RefreshCw size={15} className="animate-spin" />
                                                <span>Leyendo PDF y tickets...</span>
                                            </>
                                        ) : (
                                            <>
                                                <Sparkles size={15} />
                                                <span>Detectar y Marcar Tickets Automáticamente</span>
                                            </>
                                        )}
                                    </button>

                                    <button
                                        onClick={() => fileInputRef.current?.click()}
                                        style={{
                                            background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
                                            color: '#FFF', padding: '0.5rem 0.85rem', borderRadius: '8px',
                                            fontSize: '0.76rem', fontWeight: 700, cursor: 'pointer'
                                        }}>
                                        Cambiar PDF
                                    </button>

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
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            </div>
                        ) : (
                            /* Dropzone cuando no hay archivo */
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
                                    background: isDragging ? 'rgba(16,185,129,0.15)' : 'rgba(0,0,0,0.25)',
                                    border: `2px dashed ${isDragging ? '#10B981' : 'rgba(255,255,255,0.15)'}`,
                                    borderRadius: '10px', padding: '0.85rem', textAlign: 'center',
                                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    gap: '0.85rem'
                                }}>
                                <UploadCloud size={24} color="#10B981" />
                                <div>
                                    <span style={{ fontSize: '0.82rem', fontWeight: 800, color: 'white' }}>
                                        Adjuntar PDF de la Orden de Compra:
                                    </span>
                                    <span style={{ fontSize: '0.74rem', color: 'rgba(255,255,255,0.5)', marginLeft: '6px' }}>
                                        Haz clic aquí o arrastra tu archivo (ej. MiBanco OPEX/CAPEX)
                                    </span>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* ALERTA DE DISCREPANCIA FINANCIERA (SI EXISTE DIFERENCIA CON LA OC) */}
                    {discrepantItems.length > 0 && (
                        <div style={{
                            background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.35)',
                            borderRadius: '12px', padding: '0.75rem 1rem', display: 'flex',
                            alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                <AlertTriangle size={20} color="#F59E0B" />
                                <div>
                                    <div style={{ fontSize: '0.8rem', fontWeight: 900, color: '#FCD34D' }}>
                                        Discrepancia detectada entre montos del sistema y la Orden de Compra:
                                    </div>
                                    <div style={{ fontSize: '0.73rem', color: 'rgba(255,255,255,0.8)', marginTop: '2px' }}>
                                        {discrepantItems.map(d => (
                                            <span key={d.item.id} style={{ marginRight: '10px' }}>
                                                Ticket <strong>{d.item.ticketNum}</strong>: En OC <strong>S/ {fmt(d.pdfTotal)}</strong> (Sistema: S/ {fmt(d.systemTotal)}, Dif: {d.diff > 0 ? `+S/ ${fmt(d.diff)}` : `-S/ ${fmt(Math.abs(d.diff))}`})
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <button
                                onClick={handleAdjustAllToOc}
                                style={{
                                    background: 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)',
                                    border: 'none', color: '#000', padding: '0.45rem 1rem', borderRadius: '8px',
                                    fontSize: '0.76rem', fontWeight: 900, cursor: 'pointer',
                                    display: 'flex', alignItems: 'center', gap: '6px',
                                    boxShadow: '0 2px 8px rgba(245,158,11,0.3)'
                                }}>
                                <Zap size={14} />
                                <span>Ajustar tickets a la OC para cuadre exacto (S/ {expectedTotal})</span>
                            </button>
                        </div>
                    )}

                    {/* SECCIÓN 3: PESTAÑAS DE VISTA Y CONTROLES DE BÚSQUEDA */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                {detectedTicketIds.size > 0 && (
                                    <button
                                        onClick={() => setViewMode('detected')}
                                        style={{
                                            background: viewMode === 'detected'
                                                ? 'linear-gradient(135deg, #10B981 0%, #059669 100%)'
                                                : 'rgba(255,255,255,0.05)',
                                            border: `1px solid ${viewMode === 'detected' ? '#10B981' : 'rgba(255,255,255,0.12)'}`,
                                            color: '#FFF', padding: '0.45rem 0.95rem', borderRadius: '8px',
                                            fontSize: '0.78rem', fontWeight: 900, cursor: 'pointer',
                                            display: 'flex', alignItems: 'center', gap: '6px',
                                            boxShadow: viewMode === 'detected' ? '0 2px 8px rgba(16,185,129,0.3)' : 'none'
                                        }}>
                                        <Sparkles size={14} />
                                        <span>Tickets Detectados en la OC ({detectedTicketIds.size})</span>
                                    </button>
                                )}

                                <button
                                    onClick={() => setViewMode('all')}
                                    style={{
                                        background: viewMode === 'all'
                                            ? 'linear-gradient(135deg, #3B82F6 0%, #2563EB 100%)'
                                            : 'rgba(255,255,255,0.05)',
                                        border: `1px solid ${viewMode === 'all' ? '#3B82F6' : 'rgba(255,255,255,0.12)'}`,
                                        color: '#FFF', padding: '0.45rem 0.95rem', borderRadius: '8px',
                                        fontSize: '0.78rem', fontWeight: 800, cursor: 'pointer',
                                        display: 'flex', alignItems: 'center', gap: '6px'
                                    }}>
                                    <FileText size={14} />
                                    <span>Todos los Pendientes ({pendingItems.length})</span>
                                </button>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <button
                                    onClick={handleSelectAllVisible}
                                    style={{
                                        background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.3)',
                                        color: '#60A5FA', padding: '0.35rem 0.75rem', borderRadius: '7px',
                                        fontSize: '0.72rem', fontWeight: 800, cursor: 'pointer'
                                    }}>
                                    Seleccionar Visibles ({filteredItems.length})
                                </button>

                                <button
                                    onClick={handleClearSelection}
                                    style={{
                                        background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)',
                                        color: '#F87171', padding: '0.35rem 0.75rem', borderRadius: '7px',
                                        fontSize: '0.72rem', fontWeight: 800, cursor: 'pointer'
                                    }}>
                                    Deseleccionar Todos
                                </button>
                            </div>
                        </div>

                        {/* Buscador & Selector de Cliente */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.6rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flex: 1 }}>
                                <div style={{ position: 'relative', width: '240px' }}>
                                    <Search size={14} color="rgba(255,255,255,0.4)" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
                                    <input
                                        type="text"
                                        placeholder="Buscar ticket, sede..."
                                        value={searchTerm}
                                        onChange={e => setSearchTerm(e.target.value)}
                                        style={{
                                            background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
                                            borderRadius: '7px', color: 'white', padding: '0.4rem 0.65rem 0.4rem 2rem',
                                            fontSize: '0.76rem', outline: 'none', width: '100%'
                                        }}
                                    />
                                </div>

                                {clientOptions.length > 1 && (
                                    <select
                                        value={clientFilter}
                                        onChange={e => setClientFilter(e.target.value)}
                                        style={{
                                            background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
                                            borderRadius: '7px', color: 'white', padding: '0.4rem 0.65rem',
                                            fontSize: '0.76rem', outline: 'none'
                                        }}>
                                        <option value="all">Todos los Clientes</option>
                                        {clientOptions.map(c => <option key={c} value={c}>{c}</option>)}
                                    </select>
                                )}

                                <span style={{ fontSize: '0.73rem', color: 'rgba(255,255,255,0.5)', fontWeight: 600 }}>
                                    {viewMode === 'detected'
                                        ? `Mostrando ${filteredItems.length} tickets de la Orden de Compra (puedes deseleccionar o ajustar cualquiera en la tabla)`
                                        : `Mostrando ${filteredItems.length} de ${pendingItems.length} tickets cerrados`
                                    }
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* SECCIÓN 4: TABLA DE TICKETS (EL CUADRO PRINCIPAL) */}
                    <div
                        ref={tableContainerRef}
                        style={{
                            minHeight: '280px', maxHeight: '420px', overflowY: 'auto',
                            border: '1px solid rgba(16,185,129,0.25)', borderRadius: '12px',
                            background: 'rgba(0,0,0,0.4)', position: 'relative'
                        }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                            <thead>
                                <tr style={{
                                    background: '#0D111A', borderBottom: '1px solid rgba(255,255,255,0.08)',
                                    position: 'sticky', top: 0, zIndex: 10
                                }}>
                                    <th style={{ padding: '9px 12px', width: '38px', textAlign: 'center' }}></th>
                                    <th style={{ padding: '9px 12px', fontSize: '0.67rem', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', fontWeight: 800 }}>N° TICKET</th>
                                    <th style={{ padding: '9px 12px', fontSize: '0.67rem', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', fontWeight: 800 }}>CLIENTE / SEDE</th>
                                    <th style={{ padding: '9px 12px', fontSize: '0.67rem', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', fontWeight: 800 }}>SERVICIO</th>
                                    <th style={{ padding: '9px 12px', fontSize: '0.67rem', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', fontWeight: 800, textAlign: 'right' }}>MONTO SISTEMA</th>
                                    <th style={{ padding: '9px 12px', fontSize: '0.67rem', color: '#38BDF8', textTransform: 'uppercase', fontWeight: 800, textAlign: 'right' }}>MONTO EN OC (PDF)</th>
                                    <th style={{ padding: '9px 12px', fontSize: '0.67rem', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', fontWeight: 800, textAlign: 'center' }}>ESTADO / CUADRE</th>
                                    <th style={{ padding: '9px 12px', fontSize: '0.67rem', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', fontWeight: 800, textAlign: 'center', width: '140px' }}>ACCIÓN</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredItems.length === 0 ? (
                                    <tr>
                                        <td colSpan={8} style={{ padding: '3rem 1.5rem', textAlign: 'center', color: 'rgba(255,255,255,0.45)', fontSize: '0.85rem' }}>
                                            {viewMode === 'detected'
                                                ? 'No hay tickets detectados en la OC actualmente seleccionados. Puedes cambiar a la pestaña "Todos los Pendientes" para seleccionar manualmente.'
                                                : 'No se encontraron tickets cerrados que coincidan con la búsqueda.'}
                                        </td>
                                    </tr>
                                ) : (
                                    filteredItems.map(item => {
                                        const isSelected = selectedIds.has(item.id);
                                        const isDetected = detectedTicketIds.has(item.id) || (item.ticketId && detectedTicketIds.has(item.ticketId));
                                        
                                        // Detalles extraídos de la OC del PDF si existen
                                        const pdfInfo = getPdfInfoForItem(item);
                                        
                                        // Monto actual aplicado (ajustado u original)
                                        const adj = adjustedAmounts[item.id];
                                        const currentTotal = adj ? adj.total : round2(item.monto || 0);
                                        const currentBase = adj ? adj.base : round2(item.montoSinIGV || (currentTotal > 0 ? currentTotal / 1.18 : 0));
                                        
                                        // Comparación contra PDF
                                        let diffWithPdf = 0;
                                        let hasDiscrepancy = false;
                                        if (pdfInfo) {
                                            diffWithPdf = round2(currentTotal - pdfInfo.total);
                                            hasDiscrepancy = Math.abs(diffWithPdf) >= 0.05;
                                        }

                                        return (
                                            <tr
                                                key={item.id}
                                                onClick={() => toggleSelect(item.id)}
                                                style={{
                                                    borderBottom: '1px solid rgba(255,255,255,0.04)',
                                                    background: isSelected
                                                        ? (hasDiscrepancy ? 'rgba(245, 158, 11, 0.08)' : 'rgba(16,185,129,0.08)')
                                                        : 'transparent',
                                                    cursor: 'pointer', transition: 'background 0.15s'
                                                }}>
                                                {/* CHECKBOX */}
                                                <td style={{ padding: '9px 12px', textAlign: 'center' }}>
                                                    {isSelected ? (
                                                        <CheckSquare size={17} color={hasDiscrepancy ? "#F59E0B" : "#10B981"} />
                                                    ) : (
                                                        <Square size={17} color="rgba(255,255,255,0.25)" />
                                                    )}
                                                </td>

                                                {/* N° TICKET */}
                                                <td style={{ padding: '9px 12px' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                        <span style={{
                                                            color: isSelected ? (hasDiscrepancy ? '#FCD34D' : '#10B981') : '#60A5FA',
                                                            fontFamily: 'monospace', fontWeight: 800, fontSize: '0.82rem'
                                                        }}>
                                                            {item.ticketNum}
                                                        </span>
                                                        {isDetected && (
                                                            <span style={{
                                                                fontSize: '0.6rem', fontWeight: 900,
                                                                background: 'rgba(16,185,129,0.2)', color: '#10B981',
                                                                padding: '1px 5px', borderRadius: '4px', border: '1px solid rgba(16,185,129,0.3)'
                                                            }}>
                                                                En OC
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>

                                                {/* CLIENTE Y SEDE */}
                                                <td style={{ padding: '9px 12px' }}>
                                                    <div style={{ color: 'rgba(255,255,255,0.9)', fontSize: '0.76rem', fontWeight: 600 }}>
                                                        {item.clientName}
                                                    </div>
                                                    {item.agencia && (
                                                        <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.67rem' }}>
                                                            📍 {item.agencia}
                                                        </div>
                                                    )}
                                                </td>

                                                {/* SERVICIO */}
                                                <td style={{ padding: '9px 12px' }}>
                                                    <span style={{
                                                        padding: '2px 6px', borderRadius: '4px', fontSize: '0.64rem', fontWeight: 700,
                                                        background: 'rgba(139,92,246,0.15)', color: '#A78BFA'
                                                    }}>
                                                        {item.servicio}
                                                    </span>
                                                </td>

                                                {/* MONTO SISTEMA */}
                                                <td style={{ padding: '9px 12px', textAlign: 'right' }}>
                                                    <div style={{ color: isSelected ? 'white' : 'rgba(255,255,255,0.65)', fontSize: '0.82rem', fontWeight: 800 }}>
                                                        S/ {fmt(currentTotal)}
                                                    </div>
                                                    <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.66rem' }}>
                                                        Sub: S/ {fmt(currentBase)}
                                                    </div>
                                                </td>

                                                {/* MONTO EN OC (PDF) */}
                                                <td style={{ padding: '9px 12px', textAlign: 'right' }}>
                                                    {pdfInfo ? (
                                                        <div>
                                                            <div style={{ color: '#38BDF8', fontSize: '0.82rem', fontWeight: 900 }}>
                                                                S/ {fmt(pdfInfo.total)}
                                                            </div>
                                                            <div style={{ color: 'rgba(56,189,248,0.6)', fontSize: '0.66rem' }}>
                                                                Sub: S/ {fmt(pdfInfo.subtotal)}
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.72rem' }}>—</span>
                                                    )}
                                                </td>

                                                {/* ESTADO / CUADRE */}
                                                <td style={{ padding: '9px 12px', textAlign: 'center' }}>
                                                    {pdfInfo ? (
                                                        hasDiscrepancy ? (
                                                            <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: '3px' }}>
                                                                <span style={{
                                                                    fontSize: '0.68rem', fontWeight: 900, color: '#F59E0B',
                                                                    background: 'rgba(245,158,11,0.15)', padding: '2px 6px', borderRadius: '4px',
                                                                    border: '1px solid rgba(245,158,11,0.3)'
                                                                }}>
                                                                    ⚠️ {diffWithPdf > 0 ? `+S/ ${fmt(diffWithPdf)}` : `-S/ ${fmt(Math.abs(diffWithPdf))}`}
                                                                </span>
                                                                <button
                                                                    onClick={e => handleAdjustSingleToOc(item, pdfInfo.subtotal, pdfInfo.total, e)}
                                                                    style={{
                                                                        background: 'rgba(245,158,11,0.2)', border: '1px solid rgba(245,158,11,0.4)',
                                                                        color: '#FCD34D', padding: '1px 6px', borderRadius: '4px',
                                                                        fontSize: '0.62rem', fontWeight: 800, cursor: 'pointer'
                                                                    }}>
                                                                    Ajustar a OC
                                                                </button>
                                                            </div>
                                                        ) : (
                                                            <span style={{
                                                                fontSize: '0.7rem', fontWeight: 800, color: '#10B981',
                                                                display: 'inline-flex', alignItems: 'center', gap: '3px'
                                                            }}>
                                                                <Check size={13} /> Cuadra
                                                            </span>
                                                        )
                                                    ) : (
                                                        <span style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.4)' }}>
                                                            {isSelected ? 'Marcado' : 'Pendiente'}
                                                        </span>
                                                    )}
                                                </td>

                                                {/* ACCIÓN (DESELECCIONAR / INCLUIR) */}
                                                <td style={{ padding: '9px 12px', textAlign: 'center' }} onClick={e => e.stopPropagation()}>
                                                    {isSelected ? (
                                                        <button
                                                            onClick={e => deselectTicket(item.id, e)}
                                                            title="Deseleccionar este ticket del cobro"
                                                            style={{
                                                                background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)',
                                                                color: '#F87171', padding: '0.28rem 0.6rem', borderRadius: '6px',
                                                                fontSize: '0.7rem', fontWeight: 800, cursor: 'pointer',
                                                                display: 'inline-flex', alignItems: 'center', gap: '4px'
                                                            }}>
                                                            <MinusCircle size={13} />
                                                            <span>Deseleccionar</span>
                                                        </button>
                                                    ) : (
                                                        <button
                                                            onClick={e => selectTicket(item.id, e)}
                                                            title="Incluir este ticket en el cobro"
                                                            style={{
                                                                background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.3)',
                                                                color: '#34D399', padding: '0.28rem 0.6rem', borderRadius: '6px',
                                                                fontSize: '0.7rem', fontWeight: 800, cursor: 'pointer',
                                                                display: 'inline-flex', alignItems: 'center', gap: '4px'
                                                            }}>
                                                            <PlusCircle size={13} />
                                                            <span>Incluir</span>
                                                        </button>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* SECCIÓN 5: RESUMEN FINANCIERO Y CUADRE DEL LOTE (COMPACTA) */}
                    <div style={{
                        background: 'linear-gradient(135deg, rgba(16,185,129,0.08) 0%, rgba(59,130,246,0.04) 100%)',
                        border: '1px solid rgba(16,185,129,0.3)',
                        borderRadius: '12px', padding: '0.75rem 1rem', display: 'flex',
                        justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', flexWrap: 'wrap' }}>
                            <div>
                                <span style={{ fontSize: '0.67rem', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', fontWeight: 800, display: 'block' }}>
                                    TICKETS SELECCIONADOS
                                </span>
                                <span style={{ fontSize: '1.15rem', fontWeight: 900, color: batchTotals.count > 0 ? '#10B981' : 'white' }}>
                                    {batchTotals.count} {detectedTicketIds.size > 0 && <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)' }}>/ {detectedTicketIds.size} en OC</span>}
                                </span>
                            </div>

                            <div style={{ height: '30px', width: '1px', background: 'rgba(255,255,255,0.1)' }} />

                            <div>
                                <span style={{ fontSize: '0.67rem', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', fontWeight: 800, display: 'block' }}>
                                    SUBTOTAL (SIN IGV)
                                </span>
                                <span style={{ fontSize: '1.05rem', fontWeight: 800, color: 'rgba(255,255,255,0.9)' }}>
                                    S/ {fmt(batchTotals.base)}
                                </span>
                            </div>

                            <div style={{ height: '30px', width: '1px', background: 'rgba(255,255,255,0.1)' }} />

                            <div>
                                <span style={{ fontSize: '0.67rem', color: '#A78BFA', textTransform: 'uppercase', fontWeight: 800, display: 'block' }}>
                                    IGV (18%)
                                </span>
                                <span style={{ fontSize: '1.05rem', fontWeight: 800, color: '#A78BFA' }}>
                                    S/ {fmt(batchTotals.igv)}
                                </span>
                            </div>

                            <div style={{ height: '30px', width: '1px', background: 'rgba(255,255,255,0.1)' }} />

                            <div>
                                <span style={{ fontSize: '0.67rem', color: '#10B981', textTransform: 'uppercase', fontWeight: 900, display: 'block' }}>
                                    TOTAL FACTURADO (CON IGV)
                                </span>
                                <span style={{ fontSize: '1.25rem', fontWeight: 900, color: '#10B981' }}>
                                    S/ {fmt(batchTotals.total)}
                                </span>
                            </div>
                        </div>

                        {/* ESTADO DE CUADRE CON LA OC */}
                        {batchTotals.expNum !== null && (
                            <div style={{
                                padding: '0.4rem 0.85rem', borderRadius: '8px',
                                background: batchTotals.isBalanced ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.15)',
                                border: `1px solid ${batchTotals.isBalanced ? 'rgba(16,185,129,0.4)' : 'rgba(245,158,11,0.4)'}`,
                                display: 'flex', alignItems: 'center', gap: '8px'
                            }}>
                                {batchTotals.isBalanced ? (
                                    <>
                                        <CheckCircle2 size={16} color="#10B981" />
                                        <div style={{ fontSize: '0.76rem', fontWeight: 900, color: '#A7F3D0' }}>
                                            CUADRADO AL 100% CON LA OC (S/ {fmt(batchTotals.expNum)})
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        <AlertCircle size={16} color="#F59E0B" />
                                        <div>
                                            <div style={{ fontSize: '0.74rem', fontWeight: 900, color: '#FCD34D' }}>
                                                DIFERENCIA CON OC: S/ {fmt(Math.abs(batchTotals.diff || 0))} {batchTotals.diff! > 0 ? '(Sobra)' : '(Falta)'}
                                            </div>
                                            <div style={{ fontSize: '0.66rem', color: 'rgba(255,255,255,0.6)' }}>
                                                OC: S/ {fmt(batchTotals.expNum)} vs Lote: S/ {fmt(batchTotals.total)}
                                            </div>
                                        </div>
                                    </>
                                )}
                            </div>
                        )}
                    </div>

                </div>

                {/* ── FOOTER RESUMEN & BOTONES DE ACCIÓN ── */}
                <div style={{
                    padding: '0.85rem 1.5rem', borderTop: '1px solid rgba(255,255,255,0.08)',
                    background: '#07090F', display: 'flex', justifyContent: 'space-between',
                    alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem'
                }}>
                    <div style={{ fontSize: '0.76rem', color: 'rgba(255,255,255,0.6)' }}>
                        {batchTotals.count === 0 ? (
                            <span>Ningún ticket seleccionado para cobro.</span>
                        ) : (
                            <span>
                                Confirmando cobro de <strong style={{ color: '#10B981' }}>{batchTotals.count} tickets</strong> por un total de <strong style={{ color: '#10B981' }}>S/ {fmt(batchTotals.total)}</strong> con la OC <strong>{ocNumber || 'N/A'}</strong>.
                            </span>
                        )}
                    </div>

                    <div style={{ display: 'flex', gap: '0.65rem' }}>
                        <button
                            onClick={onClose}
                            disabled={isProcessing}
                            style={{
                                background: 'transparent', border: '1px solid rgba(255,255,255,0.15)',
                                color: 'rgba(255,255,255,0.7)', padding: '0.55rem 1.15rem', borderRadius: '8px',
                                fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer'
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
                                padding: '0.55rem 1.5rem', borderRadius: '8px',
                                fontSize: '0.84rem', fontWeight: 900,
                                cursor: isProcessing || batchTotals.count === 0 || !ocNumber.trim() ? 'not-allowed' : 'pointer',
                                display: 'flex', alignItems: 'center', gap: '8px',
                                boxShadow: isProcessing || batchTotals.count === 0 || !ocNumber.trim() ? 'none' : '0 4px 14px rgba(16,185,129,0.4)',
                                transition: 'all 0.2s'
                            }}>
                            {isProcessing ? (
                                <>
                                    <RefreshCw size={15} className="animate-spin" />
                                    <span>Registrando {progress.current} de {progress.total}...</span>
                                </>
                            ) : (
                                <>
                                    <ShieldCheck size={16} />
                                    <span>Confirmar y Registrar Cobro ({batchTotals.count} Tickets)</span>
                                </>
                            )}
                        </button>
                    </div>
                </div>

            </div>
        </div>
    );
}
