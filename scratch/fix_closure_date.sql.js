/**
 * Script para corregir closure_date NULL en tickets
 * Y crear trigger para evitar este problema en el futuro
 */

const { Client } = require('pg');

const DB_CONFIG = {
    host: '87.99.137.96',
    port: 5432,
    database: 'postgres',
    user: 'postgres',
    password: 'CorpFlowSFMAC_DB_2026',
    ssl: false
};

async function runFix() {
    const client = new Client(DB_CONFIG);
    
    try {
        await client.connect();
        console.log('✅ Conectado a PostgreSQL');
        console.log('='.repeat(60));

        // ============================================================
        // TAREA 1: UPDATE - Reparar tickets con closure_date NULL
        // ============================================================
        console.log('\n📋 TAREA 1: Actualizando tickets con closure_date NULL...');
        
        // Primero verificamos cuántos hay
        const countBefore = await client.query(`
            SELECT COUNT(*) as count 
            FROM tickets 
            WHERE status_id = 'ticket_cerrado' 
              AND closure_date IS NULL
        `);
        console.log(`   Tickets a actualizar: ${countBefore.rows[0].count}`);
        
        if (parseInt(countBefore.rows[0].count) > 0) {
            const updateResult = await client.query(`
                UPDATE tickets 
                SET closure_date = updated_at 
                WHERE status_id = 'ticket_cerrado' 
                  AND closure_date IS NULL
                RETURNING id, status_id, closure_date, updated_at
            `);
            console.log(`   ✅ Tickets actualizados: ${updateResult.rowCount}`);
            
            // Mostrar algunos ejemplos
            console.log('\n   Ejemplos de tickets actualizados:');
            updateResult.rows.slice(0, 5).forEach((row, i) => {
                console.log(`   [${i+1}] ID: ${row.id.slice(0,8)}... | closure_date: ${row.closure_date} | updated_at: ${row.updated_at}`);
            });
        } else {
            console.log('   ℹ️  No hay tickets que actualizar');
        }

        // Verificar que no queden NULL
        const countAfter = await client.query(`
            SELECT COUNT(*) as count 
            FROM tickets 
            WHERE status_id = 'ticket_cerrado' 
              AND closure_date IS NULL
        `);
        console.log(`\n   ✅ Tickets restantes con closure_date NULL: ${countAfter.rows[0].count}`);

        // ============================================================
        // TAREA 2: Crear FUNCTION y TRIGGER
        // ============================================================
        console.log('\n📋 TAREA 2: Creando trigger para automático populate...');
        
        // Verificar si ya existe el trigger
        const existingTrigger = await client.query(`
            SELECT tgname, tgname 
            FROM pg_trigger 
            WHERE tgname = 'tr_populate_closure_date'
        `);
        
        if (existingTrigger.rows.length > 0) {
            console.log('   ℹ️  El trigger ya existe, eliminando...');
            await client.query('DROP TRIGGER IF EXISTS tr_populate_closure_date ON tickets');
            await client.query('DROP FUNCTION IF EXISTS populate_closure_date_tg()');
        }

        // Crear la función
        await client.query(`
            CREATE OR REPLACE FUNCTION populate_closure_date_tg()
            RETURNS TRIGGER AS $$
            BEGIN
              IF NEW.status_id IN ('ticket_cerrado', 'liquidado') AND NEW.closure_date IS NULL THEN
                NEW.closure_date := NOW();
              END IF;
              RETURN NEW;
            END;
            $$ LANGUAGE plpgsql;
        `);
        console.log('   ✅ Función populate_closure_date_tg() creada');

        // Crear el trigger
        await client.query(`
            CREATE OR REPLACE TRIGGER tr_populate_closure_date
            BEFORE INSERT OR UPDATE ON tickets
            FOR EACH ROW
            EXECUTE FUNCTION populate_closure_date_tg();
        `);
        console.log('   ✅ Trigger tr_populate_closure_date creado');

        // ============================================================
        // TAREA 3: Verificación final
        // ============================================================
        console.log('\n📋 TAREA 3: Verificación final...');
        
        // Contar todos los tickets ticket_cerrado
        const totalClosed = await client.query(`
            SELECT COUNT(*) as count FROM tickets WHERE status_id = 'ticket_cerrado'
        `);
        
        // Contar los que tienen closure_date
        const withClosureDate = await client.query(`
            SELECT COUNT(*) as count 
            FROM tickets 
            WHERE status_id = 'ticket_cerrado' 
              AND closure_date IS NOT NULL
        `);
        
        // Contar tickets en julio 2026
        const july2026 = await client.query(`
            SELECT COUNT(*) as count 
            FROM tickets 
            WHERE status_id = 'ticket_cerrado' 
              AND closure_date >= '2026-07-01' 
              AND closure_date < '2026-08-01'
        `);
        
        console.log(`   Total tickets ticket_cerrado: ${totalClosed.rows[0].count}`);
        console.log(`   Con closure_date poblado: ${withClosureDate.rows[0].count}`);
        console.log(`   Con closure_date en Julio 2026: ${july2026.rows[0].count}`);
        
        if (parseInt(july2026.rows[0].count) > 0) {
            console.log('\n   🎉 AHORA EL DASHBOARD DEBERÍA MOSTRAR DATOS!');
        }

        console.log('\n' + '='.repeat(60));
        console.log('✅ TODAS LAS TAREAS COMPLETADAS EXITOSAMENTE');
        console.log('='.repeat(60));

    } catch (err) {
        console.error('❌ ERROR:', err.message);
        throw err;
    } finally {
        await client.end();
    }
}

runFix().catch(err => {
    console.error('Error fatal:', err);
    process.exit(1);
});
