-- ============================================================================
-- SINFIMAC - RPC ULTRA-LIGERA PARA TESORERÍA
-- ============================================================================
-- Problema: La RPC actual procesa TODOS los tickets coincidentes ANTES del LIMIT
-- Solución: Esta RPC aplica LIMIT ANTES de procesar metadata pesada
--
-- EJECUTAR EN SUPABASE SQL EDITOR
-- ============================================================================

CREATE OR REPLACE FUNCTION get_payment_tickets_light()
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
            -- Metadata ligera: solo campos esenciales para Tesorería
            jsonb_build_object(
                'solicitudAdelanto', t.metadata->'solicitudAdelanto',
                'solicitudAdelantoExtra', t.metadata->'solicitudAdelantoExtra',
                'solicitudLiquidacion', t.metadata->'solicitudLiquidacion',
                'solicitudPagoVisita', t.metadata->'solicitudPagoVisita',
                'adelantoPagado', t.metadata->'adelantoPagado',
                'visitPaymentConfirmed', t.metadata->'visitPaymentConfirmed',
                'montoFinal', t.metadata->'montoFinal',
                'numeroTicketCliente', t.metadata->'numeroTicketCliente',
                -- Pruneamos vouchers de solicitudes de depósito en vuelo
                'solicitudesDeposito', (
                    SELECT COALESCE(jsonb_agg(s - 'voucherRef'), '[]'::jsonb)
                    FROM jsonb_array_elements(
                        CASE 
                            WHEN jsonb_typeof(t.metadata->'solicitudesDeposito') = 'array' THEN t.metadata->'solicitudesDeposito'
                            ELSE '[]'::jsonb 
                        END
                    ) s
                ),
                -- Pruneamos vouchers del historial de pagos
                'historialPagosTecnico', (
                    SELECT COALESCE(jsonb_agg(
                        p - 'voucherRef' || jsonb_build_object('hasVoucher', (p->>'voucherRef') IS NOT NULL AND (p->>'voucherRef') != '')
                    ), '[]'::jsonb)
                    FROM jsonb_array_elements(
                        CASE 
                            WHEN jsonb_typeof(t.metadata->'historialPagosTecnico') = 'array' THEN t.metadata->'historialPagosTecnico'
                            ELSE '[]'::jsonb 
                        END
                    ) p
                )
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
        WHERE t.status_id NOT IN ('borrador', 'nuevo', 'rechazado', 'cancelado')
        ORDER BY t.created_at DESC
        LIMIT 50  -- 🔑 KEY FIX: LIMIT desde el inicio, antes de procesar metadata
    ) stmt;
    
    RETURN COALESCE(result, '[]'::jsonb);
END;
$$;

-- Verificar que se creó correctamente
SELECT proname, pronargs FROM pg_proc WHERE proname = 'get_payment_tickets_light';
