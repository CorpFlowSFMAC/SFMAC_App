DROP FUNCTION IF EXISTS get_payment_tickets_ultra_light();
CREATE FUNCTION get_payment_tickets_ultra_light() RETURNS SETOF jsonb LANGUAGE plpgsql AS $$ 
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
        'costos', COALESCE(c.costos, '[]'::jsonb), 
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
        SELECT jsonb_agg(jsonb_build_object('id', tc.id, 'ticket_id', tc.ticket_id, 'monto', tc.monto, 'estado_pago', tc.estado_pago, 'categoria', tc.categoria, 'concepto', tc.concepto)) as costos 
        FROM ticket_costs tc 
        WHERE tc.ticket_id = t.id
    ) c
    WHERE t.status_id NOT IN ('borrador', 'rechazado', 'cancelado') 
    ORDER BY t.created_at DESC 
    LIMIT 100; 
END; 
$$
