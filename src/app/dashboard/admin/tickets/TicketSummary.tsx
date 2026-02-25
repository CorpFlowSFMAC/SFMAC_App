"use client";

import { FileText, MapPin, User, ArrowRight, Calendar, RefreshCw, Edit2, Stethoscope, CreditCard, Image as ImageIcon, Clock, DollarSign, Scale, CheckCircle2, Wallet, Coins, ClipboardCheck, ShieldCheck, FileSpreadsheet, Bot, Sparkles, Lightbulb, AlertTriangle, Eye, X, Banknote, TrendingUp } from "lucide-react";
import { getServiceById } from "@/lib/serviceTypes";
import { useState } from "react";
import { supabase } from "@/lib/supabase";
import styles from "./TicketSummary.module.css";

interface InfoBarBaseProps {
    ticket: any;
    title: string;
    icon: any;
    color: string;
    gradient: string;
}

export function InfoBarBase({ ticket, title, icon: Icon, color, gradient }: InfoBarBaseProps) {
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
}

interface TechnicianSchedulingBarProps {
    ticket: any;
    onReassign?: () => void;
    onEditSchedule?: () => void;
}

export function TechnicianSchedulingBar({ ticket, onReassign, onEditSchedule }: TechnicianSchedulingBarProps) {
    const techStatus = ticket.tecnico || ticket.tecnicoAsignado;
    if (!ticket.technicianId && !techStatus) return null;

    const techName = techStatus?.nombre || "Técnico Asignado";
    const techPhone = techStatus?.celular || techStatus?.telefono || "---";
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
        return localStorage.getItem(ref) || "";
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
}

export function DiagnosisInfoBar({ ticket }: { ticket: any }) {
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
                    <CreditCard size={12} color="#0D9488" />
                    <span className={styles.infoValue}>{ticket.modalidad === 'todo_costo' ? 'A Todo Costo' : 'Desagregado'}</span>
                </div>
            </div>
            <div className={styles.infoItem}>
                <span className={styles.infoLabel}>Pre-Presupuesto</span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <span className={styles.infoValue} style={{ fontSize: '10px' }}>🛠️ MO: S/ {ticket.costoManoObra || 0}</span>
                    <span className={styles.infoValue} style={{ fontSize: '10px' }}>📦 MAT: S/ {ticket.costoMateriales || 0}</span>
                </div>
            </div>
        </div>
    );
}

