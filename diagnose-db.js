const { Client } = require('pg');

const client = new Client({
  host: '87.99.137.96',
  port: 5432,
  database: 'postgres',
  user: 'postgres',
  password: 'CorpFlowSFMAC_DB_2026',
});

async function main() {
  console.log('🔌 Conectando a PostgreSQL...');
  await client.connect();
  console.log('✅ Conectado\n');

  // 1. Diagnosticar tablas existentes
  console.log('📊 DIAGNÓSTICO DE TABLAS\n');
  
  // Ver tablas relacionadas con tickets
  const tablesResult = await client.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name LIKE '%ticket%'
    ORDER BY table_name;
  `);
  
  console.log('Tablas encontradas:', tablesResult.rows.map(r => r.table_name).join(', '));

  // 2. Analizar estructura de tickets
  console.log('\n📋 Estructura de tickets:');
  const ticketsColumns = await client.query(`
    SELECT column_name, data_type, is_nullable 
    FROM information_schema.columns 
    WHERE table_name = 'tickets' 
    ORDER BY ordinal_position;
  `);
  
  ticketsColumns.rows.forEach(col => {
    console.log(`  - ${col.column_name}: ${col.data_type} ${col.is_nullable === 'NO' ? 'NOT NULL' : ''}`);
  });

  // 3. Ver índices existentes en tickets
  console.log('\n📇 Índices existentes en tickets:');
  const ticketsIndexes = await client.query(`
    SELECT indexname, indexdef 
    FROM pg_indexes 
    WHERE tablename = 'tickets';
  `);
  
  ticketsIndexes.rows.forEach(idx => {
    console.log(`  - ${idx.indexname}`);
  });

  // 4. Ver estructura de ticket_costs
  console.log('\n💰 Estructura de ticket_costs:');
  const costsColumns = await client.query(`
    SELECT column_name, data_type, is_nullable 
    FROM information_schema.columns 
    WHERE table_name = 'ticket_costs' 
    ORDER BY ordinal_position;
  `);
  
  costsColumns.rows.forEach(col => {
    console.log(`  - ${col.column_name}: ${col.data_type} ${col.is_nullable === 'NO' ? 'NOT NULL' : ''}`);
  });

  // 5. Ver índices existentes en ticket_costs
  console.log('\n📇 Índices existentes en ticket_costs:');
  const costsIndexes = await client.query(`
    SELECT indexname, indexdef 
    FROM pg_indexes 
    WHERE tablename = 'ticket_costs';
  `);
  
  costsIndexes.rows.forEach(idx => {
    console.log(`  - ${idx.indexname}`);
  });

  // 6. Verificar funciones RPC existentes
  console.log('\n🔧 Funciones RPC (procedimientos):');
  const funcsResult = await client.query(`
    SELECT proname, prosrc 
    FROM pg_proc 
    WHERE proname LIKE '%ticket%' 
    AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');
  `);
  
  funcsResult.rows.forEach(f => {
    console.log(`  - ${f.proname}`);
    // Mostrar preview del código
    if (f.prosrc && f.prosrc.length > 200) {
      console.log(`    Código: ${f.prosrc.substring(0, 200)}...`);
    } else {
      console.log(`    Código: ${f.prosrc}`);
    }
  });

  // 7. Ver tamaño de las tablas
  console.log('\n📦 Tamaño de tablas:');
  const sizeResult = await client.query(`
    SELECT 
      relname as table_name,
      pg_size_pretty(pg_total_relation_size(relid)) as size
    FROM pg_catalog.pg_statio_user_tables
    WHERE relname IN ('tickets', 'ticket_costs')
    ORDER BY pg_total_relation_size(relid) DESC;
  `);
  
  sizeResult.rows.forEach(r => {
    console.log(`  - ${r.table_name}: ${r.size}`);
  });

  // 8. Contar registros
  console.log('\n📊 Conteo de registros:');
  const countTickets = await client.query('SELECT COUNT(*) as count FROM tickets');
  console.log(`  - Tickets: ${countTickets.rows[0].count}`);
  
  try {
    const countCosts = await client.query('SELECT COUNT(*) as count FROM ticket_costs');
    console.log(`  - Ticket Costs: ${countCosts.rows[0].count}`);
  } catch (e) {
    console.log('  - Ticket Costs: tabla no existe o error');
  }

  // 9. Ver queries lentos recientes (si hay pg_stat_statements)
  console.log('\n🐢 Queries lentos (si disponibles):');
  try {
    const slowQueries = await client.query(`
      SELECT query, calls, mean_time, total_time
      FROM pg_stat_statements
      WHERE query LIKE '%ticket%'
      ORDER BY mean_time DESC
      LIMIT 5;
    `);
    
    if (slowQueries.rows.length > 0) {
      slowQueries.rows.forEach(q => {
        console.log(`  - Mean: ${Math.round(q.mean_time)}ms, Calls: ${q.calls}, Query: ${q.query.substring(0, 80)}...`);
      });
    } else {
      console.log('  No hay datos de queries lentos (pg_stat_statements no habilitado)');
    }
  } catch (e) {
    console.log('  pg_stat_statements no disponible');
  }

  await client.end();
  console.log('\n✅ Diagnóstico completado');
}

main().catch(console.error);