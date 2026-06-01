import { Client } from 'ssh2';

const conn = new Client();

const sqlScript = `
-- ========================================================
-- ALIGNMENT OF vw_ticket_financials LOGIC WITH LOGICA_FINANCIERA.md
-- Rentabilidad Real (Utilidad Neta) = Monto Base - MO Pactada - Gastos Operativos Confirmados
-- ========================================================

CREATE OR REPLACE VIEW public.vw_ticket_financials AS
WITH costos_confirmados AS (
    SELECT 
        ticket_costs.ticket_id,
        COALESCE(
            ROUND(
                SUM(ticket_costs.monto) FILTER (
                    WHERE ticket_costs.categoria = ANY (ARRAY['Materiales', 'Logística', 'Viáticos / Movilidad', 'Compras', 'Otros Gastos'])
                    AND ticket_costs.estado_pago IN ('pagado', 'confirmado', 'abonado', 'transferido', 'completado', 'depósito', 'deposito')
                )::numeric
            , 2)
        , 0::numeric) AS gastos_flujo_a,
        COALESCE(
            ROUND(
                SUM(ticket_costs.monto) FILTER (
                    WHERE ticket_costs.categoria = ANY (ARRAY['Mano de Obra', 'Adelanto', 'Rescate', 'Rescate Financiero', 'Honorarios', 'Bono'])
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
    COALESCE(ROUND(t.labor_cost::numeric, 2), ROUND((t.metadata ->> 'costoManoObra')::numeric, 2), 0::numeric) - COALESCE(c.adelantos_flujo_b, 0::numeric) AS saldo_tecnico
FROM public.tickets t
LEFT JOIN costos_confirmados c ON c.ticket_id = t.id;

-- Alter table tickets to use (now() AT TIME ZONE 'UTC') for created_at and updated_at
ALTER TABLE public.tickets ALTER COLUMN created_at SET DEFAULT (now() AT TIME ZONE 'UTC');
ALTER TABLE public.tickets ALTER COLUMN updated_at SET DEFAULT (now() AT TIME ZONE 'UTC');

-- Force PostgREST schema cache reload
NOTIFY pgrst, 'reload schema';
`;

conn.on('ready', () => {
  console.log('SSH Connection established for correcting view...');
  
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
    
    // Pipe the SQL script straight into psql's stdin!
    stream.write(sqlScript);
    stream.end();
  });
}).connect({
  host: '87.99.137.96',
  port: 22,
  username: 'root',
  password: 'etNpxhE7dKAtRA3aTVEv_Secured'
});
