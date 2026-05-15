
import pkg from 'pg';
const { Pool } = pkg;

// Exact same config as in .env.local
const pool = new Pool({
  host: '87.99.137.96',
  port: 6543,
  user: 'postgres',
  password: 'CorpFlowSFMAC_DB_2026',
  database: 'postgres'
});

async function run() {
  try {
    const targets = [
      'MB000023.26', 'MB000001.26', 'MB000002.26', 'MB000122.26'
    ];
    
    console.log('Searching...');
    const res = await pool.query('SELECT id, client_ticket_number FROM tickets WHERE client_ticket_number = ANY($1)', [targets]);
    console.log('Found:', res.rows);
    
    if (res.rows.length > 0) {
        const ids = res.rows.map(r => r.id);
        await pool.query('DELETE FROM ticket_costs WHERE ticket_id = ANY($1)', [ids]);
        await pool.query('DELETE FROM tickets WHERE id = ANY($1)', [ids]);
        console.log('Deleted.');
    }
  } catch (err) {
    console.error('Error details:', err.message);
  } finally {
    await pool.end();
  }
}

run();
