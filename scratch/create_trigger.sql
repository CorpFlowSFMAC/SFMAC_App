-- ============================================================
-- SQL Script para crear Trigger de closure_date automático
-- Ejecutar en PostgreSQL (Supabase Dashboard > SQL Editor)
-- ============================================================

-- 1. Eliminar trigger y función existentes (si hay)
DROP TRIGGER IF EXISTS tr_populate_closure_date ON tickets;
DROP FUNCTION IF EXISTS populate_closure_date_tg();

-- 2. Crear la función
CREATE OR REPLACE FUNCTION populate_closure_date_tg()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status_id IN ('ticket_cerrado', 'liquidado') AND NEW.closure_date IS NULL THEN
    NEW.closure_date := NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Crear el trigger
CREATE TRIGGER tr_populate_closure_date
BEFORE INSERT OR UPDATE ON tickets
FOR EACH ROW
EXECUTE FUNCTION populate_closure_date_tg();

-- 4. Verificar que se creó
SELECT tgname, tgname 
FROM pg_trigger 
WHERE tgname = 'tr_populate_closure_date';

-- 5. Verificación: probar con un ticket de prueba
-- UPDATE tickets SET closure_date = NULL WHERE id = 'TU-TICKET-ID-AQUI';
-- UPDATE tickets SET status_id = 'ticket_cerrado' WHERE id = 'TU-TICKET-ID-AQUI';
-- SELECT id, status_id, closure_date FROM tickets WHERE id = 'TU-TICKET-ID-AQUI';
