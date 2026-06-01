import { Client } from 'ssh2';

const conn = new Client();

const sqlScript = `
-- Drop strategic views first to avoid lock errors when recreating vw_ticket_financials
DROP VIEW IF EXISTS public.vw_tickets_strategic CASCADE;
DROP VIEW IF EXISTS public.vw_ticket_financials CASCADE;

-- Recreate vw_ticket_financials with dynamic created_at and original_created_at fields
CREATE OR REPLACE VIEW public.vw_ticket_financials AS
WITH costos_confirmados AS (
    SELECT 
        ticket_costs.ticket_id,
        COALESCE(
            ROUND(
                SUM(ticket_costs.monto) FILTER (
                    WHERE ticket_costs.categoria = ANY (ARRAY['Materiales', 'Logística', 'Viáticos', 'Movilidad', 'Viáticos / Movilidad', 'Envíos', 'Compras', 'Otros Gastos', 'Otros'])
                    AND ticket_costs.estado_pago IN ('pagado', 'confirmado', 'abonado', 'transferido', 'completado', 'depósito', 'deposito')
                )::numeric
            , 2)
        , 0::numeric) AS gastos_flujo_a,
        COALESCE(
            ROUND(
                SUM(ticket_costs.monto) FILTER (
                    WHERE ticket_costs.categoria = ANY (ARRAY['Mano de Obra', 'Adelanto', 'Adelanto Operativo', 'Rescate', 'Rescate Financiero', 'Honorarios', 'Bono'])
                    AND ticket_costs.estado_pago IN ('pagado', 'confirmado', 'abonado', 'transferido', 'completado', 'depósito', 'deposito')
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
    -- Inversión total ejecutada (excluyendo adelantos y adelantos operativos)
    COALESCE(c.gastos_flujo_a, 0::numeric) + COALESCE(
        (SELECT SUM(tc.monto) FROM ticket_costs tc
         WHERE tc.ticket_id = t.id 
         AND tc.categoria IN ('Mano de Obra', 'Rescate', 'Rescate Financiero', 'Honorarios', 'Bono')
         AND tc.estado_pago IN ('pagado', 'confirmado', 'abonado', 'transferido', 'completado', 'depósito', 'deposito')
        )::numeric, 0::numeric) AS inversion_ejecutada,
    -- Utilidad neta = Ingresos - MO Pactada - Gastos Operativos
    CASE
        WHEN t.status_id = ANY (ARRAY['borrador', 'nuevo', 'pendiente', 'tecnico_asignado', 'en_inspeccion', 'visita_realizada', 'en_cotizacion', 'cotizacion_enviada', 'ticket_rechazado', 'ticket_cancelado']) 
            THEN 0::numeric
        ELSE ROUND(
            COALESCE(ROUND((t.metadata ->> 'montoSubtotal')::numeric, 2), ROUND(t.total_quoted_amount / 1.18, 2), 0::numeric) 
            - COALESCE(t.labor_cost::numeric, 0::numeric)
            - COALESCE(c.gastos_flujo_a, 0::numeric)
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
                - COALESCE(t.labor_cost::numeric, 0::numeric)
                - COALESCE(c.gastos_flujo_a, 0::numeric)
            ) / 
            COALESCE(ROUND((t.metadata ->> 'montoSubtotal')::numeric, 2), ROUND(t.total_quoted_amount / 1.18, 2), 0::numeric) 
            * 100
            , 2)
        ELSE 0::numeric
    END AS margen_real,
    -- Saldo técnico = MO Pactada - MO Confirmada
    COALESCE(ROUND(t.labor_cost::numeric, 2), ROUND((t.metadata ->> 'costoManoObra')::numeric, 2), 0::numeric) - COALESCE(c.adelantos_flujo_b, 0::numeric) AS saldo_tecnico,
    
    -- Dynamic Dates for Roll-over (America/Lima local time alignment)
    CASE 
        WHEN t.status_id != 'ticket_cerrado' AND (t.created_at AT TIME ZONE 'America/Lima') < date_trunc('month', now() AT TIME ZONE 'America/Lima') 
        THEN timezone('America/Lima', date_trunc('month', now() AT TIME ZONE 'America/Lima'))
        ELSE t.created_at 
    END AS created_at,
    t.created_at AS original_created_at
FROM public.tickets t
LEFT JOIN costos_confirmados c ON c.ticket_id = t.id;

-- Recreate public.vw_tickets_strategic with overridden created_at and original_created_at columns
CREATE OR REPLACE VIEW public.vw_tickets_strategic AS
SELECT 
    t.id,
    t.ticket_number,
    t.client_id,
    t.branch_id,
    t.technician_id,
    t.status_id,
    t.description,
    t.client_ticket_number,
    t.labor_cost,
    t.materials_cost,
    t.visit_cost,
    t.total_quoted_amount,
    -- DYNAMIC SHIFTED CREATED_AT & ORIGINAL
    vf.created_at,
    vf.original_created_at,
    t.updated_at,
    t.quotation_date,
    t.execution_date,
    t.closure_date,
    t.metadata,
    t.service_type,
    t.created_by,
    t.diagnosis,
    t.priority,
    t.current_step,
    t.is_sla_paused,
    t.sla_pause_date,
    t.sla_reactivation_date,
    t.sede_reportada_cliente,
    t.gestora_id,
    vf.saldo_tecnico,
    vf.utilidad_neta,
    vf.margen_real,
    vf.ingresos_reales,
    vf.monto_pactado_mo,
    vf.gastos_flujo_a,
    vf.adelantos_flujo_b,
    vf.inversion_ejecutada,
    vf.inversion_ejecutada AS total_costs_agg,
    CASE WHEN c.id IS NOT NULL THEN jsonb_build_object('id', c.id, 'name', c.name, 'ruc', c.ruc, 'color_aura', c.color_aura, 'logo', c.logo) ELSE NULL END AS clients,
    CASE WHEN b.id IS NOT NULL THEN jsonb_build_object('id', b.id, 'name', b.name, 'address', b.address, 'zone', b.zone, 'departamento', b.departamento, 'provincia', b.provincia, 'distrito', b.distrito) ELSE NULL END AS branch_offices,
    CASE WHEN tech.id IS NOT NULL THEN jsonb_build_object('id', tech.id, 'name', tech.name, 'first_name', tech.first_name, 'last_name', tech.last_name, 'bank_name', tech.bank_name, 'account_number', tech.account_number, 'cci', tech.cci, 'yape_number', tech.yape_number, 'plin_number', tech.plin_number, 'phone', tech.phone) ELSE NULL END AS technicians,
    CASE WHEN g.id IS NOT NULL THEN jsonb_build_object('id', g.id, 'name', g.name, 'email', g.email) ELSE NULL END AS gestoras,
    CASE WHEN g.id IS NOT NULL THEN jsonb_build_object('id', g.id, 'name', g.name, 'email', g.email) ELSE NULL END AS gestora
FROM public.tickets t
LEFT JOIN public.vw_ticket_financials vf ON t.id = vf.ticket_id
LEFT JOIN public.clients c ON t.client_id = c.id
LEFT JOIN public.branch_offices b ON t.branch_id = b.id
LEFT JOIN public.technicians tech ON t.technician_id = tech.id
LEFT JOIN public.gestoras g ON t.gestora_id = g.id;

-- Grant select permissions
GRANT SELECT ON public.vw_ticket_financials TO anon, authenticated, service_role;
GRANT SELECT ON public.vw_tickets_strategic TO anon, authenticated, service_role;

-- Recreate RPC function get_payment_tickets_ultra_light() with dynamic roll-over date
DROP FUNCTION IF EXISTS public.get_payment_tickets_ultra_light();

CREATE OR REPLACE FUNCTION public.get_payment_tickets_ultra_light() 
RETURNS SETOF jsonb 
LANGUAGE plpgsql 
AS $$ 
BEGIN 
    RETURN QUERY 
    SELECT jsonb_build_object(
        'id', t.id, 
        'ticket_number', t.ticket_number, 
        'status_id', t.status_id, 
        'service_type', t.service_type, 
        'description', t.description, 
        'client_ticket_number', t.client_ticket_number, 
        -- OVERRIDDEN WITH DYNAMIC ROLL-OVER DATE (America/Lima local time alignment)
        'created_at', CASE 
            WHEN t.status_id != 'ticket_cerrado' AND (t.created_at AT TIME ZONE 'America/Lima') < date_trunc('month', now() AT TIME ZONE 'America/Lima') 
            THEN timezone('America/Lima', date_trunc('month', now() AT TIME ZONE 'America/Lima'))
            ELSE t.created_at 
        END, 
        'original_created_at', t.created_at,
        'labor_cost', t.labor_cost, 
        'materials_cost', t.materials_cost, 
        'visit_cost', t.visit_cost, 
        'total_quoted_amount', t.total_quoted_amount, 
        'client_id', t.client_id, 
        'branch_id', t.branch_id, 
        'technician_id', t.technician_id, 
        'gestora_id', t.gestora_id, 
        'diagnosis', t.diagnosis, 
        'priority', t.priority, 
        'sede_reportada_cliente', t.sede_reportada_cliente, 
        'metadata', t.metadata, 
        'costos', l.costos, 
        'clients', jsonb_build_object('id', c.id, 'name', c.name, 'ruc', c.ruc), 
        'branch_offices', jsonb_build_object('id', b.id, 'name', b.name), 
        'technicians', jsonb_build_object('id', tech.id, 'name', tech.name), 
        'gestoras', jsonb_build_object('id', g.id, 'name', g.name)
    )::jsonb 
    FROM tickets t 
    LEFT JOIN clients c ON c.id = t.client_id 
    LEFT JOIN branch_offices b ON b.id = t.branch_id 
    LEFT JOIN technicians tech ON tech.id = t.technician_id 
    LEFT JOIN gestoras g ON g.id = t.gestora_id
    LEFT JOIN LATERAL (
        SELECT COALESCE(jsonb_agg(jsonb_build_object(
            'id', tc.id, 
            'ticket_id', tc.ticket_id, 
            'monto', tc.monto, 
            'estado_pago', tc.estado_pago, 
            'categoria', tc.categoria, 
            'concepto', tc.concepto
        )), '[]'::jsonb)::jsonb as costos 
        FROM ticket_costs tc 
        WHERE tc.ticket_id = t.id
    ) l ON true
    WHERE t.status_id NOT IN ('borrador', 'rechazado', 'cancelado') 
    ORDER BY t.created_at DESC 
    LIMIT 200;
END; 
$$;

-- Grant execution permissions
GRANT EXECUTE ON FUNCTION public.get_payment_tickets_ultra_light() TO anon, authenticated, service_role;

-- Reload schema for PostgREST
NOTIFY pgrst, 'reload schema';
`;

conn.on('ready', () => {
  console.log('SSH Connection established to deploy roll-over rule views...');
  
  const cmd = 'docker exec -i supabase-db psql -U postgres -d postgres';
  conn.exec(cmd, (err, stream) => {
    if (err) {
      console.error('Failed to execute docker exec psql via SSH:', err);
      conn.end();
      return;
    }
    
    let stdout = '';
    let stderr = '';
    
    stream.on('data', (chunk) => {
      stdout += chunk.toString();
    });
    
    stream.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    
    stream.on('close', (code, signal) => {
      console.log('--- SQL STDOUT ---');
      console.log(stdout);
      console.log('--- SQL STDERR ---');
      console.log(stderr);
      console.log(`Command closed with code ${code}`);
      conn.end();
    });
    
    stream.write(sqlScript);
    stream.end();
  });
}).connect({
  host: '87.99.137.96',
  port: 22,
  username: 'root',
  password: 'etNpxhE7dKAtRA3aTVEv_Secured'
});
