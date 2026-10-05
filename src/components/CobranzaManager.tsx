"use client";

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * COBRANZA MANAGER - V5 (Mejoras Integridad + UX + Métricas)
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * MEJORAS V5:
 * #1 - Campo "Fecha real de cobro" editable en modal OC
 * #2 - Campo "N° Comprobante (Factura/Boleta)" separado del N° OC
 * #3 - JOIN completo: invoices → tickets → clients, branch_offices
 * #4 - Invalidación de caché CFO tras crear invoice
 * #5 - Protección anti doble-submit con useRef
 * #6 - Export Excel enriquecido (Sede, N° Comp, Monto Base, IGV)
 * #7 - Badge de estado_cobranza por fila en tabla de pendientes
 * #8 - Paginación (25 filas por página)
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import React, { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/useQueryHooks";
import { round2 } from "@/lib/formatters";
import {
    CheckCircle2, X, RefreshCw, Download, Loader2,
    AlertTriangle, FileText, ChevronLeft, ChevronRight,
} from "lucide-react";
import * as XLSX from "xlsx";

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS & CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────
const fmt = (n: number) =>
    n.toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const IGV_RATE = 0.18;
const IGV_MULTIPLIER = 1.18;
const PAGE_SIZE = 25;

// Formatea una fecha ISO a input[type=datetime-local]
const toDatetimeLocal = (iso: string) => iso.slice(0, 16);
// Hoy a las 00:00 hora Lima (UTC-5)
const todayLocalISO = () => {
    const now = new Date();
    now.setSeconds(0, 0);
    return toDatetimeLocal(now.toISOString());
};

// ─────────────────────────────────────────────────────────────────────────────
// TYPE DEFINITIONS
// ─────────────────────────────────────────────────────────────────────────────
interface Invoice {
    id: string;
    ticket_id: string;
    amount_base: number;
    amount_total: number;
    status: "emitida" | "cobrada" | "anulada";
    invoice_number: string | null;   // N° OC
    doc_number: string | null;       // N° Comprobante (Factura/Boleta) — FIX #2
    paid_date: string | null;
    created_at: string;
    // JOIN #3
    tickets?: {
        client_ticket_number: string | null;
        clients?: { name: string } | null;
        branch_offices?: { name: string } | null;
    } | null;
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
    estado_cobranza: "pendiente" | "facturado" | "cobrado";
}

// ─────────────────────────────────────────────────────────────────────────────
// PROPS
// ─────────────────────────────────────────────────────────────────────────────
interface CobranzaManagerProps {
    tickets: Ticket[];
    onToast: (title: string, desc: string) => void;
    onClose?: () => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENTE PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────
export default function CobranzaManager({ tickets, onToast, onClose }: CobranzaManagerProps) {
    const queryClient = useQueryClient();

    // ── ESTADOS LOCALES ──
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [localTickets, setLocalTickets] = useState<Ticket[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<"pendientes" | "historial">("pendientes");
    const [searchTerm, setSearchTerm] = useState("");
    const [processing, setProcessing] = useState<string | null>(null);

    // FIX #5: Ref anti doble-submit
    const isSubmittingRef = useRef(false);

    // FIX #8: Paginación
    const [currentPagePending, setCurrentPagePending] = useState(1);
    const [currentPageHistorial, setCurrentPageHistorial] = useState(1);

    // Estados del modal de creación
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [selectedTicket, setSelectedTicket] = useState<(typeof pendingTickets)[0] | null>(null);
    const [invoiceOc, setInvoiceOc] = useState("");          // N° OC
    const [invoiceDocNumber, setInvoiceDocNumber] = useState(""); // FIX #2: N° Comprobante
    const [invoiceAmountBase, setInvoiceAmountBase] = useState("");
    const [invoicePaidDate, setInvoicePaidDate] = useState(todayLocalISO()); // FIX #1
    const [cobroTipo, setCobroTipo] = useState<"oc" | "evento_perdida">("oc");

    // Sincronizar tickets de props con estado local
    useEffect(() => {
        setLocalTickets(tickets);
    }, [tickets]);

    // ── CARGA DE DATOS ──
    // FIX #3: JOIN completo tickets → clients, branch_offices
    const loadInvoices = useCallback(async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from("invoices")
                .select(`
                    *,
                    tickets (
                        client_ticket_number,
                        clients ( name ),
                        branch_offices ( name )
                    )
                `)
                .order("created_at", { ascending: false });

            if (error) throw error;
            setInvoices((data as Invoice[]) || []);
        } catch (err: unknown) {
            console.error("[CobranzaManager] Error cargando invoices:", err);
            onToast("Error", "No se pudieron cargar las facturas");
        } finally {
            setLoading(false);
        }
    }, [onToast]);

    useEffect(() => {
        loadInvoices();
    }, [loadInvoices]);

    // ── CÁLCULOS DERIVADOS ──
    const invoicesByTicketId = useMemo(() => {
        const map = new Map<string, Invoice[]>();
        invoices.forEach((inv) => {
            const existing = map.get(inv.ticket_id) || [];
            map.set(inv.ticket_id, [...existing, inv]);
        });
        return map;
    }, [invoices]);

    const pendingTickets = useMemo(() => {
        return localTickets
            .filter((t) => {
                const statusId = (t.status_id || "").toLowerCase();
                const isClosed =
                    statusId === "ticket_cerrado" ||
                    statusId === "liquidado" ||
                    statusId === "cerrado";
                return isClosed && t.estado_cobranza !== "cobrado";
            })
            .map((ticket) => {
                const rawAmount = ticket.total_quoted_amount || ticket.montoFinal || 0;
                const esMasIGV = ticket.mas_igv === true;
                const montoBase = esMasIGV ? rawAmount : rawAmount / IGV_MULTIPLIER;
                const montoConIGV = montoBase * IGV_MULTIPLIER;
                return {
                    ...ticket,
                    _montoBase: round2(montoBase),
                    _montoConIGV: round2(montoConIGV),
                    _invoices: invoicesByTicketId.get(ticket.id) || [],
                };
            });
    }, [localTickets, invoicesByTicketId]);

    const collectedInvoices = useMemo(() => {
        return invoices
            .filter((inv) => inv.status === "cobrada")
            .sort(
                (a, b) =>
                    new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
            );
    }, [invoices]);

    const getMonthName = (month: number) => {
        const months = [
            "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
            "Julio", "Agosto", "Setiembre", "Octubre", "Noviembre", "Diciembre",
        ];
        return months[month];
    };

    const metrics = useMemo(() => {
        const totalPendiente = pendingTickets.reduce((acc, t) => acc + (t._montoConIGV || 0), 0);
        const totalCobrado = collectedInvoices.reduce((acc, inv) => acc + (inv.amount_total || 0), 0);
        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth();
        const cobrosMesActual = collectedInvoices.filter((inv) => {
            const d = new Date(inv.paid_date ?? inv.created_at);
            return d.getFullYear() === currentYear && d.getMonth() === currentMonth;
        });
        const mesAnterior = currentMonth === 0 ? 11 : currentMonth - 1;
        const añoMesAnterior = currentMonth === 0 ? currentYear - 1 : currentYear;
        const cobrosMesAnterior = collectedInvoices.filter((inv) => {
            const d = new Date(inv.paid_date ?? inv.created_at);
            return d.getFullYear() === añoMesAnterior && d.getMonth() === mesAnterior;
        });
        return {
            totalPendiente: round2(totalPendiente),
            totalCobrado: round2(totalCobrado),
            countPending: pendingTickets.length,
            countCollected: collectedInvoices.length,
            mesActualNombre: getMonthName(currentMonth),
            mesAnteriorNombre: getMonthName(mesAnterior),
            totalMesActual: round2(cobrosMesActual.reduce((a, i) => a + i.amount_total, 0)),
            countMesActual: cobrosMesActual.length,
            totalMesAnterior: round2(cobrosMesAnterior.reduce((a, i) => a + i.amount_total, 0)),
            countMesAnterior: cobrosMesAnterior.length,
        };
    }, [pendingTickets, collectedInvoices]);

    // ── FILTROS ──
    const filteredPending = useMemo(() => {
        if (!searchTerm.trim()) return pendingTickets;
        const term = searchTerm.toLowerCase();
        return pendingTickets.filter(
            (t) =>
                (t.client_ticket_number || "").toLowerCase().includes(term) ||
                (t.clients?.name || "").toLowerCase().includes(term) ||
                (t.branch_offices?.name || "").toLowerCase().includes(term)
        );
    }, [pendingTickets, searchTerm]);

    const filteredHistorial = useMemo(() => {
        if (!searchTerm.trim()) return collectedInvoices;
        const term = searchTerm.toLowerCase();
        return collectedInvoices.filter(
            (inv) =>
                (inv.invoice_number || "").toLowerCase().includes(term) ||
                (inv.doc_number || "").toLowerCase().includes(term) ||
                (inv.tickets?.client_ticket_number || "").toLowerCase().includes(term) ||
                (inv.tickets?.clients?.name || "").toLowerCase().includes(term)
        );
    }, [collectedInvoices, searchTerm]);

    // FIX #8: Paginación
    const totalPagesPending = Math.ceil(filteredPending.length / PAGE_SIZE);
    const totalPagesHistorial = Math.ceil(filteredHistorial.length / PAGE_SIZE);

    const pagedPending = useMemo(() => {
        const start = (currentPagePending - 1) * PAGE_SIZE;
        return filteredPending.slice(start, start + PAGE_SIZE);
    }, [filteredPending, currentPagePending]);

    const pagedHistorial = useMemo(() => {
        const start = (currentPageHistorial - 1) * PAGE_SIZE;
        return filteredHistorial.slice(start, start + PAGE_SIZE);
    }, [filteredHistorial, currentPageHistorial]);

    // Reset page on search/tab change
    useEffect(() => { setCurrentPagePending(1); }, [searchTerm, activeTab]);
    useEffect(() => { setCurrentPageHistorial(1); }, [searchTerm, activeTab]);

    // ── HANDLERS ──

    /**
     * FIX #1 + #2 + #4 + #5
     * Transacción Atómica mejorada:
     * - Fecha de cobro real (editable)
     * - N° Comprobante separado del N° OC
     * - Invalidación de caché CFO completa
     * - Anti doble-submit
     */
    const handleCreateInvoice = async () => {
        if (!selectedTicket) return;

        // FIX #5: bloqueo anti doble-submit
        if (isSubmittingRef.current) return;
        isSubmittingRef.current = true;

        const montoBase = parseFloat(invoiceAmountBase) || selectedTicket._montoBase;
        if (isNaN(montoBase) || montoBase <= 0) {
            onToast("Error", "Ingrese un monto válido");
            isSubmittingRef.current = false;
            return;
        }
        if (selectedTicket.estado_cobranza === "cobrado") {
            onToast("Info", "Este ticket ya tiene una cobranza registrada");
            isSubmittingRef.current = false;
            return;
        }

        // FIX #1: Fecha real de cobro desde el campo editable
        const paidDateISO = invoicePaidDate
            ? new Date(invoicePaidDate).toISOString()
            : new Date().toISOString();

        const ticketId = selectedTicket.id;
        const ticketNum = selectedTicket.client_ticket_number || ticketId;
        const montoTotal = round2(montoBase * IGV_MULTIPLIER);

        let docNumber: string;
        if (cobroTipo === "evento_perdida") {
            docNumber = `EP-${Date.now()}`;
        } else {
            if (!invoiceOc.trim()) {
                onToast("Error", "Ingrese el número de OC");
                isSubmittingRef.current = false;
                return;
            }
            docNumber = invoiceOc.trim().toUpperCase();
        }

        // FIX #2: N° Comprobante como campo separado
        const invoicePayload = {
            ticket_id: ticketId,
            amount_base: round2(montoBase),
            amount_total: montoTotal,
            status: "cobrada" as const,
            invoice_number: docNumber,                // N° OC
            doc_number: invoiceDocNumber.trim() || null, // N° Comprobante
            paid_date: paidDateISO,
        };

        setProcessing(ticketId);

        // Optimistic update
        const tempId = "temp_" + Date.now();
        const tempInvoice: Invoice = { ...invoicePayload, id: tempId, created_at: paidDateISO };
        setInvoices((prev) => [...prev, tempInvoice]);

        try {
            const { data: created, error: insertError } = await supabase
                .from("invoices")
                .insert(invoicePayload)
                .select(`
                    *,
                    tickets (
                        client_ticket_number,
                        clients ( name ),
                        branch_offices ( name )
                    )
                `)
                .single();

            if (insertError) throw insertError;

            // FIX #4: Invalidar caché completo incluyendo métricas CFO
            queryClient.invalidateQueries({ queryKey: queryKeys.tickets.all });
            queryClient.invalidateQueries({ queryKey: ["invoices"] });
            queryClient.invalidateQueries({ queryKey: ["metrics"] });
            queryClient.invalidateQueries({ queryKey: ["cfo"] });

            // Reemplazar temporal con real (incluye el JOIN)
            setInvoices((prev) =>
                prev.map((inv) => (inv.id === tempId ? (created as Invoice) : inv))
            );

            // Optimistic: marcar ticket como cobrado
            setLocalTickets((prev) =>
                prev.map((t) =>
                    t.id === ticketId ? { ...t, estado_cobranza: "cobrado" as const } : t
                )
            );

            setShowCreateModal(false);
            setSelectedTicket(null);
            setInvoiceOc("");
            setInvoiceDocNumber("");
            setInvoiceAmountBase("");
            setInvoicePaidDate(todayLocalISO());

            onToast("✓ Cobranza Registrada", `Ticket ${ticketNum} — S/ ${fmt(montoTotal)}`);
        } catch (err: unknown) {
            console.error("[CobranzaManager] Error creando invoice:", err);
            // Revertir optimistic
            setInvoices((prev) => prev.filter((inv) => inv.id !== tempId));
            setLocalTickets((prev) =>
                prev.map((t) =>
                    t.id === ticketId
                        ? { ...t, estado_cobranza: "pendiente" as const }
                        : t
                )
            );
            const msg = err instanceof Error ? err.message : "No se pudo registrar la cobranza";
            onToast("Error", msg);
        } finally {
            setProcessing(null);
            isSubmittingRef.current = false;
        }
    };

    const handleOpenCreateModal = (ticket: (typeof pendingTickets)[0]) => {
        setSelectedTicket(ticket);
        setInvoiceOc("");
        setInvoiceDocNumber("");
        setInvoiceAmountBase(ticket._montoBase ? String(ticket._montoBase) : "");
        setInvoicePaidDate(todayLocalISO()); // FIX #1: resetear a hoy
        setCobroTipo("oc");
        setShowCreateModal(true);
    };

    const handleCloseModal = () => {
        setShowCreateModal(false);
        setSelectedTicket(null);
        setInvoiceOc("");
        setInvoiceDocNumber("");
        setInvoiceAmountBase("");
        setInvoicePaidDate(todayLocalISO());
        setCobroTipo("oc");
    };

    // FIX #6: Export Excel enriquecido
    const exportToExcel = () => {
        const data =
            activeTab === "pendientes"
                ? filteredPending.map((t) => ({
                      "N° Ticket": t.client_ticket_number || t.id,
                      Cliente: t.clients?.name || "N/A",
                      Sede: t.branch_offices?.name || "N/A",
                      "Estado Cobranza": t.estado_cobranza,
                      "Monto Base (S/)": t._montoBase,
                      "IGV (S/)": round2(t._montoBase * IGV_RATE),
                      "Total c/IGV (S/)": t._montoConIGV,
                  }))
                : filteredHistorial.map((inv) => ({
                      "N° Ticket": inv.tickets?.client_ticket_number || inv.ticket_id,
                      Cliente: inv.tickets?.clients?.name || "N/A",
                      Sede: inv.tickets?.branch_offices?.name || "N/A",
                      "N° OC": inv.invoice_number || "N/A",
                      "N° Comprobante": inv.doc_number || "N/A",
                      "Fecha Cobro": inv.paid_date
                          ? new Date(inv.paid_date).toLocaleDateString("es-PE")
                          : "N/A",
                      "Monto Base (S/)": inv.amount_base,
                      "IGV (S/)": round2(inv.amount_base * IGV_RATE),
                      "Total (S/)": inv.amount_total,
                  }));

        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Cobranzas");
        XLSX.writeFile(wb, `Cobranzas_${new Date().toISOString().split("T")[0]}.xlsx`);
    };

    // ─────────────────────────────────────────────────────────────────────────────
    // RENDER
    // ─────────────────────────────────────────────────────────────────────────────
    return (
        <div
            style={{
                position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
                background: "rgba(0,0,0,0.85)", backdropFilter: "blur(10px)",
                display: "flex", alignItems: "center", justifyContent: "center",
                zIndex: 10000, padding: "2rem",
            }}
        >
            <div
                style={{
                    background: "#0F0F1A", border: "1px solid rgba(255,255,255,0.1)",
                    width: "100%", maxWidth: "1100px", maxHeight: "88vh",
                    borderRadius: "24px", display: "flex", flexDirection: "column",
                    overflow: "hidden", boxShadow: "0 25px 50px -12px rgba(0,0,0,0.5)",
                }}
            >
                {/* ── HEADER ── */}
                <div
                    style={{
                        padding: "1rem 1.5rem",
                        background: "rgba(255,255,255,0.02)",
                        borderBottom: "1px solid rgba(255,255,255,0.05)",
                        display: "flex", flexDirection: "column", gap: "0.75rem",
                        flexShrink: 0,
                    }}
                >
                    {/* Métricas */}
                    <div style={{ display: "flex", gap: "1rem" }}>
                        <MetricCard
                            label="Total por Cobrar"
                            value={`S/ ${fmt(metrics.totalPendiente)}`}
                            sub={`${metrics.countPending} tickets`}
                            color="#EF4444"
                            bg="rgba(239,68,68,0.15)"
                            border="rgba(239,68,68,0.3)"
                        />
                        <MetricCard
                            label="Total Cobrado"
                            value={`S/ ${fmt(metrics.totalCobrado)}`}
                            sub={`${metrics.countCollected} facturas`}
                            color="#10B981"
                            bg="rgba(16,185,129,0.15)"
                            border="rgba(16,185,129,0.3)"
                        />
                        <MetricCard
                            label={`Cobrado ${metrics.mesActualNombre}`}
                            value={`S/ ${fmt(metrics.totalMesActual)}`}
                            sub={`${metrics.countMesActual} cobros este mes`}
                            color="#3B82F6"
                            bg="rgba(59,130,246,0.15)"
                            border="rgba(59,130,246,0.3)"
                        />
                        <MetricCard
                            label={`Cobrado ${metrics.mesAnteriorNombre}`}
                            value={`S/ ${fmt(metrics.totalMesAnterior)}`}
                            sub={`${metrics.countMesAnterior} cobros`}
                            color="#8B5CF6"
                            bg="rgba(139,92,246,0.15)"
                            border="rgba(139,92,246,0.3)"
                        />
                    </div>

                    {/* Controles */}
                    <div
                        style={{
                            display: "flex", justifyContent: "space-between",
                            alignItems: "center", gap: "1rem",
                        }}
                    >
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <h3 style={{ margin: 0, color: "white", fontWeight: 900, fontSize: "0.9rem" }}>
                                Administración de Cobranzas
                            </h3>
                            <div style={{ display: "flex", gap: "0.25rem" }}>
                                <TabButton
                                    active={activeTab === "pendientes"}
                                    onClick={() => setActiveTab("pendientes")}
                                    color="#3B82F6"
                                >
                                    📋 Pendientes ({filteredPending.length})
                                </TabButton>
                                <TabButton
                                    active={activeTab === "historial"}
                                    onClick={() => setActiveTab("historial")}
                                    color="#10B981"
                                >
                                    ✓ Historial ({filteredHistorial.length})
                                </TabButton>
                            </div>
                        </div>
                        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                            <input
                                type="text"
                                placeholder="🔍 Buscar..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                style={{
                                    background: "rgba(0,0,0,0.3)",
                                    border: "1px solid rgba(255,255,255,0.15)",
                                    borderRadius: "8px", padding: "6px 10px",
                                    color: "white", fontSize: "0.75rem", width: "200px",
                                }}
                            />
                            <IconBtn onClick={loadInvoices} disabled={loading} title="Refrescar">
                                <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
                            </IconBtn>
                            <IconBtn onClick={exportToExcel} title="Exportar Excel" style={{ color: "#10B981" }}>
                                <Download size={14} />
                            </IconBtn>
                            <IconBtn
                                onClick={() => (showCreateModal ? handleCloseModal() : onClose?.())}
                                title="Cerrar"
                                style={{ color: "#EF4444", borderColor: "rgba(239,68,68,0.3)" }}
                            >
                                <X size={16} />
                            </IconBtn>
                        </div>
                    </div>
                </div>

                {/* ── CONTENT ── */}
                <div style={{ flex: 1, overflowY: "auto", padding: "1rem 1.5rem" }}>
                    {loading ? (
                        <div style={{ textAlign: "center", padding: "3rem", color: "rgba(255,255,255,0.5)" }}>
                            <Loader2 size={32} className="animate-spin" style={{ margin: "0 auto" }} />
                            <p style={{ marginTop: "1rem" }}>Cargando...</p>
                        </div>
                    ) : activeTab === "pendientes" ? (
                        filteredPending.length === 0 ? (
                            <EmptyState text={searchTerm ? "No se encontraron tickets" : "✓ No hay tickets pendientes de cobranza"} />
                        ) : (
                            <>
                                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                                    <thead>
                                        <tr style={{ textAlign: "left", borderBottom: "2px solid rgba(255,255,255,0.05)" }}>
                                            {["N° Ticket", "Cliente", "Sede", "Estado", "Monto c/IGV", "Acción"].map((h, i) => (
                                                <th key={i} style={thStyle(i >= 4)}>{h}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {pagedPending.map((ticket) => (
                                            <tr key={ticket.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
                                                <td style={tdStyle("#60A5FA", true)}>
                                                    {ticket.client_ticket_number || ticket.id.substring(0, 8)}
                                                </td>
                                                <td style={tdStyle()}>{ticket.clients?.name || "N/A"}</td>
                                                <td style={tdStyle("rgba(255,255,255,0.45)")}>{ticket.branch_offices?.name || "N/A"}</td>

                                                {/* FIX #7: Badge de estado_cobranza */}
                                                <td style={{ padding: "10px 8px" }}>
                                                    <CobranzaBadge estado={ticket.estado_cobranza} />
                                                </td>

                                                <td style={{ ...tdStyle("#EF4444", false), textAlign: "right", fontWeight: 700 }}>
                                                    S/ {fmt(ticket._montoConIGV)}
                                                </td>
                                                <td style={{ padding: "10px 8px", textAlign: "center" }}>
                                                    <button
                                                        onClick={() => handleOpenCreateModal(ticket)}
                                                        disabled={processing === ticket.id}
                                                        style={{
                                                            background: ticket.estado_cobranza === "facturado" ? "#3B82F6" : "#10B981",
                                                            border: "none", color: "white",
                                                            padding: "5px 12px", borderRadius: "6px",
                                                            fontSize: "0.72rem", fontWeight: 700,
                                                            cursor: "pointer",
                                                            opacity: processing === ticket.id ? 0.5 : 1,
                                                        }}
                                                    >
                                                        {processing === ticket.id
                                                            ? "..."
                                                            : ticket.estado_cobranza === "facturado"
                                                            ? "Actualizar OC"
                                                            : "Registrar OC"}
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                {/* FIX #8: Controles de paginación */}
                                <Pagination
                                    current={currentPagePending}
                                    total={totalPagesPending}
                                    count={filteredPending.length}
                                    onChange={setCurrentPagePending}
                                />
                            </>
                        )
                    ) : (
                        filteredHistorial.length === 0 ? (
                            <EmptyState text={searchTerm ? "No se encontraron registros" : "✓ No hay historial de cobranzas"} />
                        ) : (
                            <>
                                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                                    <thead>
                                        <tr style={{ textAlign: "left", borderBottom: "2px solid rgba(255,255,255,0.05)" }}>
                                            {["Ticket", "Cliente", "Sede", "N° OC", "N° Comprobante", "Fecha Cobro", "Total"].map((h, i) => (
                                                <th key={i} style={thStyle(i === 6)}>{h}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {pagedHistorial.map((inv) => (
                                            <tr key={inv.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
                                                <td style={tdStyle("#60A5FA", true)}>
                                                    {/* FIX #3: Usar JOIN directo */}
                                                    {inv.tickets?.client_ticket_number || inv.ticket_id?.substring(0, 8) || "N/A"}
                                                </td>
                                                <td style={tdStyle()}>{inv.tickets?.clients?.name || "N/A"}</td>
                                                <td style={tdStyle("rgba(255,255,255,0.45)")}>{inv.tickets?.branch_offices?.name || "N/A"}</td>
                                                <td style={tdStyle("rgba(255,255,255,0.5)")}>{inv.invoice_number || "—"}</td>
                                                {/* FIX #2: Columna N° Comprobante */}
                                                <td style={tdStyle("rgba(255,255,255,0.5)")}>{inv.doc_number || "—"}</td>
                                                <td style={tdStyle("rgba(255,255,255,0.5)")}>
                                                    {inv.paid_date
                                                        ? new Date(inv.paid_date).toLocaleDateString("es-PE", {
                                                              day: "2-digit", month: "short", year: "numeric",
                                                          })
                                                        : "—"}
                                                </td>
                                                <td style={{ ...tdStyle("#10B981"), textAlign: "right", fontWeight: 700 }}>
                                                    S/ {fmt(inv.amount_total)}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                <Pagination
                                    current={currentPageHistorial}
                                    total={totalPagesHistorial}
                                    count={filteredHistorial.length}
                                    onChange={setCurrentPageHistorial}
                                />
                            </>
                        )
                    )}
                </div>
            </div>

            {/* ── MODAL: Crear Invoice ── */}
            {showCreateModal && selectedTicket && (
                <div
                    style={{
                        position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
                        background: "rgba(0,0,0,0.8)", backdropFilter: "blur(8px)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        zIndex: 11000,
                    }}
                    onClick={handleCloseModal}
                >
                    <div
                        style={{
                            background: "#0F0F1A", border: "1px solid rgba(255,255,255,0.15)",
                            width: "100%", maxWidth: "480px", borderRadius: "20px", padding: "2rem",
                            boxShadow: "0 25px 50px -12px rgba(0,0,0,0.5)",
                            maxHeight: "90vh", overflowY: "auto",
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Título */}
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
                            <h3 style={{ margin: 0, color: "white", fontWeight: 900, fontSize: "1.05rem" }}>
                                {cobroTipo === "evento_perdida" ? "Registrar Evento de Pérdida" : "Registrar Cobro / OC"}
                            </h3>
                            <button onClick={handleCloseModal} style={btnIconStyle}>
                                <X size={16} />
                            </button>
                        </div>

                        {/* Ticket info */}
                        <ModalField label="Ticket">
                            <div style={{ color: "#60A5FA", fontWeight: 700 }}>
                                {selectedTicket.client_ticket_number || selectedTicket.id}
                                {" — "}
                                <span style={{ color: "rgba(255,255,255,0.5)", fontWeight: 400, fontSize: "0.85rem" }}>
                                    {selectedTicket.clients?.name || ""}
                                </span>
                            </div>
                        </ModalField>

                        {/* Tipo de cobro */}
                        <ModalField label="Tipo de Cobro">
                            <div style={{ display: "flex", gap: "8px" }}>
                                <ToggleBtn
                                    active={cobroTipo === "oc"}
                                    onClick={() => setCobroTipo("oc")}
                                    color="#10B981"
                                    icon={<FileText size={13} />}
                                >
                                    Con OC
                                </ToggleBtn>
                                <ToggleBtn
                                    active={cobroTipo === "evento_perdida"}
                                    onClick={() => setCobroTipo("evento_perdida")}
                                    color="#EF4444"
                                    icon={<AlertTriangle size={13} />}
                                >
                                    Evento de Pérdida
                                </ToggleBtn>
                            </div>
                        </ModalField>

                        {/* N° OC — solo si tipo OC */}
                        {cobroTipo === "oc" && (
                            <ModalField label="Número de OC *">
                                <input
                                    type="text"
                                    value={invoiceOc}
                                    onChange={(e) => setInvoiceOc(e.target.value)}
                                    placeholder="Ej: OC-2026-001"
                                    style={inputStyle}
                                    autoFocus
                                />
                            </ModalField>
                        )}

                        {/* FIX #2: N° Comprobante (siempre visible) */}
                        <ModalField label="N° Comprobante (Factura / Boleta)">
                            <input
                                type="text"
                                value={invoiceDocNumber}
                                onChange={(e) => setInvoiceDocNumber(e.target.value)}
                                placeholder="Ej: F001-00123456"
                                style={inputStyle}
                            />
                        </ModalField>

                        {/* Aviso Evento Pérdida */}
                        {cobroTipo === "evento_perdida" && (
                            <div style={alertStyle}>
                                <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "4px" }}>
                                    <AlertTriangle size={14} color="#EF4444" />
                                    <span style={{ color: "#EF4444", fontWeight: 700 }}>Evento de Pérdida</span>
                                </div>
                                Se registrará sin número de OC. Se genera un ID automático EP-{"{timestamp}"}.
                            </div>
                        )}

                        {/* FIX #1: Fecha real de cobro editable */}
                        <ModalField label="Fecha real de cobro *">
                            <input
                                type="datetime-local"
                                value={invoicePaidDate}
                                onChange={(e) => setInvoicePaidDate(e.target.value)}
                                max={todayLocalISO()}
                                style={{ ...inputStyle, colorScheme: "dark" }}
                            />
                            <span style={{ fontSize: "0.7rem", color: "rgba(255,255,255,0.35)", marginTop: "4px", display: "block" }}>
                                Puede ser una fecha anterior si el cobro ocurrió antes de registrarlo.
                            </span>
                        </ModalField>

                        {/* Monto Base + desglose IGV */}
                        <ModalField label="Monto Base (S/)">
                            <input
                                type="number"
                                value={invoiceAmountBase}
                                onChange={(e) => setInvoiceAmountBase(e.target.value)}
                                placeholder={`Default: S/ ${fmt(selectedTicket._montoBase)}`}
                                style={inputStyle}
                                min={0}
                                step={0.01}
                            />
                            {(() => {
                                const base = parseFloat(invoiceAmountBase) || selectedTicket._montoBase || 0;
                                const igv = round2(base * IGV_RATE);
                                const total = round2(base * IGV_MULTIPLIER);
                                return (
                                    <div style={igvBoxStyle}>
                                        <div style={igvRow}>
                                            <span style={{ color: "rgba(255,255,255,0.5)" }}>Base Imponible:</span>
                                            <span style={{ color: "white", fontWeight: 600 }}>S/ {fmt(base)}</span>
                                        </div>
                                        <div style={igvRow}>
                                            <span style={{ color: "rgba(255,255,255,0.5)" }}>IGV (18%):</span>
                                            <span style={{ color: "white", fontWeight: 600 }}>S/ {fmt(igv)}</span>
                                        </div>
                                        <div style={{ ...igvRow, borderTop: "1px solid rgba(16,185,129,0.3)", paddingTop: "4px" }}>
                                            <span style={{ color: "#10B981", fontWeight: 700 }}>TOTAL:</span>
                                            <span style={{ color: "#10B981", fontWeight: 900, fontSize: "1rem" }}>S/ {fmt(total)}</span>
                                        </div>
                                    </div>
                                );
                            })()}
                        </ModalField>

                        {/* Botones */}
                        <div style={{ display: "flex", gap: "1rem", marginTop: "1.5rem" }}>
                            <button
                                onClick={handleCloseModal}
                                disabled={processing === selectedTicket.id}
                                style={btnCancelStyle}
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleCreateInvoice}
                                disabled={processing === selectedTicket.id}
                                style={{
                                    ...btnConfirmStyle,
                                    opacity: processing === selectedTicket.id ? 0.6 : 1,
                                    cursor: processing === selectedTicket.id ? "not-allowed" : "pointer",
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

// ─────────────────────────────────────────────────────────────────────────────
// SUB-COMPONENTES
// ─────────────────────────────────────────────────────────────────────────────

function MetricCard({ label, value, sub, color, bg, border }: {
    label: string; value: string; sub: string;
    color: string; bg: string; border: string;
}) {
    return (
        <div style={{ flex: 1, background: bg, border: `1px solid ${border}`, borderRadius: "12px", padding: "0.75rem 1rem" }}>
            <div style={{ fontSize: "0.62rem", color: "rgba(255,255,255,0.55)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</div>
            <div style={{ fontSize: "1.25rem", color, fontWeight: 900, margin: "2px 0" }}>{value}</div>
            <div style={{ fontSize: "0.68rem", color: "rgba(255,255,255,0.4)" }}>{sub}</div>
        </div>
    );
}

// FIX #7: Badge de estado_cobranza
function CobranzaBadge({ estado }: { estado: string }) {
    const map: Record<string, { label: string; color: string; bg: string }> = {
        pendiente:  { label: "Pendiente",  color: "#F59E0B", bg: "rgba(245,158,11,0.15)"  },
        facturado:  { label: "Facturado",  color: "#3B82F6", bg: "rgba(59,130,246,0.15)"  },
        cobrado:    { label: "Cobrado",     color: "#10B981", bg: "rgba(16,185,129,0.15)"  },
    };
    const cfg = map[estado] ?? { label: estado, color: "#9CA3AF", bg: "rgba(156,163,175,0.15)" };
    return (
        <span style={{
            background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.color}40`,
            padding: "2px 8px", borderRadius: "999px", fontSize: "0.65rem", fontWeight: 700,
        }}>
            {cfg.label}
        </span>
    );
}

// FIX #8: Componente de paginación
function Pagination({ current, total, count, onChange }: {
    current: number; total: number; count: number; onChange: (p: number) => void;
}) {
    if (total <= 1) return null;
    const start = (current - 1) * PAGE_SIZE + 1;
    const end = Math.min(current * PAGE_SIZE, count);
    return (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "1rem", padding: "0.5rem 0" }}>
            <span style={{ fontSize: "0.72rem", color: "rgba(255,255,255,0.4)" }}>
                Mostrando {start}–{end} de {count}
            </span>
            <div style={{ display: "flex", gap: "4px" }}>
                <PagBtn onClick={() => onChange(current - 1)} disabled={current === 1}>
                    <ChevronLeft size={14} />
                </PagBtn>
                {Array.from({ length: total }, (_, i) => i + 1)
                    .filter((p) => p === 1 || p === total || Math.abs(p - current) <= 1)
                    .reduce<(number | "...")[]>((acc, p, i, arr) => {
                        if (i > 0 && p - (arr[i - 1] as number) > 1) acc.push("...");
                        acc.push(p);
                        return acc;
                    }, [])
                    .map((p, i) =>
                        p === "..." ? (
                            <span key={`e${i}`} style={{ color: "rgba(255,255,255,0.3)", padding: "0 4px", fontSize: "0.75rem" }}>…</span>
                        ) : (
                            <PagBtn key={p} onClick={() => onChange(p as number)} active={p === current}>
                                {p}
                            </PagBtn>
                        )
                    )}
                <PagBtn onClick={() => onChange(current + 1)} disabled={current === total}>
                    <ChevronRight size={14} />
                </PagBtn>
            </div>
        </div>
    );
}

function PagBtn({ onClick, disabled, active, children }: {
    onClick: () => void; disabled?: boolean; active?: boolean; children: React.ReactNode;
}) {
    return (
        <button
            onClick={onClick}
            disabled={disabled}
            style={{
                background: active ? "#3B82F6" : "rgba(255,255,255,0.05)",
                border: active ? "none" : "1px solid rgba(255,255,255,0.1)",
                color: disabled ? "rgba(255,255,255,0.2)" : "white",
                padding: "4px 8px", borderRadius: "6px", cursor: disabled ? "not-allowed" : "pointer",
                fontSize: "0.72rem", minWidth: "28px",
                display: "flex", alignItems: "center", justifyContent: "center",
            }}
        >
            {children}
        </button>
    );
}

function TabButton({ active, onClick, color, children }: {
    active: boolean; onClick: () => void; color: string; children: React.ReactNode;
}) {
    return (
        <button
            onClick={onClick}
            style={{
                background: active ? color : "rgba(255,255,255,0.05)",
                border: "none", color: "white", padding: "4px 12px",
                borderRadius: "6px", fontSize: "0.7rem", fontWeight: 700, cursor: "pointer",
            }}
        >
            {children}
        </button>
    );
}

function IconBtn({ onClick, disabled, title, style: s, children }: {
    onClick: () => void; disabled?: boolean; title?: string;
    style?: React.CSSProperties; children: React.ReactNode;
}) {
    return (
        <button
            onClick={onClick} disabled={disabled} title={title}
            style={{
                background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
                color: "white", padding: "6px 8px", borderRadius: "6px",
                cursor: disabled ? "not-allowed" : "pointer",
                display: "flex", alignItems: "center", ...s,
            }}
        >
            {children}
        </button>
    );
}

function ModalField({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div style={{ marginBottom: "1rem" }}>
            <label style={{ fontSize: "0.73rem", color: "rgba(255,255,255,0.5)", display: "block", marginBottom: "6px", fontWeight: 600 }}>
                {label}
            </label>
            {children}
        </div>
    );
}

function ToggleBtn({ active, onClick, color, icon, children }: {
    active: boolean; onClick: () => void; color: string;
    icon: React.ReactNode; children: React.ReactNode;
}) {
    return (
        <button
            type="button" onClick={onClick}
            style={{
                flex: 1, background: active ? `${color}22` : "rgba(0,0,0,0.3)",
                border: `1px solid ${active ? color : "rgba(255,255,255,0.15)"}`,
                color: active ? color : "rgba(255,255,255,0.7)",
                padding: "9px 12px", borderRadius: "10px", cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
                gap: "6px", fontWeight: 700, fontSize: "0.78rem",
            }}
        >
            {icon} {children}
        </button>
    );
}

function EmptyState({ text }: { text: string }) {
    return (
        <div style={{ textAlign: "center", padding: "3rem", color: "rgba(255,255,255,0.4)", fontSize: "0.9rem" }}>
            {text}
        </div>
    );
}

// ── Style helpers ──
const thStyle = (right = false): React.CSSProperties => ({
    padding: "10px 8px", fontSize: "0.68rem", fontWeight: 800,
    color: "rgba(255,255,255,0.3)", textTransform: "uppercase",
    textAlign: right ? "right" : "left",
});
const tdStyle = (color = "rgba(255,255,255,0.7)", bold = false): React.CSSProperties => ({
    padding: "10px 8px", color, fontSize: "0.83rem",
    fontWeight: bold ? 700 : 400,
});
const inputStyle: React.CSSProperties = {
    width: "100%", background: "rgba(0,0,0,0.3)",
    border: "1px solid rgba(255,255,255,0.15)", borderRadius: "10px",
    padding: "9px 14px", color: "white", fontSize: "0.88rem",
    boxSizing: "border-box",
};
const alertStyle: React.CSSProperties = {
    marginBottom: "1rem", padding: "10px 12px",
    background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)",
    borderRadius: "8px", fontSize: "0.75rem", color: "rgba(255,255,255,0.7)",
};
const igvBoxStyle: React.CSSProperties = {
    marginTop: "8px", padding: "10px 12px",
    background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.2)",
    borderRadius: "8px", fontSize: "0.75rem",
};
const igvRow: React.CSSProperties = {
    display: "flex", justifyContent: "space-between", marginBottom: "4px",
};
const btnIconStyle: React.CSSProperties = {
    background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
    color: "rgba(255,255,255,0.7)", padding: "6px 8px", borderRadius: "6px",
    cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
};
const btnCancelStyle: React.CSSProperties = {
    flex: 1, background: "rgba(255,255,255,0.05)", border: "none",
    color: "white", padding: "10px", borderRadius: "10px",
    fontSize: "0.85rem", fontWeight: 600, cursor: "pointer",
};
const btnConfirmStyle: React.CSSProperties = {
    flex: 1, background: "#10B981", border: "none", color: "white",
    padding: "10px", borderRadius: "10px", fontSize: "0.85rem", fontWeight: 700,
    display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
};
