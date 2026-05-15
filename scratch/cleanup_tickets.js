
import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({
  host: '87.99.137.96',
  port: 5432,
  user: 'postgres',
  password: 'CorpFlowSFMAC_DB_2026',
  database: 'postgres'
});

async function run() {
  try {
    const targets = [
      'MB000023.26', 'MB000001.26', 'MB000002.26', 'MB000122.26',
      'TK-E7D15C46', 'TK-ED81BF83', 'TK-F208B76A', 'TK-7C1D181D'
    ];
    
    console.log('--- BUSCANDO TICKETS ---');
    const { rows: tickets } = await pool.query(`
      SELECT id, client_ticket_number 
      FROM tickets 
      WHERE client_ticket_number = ANY($1) 
         OR id::text LIKE '%E7D15C46' 
         OR id::text LIKE '%ED81BF83' 
         OR id::text LIKE '%F208B76A' 
         OR id::text LIKE '%7C1D181D'
    `, [targets]);

    if (tickets.length === 0) {
      console.log('No se encontraron tickets.');
      return;
    }

    console.log('Tickets encontrados:', tickets);

    const ids = tickets.map(t => t.id);

    console.log('--- ELIMINANDO RAMIFICACIONES ---');
    // Eliminar de tablas relacionadas
    await pool.query('DELETE FROM ticket_costs WHERE ticket_id = ANY($1)', [ids]);
    await pool.query('DELETE FROM ticket_payments WHERE ticket_id = ANY($1)', [ids]);
    await pool.query('DELETE FROM ticket_evidences WHERE ticket_id = ANY($1)', [ids]);
    
    console.log('--- ELIMINANDO TICKETS ---');
    const { rowCount } = await pool.query('DELETE FROM tickets WHERE id = ANY($1)', [ids]);
    
    console.log(`Eliminados ${rowCount} tickets y sus ramificaciones.`);

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await pool.end();
  }
}

run();
