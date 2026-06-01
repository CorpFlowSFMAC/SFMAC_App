import { Client } from 'ssh2';

const conn = new Client();

const sqlScript = `
-- ========================================================
-- 1. DROP EXISTING DEPENDENT VIEWS & SCHEMAS TO PREVENT CONFLICTS
-- ========================================================
DROP VIEW IF EXISTS public.vw_tickets_strategic CASCADE;
DROP VIEW IF EXISTS public.vw_ticket_financials CASCADE;
DROP TABLE IF EXISTS public.tickets CASCADE;
DROP SEQUENCE IF EXISTS public.tickets_ticket_number_seq CASCADE;
DROP TABLE IF EXISTS public.ticket_costs CASCADE;

-- ========================================================
-- 2. CREATE SEQUENCE AND MODERN tickets TABLE
-- ========================================================
CREATE SEQUENCE public.tickets_ticket_number_seq AS integer START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;

CREATE TABLE public.tickets (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    ticket_number integer NOT NULL,
    client_id uuid,
    branch_id uuid,
    technician_id uuid,
    status_id text DEFAULT 'nuevo'::text NOT NULL,
    description text,
    client_ticket_number text,
    labor_cost numeric(10,2) DEFAULT 0,
    materials_cost numeric(10,2) DEFAULT 0,
    visit_cost numeric(10,2) DEFAULT 0,
    total_quoted_amount numeric(10,2) DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    quotation_date timestamp with time zone,
    execution_date timestamp with time zone,
    closure_date timestamp with time zone,
    metadata jsonb DEFAULT '{}'::jsonb,
    service_type text,
    created_by text,
    diagnosis text,
    priority text DEFAULT 'Baja'::text,
    current_step integer DEFAULT 1,
    is_sla_paused boolean DEFAULT false,
    sla_pause_date timestamp with time zone,
    sla_reactivation_date timestamp with time zone,
    sede_reportada_cliente text,
    gestora_id uuid
);

ALTER SEQUENCE public.tickets_ticket_number_seq OWNED BY public.tickets.ticket_number;
ALTER TABLE ONLY public.tickets ALTER COLUMN ticket_number SET DEFAULT nextval('public.tickets_ticket_number_seq'::regclass);
ALTER TABLE ONLY public.tickets ADD CONSTRAINT tickets_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.tickets ADD CONSTRAINT unique_client_ticket_number UNIQUE (client_ticket_number);

-- ========================================================
-- 3. CREATE ticket_costs TABLE
-- ========================================================
CREATE TABLE public.ticket_costs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    ticket_id uuid NOT NULL,
    concepto text NOT NULL,
    categoria text NOT NULL,
    proveedor text,
    monto numeric(12,2) DEFAULT 0 NOT NULL,
    estado_pago text DEFAULT 'pendiente'::text NOT NULL,
    url_comprobante text,
    solicitado_por uuid,
    created_at timestamp with time zone DEFAULT now(),
    specialist_id uuid,
    fecha_pago timestamp with time zone,
    motivo text,
    CONSTRAINT ticket_costs_categoria_check CHECK ((categoria = ANY (ARRAY['Materiales'::text, 'Mano de Obra'::text, 'Logística'::text, 'Viáticos'::text, 'Movilidad'::text, 'Viáticos / Movilidad'::text, 'Envíos'::text, 'Adelanto'::text, 'Adelanto Operativo'::text, 'Rescate Financiero'::text, 'Otros'::text]))),
    CONSTRAINT ticket_costs_estado_pago_check CHECK ((estado_pago = ANY (ARRAY['pendiente'::text, 'pagado'::text, 'adelanto'::text, 'REQUIERE_APROBACION_ADMIN'::text, 'RECHAZADO'::text, 'ANULADO'::text])))
);

ALTER TABLE ONLY public.ticket_costs ADD CONSTRAINT ticket_costs_pkey PRIMARY KEY (id);

-- ========================================================
-- 4. ESTABLISH FOREIGN KEY CONSTRAINTS
-- ========================================================
-- tickets
ALTER TABLE ONLY public.tickets ADD CONSTRAINT tickets_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.tickets ADD CONSTRAINT tickets_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branch_offices(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.tickets ADD CONSTRAINT tickets_technician_id_fkey FOREIGN KEY (technician_id) REFERENCES public.technicians(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.tickets ADD CONSTRAINT tickets_gestora_id_fkey FOREIGN KEY (gestora_id) REFERENCES public.gestoras(id) ON DELETE SET NULL;

-- ticket_costs
ALTER TABLE ONLY public.ticket_costs ADD CONSTRAINT ticket_costs_ticket_id_fkey FOREIGN KEY (ticket_id) REFERENCES public.tickets(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.ticket_costs ADD CONSTRAINT ticket_costs_solicitado_por_fkey FOREIGN KEY (solicitado_por) REFERENCES public.perfiles(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.ticket_costs ADD CONSTRAINT ticket_costs_specialist_id_fkey FOREIGN KEY (specialist_id) REFERENCES public.technicians(id) ON DELETE SET NULL;

-- solicitudes_tesoreria
ALTER TABLE ONLY public.solicitudes_tesoreria ADD CONSTRAINT solicitudes_tesoreria_ticket_id_fkey FOREIGN KEY (ticket_id) REFERENCES public.tickets(id) ON DELETE SET NULL;

-- ticket_evidences
ALTER TABLE ONLY public.ticket_evidences ADD CONSTRAINT ticket_evidences_ticket_id_fkey FOREIGN KEY (ticket_id) REFERENCES public.tickets(id) ON DELETE CASCADE;

-- ticket_payments
ALTER TABLE ONLY public.ticket_payments ADD CONSTRAINT ticket_payments_ticket_id_fkey FOREIGN KEY (ticket_id) REFERENCES public.tickets(id) ON DELETE CASCADE;

-- ========================================================
-- 5. DEPLOY FINANCIAL VIEW (vw_ticket_financials) WITH saldo_tecnico
-- ========================================================
CREATE OR REPLACE VIEW public.vw_ticket_financials AS
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
    END AS margen_real,
    -- Saldo técnico = MO Pactada - MO Confirmada
    COALESCE(ROUND(t.labor_cost::numeric, 2), ROUND((t.metadata ->> 'costoManoObra')::numeric, 2), 0::numeric) - COALESCE(c.adelantos_flujo_b, 0::numeric) AS saldo_tecnico
FROM public.tickets t
LEFT JOIN costos_confirmados c ON c.ticket_id = t.id;

-- ========================================================
-- 6. DEPLOY METRICS RPC FUNCTIONS
-- ========================================================
DROP FUNCTION IF EXISTS public.get_ticket_financials_detail(uuid);

-- Compile it properly
CREATE OR REPLACE FUNCTION public.get_ticket_financials_detail(p_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
    result jsonb;
BEGIN
    SELECT jsonb_build_object(
        'saldo_tecnico', COALESCE(vf.saldo_tecnico, 0),
        'utilidad_neta', COALESCE(vf.utilidad_neta, 0),
        'margen_real', COALESCE(vf.margen_real, 0),
        'ingresos_reales', COALESCE(vf.ingresos_reales, 0),
        'total_costs_agg', COALESCE(vf.inversion_ejecutada, 0),
        'monto_pactado_mo', COALESCE(vf.monto_pactado_mo, 0),
        'gastos_flujo_a', COALESCE(vf.gastos_flujo_a, 0),
        'adelantos_flujo_b', COALESCE(vf.adelantos_flujo_b, 0)
    )::jsonb
    INTO result
    FROM public.vw_ticket_financials vf
    WHERE vf.ticket_id = p_id;

    RETURN COALESCE(result, '{}'::jsonb);
END;
$$;

-- ========================================================
-- 7. DEPLOY STRATEGIC VIEW AND RPC
-- ========================================================
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

DROP FUNCTION IF EXISTS public.get_strategic_metrics(text, text) CASCADE;

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

    -- Calculate total revenues
    SELECT COALESCE(sum(vf.ingresos_reales), 0)
    INTO v_ingresos
    FROM public.tickets t
    JOIN public.vw_ticket_financials vf ON t.id = vf.ticket_id
    WHERE (t.created_at >= v_start AND t.created_at <= v_end)
       OR (t.closure_date >= v_start AND t.closure_date <= v_end);

    -- Calculate total investments
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

-- ========================================================
-- 8. DEPLOY get_payment_tickets_ultra_light RPC
-- ========================================================
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
        'created_at', t.created_at, 
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
    FROM public.tickets t 
    LEFT JOIN public.clients c ON c.id = t.client_id 
    LEFT JOIN public.branch_offices b ON b.id = t.branch_id 
    LEFT JOIN public.technicians tech ON tech.id = t.technician_id 
    LEFT JOIN public.gestoras g ON g.id = t.gestora_id
    LEFT JOIN LATERAL (
        SELECT COALESCE(jsonb_agg(jsonb_build_object(
            'id', tc.id, 
            'ticket_id', tc.ticket_id, 
            'monto', tc.monto, 
            'estado_pago', tc.estado_pago, 
            'categoria', tc.categoria, 
            'concepto', tc.concepto
        )), '[]'::jsonb)::jsonb as costos 
        FROM public.ticket_costs tc 
        WHERE tc.ticket_id = t.id
    ) l ON true
    WHERE t.status_id NOT IN ('borrador', 'rechazado', 'cancelado') 
    ORDER BY t.created_at DESC 
    LIMIT 200;
END; 
$$;

-- ========================================================
-- 9. PERMISSIONS & SCHEMA RELOAD
-- ========================================================
GRANT SELECT ON public.tickets TO anon, authenticated, service_role;
GRANT SELECT ON public.ticket_costs TO anon, authenticated, service_role;
GRANT SELECT ON public.vw_ticket_financials TO anon, authenticated, service_role;
GRANT SELECT ON public.vw_tickets_strategic TO anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.get_strategic_metrics(text, text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_payment_tickets_ultra_light() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_ticket_financials_detail(uuid) TO anon, authenticated, service_role;

-- Force PostgREST schema cache reload
NOTIFY pgrst, 'reload schema';
`;

