"use client";
import { useState, useCallback, useMemo, memo, useEffect } from "react";
import {
    X, Bot, CheckCircle2, AlertTriangle, Send, Sparkles,
    TrendingUp, TrendingDown, Clock, Target, Zap,
    ChevronRight, ChevronLeft, Award, Flame, AlertCircle, DollarSign, Scale, ShieldAlert
} from "lucide-react";
import { calculateTicketFinances } from "@/lib/calculations";
import styles from "./VirtualSecretaryFab.module.css";

// ─── Tipos ────────────────────────────────────────────────────────────────────
export interface GestoraMetrics {
    /** Total de tickets asignados a la gestora */
    totalTickets: number;
    /** Tickets en proceso activo (no cerrados, no borrador) */
    ticketsEnProceso: number;
    /** Tickets nuevos sin asignar técnico */
    ticketsNuevos: number;
    /** Tickets en revisión de admin */
    ticketsRevision: number;
    /** Tickets cerrados/liquidados */
    ticketsCerrados: number;
    /** Margen promedio de todos los tickets activos (%) */
    margenPromedio?: number;
    /** Nombre de la gestora para personalización */
    nombreGestora?: string;
}

interface VirtualSecretaryFabProps {
    mibancoClientId: string;
    clientId: string;
    clientTicketNumber?: string | null;
    isSantander?: boolean;
    onApplyTicketNumber: (value: string) => void;
    /** Métricas globales de la gestora — pre-computadas en page.tsx, sin red */
    gestoraMetrics?: GestoraMetrics;
    /** Margen % del ticket actual */
    margenTicketActual?: number;
    /** Monto MO pactado en el ticket actual */
    moTicketActual?: number;
    /** Estado actual del ticket */
    ticketStatusId?: string;
    /** Datos completos del ticket para auditoría financiera */
    ticketData?: any;
    /** Costos del ticket para recálculos */
    ticketCosts?: any[];
}

// ─── Tipos para auditoría financiera ──────────────────────────────────────────
interface FinancialAudit {
    reglaId: "deuda_cero" | "margen_saludable" | "formato_cliente";
    tipo: "alerta" | "bloqueo" | "ok";
    titulo: string;
    mensaje: string;
    valor?: number;
    umbral?: number;
    icono: React.ElementType;
    color: string;
    bgColor: string;
}

// ─── Constantes de estados y umbrales ────────────────────────────────────────
const MIBANCO_CLIENT_ID = "MIBANCO_ID"; // Se inyectará desde props
const STAGE_LIQUIDACION = 10; // Etapa "por_liquidar" según TICKET_STATE_ORDER
const STATES_CERRADO = ["ticket_cerrado", "cerrado", "liquidado"];
const STATES_POR_LIQUIDAR = ["por_liquidar", "requiere_revision_admin"];

// ─── Validador de formato MiBanco ────────────────────────────────────────────
function isValidMiBancoFormat(num?: string | null): boolean {
    if (!num || num.trim() === "") return false;
    if (num.startsWith("STD")) return /^STD\d{4}\.\d{2}$/.test(num);
    if (num.startsWith("#")) return true;
    return /^MB[A-Z0-9]{6}\.\d{2}$/.test(num);
}

// ─── Motor de Auditoría Financiera (Reglas de Vigilancia) ─────────────────────
/**
 * Auditoría en tiempo real del estado financiero del ticket.
 * NO usa invalidateQueries — todo se ejecuta localmente comparando estado.
 */
