-- ============================================================================
-- SINFIMAC - RPC COMPLETA PARA TESORERÍA (TODOS LOS DATOS)
-- ============================================================================
-- Problema: Las versiones "light" recortan datos y causan S/ 0.00
-- Solución: Esta RPC devuelve el payload COMPLETO sin límites ni podas
--
-- EJECUTAR EN SUPABASE SQL EDITOR
-- ============================================================================

CREATE OR REPLACE FUNCTION get_payment_tickets_ultra_light_full()
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
    result jsonb;
BEGIN
    SELECT jsonb_agg(stmt)
    INTO result
    FROM (
        SELECT
            t.id,
            t.status_id,
            t.service_type,
            t.description,
            t.client_ticket_number,
            t.created_at,
            -- ★ TODOS LOS CAMPOS DE COSTOS COMPLETOS
            t.labor_cost,
            t.materials_cost,
            t.visit_cost,
            t.total_quoted_amount,
            t.district,
            t.address,
            t.notes,
            t.client_id,
            t.branch_id,
            t.technician_id,
            t.gestora_id,
            -- ★ METADATA COMPLETA SIN PODAS
            t.metadata,
            -- ★ CLIENTE COMPLETO
            jsonb_build_object(
                'id', c.id, 
                'name', c.name, 
                'ruc', c.ruc, 
                'logo', c.logo,
                'phone', c.phone,
                'email', c.email
            ) as clients,
            -- ★ SUCURSAL COMPLETA
            jsonb_build_object(
                'id', b.id, 
                'name', b.name, 
                'address', b.address,
                'zonas', jsonb_build_object('id', z.id, 'name', z.nombre)
            ) as branch_offices,
            -- ★ TÉCNICO COMPLETO
            jsonb_build_object(
                'id', tech.id, 
                'name', tech.name, 
                'first_name', tech.first_name, 
                'last_name', tech.last_name, 
                'bank_name', tech.bank_name, 
                'account_number', tech.account_number, 
                'cci', tech.cci, 
                'yape_number', tech.yape_number, 
                'plin_number', tech.plin_number
            ) as technicians,
            -- ★ GESTORA COMPLETA
            jsonb_build_object('id', g.id, 'name', g.name) as gestora
        FROM tickets t
        LEFT JOIN clients c ON c.id = t.client_id
        LEFT JOIN branch_offices b ON b.id = t.branch_id
        LEFT JOIN zonas z ON z.id = b.zona_id
        LEFT JOIN technicians tech ON tech.id = t.technician_id
        LEFT JOIN gestoras g ON g.id = t.gestora_id
        -- ★ INCLUIR TODOSexcepto cancelados/rechazados/borrador
        WHERE t.status_id NOT IN ('borrador', 'rechazado', 'cancelado')
        -- ★ SIN LÍMITE - traer todos los datos
        -- LIMIT 500  -- Comentar si hay timeout, luego ajustar
    ) stmt;

    RETURN COALESCE(result, '[]'::jsonb);
END;
$$;

-- Verificar
-- SELECT proname FROM pg_proc WHERE proname LIKE 'get_payment_tickets%full%';