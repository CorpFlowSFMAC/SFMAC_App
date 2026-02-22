/**
 * SCRIPT DE SINCRONIZACIÓN: localStorage → Supabase
 * 
 * Este script migra los datos de localStorage (localhost) a Supabase (producción)
 * 
 * INSTRUCCIONES:
 * 1. Abre tu localhost en el navegador
 * 2. Abre la consola del navegador (F12)
 * 3. Copia y pega este script completo
 * 4. Presiona Enter
 * 5. El script migrará automáticamente todos los datos
 */

console.log('🔄 Iniciando sincronización localStorage → Supabase...\n');

// Configuración de Supabase
const SUPABASE_URL = 'https://xqnghcdndqicqofnxvuf.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhxbmdoY2RuZHFpY3FvZm54dnVmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAxNTMyOTQsImV4cCI6MjA4NTcyOTI5NH0.QijT6mgGlaiCXdHW2BO4es0Rwx_QIgDPGPW61H3x54M';

// ============================================
// FUNCIÓN AUXILIAR: Llamada a Supabase
// ============================================
async function supabaseRequest(table, method, data = null, filters = {}) {
    let url = `${SUPABASE_URL}/rest/v1/${table}`;

    // Agregar filtros si existen
    const filterParams = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
        filterParams.append(key, `eq.${value}`);
    });
    if (filterParams.toString()) {
        url += `?${filterParams.toString()}`;
    }

    const options = {
        method: method,
        headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=representation'
        }
    };

    if (data && (method === 'POST' || method === 'PATCH')) {
        options.body = JSON.stringify(data);
    }

    const response = await fetch(url, options);

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`Supabase error: ${error}`);
    }

    return method === 'DELETE' ? null : await response.json();
}

// ============================================
// PASO 1: MIGRAR CLIENTES
// ============================================
async function migrateClients() {
    console.log('📋 Paso 1: Migrando clientes...');

    const localClients = JSON.parse(localStorage.getItem('clients') || '[]');

    if (localClients.length === 0) {
        console.log('   ⚠️  No hay clientes en localStorage');
        return {};
    }

    console.log(`   Encontrados ${localClients.length} clientes en localStorage`);

    const clientMap = {}; // Mapeo de ID local → ID Supabase

    for (const client of localClients) {
        try {
            // Verificar si ya existe
            const existing = await supabaseRequest('clients', 'GET', null, { name: client.nombre });

            if (existing && existing.length > 0) {
                console.log(`   ✓ Cliente "${client.nombre}" ya existe en Supabase`);
                clientMap[client.id] = existing[0].id;
            } else {
                // Crear nuevo
                const newClient = await supabaseRequest('clients', 'POST', {
                    name: client.nombre
                });

                console.log(`   ✅ Cliente "${client.nombre}" creado en Supabase`);
                clientMap[client.id] = newClient[0].id;
            }
        } catch (error) {
            console.error(`   ❌ Error con cliente "${client.nombre}":`, error.message);
        }
    }

    console.log(`   📊 Total: ${Object.keys(clientMap).length} clientes procesados\n`);
    return clientMap;
}

// ============================================
// PASO 2: MIGRAR SEDES
// ============================================
async function migrateBranches(clientMap) {
    console.log('🏢 Paso 2: Migrando sedes...');

    const localClients = JSON.parse(localStorage.getItem('clients') || '[]');
    let totalBranches = 0;
    const branchMap = {}; // Mapeo de ID local → ID Supabase

    for (const client of localClients) {
        if (!client.agencias || client.agencias.length === 0) continue;

        const supabaseClientId = clientMap[client.id];
        if (!supabaseClientId) {
            console.log(`   ⚠️  Cliente "${client.nombre}" no tiene ID en Supabase, omitiendo sedes`);
            continue;
        }

        console.log(`   Procesando sedes de "${client.nombre}"...`);

        for (const branch of client.agencias) {
            try {
                // Verificar si ya existe
                const existing = await supabaseRequest('branch_offices', 'GET', null, {
                    name: branch.nombre,
                    client_id: supabaseClientId
                });

                if (existing && existing.length > 0) {
                    console.log(`     ✓ Sede "${branch.nombre}" ya existe`);
                    branchMap[branch.id] = existing[0].id;
                } else {
                    // Crear nueva
                    const newBranch = await supabaseRequest('branch_offices', 'POST', {
                        client_id: supabaseClientId,
                        name: branch.nombre,
                        address: branch.direccion || '',
                        zone: branch.zona || 'LIMA'
                    });

                    console.log(`     ✅ Sede "${branch.nombre}" creada`);
                    branchMap[branch.id] = newBranch[0].id;
                    totalBranches++;
                }
            } catch (error) {
                console.error(`     ❌ Error con sede "${branch.nombre}":`, error.message);
            }
        }
    }

    console.log(`   📊 Total: ${totalBranches} sedes nuevas creadas\n`);
    return branchMap;
}

