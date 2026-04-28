-- ============================================================================
-- SINFIMAC - RPC ULTRA-LIGERA V2 PARA TESORERÍA (SIN LÍMITES)
-- ============================================================================
-- Problema: Tickets con Adelanto no aparecen en Tesorería
-- Causa: Los filtros de estado excluyen tickets donde estado = 'esperando_aprobacion_presupuesto' o similar
-- Solución: Esta RPC muestra TODOS los tickets excepto cancelados/rechazados
--
-- EJECUTAR EN SUPABASE SQL EDITOR
-- ============================================================================

CREATE OR REPLACE FUNCTION get_payment_tickets_ultra_light_v2()
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
            t.labor_cost,
            t.materials_cost,
            t.visit_cost,
            t.total_quoted_amount,
            t.client_id,
            t.branch_id,
            t.technician_id,
            t.gestora_id,
            -- Metadata completa para pagos
            jsonb_build_object(
                'solicitudAdelanto', t.metadata->'solicitudAdelanto',
                'solicitudAdelantoExtra', t.metadata->'solicitudAdelantoExtra',
                'solicitudLiquidacion', t.metadata->'solicitudLiquidacion',
                'solicitudPagoVisita', t.metadata->'solicitudPagoVisita',
                'adelantoPagado', t.metadata->'adelantoPagado',
                'visitPaymentConfirmed', t.metadata->'visitPaymentConfirmed',
                'montoFinal', t.metadata->'montoFinal',
                'montoAdelanto', t.metadata->'montoAdelanto',
                'porcentajeAdelanto', t.metadata->'porcentajeAdelanto',
                'numeroTicketCliente', t.metadata->'numeroTicketCliente',
                'historialPagosTecnico', t.metadata->'historialPagosTecnico',
                'solicitudesDeposito', t.metadata->'solicitudesDeposito'
            ) as metadata,
            jsonb_build_object('id', c.id, 'name', c.name, 'ruc', c.ruc, 'logo', c.logo) as clients,
            jsonb_build_object(
                'id', b.id,
                'name', b.name,
                'address', b.address,
                'zonas', jsonb_build_object('id', z.id, 'name', z.nombre)
            ) as branch_offices,
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
            jsonb_build_object('id', g.id, 'name', g.name) as gestora
        FROM tickets t
        LEFT JOIN clients c ON c.id = t.client_id
        LEFT JOIN branch_offices b ON b.id = t.branch_id
        LEFT JOIN zonas z ON z.id = b.zona_id
        LEFT JOIN technicians tech ON tech.id = t.technician_id
        LEFT JOIN gestoras g ON g.id = t.gestora_id
        -- ★ INCLUIR TODOS excepto cancelados/rechazados/borrador
        WHERE t.status_id NOT IN ('borrador', 'rechazado', 'cancelado')
        ORDER BY t.created_at DESC
        LIMIT 100
    ) stmt;

    RETURN COALESCE(result, '[]'::jsonb);
END;
$$;

-- Verificar
SELECT proname FROM pg_proc WHERE proname LIKE 'get_payment_tickets%ultra%';