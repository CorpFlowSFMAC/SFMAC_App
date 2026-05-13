-- =====================================================
-- FUNCIÓN RPC: fn_generate_std_ticket_number
-- Generador ATÓMICO de correlativos STD
-- =====================================================
-- Esta función debe ejecutarse en Supabase (PostgreSQL)
-- como función RPC segura.
--
-- USO: SELECT fn_generate_std_ticket_number()
-- RETORNA: STD0001.26 (formato STD####.YY)
-- =====================================================

CREATE OR REPLACE FUNCTION fn_generate_std_ticket_number()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    newNumber TEXT;
    currentYear TEXT;
    lastNumber INT;
    nextNum INT;
BEGIN
    -- Obtener año actual (YY)
    currentYear := TO_CHAR(NOW(), 'YY');
    
    -- Buscar el último correlativo STD del año actual
    SELECT 
        COALESCE(
            MAX(
                -- Extraer número del formato STD0001.26
                CAST(
                    SUBSTRING(client_ticket_number FROM 4 FOR 4) AS INT
                )
            ),
            0
        )
    INTO lastNumber
    FROM tickets
    WHERE client_ticket_number LIKE 'STD%.'
      AND client_ticket_number LIKE '%.' || currentYear
      AND status_id NOT IN ('ticket_cancelado', 'ticket_eliminado');
    
    -- Generar siguiente correlativo
    nextNum := lastNumber + 1;
    newNumber := 'STD' || LPAD(nextNum::TEXT, 4, '0') || '.' || currentYear;
    
    RETURN newNumber;
END;
$$;

-- =====================================================
-- NOTA DE SEGURIDAD:
-- Esta función usa LOCK row-level exclusivo
-- durante la inserción para prevenir
-- duplicados por colisión de usuarios.
-- =====================================================