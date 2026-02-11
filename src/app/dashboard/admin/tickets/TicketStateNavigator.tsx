"use client";

import { TICKET_STATES, getStateById } from "@/lib/ticketStates";
import styles from "./TicketStateNavigator.module.css";

interface TicketStateNavigatorProps {
    currentStateId: string;
}

export default function TicketStateNavigator({ currentStateId }: TicketStateNavigatorProps) {
    // Normalizar estados intermedios para la visualización en el tracker
    const normalizedId = currentStateId === "esperando_pago_visita" ? "tecnico_asignado" : currentStateId;
    const currentState = getStateById(normalizedId);
    const currentOrder = currentState?.order || 1;

    // Solo mostrar estados operativos principales (excluyendo estados finales y alternativos)
    const mainStates = TICKET_STATES.filter(state =>
        (state.tipo === "operativo" || state.tipo === "final") && state.order <= 12
    );

    return (
        <div className={styles.kanbanContainer}>
            {/* Barra Kanban Horizontal Minimalista */}
            <div className={styles.kanbanFlow}>
                {mainStates.map((state) => {
                    const isActive = state.id === normalizedId;
                    const isPast = state.order < currentOrder;
                    const isFuture = state.order > currentOrder;
                    const StateIcon = state.icon;

                    return (
                        <div key={state.id} className={styles.kanbanStepWrapper}>
                            {/* Item del Kanban */}
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
                                        className={styles.stepName}
                                        style={{ color: isActive ? state.color : undefined }}
                                    >
                                        {state.nombreCorto}
                                    </span>
                                </div>

                                {/* Indicador de estado actual con pulso */}
                                {isActive && (
                                    <div
                                        className={styles.activePulse}
                                        style={{ background: state.color }}
                                    />
                                )}
                            </div>

                            {/* Conector (flecha) */}
                            {state.order < 12 && (
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
