const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const SUPABASE_URL = 'https://xqnghcdndqicqofnxvuf.supabase.co';
const SUPABASE_KEY = 'sb_publishable_DHL-l6BH0dVVfvNFYG9kdQ_18F8SeL3';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Mapeo de zonas según departamento
const ZONE_MAP = {
    'Lima': 'LIMA',
    'Tumbes': 'NORTE',
    'Piura': 'NORTE',
    'Lambayeque': 'NORTE',
    'La Libertad': 'NORTE',
    'Cajamarca': 'NORTE',
    'Amazonas': 'NORTE',
    'Arequipa': 'SUR',
    'Moquegua': 'SUR',
    'Tacna': 'SUR',
    'Puno': 'SUR',
    'Cusco': 'SUR',
    'Apurimac': 'SUR',
    'Apurímac': 'SUR',
    'Ica': 'CENTRO',
    'Huancavelica': 'CENTRO',
    'Junin': 'CENTRO',
    'Junín': 'CENTRO',
    'Pasco': 'CENTRO',
    'Huanuco': 'CENTRO',
    'Huánuco': 'CENTRO',
    'Ancash': 'CENTRO',
    'Áncash': 'CENTRO',
    'Loreto': 'ORIENTE',
    'San Martin': 'ORIENTE',
    'San Martín': 'ORIENTE',
    'Ucayali': 'ORIENTE',
    'Madre de Dios': 'ORIENTE'
};

function getZone(departamento) {
    return ZONE_MAP[departamento] || 'LIMA';
}

async function migrate() {
    console.log('🚀 Iniciando migración masiva de sedes MiBanco...\n');

    // 1. Obtener o crear cliente MiBanco
    console.log('📋 Verificando cliente MiBanco...');
    const { data: clientData, error: clientError } = await supabase
        .from('clients')
        .select('*')
        .eq('name', 'MiBanco')
        .single();

    if (clientError && clientError.code !== 'PGRST116') {
        console.error('❌ Error al buscar cliente:', clientError);
        return;
    }

    let clientId;
    if (!clientData) {
        console.log('   Creando cliente MiBanco...');
        const { data: newClient, error: createError } = await supabase
            .from('clients')
            .insert({ name: 'MiBanco' })
            .select()
            .single();

        if (createError) {
            console.error('❌ Error al crear cliente:', createError);
            return;
        }
        clientId = newClient.id;
        console.log('   ✅ Cliente creado:', clientId);
    } else {
        clientId = clientData.id;
        console.log('   ✅ Cliente encontrado:', clientId);
    }

    // 2. Limpiar sedes existentes
    console.log('\n🧹 Limpiando sedes existentes...');
    const { error: deleteError } = await supabase
        .from('branch_offices')
        .delete()
        .eq('client_id', clientId);

    if (deleteError) {
        console.error('❌ Error al limpiar sedes:', deleteError);
        return;
    }
    console.log('   ✅ Sedes anteriores eliminadas');

    // 3. Leer CSV
    console.log('\n📂 Leyendo archivo CSV...');
    const csvPath = path.join(__dirname, 'data', 'DIRECCIONES BASE DE DATOS_MIBANCO.csv');
    const csvContent = fs.readFileSync(csvPath, 'utf-8');
    const lines = csvContent.split('\n').filter(line => line.trim());

    // Saltar header
    const dataLines = lines.slice(1);
    console.log(`   📊 ${dataLines.length} sedes encontradas en CSV`);

    // 4. Procesar y preparar datos
    console.log('\n🔄 Procesando datos...');
    const branches = [];
    let skipped = 0;

    for (const line of dataLines) {
        const parts = line.split(';');

        // Validar que tenga datos mínimos
        if (parts.length < 8 || !parts[2] || !parts[3]) {
            skipped++;
            continue;
        }

        const name = parts[2].trim();
        const address = parts[3].trim();
        const departamento = parts[6] ? parts[6].trim() : 'Lima';
        const zone = getZone(departamento);

        if (name && address) {
            branches.push({
                client_id: clientId,
                name: name,
                address: address,
                zone: zone
            });
        } else {
            skipped++;
        }
    }

    console.log(`   ✅ ${branches.length} sedes válidas procesadas`);
    if (skipped > 0) {
        console.log(`   ⚠️  ${skipped} líneas omitidas (datos incompletos)`);
    }

    // 5. Insertar en lotes de 100
    console.log('\n💾 Insertando sedes en Supabase...');
    const BATCH_SIZE = 100;
    let inserted = 0;
    let errors = 0;

    for (let i = 0; i < branches.length; i += BATCH_SIZE) {
        const batch = branches.slice(i, i + BATCH_SIZE);
        const batchNum = Math.floor(i / BATCH_SIZE) + 1;
        const totalBatches = Math.ceil(branches.length / BATCH_SIZE);

        process.stdout.write(`   Lote ${batchNum}/${totalBatches} (${batch.length} sedes)... `);

        const { data, error } = await supabase
            .from('branch_offices')
            .insert(batch)
            .select();

        if (error) {
            console.log('❌');
            console.error('   Error:', error.message);
            errors += batch.length;
        } else {
            console.log('✅');
            inserted += data.length;
        }

        // Pequeña pausa para no saturar la API
        await new Promise(resolve => setTimeout(resolve, 100));
    }

    // 6. Resumen
    console.log('\n' + '='.repeat(60));
    console.log('📊 RESUMEN DE MIGRACIÓN');
    console.log('='.repeat(60));
    console.log(`✅ Sedes insertadas:     ${inserted}`);
    console.log(`❌ Errores:              ${errors}`);
    console.log(`📋 Total procesado:      ${inserted + errors}`);
    console.log('='.repeat(60));

    // 7. Verificar distribución por zona
    console.log('\n📍 Distribución por zona:');
    const { data: zoneCounts } = await supabase
        .from('branch_offices')
        .select('zone')
        .eq('client_id', clientId);

    if (zoneCounts) {
        const distribution = {};
        zoneCounts.forEach(row => {
            distribution[row.zone] = (distribution[row.zone] || 0) + 1;
        });

        Object.entries(distribution).sort((a, b) => b[1] - a[1]).forEach(([zone, count]) => {
            console.log(`   ${zone.padEnd(15)} ${count} sedes`);
        });
    }

    console.log('\n✨ Migración completada exitosamente!\n');
}

migrate().catch(console.error);
