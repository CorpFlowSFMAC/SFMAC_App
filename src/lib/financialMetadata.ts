export const stripFinancialMetadata = (metadata: Record<string, unknown> = {}) => {
    const clean = { ...metadata };
    delete clean.historialPagosTecnico;
    delete clean.historialPagosTécnico;
    delete clean.montoAdelanto;
    delete clean.AdelantoPagado;
    delete clean.adelantoPagado;
    delete clean.fechaPagoAdelanto;
    delete clean.visitPaymentConfirmed;
    delete clean.fechaPagoVisita;
    delete clean.voucherVisita;
    delete clean.pagosConfirmados;
    return clean;
};