function ejecutarAuditoriaFinanciera(props: VirtualSecretaryFabProps): FinancialAudit[] {
    const {
        clientId,
        mibancoClientId,
        clientTicketNumber,
        ticketStatusId,
        ticketData,
        ticketCosts = []
    } = props;
    
    const alertas: FinancialAudit[] = [];
    const isMiBanco = clientId === mibancoClientId;
    const statusId = ticketStatusId || ticketData?.status_id || "";
    const estadoActual = statusId.toLowerCase();
    
    // ── Calcular finanzas frescas usando el motor oficial ─────────────────────
    const finanzas = calculateTicketFinances(ticketData, ticketCosts);
    const {
        netLaborBalance = 0,
        margenReal = 0,
        realProfitability = 0,
        pactedMO = 0,
        totalLaborConfirmed = 0
    } = finanzas;
    
    // =====================================================================
    // REGLA 1: DEUDA CERO
    // =====================================================================
    // Si el ticket está en estado "cerrado" o "por_liquidar" Y tiene saldo 
    // pendiente al técnico > 0, activar alerta de deuda.
    // =====================================================================
    const enEtapaCierre = STATES_CERRADO.includes(estadoActual) || 
                          STATES_POR_LIQUIDAR.includes(estadoActual);
    
    if (enEtapaCierre && netLaborBalance > 0.01) {
        alertas.push({
            reglaId: "deuda_cero",
            tipo: "alerta",
            titulo: "⚠️ Saldo Pendiente al Técnico",
            mensaje: `Detecté un saldo pendiente de S/ ${netLaborBalance.toFixed(2)} al técnico. La política de la empresa exige cerrar en deuda cero. Verifica si falta registrar algún depósito en la bandeja de Tesorería.`,
            valor: netLaborBalance,
            umbral: 0,
            icono: DollarSign,
            color: "#B45309",
            bgColor: "linear-gradient(135deg, #FFFBEB, #FEF3C7)"
        });
    }
    
    // =====================================================================
    // REGLA 2: MARGEN SALUDABLE
    // =====================================================================
    // Si la utilidad neta o el margen es <= 0% debido a excesos en MO 
    // o materiales, mostrar indicador de rentabilidad negativa.
    // =====================================================================
    if (margenReal <= 0 || realProfitability <= 0) {
        const mensajeRentabilidad = realProfitability < 0
            ? `Este servicio registra una PÉRDIDA de S/ ${Math.abs(realProfitability).toFixed(2)}. Los costos superan el ingreso.`
            : `Margen cero: el servicio no genera utilidad. El ingreso apenas cubre los costos.`;
        
        alertas.push({
            reglaId: "margen_saludable",
            tipo: "bloqueo",
            titulo: "📉 ¡Alerta de Rentabilidad!",
            mensaje: mensajeRentabilidad,
            valor: margenReal,
            umbral: 0,
            icono: TrendingDown,
            color: "#991B1B",
            bgColor: "linear-gradient(135deg, #FEF2F2, #FEE2E2)"
        });
    } else if (margenReal < 15 && margenReal > 0) {
        // Margen bajo pero positivo
        alertas.push({
            reglaId: "margen_saludable",
            tipo: "alerta",
            titulo: "📊 Margen Reducido",
            mensaje: `Rentabilidad ajustada: ${margenReal.toFixed(1)}%. Verifica si los costos de materiales o mano de obra están correctos.`,
            valor: margenReal,
            icono: Scale,
            color: "#D97706",
            bgColor: "linear-gradient(135deg, #FFF7ED, #FFEDD5)"
        });
    }
    
    // =====================================================================
    // REGLA 3: FORMATO DE CLIENTE (MIBANCO)
    // =====================================================================
    // Si el cliente es MIBANCO y el ticket avanza de la etapa 9 
    // (documentacion_enviada) sin un formato MB000000.26 válido, 
    // levantar bandera de bloqueo.
    // =====================================================================
    if (isMiBanco) {
        const etapaActual = getEtapaDesdeStatus(estadoActual);
        const avanzaDeEtapa9 = etapaActual > 9;
        const formatoValido = isValidMiBancoFormat(clientTicketNumber);
        
        if (avanzaDeEtapa9 && !formatoValido) {
            alertas.push({
                reglaId: "formato_cliente",
                tipo: "bloqueo",
                titulo: "🔒 Formato de Ticket Obligatorio",
                mensaje: `Este ticket necesita el código de MiBanco (formato MB000000.26) para avanzar a liquidación. Sin este código, el banco no procesará el cobro.`,
                icono: ShieldAlert,
                color: "#7C3AED",
                bgColor: "linear-gradient(135deg, #F5F3FF, #EDE9FE)"
            });
        }
    }
    
    return alertas;
}

