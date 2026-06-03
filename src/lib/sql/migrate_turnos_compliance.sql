-- =====================================================
-- MIGRACIÓN: Extensión de tabla 'turnos' para cumplimiento legal
-- Fecha: 2026-06
-- Política: CERO DUPLICACIÓN — solo añadir columnas faltantes
-- =====================================================
-- Columnas REUTILIZADAS (ya existen, NO tocar):
--   id, usuario_email, usuario_nombre, fecha,
--   hora_ingreso, hora_salida, estado, created_at
-- =====================================================

-- PASO A: Añadir columnas de compliance (IF NOT EXISTS = idempotente)
ALTER TABLE turnos
  ADD COLUMN IF NOT EXISTS inicio_refrigerio TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS fin_refrigerio    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS ip_address        TEXT,
  ADD COLUMN IF NOT EXISTS device_info       TEXT,
  ADD COLUMN IF NOT EXISTS latitude          NUMERIC,
  ADD COLUMN IF NOT EXISTS longitude         NUMERIC;

-- PASO B: Migrar valores del campo 'estado' al nuevo vocabulario estandarizado
-- Valores anteriores: 'EN_CURSO' → 'en_jornada', 'CERRADO' → 'finalizado'
-- Esta operación es idempotente (WHERE filtra sólo los que aún tienen el valor viejo)
UPDATE turnos SET estado = 'en_jornada'  WHERE estado = 'EN_CURSO';
UPDATE turnos SET estado = 'finalizado'  WHERE estado = 'CERRADO';

-- PASO C: Añadir check constraint para el nuevo flujo de 4 estados
-- (DROP + ADD en bloque para evitar conflicto con constraint anterior si existiera)
ALTER TABLE turnos DROP CONSTRAINT IF EXISTS turnos_estado_check;
ALTER TABLE turnos ADD CONSTRAINT turnos_estado_check
  CHECK (estado IN ('en_jornada', 'en_refrigerio', 'finalizado'));

-- PASO D: Índice de rendimiento para el gatekeeper (consulta por email + fecha + estado)
CREATE INDEX IF NOT EXISTS idx_turnos_gatekeeper
  ON turnos (usuario_email, fecha, estado);

-- =====================================================
-- VERIFICACIÓN: ejecutar después de la migración
-- SELECT column_name, data_type FROM information_schema.columns
--   WHERE table_name = 'turnos' ORDER BY ordinal_position;
-- =====================================================
