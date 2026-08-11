-- =====================================================
-- MIGRACIÓN: Crear tabla de invoices (Órdenes de Compra)
-- Fecha: 2026-07-17
-- Propósito: Gestionar cobranzas - registrar OC y pagos
-- =====================================================

-- Crear tabla invoices si no existe
CREATE TABLE IF NOT EXISTS invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id UUID REFERENCES tickets(id) ON DELETE CASCADE,
    amount_base NUMERIC(12, 2) NOT NULL,           -- Monto base sin IGV (NOT NULL)
    amount_total NUMERIC(12, 2) NOT NULL,          -- Monto total con IGV (NOT NULL)
    status TEXT NOT NULL DEFAULT 'emitida' CHECK (status IN ('emitida', 'cobrada', 'anulada')),
    issued_date TIMESTAMPTZ DEFAULT NOW(),
    paid_date TIMESTAMPTZ,
    invoice_number TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para mejorar rendimiento
CREATE INDEX IF NOT EXISTS idx_invoices_ticket_id ON invoices(ticket_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_invoice_number ON invoices(invoice_number);

-- Comentarios para documentación
COMMENT ON TABLE invoices IS 'Tabla para gestionar facturas/órdenes de compra de tickets. Usada para el módulo de cobranzas.';
COMMENT ON COLUMN invoices.ticket_id IS 'ID del ticket asociado a la factura';
COMMENT ON COLUMN invoices.amount_base IS 'Monto base de la factura (sin IGV)';
COMMENT ON COLUMN invoices.amount_total IS 'Monto total de la factura (con IGV)';
COMMENT ON COLUMN invoices.status IS 'Estado: emitida (pendiente de pago), cobrada (pagada), anulada';
COMMENT ON COLUMN invoices.invoice_number IS 'Número de orden de compra o factura del cliente';

-- Trigger para actualizar updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_invoices_updated_at ON invoices;
CREATE TRIGGER update_invoices_updated_at
    BEFORE UPDATE ON invoices
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- VERIFICACIÓN
-- =====================================================
-- Ejecutar en SQL Editor de Supabase para verificar:
-- SELECT column_name, data_type, is_nullable 
-- FROM information_schema.columns 
-- WHERE table_name = 'invoices' 
-- ORDER BY ordinal_position;
