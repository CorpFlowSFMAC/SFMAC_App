import { Client } from 'ssh2';

const conn = new Client();

const sql = `
-- Drop strategic views to recreate with correct category mapping
DROP VIEW IF EXISTS public.vw_tickets_strategic CASCADE;
DROP VIEW IF EXISTS public.vw_ticket_financials CASCADE;

-- Create corrected vw_ticket_financials view
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
FROM public.tickets t
LEFT JOIN costos_confirmados c ON c.ticket_id = t.id;

-- Create vw_tickets_strategic
CREATE OR REPLACE VIEW public.vw_tickets_strategic AS
SELECT 
    t.*,
    COALESCE(t.labor_cost::numeric, 0) - vf.adelantos_flujo_b AS saldo_tecnico,
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

-- Grant permissions
GRANT SELECT ON public.vw_ticket_financials TO anon, authenticated, service_role;
GRANT SELECT ON public.vw_tickets_strategic TO anon, authenticated, service_role;

-- Reload Schema for PostgREST
NOTIFY pgrst, 'reload schema';
`;

const escapedSql = sql.replace(/"/g, '\\"').replace(/\$/g, '\\$');
const cmd = `docker exec -i supabase-db psql -U postgres -d postgres -c "${escapedSql}"`;

conn.on('ready', () => {
    console.log('Connecting via SSH to Hetzner to deploy corrected financials views...');
    conn.exec(cmd, (err, stream) => {
        if (err) throw err;
        stream.on('close', (code, signal) => {
            console.log(`SSH command completed with code ${code}`);
            conn.end();
        }).on('data', (data) => {
            process.stdout.write(data.toString());
        }).stderr.on('data', (data) => {
            process.stderr.write(data.toString());
        });
    });
}).connect({
    host: '87.99.137.96',
    port: 22,
    username: 'root',
    password: 'etNpxhE7dKAtRA3aTVEv_Secured'
});
