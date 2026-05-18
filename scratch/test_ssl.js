
const { Client } = require('pg');

async function main() {
  const client = new Client({
    host: '87.99.137.96',
    port: 5432,
    database: 'postgres',
    user: 'postgres',
    password: 'CorpFlowSFMAC_DB_2026',
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('Intentando con SSL...');
    await client.connect();
    console.log('¡Conectado!');
    const res = await client.query('SELECT current_database(), current_user');
    console.log('Result:', res.rows[0]);
  } catch (err) {
    console.log('Error:', err.message);
  } finally {
    await client.end();
  }
}

main();
