
DELETE FROM ticket_costs WHERE ticket_id IN (SELECT id FROM tickets WHERE ticket_number IN ('TK-7A82AB9A', 'MB000001.26') OR client_ticket_number IN ('TK-7A82AB9A', 'MB000001.26'));
DELETE FROM ticket_payments WHERE ticket_id IN (SELECT id FROM tickets WHERE ticket_number IN ('TK-7A82AB9A', 'MB000001.26') OR client_ticket_number IN ('TK-7A82AB9A', 'MB000001.26'));
DELETE FROM ticket_evidences WHERE ticket_id IN (SELECT id FROM tickets WHERE ticket_number IN ('TK-7A82AB9A', 'MB000001.26') OR client_ticket_number IN ('TK-7A82AB9A', 'MB000001.26'));
DELETE FROM tickets WHERE ticket_number IN ('TK-7A82AB9A', 'MB000001.26') OR client_ticket_number IN ('TK-7A82AB9A', 'MB000001.26');
