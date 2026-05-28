import { Client } from 'ssh2';

const conn = new Client();

const sql = `
-- Drop existing view if it exists
DROP VIEW IF EXISTS public.vw_tickets_strategic CASCADE;

-- Create vw_tickets_strategic
CREATE OR REPLACE VIEW public.vw_tickets_strategic AS
SELECT 
    t.*,
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

-- Grant permissions on views
GRANT SELECT ON public.vw_ticket_financials TO anon, authenticated, service_role;
GRANT SELECT ON public.vw_tickets_strategic TO anon, authenticated, service_role;

-- Drop function if exists
DROP FUNCTION IF EXISTS public.get_strategic_metrics(text, text) CASCADE;
DROP FUNCTION IF EXISTS public.get_strategic_metrics(timestamp, timestamp) CASCADE;

-- Create get_strategic_metrics function accepting text arguments (standard from JS client)
CREATE OR REPLACE FUNCTION public.get_strategic_metrics(p_start_date text, p_end_date text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_start timestamp;
    v_end timestamp;
    v_ingresos numeric;
    v_inversion numeric;
BEGIN
    v_start := p_start_date::timestamp;
    v_end := p_end_date::timestamp;

    -- Calculate total revenues from tickets created or closed in the range
    SELECT COALESCE(sum(vf.ingresos_reales), 0)
    INTO v_ingresos
    FROM public.tickets t
    JOIN public.vw_ticket_financials vf ON t.id = vf.ticket_id
    WHERE (t.created_at >= v_start AND t.created_at <= v_end)
       OR (t.closure_date >= v_start AND t.closure_date <= v_end);

    -- Calculate total investments executed in the range
    SELECT COALESCE(sum(vf.inversion_ejecutada), 0)
    INTO v_inversion
    FROM public.tickets t
    JOIN public.vw_ticket_financials vf ON t.id = vf.ticket_id
    WHERE (t.created_at >= v_start AND t.created_at <= v_end)
       OR (t.closure_date >= v_start AND t.closure_date <= v_end);

    RETURN jsonb_build_object(
        'ingresos_generados', v_ingresos,
        'inversion_ejecutada', v_inversion
    );
END;
$$;

-- Grant permissions on function
GRANT EXECUTE ON FUNCTION public.get_strategic_metrics(text, text) TO anon, authenticated, service_role;

-- Reload schema for PostgREST
NOTIFY pgrst, 'reload schema';
`;

// Run DDL inside docker container
const escapedSql = sql.replace(/"/g, '\\"').replace(/\$/g, '\\$');
const cmd = `docker exec -i supabase-db psql -U postgres -d postgres -c "${escapedSql}"`;

conn.on('ready', () => {
  console.log('Connecting via SSH to execute strategic view DDL...');
  conn.exec(cmd, (err, stream) => {
    if (err) throw err;
    stream.on('close', (code, signal) => {
      console.log(`SSH command finished with code ${code}`);
      conn.end();
    }).on('data', (data) => {
      console.log('STDOUT: ' + data.toString());
    }).stderr.on('data', (data) => {
      console.log('STDERR: ' + data.toString());
    });
  });
}).connect({
  host: '87.99.137.96',
  port: 22,
  username: 'root',
  password: 'etNpxhE7dKAtRA3aTVEv_Secured'
});
