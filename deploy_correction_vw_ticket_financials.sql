-- ========================================================
-- DEPLOYMENT SCRIPT: CORRECTED vw_ticket_financials VIEW
-- ========================================================
-- PROBLEM FIXED: 
--   - Backend was including PENDING costs in calculations
--   - Now only CONFIRMED payments are included (pagado, confirmado, etc.)
--   - Uses metadata.montoSubtotal (base sin IGV) for ingresos_reales
-- ========================================================
-- Applied: 2026-05-27
-- ========================================================

-- Fix 1: Replace vw_ticket_financials view
DROP VIEW IF EXISTS vw_ticket_financials;

CREATE OR REPLACE VIEW vw_ticket_financials AS
WITH costos_confirmados AS (
    SELECT 
        ticket_costs.ticket_id,
        COALESCE(
            ROUND(
                SUM(ticket_costs.monto) FILTER (
                    WHERE ticket_costs.categoria = ANY (ARRAY['Materiales', 'Logística', 'Viáticos / Movilidad', 'Compras', 'Otros Gastos'])
                    AND ticket_costs.estado_pago IN ('pagado', 'confirmado', 'adelanto', 'abonado', 'transferido', 'completado', 'depósito', 'deposito')
                )::numeric
            , 2)
        , 0::numeric) AS gastos_flujo_a,
        COALESCE(
            ROUND(
                SUM(ticket_costs.monto) FILTER (
                    WHERE ticket_costs.categoria = ANY (ARRAY['Mano de Obra', 'Adelanto', 'Rescate', 'Rescate Financiero', 'Honorarios', 'Bono'])
                    AND ticket_costs.estado_pago IN ('pagado', 'confirmado', 'adelanto', 'abonado', 'transferido', 'completado', 'depósito', 'deposito')
                )::numeric
            , 2)
        , 0::numeric) AS adelantos_flujo_b
    FROM ticket_costs
    GROUP BY ticket_costs.ticket_id
)
SELECT 
    t.id AS ticket_id,
    t.status_id,
    -- Ingresos reales: montoSubtotal (base sin IGV) o total_quoted_amount/1.18
    CASE
        WHEN t.status_id = ANY (ARRAY['borrador', 'nuevo', 'pendiente', 'tecnico_asignado', 'en_inspeccion', 'visita_realizada', 'en_cotizacion', 'cotizacion_enviada', 'ticket_rechazado', 'ticket_cancelado']) 
            THEN 0::numeric
        ELSE COALESCE(ROUND((t.metadata ->> 'montoSubtotal')::numeric, 2), ROUND(t.total_quoted_amount / 1.18, 2), 0::numeric)
    END AS ingresos_reales,
    -- MO Pactada
    COALESCE(ROUND(t.labor_cost::numeric, 2), ROUND((t.metadata ->> 'costoManoObra')::numeric, 2), 0::numeric) AS monto_pactado_mo,
    -- Gastos operativos confirmados
    COALESCE(c.gastos_flujo_a, 0::numeric) AS gastos_flujo_a,
    -- MO confirmada (adelantos/bonos)
    COALESCE(c.adelantos_flujo_b, 0::numeric) AS adelantos_flujo_b,
    -- Inversión total ejecutada
    COALESCE(c.gastos_flujo_a, 0::numeric) + COALESCE(c.adelantos_flujo_b, 0::numeric) AS inversion_ejecutada,
    -- Utilidad neta = Ingresos - Gastos Operativos - MO Confirmada
    CASE
        WHEN t.status_id = ANY (ARRAY['borrador', 'nuevo', 'pendiente', 'tecnico_asignado', 'en_inspeccion', 'visita_realizada', 'en_cotizacion', 'cotizacion_enviada', 'ticket_rechazado', 'ticket_cancelado']) 
            THEN 0::numeric
        ELSE ROUND(
            COALESCE(ROUND((t.metadata ->> 'montoSubtotal')::numeric, 2), ROUND(t.total_quoted_amount / 1.18, 2), 0::numeric) 
            - COALESCE(c.gastos_flujo_a, 0::numeric) 
            - COALESCE(c.adelantos_flujo_b, 0::numeric)
            , 2)
    END AS utilidad_neta,
    -- Margen real en porcentaje
    CASE
        WHEN 
            CASE
                WHEN t.status_id = ANY (ARRAY['borrador', 'nuevo', 'pendiente', 'tecnico_asignado', 'en_inspeccion', 'visita_realizada', 'en_cotizacion', 'cotizacion_enviada', 'ticket_rechazado', 'ticket_cancelado']) 
                        THEN 0::numeric
                ELSE COALESCE(ROUND((t.metadata ->> 'montoSubtotal')::numeric, 2), ROUND(t.total_quoted_amount / 1.18, 2), 0::numeric)
            END > 0::numeric 
        THEN ROUND(
            (
                COALESCE(ROUND((t.metadata ->> 'montoSubtotal')::numeric, 2), ROUND(t.total_quoted_amount / 1.18, 2), 0::numeric) 
                - COALESCE(c.gastos_flujo_a, 0::numeric) 
                - COALESCE(c.adelantos_flujo_b, 0::numeric)
            ) / 
            COALESCE(ROUND((t.metadata ->> 'montoSubtotal')::numeric, 2), ROUND(t.total_quoted_amount / 1.18, 2), 0::numeric) 
            * 100
            , 2)
        ELSE 0::numeric
    END AS margen_real
FROM tickets t
LEFT JOIN costos_confirmados c ON c.ticket_id = t.id;

-- Fix 2: Update get_ticket_financials_detail RPC function (remove saldo_tecnico reference)
DROP FUNCTION IF EXISTS public.get_ticket_financials_detail(uuid);

CREATE OR REPLACE FUNCTION public.get_ticket_financials_detail(p_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
AS $function$
DECLARE
    result jsonb;
BEGIN
    SELECT jsonb_build_object(
        'utilidad_neta', COALESCE(vf.utilidad_neta, 0),
        'margen_real', COALESCE(vf.margen_real, 0),
        'ingresos_reales', COALESCE(vf.ingresos_reales, 0),
        'total_costs_agg', COALESCE(vf.inversion_ejecutada, 0),
        'monto_pactado_mo', COALESCE(vf.monto_pactado_mo, 0),
        'gastos_flujo_a', COALESCE(vf.gastos_flujo_a, 0),
        'adelantos_flujo_b', COALESCE(vf.adelantos_flujo_b, 0)
    )::jsonb
    INTO result
    FROM vw_ticket_financials vf
    WHERE vf.ticket_id = p_id;

    RETURN COALESCE(result, '{}'::jsonb);
END;
$function$;

-- ========================================================
-- VERIFICATION QUERIES
-- ========================================================

-- Verify ticket MB007973.26:
-- SELECT * FROM vw_ticket_financials WHERE ticket_id = '18069355-5252-4c1a-88c6-22ca26ab58c5';
-- Expected: utilidad_neta = 1057.50, margen_real = 46.59

-- Verify RPC function:
-- SELECT public.get_ticket_financials_detail('18069355-5252-4c1a-88c6-22ca26ab58c5'::uuid);
-- Expected: {"margen_real": 46.59, "utilidad_neta": 1057.50, ...}
