-- =====================================================
-- MIGRACIÓN: Extensión tabla 'turnos' para asistencia motivacional pastel
-- Fecha: 2026-06-27
-- Política: CERO DUPLICACIÓN — solo añadir columnas faltantes
-- =====================================================

-- PASO A: Añadir columnas de clasificación de asistencia
ALTER TABLE turnos
  ADD COLUMN IF NOT EXISTS status_attendance TEXT,
  ADD COLUMN IF NOT EXISTS ticket_id UUID,
  ADD COLUMN IF NOT EXISTS location_gps TEXT;

-- PASO B: Actualizar constraint de estado (drop + re-create idempotente)
ALTER TABLE turnos DROP CONSTRAINT IF EXISTS turnos_estado_check;
ALTER TABLE turnos ADD CONSTRAINT turnos_estado_check
  CHECK (estado IN ('en_jornada', 'en_refrigerio', 'finalizado'));

-- PASO C: Índice para consultas de status_attendance
CREATE INDEX IF NOT EXISTS idx_turnos_status_attendance
  ON turnos (fecha, status_attendance);

-- =====================================================
-- VERIFICACIÓN:
-- SELECT column_name, data_type FROM information_schema.columns
--   WHERE table_name = 'turnos' ORDER BY ordinal_position;
-- =====================================================
