/**
 * Test rápido de conexión a Supabase
 */

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://xqnghcdndqicqofnxvuf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhxbmdoY2RuZHFpY3FvZm54dnVmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAxNTMyOTQsImV4cCI6MjA4NTcyOTI5NH0.QijT6mgGlaiCXdHW2BO4es0Rwx_QIgDPGPW61H3x54M';

console.log('\n🔍 Verificando conexión a Supabase...\n');

async function testConnection() {
    try {
        const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

        console.log('1. Probando conexión a clientes...');
        const { data: clients, error: clientsError, count: clientsCount } = await supabase
            .from('clients')
            .select('*', { count: 'exact' });

        if (clientsError) {
            console.log('   ❌ Error:', clientsError.message);
            return false;
        }

        console.log(`   ✅ Clientes: ${clientsCount} registros`);
        if (clients && clients.length > 0) {
            clients.forEach(c => console.log(`      - ${c.name}`));
        }

        console.log('\n2. Probando conexión a sedes...');
        const { data: branches, error: branchesError, count: branchesCount } = await supabase
            .from('branch_offices')
            .select('*', { count: 'exact', head: true });

        if (branchesError) {
            console.log('   ❌ Error:', branchesError.message);
        } else {
            console.log(`   ✅ Sedes: ${branchesCount} registros`);
        }

        console.log('\n3. Probando conexión a técnicos...');
        const { data: techs, error: techsError, count: techsCount } = await supabase
            .from('technicians')
            .select('*', { count: 'exact' });

        if (techsError) {
            console.log('   ❌ Error:', techsError.message);
        } else {
            console.log(`   ✅ Técnicos: ${techsCount} registros`);
            if (techs && techs.length > 0) {
                techs.slice(0, 3).forEach(t => console.log(`      - ${t.name}`));
            }
        }

        console.log('\n4. Probando conexión a tickets...');
        const { data: tickets, error: ticketsError, count: ticketsCount } = await supabase
            .from('tickets')
            .select('*', { count: 'exact', head: true });

        if (ticketsError) {
            console.log('   ❌ Error:', ticketsError.message);
        } else {
            console.log(`   ✅ Tickets: ${ticketsCount} registros`);
        }

        console.log('\n✅ CONEXIÓN A SUPABASE EXITOSA\n');
        console.log('📊 Resumen:');
        console.log(`   - Clientes: ${clientsCount}`);
        console.log(`   - Sedes: ${branchesCount}`);
        console.log(`   - Técnicos: ${techsCount}`);
        console.log(`   - Tickets: ${ticketsCount}`);
        console.log('');

        return true;

    } catch (error) {
        console.log('\n❌ ERROR DE CONEXIÓN');
        console.log('Error:', error.message);
        console.log('');
        return false;
    }
}

testConnection().then(success => {
    process.exit(success ? 0 : 1);
});

