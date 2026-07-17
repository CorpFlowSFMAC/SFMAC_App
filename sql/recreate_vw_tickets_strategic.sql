-- ═══════════════════════════════════════════════════════════════════════════════
-- RECONFIGURACIÓN DE VISTA: vw_tickets_strategic
-- 
-- AUDITORÍA: Esta vista fue recreada para eliminar cualquier filtro basado en
-- 'created_at' y asegurar que el campo 'closure_date' sea la fuente de verdad
-- para el cálculo de métricas mensuales.
--
-- FECHA: 2026-07-07
-- AUTOR: OpenHands AI Agent
-- ═══════════════════════════════════════════════════════════════════════════════

-- Paso 1: Eliminar la vista existente
DROP VIEW IF EXISTS vw_tickets_strategic CASCADE;

-- Paso 2: Recrear la vista SIN filtros de fecha
-- IMPORTANTE: No hay cláusula WHERE basada en created_at o fechas
-- El filtrado por período se hace en el código frontend usando closure_date

CREATE OR REPLACE VIEW vw_tickets_strategic AS
SELECT 
    t.id,
    t.client_ticket_number,
    t.status_id,
    t.estadoId,
    t.description,
    t.service_type,
    t.technician_id,
    t.gestora_id,
    t.client_id,
    t.branch_id,
    t.priority,
    t.created_at,
    t.updated_at,
    t.closure_date,
    t.fechaCierre,
    
    -- Campos financieros
    t.total_quoted_amount,
    t.monto_presupuesto,
    t.montoFinal,
    t.montoTotalCotizado,
    t.labor_cost,
    t.materials_cost,
    t.visit_cost,
    t.costoManoObra,
    t.costoMateriales,
    t.costoVisita,
    t.monto_pactado_mo,
    t.monto_acordado,
    t.montoIGV,
    t.monto_igv,
    t.igv,
    t.ingresos_reales,
    t.rentabilidad,
    t.utilidad_neta,
    t.inversion_ejecutada,
    t.total_costs_agg,
    t.saldo_tecnico,
    t.margen_real,
    
    -- Metadata (JSONB)
    t.metadata,
    t.original_created_at,
    
    -- JOINs para datos relacionados
    c.name AS cliente_nombre,
    c.logo AS cliente_logo,
    c.color_aura AS cliente_color,
    bo.name AS sede_nombre,
    bo.address AS sede_direccion,
    bo.zone AS sede_zona,
    g.nombre AS gestora_nombre,
    g.email AS gestora_email,
    tech.first_name AS tecnico_nombre,
    tech.last_name AS tecnico_apellido,
    tech.phone AS tecnico_telefono,
    tech.bank_name AS tecnico_banco,
    tech.account_number AS tecnico_cuenta,
    tech.cci AS tecnico_cci,
    
    -- Tickets costs (para cálculos financieros)
    tc.costs AS ticket_costs
    
FROM tickets t
-- Left joins para datos relacionados
LEFT JOIN clients c ON t.client_id = c.id
LEFT JOIN branch_offices bo ON t.branch_id = bo.id
LEFT JOIN gestoras g ON t.gestora_id = g.id
LEFT JOIN technicians tech ON t.technician_id = tech.id
-- Left join para costos de ticket (agregados)
LEFT JOIN (
    SELECT 
        ticket_id,
        jsonb_agg(
            jsonb_build_object(
                'id', tc.id,
                'amount', tc.amount,
                'categoria', tc.categoria,
                'concepto', tc.concepto,
                'fecha_pago', tc.fecha_pago,
                'estado_pago', tc.estado_pago,
                'specialist_id', tc.specialist_id,
                'main_technician_id', tc.main_technician_id,
                'created_at', tc.created_at
            )
        ) AS costs
    FROM ticket_costs tc
    GROUP BY tc.ticket_id
) tc ON t.id = tc.ticket_id;

-- Verificar que la vista se creó correctamente
SELECT 
    'Vista recreada exitosamente' AS status,
    COUNT(*) AS total_columns
FROM information_schema.columns 
WHERE table_name = 'vw_tickets_strategic';

COMMENT ON VIEW vw_tickets_strategic IS 
'Vista estratégica de tickets para el Dashboard. 
NO filtra por fechas - el filtrado por período se hace en frontend usando closure_date.
ÚNICA FUENTE DE VERDAD para métricas de ingresos/utilidad.';
