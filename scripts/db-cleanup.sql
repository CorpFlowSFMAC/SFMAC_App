-- ============================================================
-- SINFIMAC - LIMPIEZA TOTAL DE BASE DE DATOS
-- ============================================================
-- ⚠️  ADVERTENCIA: Este script ELIMINA TODOS LOS DATOS
-- 
-- Uso: Ejecutar en SQL Editor de Supabase Dashboard
-- (Se requiere rol de service_role o propietario)
-- ============================================================

-- Configuración: Desactivar RLS temporalmente para permitir deletes
ALTER TABLE ticket_payments DISABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_costs DISABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_evidences DISABLE ROW LEVEL SECURITY;
ALTER TABLE tickets DISABLE ROW LEVEL SECURITY;
ALTER TABLE debug_logs DISABLE ROW LEVEL SECURITY;

-- Iniciar transacción para atomicidad
BEGIN;

-- ══════════════════════════════════════════════════════════════
-- TABLAS RELACIONADAS A TICKETS (primero las dependientes)
-- ══════════════════════════════════════════════════════════════

-- 1. Eliminar ticket_payments (relación: ticket_id → tickets)
DELETE FROM ticket_payments;
SELECT '✓ ticket_payments eliminado' AS resultado;

-- 2. Eliminar ticket_costs (relación: ticket_id → tickets)  
DELETE FROM ticket_costs;
SELECT '✓ ticket_costs eliminado' AS resultado;

-- 3. Eliminar ticket_evidences (relación: ticket_id → tickets)
DELETE FROM ticket_evidences;
SELECT '✓ ticket_evidences eliminado' AS resultado;

-- ══════════════════════════════════════════════════════════════
-- TABLAS PRINCIPALES
-- ══════════════════════════════════════════════════════════════

-- 4. Eliminar tickets (tabla principal)
DELETE FROM tickets;
SELECT '✓ tickets eliminado' AS resultado;

-- 5. Limpiar logs de debug (datos de desarrollo)
DELETE FROM debug_logs;
SELECT '✓ debug_logs eliminado' AS resultado;

-- 6. Limpiar assignments de gestoras a agencias
DELETE FROM gestora_branch_assignments;
SELECT '✓ gestionnaire_branch_assignments eliminado' AS resultado;

-- 7. Limpiar asignación de técnicos a agencias  
DELETE FROM technician_branches;
SELECT '✓ technician_branches eliminado' AS resultado;

-- 8. Limpiar tickets de prueba si los hay en otras tablas
-- (Ya se eliminaron en los pasos anteriores)

-- ══════════════════════════════════════════════════════════════
-- CONFIRMAR Y VERIFICAR
-- ══════════════════════════════════════════════════════════════

COMMIT;

-- Reactivar RLS
ALTER TABLE ticket_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_costs ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_evidences ENABLE ROW LEVEL SECURITY;
ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE debug_logs ENABLE ROW LEVEL SECURITY;

-- Verificar limpieza total
SELECT 
    'ticket_payments' AS tabla, COUNT(*) AS registros FROM ticket_payments
UNION ALL
SELECT 'ticket_costs', COUNT(*) FROM ticket_costs
UNION ALL
SELECT 'ticket_evidences', COUNT(*) FROM ticket_evidences
UNION ALL
SELECT 'tickets', COUNT(*) FROM tickets
UNION ALL
SELECT 'debug_logs', COUNT(*) FROM debug_logs
UNION ALL
SELECT 'gestora_branch_assignments', COUNT(*) FROM gestora_branch_assignments
UNION ALL
SELECT 'technician_branches', COUNT(*) FROM technician_branches;

-- Resetear sequences de IDs (opcional, reinicia contador)
-- SELECT setval('tickets_id_seq', 1, false);

SELECT '✓ LIMPIEZA COMPLETADA' AS estado;