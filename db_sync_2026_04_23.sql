-- MIGRACIÓN DE SINCRONIZACIÓN - 23/04/2026
-- Objetivo: Optimización de Tesorería y Flujo de Rescate Financiero

-- 1. TRIGGER PARA DETECCIÓN DE EXCEDENTES EN COSTOS DE TICKET
CREATE OR REPLACE FUNCTION check_labor_cost_exceedance()
RETURNS TRIGGER AS $$
DECLARE
    v_labor_cost NUMERIC;
BEGIN
    -- Obtenemos el labor_cost pactado del ticket
    SELECT labor_cost INTO v_labor_cost FROM tickets WHERE id = NEW.ticket_id;

    -- Si es un costo de Mano de Obra y excede el labor_cost
    IF NEW.categoria = 'Mano de Obra' AND NEW.monto > v_labor_cost THEN
        -- Si no tiene motivo, lanzamos error (protección DB)
        IF NEW.motivo IS NULL OR NEW.motivo = '' THEN
            RAISE EXCEPTION 'Para exceder el costo pactado de mano de obra, debe proporcionar un motivo de justificación.';
        END IF;

        -- Forzamos estado a aprobación administrativa si excede
        NEW.estado_pago := 'REQUIERE_APROBACION_ADMIN';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_check_labor_cost_exceedance ON ticket_costs;
CREATE TRIGGER trg_check_labor_cost_exceedance
BEFORE INSERT OR UPDATE ON ticket_costs
FOR EACH ROW
EXECUTE FUNCTION check_labor_cost_exceedance();


-- 2. RPC OPTIMIZADO PARA TESORERÍA (v3)
-- Elimina automáticamente base64 de metadatos pesados para evitar Timeouts
CREATE OR REPLACE FUNCTION get_payment_tickets_v2()
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
            -- Procesamos la metadata de forma ultra-ligera (Solo campos esenciales para Tesorería)
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
            -- Relaciones procesadas
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
           OR (t.metadata->'historialPagosTecnico') IS NOT NULL
           OR (t.metadata->'solicitudAdelanto') IS NOT NULL
           OR EXISTS (SELECT 1 FROM ticket_costs tc WHERE tc.ticket_id = t.id)
        ORDER BY t.created_at DESC
    ) stmt;

    RETURN COALESCE(result, '[]'::jsonb);
END;
$$;
