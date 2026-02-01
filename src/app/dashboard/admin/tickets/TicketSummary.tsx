"use client";

import { FileText, MapPin, User, ArrowRight, Calendar, RefreshCw, Edit2, Stethoscope, CreditCard, Image as ImageIcon, Clock, DollarSign, Scale, CheckCircle2, Wallet, Coins, ClipboardCheck, ShieldCheck, FileSpreadsheet } from "lucide-react";
import { getServiceById } from "@/lib/serviceTypes";
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
                                        <img src={evidencia.url} alt="Evidencia" className={styles.thumbImage} />
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

            {ticket.costoVisita > 0 && (
                <div className={styles.infoItem}>
                    <span className={styles.infoLabel}>Costo Visita</span>
                    <span className={styles.infoValue}>S/ {ticket.costoVisita.toFixed(2)}</span>
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
                    background: margin >= 80 ? '#DCFCE7' : margin >= 70 ? '#FEF3C7' : '#FEE2E2',
                    color: margin >= 80 ? '#166534' : margin >= 70 ? '#92400E' : '#991B1B',
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

    // Solo mostrar esta barra unificada en estados avanzados de liquidación o cierre
    const visibleStates = ["documentacion_enviada", "por_liquidar", "ticket_cerrado"];
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
    // Si no hay monto final ni costos base, no hay nada que liquidar aún
    if (!ticket.montoFinal && !ticket.montoTotalCotizado && !ticket.costoManoObra) return null;

    const costoReferencia = (parseFloat(ticket.costoManoObra || 0) + parseFloat(ticket.costoMateriales || 0));
    const montoTotalCliente = ticket.montoFinal || ticket.montoTotalCotizado || 0;

    // Sumar todos los depósitos realizados al técnico
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
                <span className={styles.infoLabel}>Historial de Depósitos ({pctReal.toFixed(0)}%)</span>
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
            <QuotationInfoBar ticket={ticket} />
            <FinancialLiquidationBar ticket={ticket} />
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
