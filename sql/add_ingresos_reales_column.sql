-- ============================================================
-- Fix: Agregar columna ingresos_reales a la tabla tickets
-- ============================================================
-- Esta columna almacena el monto base sin IGV (total_quoted_amount / 1.18)
-- para los cálculos de rentabilidad en el dashboard.
--
-- Ejecutar en la consola de Supabase o via psql:
-- psql "postgresql://postgres:[PASSWORD]@[HOST]:5432/[DATABASE]" -f add_ingresos_reales_column.sql
-- ============================================================

-- Agregar la columna si no existe físicamente
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS ingresos_reales NUMERIC(12, 2) DEFAULT 0;

-- Backfill automático inicial removiendo el IGV de los registros anteriores
UPDATE tickets 
SET ingresos_reales = ROUND((COALESCE(total_quoted_amount, montoFinal, 0)::NUMERIC / 1.18), 2)
WHERE (total_quoted_amount > 0 OR montoFinal > 0) AND (ingresos_reales IS NULL OR ingresos_reales = 0);

-- Agregar índice para mejorar el rendimiento de las consultas
CREATE INDEX IF NOT EXISTS idx_tickets_ingresos_reales ON tickets(ingresos_reales);
CREATE INDEX IF NOT EXISTS idx_tickets_closure_date ON tickets(closure_date);

-- Comentario para documentación
COMMENT ON COLUMN tickets.ingresos_reales IS 'Monto base sin IGV del ticket (total_quoted_amount / 1.18). Fuente para cálculos de rentabilidad.';

-- Verificar los cambios
SELECT 
    'Columnas en tickets:' AS info,
    column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'tickets' 
  AND column_name IN ('ingresos_reales', 'total_quoted_amount', 'montoFinal', 'closure_date')
ORDER BY column_name;
