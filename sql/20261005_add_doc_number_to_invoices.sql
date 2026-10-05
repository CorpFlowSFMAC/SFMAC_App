-- ================================================================
-- MIGRACIÓN: Agregar campo doc_number a tabla invoices
-- Fecha: 2026-10-05
-- Motivo: Separar N° OC (invoice_number) del N° Comprobante emitido
-- ================================================================

-- Agregar columna doc_number (nullable, texto libre)
ALTER TABLE invoices
    ADD COLUMN IF NOT EXISTS doc_number TEXT DEFAULT NULL;

-- Comentario descriptivo para el schema
COMMENT ON COLUMN invoices.doc_number IS
    'Número de Comprobante emitido (Factura o Boleta Electrónica). '
    'Separado del campo invoice_number que almacena el N° de Orden de Compra (OC).';

-- Índice para búsquedas por comprobante
CREATE INDEX IF NOT EXISTS idx_invoices_doc_number ON invoices (doc_number)
    WHERE doc_number IS NOT NULL;
