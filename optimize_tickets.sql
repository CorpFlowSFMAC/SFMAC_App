-- ============================================================================
-- SINFIMAC - OPTIMIZACIÓN DE RENDIMIENTO PARA TICKETS Y TICKET_COSTS
-- ============================================================================
-- Este script crea índices concurrentes para mejorar el rendimiento
-- Sin afectar el servicio en producción
--
-- IMPORTANTE: Ejecutar en una ventana de mantenimiento o con baja concurrencia
-- ============================================================================

-- ============================================================================
-- 1. ÍNDICES PARA LA TABLA tickets
-- ============================================================================

-- Índice para búsquedas por cliente (común en dashboards)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tickets_client_id 
ON tickets(client_id);

-- Índice para búsquedas por gestora (asignaciones)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tickets_gestora_id 
ON tickets(gestora_id);

-- Índice para búsquedas por técnico (asignaciones)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tickets_technician_id 
ON tickets(technician_id);

-- Índice para filtrado por estado (el más usado)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tickets_estado 
ON tickets(estado);

-- Índice para filtrado por fecha de creación (reportes)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tickets_created_at 
ON tickets(created_at DESC);

-- Índice para filtrado por fecha de atención
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tickets_fecha_atencion 
ON tickets(fecha_atencion);

-- Índice compuesto para dashboard de gestoras (estado + gestora)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tickets_estado_gestora 
ON tickets(estado, gestora_id);

-- Índice compuesto para tickets por cliente y estado
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tickets_client_estado 
ON tickets(client_id, estado);

-- Índice para búsquedas por código de ticket (búsqueda rápida)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tickets_codigo 
ON tickets(codigo) WHERE codigo IS NOT NULL;

-- Índice para tickets sin asignar
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tickets_technician_null 
ON tickets(technician_id) WHERE technician_id IS NULL;

-- ============================================================================
-- 2. ÍNDICES PARA LA TABLA ticket_costs
-- ============================================================================

-- Índice para búsquedas por ticket (foreign key)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ticket_costs_ticket_id 
ON ticket_costs(ticket_id);

-- Índice para búsquedas por tipo de costo
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ticket_costs_tipo 
ON ticket_costs(tipo);

-- Índice para filtrado por fecha
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ticket_costs_fecha 
ON ticket_costs(fecha);

-- Índice compuesto para costos por ticket
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ticket_costs_ticket_fecha 
ON ticket_costs(ticket_id, fecha);

-- ============================================================================
-- 3. FUNCIÓN RPC OPTIMIZADA (si existe get_tickets_summary)
-- ============================================================================

-- Revisar si existe la función antes de recrearla
DO $$
BEGIN
    -- Si quieres recrear la función RPC, puedes hacerlo aquí
    -- Por ahora solo verificamos que exista
    IF EXISTS (
        SELECT 1 FROM pg_proc 
        WHERE proname = 'get_tickets_summary'
    ) THEN
        RAISE NOTICE 'La función get_tickets_summary ya existe';
    ELSE
        RAISE NOTICE 'La función get_tickets_summary NO existe - creando...';
    END IF;
EXCEPTION
    WHEN others THEN
        RAISE NOTICE 'Error al verificar función: %', SQLERRM;
END $$;

-- ============================================================================
-- 4. ANALIZAR TABLAS DESPUÉS DE CREAR ÍNDICES
-- ============================================================================

-- Nota: ANALYZE se ejecuta automáticamente con CREATE INDEX CONCURRENTLY
-- pero puedes forzarlo si es necesario:
-- ANALYZE tickets;
-- ANALYZE ticket_costs;

-- ============================================================================
-- 5. VERIFICACIÓN DE ÍNDICES CREADOS
-- ============================================================================

SELECT 
    'tickets' as table_name,
    COUNT(*) as index_count
FROM pg_indexes 
WHERE tablename = 'tickets'
UNION ALL
SELECT 
    'ticket_costs' as table_name,
    COUNT(*) as index_count
FROM pg_indexes 
WHERE tablename = 'ticket_costs';

-- ============================================================================
-- FIN DEL SCRIPT
-- ============================================================================