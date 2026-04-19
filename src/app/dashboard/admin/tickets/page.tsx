"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Plus, Filter, Search, Clock, CheckCircle2, Zap, Sparkles, ArrowRight, MapPin, AlertCircle, FileEdit, AlertTriangle } from "lucide-react";
import CreateTicketWizard from "./CreateTicketWizard";
import TicketWindow from "./TicketWindow";
import styles from "./page.module.css";
import { getServiceById } from "@/lib/serviceTypes";
import { TICKET_STATES, normalizeStateId, getStateColor } from "@/lib/ticketStates";
import { useAppData } from "@/lib/AppDataContext";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { prefetchTickets } from "@/lib/useQueryHooks";


// Hook para calcular tiempo transcurrido
const useTicketAge = (createdAt: string) => {
    const [timeRemaining, setTimeRemaining] = useState("");
    const [slaStatus, setSlaStatus] = useState<"ok" | "warning" | "critical" | "expired">("ok");
    const SLA_HOURS = 72;

    useEffect(() => {
        const updateTime = () => {
            const created = new Date(createdAt);
            const now = new Date();
            const slaLimit = new Date(created.getTime() + (SLA_HOURS * 60 * 60 * 1000));
            const diff = slaLimit.getTime() - now.getTime();

            const hours = Math.floor(Math.abs(diff) / (1000 * 60 * 60));
            const minutes = Math.floor((Math.abs(diff) % (1000 * 60 * 60)) / (1000 * 60));

            if (diff > 0) {
                setTimeRemaining(`${hours}h ${minutes}m`);

                // Alertas de proximidad
                const hoursPassed = SLA_HOURS - hours;
                if (hoursPassed >= 60) {
                    setSlaStatus("critical"); // Faltan < 12h
                } else if (hoursPassed >= 48) {
                    setSlaStatus("warning"); // Faltan < 24h
                } else {
                    setSlaStatus("ok");
                }
            } else {
                setTimeRemaining(`Expirado (${hours}h ${minutes}m)`);
                setSlaStatus("expired");
            }
        };

        updateTime();
        const interval = setInterval(updateTime, 60000);

        return () => clearInterval(interval);
    }, [createdAt]);

    return { timeRemaining, slaStatus };
};