conn.on('ready', () => {
  console.log('SSH Connection established.');
  
  // Safe checks: verify counts of core English tables containing real data
  const safeguardSql = "SELECT (SELECT count(*) FROM clients) as cl, (SELECT count(*) FROM branch_offices) as bo, (SELECT count(*) FROM technicians) as te;";
  const safeguardCmd = `docker exec supabase-db psql -U postgres -d postgres -t -A -c "${safeguardSql}"`;

  conn.exec(safeguardCmd, (err, stream) => {
    if (err) throw err;
    let data = '';
    stream.on('data', chunk => { data += chunk; });
    stream.on('close', () => {
      const parts = data.trim().split('|');
      if (parts.length === 3) {
        const clientsCount = parseInt(parts[0]);
        const branchOfficesCount = parseInt(parts[1]);
        const techniciansCount = parseInt(parts[2]);

        console.log(`Safeguards check: clients=${clientsCount}, branch_offices=${branchOfficesCount}, technicians=${techniciansCount}`);

        if (clientsCount > 0 && branchOfficesCount > 0 && techniciansCount > 0) {
          console.log('✅ Safeguards passed. Proceeding with streaming database schema restoration...');
          executeMigrationStream();
        } else {
          console.error('❌ Safeguards failed! Core tables appear empty. Aborting to protect database.');
          conn.end();
        }
      } else {
        console.error('❌ Safeguards failed! Could not query counts.', data);
        conn.end();
      }
    });
  });

  function executeMigrationStream() {
    const cmd = 'docker exec -i supabase-db psql -U postgres -d postgres';
    conn.exec(cmd, (err, stream) => {
      if (err) {
        console.error('Failed to execute docker exec psql command via SSH:', err);
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
      
      // Write the SQL script to the SSH process stream input channel directly!
      stream.write(sqlScript);
      stream.end();
    });
  }
}).connect({
  host: '87.99.137.96',
  port: 22,
  username: 'root',
  password: 'etNpxhE7dKAtRA3aTVEv_Secured'
});