// ============================================
// PASO 3: MIGRAR TÉCNICOS
// ============================================
async function migrateTechnicians() {
    console.log('👨‍🔧 Paso 3: Migrando técnicos...');

    const localTechs = JSON.parse(localStorage.getItem('technicians') || '[]');

    if (localTechs.length === 0) {
        console.log('   ⚠️  No hay técnicos en localStorage\n');
        return {};
    }

    console.log(`   Encontrados ${localTechs.length} técnicos en localStorage`);

    const techMap = {};
    let created = 0;

    for (const tech of localTechs) {
        try {
            // Verificar si ya existe por documento
            const existing = tech.dni
                ? await supabaseRequest('technicians', 'GET', null, { document_number: tech.dni })
                : [];

            if (existing && existing.length > 0) {
                console.log(`   ✓ Técnico "${tech.nombre}" ya existe`);
                techMap[tech.id] = existing[0].id;
            } else {
                // Crear nuevo
                const newTech = await supabaseRequest('technicians', 'POST', {
                    name: `${tech.nombre} ${tech.apellido || ''}`.trim(),
                    document_number: tech.dni || null,
                    phone: tech.telefono || null,
                    email: tech.email || null,
                    bank_name: tech.banco || null,
                    account_number: tech.numeroCuenta || null,
                    cci: tech.cci || null,
                    yape_number: tech.yape || null,
                    plin_number: tech.plin || null,
                    status: tech.estado || 'active'
                });

                console.log(`   ✅ Técnico "${tech.nombre}" creado`);
                techMap[tech.id] = newTech[0].id;
                created++;
            }
        } catch (error) {
            console.error(`   ❌ Error con técnico "${tech.nombre}":`, error.message);
        }
    }

    console.log(`   📊 Total: ${created} técnicos nuevos creados\n`);
    return techMap;
}

// ============================================
// PASO 4: MIGRAR TICKETS
// ============================================
async function migrateTickets(clientMap, branchMap, techMap) {
    console.log('🎫 Paso 4: Migrando tickets...');

    const localTickets = JSON.parse(localStorage.getItem('tickets') || '[]');

    if (localTickets.length === 0) {
        console.log('   ⚠️  No hay tickets en localStorage\n');
        return;
    }

    console.log(`   Encontrados ${localTickets.length} tickets en localStorage`);

    let created = 0;
    let skipped = 0;

    for (const ticket of localTickets) {
        try {
            // Mapear IDs
            const clientId = clientMap[ticket.clienteId];
            const branchId = branchMap[ticket.sedeId];
            const techId = ticket.tecnicoAsignado?.id ? techMap[ticket.tecnicoAsignado.id] : null;

            if (!clientId || !branchId) {
                console.log(`   ⚠️  Ticket ${ticket.id} omitido (cliente o sede no encontrados)`);
                skipped++;
                continue;
            }

            // Crear ticket
            const newTicket = await supabaseRequest('tickets', 'POST', {
                client_id: clientId,
                branch_id: branchId,
                technician_id: techId,
                status_id: ticket.estadoId || 'nuevo',
                description: ticket.descripcionProblema || ticket.descripcion || '',
                client_ticket_number: ticket.numeroTicketCliente || 'PENDIENTE',
                labor_cost: ticket.costoManoObra || 0,
                materials_cost: ticket.costoMateriales || 0,
                visit_cost: ticket.costoVisita || 0,
                total_quoted_amount: ticket.montoCotizado || 0,
                metadata: {
                    service_type: ticket.tipoServicio,
                    original_id: ticket.id,
                    migrated_at: new Date().toISOString()
                }
            });

            console.log(`   ✅ Ticket #${ticket.id} migrado`);
            created++;

        } catch (error) {
            console.error(`   ❌ Error con ticket ${ticket.id}:`, error.message);
            skipped++;
        }
    }

    console.log(`   📊 Total: ${created} tickets creados, ${skipped} omitidos\n`);
}

// ============================================
// EJECUTAR MIGRACIÓN COMPLETA
// ============================================
async function runMigration() {
    try {
        console.log('═'.repeat(60));
        console.log('🚀 SINCRONIZACIÓN LOCALHOST → SUPABASE');
        console.log('═'.repeat(60) + '\n');

        const clientMap = await migrateClients();
        const branchMap = await migrateBranches(clientMap);
        const techMap = await migrateTechnicians();
        await migrateTickets(clientMap, branchMap, techMap);

        console.log('═'.repeat(60));
        console.log('✅ SINCRONIZACIÓN COMPLETADA');
        console.log('═'.repeat(60));
        console.log('\n💡 Ahora puedes:');
        console.log('   1. Verificar los datos en Supabase Dashboard');
        console.log('   2. Actualizar tu app de producción');
        console.log('   3. Los datos ya están sincronizados\n');

    } catch (error) {
        console.error('\n❌ Error durante la migración:', error);
    }
}

// Ejecutar
runMigration();