export function QuoteAssistantBar({ ticket }: { ticket: any }) {
    // Solo mostrar si hay costos definidos y estamos en etapa de cotización (antes de enviarla)
    // LÓgica de Sugerencia Comercial
    const costoMO = parseFloat(ticket.costoManoObra || 0);
    const costoMat = parseFloat(ticket.costoMateriales || 0);
    const costoTotal = costoMO + costoMat;

    // Solo mostrar si hay costos definidos y estamos en etapa de cotización o previa
    const hasCosts = costoTotal > 0;
    const isQuoting = ["visita_realizada", "en_cotizacion", "cotizacion_enviada"].includes(ticket.estadoId);

    if (!hasCosts || !isQuoting) return null;

    // Margen Objetivo: 55% sobre el Precio de Venta (Rentabilidad)
    // Precio = Costo / (1 - Margen%)
    // Margen 55% -> (1 - 0.55) = 0.45
    const precioSugerido = costoTotal / 0.45;

    // Estado para la generación de la propuesta
    const [isGenerating, setIsGenerating] = useState(false);
    const [proposal, setProposal] = useState<any>(null);

    // Generación de propuesta con IA (Gemini)
    const generateProposal = async () => {
        setIsGenerating(true);
        try {
            // 1. Obtener contexto histórico (Aprendizaje)
            let historyContext = "";
            const { data: historyTickets } = await supabase
                .from('tickets')
                .select('description, metadata')
                .eq('status_id', 'cerrado')
                .not('metadata', 'is', null)
                .limit(3);

            if (historyTickets && historyTickets.length > 0) {
                historyContext = "\n\nEJEMPLOS REALES DE COTIZACIONES APROBADAS (USAR COMO REFERENCIA):\n" +
                    historyTickets.map((h: any, i: number) => {
                        const prop = h.metadata?.proposal || h.metadata?.cotizacion;
                        if (!prop) return "";
                        return `EJEMPLO ${i + 1} (${h.description}):\n${JSON.stringify(prop).substring(0, 800)}`;
                    }).join('\n\n');
            }
            const prompt = `
                Actúas como el Gerente de Presupuestos Senior de SINFIMAC CORP.

                OBJETIVO: Generar un PRESUPUESTO DETALLADO (Desglose de Partidas) basado en el reporte técnico. NO entregues un monto global único. Debes desglosar el trabajo en partidas lÓgicas de ejecución.

                DATOS DEL REPORTE:
                - Cliente: ${ticket.cliente?.nombre || 'Cliente Corporativo'}
                - Sede: ${ticket.sede?.nombre || 'Sede Principal'}
                - Servicio: ${ticket.tipoServicio}
                - Descripción: "${ticket.descripcionProblema}"
                - Costo Técnico Referencial (MO + Materiales): S/ ${costoTotal.toFixed(2)}

                ${historyContext}

                INTELIGENCIA DE PRECIOS:
                1. Analiza los EJEMPLOS HISTÓRICOS para entender cÓmo desglosamos partidas similares.
                2. Si no hay ejemplos, aplica la regla general: Precio Venta ≈ Costo Técnico / 0.45 (Margen 55%).
                3. Usa la evidencia visual (imágenes adjuntas) para afinar el alcance.
                
                Instrucciones:
                1. Identifica las actividades necesarias (Ej. 'Movilización', 'Suministro de repuestos', 'Mano de obra especializada', 'Pruebas').
                2. Distribuye el Precio de Venta Total entre estas partidas de forma lÓgica.
                3. Redacta un alcance técnico profesional para cada partida.

                FORMATO DE SALIDA (JSON ESTRICTO):
                {
                    "partidas": [
                        {
                            "item": "1.0",
                            "titulo": "Título corto de la partida",
                            "descripcion": "Alcance detallado...",
                            "unidad": "GLB/UND/M2",
                            "cantidad": 1,
                            "precio_unitario": Number (Precio de Venta)
                        }
                    ],
                    "resumen": {
                        "comentario_ia": "Breve explicación de la estrategia de precios tomada",
                        "precio_total_venta": Number
                    }
                }
            `;

            // 2. Recolectar Imágenes (Multimodal)
            const imagesPayload: string[] = [];
            if (ticket.evidencias && ticket.evidencias.length > 0) {
                ticket.evidencias.forEach((e: any) => {
                    // Priorizamos Base64 para envío directo a Gemini
                    if (e.url && e.url.startsWith('data:image')) {
                        imagesPayload.push(e.url);
                    }
                });
            }

            const response = await fetch('/api/ai/gemini', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt, images: imagesPayload })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || errorData.details || "Error en la API de IA");
            }

            const data = await response.json();
            setProposal(data);

        } catch (error: any) {
            console.error("Error generando propuesta:", error);
            alert(`Error: ${error.message || "Hubo un problema al generar la propuesta."}`);
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <div
            className={styles.infoBar}
            style={{
                background: 'linear-gradient(to right, #FDF4FF, white)',
                '--bar-accent-color': '#D946EF',
                border: '1px solid #F0ABFC',
                marginTop: '-4px',
                flexDirection: 'column',
                alignItems: 'stretch',
                gap: '12px'
            } as any}
        >
            {/* Header del Asistente */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                    <div className={styles.titleSection}>
                        <div className={styles.titleIcon} style={{ background: 'linear-gradient(135deg, #D946EF, #C026D3)' }}>
                            <Bot size={18} />
                        </div>
                        <div className={styles.titleText}>
                            <h3 style={{ color: '#A21CAF' }}>Asistente de Presupuestos</h3>
                            <span style={{ color: '#C026D3', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <Sparkles size={10} /> Senior Budget Manager AI
                            </span>
                        </div>
                    </div>

                    <div className={styles.verticalDivider} />

                    <div className={styles.infoItem}>
                        <span className={styles.infoLabel}>Costo Técnico</span>
                        <span className={styles.infoValue}>S/ {costoTotal.toFixed(2)}</span>
                    </div>
                </div>

                {!proposal && (
                    <button
                        onClick={generateProposal}
                        disabled={isGenerating}
                        style={{
                            background: '#A21CAF',
                            color: 'white',
                            border: 'none',
                            padding: '8px 16px',
                            borderRadius: '8px',
                            fontWeight: 700,
                            fontSize: '0.8rem',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            cursor: isGenerating ? 'wait' : 'pointer',
                            boxShadow: '0 4px 10px rgba(162, 28, 175, 0.3)'
                        }}
                    >
                        {isGenerating ? (
                            <>
                                <RefreshCw size={14} className={styles.spin} />
                                <span>Analizando...</span>
                            </>
                        ) : (
                            <>
                                <Sparkles size={14} />
                                <span>GENERAR PROPUESTA IA</span>
                            </>
                        )}
                    </button>
                )}
            </div>

            {/* Resultado de la Propuesta */}
            {proposal && (
                <div style={{
                    background: 'white',
                    borderRadius: '10px',
                    border: '1px solid #E9D5FF',
                    padding: '16px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                    animation: 'fadeIn 0.5s ease-out'
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #F3F4F6', paddingBottom: '8px' }}>
                        <span style={{ fontSize: '11px', fontWeight: 800, color: '#A21CAF', textTransform: 'uppercase' }}>Propuesta Generada (JSON)</span>
                        <span style={{ fontSize: '10px', color: '#64748B' }}>Margen Asegurado: {proposal.margen_aplicado}</span>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {proposal.partidas && proposal.partidas.map((item: any, idx: number) => (
                            <div key={idx} style={{
                                display: 'grid',
                                gridTemplateColumns: 'auto 1fr auto auto',
                                gap: '12px',
                                alignItems: 'start',
                                padding: '8px',
                                borderBottom: idx < proposal.partidas.length - 1 ? '1px dashed #F1F5F9' : 'none'
                            }}>
                                <span style={{ fontSize: '11px', fontWeight: 700, color: '#A21CAF' }}>{item.item}</span>
                                <div>
                                    <p style={{ margin: 0, fontSize: '12px', fontWeight: 600, color: '#1E293B' }}>{item.titulo}</p>
                                    <p style={{ margin: '2px 0 0 0', fontSize: '10px', color: '#64748B', whiteSpace: 'pre-wrap' }}>{item.descripcion}</p>
                                </div>
                                <div style={{ fontSize: '11px', color: '#475569', textAlign: 'right' }}>
                                    {item.cantidad} {item.unidad}
                                </div>
                                <div style={{ fontSize: '12px', fontWeight: 700, color: '#1E293B', textAlign: 'right', minWidth: '70px' }}>
                                    S/ {item.precio_unitario?.toFixed(2)}
                                </div>
                            </div>
                        ))}

                        <div style={{
                            marginTop: '8px',
                            paddingTop: '12px',
                            borderTop: '2px solid #F3F4F6',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Bot size={14} color="#A21CAF" />
                                <span style={{ fontSize: '11px', color: '#A21CAF', fontWeight: 600 }}>Total Sugerido (Rentabilidad 55%)</span>
                            </div>
                            <span style={{ fontSize: '16px', fontWeight: 900, color: '#A21CAF' }}>
                                S/ {proposal.resumen?.precio_total_venta?.toFixed(2)}
                            </span>
                        </div>
                    </div>

                    <div style={{ background: '#FEF2F2', padding: '8px', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <AlertTriangle size={14} color="#DC2626" />
                        <span style={{ fontSize: '11px', color: '#B91C1C', fontWeight: 600 }}>Advertencia IA: {proposal.advertencia_ia}</span>
                    </div>
                </div>
            )}
        </div>
    );





}

export function QuotationInfoBar({ ticket }: { ticket: any }) {
    if (!ticket.partidas || ticket.partidas.length === 0 || ticket.estadoId === 'en_cotizacion') return null;

    const isEnviada = ticket.estadoId === 'cotizacion_enviada';

    // Cálculos de desglose
    const subtotalLocal = (ticket.montoFinal || 0) / 1.18;
    const igvLocal = (ticket.montoFinal || 0) - subtotalLocal;

    // Cálculo de rentabilidad
    const totalCosts = (ticket.costoManoObra || 0) + (ticket.costoMateriales || 0);
    const profit = (ticket.montoFinal || 0) - totalCosts;
    const margin = ticket.montoFinal > 0 ? (profit / ticket.montoFinal) * 100 : 0;

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
                    <span className={styles.infoValue} style={{ fontSize: '10px' }}>SUB: {subtotalLocal.toLocaleString('es-PE', { minimumFractionDigits: 2 })}</span>
                    <span className={styles.infoValue} style={{ fontSize: '10px' }}>IGV: {igvLocal.toLocaleString('es-PE', { minimumFractionDigits: 2 })}</span>
                </div>
            </div>

            <div className={styles.infoItem}>
                <span className={styles.infoLabel}>Total General</span>
                <span className={styles.infoValue} style={{ fontSize: '14px', fontWeight: '800', color: '#15803D' }}>
                    S/ {ticket.montoFinal?.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                </span>
            </div>

            <div className={styles.infoItem}>
                <span className={styles.infoLabel}>Rentabilidad</span>
                <div style={{
                    padding: '2px 8px',
                    background: margin >= 55 ? '#DCFCE7' : margin >= 45 ? '#FEF3C7' : '#FEE2E2',
                    color: margin >= 55 ? '#166534' : margin >= 45 ? '#92400E' : '#991B1B',
                    borderRadius: '12px',
                    fontSize: '11px',
                    fontWeight: '800',
                    border: '1px solid currentColor',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                }}>
                    {margin < 0 && <span>🚨 PERDIDA</span>}
                    {margin.toFixed(1)}%
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
                                ⚠️ AJUSTADA: S/ {ticket.montoFinal?.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                            </span>
                            {ticket.montoOriginal && (
                                <span style={{ fontSize: '9px', color: '#94A3B8', textDecoration: 'line-through' }}>
                                    Antes: S/ {ticket.montoOriginal.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                                </span>
                            )}
                        </div>
                    </div>
                )
            }
        </div >
    );
}

interface FinancialLiquidationBarProps {
    ticket: any;
}

export function UnifiedEvidenceBar({ ticket }: { ticket: any }) {
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
                                <img src={ev.url} alt="Cliente" className={styles.thumbImage} />
                                <div className={styles.largePreview}>
                                    <img src={ev.url} alt="Vista ampliada" />
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
                                <img src={ev.url} alt="Inspección" className={styles.thumbImage} />
                                <div className={styles.largePreview}>
                                    <img src={ev.url} alt="Vista ampliada" />
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
                                <img src={ev.url} alt="Ejecución" className={styles.thumbImage} />
                                <div className={styles.largePreview}>
                                    <img src={ev.url} alt="Vista ampliada" />
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
}

export function DocumentationSummaryBar({ ticket }: { ticket: any }) {
    // Solo mostrar si hay documentos validados y estamos en estados avanzados
    const hasDocs = ticket.documentosValidados;
    if (!hasDocs) return null;

    const visibleStates = ["por_liquidar", "ticket_cerrado"];
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
}


export function FinancialLiquidationBar({ ticket }: FinancialLiquidationBarProps) {
    const [viewingVoucher, setViewingVoucher] = useState<string | null>(null);

    // Si no hay monto final ni costos base, no hay nada que liquidar aún
    if (!ticket.montoFinal && !ticket.montoTotalCotizado && !ticket.costoManoObra) return null;

    const costoReferencia = (parseFloat(ticket.costoManoObra || 0) + parseFloat(ticket.costoMateriales || 0));
    const montoTotalCliente = ticket.montoFinal || ticket.montoTotalCotizado || 0;

    // Sumar todos los depÓsitos realizados al técnico
    const totalPagadoTecnico = (ticket.historialPagosTecnico || []).reduce((sum: number, p: any) => sum + p.monto, 0);
    const montoAdelanto = totalPagadoTecnico || ticket.montoAdelanto || 0;
    const pctReal = (montoAdelanto / (costoReferencia || 1)) * 100;

    // RECTIFICACIÓN: El saldo pendiente es sobre lo que se le debe pagar al TÉCNICO (Costo Referencia)
    const montoSaldo = costoReferencia - totalPagadoTecnico;

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
                <span className={styles.infoLabel}>Presupuesto Cliente</span>
                <span className={styles.infoValue} style={{ color: '#1E293B', fontWeight: 900 }}>
                    S/ {montoTotalCliente.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                </span>
            </div>

            <div className={styles.infoItem} style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'flex-start' }}>
                <span className={styles.infoLabel}>Historial de DepÓsitos ({pctReal.toFixed(0)}%)</span>
                {(ticket.historialPagosTecnico && ticket.historialPagosTecnico.length > 0) ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        {ticket.historialPagosTecnico.map((p: any, idx: number) => (
                            <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ fontSize: '10px', color: '#B45309', fontWeight: 700, whiteSpace: 'nowrap' }}>
                                    {idx + 1}º S/ {p.monto.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                                </span>
                                <span style={{ fontSize: '9px', color: '#B45309', opacity: 0.7, fontWeight: 600 }}>
                                    ({new Date(p.fecha).toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit' })})
                                </span>
                                {(p.voucher || p.voucherRef) && (
                                    <button
                                        onClick={() => {
                                            const src = p.voucher
                                                || (p.voucherRef?.startsWith('data:image') ? p.voucherRef : localStorage.getItem(p.voucherRef) || p.voucherRef || '');
                                            if (src) setViewingVoucher(src);
                                        }}
                                        style={{ background: 'transparent', border: 'none', padding: 0, display: 'flex', alignItems: 'center', cursor: 'pointer', color: '#6366F1' }}
                                        title="Ver Voucher"
                                    >
                                        <Eye size={12} />
                                    </button>
                                )}
                                <CheckCircle2 size={10} color="#059669" />
                            </div>
                        ))}
                    </div>
                ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span className={styles.infoValue} style={{ color: ticket.adelantoPagado ? '#059669' : '#DC2626' }}>
                            S/ {montoAdelanto.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                        </span>
                        {ticket.adelantoPagado ? (
                            <CheckCircle2 size={12} color="#059669" />
                        ) : (
                            <Clock size={12} color="#F59E0B" />
                        )}
                    </div>
                )}
            </div>

            <div className={styles.infoItem}>
                <span className={styles.infoLabel}>2. Saldo Técnico</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span className={styles.infoValue} style={{ color: ticket.estadoId === 'ticket_cerrado' ? '#059669' : '#1E293B' }}>
                        S/ {montoSaldo.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                    </span>
                    {ticket.estadoId === 'ticket_cerrado' ? (
                        <CheckCircle2 size={12} color="#059669" />
                    ) : (
                        <Wallet size={12} color="#94A3B8" />
                    )}
                </div>
            </div>

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
}

// ─────────────────────────────────────────────────────────────────────────────
// PAYMENT HISTORY BAR — visible para Admin Y Gestora
// Muestra todos los pagos confirmados por el admin con vouchers
// ─────────────────────────────────────────────────────────────────────────────
export function PaymentHistoryBar({ ticket }: { ticket: any }) {
    const [viewingVoucher, setViewingVoucher] = useState<string | null>(null);

    const pagos: any[] = ticket.historialPagosTecnico || [];
    if (pagos.length === 0) return null;

    const totalPagado = pagos.reduce((sum: number, p: any) => sum + (p.monto || 0), 0);

    const getTipoBadge = (tipo: string) => {
        const map: Record<string, { bg: string; color: string; label: string }> = {
            'Adelanto': { bg: '#DBEAFE', color: '#1D4ED8', label: 'Adelanto' },
            'Refuerzo': { bg: '#FEF3C7', color: '#92400E', label: 'Refuerzo' },
            'Liquidación Final': { bg: '#D1FAE5', color: '#065F46', label: 'Liquidación' },
            'Movilidad / Visita': { bg: '#EDE9FE', color: '#5B21B6', label: 'Movilidad' },
        };
        return map[tipo] || { bg: '#F1F5F9', color: '#475569', label: tipo || 'Pago' };
    };

    const resolveVoucher = (p: any): string => {
        if (p.voucher && p.voucher.startsWith('data:image')) return p.voucher;
        if (p.voucherRef) {
            if (p.voucherRef.startsWith('data:image')) return p.voucherRef;
            return localStorage.getItem(p.voucherRef) || p.voucherRef || '';
        }
        return '';
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
                        {pagos.length} depósito{pagos.length !== 1 ? 's' : ''} confirmado{pagos.length !== 1 ? 's' : ''}
                    </span>
                </div>
            </div>

            <div className={styles.verticalDivider} />

            {/* Lista de pagos */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {pagos.map((p: any, idx: number) => {
                    const badge = getTipoBadge(p.tipo);
                    const voucherSrc = resolveVoucher(p);
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
                            <span style={{ fontSize: '12px', fontWeight: 900, color: '#065F46' }}>
                                S/ {(p.monto || 0).toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                            </span>

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
                            {!voucherSrc && (
                                <span style={{ fontSize: '9px', color: '#CBD5E1', fontStyle: 'italic' }}>sin comprobante</span>
                            )}

                            <CheckCircle2 size={12} color="#10B981" style={{ flexShrink: 0 }} />
                        </div>
                    );
                })}

                {/* Total */}
                <div style={{
                    display: 'flex', justifyContent: 'flex-end', alignItems: 'center',
                    gap: '8px', paddingTop: '4px', borderTop: '1px dashed #BBF7D0', marginTop: '2px'
                }}>
                    <TrendingUp size={12} color="#059669" />
                    <span style={{ fontSize: '11px', color: '#059669', fontWeight: 700 }}>Total transferido:</span>
                    <span style={{ fontSize: '13px', fontWeight: 900, color: '#065F46' }}>
                        S/ {totalPagado.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
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
}

interface TicketSummaryProps {
    ticket: any;
    onProceed: () => void;
}

export function TicketSummary({ ticket, onProceed }: TicketSummaryProps) {
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
            <FinancialLiquidationBar ticket={ticket} />
            <PaymentHistoryBar ticket={ticket} />
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
}