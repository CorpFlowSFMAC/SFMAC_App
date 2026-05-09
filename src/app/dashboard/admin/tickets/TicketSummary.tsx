"use client";

import { FileText, MapPin, User, ArrowRight, Calendar, RefreshCw, Edit2, Stethoscope, CreditCard, Image as ImageIcon, Clock, DollarSign, Scale, CheckCircle2, Wallet, Coins, ClipboardCheck, ShieldCheck, FileSpreadsheet, Bot, Sparkles, Lightbulb, AlertTriangle, Eye, X, Banknote, TrendingUp, Settings, ChevronRight, Package, Truck, ShieldAlert } from "lucide-react";
import { getServiceById } from "@/lib/serviceTypes";
import React, { useState, useEffect, useCallback, memo } from "react";
import { supabase } from "@/lib/supabase";
import { round2, formatSoles } from "@/lib/formatters";
import { calculateTicketFinances } from "@/lib/calculations";
import styles from "./TicketSummary.module.css";

interface InfoBarBaseProps {
    ticket: any;
    title: string;
    icon: any;
    color: string;
    gradient: string;
}

export const InfoBarBase = memo(function InfoBarBase({ ticket, title, icon: Icon, color, gradient }: InfoBarBaseProps) {
    const service = getServiceById(ticket.tipoServicio);
    const ServiceIcon = service?.icon;

    return (
        <div
            className={styles.infoBar}
            style={{
                background: `linear-gradient(to right, ${gradient.includes('linear-gradient') ? 'white' : gradient}, white)`,
                '--bar-accent-color': color
            } as any}
        >
            <div className={styles.titleSection}>
                <div
                    className={styles.titleIcon}
                    style={{ background: `linear-gradient(135deg, ${color}, ${color}dd)` }}
                >
                    <Icon size={18} />
                </div>
                <div className={styles.titleText}>
                    <h3 style={{ color }}>{title}</h3>
                    <span style={{ color: '#64748B' }}>{new Date(ticket.fechaCreacion).toLocaleString('es-PE', {
                        day: '2-digit',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit'
                    })}</span>
                </div>
            </div>

            <div className={styles.verticalDivider} />

            <div className={styles.infoItem}>
                <span className={styles.infoLabel}>Ticket</span>
                <span className={styles.infoValue}>
                    {ticket.numeroTicketCliente ? ticket.numeroTicketCliente : `#${ticket.id.slice(-8)}`}
                </span>
            </div>

            <div className={styles.infoItem}>
                <span className={styles.infoLabel}>Cliente</span>
                <div className={styles.clienteCompact}>
                    <div
                        className={styles.clienteAvatar}
                        style={{ background: ticket.cliente?.color || '#8B5CF6' }}
                    >
                        {ticket.cliente?.nombre?.substring(0, 2) || 'TK'}
                    </div>
                    <span className={styles.infoValue}>{ticket.cliente?.nombre || 'Sin cliente'}</span>
                </div>
            </div>

            <div className={styles.infoItem}>
                <span className={styles.infoLabel}>Sede</span>
                <div className={styles.sedeCompact}>
                    <MapPin size={12} />
                    <span className={styles.infoValue}>{ticket.sede?.nombre || 'Sin sede'}</span>
                </div>
            </div>

            <div className={styles.infoItem}>
                <span className={styles.infoLabel}>Servicio</span>
                <div
                    className={styles.serviceBadge}
                    style={{
                        background: `${service?.color || '#10B981'}15`,
                        borderColor: service?.color || '#10B981',
                        color: service?.color || '#10B981'
                    }}
                >
                    {ServiceIcon && <ServiceIcon size={12} />}
                    <span>{service?.nombre || ticket.tipoServicioNombre || ticket.tipoServicio}</span>
                </div>
            </div>

            <div className={styles.verticalDivider} />

            <div className={styles.descriptionSectionCompact}>
                <span className={styles.infoLabel}>Hallazgo & Evidencias</span>
                <div className={styles.descPayload}>
                    <p className={styles.compactProblemText} title={ticket.descripcionProblema}>
                        {ticket.descripcionProblema || 'Sin descripción'}
                    </p>
                    {ticket.evidencias && ticket.evidencias.length > 0 && (
                        <div className={styles.miniThumbnails}>
                            {ticket.evidencias.slice(0, 3).map((evidencia: any, index: number) => (
                                <div key={index} className={styles.miniThumb} title={evidencia.name}>
                                    {evidencia.url ? (
                                        <>
                                            <img src={evidencia.url} alt="Evidencia" className={styles.thumbImage} />
                                            <div className={styles.largePreview}>
                                                <img src={evidencia.url} alt="Vista ampliada" />
                                            </div>
                                        </>
                                    ) : (
                                        <FileText size={10} />
                                    )}
                                </div>
                            ))}
                            {ticket.evidencias.length > 3 && (
                                <span className={styles.moreCount}>+{ticket.evidencias.length - 3}</span>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
});

interface TechnicianSchedulingBarProps {
    ticket: any;
    onReassign?: () => void;
    onEditSchedule?: () => void;
}

export const TechnicianSchedulingBar = memo(function TechnicianSchedulingBar({ ticket, onReassign, onEditSchedule }: TechnicianSchedulingBarProps) {
    const techStatus = ticket.tecnico || ticket.tecnicoAsignado || ticket.technicians;
    if (!ticket.technicianId && !techStatus && !ticket.technician_id) return null;

    const techName = techStatus?.nombre || techStatus?.name || "Técnico Asignado";
    const techPhone = techStatus?.celular || techStatus?.telefono || techStatus?.phone || "---";
    const hasScheduling = !!ticket.fechaVisita;
    const scheduleDate = hasScheduling ? new Date(ticket.fechaVisita) : null;
    const scheduleLabel = ticket.programacionLabel || "Visita Programada";

    const visitCost = parseFloat(ticket.costoVisita || ticket.costoPasaje || 0);

    const voucherVisita = (ticket.historialPagosTecnico || []).find((p: any) => {
        const tipo = (p.tipo || "").toLowerCase();
        const ref = (p.referencia || "").toLowerCase();
        return tipo === 'movilidad / visita' || ref.includes("movilidad") || ref.includes("visita") || ref.includes("pasaje");
    })?.voucherRef;

    const [showFullVoucher, setShowFullVoucher] = useState<string | null>(null);

    const getVoucherSrc = (ref?: string | null) => {
        if (!ref) return "";
        if (ref.startsWith("data:image")) return ref;
        return ""; 
    };

    return (
        <div
            className={styles.infoBar}
            style={{
                background: 'linear-gradient(to right, #F0FDF4, white)',
                '--bar-accent-color': '#10B981',
                marginTop: '-4px'
            } as any}
        >
            <div className={styles.titleSection}>
                <div className={styles.titleIcon} style={{ background: '#10B981' }}>
                    <User size={18} />
                </div>
                <div className={styles.titleText}>
                    <h3 style={{ color: '#047857' }}>Especialista</h3>
                    <span style={{ color: '#059669' }}>Confirmado</span>
                </div>
            </div>

            <div className={styles.verticalDivider} />

            <div className={styles.infoItem}>
                <span className={styles.infoLabel}>Nombre</span>
                <div className={styles.clienteCompact}>
                    <div className={styles.clienteAvatar} style={{ background: '#10B981' }}>
                        {techName.substring(0, 2).toUpperCase()}
                    </div>
                    <span className={styles.infoValue}>{techName}</span>
                </div>
            </div>

            <div className={styles.infoItem}>
                <span className={styles.infoLabel}>Contacto</span>
                <span className={styles.infoValue}>📱 {techPhone}</span>
            </div>

            {visitCost > 0 && (
                <div className={styles.infoItem}>
                    <span className={styles.infoLabel}>Costo Visita</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span className={styles.infoValue}>S/ {visitCost.toFixed(2)}</span>
                        {voucherVisita && (
                            <div className={styles.miniThumb} style={{ border: '2px solid #10B981', cursor: 'pointer' }} onClick={() => setShowFullVoucher(getVoucherSrc(voucherVisita))}>
                                <img src={getVoucherSrc(voucherVisita)} className={styles.thumbImage} alt="Voucher" />
                                <div className={styles.largePreview}>
                                    <img src={getVoucherSrc(voucherVisita)} alt="Preview" />
                                    <div style={{ padding: '4px', fontSize: '0.7rem', textAlign: 'center', fontWeight: 800, color: '#047857' }}>VOUCHER DE MOVILIDAD</div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}


            {onReassign && ticket.estadoId !== 'ticket_cerrado' && (
                <button
                    className={styles.reassignBtn}
                    onClick={onReassign}
                    style={{ color: '#10B981', '--btn-color': '#10B981' } as any}
                >
                    <RefreshCw size={12} />
                    <span>Reasignar</span>
                </button>
            )}

            {hasScheduling && (
                <>
                    <div className={styles.verticalDivider} style={{ opacity: 0.5, borderStyle: 'dashed' }} />

                    <div className={styles.titleSection}>
                        <div className={styles.titleIcon} style={{ background: '#3B82F6' }}>
                            <Calendar size={14} />
                        </div>
                        <div className={styles.titleText}>
                            <h3 style={{ color: '#1E40AF' }}>Agenda</h3>
                            <span style={{ color: '#2563EB' }}>{scheduleLabel}</span>
                        </div>
                    </div>

                    <div className={styles.infoItem}>
                        <span className={styles.infoLabel}>Fecha</span>
                        <span className={styles.infoValue} style={{ color: '#1E40AF' }}>
                            {scheduleDate?.toLocaleDateString('es-PE', { day: '2-digit', month: 'short' })}
                        </span>
                    </div>

                    {onEditSchedule && ticket.estadoId !== 'ticket_cerrado' && (
                        <button
                            className={styles.reassignBtn}
                            onClick={onEditSchedule}
                            style={{ color: '#3B82F6', '--btn-color': '#3B82F6' } as any}
                        >
                            <Edit2 size={12} />
                            <span>Corregir</span>
                        </button>
                    )}
                </>
            )}

            {showFullVoucher && (
                <div
                    style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.85)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'zoom-out' }}
                    onClick={() => setShowFullVoucher(null)}
                >
                    <div style={{ position: 'relative', maxWidth: '85%', maxHeight: '85%' }}>
                        <img src={showFullVoucher} alt="Voucher Full" style={{ width: '100%', height: 'auto', borderRadius: '12px', border: '4px solid white', boxShadow: '0 20px 50px rgba(0,0,0,0.5)' }} />
                        <button
                            style={{ position: 'absolute', top: -20, right: -20, background: 'white', border: 'none', borderRadius: '50%', width: '40px', height: '40px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}
                            onClick={(e) => { e.stopPropagation(); setShowFullVoucher(null); }}
                        >
                            <X size={24} />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
});

export const DiagnosisInfoBar = memo(function DiagnosisInfoBar({ ticket, onEdit }: { ticket: any, onEdit?: () => void }) {
    if (!ticket.diagnostico && !ticket.costoManoObra) return null;

    return (
        <div
            className={styles.infoBar}
            style={{
                background: 'linear-gradient(to right, #F0FDFA, white)',
                '--bar-accent-color': '#0D9488',
                marginTop: '-4px'
            } as any}
        >
            <div className={styles.titleSection}>
                <div className={styles.titleIcon} style={{ background: '#0D9488' }}>
                    <Stethoscope size={18} />
                </div>
                <div className={styles.titleText}>
                    <h3 style={{ color: '#0F766E' }}>Reporte Técnico</h3>
                    <span style={{ color: '#115E59' }}>Enviado</span>
                </div>
            </div>

            <div className={styles.verticalDivider} />

            <div className={styles.infoItem} style={{ flex: 2 }}>
                <span className={styles.infoLabel}>Diagnóstico en Campo</span>
                <p className={styles.infoValue} style={{ fontSize: '11px', lineHeight: '1.2', margin: 0 }}>
                    {ticket.diagnostico || 'Sin diagnóstico registrado'}
                </p>
            </div>

            <div className={styles.infoItem}>
                <span className={styles.infoLabel}>Modalidad</span>
                <div className={styles.clienteCompact}>
                    <div className={styles.clienteAvatar} style={{ background: '#0D9488', width: '20px', height: '20px', fontSize: '10px' }}>
                        <CreditCard size={12} color="white" />
                    </div>
                    <span className={styles.infoValue}>{ticket.modalidad === 'todo_costo' ? 'A Todo Costo' : 'Desagregado'}</span>
                </div>
            </div>
            <div className={styles.infoItem}>
                <span className={styles.infoLabel}>Pre-Presupuesto</span>
                <div className={styles.budgetGridCompact}>
                    <div className={styles.budgetItemMini}>
                        <span className={styles.budgetLabelMini}>🛠️ MO</span>
                        <span className={styles.budgetValueMini}>S/ {formatSoles(ticket.costoManoObra)}</span>
                    </div>
                    <div className={styles.budgetItemMini}>
                        <span className={styles.budgetLabelMini}>📦 MAT</span>
                        <span className={styles.budgetValueMini}>S/ {formatSoles(ticket.costoMateriales)}</span>
                    </div>
                </div>
            </div>

            {onEdit && (
                <>
                    <div className={styles.verticalDivider} />
                    <button 
                        className={styles.reassignBtn} 
                        onClick={onEdit}
                        style={{ color: '#0D9488', '--btn-color': '#0D9488' } as any}
                        title="Actualizar Reporte Técnico"
                    >
                        <Edit2 size={12} />
                        <span>Actualizar</span>
                    </button>
                </>
            )}
        </div>
    );
});

// ── OPTIMIZATION: ROW VIRTUALIZATION & DEBOUNCE ──
const QuotationRow = memo(({ p, idx, onChange }: any) => {
    const [local, setLocal] = useState(p);

    // Sincronizar si cambia desde afuera (ej. regenerar cotización)
    useEffect(() => {
        setLocal(p);
    }, [p]);

    const handleFieldChange = (field: string, value: string) => {
        setLocal((prev: any) => {
            const updated = { 
                ...prev, 
                [field]: (field === 'titulo' || field === 'descripcion' || field === 'unidad') ? value : parseFloat(value) || 0 
            };
            if (field === 'precio_unitario') updated.precio_total = updated.precio_unitario * (updated.cantidad || 1);
            if (field === 'cantidad') updated.precio_total = (updated.precio_unitario || 0) * updated.cantidad;
            return updated;
        });
    };

    // Debounce: Fluir al estado principal después de 300ms de inactividad
    useEffect(() => {
        const timer = setTimeout(() => {
            if (JSON.stringify(local) !== JSON.stringify(p)) {
                onChange(idx, local);
            }
        }, 300);
        return () => clearTimeout(timer);
    }, [local, idx, onChange, p]);

    return (
        <div style={{ 
            display: 'grid', gridTemplateColumns: '32px 1fr 52px 46px 78px', gap: '8px', padding: '8px 10px', 
            borderTop: '1px solid #F3F4F6', background: idx % 2 === 0 ? 'white' : '#FAFBFF', alignItems: 'start',
            contentVisibility: 'auto', containIntrinsicSize: '60px' // <--- Component Virtualization
        }}>
            <span style={{ fontSize: '11px', fontWeight: 800, color: '#7C3AED', paddingTop: '3px' }}>{local.item}</span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <input value={local.titulo} onChange={(e) => handleFieldChange('titulo', e.target.value)}
                    style={{ width: '100%', border: '1px solid transparent', borderRadius: '4px', padding: '2px 5px', fontSize: '11px', fontWeight: 700, color: '#1F2937', background: 'transparent', outline: 'none', cursor: 'text' }}
                    onFocus={(e) => { e.target.style.background = 'white'; e.target.style.borderColor = '#C4B5FD'; }}
                    onBlur={(e) => { e.target.style.background = 'transparent'; e.target.style.borderColor = 'transparent'; }}
                />
                <textarea value={local.descripcion} onChange={(e) => handleFieldChange('descripcion', e.target.value)} rows={2}
                    style={{ width: '100%', border: '1px solid transparent', borderRadius: '4px', padding: '2px 5px', fontSize: '10px', color: '#6B7280', background: 'transparent', resize: 'none', fontFamily: 'inherit', outline: 'none', lineHeight: '1.4', cursor: 'text' }}
                    onFocus={(e) => { e.target.style.background = 'white'; e.target.style.borderColor = '#C4B5FD'; }}
                    onBlur={(e) => { e.target.style.background = 'transparent'; e.target.style.borderColor = 'transparent'; }}
                />
            </div>
            <input value={local.unidad} onChange={(e) => handleFieldChange('unidad', e.target.value)} style={{ width: '100%', border: '1px solid #E9D5FF', borderRadius: '4px', padding: '3px 4px', fontSize: '10px', textAlign: 'center', color: '#374151', outline: 'none' }} />
            <input type="number" value={local.cantidad} onChange={(e) => handleFieldChange('cantidad', e.target.value)} style={{ width: '100%', border: '1px solid #E9D5FF', borderRadius: '4px', padding: '3px 4px', fontSize: '10px', textAlign: 'center', color: '#374151', outline: 'none' }} />
            <input type="number" step="0.01" value={(local.precio_unitario || 0).toFixed(2)} onChange={(e) => handleFieldChange('precio_unitario', e.target.value)} style={{ width: '100%', border: '1px solid #E9D5FF', borderRadius: '4px', padding: '3px 6px', fontSize: '12px', fontWeight: 700, textAlign: 'right', color: '#1F2937', outline: 'none' }} />
        </div>
    );
});

export const QuoteAssistantBar = memo(function QuoteAssistantBar({ ticket }: { ticket: any }) {
    // ── CONDICIÓN DE VISIBILIDAD ──
    const costoMO = parseFloat(ticket.costoManoObra || 0);
    const costoMat = parseFloat(ticket.costoMateriales || 0);
    const costoTotal = costoMO + costoMat;
    const hasCosts = costoTotal > 0;
    const isQuoting = ["visita_realizada", "en_cotizacion", "cotizacion_enviada"].includes(ticket.estadoId);
    if (!hasCosts || !isQuoting) return null;

    // ── ESTADOS ──
    const [isGenerating, setIsGenerating] = useState(false);
    const [draft, setDraft] = useState<any>(null);
    const [editedPartidas, setEditedPartidas] = useState<any[]>([]);
    const [editedDiagnostico, setEditedDiagnostico] = useState("");
    const [editedJustificacion, setEditedJustificacion] = useState("");
    const [editedTiempo, setEditedTiempo] = useState("");
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [approved, setApproved] = useState(false);

    // ── GENERAR PROPUESTA ──
    const generateProposal = async () => {
        setIsGenerating(true);
        setErrorMsg(null);
        setDraft(null);
        setApproved(false);

        // ── RECOPILAR IMÁGENES (base64 Y URLs de Supabase Storage) ──
        const images: string[] = [];
        const imageUrls: string[] = [];
        const allEvidencias = [
            ...(ticket.evidencias || []),
            ...(ticket.evidenciasCampo || []),
            ...(ticket.metadata?.evidenciasCampo || []),
            ...(ticket.metadata?.fotos || []),
        ];
        allEvidencias.forEach((e: any) => {
            const url = e?.url || e?.uri || (typeof e === 'string' ? e : null);
            if (!url) return;
            if (url.startsWith("data:image")) images.push(url);
            else if (url.startsWith("http")) imageUrls.push(url); // URLs de Supabase
        });

        // ── CIUDAD / UBICACIÓN REAL ──
        const ciudadRaw = (
            ticket.sede?.provincia ||
            ticket.sede?.departamento ||
            ticket.sede?.ciudad ||
            ticket.sede?.distrito ||
            ticket.sede_reportada_cliente ||
            ticket.sede?.zona ||
            ticket.sede?.address ||
            ticket.sede?.direccion ||
            ''
        );

        // ── DIAGNÓSTICO TÉCNICO COMPLETO DEL CAMPO ──
        const diagnosticoCompletoStr = [
            ticket.diagnostico || ticket.diagnosis || '',
            ticket.metadata?.reporteTecnico || '',
            ticket.metadata?.hallazgosCampo || '',
            ticket.metadata?.observaciones || '',
        ].filter(Boolean).join(' | ');

        // ── INFORMACIÓN DEL TÉCNICO ──
        const tecnicoNombre = ticket.tecnico?.nombre || ticket.tecnico?.name || 'Técnico Asignado';
        const tecnicoCosto = costoMO; // labor_cost = costo del técnico

        try {
            const response = await fetch('/api/ai/gemini', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    costoManoObra: costoMO,
                    costoMateriales: costoMat,
                    tipoServicio: ticket.tipoServicio || ticket.tipoServicioNombre || '',
                    descripcion: ticket.descripcionProblema || '',
                    diagnostico: diagnosticoCompletoStr,
                    cliente: ticket.cliente?.nombre || 'Cliente Corporativo',
                    tecnicoNombre,
                    tecnicoCosto,
                    // Ubicación enriquecida
                    ciudad: ciudadRaw,
                    zona: ticket.sede?.zona || ticket.sede?.zone || ciudadRaw,
                    departamento: ticket.sede?.departamento || ticket.sede?.department || '',
                    provincia: ticket.sede?.provincia || '',
                    distrito: ticket.sede?.distrito || '',
                    address: ticket.sede?.address || ticket.sede?.nombre || ticket.sede_reportada_cliente || '',
                    // Imágenes
                    images,
                    imageUrls,
                })
            });
            const data = await response.json();
            if (data?.partidas && Array.isArray(data.partidas) && data.partidas.length > 0) {
                setDraft(data);
                setEditedPartidas(data.partidas.map((p: any) => ({ ...p })));
                setEditedDiagnostico(data.diagnostico_profesional || '');
                setEditedJustificacion(data.justificacion_intervencion || '');
                setEditedTiempo(data.tiempo_estimado || '');
            } else {
                throw new Error(data?.error || "Respuesta inválida del servidor");
            }
        } catch (err: any) {
            const detail = err?.message || '';
            setErrorMsg(`Error al conectar con el motor de cotización. ${detail ? `(${detail})` : 'Verifique su conexión.'}`);
        } finally {
            setIsGenerating(false);
        }
    };

    const handlePartidaChange = useCallback((idx: number, updatedPartida: any) => {
        setEditedPartidas(prev => {
            const next = [...prev];
            next[idx] = updatedPartida;
            return next;
        });
    }, []);

    const totalEditado = editedPartidas.reduce((s, p) => s + (p.precio_total || 0), 0);
    const isFromAlgorithm = draft?.fuente === "algoritmo";
    const pricing = draft?.pricing;

    // ── BANNER COMPACTO (antes de generar) ──
    if (!draft) {
        return (
            <div
                className={styles.infoBar}
                style={{
                    background: 'linear-gradient(135deg, #1E1B4B 0%, #312E81 40%, #4C1D95 100%)',
                    border: '1px solid #6D28D9',
                    marginTop: '-4px',
                    flexDirection: 'column',
                    alignItems: 'stretch',
                    gap: '0',
                    padding: '0',
                    overflow: 'hidden',
                    borderRadius: '12px',
                } as any}
            >
                <div style={{ height: '3px', background: 'linear-gradient(90deg, #8B5CF6, #D946EF, #EC4899, #F59E0B)', borderRadius: '12px 12px 0 0' }} />
                <div style={{ padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                        <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: 'linear-gradient(135deg, #8B5CF6, #D946EF)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(139,92,246,0.4)', flexShrink: 0 }}>
                            <Bot size={20} color="white" />
                        </div>
                        <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <h3 style={{ margin: 0, color: 'white', fontSize: '14px', fontWeight: 800, letterSpacing: '-0.02em' }}>
                                    Motor de Pricing + IA Multimodal
                                </h3>
                                <span style={{ fontSize: '9px', background: 'rgba(251,191,36,0.2)', color: '#FCD34D', padding: '2px 7px', borderRadius: '10px', fontWeight: 800, border: '1px solid rgba(251,191,36,0.3)', letterSpacing: '0.05em' }}>
                                    SINFIMAC PRO
                                </span>
                            </div>
                            <p style={{ margin: '3px 0 0', color: 'rgba(199,210,254,0.8)', fontSize: '12px', fontWeight: 500 }}>
                                Genera cotización profesional con margen de ganancia garantizado y texto para entidades bancarias
                            </p>
                        </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
                        <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: '10px', color: 'rgba(199,210,254,0.6)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Costo Base</div>
                            <div style={{ fontSize: '15px', fontWeight: 800, color: '#E0E7FF' }}>S/ {formatSoles(costoTotal)}</div>
                        </div>
                        <div style={{ width: '1px', height: '30px', background: 'rgba(255,255,255,0.15)' }} />
                        <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: '10px', color: 'rgba(199,210,254,0.6)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Venta (55% margen)</div>
                            <div style={{ fontSize: '15px', fontWeight: 800, color: '#C4B5FD' }}>S/ {formatSoles(costoTotal / 0.45)}</div>
                        </div>
                        {((ticket.evidencias?.length || 0) + (ticket.evidenciasCampo?.length || 0)) > 0 && (
                            <>
                                <div style={{ width: '1px', height: '30px', background: 'rgba(255,255,255,0.15)' }} />
                                <div style={{ textAlign: 'center' }}>
                                    <div style={{ fontSize: '10px', color: 'rgba(199,210,254,0.6)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Fotos</div>
                                    <div style={{ fontSize: '15px', fontWeight: 800, color: '#FCD34D' }}>📷 {(ticket.evidencias?.length || 0) + (ticket.evidenciasCampo?.length || 0)}</div>
                                </div>
                            </>
                        )}
                    </div>
                    <button
                        onClick={generateProposal}
                        disabled={isGenerating}
                        style={{
                            background: isGenerating ? 'rgba(139,92,246,0.5)' : 'linear-gradient(135deg, #7C3AED, #9D46EF)',
                            color: 'white', border: '1px solid rgba(255,255,255,0.2)', padding: '11px 22px',
                            borderRadius: '10px', fontWeight: 800, fontSize: '0.85rem', display: 'flex', alignItems: 'center',
                            gap: '8px', cursor: isGenerating ? 'wait' : 'pointer',
                            boxShadow: isGenerating ? 'none' : '0 6px 20px rgba(124,58,237,0.5)',
                            transition: 'all 0.2s', whiteSpace: 'nowrap', flexShrink: 0,
                        }}
                    >
                        {isGenerating ? (<><RefreshCw size={15} className={styles.spin} /><span>Analizando con IA...</span></>) : (<><Sparkles size={15} /><span>GENERAR COTIZACIÓN PROFESIONAL</span></>)}
                    </button>
                </div>
                {errorMsg && (
                    <div style={{ margin: '0 16px 14px', background: 'rgba(220,38,38,0.15)', border: '1px solid rgba(220,38,38,0.3)', borderRadius: '8px', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <AlertTriangle size={14} color="#FCA5A5" />
                        <span style={{ fontSize: '12px', color: '#FCA5A5', fontWeight: 500 }}>{errorMsg}</span>
                        <button onClick={generateProposal} style={{ marginLeft: 'auto', fontSize: '11px', color: '#FCA5A5', background: 'rgba(220,38,38,0.2)', border: '1px solid rgba(220,38,38,0.4)', borderRadius: '6px', padding: '4px 10px', cursor: 'pointer' }}>Reintentar</button>
                    </div>
                )}
            </div>
        );
    }

    // ── PANEL SPLIT-SCREEN (después de generar) ──
    return (
        <div style={{ border: '2px solid #6D28D9', borderRadius: '14px', overflow: 'hidden', background: 'white', marginTop: '-4px', boxShadow: '0 8px 30px rgba(109,40,217,0.12)' }}>

            {/* HEADER */}
            <div style={{ background: 'linear-gradient(135deg, #1E1B4B, #312E81)', padding: '12px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'linear-gradient(135deg, #8B5CF6, #D946EF)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <Bot size={16} color="white" />
                    </div>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ color: 'white', fontWeight: 800, fontSize: '13px' }}>
                                {isFromAlgorithm ? '⚡ Motor Algorítmico SINFIMAC' : '✨ Gemini AI Multimodal'}
                            </span>
                            {draft?.resumen?.comentario_ia?.toLowerCase().includes('historial') && (
                                <span style={{ fontSize: '9px', background: 'rgba(5,150,105,0.3)', color: '#6EE7B7', padding: '2px 7px', borderRadius: '8px', fontWeight: 700, border: '1px solid rgba(5,150,105,0.4)' }}>
                                    🧠 CON APRENDIZAJE
                                </span>
                            )}
                            <span style={{ fontSize: '9px', background: isFromAlgorithm ? 'rgba(251,191,36,0.2)' : 'rgba(139,92,246,0.3)', color: isFromAlgorithm ? '#FCD34D' : '#C4B5FD', padding: '2px 7px', borderRadius: '8px', fontWeight: 700, border: `1px solid ${isFromAlgorithm ? 'rgba(251,191,36,0.3)' : 'rgba(139,92,246,0.4)'}` }}>
                                {isFromAlgorithm ? 'ALGORITMO' : 'GEMINI AI'}
                            </span>
                        </div>
                        <span style={{ color: 'rgba(199,210,254,0.7)', fontSize: '11px' }}>Revise y edite el borrador antes de aprobar — el cliente solo verá las partidas finales</span>
                    </div>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={() => { setDraft(null); setApproved(false); }} style={{ background: 'rgba(255,255,255,0.1)', color: '#C4B5FD', border: '1px solid rgba(255,255,255,0.2)', padding: '6px 14px', borderRadius: '8px', fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}>
                        <RefreshCw size={12} /> Regenerar
                    </button>
                    {!approved ? (
                        <button onClick={() => setApproved(true)} style={{ background: 'linear-gradient(135deg, #059669, #10B981)', color: 'white', border: 'none', padding: '6px 16px', borderRadius: '8px', fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 800, boxShadow: '0 4px 12px rgba(5,150,105,0.4)' }}>
                            <Eye size={12} /> Aprobar Borrador
                        </button>
                    ) : (
                        <span style={{ background: 'rgba(5,150,105,0.2)', color: '#6EE7B7', border: '1px solid rgba(5,150,105,0.4)', padding: '6px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
                            ✅ Borrador Aprobado
                        </span>
                    )}
                </div>
            </div>

            {/* PRICING SUMMARY */}
            {pricing && (
                <div style={{ background: '#F8F5FF', padding: '10px 20px', display: 'flex', alignItems: 'center', gap: '16px', borderBottom: '1px solid #E9D5FF', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <MapPin size={13} color="#7C3AED" />
                        <span style={{ fontSize: '11px', color: '#5B21B6', fontWeight: 600 }}>Zona: {pricing.zonaDetectada}</span>
                        {pricing.viaticos > 0 && <span style={{ background: '#FEF3C7', color: '#92400E', fontSize: '10px', fontWeight: 700, padding: '1px 7px', borderRadius: '8px', border: '1px solid #FDE68A' }}>+S/ {pricing.viaticos.toFixed(2)} viáticos</span>}
                    </div>
                    <div style={{ width: '1px', height: '18px', background: '#E9D5FF' }} />
                    <span style={{ fontSize: '11px', color: '#6B7280' }}>MO: <b>S/ {formatSoles(pricing.costoManoObra)}</b></span>
                    <span style={{ fontSize: '11px', color: '#6B7280' }}>Mat: <b>S/ {formatSoles(pricing.costoMateriales)}</b></span>
                    {pricing.viaticos > 0 && <span style={{ fontSize: '11px', color: '#6B7280' }}>Viáticos: <b>S/ {formatSoles(pricing.viaticos)}</b></span>}
                    <span style={{ fontSize: '11px', color: '#6B7280' }}>Costo Base: <b>S/ {formatSoles(pricing.costoBaseTotal)}</b></span>
                    <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ fontSize: '11px', color: '#7C3AED', fontWeight: 600 }}>Margen: {pricing.margenAplicado?.toFixed(0)}%</span>
                        <span style={{ background: '#7C3AED', color: 'white', padding: '3px 12px', borderRadius: '8px', fontWeight: 800, fontSize: '13px' }}>
                            Precio Venta: S/ {formatSoles(pricing.precioVentaFinal)}
                        </span>
                    </div>
                </div>
            )}

            {/* SPLIT PANEL */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', minHeight: '400px' }}>

                {/* IZQUIERDA: DATOS CRUDOS */}
                <div style={{ borderRight: '2px dashed #E9D5FF', background: '#FAFAFA', padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px', overflowY: 'auto' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingBottom: '8px', borderBottom: '1px solid #E9D5FF' }}>
                        <ClipboardCheck size={14} color="#6B7280" />
                        <span style={{ fontSize: '11px', fontWeight: 800, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Datos Crudos del Técnico</span>
                    </div>

                    <div>
                        <div style={{ fontSize: '10px', fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', marginBottom: '4px' }}>Problema Reportado</div>
                        <div style={{ background: 'white', border: '1px solid #E5E7EB', borderRadius: '6px', padding: '8px 10px', fontSize: '12px', color: '#374151', lineHeight: '1.5', fontStyle: 'italic' }}>
                            "{ticket.descripcionProblema || 'Sin descripción'}"
                        </div>
                    </div>

                    {ticket.diagnostico && (
                        <div>
                            <div style={{ fontSize: '10px', fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', marginBottom: '4px' }}>Diagnóstico de Campo (Apuntes)</div>
                            <div style={{ background: '#FFF7ED', border: '1px solid #FED7AA', borderRadius: '6px', padding: '8px 10px', fontSize: '12px', color: '#92400E', lineHeight: '1.5' }}>
                                {ticket.diagnostico}
                            </div>
                        </div>
                    )}

                    <div>
                        <div style={{ fontSize: '10px', fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', marginBottom: '6px' }}>Lo que cobra el Técnico (⚠️ PRIVADO)</div>
                        <div style={{ background: '#FFF5F5', border: '1px solid #FCA5A5', borderRadius: '6px', padding: '10px', display: 'flex', flexDirection: 'column', gap: '5px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                                <span style={{ color: '#6B7280' }}>🛠️ Mano de Obra:</span>
                                <strong style={{ color: '#DC2626' }}>S/ {formatSoles(costoMO)}</strong>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                                <span style={{ color: '#6B7280' }}>📦 Materiales:</span>
                                <strong style={{ color: '#DC2626' }}>S/ {formatSoles(costoMat)}</strong>
                            </div>
                            {pricing?.viaticos > 0 && (
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                                    <span style={{ color: '#6B7280' }}>🚗 Viáticos:</span>
                                    <strong style={{ color: '#DC2626' }}>S/ {formatSoles(pricing.viaticos)}</strong>
                                </div>
                            )}
                            <div style={{ borderTop: '1px dashed #FCA5A5', paddingTop: '5px', display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                                <span style={{ color: '#991B1B', fontWeight: 700 }}>COSTO BASE TOTAL:</span>
                                <strong style={{ color: '#991B1B' }}>S/ {formatSoles(pricing?.costoBaseTotal || costoTotal)}</strong>
                            </div>
                            <div style={{ background: '#DC2626', borderRadius: '4px', padding: '3px 8px', display: 'flex', justifyContent: 'space-between', fontSize: '10px' }}>
                                <span style={{ color: 'rgba(255,255,255,0.8)', fontWeight: 600 }}>⚠️ NO se muestra al cliente</span>
                                <span style={{ color: 'white', fontWeight: 800 }}>PRIVADO</span>
                            </div>
                        </div>
                    </div>

                    {((ticket.evidencias?.length || 0) + (ticket.evidenciasCampo?.length || 0)) > 0 && (
                        <div>
                            <div style={{ fontSize: '10px', fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', marginBottom: '6px' }}>
                                Fotos Analizadas por IA ({(ticket.evidencias?.length || 0) + (ticket.evidenciasCampo?.length || 0)})
                            </div>
                            <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                                {[...(ticket.evidencias || []), ...(ticket.evidenciasCampo || [])].slice(0, 6).map((ev: any, i: number) => (
                                    <div key={i} style={{ width: '58px', height: '58px', borderRadius: '6px', overflow: 'hidden', border: '2px solid #E9D5FF', flexShrink: 0 }}>
                                        <img src={ev.url} alt={`Evidencia ${i + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <div>
                        <div style={{ fontSize: '10px', fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', marginBottom: '4px' }}>Ubicación de la Sede</div>
                        <div style={{ background: 'white', border: '1px solid #E9D5FF', borderRadius: '6px', padding: '8px 10px', display: 'flex', alignItems: 'flex-start', gap: '6px' }}>
                            <MapPin size={12} color="#7C3AED" style={{ marginTop: '1px', flexShrink: 0 }} />
                            <div>
                                <div style={{ fontSize: '12px', fontWeight: 600, color: '#1F2937' }}>{ticket.sede?.nombre || ticket.cliente?.nombre || 'No especificada'}</div>
                                {ticket.sede?.address && <div style={{ fontSize: '10px', color: '#6B7280', marginTop: '2px' }}>{ticket.sede.address}</div>}
                                {ticket.sede?.zone && <div style={{ fontSize: '10px', color: '#7C3AED', fontWeight: 600, marginTop: '2px' }}>Zona: {ticket.sede.zone}</div>}
                                {pricing?.viaticos > 0 && <div style={{ fontSize: '10px', color: '#D97706', fontWeight: 600, marginTop: '2px' }}>📍 Viáticos: S/ {pricing.viaticos}</div>}
                            </div>
                        </div>
                    </div>
                </div>

                {/* DERECHA: COTIZACIÓN EDITABLE */}
                <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px', overflowY: 'auto' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingBottom: '8px', borderBottom: '1px solid #E9D5FF' }}>
                        <FileText size={14} color="#7C3AED" />
                        <span style={{ fontSize: '11px', fontWeight: 800, color: '#4C1D95', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            Cotización Profesional — Borrador Editable
                        </span>
                        <span style={{ marginLeft: 'auto', fontSize: '10px', color: '#9CA3AF' }}>✏️ Todo es editable</span>
                    </div>

                    <div>
                        <div style={{ fontSize: '10px', fontWeight: 700, color: '#7C3AED', textTransform: 'uppercase', marginBottom: '5px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Stethoscope size={11} color="#7C3AED" /> Diagnóstico Técnico (Redacción Formal para el Banco)
                        </div>
                        <textarea
                            value={editedDiagnostico}
                            onChange={(e) => setEditedDiagnostico(e.target.value)}
                            style={{ width: '100%', boxSizing: 'border-box', minHeight: '80px', padding: '10px 12px', border: '1px solid #E9D5FF', borderRadius: '8px', fontSize: '12px', lineHeight: '1.6', color: '#1F2937', background: '#FEFEFF', resize: 'vertical', fontFamily: 'inherit', outline: 'none' }}
                        />
                    </div>

                    <div>
                        <div style={{ fontSize: '10px', fontWeight: 700, color: '#7C3AED', textTransform: 'uppercase', marginBottom: '5px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <ShieldCheck size={11} color="#7C3AED" /> Justificación de Intervención
                        </div>
                        <textarea
                            value={editedJustificacion}
                            onChange={(e) => setEditedJustificacion(e.target.value)}
                            style={{ width: '100%', boxSizing: 'border-box', minHeight: '60px', padding: '10px 12px', border: '1px solid #E9D5FF', borderRadius: '8px', fontSize: '12px', lineHeight: '1.6', color: '#374151', background: '#FEFEFF', resize: 'vertical', fontFamily: 'inherit', outline: 'none' }}
                        />
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <Clock size={13} color="#7C3AED" />
                        <span style={{ fontSize: '11px', fontWeight: 700, color: '#5B21B6', whiteSpace: 'nowrap' }}>Tiempo Estimado:</span>
                        <input value={editedTiempo} onChange={(e) => setEditedTiempo(e.target.value)} style={{ flex: 1, padding: '5px 10px', border: '1px solid #E9D5FF', borderRadius: '6px', fontSize: '12px', color: '#1F2937', background: '#FEFEFF', outline: 'none' }} placeholder="Ej: 4 a 8 horas hábiles" />
                    </div>

                    {/* Tabla de partidas */}
                    <div>
                        <div style={{ fontSize: '10px', fontWeight: 700, color: '#7C3AED', textTransform: 'uppercase', marginBottom: '7px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <FileSpreadsheet size={11} color="#7C3AED" /> Desglose de Partidas (Precio al Cliente)
                        </div>
                        <div style={{ border: '1px solid #E9D5FF', borderRadius: '8px', overflow: 'hidden' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '32px 1fr 52px 46px 78px', gap: '8px', padding: '7px 10px', background: '#EDE9FE', fontSize: '10px', fontWeight: 800, color: '#5B21B6', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                <span>#</span><span>Descripción</span><span style={{ textAlign: 'center' }}>Und</span><span style={{ textAlign: 'center' }}>Cant</span><span style={{ textAlign: 'right' }}>P. Venta</span>
                            </div>
                            {editedPartidas.map((p, idx) => (
                                <QuotationRow key={idx} p={p} idx={idx} onChange={handlePartidaChange} />
                            ))}
                            <div style={{ display: 'grid', gridTemplateColumns: '32px 1fr 52px 46px 78px', gap: '8px', padding: '10px 10px', background: '#4C1D95', borderTop: '2px solid #6D28D9' }}>
                                <span /><div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><TrendingUp size={13} color="#C4B5FD" /><span style={{ fontSize: '12px', fontWeight: 800, color: '#C4B5FD' }}>TOTAL AL CLIENTE</span></div>
                                <span /><span /><span style={{ fontSize: '15px', fontWeight: 900, color: '#E9D5FF', textAlign: 'right' }}>S/ {formatSoles(totalEditado)}</span>
                            </div>
                        </div>
                        {pricing && Math.abs(totalEditado - pricing.precioVentaFinal) > 1 && (
                            <div style={{ marginTop: '6px', background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: '6px', padding: '5px 12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <AlertTriangle size={12} color="#D97706" />
                                <span style={{ fontSize: '11px', color: '#92400E', fontWeight: 500 }}>
                                    Total editado (S/ {formatSoles(totalEditado)}) difiere del cálculo. Margen actual: {(((totalEditado - pricing.costoBaseTotal) / totalEditado) * 100).toFixed(1)}%
                                </span>
                            </div>
                        )}
                    </div>

                    {draft.resumen?.comentario_ia && (
                        <div style={{ background: '#F5F3FF', border: '1px solid #DDD6FE', borderRadius: '8px', padding: '8px 12px', display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                            <Lightbulb size={13} color="#7C3AED" style={{ marginTop: '2px', flexShrink: 0 }} />
                            <span style={{ fontSize: '11px', color: '#5B21B6', fontWeight: 500, lineHeight: '1.5' }}>{draft.resumen.comentario_ia}</span>
                        </div>
                    )}
                </div>
            </div>

            {/* FOOTER */}
            <div style={{ background: '#F8F5FF', borderTop: '1px solid #E9D5FF', padding: '12px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <AlertTriangle size={13} color="#D97706" />
                    <span style={{ fontSize: '11px', color: '#92400E', fontWeight: 500 }}>
                        {draft.resumen?.advertencia_ia || 'Revise todos los campos. El cliente verá únicamente las partidas con el precio de venta final.'}
                    </span>
                </div>
                {approved && (
                    <button style={{ background: 'linear-gradient(135deg, #7C3AED, #9D46EF)', color: 'white', border: 'none', padding: '8px 18px', borderRadius: '8px', fontWeight: 800, fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', boxShadow: '0 4px 12px rgba(124,58,237,0.3)' }}>
                        <FileSpreadsheet size={14} /> Usar en Cotización Formal
                    </button>
                )}
            </div>
        </div>
    );
});

export const QuotationInfoBar = memo(function QuotationInfoBar({ ticket, onToggleDetails, isCollapsed }: { ticket: any; onToggleDetails?: () => void; isCollapsed?: boolean }) {
    if (!ticket.partidas || ticket.partidas.length === 0 || ticket.estadoId === 'en_cotizacion') return null;

    const isEnviada = ticket.estadoId === 'cotizacion_enviada';

    // Cálculos de desglose
    const totalFinal = round2(ticket.montoFinal || 0);
    const subtotalLocal = round2(totalFinal / 1.18);
    const igvLocal = round2(totalFinal - subtotalLocal);

    // 4. Rentabilidad Real y Dinámica — Política de Desembolsos (Rule 4)
    const historialPagos = ticket.historialPagosTecnico || [];
    const totalPagadoEfectivo = historialPagos.reduce((sum: number, p: any) => {
        // Solo sumamos pagos que han sido efectivamente ejecutados (estado 'pagado' o sin estado por ser previos)
        if (p.estado === 'anulado') return sum;
        return sum + round2(p.monto || 0);
    }, 0);

    // Los costos totales son lo mayor entre lo presupuestado (MO + Mat) y lo que realmente se ha pagado en Tesorería.
    // Esto garantiza que si hay gastos extra (movilidad, materiales adicionales), la rentabilidad baje en tiempo real.
    const baseBudgetedCost = round2(round2(ticket.costoManoObra || 0) + round2(ticket.costoMateriales || 0));
    const totalRealCosts = Math.max(baseBudgetedCost, round2(totalPagadoEfectivo));
    
    const profit = round2(subtotalLocal - totalRealCosts);
    const margin = subtotalLocal > 0 ? (profit / subtotalLocal) * 100 : 0;

    return (
        <div
            className={styles.infoBar}
            style={{
                background: 'linear-gradient(to right, #F0FDF4, white)',
                '--bar-accent-color': '#16A34A',
                marginTop: '-4px'
            } as any}
        >
            <div className={styles.titleSection}>
                <div className={styles.titleIcon} style={{ background: '#16A34A' }}>
                    <DollarSign size={18} />
                </div>
                <div className={styles.titleText}>
                    <h3 style={{ color: '#15803D' }}>Presupuesto Formal</h3>
                    <span style={{ color: '#166534' }}>
                        {ticket.estadoId === 'cotizacion_enviada' ? 'Esperando Aprobación' :
                            ticket.estadoId === 'cotizacion_aprobada' ?
                                (ticket.adelantoPagado ? '✅ Aprobado y Pagado' : '⏳ Esperando Adelanto (50%)') :
                                'Reloj Pausado'}
                    </span>
                </div>
            </div>

            <div className={styles.verticalDivider} />

            <div className={styles.infoItem}>
                <span className={styles.infoLabel}>Desglose (S/)</span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <span className={styles.infoValue} style={{ fontSize: '10px' }}>SUB: {formatSoles(subtotalLocal)}</span>
                    <span className={styles.infoValue} style={{ fontSize: '10px' }}>IGV: {formatSoles(igvLocal)}</span>
                </div>
            </div>

            {onToggleDetails && (
                <button 
                    onClick={onToggleDetails}
                    style={{
                        background: isCollapsed ? '#DCFCE7' : '#16A34A',
                        color: isCollapsed ? '#15803D' : 'white',
                        border: '1px solid #BBF7D0',
                        padding: '6px 14px',
                        borderRadius: '8px',
                        fontSize: '11px',
                        fontWeight: 800,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        transition: 'all 0.2s'
                    }}
                >
                    {isCollapsed ? <Eye size={12} /> : <Eye size={12} />}
                    <span>{isCollapsed ? 'VER COTIZACIÓN' : 'OCULTAR DETALLE'}</span>
                </button>
             )}

            <div className={styles.infoItem}>
                <span className={styles.infoLabel}>Total General</span>
                <span className={styles.infoValue} style={{ fontSize: '14px', fontWeight: '800', color: '#15803D' }}>
                    S/ {formatSoles(ticket.montoFinal)}
                </span>
            </div>

            <div className={styles.infoItem}>
                <span className={styles.infoLabel}>Rentabilidad Real</span>
                <div style={{
                    padding: '4px 10px',
                    background: margin >= 55 ? 'linear-gradient(135deg, #DCFCE7, #BBF7D0)' : 
                                margin >= 45 ? 'linear-gradient(135deg, #FEF3C7, #FDE68A)' : 
                                'linear-gradient(135deg, #FEE2E2, #FECACA)',
                    color: margin >= 55 ? '#166534' : margin >= 45 ? '#92400E' : '#991B1B',
                    borderRadius: '8px',
                    fontSize: '12px',
                    fontWeight: '900',
                    border: `1px solid ${margin >= 45 ? 'rgba(0,0,0,0.05)' : '#FCA5A5'}`,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
                    textShadow: '0 1px 0 rgba(255,255,255,0.4)'
                }}>
                    {margin < 0 ? (
                        <AlertTriangle size={12} />
                    ) : margin >= 55 ? (
                        <Sparkles size={12} />
                    ) : (
                        <TrendingUp size={12} />
                    )}
                    <span>{margin < 0 ? 'PÉRDIDA' : `${margin.toFixed(1)}%`}</span>
                </div>
            </div>

            <div className={styles.verticalDivider} style={{ opacity: 0.5, borderStyle: 'dashed' }} />

            <div className={styles.infoItem}>
                <span className={styles.infoLabel}>Fecha Gestión</span>
                <span className={styles.infoValue}>
                    {ticket.fechaCotizacion ? new Date(ticket.fechaCotizacion).toLocaleDateString('es-PE', { day: '2-digit', month: 'short' }) : '---'}
                </span>
            </div>

            {
                ticket.ajustado && (
                    <div className={styles.infoItem} style={{ borderLeft: '1px dashed #BAE6FD', paddingLeft: '15px' }}>
                        <span className={styles.infoLabel}>Comparativo</span>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span className={styles.infoValue} style={{ color: '#0369A1', fontSize: '10px', fontWeight: 'bold' }}>
                                ⚠️ AJUSTADA: S/ {formatSoles(ticket.montoFinal)}
                            </span>
                            {ticket.montoOriginal && (
                                <span style={{ fontSize: '9px', color: '#94A3B8', textDecoration: 'line-through' }}>
                                    Antes: S/ {formatSoles(ticket.montoOriginal)}
                                </span>
                            )}
                        </div>
                    </div>
                )
            }
        </div >
    );
});

interface FinancialLiquidationBarProps {
    ticket: any;
    onOpenMaterials?: () => void;
    onOpenRescue?: () => void;
    costos?: any[];
    availableRescue?: number;
}

export const UnifiedEvidenceBar = memo(function UnifiedEvidenceBar({ ticket }: { ticket: any }) {
    const hasAnyEvidence = (ticket.evidencias && ticket.evidencias.length > 0) ||
        (ticket.evidenciasCampo && ticket.evidenciasCampo.length > 0) ||
        (ticket.evidenciasEjecucion && ticket.evidenciasEjecucion.length > 0);

    if (!hasAnyEvidence) return null;

    // Mostrar esta barra desde que se finaliza el reporte técnico (en_cotizacion)
    const visibleStates = [
        "en_cotizacion",
        "cotizacion_enviada",
        "cotizacion_aprobada",
        "en_ejecucion",
        "documentacion_enviada",
        "por_liquidar",
        "pago_realizado",
        "ticket_cerrado"
    ];
    if (!visibleStates.includes(ticket.estadoId)) return null;

    return (
        <div
            className={styles.infoBar}
            style={{
                background: 'linear-gradient(to right, #F8FAFC, white)',
                '--bar-accent-color': '#64748B',
                marginTop: '-4px'
            } as any}
        >
            <div className={styles.titleSection}>
                <div className={styles.titleIcon} style={{ background: '#64748B' }}>
                    <ImageIcon size={18} />
                </div>
                <div className={styles.titleText}>
                    <h3 style={{ color: '#334155' }}>Expediente Fotográfico</h3>
                    <span style={{ color: '#475569' }}>Unificado (Antes, Durante y Después)</span>
                </div>
            </div>

            <div className={styles.verticalDivider} />

            {/* Grupo 1: Registro Inicial (Cliente) */}
            {ticket.evidencias && ticket.evidencias.length > 0 && (
                <div className={styles.infoItem}>
                    <span className={styles.infoLabel}>1. Registro Cliente</span>
                    <div className={styles.miniThumbnails}>
                        {ticket.evidencias.slice(0, 3).map((ev: any, i: number) => (
                            <div key={i} className={styles.miniThumb} style={{ borderColor: '#8B5CF6' }}>
                                <img src={ev.url} alt="Cliente" className={styles.thumbImage} loading="lazy" />
                                <div className={styles.largePreview}>
                                    <img src={ev.url} alt="Vista ampliada" loading="lazy" />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Grupo 2: Inspección Técnica */}
            {ticket.evidenciasCampo && ticket.evidenciasCampo.length > 0 && (
                <div className={styles.infoItem}>
                    <span className={styles.infoLabel}>2. Inspección (Antes)</span>
                    <div className={styles.miniThumbnails}>
                        {ticket.evidenciasCampo.slice(0, 3).map((ev: any, i: number) => (
                            <div key={i} className={styles.miniThumb} style={{ borderColor: '#0D9488' }}>
                                <img src={ev.url} alt="Inspección" className={styles.thumbImage} loading="lazy" />
                                <div className={styles.largePreview}>
                                    <img src={ev.url} alt="Vista ampliada" loading="lazy" />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Grupo 3: Ejecución de Obra */}
            {ticket.evidenciasEjecucion && ticket.evidenciasEjecucion.length > 0 && (
                <div className={styles.infoItem}>
                    <span className={styles.infoLabel}>3. Ejecución (Durante/Después)</span>
                    <div className={styles.miniThumbnails}>
                        {ticket.evidenciasEjecucion.slice(0, 3).map((ev: any, i: number) => (
                            <div key={i} className={styles.miniThumb} style={{ borderColor: '#059669' }}>
                                <img src={ev.url} alt="Ejecución" className={styles.thumbImage} loading="lazy" />
                                <div className={styles.largePreview}>
                                    <img src={ev.url} alt="Vista ampliada" loading="lazy" />
                                </div>
                            </div>
                        ))}
                        {ticket.evidenciasEjecucion.length > 3 && (
                            <span className={styles.moreCount}>+{ticket.evidenciasEjecucion.length - 3}</span>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
});

export const DocumentationSummaryBar = memo(function DocumentationSummaryBar({ ticket }: { ticket: any }) {
    // Solo mostrar si hay documentos validados y estamos en estados avanzados
    const hasDocs = ticket.documentosValidados;
    if (!hasDocs) return null;

    const visibleStates = ["documentacion_enviada", "por_liquidar", "ticket_cerrado"];
    if (!visibleStates.includes(ticket.estadoId)) return null;

    const docs = ticket.documentosValidados;

    return (
        <div
            className={styles.infoBar}
            style={{
                background: 'linear-gradient(to right, #F5F3FF, white)',
                '--bar-accent-color': '#6366F1',
                marginTop: '-4px'
            } as any}
        >
            <div className={styles.titleSection}>
                <div className={styles.titleIcon} style={{ background: '#6366F1' }}>
                    <ClipboardCheck size={18} />
                </div>
                <div className={styles.titleText}>
                    <h3 style={{ color: '#312E81' }}>Expediente Administrativo</h3>
                    <span style={{ color: '#4338CA' }}>Documentos Validados</span>
                </div>
            </div>

            <div className={styles.verticalDivider} />

            <div className={styles.infoItem}>
                <span className={styles.infoLabel}>Documentación</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ display: 'flex', gap: '6px' }}>
                        <div title="Acta de Conformidad" style={{ opacity: docs.actaConformidad ? 1 : 0.2 }}>
                            <FileText size={16} color="#4F46E5" />
                        </div>
                        <div title="ATS" style={{ opacity: docs.ats ? 1 : 0.2 }}>
                            <ShieldCheck size={16} color="#4F46E5" />
                        </div>
                        <div title="Declaración Jurada" style={{ opacity: docs.declaracionJurada ? 1 : 0.2 }}>
                            <CheckCircle2 size={16} color="#4F46E5" />
                        </div>
                        <div title="Excel de Seguridad" style={{ opacity: docs.excelSeguridad ? 1 : 0.2 }}>
                            <FileSpreadsheet size={16} color="#4F46E5" />
                        </div>
                    </div>
                </div>
            </div>

            <div className={styles.infoItem}>
                <span className={styles.infoLabel}>Estado</span>
                <span className={styles.infoValue} style={{ fontSize: '10px', color: '#059669', fontWeight: 800 }}>
                    COMPLETO Y FIRMADO
                </span>
            </div>

            <div className={styles.infoItem}>
                <span className={styles.infoLabel}>Validado el</span>
                <span className={styles.infoValue}>
                    {ticket.fechaValidacionDocumental ? new Date(ticket.fechaValidacionDocumental).toLocaleDateString() : '---'}
                </span>
            </div>

            <div className={styles.infoItem} style={{ borderLeft: '1px dashed #DDD', paddingLeft: '12px', flex: 2 }}>
                <span className={styles.infoLabel} style={{ color: '#EF4444' }}>Aviso importante</span>
                <span className={styles.infoValue} style={{ fontSize: '9px', color: '#B91C1C', fontStyle: 'italic', lineHeight: '1', fontWeight: 600 }}>
                    * Incurre en falta administrativa si indica documentos existentes sin poseerlos.
                </span>
            </div>
        </div>
    );
});


export const FinancialLiquidationBar = memo(function FinancialLiquidationBar({ ticket, onOpenMaterials, onOpenRescue, costos, availableRescue: propRescue }: FinancialLiquidationBarProps) {
    const [viewingVoucher, setViewingVoucher] = useState<string | null>(null);

    // Si no hay monto final ni costos base, no hay nada que liquidar aún
    if (!ticket.montoFinal && !ticket.montoTotalCotizado && !ticket.costoManoObra) return null;

    const finances = calculateTicketFinances(ticket, costos);
    const { 
        pactedMO: pactadoLaborBase, 
        totalLaborConfirmed: totalPagadoTecnico, 
        netLaborBalance: montoSaldo,
        realProfitability: rentabilidadReal,
        margenReal: pctReal,
        laborItems: confirmedLaborItems,
        operatingExpenses,
        operatingItems
    } = finances;

    const montoTotalCliente = ticket.montoFinal || ticket.montoTotalCotizado || 0;
    const paymentPercentage = pactadoLaborBase > 0 ? (totalPagadoTecnico / pactadoLaborBase) * 100 : 0;

    // Lista de estados donde la barra es relevante (desde que se envía la cotización o se aprueba)
    const visibleStates = [
        "cotizacion_enviada",
        "cotizacion_aprobada",
        "en_ejecucion",
        "documentacion_enviada",
        "por_liquidar",
        "ticket_cerrado"
    ];

    if (!visibleStates.includes(ticket.estadoId)) return null;

    const availableRescue = propRescue !== undefined ? propRescue : Math.max(finances.netLaborBalance, finances.pactedMO - finances.totalExpenses);

    return (
        <div
            className={styles.infoBar}
            style={{
                background: 'linear-gradient(to right, #FFFBEB, white)',
                '--bar-accent-color': '#F59E0B',
                marginTop: '-4px'
            } as any}
        >
            <div className={styles.titleSection}>
                <div className={styles.titleIcon} style={{ background: '#F59E0B' }}>
                    <Scale size={18} />
                </div>
                <div className={styles.titleText}>
                    <h3 style={{ color: '#92400E' }}>Liquidación Financiera</h3>
                    <span style={{ color: '#B45309' }}>Ref: Reporte Técnico</span>
                </div>
            </div>

            <div className={styles.verticalDivider} />

            <div className={styles.infoItem}>
                <span className={styles.infoLabel}>
                    {["en_cotizacion", "cotizacion_enviada"].includes(ticket.estadoId) ? "Presupuesto Proyectado" : "Presupuesto Cliente"}
                </span>
                <span className={styles.infoValue} style={{ color: '#1E293B', fontWeight: 900 }}>
                    S/ {formatSoles(montoTotalCliente)}
                </span>
            </div>

            <div className={styles.infoItem} style={{ borderLeft: '1px solid #E2E8F0', paddingLeft: '12px' }}>
                <span className={styles.infoLabel} style={{ color: ["en_cotizacion", "cotizacion_enviada"].includes(ticket.estadoId) ? '#3B82F6' : '#059669' }}>
                    {["en_cotizacion", "cotizacion_enviada"].includes(ticket.estadoId) ? "Rentabilidad Proyectada" : "Rentabilidad Real"}
                </span>
                <span className={styles.infoValue} style={{ 
                    color: ["en_cotizacion", "cotizacion_enviada"].includes(ticket.estadoId) ? '#3B82F6' : (rentabilidadReal < 0 ? '#EF4444' : '#059669'), 
                    fontWeight: 900 
                }}>
                    S/ {formatSoles(rentabilidadReal)}
                </span>
            </div>

            <div className={styles.infoItem} style={{ flex: 1.5 }}>
                <span className={styles.infoLabel} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <CreditCard size={10} /> PAGOS CONFIRMADOS ({paymentPercentage.toFixed(0)}%)
                </span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', marginTop: '4px' }}>
                    {/* Gastos Pendientes (Alerta Visual) */}
                    {(costos || []).filter(c => (c.estado_pago || '').toLowerCase() === 'pendiente').length > 0 && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#FEF2F2', padding: '2px 8px', borderRadius: '6px', border: '1px solid #FCA5A5', marginBottom: '2px' }}>
                            <AlertTriangle size={10} color="#B91C1C" />
                            <span style={{ fontSize: '9px', fontWeight: 800, color: '#B91C1C' }}>
                                {(costos || []).filter(c => (c.estado_pago || '').toLowerCase() === 'pendiente').length} GASTO(S) PENDIENTE(S)
                            </span>
                        </div>
                    )}
                    
                    {/* Excedentes REQUIEREN APROBACIÓN ADMIN (Alerta Visual) */}
                    {(costos || []).filter(c => (c.estado_pago || '').toLowerCase() === 'requiere_aprobacion_admin').length > 0 && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#F5F3FF', padding: '2px 8px', borderRadius: '6px', border: '1px solid #C7D2FE', marginBottom: '2px' }}>
                            <ShieldAlert size={10} color="#4F46E5" />
                            <span style={{ fontSize: '9px', fontWeight: 900, color: '#4F46E5' }}>
                                {(costos || []).filter(c => (c.estado_pago || '').toLowerCase() === 'requiere_aprobacion_admin').length} RESCATE(S) REQUIEREN APROBACIÓN ADMIN
                            </span>
                        </div>
                    )}
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <span className={styles.infoLabel}>Historial de Movimientos</span>
                        {[...confirmedLaborItems, ...operatingItems].length > 0 ? (
                            <div className={styles.recentHistoryCompact}>
                                {[...confirmedLaborItems, ...operatingItems].slice(0, 3).map((p: any, idx: number) => (
                                    <div key={idx} className={styles.historyDot} title={`${p.tipo || p.concepto || 'Pago'}: S/ ${p.monto}`}>
                                        <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: (p.categoria || p.tipo || '').toLowerCase().includes('mat') ? '#DB2777' : '#2563EB' }} />
                                    </div>
                                ))}
                                {[...confirmedLaborItems, ...operatingItems].length > 3 && (
                                    <span style={{ fontSize: '10px', color: '#64748B', fontWeight: 600 }}>
                                        + {[...confirmedLaborItems, ...operatingItems].length - 3} mov.
                                    </span>
                                )}
                            </div>
                        ) : (
                            <span style={{ fontSize: '11px', color: '#94A3B8', fontStyle: 'italic' }}>Sin pagos registrados</span>
                        )}
                    </div>
                </div>
            </div>

            <div className={styles.infoItem} style={{ borderLeft: '1px solid rgba(226, 232, 240, 0.8)', paddingLeft: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Wallet size={16} color="#0F172A" />
                    <span className={styles.infoLabel} style={{ color: '#0F172A', fontWeight: 700 }}>SALDO MANO DE OBRA (TÉCNICO)</span>
                </div>
                <div style={{ 
                    display: 'flex', alignItems: 'center', gap: '8px', 
                    background: montoSaldo > 0 ? 'linear-gradient(135deg, #EFF6FF 0%, #DBEAFE 100%)' : 'linear-gradient(135deg, #F0FDF4 0%, #DCFCE7 100%)', 
                    padding: '8px 16px', borderRadius: '10px',
                    border: `1px solid ${montoSaldo > 0 ? '#BFDBFE' : '#BBF7D0'}`,
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)'
                }}>
                    <span style={{ fontSize: '18px', fontWeight: 950, color: montoSaldo > 0 ? '#1E40AF' : '#166534', letterSpacing: '-0.5px' }}>
                        S/ {formatSoles(montoSaldo)}
                    </span>
                    {montoSaldo === 0 ? (
                        <CheckCircle2 size={16} color="#166534" />
                    ) : (
                        <Wallet size={16} color="#3B82F6" style={{ filter: 'drop-shadow(0 2px 4px rgba(59, 130, 246, 0.3))' }} />
                    )}
                </div>
                {montoSaldo > 0 && pactadoLaborBase > 0 && (
                    <span style={{ fontSize: '9px', color: '#3B82F6', fontStyle: 'italic', marginTop: '2px', display: 'block', fontWeight: 700, textTransform: 'uppercase' }}>
                        * Pendiente de Mano de Obra Pactada
                    </span>
                )}
            </div>

            {onOpenMaterials && ticket.estadoId !== 'ticket_cerrado' && (
                <button 
                    className={styles.purchaseBtn}
                    onClick={onOpenMaterials}
                >
                    <Package size={14} />
                    <span>Compras</span>
                </button>
            )}

            {onOpenRescue && ticket.estadoId !== "ticket_cerrado" && (
                <button 
                    className={styles.pillsBtn} 
                    onClick={onOpenRescue}
                    style={{ 
                        background: availableRescue > 0 ? '#FFF7ED' : '#F1F5F9', 
                        color: availableRescue > 0 ? '#C2410C' : '#94A3B8',
                        border: availableRescue > 0 ? '1px solid #FFEDD5' : '1px solid #E2E8F0',
                        marginRight: '8px'
                    }}
                    disabled={availableRescue <= 0}
                    title={availableRescue > 0 ? "Solicitar Adelanto de Mano de Obra (Rescate)" : "Se ha alcanzado el tope de la mano de obra pactada"}
                >
                    <Coins size={16} color={availableRescue > 0 ? "#F59E0B" : "#94A3B8"} />
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', lineHeight: '1' }}>
                        <span style={{ fontSize: '10px', fontWeight: 900 }}>{availableRescue > 0 ? "Rescate" : "Tope"}</span>
                        <span style={{ fontSize: '8px', opacity: 0.8 }}>Adelanto M.O.</span>
                    </div>
                </button>
            )}

            <div className={styles.verticalDivider} style={{ opacity: 0.5, borderStyle: 'dashed' }} />

            <div className={styles.infoItem}>
                <span className={styles.infoLabel}>Estado Financiero</span>
                <span className={styles.statusBadge} style={{
                    background: ticket.estadoId === 'ticket_cerrado' ? '#D1FAE5' : (ticket.adelantoPagado ? '#DBEAFE' : '#FEF3C7'),
                    color: ticket.estadoId === 'ticket_cerrado' ? '#065F46' : (ticket.adelantoPagado ? '#1E40AF' : '#92400E'),
                    fontSize: '10px'
                }}>
                    {ticket.estadoId === 'ticket_cerrado' ? 'TOTALMENTE LIQUIDADO' :
                        ticket.adelantoPagado ? 'ADELANTO PAGADO' : 'PENDIENTE INICIAL'}
                </span>
            </div>

            {viewingVoucher && (
                <div
                    style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.85)', zIndex: 1000000, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'zoom-out' }}
                    onClick={() => setViewingVoucher(null)}
                >
                    <div style={{ position: 'relative', maxWidth: '85%', maxHeight: '85%' }} onClick={e => e.stopPropagation()}>
                        <img src={viewingVoucher} alt="Voucher" style={{ width: '100%', height: 'auto', borderRadius: '12px', boxShadow: '0 20px 50px rgba(0,0,0,0.5)' }} />
                        <button
                            style={{ position: 'absolute', top: '-20px', right: '-20px', background: 'white', border: 'none', borderRadius: '50%', width: '40px', height: '40px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 15px rgba(0,0,0,0.3)' }}
                            onClick={() => setViewingVoucher(null)}
                        >
                            <X size={24} color="#1E293B" />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
});

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// PAYMENT HISTORY BAR — visible para Admin Y Gestora
// Muestra todos los pagos confirmados por el admin con vouchers
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export const PaymentHistoryBar = memo(function PaymentHistoryBar({ ticket, costos }: { ticket: any, costos?: any[] }) {
    const [viewingVoucher, setViewingVoucher] = useState<string | null>(null);

    const finances = calculateTicketFinances(ticket, costos);
    const combinedPagos = [...finances.laborItems, ...finances.operatingItems].sort((a, b) => {
        const dateA = new Date(a.fecha || a.created_at || a.updated_at || 0).getTime();
        const dateB = new Date(b.fecha || b.created_at || b.updated_at || 0).getTime();
        return dateB - dateA; 
    });

    if (combinedPagos.length === 0) return null;

    const totalPagadoConfirmado = finances.totalLaborConfirmed + finances.operatingExpenses;

    const getTipoBadge = (p: any) => {
        const tipoStr = p.tipo || p.categoria || "";
        const map: Record<string, { bg: string; color: string; label: string }> = {
            'Adelanto': { bg: '#DBEAFE', color: '#1D4ED8', label: 'Adelanto' },
            'Refuerzo': { bg: '#FEF3C7', color: '#92400E', label: 'Refuerzo' },
            'Liquidación Final': { bg: '#D1FAE5', color: '#065F46', label: 'Liquidación' },
            'Movilidad / Visita': { bg: '#EDE9FE', color: '#5B21B6', label: 'Movilidad' },
            'Materiales': { bg: '#FCE7F3', color: '#BE185D', label: 'Materiales' },
            'Logística': { bg: '#F1F5F9', color: '#475569', label: 'Logística' },
            'Rescate Financiero': { bg: '#FFF7ED', color: '#C2410C', label: 'Rescate' },
            'Viáticos / Movilidad': { bg: '#EDE9FE', color: '#5B21B6', label: 'Viáticos' }
        };
        const cleanTipo = tipoStr.replace('Gasto: ', '');
        return map[cleanTipo] || { bg: '#F1F5F9', color: '#475569', label: cleanTipo || 'Pago' };
    };

    const getStatusStyle = (p: any) => {
        const st = (p.estado_pago || p.estado || 'borrador').toLowerCase();
        if (st === 'rechazado' || st === 'anulado') {
            return { opacity: 0.6, textDecoration: 'line-through', color: '#94A3B8' };
        }
        if (st === 'pendiente' || st === 'requiere_aprobacion' || st === 'requiere_aprobacion_admin') {
            return { opacity: 0.7, fontStyle: 'italic' };
        }
        return {};
    };

    const resolveVoucher = (p: any): string => {
        const src = p.url_comprobante || p.voucher || p.voucherRef;
        if (!src || typeof src !== 'string') return "";
        if (src.startsWith('data:image')) return src;
        if (typeof window === 'undefined') return src;
        return localStorage.getItem(src) || src;
    };

    return (
        <div
            className={styles.infoBar}
            style={{
                background: 'linear-gradient(to right, #F0FDF4, white)',
                '--bar-accent-color': '#10B981',
            } as any}
        >
            {/* Header */}
            <div className={styles.titleSection}>
                <div className={styles.titleIcon} style={{ background: '#10B981' }}>
                    <Banknote size={18} />
                </div>
                <div className={styles.titleText}>
                    <h3 style={{ color: '#065F46' }}>Pagos al Técnico</h3>
                    <span style={{ color: '#059669' }}>
                        {combinedPagos.length} depósito{combinedPagos.length !== 1 ? 's' : ''} confirmado{combinedPagos.length !== 1 ? 's' : ''}
                    </span>
                </div>
            </div>

            <div className={styles.verticalDivider} />

            {/* Lista de pagos */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {combinedPagos.map((p: any, idx: number) => {
                    const badge = getTipoBadge(p);
                    const voucherSrc = resolveVoucher(p);
                    const st = (p.estado_pago || p.estado || 'borrador').toLowerCase();
                    return (
                        <div
                            key={p.id || idx}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '10px',
                                padding: '6px 10px',
                                background: 'white',
                                borderRadius: '8px',
                                border: '1px solid #E2E8F0',
                                boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                                ...getStatusStyle(p)
                            }}
                        >
                            {/* Número */}
                            <span style={{ fontSize: '10px', fontWeight: 800, color: '#94A3B8', minWidth: '16px' }}>
                                {idx + 1}
                            </span>

                            {/* Badge tipo */}
                            <span style={{
                                fontSize: '9px', fontWeight: 800,
                                background: badge.bg, color: badge.color,
                                padding: '2px 7px', borderRadius: '999px',
                                whiteSpace: 'nowrap'
                            }}>
                                {badge.label}
                            </span>

                            {/* Monto */}
                            <span style={{ fontSize: '12px', fontWeight: 900, color: st === 'rechazado' ? '#94A3B8' : '#065F46' }}>
                                S/ {formatSoles(p.monto)}
                            </span>

                            {/* Etiquetas de Estado */}
                            {(() => {
                                if (st === 'rechazado' || st === 'anulado') return (
                                    <span style={{ fontSize: '9px', fontWeight: 800, color: '#EF4444', background: '#FEF2F2', padding: '1px 6px', borderRadius: '4px' }}>❌ Denegado</span>
                                );
                                if (st === 'pendiente' || st === 'requiere_aprobacion') return (
                                    <span style={{ fontSize: '9px', fontWeight: 800, color: '#F59E0B', background: '#FFFBEB', padding: '1px 6px', borderRadius: '4px' }}>⏳ Pendiente Tesorería</span>
                                );
                                if (st === 'requiere_aprobacion_admin') return (
                                    <span style={{ fontSize: '9px', fontWeight: 900, color: '#6366f1', background: '#EEF2FF', border: '1px solid #C7D2FE', padding: '1px 6px', borderRadius: '4px' }}>🛡️ Esperando Aprobación Admin</span>
                                );
                                return null;
                            })()}

                            {/* Fecha */}
                            {p.fecha && (
                                <span style={{ fontSize: '10px', color: '#94A3B8', fontWeight: 600 }}>
                                    {new Date(p.fecha).toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                                </span>
                            )}

                            {/* Referencia */}
                            {p.referencia && (
                                <span style={{ fontSize: '10px', color: '#64748B', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {p.referencia}
                                </span>
                            )}

                            {/* Voucher button */}
                            {voucherSrc && (
                                <button
                                    onClick={() => setViewingVoucher(voucherSrc)}
                                    title="Ver comprobante"
                                    style={{
                                        background: '#EEF2FF',
                                        border: '1px solid #C7D2FE',
                                        borderRadius: '6px',
                                        padding: '3px 8px',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '4px',
                                        color: '#4F46E5',
                                        fontSize: '10px',
                                        fontWeight: 700,
                                        flexShrink: 0,
                                    }}
                                >
                                    <Eye size={11} />
                                    <span>Voucher</span>
                                </button>
                            )}

                            {/* Sin voucher */}
                            {!voucherSrc && st === 'pagado' && (
                                <span style={{ fontSize: '9px', color: '#CBD5E1', fontStyle: 'italic' }}>sin comprobante</span>
                            )}

                            {st === 'pagado' && <CheckCircle2 size={12} color="#10B981" style={{ flexShrink: 0 }} />}
                        </div>
                    );
                })}

                {/* Total */}
                <div style={{
                    display: 'flex', justifyContent: 'flex-end', alignItems: 'center',
                    gap: '8px', paddingTop: '4px', borderTop: '1px dashed #BBF7D0', marginTop: '2px'
                }}>
                    <TrendingUp size={12} color="#059669" />
                    <span style={{ fontSize: '11px', color: '#059669', fontWeight: 700 }}>Total transferido (Confirmado):</span>
                    <span style={{ fontSize: '13px', fontWeight: 900, color: '#065F46' }}>
                        S/ {formatSoles(totalPagadoConfirmado)}
                    </span>
                </div>
            </div>

            {/* Lightbox voucher */}
            {viewingVoucher && (
                <div
                    style={{
                        position: 'fixed', inset: 0,
                        background: 'rgba(0,0,0,0.88)',
                        zIndex: 1000000,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        cursor: 'zoom-out',
                        backdropFilter: 'blur(4px)',
                    }}
                    onClick={() => setViewingVoucher(null)}
                >
                    <div
                        style={{ position: 'relative', maxWidth: '88vw', maxHeight: '88vh' }}
                        onClick={e => e.stopPropagation()}
                    >
                        <img
                            src={viewingVoucher}
                            alt="Comprobante de pago"
                            style={{
                                maxWidth: '100%', maxHeight: '85vh',
                                borderRadius: '14px',
                                boxShadow: '0 25px 60px rgba(0,0,0,0.6)',
                            }}
                        />
                        <button
                            style={{
                                position: 'absolute', top: '-18px', right: '-18px',
                                background: 'white', border: 'none', borderRadius: '50%',
                                width: '38px', height: '38px',
                                cursor: 'pointer', display: 'flex',
                                alignItems: 'center', justifyContent: 'center',
                                boxShadow: '0 4px 15px rgba(0,0,0,0.35)',
                            }}
                            onClick={() => setViewingVoucher(null)}
                        >
                            <X size={22} color="#1E293B" />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
});

interface TicketSummaryProps {
    ticket: any;
    onProceed: () => void;
    onOpenMaterials?: () => void;
    onOpenRescue?: () => void;
    costos?: any[];
}

export const TicketSummary = memo(function TicketSummary({ ticket, onProceed, onOpenMaterials, onOpenRescue, costos }: TicketSummaryProps) {
    return (
        <div className={styles.container}>
            <InfoBarBase
                ticket={ticket}
                title="Revisión Inicial"
                icon={FileText}
                color="#8B5CF6"
                gradient="linear-gradient(135deg, #F5F3FF, #EDE9FE)"
            />

            <TechnicianSchedulingBar ticket={ticket} />
            <DiagnosisInfoBar ticket={ticket} />
            <QuoteAssistantBar ticket={ticket} />
            <QuotationInfoBar ticket={ticket} />
            <FinancialLiquidationBar 
                ticket={ticket} 
                onOpenMaterials={onOpenMaterials} 
                onOpenRescue={onOpenRescue}
                costos={costos} 
            />
            <PaymentHistoryBar ticket={ticket} costos={costos} />
            <UnifiedEvidenceBar ticket={ticket} />
            <DocumentationSummaryBar ticket={ticket} />

            <div className={styles.actions}>
                <button className={styles.proceedBtn} onClick={onProceed}>
                    <span>Asignar Técnico</span>
                    <ArrowRight size={18} />
                </button>
            </div>
        </div>
    );
});

export const GestoraAssignmentBar = memo(function GestoraAssignmentBar({ ticket, onAssign, canAssign }: { ticket: any; onAssign?: () => void; canAssign: boolean }) {
    const gestora = ticket.gestora || ticket.gestoraAsignado;
    const hasGestora = !!gestora;

    return (
        <div 
            className={styles.infoBar}
            style={{ 
                background: hasGestora ? 'linear-gradient(to right, #EEF2FF, white)' : 'linear-gradient(to right, #FFF7ED, white)',
                '--bar-accent-color': hasGestora ? '#6366F1' : '#F97316',
                marginTop: '-4px'
            } as any}
        >
            <div className={styles.titleSection}>
                <div className={styles.titleIcon} style={{ background: hasGestora ? '#6366F1' : '#F97316' }}>
                    <ShieldCheck size={18} />
                </div>
                <div className={styles.titleText}>
                    <h3 style={{ color: hasGestora ? '#3730A3' : '#9A3412' }}>Gestión Operativa</h3>
                    <span style={{ color: hasGestora ? '#4F46E5' : '#C2410C' }}>
                        {hasGestora ? 'Responsable Asignado(a)' : 'Pendiente de Derivación'}
                    </span>
                </div>
            </div>

            <div className={styles.verticalDivider} />

            <div className={styles.infoItem} style={{ flex: 1.5 }}>
                <span className={styles.infoLabel}>Gestor(a)</span>
                {hasGestora ? (
                    <div className={styles.clienteCompact}>
                        <div className={styles.clienteAvatar} style={{ background: '#6366F1' }}>
                            {(gestora.name || gestora.nombre || "G").substring(0, 1).toUpperCase()}
                        </div>
                        <span className={styles.infoValue} style={{ fontWeight: 700 }}>{gestora.name || gestora.nombre}</span>
                    </div>
                ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#F97316' }}>
                        <AlertTriangle size={14} />
                        <span style={{ fontSize: '11px', fontWeight: 800 }}>REQUIERE DESIGNACIÓN MANUAL</span>
                    </div>
                )}
            </div>

            {canAssign && !ticket.estadoId.includes('cerrado') && (
                <button 
                    className={styles.reassignBtn}
                    onClick={onAssign}
                    style={{ 
                        color: hasGestora ? '#4338CA' : '#C2410C', 
                        '--btn-color': hasGestora ? '#6366F1' : '#F97316',
                        background: hasGestora ? '#EEF2FF' : '#FFF7ED',
                        padding: '6px 12px',
                        border: `1px solid ${hasGestora ? '#C7D2FE' : '#FFEDD5'}`
                    } as any}
                >
                    {hasGestora ? <RefreshCw size={12} /> : <ChevronRight size={14} />}
                    <span>{hasGestora ? 'Cambiar Gestora' : 'Derivar Ahora'}</span>
                </button>
            )}
        </div>
    );
});