/**
 * Obtiene el número de etapa desde el status_id para comparaciones.
 */
function getEtapaDesdeStatus(statusId: string): number {
    const ordenEstados: Record<string, number> = {
        'borrador': 0,
        'pendiente': 1, 'nuevo': 1,
        'tecnico_asignado': 2,
        'en_inspeccion': 3, 'visita_programada': 3,
        'visita_realizada': 4,
        'en_cotizacion': 5,
        'cotizacion_enviada': 6,
        'cotizacion_aprobada': 7,
        'en_ejecucion': 8,
        'documentacion_enviada': 9,
        'por_liquidar': 10, 'requiere_revision_admin': 10,
        'ticket_cerrado': 12,
        'vencido': 13,
        'ticket_rechazado': 14,
        'ticket_cancelado': 15
    };
    return ordenEstados[statusId.toLowerCase()] ?? 0;
}

// ─── Motor de consejos ────────────────────────────────────────────────────────
interface Consejo {
    tipo: "alerta" | "motivacion" | "tip" | "logro" | "cooperacion";
    icono: React.ElementType;
    titulo: string;
    mensaje: string;
    color: string;
    bgColor: string;
    accion?: {
        etiqueta: string;
        href: string;
    };
}

function generarConsejos(
    metrics: GestoraMetrics | undefined,
    margenActual: number | undefined,
    moActual: number | undefined,
    isMiBancoSinTicket: boolean
): Consejo[] {
    const consejos: Consejo[] = [];
    const nombre = metrics?.nombreGestora ? metrics.nombreGestora.split(" ")[0] : "Gestora";

    // 0. Balanceo proactivo de carga de trabajo (baja actividad)
    if (metrics && metrics.ticketsEnProceso < 3 && metrics.ticketsNuevos === 0) {
        consejos.push({
            tipo: "cooperacion",
            icono: Sparkles,
            titulo: "Apoyo de Equipo",
            mensaje: `¡Excelente ritmo, ${nombre}! Tu bandeja personal está ligera. Te sugerimos revisar el buzón global por nuevos servicios o brindar apoyo documentario a compañeros con alta carga (ej. Hugo).`,
            color: "#0D9488",
            bgColor: "linear-gradient(135deg, #F0FDFA, #CCFBF1)",
            accion: {
                etiqueta: "Ver tickets de Hugo",
                href: "/dashboard/admin/tickets?search=Hugo"
            }
        });
    }

    // 1. Alerta crítica MiBanco — prioridad máxima
    if (isMiBancoSinTicket) {
        consejos.push({
            tipo: "alerta",
            icono: AlertTriangle,
            titulo: "Acción bloqueante",
            mensaje: `${nombre}, este ticket no podrá cerrarse ni liquidarse sin el número de ticket de MiBanco. Regístralo ahora para evitar retrasos en el cobro.`,
            color: "#B45309",
            bgColor: "linear-gradient(135deg, #FFFBEB, #FEF3C7)",
        });
    }

    // 2. Tickets pendientes por cerrar
    if (metrics && metrics.ticketsEnProceso > 5) {
        consejos.push({
            tipo: "alerta",
            icono: Clock,
            titulo: "Cola alta de tickets",
            mensaje: `Tienes ${metrics.ticketsEnProceso} tickets activos en proceso. Intenta cerrar al menos 2 hoy. Los cierres rápidos mejoran tu índice de eficiencia semanal.`,
            color: "#B45309",
            bgColor: "linear-gradient(135deg, #FFF7ED, #FFEDD5)",
        });
    } else if (metrics && metrics.ticketsEnProceso > 2) {
        consejos.push({
            tipo: "tip",
            icono: Target,
            titulo: "Ritmo de cierre",
            mensaje: `Tienes ${metrics.ticketsEnProceso} tickets en proceso. Revisa cuáles están en "Documentación" — son los más cercanos al cierre y al cobro.`,
            color: "#0369A1",
            bgColor: "linear-gradient(135deg, #EFF6FF, #DBEAFE)",
        });
    }

    // 3. Tickets nuevos sin gestionar
    if (metrics && metrics.ticketsNuevos > 3) {
        consejos.push({
            tipo: "alerta",
            icono: AlertCircle,
            titulo: "Tickets sin técnico",
            mensaje: `Hay ${metrics.ticketsNuevos} tickets nuevos sin técnico asignado. Asígnales técnico cuanto antes para no perder tiempo de SLA y evitar reclamos del cliente.`,
            color: "#991B1B",
            bgColor: "linear-gradient(135deg, #FEF2F2, #FEE2E2)",
        });
    }

    // 4. Revisiones de admin pendientes
    if (metrics && metrics.ticketsRevision > 0) {
        consejos.push({
            tipo: "alerta",
            icono: AlertTriangle,
            titulo: "Esperando aprobación",
            mensaje: `${metrics.ticketsRevision} ticket${metrics.ticketsRevision > 1 ? "s están" : " está"} congelado${metrics.ticketsRevision > 1 ? "s" : ""} por exceso de presupuesto. Coordina con el administrador para desbloquearlos y avanzar a liquidación.`,
            color: "#7C3AED",
            bgColor: "linear-gradient(135deg, #F5F3FF, #EDE9FE)",
        });
    }

    // 5. Margen del ticket actual bajo
    if (margenActual !== undefined && margenActual < 40 && margenActual > 0) {
        consejos.push({
            tipo: "alerta",
            icono: TrendingDown,
            titulo: "Margen bajo en este ticket",
            mensaje: `Este ticket tiene solo un ${margenActual.toFixed(1)}% de margen. Revisa si el costo de mano de obra puede optimizarse — un margen saludable debe superar el 50%.`,
            color: "#B45309",
            bgColor: "linear-gradient(135deg, #FFFBEB, #FEF3C7)",
        });
    } else if (margenActual !== undefined && margenActual < 0) {
        consejos.push({
            tipo: "alerta",
            icono: TrendingDown,
            titulo: "¡Ticket en pérdida!",
            mensaje: `Este ticket está generando pérdida (${margenActual.toFixed(1)}%). Revisa inmediatamente el costo pactado con el técnico versus el ingreso aprobado.`,
            color: "#991B1B",
            bgColor: "linear-gradient(135deg, #FEF2F2, #FEE2E2)",
        });
    }

    // 6. MO muy alta vs ingreso
    if (moActual && moActual > 0 && margenActual !== undefined && margenActual >= 0 && margenActual < 30) {
        consejos.push({
            tipo: "tip",
            icono: Zap,
            titulo: "Costo de MO elevado",
            mensaje: `El pago al técnico representa una parte grande del ingreso. Para el próximo servicio similar, evalúa negociar tarifas por zona o por tipo de servicio para mejorar la utilidad.`,
            color: "#0369A1",
            bgColor: "linear-gradient(135deg, #EFF6FF, #DBEAFE)",
        });
    }

    // 7. Margen promedio de todos los tickets bajo
    if (metrics?.margenPromedio !== undefined && metrics.margenPromedio < 45) {
        consejos.push({
            tipo: "tip",
            icono: TrendingDown,
            titulo: "Rentabilidad global baja",
            mensaje: `Tu margen promedio de tickets es ${metrics.margenPromedio.toFixed(1)}%. El objetivo es superar el 50%. Revisa los tickets con mayor costo de técnico y negocia tarifas más competitivas.`,
            color: "#B45309",
            bgColor: "linear-gradient(135deg, #FFF7ED, #FFEDD5)",
        });
    }

    // 8. Motivación por buenos cierres
    if (metrics && metrics.ticketsCerrados >= 5) {
        consejos.push({
            tipo: "logro",
            icono: Award,
            titulo: `¡${nombre}, excelente gestión!`,
            mensaje: `Has cerrado ${metrics.ticketsCerrados} tickets este periodo. Tu ritmo de cierre está por encima del promedio. ¡Sigue así! Cada liquidación puntual fortalece la relación con el cliente.`,
            color: "#065F46",
            bgColor: "linear-gradient(135deg, #ECFDF5, #D1FAE5)",
        });
    }

    // 9. Consejo general si todo está bien
    if (consejos.length === 0) {
        consejos.push({
            tipo: "motivacion",
            icono: Flame,
            titulo: `¡Todo en orden, ${nombre}!`,
            mensaje: `Tu gestión se ve saludable. Recuerda revisar el estado de cada ticket antes de cerrar tu jornada. Una documentación completa evita reclamaciones posteriores.`,
            color: "#7C3AED",
            bgColor: "linear-gradient(135deg, #F5F3FF, #EDE9FE)",
        });
    }

    // Máximo 4 consejos para no saturar
    return consejos.slice(0, 4);
}

