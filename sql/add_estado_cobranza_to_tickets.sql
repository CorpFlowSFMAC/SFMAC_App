-- =====================================================
-- MIGRACIÓN: Agregar columna estado_cobranza a tickets
-- Fecha: 2026-07-20
-- Propósito: Consolidar estado financiero del ticket
-- como única fuente de verdad
-- =====================================================

-- Agregar columna estado_cobranza si no existe
ALTER TABLE tickets 
ADD COLUMN IF NOT EXISTS estado_cobranza TEXT DEFAULT 'pendiente' 
CHECK (estado_cobranza IN ('pendiente', 'facturado', 'cobrado'));

-- Crear índice para consultas rápidas
CREATE INDEX IF NOT EXISTS idx_tickets_estado_cobranza ON tickets(estado_cobranza);

-- Comentarios para documentación
COMMENT ON COLUMN tickets.estado_cobranza IS 'Estado de cobranza del ticket: pendiente (no facturado), facturado (emitido), cobrado (pagado)';

-- =====================================================
-- LIMPIEZA: Migrar datos existentes de invoices a tickets
-- =====================================================

-- Actualizar tickets que tienen invoices cobradas
UPDATE tickets t
SET estado_cobranza = 'cobrado'
FROM invoices i
WHERE i.ticket_id = t.id 
  AND i.status = 'cobrada'
  AND t.estado_cobranza = 'pendiente';

-- Actualizar tickets que tienen invoices emitidas (pendientes)
UPDATE tickets t
SET estado_cobranza = 'facturado'
FROM invoices i
WHERE i.ticket_id = t.id 
  AND i.status = 'emitida'
  AND t.estado_cobranza = 'pendiente';

-- =====================================================
-- TRIGGER: Actualizar estado_cobranza automáticamente
-- cuando se inserta/actualiza un invoice
-- =====================================================

CREATE OR REPLACE FUNCTION update_ticket_estado_cobranza()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'cobrada' THEN
        UPDATE tickets 
        SET estado_cobranza = 'cobrado' 
        WHERE id = NEW.ticket_id;
    ELSIF NEW.status = 'emitida' THEN
        UPDATE tickets 
        SET estado_cobranza = 'facturado' 
        WHERE id = NEW.ticket_id;
    ELSIF NEW.status = 'anulada' THEN
        -- Verificar si hay otras invoices cobradas
        UPDATE tickets t
        SET estado_cobranza = COALESCE(
            (SELECT 'cobrado' FROM invoices WHERE ticket_id = t.id AND status = 'cobrada' LIMIT 1),
            (SELECT 'facturado' FROM invoices WHERE ticket_id = t.id AND status = 'emitida' LIMIT 1),
            'pendiente'
        )
        WHERE id = NEW.ticket_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_ticket_estado_cobranza ON invoices;
CREATE TRIGGER trigger_update_ticket_estado_cobranza
    AFTER INSERT OR UPDATE ON invoices
    FOR EACH ROW
    EXECUTE FUNCTION update_ticket_estado_cobranza();

-- =====================================================
-- VERIFICACIÓN
-- =====================================================
-- SELECT 
--     estado_cobranza, 
--     COUNT(*) as cantidad 
-- FROM tickets 
-- GROUP BY estado_cobranza;
