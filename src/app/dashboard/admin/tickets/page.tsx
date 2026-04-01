"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Plus, Filter, Search, Clock, CheckCircle2, Zap, Sparkles, ArrowRight, MapPin, AlertCircle } from "lucide-react";
import CreateTicketWizard from "./CreateTicketWizard";
import TicketWindow from "./TicketWindow";
import styles from "./page.module.css";
import { getServiceById } from "@/lib/serviceTypes";
import { TICKET_STATES, normalizeStateId } from "@/lib/ticketStates";
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
    const [viewMode, setViewMode] = useState<"triage" | "active" | "closed">("triage");

    // ── GESTORA RESOLUTION Y ROLES ─────────────────────────────
    const [myGestoraId, setMyGestoraId] = useState<string | null>(null);
    const [isAdminState, setIsAdminState] = useState<boolean>(false);

    const fetchGestora = useCallback(async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            const email = user?.email || localStorage.getItem('userEmail');
            if (!email) return;

            const userRole = localStorage.getItem('userRole');
            if (userRole === 'SUPERADMIN' || userRole === 'ADMIN') {
                setIsAdminState(true);
            }

            const { data: g } = await supabase.from('gestoras').select('id').ilike('email', email).maybeSingle();
            if (g?.id) {
                setMyGestoraId(g.id);
            } else {
                const { data: p } = await supabase.from('perfiles').select('id, rol').ilike('email', email).maybeSingle();
                if (p) {
                    if (p.id) setMyGestoraId(p.id);
                    if (p.rol === 'SUPERADMIN' || p.rol === 'ADMIN') setIsAdminState(true);
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
        // REGLA 0: Admin ve TODO
        if (isAdminState) return true;

        // REGLA 1: Identidad requerida
        if (!myGestoraId) return false;

        // EXCLUSIVIDAD: Si el ticket tiene una GESTORA DIRECTA ya asignada
        if (t.gestora_id || t.metadata?.gestora_id) {
            const finalGestoraId = t.gestora_id || t.metadata?.gestora_id;
            return finalGestoraId === myGestoraId;
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

    const [searchTerm, setSearchTerm] = useState("");

    // 🛠️ REPARACIÓN/SINCRONIZACIÓN AUTOMÁTICA
    // Eliminada la sincronización local forzada, ahora se usa normalización en el hook useTickets
    // para asegurar que los datos de Supabase sean compatibles con la UI.


    // Estadísticas rápidas usando el flujo operativo real - MEMOIZED
    const stats = React.useMemo(() => {
        return {
            total: tickets.length,
            borradores: tickets.filter((t: any) => normalizeStateId(t.estadoId) === "borrador").length,
            nuevos: tickets.filter((t: any) => ["nuevo", "pendiente"].includes(normalizeStateId(t.estadoId))).length,
            enProceso: tickets.filter((t: any) => {
                const sid = normalizeStateId(t.estadoId);
                return !["borrador", "nuevo", "pendiente", "ticket_cerrado", "ticket_rechazado", "ticket_cancelado"].includes(sid);
            }).length,
            completados: tickets.filter((t: any) => normalizeStateId(t.estadoId) === "ticket_cerrado").length,
        };
    }, [tickets]);

    const filteredTickets = React.useMemo(() => {
        return tickets.filter((t: any) => {
            // 1. Visibilidad por Rol (REGLA DE ORO)
            if (!isVisibleForMe(t)) return false;

            // 2. Filtros UI existentes
            const sid = normalizeStateId(t.estadoId);
            const isClosed = sid === "ticket_cerrado";

            const clienteNombre = (t.cliente?.nombre || t.metadata?.cliente?.nombre || "").toLowerCase();
            const descripcion = (t.descripcionProblema || "").toLowerCase();
            const tktCliente = (t.numeroTicketCliente || "").toLowerCase();
            const search = searchTerm.toLowerCase();

            const matchesSearch =
                clienteNombre.includes(search) ||
                descripcion.includes(search) ||
                tktCliente.includes(search);

            if (viewMode === "triage") return sid === "borrador" && matchesSearch;
            if (viewMode === "active") return !["borrador", "ticket_cerrado"].includes(sid) && matchesSearch;
            return isClosed && matchesSearch;
        });
    }, [tickets, searchTerm, viewMode, isVisibleForMe]);

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
                                viewMode === "active" ? `${stats.total - stats.completados - stats.borradores} activos` :
                                    `${stats.completados} cerrados`} • {stats.nuevos} nuevos
                        </p>
                    </div>
                </div>
                <div className={styles.viewToggle}>
                    <button
                        className={`${styles.toggleBtn} ${viewMode === "triage" ? styles.toggleBtnActive : ""}`}
                        onClick={() => setViewMode("triage")}
                        onMouseEnter={() => prefetchTickets(queryClient)}
                        style={{ borderLeft: 'none' }}
                    >
                        Triage {stats.borradores > 0 && <span className={styles.badgeCount}>{stats.borradores}</span>}
                    </button>
                    <button
                        className={`${styles.toggleBtn} ${viewMode === "active" ? styles.toggleBtnActive : ""}`}
                        onClick={() => setViewMode("active")}
                        onMouseEnter={() => prefetchTickets(queryClient)}
                    >
                        En Proceso
                    </button>
                    <button
                        className={`${styles.toggleBtn} ${viewMode === "closed" ? styles.toggleBtnActive : ""}`}
                        onClick={() => setViewMode("closed")}
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

            {/* 📊 STATS MINI */}
            <div className={styles.statsGrid}>
                <div className={styles.statCard} style={{ '--card-color': '#8B5CF6' } as any}>
                    <div className={styles.statIcon}>
                        <Clock size={16} />
                    </div>
                    <div className={styles.statContent}>
                        <span className={styles.statValue}>{stats.nuevos}</span>
                        <span className={styles.statLabel}>Nuevos</span>
                    </div>
                </div>

                <div className={styles.statCard} style={{ '--card-color': '#F59E0B' } as any}>
                    <div className={styles.statIcon}>
                        <Zap size={16} />
                    </div>
                    <div className={styles.statContent}>
                        <span className={styles.statValue}>{stats.enProceso}</span>
                        <span className={styles.statLabel}>En proceso</span>
                    </div>
                </div>

                <div className={styles.statCard} style={{ '--card-color': '#10B981' } as any}>
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
                    // Optimizar búsqueda de tickets por estado
                    const ticketsEnEstado = tickets.reduce((count: number, t: any) =>
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
function TicketCard({ ticket, service, ServiceIcon, onTicketClick }: any) {
    const slaColors = {
        ok: "#10B981",
        warning: "#F59E0B",
        critical: "#EF4444",
        expired: "#b91c1c"
    };

    const { timeRemaining, slaStatus } = useTicketAge(ticket.createdAt || new Date().toISOString());

    return (
        <div className={styles.ticketCard} onClick={onTicketClick} style={{ cursor: 'pointer' }}>
            {/* HEADER: Prioriza el número del cliente si existe */}
            <div className={styles.ticketHeader}>
                <span className={styles.ticketId}>
                    {ticket.numeroTicketCliente ? ticket.numeroTicketCliente : `#${ticket.id.slice(-6)}`}
                </span>
                {slaStatus === "expired" && (
                    <div className={styles.expiredBadge}>SLA VENCIDO</div>
                )}
                {(!ticket.gestora_id && !ticket.gestora) && (
                    <div className={styles.expiredBadge} style={{ background: '#F59E0B', marginLeft: '4px' }}>SIN GESTORA</div>
                )}
            </div>

            {/* BODY OPTIMIZADO */}
            <div className={styles.ticketBody}>
                {/* Cliente */}
                <div className={styles.clienteInfo}>
                    <div
                        className={styles.clienteLogo}
                        style={{
                            background: ticket.cliente?.color || '#8B5CF6',
                            padding: ticket.cliente?.logo ? '0' : 'inherit'
                        }}
                    >
                        {ticket.cliente?.logo ? (
                            <img
                                src={ticket.cliente.logo}
                                alt={ticket.cliente.nombre}
                                style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                            />
                        ) : (
                            ticket.cliente?.nombre?.substring(0, 2) || 'TK'
                        )}
                    </div>
                    <div className={styles.clienteText}>
                        <h4>{ticket.cliente?.nombre || 'Sin cliente'}</h4>
                        <p>{ticket.sede?.nombre || 'Sin sede'}</p>
                    </div>
                </div>

                {/* Dirección */}
                {ticket.sede?.direccion && (
                    <div className={styles.direccionInfo}>
                        <MapPin size={12} />
                        <span>{ticket.sede.direccion}</span>
                    </div>
                )}

                {/* Servicio */}
                {ServiceIcon && (
                    <div
                        className={styles.serviceTag}
                        style={{
                            background: `${service.color}15`,
                            borderColor: service.color
                        }}
                    >
                        <ServiceIcon size={12} color={service.color} />
                        <span style={{ color: service.color }}>
                            {service.nombre}
                        </span>
                    </div>
                )}

                {/* Descripción */}
                <p className={styles.descripcion}>
                    {ticket.descripcionProblema?.substring(0, 70)}
                    {ticket.descripcionProblema?.length > 70 && '...'}
                </p>
            </div>

            {/* FOOTER: SLA Countdown 72h */}
            <div
                className={styles.ticketFooter}
                style={{
                    borderTopColor: slaColors[slaStatus],
                    background: slaStatus === "expired" ? "#fef2f2" : "transparent"
                }}
            >
                <div className={styles.slaInfo}>
                    <Clock size={12} style={{ color: slaColors[slaStatus] }} />
                    <div className={styles.slaTextContainer}>
                        <span className={styles.slaLabel}>Tiempo Restante:</span>
                        <span className={styles.slaValue} style={{ color: slaColors[slaStatus] }}>
                            {timeRemaining}
                        </span>
                    </div>
                </div>
                {slaStatus !== "ok" && (
                    <AlertCircle size={14} style={{ color: slaColors[slaStatus] }} className={styles.pulseAnimation} />
                )}
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
