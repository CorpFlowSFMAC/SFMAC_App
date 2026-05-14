CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS idx_ticket_costs_v3_unique_confirmed
ON ticket_costs (
    ticket_id,
    monto,
    lower(regexp_replace(btrim(concepto), '\s+', ' ', 'g'))
)
WHERE lower(coalesce(estado_pago, '')) IN (
    'pagado',
    'adelanto',
    'abonado',
    'confirmado',
    'auditado',
    'ejecutado',
    'autorizado admin',
    'autorizado',
    'aprobado',
    'transferido',
    'completado',
    'depósito',
    'deposito'
);
