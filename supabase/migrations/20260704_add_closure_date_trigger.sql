-- ============================================================
-- Migration: Add closure_date auto-populate trigger
-- Date: 2026-07-04
-- Purpose: Auto-populate closure_date when ticket enters 
--          ticket_cerrado or liquidado state
-- ============================================================

-- Create function to auto-populate closure_date
CREATE OR REPLACE FUNCTION populate_closure_date_tg()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status_id IN ('ticket_cerrado', 'liquidado') AND NEW.closure_date IS NULL THEN
    NEW.closure_date := NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS tr_populate_closure_date ON tickets;
CREATE TRIGGER tr_populate_closure_date
BEFORE INSERT OR UPDATE ON tickets
FOR EACH ROW
EXECUTE FUNCTION populate_closure_date_tg();

-- ============================================================
-- Migration: Populate NULL closure_date from updated_at
-- Date: 2026-07-04
-- Purpose: Fix historical tickets without closure_date
-- Note: This was already executed via fix_closure_date_supabase.js
-- ============================================================
-- UPDATE tickets SET closure_date = updated_at 
-- WHERE status_id = 'ticket_cerrado' AND closure_date IS NULL;