// ─── Componente principal ─────────────────────────────────────────────────────
function VirtualSecretaryFab({
    mibancoClientId,
    clientId,
    clientTicketNumber,
    isSantander = false,
    onApplyTicketNumber,
    gestoraMetrics,
    margenTicketActual,
    moTicketActual,
}: VirtualSecretaryFabProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [inputValue, setInputValue] = useState("");
    const [saved, setSaved] = useState(false);
    const [consejoIdx, setConsejoIdx] = useState(0);

    const isMiBanco = clientId === mibancoClientId && !isSantander;
    const hasValidTicket = isValidMiBancoFormat(clientTicketNumber);
    const isMiBancoSinTicket = isMiBanco && !hasValidTicket;

    // ─── Auditoría Financiera en Tiempo Real ─────────────────────────────────────
    // Se ejecuta localmente sin invalidateQueries, comparando estado actual.
    // Usa useMemo para evitar re-renderizados innecesarios.
    // =====================================================================
    const alertasFinancieras = useMemo(() => {
        if (!ticketData || !ticketCosts) return [];
        return ejecutarAuditoriaFinanciera({
            clientId,
            mibancoClientId,
            clientTicketNumber,
            isSantander,
            onApplyTicketNumber,
            gestoresMetrics,
            margenTicketActual,
            moTicketActual,
            ticketStatusId,
            ticketData,
            ticketCosts
        });
    }, [
        ticketData, 
        ticketCosts, 
        clientId, 
        mibancoClientId, 
        clientTicketNumber, 
        ticketStatusId,
        margenTicketActual,
        moTicketActual
    ]);
    
    // Combinar alertas financieras con consejos operativos
    const hayAlertasFinancieras = alertasFinancieras.length > 0;
    
    // Alerta si hay ticket sin registrar O hay problemas de productividad críticos O alertas financieras
    const hasCriticalProductivity =
        (gestoraMetrics?.ticketsRevision ?? 0) > 0 ||
        (gestoraMetrics?.ticketsNuevos ?? 0) > 3 ||
        (margenTicketActual !== undefined && margenTicketActual < 0);

    const isAlert = isMiBancoSinTicket || hasCriticalProductivity || hayAlertasFinancieras;

    // Generar consejos — memoizado, sin red
    const consejos = useMemo(
        () => generarConsejos(gestoraMetrics, margenTicketActual, moTicketActual, isMiBancoSinTicket),
        [gestoraMetrics, margenTicketActual, moTicketActual, isMiBancoSinTicket]
    );

    // Combinar alertas financieras y consejos operativos
    const alertasYConsejos = useMemo(() => {
        return [...alertasFinancieras.map(a => ({
            tipo: a.tipo as any,
            icono: a.icono,
            titulo: a.titulo,
            mensaje: a.mensaje,
            color: a.color,
            bgColor: a.bgColor,
            esAuditoria: true
        })), ...consejos];
    }, [alertasFinancieras, consejos]);

    const consejo = alertasYConsejos[consejoIdx] ?? alertasYConsejos[0];
    const IconoConsejo = consejo?.icono ?? Bot;

    const togglePanel = useCallback(() => {
        setIsOpen((prev) => !prev);
        setSaved(false);
        setInputValue("");
        setConsejoIdx(0);
    }, []);

    const handleApply = useCallback(() => {
        const cleaned = inputValue.trim().toUpperCase();
        if (!cleaned) return;
        onApplyTicketNumber(cleaned);
        setSaved(true);
        setInputValue("");
        setTimeout(() => {
            setIsOpen(false);
            setSaved(false);
        }, 1800);
    }, [inputValue, onApplyTicketNumber]);

    const handleKeyDown = useCallback(
        (e: React.KeyboardEvent<HTMLInputElement>) => {
            if (e.key === "Enter") handleApply();
            if (e.key === "Escape") setIsOpen(false);
        },
        [handleApply]
    );

    const nextConsejo = useCallback(() => {
        setConsejoIdx((i) => (i + 1) % alertasYConsejos.length);
    }, [alertasYConsejos.length]);

    const prevConsejo = useCallback(() => {
        setConsejoIdx((i) => (i - 1 + alertasYConsejos.length) % alertasYConsejos.length);
    }, [alertasYConsejos.length]);

    const currentInputValid = isValidMiBancoFormat(inputValue.trim() || undefined);

    return (
        <>
            {/* ── Panel expandible ───────────────────────── */}
            {isOpen && (
                <div className={styles.panel}>
                    {/* Cabecera */}
                    <div
                        className={`${styles.panelHeader} ${
                            isAlert ? styles.panelHeaderAlert : styles.panelHeaderIdle
                        }`}
                    >
                        <div
                            className={`${styles.panelAvatarWrap} ${
                                isAlert ? styles.panelAvatarWrapAlert : styles.panelAvatarWrapIdle
                            }`}
                        >
                            {isAlert ? <AlertTriangle size={17} color="#fff" /> : <Bot size={17} color="#fff" />}
                        </div>
                        <div className={styles.panelTitleGroup}>
                            <p className={styles.panelTitle}>Secretario Virtual</p>
                            <p className={styles.panelSubtitle}>
                                {hayAlertasFinancieras 
                                    ? `${alertasFinancieras.length} ${alertasFinancieras.length === 1 ? "alerta" : "alertas"} financiera${alertasFinancieras.length === 1 ? "" : "s"} detectada${alertasFinancieras.length === 1 ? "" : "s"}`
                                    : `${consejos.length} ${consejos.length === 1 ? "consejo" : "consejos"} para ti hoy`
                                }
                            </p>
                        </div>
                        <button className={styles.panelCloseBtn} onClick={togglePanel} aria-label="Cerrar">
                            <X size={15} />
                        </button>
                    </div>

                    {/* ── Tarjeta de consejo actual ─────────────── */}
                    {consejo && (
                        <div className={styles.panelBody}>
                            <div
                                className={styles.consejoCard}
                                style={{ background: consejo.bgColor }}
                            >
                                {/* Header del consejo */}
                                <div className={styles.consejoHeader}>
                                    <div
                                        className={styles.consejoIconWrap}
                                        style={{ background: consejo.color }}
                                    >
                                        <IconoConsejo size={15} color="#fff" />
                                    </div>
                                    <p className={styles.consejoTitulo} style={{ color: consejo.color }}>
                                        {consejo.titulo}
                                    </p>
                                    <span
                                        className={styles.consejoBadge}
                                        style={{
                                            background: consejo.color + "22",
                                            color: consejo.color,
                                            border: `1px solid ${consejo.color}44`,
                                        }}
                                    >
                                        {consejo.tipo === "alerta" && "⚠ Alerta"}
                                        {consejo.tipo === "tip" && "💡 Consejo"}
                                        {consejo.tipo === "motivacion" && "🎯 Motivación"}
                                        {consejo.tipo === "logro" && "🏆 Logro"}
                                        {consejo.tipo === "cooperacion" && "🤝 Cooperación"}
                                    </span>
                                </div>

                                {/* Mensaje */}
                                <p className={styles.consejoMensaje}>{consejo.mensaje}</p>

                                {/* Acción sugerida */}
                                {consejo.accion && (
                                    <div style={{ marginTop: '12px', textAlign: 'right' }}>
                                        <a 
                                            href={consejo.accion.href}
                                            style={{
                                                backgroundColor: consejo.color,
                                                color: '#fff',
                                                padding: '6px 14px',
                                                borderRadius: '6px',
                                                fontSize: '12px',
                                                fontWeight: 600,
                                                textDecoration: 'none',
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                gap: '6px',
                                                transition: 'opacity 0.2s'
                                            }}
                                            onMouseEnter={(e) => e.currentTarget.style.opacity = '0.9'}
                                            onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
                                        >
                                            {consejo.accion.etiqueta} <ChevronRight size={14} />
                                        </a>
                                    </div>
                                )}
                            </div>

                            {/* Paginación de consejos y alertas financieras */}
                            {alertasYConsejos.length > 1 && (
                                <div className={styles.consejoPagination}>
                                    <button
                                        className={styles.consejoNavBtn}
                                        onClick={prevConsejo}
                                        disabled={consejoIdx === 0}
                                        aria-label="Consejo anterior"
                                    >
                                        <ChevronLeft size={14} />
                                    </button>
                                    <div className={styles.consejoDots}>
                                        {alertasYConsejos.map((_, i) => (
                                            <button
                                                key={i}
                                                className={`${styles.consejoDot} ${i === consejoIdx ? styles.consejoDotActive : ""}`}
                                                onClick={() => setConsejoIdx(i)}
                                                aria-label={`Ir al ${i < alertasFinancieras.length ? "alerta" : "consejo"} ${i + 1}`}
                                            />
                                        ))}
                                    </div>
                                    <button
                                        className={styles.consejoNavBtn}
                                        onClick={nextConsejo}
                                        disabled={consejoIdx === alertasYConsejos.length - 1}
                                        aria-label="Siguiente"
                                    >
                                        <ChevronRight size={14} />
                                    </button>
                                </div>
                            )}

                            {/* ── Input rápido de ticket MiBanco ─── */}
                            {isMiBancoSinTicket && !saved && (
                                <div className={styles.quickInputWrap}>
                                    <span className={styles.quickInputLabel}>Registrar número MiBanco</span>
                                    <div className={styles.quickInputRow}>
                                        <input
                                            className={styles.quickInput}
                                            type="text"
                                            placeholder="MB000000.26"
                                            value={inputValue}
                                            onChange={(e) => setInputValue(e.target.value)}
                                            onKeyDown={handleKeyDown}
                                            maxLength={15}
                                            autoFocus
                                            spellCheck={false}
                                            autoComplete="off"
                                        />
                                        <button
                                            className={`${styles.quickInputBtn} ${styles.quickInputBtnAlert}`}
                                            onClick={handleApply}
                                            disabled={!inputValue.trim()}
                                        >
                                            <Send size={13} />
                                            Guardar
                                        </button>
                                    </div>
                                    {inputValue.trim() && (
                                        currentInputValid ? (
                                            <span className={styles.validBadge}>
                                                <CheckCircle2 size={12} /> Formato válido ✓
                                            </span>
                                        ) : (
                                            <p className={`${styles.formatHint} ${styles.formatHintAlert}`}>
                                                Formato esperado: MB123ABC.26
                                            </p>
                                        )
                                    )}
                                    {!inputValue.trim() && (
                                        <p className={styles.formatHint}>
                                            Formato: MB[6 chars].[2 dígitos]
                                        </p>
                                    )}
                                </div>
                            )}

                            {saved && (
                                <div className={styles.ticketOkBanner}>
                                    <CheckCircle2 size={16} color="#059669" />
                                    <p className={styles.ticketOkBannerText}>Ticket registrado correctamente</p>
                                </div>
                            )}

                            {isMiBanco && hasValidTicket && !isMiBancoSinTicket && (
                                <div className={styles.ticketOkBanner}>
                                    <CheckCircle2 size={16} color="#059669" />
                                    <p className={styles.ticketOkBannerText}>
                                        {clientTicketNumber} — Listo para liquidar
                                    </p>
                                </div>
                            )}

                            {/* Resumen rápido de métricas */}
                            {gestoraMetrics && (
                                <div className={styles.metricsRow}>
                                    <div className={styles.metricChip}>
                                        <span className={styles.metricVal}>{gestoraMetrics.ticketsEnProceso}</span>
                                        <span className={styles.metricLbl}>En proceso</span>
                                    </div>
                                    <div className={styles.metricChip}>
                                        <span className={styles.metricVal}>{gestoraMetrics.ticketsCerrados}</span>
                                        <span className={styles.metricLbl}>Cerrados</span>
                                    </div>
                                    {gestoraMetrics.margenPromedio !== undefined && (
                                        <div
                                            className={styles.metricChip}
                                            style={{
                                                background: gestoraMetrics.margenPromedio >= 50
                                                    ? "#ECFDF5"
                                                    : "#FFF7ED",
                                                borderColor: gestoraMetrics.margenPromedio >= 50
                                                    ? "#A7F3D0"
                                                    : "#FDE68A",
                                            }}
                                        >
                                            <span
                                                className={styles.metricVal}
                                                style={{
                                                    color: gestoraMetrics.margenPromedio >= 50
                                                        ? "#047857"
                                                        : "#B45309",
                                                }}
                                            >
                                                {gestoraMetrics.margenPromedio.toFixed(0)}%
                                            </span>
                                            <span className={styles.metricLbl}>Margen prom.</span>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Footer */}
                    <div className={styles.panelFooter}>
                        <TrendingUp size={10} color="#CBD5E1" />
                        <span className={styles.panelFooterText}>Secretario Virtual · CorpFlow SFMAC</span>
                        <TrendingUp size={10} color="#CBD5E1" />
                    </div>
                </div>
            )}

            {/* ── Botón FAB ──────────────────────────────── */}
            <button
                className={`${styles.fab} ${isAlert ? styles.fabAlert : styles.fabIdle}`}
                onClick={togglePanel}
                aria-label={isAlert ? "Alerta: ver consejos del secretario" : "Abrir secretario virtual"}
                title={
                    isAlert
                        ? `⚠ Tienes ${consejos.length} alertas pendientes`
                        : "Secretario Virtual — Copiloto operativo"
                }
            >
                {isAlert && !isOpen && <span className={styles.fabRing} />}
                {isAlert && (
                    <span className={styles.fabDot}>
                        {consejos.length > 1 && (
                            <span className={styles.fabDotCount}>{consejos.length}</span>
                        )}
                    </span>
                )}
                {isAlert ? <AlertTriangle size={20} color="#fff" /> : <Sparkles size={19} color="#fff" />}
            </button>
        </>
    );
}

export default memo(VirtualSecretaryFab);