export default function TicketsPage() {
    // Usar contexto global de datos (Realtime compartido entre módulos)
    const { tickets, loadingTickets, createTicket, updateTicket, refreshTickets } = useAppData();
    const queryClient = useQueryClient();
    const [showWizard, setShowWizard] = useState(false);
    const [openTickets, setOpenTickets] = useState<any[]>([]);
    // ── GESTORA RESOLUTION Y ROLES ─────────────────────────────
    const [searchTerm, setSearchTerm] = useState("");
    const [viewMode, setViewMode] = useState<"triage" | "active" | "closed">("active");
    const [statFilter, setStatFilter] = useState<"all" | "nuevos" | "enProceso" | "revision">("all");
    const [myGestoraId, setMyGestoraId] = useState<string | null>(null);
    const [isAdminState, setIsAdminState] = useState<boolean>(false);


    const fetchGestora = useCallback(async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            const rawEmail = user?.email || localStorage.getItem('userEmail');
            if (!rawEmail) return;

            const userEmail = rawEmail.toLowerCase();
            const userRole = (localStorage.getItem('userRole') || '').toUpperCase();
            if (userRole === 'SUPERADMIN' || userRole === 'ADMIN') {
                setIsAdminState(true);
            }

            // REVISIÓN DE GESTORAS
            const { data: g } = await supabase.from('gestoras').select('id, name, email').ilike('email', userEmail).maybeSingle();
            if (g?.id) {
                setMyGestoraId(g.id);
            }

            // REVISIÓN DE ROL EN PERFILES (Independiente de si es gestora o no)
            const { data: p } = await supabase.from('perfiles').select('id, rol').ilike('email', userEmail).maybeSingle();
            if (p) {
                const normalizedRole = (p.rol || '').toUpperCase();
                if (normalizedRole === 'SUPERADMIN' || normalizedRole === 'ADMIN') {
                    setIsAdminState(true);
                }
                if (!g?.id && p.id) {
                    setMyGestoraId(p.id);
                }
            }
        } catch (error) {
            console.error("Error fetching gestora context:", error);
        }
    }, [queryClient]);

    useEffect(() => {
        fetchGestora();
    }, [fetchGestora]);

    const isVisibleForMe = useCallback((t: any) => {
        // REGLA 0: Admin ve TODO (Prioridad absoluta)
        if (isAdminState) return true;

        // REGLA 1: Identidad requerida para filtros no-admin
        if (!myGestoraId) return false;

        const ticketSid = normalizeStateId(t.estadoId);

        // REGLA 2: Si el ticket tiene una GESTORA DIRECTA ya asignada
        const assignedGestoraId = t.gestora_id || t.metadata?.gestora_id;
        if (assignedGestoraId) {
            return assignedGestoraId === myGestoraId;
        }

        // CASCADA (Solo si no hay gestora directa): ¿A quién le toca tomarlo?
        // 1. Asignación por Sede (Branch)
        if (t.branch_offices?.gestora_asignada_id === myGestoraId) return true;

        // 2. Asignación por Zona (Cascada 1)
        if (t.branch_offices?.zonas?.gestora_asignada_id === myGestoraId) return true;

        // 3. Asignación por Cliente o Sede-Cliente (Cascada 2)
        if (t.clients?.gestora_asignada_id === myGestoraId || 
            t.branch_offices?.clients?.gestora_asignada_id === myGestoraId) {
            return true;
        }

        return false;
    }, [myGestoraId, isAdminState]);

    const filterByView = useCallback((t: any, mode: string) => {
        const sid = normalizeStateId(t.estadoId);
        const term = searchTerm.toLowerCase();
        const matchesSearch = !searchTerm ||
            t.id.toLowerCase().includes(term) ||
            (t.numeroTicketCliente || '').toLowerCase().includes(term) ||
            (t.cliente?.nombre || '').toLowerCase().includes(term) ||
            (t.sede?.nombre || '').toLowerCase().includes(term) ||
            (t.tecnico?.nombre || '').toLowerCase().includes(term);

        if (!matchesSearch) return false;

        const isClosed = ["ticket_cerrado", "ticket_rechazado", "ticket_cancelado"].includes(sid);
        const isBorrador = sid === "borrador";

        if (mode === "triage") return isBorrador;
        if (mode === "active") return !isBorrador && !isClosed;
        if (mode === "closed") return isClosed;

        return true;
    }, [searchTerm]);


    const handleCreateTicket = async (newTicket: any) => {
        await createTicket(newTicket);
        await refreshTickets();
    };

    // 🚀 LÓgica de Limpieza de Tickets (One-time)
    useEffect(() => {
        const shouldCleanup = new URLSearchParams(window.location.search).get('cleanup');
        if (shouldCleanup === 'tickets') {
            console.log("Iniciando limpieza de tickets...");
            localStorage.removeItem("tickets");
            localStorage.removeItem("open_tickets");
            localStorage.removeItem("ticket_draft");

            // Eliminar estados individuales de tickets
            Object.keys(localStorage).forEach(key => {
                if (key.startsWith('ticket_state_')) {
                    localStorage.removeItem(key);
                }
            });

            alert("Los tickets han sido eliminados del sistema. El sistema se reiniciará.");
            window.location.href = window.location.pathname; // Quitar el query param
        }
    }, []);

    const handleOpenTicket = (ticket: any) => {
        if (typeof window !== 'undefined') {
            // 🚀 REGLA DE ORO: Si el usuario hace clic en la tarjeta, quiere VER el ticket.
            // Forzamos el estado persistido a NO MINIMIZADO antes de montar la ventana.
            const saved = localStorage.getItem(`ticket_state_${ticket.id}`);
            if (saved) {
                try {
                    const parsed = JSON.parse(saved);
                    localStorage.setItem(`ticket_state_${ticket.id}`, JSON.stringify({
                        ...parsed,
                        isMinimized: false,
                        isMaximized: true
                    }));
                } catch (e) {
                    console.error("Error resetting window state on open:", e);
                }
            }
        }

        if (!openTickets.find(t => t.id === ticket.id)) {
            setOpenTickets([...openTickets, ticket]);
        } else {
            // Si ya está abierta, avisar a la ventana que se maximice/traiga al frente
            window.dispatchEvent(new CustomEvent('ticket-reopen', { detail: { ticketId: ticket.id } }));
        }
    };

    // 🛠️ REPARACIÓN/SINCRONIZACIÓN AUTOMÁTICA
    // Eliminada la sincronización local forzada, ahora se usa normalización en el hook useTickets
    // para asegurar que los datos de Supabase sean compatibles con la UI.

    // Eliminada la sincronización local forzada, ahora se usa normalización en el hook useTickets
    const ticketsForMe = React.useMemo(() => {
        return (tickets || []).filter(isVisibleForMe);
    }, [tickets, isVisibleForMe]);

    // Estado inicial de cada ticket: "nuevo" o "asignado_a_tecnico" o estados de inicio de proceso
    const NUEVOS_STATES = ["nuevo", "pendiente", "asignado_a_tecnico"];
    const EN_PROCESO_STATES = ["en_inspeccion", "en_cotizacion", "cotizacion_enviada", "cotizacion_aprobada", "en_ejecucion", "documentacion_enviada", "por_liquidar", "liquidado", "visitado", "requiere_revision_admin"];

    const stats = React.useMemo(() => {
        const activos = ticketsForMe.filter(t => filterByView(t, "active"));
        return {
            total: ticketsForMe.length,
            borradores: ticketsForMe.filter(t => filterByView(t, "triage")).length,
            completados: ticketsForMe.filter(t => filterByView(t, "closed")).length,
            nuevos: activos.filter(t => NUEVOS_STATES.includes(normalizeStateId(t.estadoId))).length,
            enProceso: activos.filter(t => EN_PROCESO_STATES.includes(normalizeStateId(t.estadoId))).length,
            revisiones: activos.filter(t => normalizeStateId(t.estadoId) === "requiere_revision_admin").length,
            activosTotal: activos.length,
            _nuevosList: activos.filter(t => NUEVOS_STATES.includes(normalizeStateId(t.estadoId))),
            _enProcesoList: activos.filter(t => EN_PROCESO_STATES.includes(normalizeStateId(t.estadoId))),
        };
    }, [ticketsForMe, filterByView]);

    const filteredTickets = React.useMemo(() => {
        const base = ticketsForMe.filter(t => filterByView(t, viewMode));
        if (viewMode === "active" && statFilter === "nuevos") {
            return base.filter(t => NUEVOS_STATES.includes(normalizeStateId(t.estadoId)));
        }
        if (viewMode === "active" && statFilter === "enProceso") {
            return base.filter(t => EN_PROCESO_STATES.includes(normalizeStateId(t.estadoId)));
        }
        if (viewMode === "active" && statFilter === "revision") {
            return base.filter(t => normalizeStateId(t.estadoId) === "requiere_revision_admin");
        }
        return base;
    }, [ticketsForMe, filterByView, viewMode, statFilter]);

    return (
        <div className={styles.page}>
            {/* ✨ HEADER ULTRA COMPACTO */}
            <div className={styles.pageHeader}>
                <div className={styles.headerLeft}>
                    <Sparkles className={styles.sparkleIcon} size={22} />
                    <div>
                        <h1 className={styles.pageTitle}>
                            {viewMode === "triage" ? "Bandeja de Triage" :
                                viewMode === "active" ? "Tickets Activos" : "Historial de Tickets Cerrados"}
                        </h1>
                        <p className={styles.pageSubtitle}>
                            {viewMode === "triage" ? `${stats.borradores} por clasificar` :
                                viewMode === "active" && statFilter === "nuevos" ? `Mostrando: ${stats.nuevos} Nuevos de ${stats.activosTotal} activos` :
                                viewMode === "active" && statFilter === "enProceso" ? `Mostrando: ${stats.enProceso} En Proceso de ${stats.activosTotal} activos` :
                                viewMode === "active" ? `${stats.activosTotal} activos` :
                                    `${stats.completados} cerrados`} • {stats.nuevos} nuevos
                        </p>
                    </div>
                </div>
                <div className={styles.viewToggle}>
                    <button
                        className={`${styles.toggleBtn} ${viewMode === "triage" ? styles.toggleBtnActive : ""}`}
                        onClick={() => { setViewMode("triage"); setStatFilter('all'); }}
                        onMouseEnter={() => prefetchTickets(queryClient)}
                        style={{ borderLeft: 'none' }}
                    >
                        Triage {stats.borradores > 0 && <span className={styles.badgeCount}>{stats.borradores}</span>}
                    </button>
                    <button
                        className={`${styles.toggleBtn} ${viewMode === "active" ? styles.toggleBtnActive : ""}`}
                        onClick={() => { setViewMode("active"); setStatFilter('all'); }}
                        onMouseEnter={() => prefetchTickets(queryClient)}
                    >
                        En Proceso
                    </button>
                    <button
                        className={`${styles.toggleBtn} ${viewMode === "closed" ? styles.toggleBtnActive : ""}`}
                        onClick={() => { setViewMode("closed"); setStatFilter('all'); }}
                        onMouseEnter={() => prefetchTickets(queryClient)}
                    >
                        Cerrados
                    </button>
                </div>

                <button
                    className={styles.createBtn}
                    onClick={() => setShowWizard(true)}
                >
                    <Plus size={16} />
                    Nuevo
                </button>
            </div>

            {/* 📊 STATS MINI — CLICKABLES */}
            <div className={styles.statsGrid}>
                <div 
                    className={styles.statCard} 
                    style={{ 
                        '--card-color': '#8B5CF6',
                        cursor: 'pointer',
                        outline: viewMode === 'active' && statFilter === 'nuevos' ? '2px solid #8B5CF6' : 'none',
                        transform: viewMode === 'active' && statFilter === 'nuevos' ? 'scale(1.03)' : 'scale(1)',
                        transition: 'all 0.2s'
                    } as any}
                    onClick={() => { setViewMode('active'); setStatFilter(statFilter === 'nuevos' ? 'all' : 'nuevos'); }}
                    title="Ver tickets nuevos"
                >
                    <div className={styles.statIcon}>
                        <Clock size={16} />
                    </div>
                    <div className={styles.statContent}>
                        <span className={styles.statValue}>{stats.nuevos}</span>
                        <span className={styles.statLabel}>Nuevos</span>
                    </div>
                </div>

                <div 
                    className={styles.statCard} 
                    style={{ 
                        '--card-color': '#F59E0B',
                        cursor: 'pointer',
                        outline: viewMode === 'active' && statFilter === 'enProceso' ? '2px solid #F59E0B' : 'none',
                        transform: viewMode === 'active' && statFilter === 'enProceso' ? 'scale(1.03)' : 'scale(1)',
                        transition: 'all 0.2s'
                    } as any}
                    onClick={() => { setViewMode('active'); setStatFilter(statFilter === 'enProceso' ? 'all' : 'enProceso'); }}
                    title="Ver tickets en proceso"
                >
                    <div className={styles.statIcon}>
                        <Zap size={16} />
                    </div>
                    <div className={styles.statContent}>
                        <span className={styles.statValue}>{stats.enProceso}</span>
                        <span className={styles.statLabel}>En proceso</span>
                    </div>
                </div>

                {isAdminState && (
                    <div 
                        className={styles.statCard} 
                        style={{ 
                            '--card-color': '#EF4444',
                            cursor: 'pointer',
                            outline: viewMode === 'active' && statFilter === 'revision' ? '2px solid #EF4444' : 'none',
                            transform: viewMode === 'active' && statFilter === 'revision' ? 'scale(1.03)' : 'scale(1)',
                            transition: 'all 0.2s',
                            boxShadow: stats.revisiones > 0 ? '0 0 15px rgba(239, 68, 68, 0.4)' : 'none'
                        } as any}
                        onClick={() => { setViewMode('active'); setStatFilter(statFilter === 'revision' ? 'all' : 'revision'); }}
                        title="Ver tickets que requieren aprobación"
                    >
                        <div className={styles.statIcon} style={{ animation: stats.revisiones > 0 ? 'pulseRed 2s infinite ease-in-out' : 'none' }}>
                            <AlertTriangle size={16} />
                        </div>
                        <div className={styles.statContent}>
                            <span className={styles.statValue}>{stats.revisiones}</span>
                            <span className={styles.statLabel}>Revisiones</span>
                        </div>
                    </div>
                )}

                <div 
                    className={styles.statCard} 
                    style={{ 
                        '--card-color': '#10B981',
                        cursor: 'pointer',
                        outline: viewMode === 'closed' ? '2px solid #10B981' : 'none',
                        transform: viewMode === 'closed' ? 'scale(1.03)' : 'scale(1)',
                        transition: 'all 0.2s'
                    } as any}
                    onClick={() => { setViewMode('closed'); setStatFilter('all'); }}
                    title="Ver tickets completados"
                >
                    <div className={styles.statIcon}>
                        <CheckCircle2 size={16} />
                    </div>
                    <div className={styles.statContent}>
                        <span className={styles.statValue}>{stats.completados}</span>
                        <span className={styles.statLabel}>Completados</span>
                    </div>
                </div>
            </div>

            {/* 🔄 BARRA KANBAN OPERATIVA (SINFIMAC) */}
            <div className={styles.kanbanFlow}>
                {TICKET_STATES.filter(s => s.order <= 13 && s.id !== "nuevo").map((estado, index, array) => {
                    const IconComponent = estado.icon;
                    // Optimizar búsqueda de tickets por estado (SOLO LOS VISIBLES PARA MÍ)
                    const ticketsEnEstado = ticketsForMe.reduce((count: number, t: any) =>
                        normalizeStateId(t.estadoId) === estado.id ? count + 1 : count, 0
                    );

                    return (
                        <div
                            key={estado.id}
                            className={styles.flowContainer}
                            onMouseEnter={() => prefetchTickets(queryClient)}
                        >
                            <div
                                className={styles.flowStep}
                                style={{ '--step-color': estado.color } as any}
                            >
                                <div className={styles.flowIcon}>
                                    <IconComponent size={14} />
                                </div>
                                <div className={styles.flowInfo}>
                                    <span className={styles.flowName}>{estado.nombreCorto}</span>
                                    <span className={styles.flowCount}>{ticketsEnEstado}</span>
                                </div>
                            </div>
                            {index < array.length - 1 && (
                                <ArrowRight size={12} className={styles.flowArrow} />
                            )}
                        </div>
                    );
                })}
            </div>

            {/* 🔍 TOOLBAR MINI */}
            <div className={styles.toolbar}>
                <div className={styles.searchBox}>
                    <Search size={16} />
                    <input
                        type="text"
                        placeholder="Buscar tickets..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <button className={styles.filterBtn}>
                    <Filter size={16} />
                    Filtros
                </button>
            </div>

            {/* 🎫 LISTA DE TICKETS OPTIMIZADA */}
            <div className={styles.ticketsList}>
                {filteredTickets.length === 0 ? (
                    <div className={styles.emptyState}>
                        <div className={styles.emptyIcon}>
                            <Sparkles size={40} />
                        </div>
                        <h3>{viewMode === 'active' ? '¡Comienza tu día productivo!' : 'No hay historial acumulado'}</h3>
                        <p>{viewMode === 'active' ? 'Crea tu primer ticket y gestiona tus servicios' : 'Los tickets aparecerán aquí una vez que sean liquidados y cerrados.'}</p>
                        {viewMode === 'active' && (
                            <button
                                className={styles.createBtnEmpty}
                                onClick={() => setShowWizard(true)}
                            >
                                <Plus size={18} />
                                Crear Primer Ticket
                            </button>
                        )}
                    </div>
                ) : (
                    <>
                        {viewMode === "active" ? (
                            <div className={styles.ticketsGrid}>
                                {filteredTickets.map((ticket: any) => {
                                    const service = getServiceById(ticket.tipoServicio);
                                    return (
                                        <TicketCard
                                            key={ticket.id}
                                            ticket={ticket}
                                            service={service}
                                            ServiceIcon={service?.icon}
                                            onTicketClick={() => handleOpenTicket(ticket)}
                                        />
                                    );
                                })}
                            </div>
                        ) : (
                            <div className={styles.historyTableContainer}>
                                <table className={styles.historyTable}>
                                    <thead>
                                        <tr>
                                            <th>ID / FECHA</th>
                                            <th>CLIENTE / SEDE</th>
                                            <th>SERVICIO</th>
                                            <th>LIQUIDACIÓN</th>
                                            <th>GESTORA</th>
                                            <th>ACCIONES</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredTickets.map((ticket: any) => (
                                            <TicketRow
                                                key={ticket.id}
                                                ticket={ticket}
                                                onTicketClick={() => handleOpenTicket(ticket)}
                                            />
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* 🎭 WIZARD MODAL */}
            {
                showWizard && (
                    <CreateTicketWizard
                        onClose={() => setShowWizard(false)}
                        onCreateTicket={handleCreateTicket}
                        creatorRole={isAdminState ? 'ADMIN' : 'GESTORA'}
                        creatorGestoraId={myGestoraId}
                        creatorGestoraNombre={null}
                    />
                )
            }

            {/* 🪟 VENTANAS FLOTANTES DE TICKETS */}
            {
                openTickets.map((ticket, index) => {
                    // 🔥 FRESH DATA: Buscar la versión más reciente del ticket en el estado global (Realtime)
                    // Esto asegura que si el Admin confirma un pago, la Gestora lo vea reflejado al instante
                    // sin tener que cerrar y abrir el ticket, ya que 'tickets' se actualiza vía suscripción.
                    const freshTicket = tickets.find((t: any) => t.id === ticket.id) || ticket;

                    return (
                        <TicketWindow
                            key={freshTicket.id}
                            ticket={freshTicket}
                            index={index}
                            onUpdate={updateTicket}
                            onClose={() => setOpenTickets(openTickets.filter(t => t.id !== ticket.id))}
                        />
                    );
                })}
        </div >
    );
}

// Componente de tarjeta separado para mejor rendimiento
function TicketCard({ ticket, onTicketClick, isDraggable, provided }: any) {
    const { timeRemaining, slaStatus } = useTicketAge(ticket.creado_el || ticket.created_at);
    const service = getServiceById(ticket.servicioId);
    const ServiceIcon = service?.icon;

    const slaColors: any = {
        ok: "#22C55E",
        warning: "#F59E0B",
        critical: "#EF4444",
        expired: "#b91c1c"
    };

    const statusAccent = getStateColor(ticket.estadoId || 'nuevo');
    const stateName = TICKET_STATES.find(s => normalizeStateId(s.id) === normalizeStateId(ticket.estadoId || 'nuevo'))?.nombreCorto || 'NUEVO';

    const handleCardClick = (e: React.MouseEvent) => {
        if (onTicketClick) onTicketClick(ticket);
    };

    return (
        <div
            className={styles.ticketCard}
            onClick={handleCardClick}
            ref={provided?.innerRef}
            {...(isDraggable ? provided?.draggableProps : {})}
            {...(isDraggable ? provided?.dragHandleProps : {})}
            style={{ 
                ...provided?.draggableProps.style,
                '--status-accent': statusAccent
            } as any}
        >
            {/* Indicador de Estado Lateral */}
            <div className={styles.statusIndicator} />

            {/* Cabecera GEOMÉTRICA (El número es el Centro) */}
            <div className={styles.ticketHeader}>
                <span className={styles.ticketStatusLabel}>
                    {stateName}
                </span>
                <h2 className={styles.ticketIdLarge}>
                    {ticket.numeroTicketCliente || `TK-${ticket.id.slice(-6).toUpperCase()}`}
                </h2>
            </div>

            <div className={styles.ticketBody} style={{ padding: '1.2rem 1.5rem' }}>
                {/* Cliente / Sede Minimal */}
                <div className={styles.clienteInfo} style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '1.2rem' }}>
                    <div className={styles.clienteLogo} style={{ width: '32px', height: '32px' }}>
                        {ticket.cliente?.logo ? (
                            <img src={ticket.cliente.logo} alt={ticket.cliente.nombre} className={styles.clienteImg} />
                        ) : (
                            <div className={styles.clienteLogoFallback} style={{ background: '#F1F5F9', color: '#64748B', fontSize: '0.6rem' }}>
                                {ticket.cliente?.nombre?.substring(0, 2).toUpperCase() || 'TK'}
                            </div>
                        )}
                    </div>
                    <div className={styles.clienteText}>
                        <h4 style={{ fontSize: '0.9rem', fontWeight: 700, color: '#0F172A' }}>{ticket.cliente?.nombre || 'Sin cliente'}</h4>
                        <p style={{ fontSize: '0.7rem', color: '#64748B' }}>{ticket.sede?.nombre || 'Sin sede'}</p>
                    </div>
                </div>

                {/* Info de Servicio Cruda y Limpia */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                         <MapPin size={12} color="#94A3B8" />
                         <span style={{ fontSize: '0.75rem', color: '#475569', fontWeight: 500 }}>
                            {ticket.sede?.direccion || 'Dirección no especificada'}
                         </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {ServiceIcon && <ServiceIcon size={12} color={service?.color} />}
                        <span style={{ fontSize: '0.75rem', color: service?.color, fontWeight: 700 }}>
                            {service?.nombre?.toUpperCase()}
                        </span>
                    </div>
                </div>
                
                <p className={styles.descripcion} style={{ marginTop: '1rem', borderLeft: '2px solid #F1F5F9', paddingLeft: '10px', fontStyle: 'italic', color: '#64748B' }}>
                    {ticket.descripcionProblema?.substring(0, 85)}
                    {ticket.descripcionProblema?.length > 85 && '...'}
                </p>
            </div>

            {/* Footer Minimalista */}
            <div className={styles.ticketFooter}>
                <div className={styles.slaMinimal}>
                    <div 
                        className={styles.slaIndicatorCircle} 
                        style={{ '--indicator-color': slaColors[slaStatus] } as any}
                    />
                    <span className={styles.slaValueMinimal}>
                        SLA: {timeRemaining}
                    </span>
                </div>
                
                <div style={{ display: 'flex', gap: '8px' }}>
                    {ticket.metadata?.solicitudModificacion?.pendiente && (
                        <FileEdit size={14} color="#8B5CF6" />
                    )}
                    {ticket.estadoId === 'requiere_revision_admin' && (
                        <AlertTriangle size={14} color="#EF4444" />
                    )}
                </div>
            </div>
        </div>
    );
}

// Componente de fila para el historial de tickets cerrados
function TicketRow({ ticket, onTicketClick }: any) {
    const service = getServiceById(ticket.tipoServicio);
    const ServiceIcon = service?.icon;
    const fechaCierre = ticket.fechaPagoFinal ? new Date(ticket.fechaPagoFinal).toLocaleDateString() : '---';
    const montoTotal = (parseFloat(ticket.costoManoObra || 0) + parseFloat(ticket.costoMateriales || 0));

    return (
        <tr className={styles.historyRow} onClick={onTicketClick}>
            <td>
                <div className={styles.rowIdCol}>
                    <span className={styles.rowTicketId}>{ticket.numeroTicketCliente || `#${ticket.id.slice(-6)}`}</span>
                    <span className={styles.rowDate}>{fechaCierre}</span>
                </div>
            </td>
            <td>
                <div className={styles.rowClientCol}>
                    <strong className={styles.rowClientName}>{ticket.cliente?.nombre}</strong>
                    <span className={styles.rowSedeName}>{ticket.sede?.nombre}</span>
                </div>
            </td>
            <td>
                <div className={styles.rowServiceTag} style={{ background: `${service?.color}15`, color: service?.color }}>
                    {ServiceIcon && <ServiceIcon size={12} />}
                    <span>{service?.nombre}</span>
                </div>
            </td>
            <td>
                <div className={styles.rowLiquidationCol}>
                    <span className={styles.rowAmount}>S/ {montoTotal.toLocaleString('es-PE', { minimumFractionDigits: 2 })}</span>
                    <span className={styles.rowStatusLabel}>Liquidado</span>
                </div>
            </td>
            <td>
                {ticket.gestora?.name || ticket.gestora?.nombre ? (
                    <span className={styles.rowGestora}>{ticket.gestora.name || ticket.gestora.nombre}</span>
                ) : (
                    <span className={styles.rowGestora} style={{ color: '#F59E0B', fontWeight: 800 }}>⚠️ PENDIENTE</span>
                )}
            </td>
            <td>
                <button className={styles.rowActionBtn}>
                    <ArrowRight size={16} />
                </button>
            </td>
        </tr>
    );
}
