"use client";

import { useState, useEffect } from "react";
import { Plus, Filter, Search, Clock, CheckCircle2, Zap, Sparkles, ArrowRight, MapPin, AlertCircle } from "lucide-react";
import CreateTicketWizard from "@/app/dashboard/admin/tickets/CreateTicketWizard";
import TicketWindow from "@/app/dashboard/admin/tickets/TicketWindow";
import styles from "@/app/dashboard/admin/tickets/page.module.css";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { getServiceById } from "@/lib/serviceTypes";
import { TICKET_STATES, normalizeStateId } from "@/lib/ticketStates";

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

export default function GestorDashboard() {
    const [tickets, setTickets] = useLocalStorage<any[]>("tickets", []);
    const [showWizard, setShowWizard] = useState(false);
    const [openTickets, setOpenTickets] = useState<any[]>([]);
    const [viewMode, setViewMode] = useState<"active" | "closed">("active");


    const handleCreateTicket = (newTicket: any) => {
        setTickets([{ ...newTicket, createdAt: new Date().toISOString() }, ...tickets]);
    };

    const [searchTerm, setSearchTerm] = useState("");

    // 🛠️ REPARACIÓN/SINCRONIZACIÓN AUTOMÁTICA
    useEffect(() => {
        if (tickets.length > 0) {
            let hasChanges = false;
            const updatedTickets = tickets.map((t: any) => {
                const savedState = localStorage.getItem(`ticket_state_${t.id}`);
                if (savedState) {
                    try {
                        const parsed = JSON.parse(savedState);
                        const normalizedMaster = normalizeStateId(t.estadoId);
                        const normalizedSaved = normalizeStateId(parsed.estadoId);

                        if (normalizedMaster !== normalizedSaved) {
                            hasChanges = true;
                            return { ...t, ...parsed, estadoId: normalizedSaved };
                        }
                    } catch (e) {
                        console.error("Error parsing saved ticket state for sync:", e);
                    }
                }
                const normId = normalizeStateId(t.estadoId);
                if (t.estadoId !== normId) {
                    hasChanges = true;
                    return { ...t, estadoId: normId };
                }
                return t;
            });

            if (hasChanges) {
                setTickets(updatedTickets);
            }
        }
    }, [tickets.length]);

    const stats = {
        total: tickets.length,
        nuevos: tickets.filter((t: any) => normalizeStateId(t.estadoId) === "nuevo").length,
        enProceso: tickets.filter((t: any) => {
            const sid = normalizeStateId(t.estadoId);
            return !["nuevo", "ticket_cerrado", "ticket_rechazado", "ticket_cancelado"].includes(sid);
        }).length,
        completados: tickets.filter((t: any) => normalizeStateId(t.estadoId) === "ticket_cerrado").length,
    };

    const filteredTickets = tickets.filter((t: any) => {
        const isClosed = normalizeStateId(t.estadoId) === "ticket_cerrado";
        const matchesSearch =
            t.cliente?.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
            t.descripcionProblema?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            t.numeroTicketCliente?.toLowerCase().includes(searchTerm.toLowerCase());

        if (viewMode === "active") return !isClosed && matchesSearch;
        return isClosed && matchesSearch;
    });

    return (
        <div className={styles.page}>
            <div className={styles.pageHeader}>
                <div className={styles.headerLeft}>
                    <Sparkles className={styles.sparkleIcon} size={22} />
                    <div>
                        <h1 className={styles.pageTitle}>Panel de Control Operativo</h1>
                        <p className={styles.pageSubtitle}>
                            Gestora: {viewMode === "active" ? `${stats.total - stats.completados} activos` : `${stats.completados} cerrados`} • {stats.nuevos} nuevos
                        </p>
                    </div>
                </div>
                <div className={styles.viewToggle}>
                    <button
                        className={`${styles.toggleBtn} ${viewMode === "active" ? styles.toggleBtnActive : ""}`}
                        onClick={() => setViewMode("active")}
                    >
                        En Proceso
                    </button>
                    <button
                        className={`${styles.toggleBtn} ${viewMode === "closed" ? styles.toggleBtnActive : ""}`}
                        onClick={() => setViewMode("closed")}
                    >
                        Cerrados
                    </button>
                </div>

                <button
                    className={styles.createBtn}
                    onClick={() => setShowWizard(true)}
                >
                    <Plus size={16} />
                    Nuevo Ticket
                </button>
            </div>

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

            <div className={styles.kanbanFlow}>
                {TICKET_STATES.filter(s => s.order <= 13).map((estado, index, array) => {
                    const IconComponent = estado.icon;
                    const ticketsEnEstado = tickets.filter((t: any) => normalizeStateId(t.estadoId) === estado.id).length;

                    return (
                        <div key={estado.id} className={styles.flowContainer}>
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

            <div className={styles.ticketsList}>
                {filteredTickets.length === 0 ? (
                    <div className={styles.emptyState}>
                        <div className={styles.emptyIcon}>
                            <Sparkles size={40} />
                        </div>
                        <h3>¡Comienza tu gestión operativa!</h3>
                        <p>No hay tickets para mostrar en este momento.</p>
                        {viewMode === 'active' && (
                            <button
                                className={styles.createBtnEmpty}
                                onClick={() => setShowWizard(true)}
                            >
                                <Plus size={18} />
                                Crear Ticket
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
                                            onTicketClick={() => {
                                                if (!openTickets.find(t => t.id === ticket.id)) {
                                                    setOpenTickets([...openTickets, ticket]);
                                                }
                                            }}
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
                                                onTicketClick={() => {
                                                    if (!openTickets.find(t => t.id === ticket.id)) {
                                                        setOpenTickets([...openTickets, ticket]);
                                                    }
                                                }}
                                            />
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </>
                )}
            </div>

            {
                showWizard && (
                    <CreateTicketWizard
                        onClose={() => setShowWizard(false)}
                        onCreateTicket={handleCreateTicket}
                    />
                )
            }

            {
                openTickets.map((ticket, index) => (
                    <TicketWindow
                        key={ticket.id}
                        ticket={ticket}
                        index={index}
                        onClose={() => setOpenTickets(openTickets.filter(t => t.id !== ticket.id))}
                    />
                ))
            }
        </div >
    );
}

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
            <div className={styles.ticketHeader}>
                <span className={styles.ticketId}>
                    {ticket.numeroTicketCliente ? ticket.numeroTicketCliente : `#${ticket.id.slice(-6)}`}
                </span>
                {slaStatus === "expired" && (
                    <div className={styles.expiredBadge}>SLA VENCIDO</div>
                )}
            </div>

            <div className={styles.ticketBody}>
                <div className={styles.clienteInfo}>
                    <div
                        className={styles.clienteLogo}
                        style={{ background: ticket.cliente?.color || '#8B5CF6' }}
                    >
                        {ticket.cliente?.nombre?.substring(0, 2) || 'TK'}
                    </div>
                    <div className={styles.clienteText}>
                        <h4>{ticket.cliente?.nombre || 'Sin cliente'}</h4>
                        <p>{ticket.sede?.nombre || 'Sin sede'}</p>
                    </div>
                </div>

                {ticket.sede?.direccion && (
                    <div className={styles.direccionInfo}>
                        <MapPin size={12} />
                        <span>{ticket.sede.direccion}</span>
                    </div>
                )}

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

                <p className={styles.descripcion}>
                    {ticket.descripcionProblema?.substring(0, 70)}
                    {ticket.descripcionProblema?.length > 70 && '...'}
                </p>
            </div>

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
                    <AlertCircle size={14} style={{ color: slaColors[slaStatus] }} />
                )}
            </div>
        </div>
    );
}

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
                <span className={styles.rowGestora}>{ticket.historial?.[0]?.usuario || '---'}</span>
            </td>
            <td>
                <button className={styles.rowActionBtn}>
                    <ArrowRight size={16} />
                </button>
            </td>
        </tr>
    );
}
