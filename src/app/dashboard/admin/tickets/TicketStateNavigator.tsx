"use client";

import { TICKET_STATES, getStateById } from "@/lib/ticketStates";
import styles from "./TicketStateNavigator.module.css";

interface TicketStateNavigatorProps {
    currentStateId: string;
}

export default function TicketStateNavigator({ currentStateId }: TicketStateNavigatorProps) {
    const isTriage = currentStateId === "borrador";

    // Normalizar: borrador -> nuevo para el tracker principal
    const normalizedId = currentStateId === "esperando_pago_visita"
        ? "tecnico_asignado"
        : currentStateId === "borrador"
            ? "borrador"   // lo mantenemos para resaltar el step de Triage
            : currentStateId;

    const currentState = getStateById(normalizedId);
    const currentOrder = isTriage ? -1 : (currentState?.order || 1);

    // Pasos del flujo principal (orden 1 en adelante), deduplicados
    const seenOrders = new Set<number>();
    const mainStates = TICKET_STATES.filter(state => {
        if (state.id === "borrador") return false; // Triage se muestra aparte
        if (state.id === "pendiente") return false; // alias de nuevo
        if (state.tipo === "alerta") return false;
        if (state.order > 12) return false;
        if (seenOrders.has(state.order)) return false;
        seenOrders.add(state.order);
        return true;
    }).sort((a, b) => a.order - b.order);

    // Paso de Triage (solo para borrador)
    const triageState = getStateById("borrador");

    return (
        <div className={`${styles.kanbanContainer} overflow-x-auto whitespace-nowrap scrollbar-none flex items-center gap-3`}>
            <div className={styles.kanbanFlow}>

                {/* Paso especial: TRIAGE */}
                {triageState && (
                    <div key="triage-step" className={styles.kanbanStepWrapper}>
                        <div
                            className={`${styles.kanbanStep} ${isTriage ? styles.active : styles.completed}`}
                            style={{
                                '--step-color': triageState.color,
                                borderColor: isTriage ? triageState.color : '#10B981'
                            } as any}
                        >
                            <div
                                className={styles.stepIcon}
                                style={{
                                    background: isTriage ? triageState.color : '#10B981',
                                    color: 'white'
                                }}
                            >
                                {isTriage ? (
                                    triageState.icon && <triageState.icon size={20} />
                                ) : (
                                    <span className={styles.checkmark}>✓</span>
                                )}
                            </div>
                            <div className={styles.stepInfo}>
                                <span className={styles.stepNumber}>⚡</span>
                                <span
                                    className={`${styles.stepName} text-xs md:text-sm`}
                                    style={{ color: isTriage ? triageState.color : '#10B981' }}
                                >
                                    Triage
                                </span>
                            </div>
                            {isTriage && (
                                <div
                                    className={styles.activePulse}
                                    style={{ background: triageState.color }}
                                />
                            )}
                        </div>

                        {/* Conector hacia el flujo principal */}
                        <div className={styles.connector}>
                            <div
                                className={styles.connectorLine}
                                style={{ background: isTriage ? '#E5E7EB' : '#10B981' }}
                            />
                        </div>
                    </div>
                )}

                {/* Flujo operativo principal */}
                {mainStates.map((state, idx) => {
                    const isActive = !isTriage && state.id === normalizedId;
                    const isPast = !isTriage && state.order < currentOrder;
                    const isFuture = isTriage || state.order > currentOrder;
                    const StateIcon = state.icon;
                    const isLast = idx === mainStates.length - 1;

                    return (
                        <div key={state.id} className={styles.kanbanStepWrapper}>
                            <div
                                className={`${styles.kanbanStep} ${isActive ? styles.active : ''} ${isPast ? styles.completed : ''} ${isFuture ? styles.future : ''}`}
                                style={{
                                    '--step-color': state.color,
                                    borderColor: isActive || isPast ? state.color : '#E5E7EB'
                                } as any}
                            >
                                {/* Icono */}
                                <div
                                    className={styles.stepIcon}
                                    style={{
                                        background: isActive || isPast ? state.color : '#F3F4F6',
                                        color: isActive || isPast ? 'white' : '#9CA3AF'
                                    }}
                                >
                                    {isPast && !isActive ? (
                                        <span className={styles.checkmark}>✓</span>
                                    ) : (
                                        StateIcon && <StateIcon size={20} />
                                    )}
                                </div>

                                {/* Información */}
                                <div className={styles.stepInfo}>
                                    <span className={styles.stepNumber}>{state.order}</span>
                                    <span
                                        className={`${styles.stepName} text-xs md:text-sm`}
                                        style={{ color: isActive ? state.color : undefined }}
                                    >
                                        {state.nombreCorto}
                                    </span>
                                </div>

                                {/* Pulso en estado activo */}
                                {isActive && (
                                    <div
                                        className={styles.activePulse}
                                        style={{ background: state.color }}
                                    />
                                )}
                            </div>

                            {/* Conector */}
                            {!isLast && (
                                <div className={styles.connector}>
                                    <div
                                        className={styles.connectorLine}
                                        style={{
                                            background: isPast ? state.color : '#E5E7EB'
                                        }}
                                    />
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
