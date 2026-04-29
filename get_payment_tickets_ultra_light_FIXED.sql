-- ============================================================
-- SINFIMAC - RPC OPTIMIZADA PARA TESORERÍA
-- Sin columnas inexistentes, con datos financieros completos
-- ============================================================

CREATE OR REPLACE FUNCTION get_payment_tickets_ultra_light()
RETURNS jsonb LANGUAGE plpgsql
AS $body$
DECLARE
    result jsonb;
BEGIN
    -- CTE para pre-agrupar ticket_costs por ticket_id
    WITH costs_agg AS (
        SELECT ticket_id, jsonb_agg(jsonb_build_object(
            'id', id,
            'ticket_id', ticket_id,
            'amount', monto,
            'estado_pago', estado_pago,
            'type', categoria,
            'concepto', concepto,
            'monto', monto,
            'created_at', created_at
        )) as costos
        FROM ticket_costs
        GROUP BY ticket_id
    )
    SELECT jsonb_agg(stmt) INTO result
    FROM (
        SELECT
            t.id,
            t.ticket_number,
            t.status_id,
            t.service_type,
            t.description,
            t.client_ticket_number,
            t.created_at,
            -- ★ CAMPOS FINANCIEROS COMPLETOS
            t.labor_cost,
            t.materials_cost,
            t.visit_cost,
            t.total_quoted_amount,
            t.client_id,
            t.branch_id,
            t.technician_id,
            t.gestora_id,
            t.diagnosis,
            t.priority,
            t.sede_reportada_cliente,
            -- ★ METADATA COMPLETA
            t.metadata,
            -- ★ COSTOS PACKAGED desde la subconsulta
            COALESCE(ca.costos, '[]'::jsonb) as costos,
            -- Datos de clientes
            jsonb_build_object(
                'id', c.id,
                'name', c.name,
                'ruc', c.ruc,
                'logo', c.logo,
                'phone', c.phone,
                'email', c.email
            ) as clients,
            -- Datos de agencia
            jsonb_build_object(
                'id', b.id,
                'name', b.name,
                'address', b.address,
                'district', b.distrito
            ) as branch_offices,
            -- Datos de técnico
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
            -- Datos de gestora
            jsonb_build_object(
                'id', g.id,
                'name', g.name
            ) as gestoras
        FROM tickets t
        LEFT JOIN clients c ON c.id = t.client_id
        LEFT JOIN branch_offices b ON b.id = t.branch_id
        LEFT JOIN technicians tech ON tech.id = t.technician_id
        LEFT JOIN gestoras g ON g.id = t.gestora_id
        LEFT JOIN costs_agg ca ON ca.ticket_id = t.id
        WHERE t.status_id NOT IN ('borrador', 'rechazado', 'cancelado')
        ORDER BY t.created_at DESC
        LIMIT 100
    ) stmt;
    RETURN COALESCE(result, '[]'::jsonb);
END;
$body$;