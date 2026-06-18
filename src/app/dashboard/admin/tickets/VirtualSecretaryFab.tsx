"use client";
import { useState, useCallback, memo } from "react";
import { X, Bot, CheckCircle2, AlertTriangle, Send, Sparkles } from "lucide-react";
import styles from "./VirtualSecretaryFab.module.css";

interface VirtualSecretaryFabProps {
    /** UUID del cliente MiBanco para detectar cuándo exigir el ticket */
    mibancoClientId: string;
    /** ID del cliente del ticket actual */
    clientId: string;
    /** Número de ticket del cliente ya ingresado (puede ser null/undefined) */
    clientTicketNumber?: string | null;
    /** Si es Santander, la regla de MiBanco no aplica */
    isSantander?: boolean;
    /** Callback cuando el usuario confirma un número desde el panel rápido */
    onApplyTicketNumber: (value: string) => void;
}

/** Valida el formato MB000000.26 para MiBanco */
function isValidMiBancoFormat(num?: string | null): boolean {
    if (!num || num.trim() === "") return false;
    if (num.startsWith("STD")) return /^STD\d{4}\.\d{2}$/.test(num);
    if (num.startsWith("#")) return true;
    return /^MB[A-Z0-9]{6}\.\d{2}$/.test(num);
}

function VirtualSecretaryFab({
    mibancoClientId,
    clientId,
    clientTicketNumber,
    isSantander = false,
    onApplyTicketNumber,
}: VirtualSecretaryFabProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [inputValue, setInputValue] = useState("");
    const [saved, setSaved] = useState(false);

    const isMiBanco = clientId === mibancoClientId && !isSantander;
    const hasValidTicket = isValidMiBancoFormat(clientTicketNumber);

    // La alerta sólo se activa cuando es MiBanco y falta el número
    const isAlert = isMiBanco && !hasValidTicket;

    const togglePanel = useCallback(() => {
        setIsOpen((prev) => !prev);
        setSaved(false);
        setInputValue("");
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
                            {isAlert ? (
                                <AlertTriangle size={17} color="#fff" />
                            ) : (
                                <Bot size={17} color="#fff" />
                            )}
                        </div>
                        <div className={styles.panelTitleGroup}>
                            <p className={styles.panelTitle}>
                                {isAlert ? "Acción requerida" : "Secretario Virtual"}
                            </p>
                            <p className={styles.panelSubtitle}>
                                {isAlert
                                    ? "Ticket MiBanco pendiente"
                                    : "Copiloto de gestión operativa"}
                            </p>
                        </div>
                        <button
                            className={styles.panelCloseBtn}
                            onClick={togglePanel}
                            aria-label="Cerrar asistente"
                        >
                            <X size={15} />
                        </button>
                    </div>

                    {/* Cuerpo */}
                    <div className={styles.panelBody}>
                        {/* Burbuja de mensaje */}
                        <div
                            className={`${styles.messageBubble} ${
                                isAlert ? styles.messageBubbleAlert : styles.messageBubbleIdle
                            }`}
                        >
                            {isAlert ? (
                                <p className={styles.messageText}>
                                    Este ticket pertenece a{" "}
                                    <span className={styles.messageHighlight}>MiBanco</span>{" "}
                                    y aún no tiene un número de ticket del cliente registrado.{" "}
                                    Sin este dato{" "}
                                    <span className={styles.messageHighlight}>
                                        no podrás cerrar ni liquidar el servicio.
                                    </span>{" "}
                                    Ingrésalo aquí para continuar.
                                </p>
                            ) : hasValidTicket ? (
                                <p className={styles.messageText}>
                                    Ticket registrado correctamente.{" "}
                                    <span className={styles.messageHighlightIdle}>
                                        {clientTicketNumber}
                                    </span>
                                    . Todo en orden para el cierre del servicio.
                                </p>
                            ) : (
                                <p className={styles.messageText}>
                                    <span className={styles.messageHighlightIdle}>
                                        ¡Hola! Soy tu copiloto.
                                    </span>{" "}
                                    Puedo ayudarte a registrar el ticket del cliente, revisar
                                    el estado del servicio y anticipar bloqueos antes de que
                                    ocurran.
                                </p>
                            )}
                        </div>

                        {/* Si es MiBanco sin ticket válido → input rápido */}
                        {isMiBanco && !hasValidTicket && !saved && (
                            <div className={styles.quickInputWrap}>
                                <span className={styles.quickInputLabel}>
                                    Número de ticket MiBanco
                                </span>
                                <div className={styles.quickInputRow}>
                                    <input
                                        className={`${styles.quickInput} ${
                                            !isAlert ? styles.quickInputFocusIdle : ""
                                        }`}
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
                                        className={`${styles.quickInputBtn} ${
                                            isAlert
                                                ? styles.quickInputBtnAlert
                                                : styles.quickInputBtnIdle
                                        }`}
                                        onClick={handleApply}
                                        disabled={!inputValue.trim()}
                                        title="Aplicar número de ticket"
                                    >
                                        <Send size={13} />
                                        Guardar
                                    </button>
                                </div>
                                {inputValue.trim() && (
                                    currentInputValid ? (
                                        <span className={styles.validBadge}>
                                            <CheckCircle2 size={12} />
                                            Formato válido ✓
                                        </span>
                                    ) : (
                                        <p className={`${styles.formatHint} ${styles.formatHintAlert}`}>
                                            Formato esperado: MB123ABC.26
                                        </p>
                                    )
                                )}
                                {!inputValue.trim() && (
                                    <p className={styles.formatHint}>
                                        Formato esperado: MB[6 chars].[2 dígitos]
                                    </p>
                                )}
                            </div>
                        )}

                        {/* Confirmación de guardado */}
                        {saved && (
                            <div className={styles.ticketOkBanner}>
                                <CheckCircle2 size={16} color="#059669" />
                                <p className={styles.ticketOkBannerText}>
                                    Ticket registrado correctamente
                                </p>
                            </div>
                        )}

                        {/* Ticket ya válido → mostrar estado OK */}
                        {isMiBanco && hasValidTicket && (
                            <div className={styles.ticketOkBanner}>
                                <CheckCircle2 size={16} color="#059669" />
                                <p className={styles.ticketOkBannerText}>
                                    {clientTicketNumber} — Listo para liquidar
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    <div className={styles.panelFooter}>
                        <div className={styles.panelFooterDot} />
                        <span className={styles.panelFooterText}>
                            Secretario Virtual · CorpFlow SFMAC
                        </span>
                        <div className={styles.panelFooterDot} />
                    </div>
                </div>
            )}

            {/* ── Botón FAB ──────────────────────────────── */}
            <button
                className={`${styles.fab} ${isAlert ? styles.fabAlert : styles.fabIdle}`}
                onClick={togglePanel}
                aria-label={isAlert ? "Alerta: registrar ticket MiBanco" : "Abrir secretario virtual"}
                title={
                    isAlert
                        ? "⚠ Se requiere el número de ticket MiBanco para continuar"
                        : "Secretario Virtual — Copiloto operativo"
                }
            >
                {/* Anillo exterior (sólo en alerta) */}
                {isAlert && !isOpen && <span className={styles.fabRing} />}

                {/* Punto de notificación */}
                {isAlert && <span className={styles.fabDot} />}

                {isAlert ? (
                    <AlertTriangle size={20} color="#fff" />
                ) : (
                    <Sparkles size={19} color="#fff" />
                )}
            </button>
        </>
    );
}

export default memo(VirtualSecretaryFab);
