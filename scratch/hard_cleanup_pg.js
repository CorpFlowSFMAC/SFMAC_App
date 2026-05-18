
const { Pool } = require('pg');

const pool = new Pool({
  host: '87.99.137.96',
  port: 5432,
  user: 'supabase_admin',
  password: 'CorpFlowSFMAC_DB_2026',
  database: '_supabase'
});

async function cleanup() {
    const ticketsToDelete = ['TK-7A82AB9A', 'MB000001.26'];
    console.log('Iniciando limpieza de tickets:', ticketsToDelete);

    try {
        // 1. Obtener los IDs de los tickets
        const findQuery = `
            SELECT id, ticket_number, client_ticket_number 
            FROM tickets 
            WHERE ticket_number = ANY($1) OR client_ticket_number = ANY($1)
        `;
        const res = await pool.query(findQuery, [ticketsToDelete]);
        
        if (res.rows.length === 0) {
            console.log('No se encontraron tickets para eliminar.');
            return;
        }

        console.log(`Se encontraron ${res.rows.length} tickets. Procediendo a eliminar dependencias...`);

        for (const ticket of res.rows) {
            console.log(`Procesando ticket: ${ticket.ticket_number || ticket.client_ticket_number} (${ticket.id})`);
            
            // Eliminar en cascada manualmente para asegurar limpieza total
            await pool.query('DELETE FROM ticket_costs WHERE ticket_id = $1', [ticket.id]);
            await pool.query('DELETE FROM ticket_payments WHERE ticket_id = $1', [ticket.id]);
            await pool.query('DELETE FROM ticket_evidences WHERE ticket_id = $1', [ticket.id]);
            
            const delRes = await pool.query('DELETE FROM tickets WHERE id = $1', [ticket.id]);
            if (delRes.rowCount > 0) {
                console.log(`✅ Ticket ${ticket.id} eliminado exitosamente.`);
            }
        }

    } catch (err) {
        console.error('❌ Error durante la limpieza:', err);
    } finally {
        await pool.end();
    }
}

cleanup();
