const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const SUPABASE_URL = 'https://xqnghcdndqicqofnxvuf.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhxbmdoY2RuZHFpY3FvZm54dnVmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAxNTMyOTQsImV4cCI6MjA4NTcyOTI5NH0.QijT6mgGlaiCXdHW2BO4es0Rwx_QIgDPGPW61H3x54M';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Leer archivo exportado
const filePath = path.join(__dirname, 'localStorage-export.json');

if (!fs.existsSync(filePath)) {
    console.error('❌ Archivo no encontrado: localStorage-export.json');
    console.log('\n📝 Pasos para exportar tus datos:');
    console.log('1. Abre http://localhost:3000 en tu navegador');
    console.log('2. Abre la consola (F12)');
    console.log('3. Copia y pega el contenido de: .agent/export-localhost-data.js');
    console.log('4. Guarda el archivo descargado en la raíz del proyecto');
    console.log('5. Ejecuta este script de nuevo\n');
    process.exit(1);
}

const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

console.log('📦 Datos cargados desde archivo:');
console.log(`   Clientes: ${data.clients?.length || 0}`);
console.log(`   Técnicos: ${data.technicians?.length || 0}`);
console.log(`   Tickets: ${data.tickets?.length || 0}\n`);

async function migrateClients(clients) {
    console.log('📋 Migrando clientes...');
    const clientMap = {};

    for (const client of clients) {
        try {
            const { data: existing } = await supabase
                .from('clients')
                .select('*')
                .eq('name', client.nombre)
                .maybeSingle();

            if (existing) {
                console.log(`   ✓ Cliente "${client.nombre}" ya existe`);
                clientMap[client.id] = existing.id;
            } else {
                const { data: newClient, error } = await supabase
                    .from('clients')
                    .insert({ name: client.nombre })
                    .select()
                    .single();

                if (error) throw error;

                console.log(`   ✅ Cliente "${client.nombre}" creado`);
                clientMap[client.id] = newClient.id;
            }
        } catch (error) {
            console.error(`   ❌ Error con "${client.nombre}":`, error.message);
        }
    }

    console.log(`   📊 Total: ${Object.keys(clientMap).length} clientes procesados\n`);
    return clientMap;
}

async function migrateBranches(clients, clientMap) {
    console.log('🏢 Migrando sedes...');
    let totalBranches = 0;
    const branchMap = {};

    for (const client of clients) {
        if (!client.agencias || client.agencias.length === 0) continue;

        const supabaseClientId = clientMap[client.id];
        if (!supabaseClientId) continue;

        console.log(`   Procesando sedes de "${client.nombre}"...`);

        for (const branch of client.agencias) {
            try {
                const { data: existing } = await supabase
                    .from('branch_offices')
                    .select('*')
                    .eq('name', branch.nombre)
                    .eq('client_id', supabaseClientId)
                    .maybeSingle();

                if (existing) {
                    console.log(`     ✓ Sede "${branch.nombre}" ya existe`);
                    branchMap[branch.id] = existing.id;
                } else {
                    const { data: newBranch, error } = await supabase
                        .from('branch_offices')
                        .insert({
                            client_id: supabaseClientId,
                            name: branch.nombre,
                            address: branch.direccion || '',
                            zone: branch.zona || 'LIMA'
                        })
                        .select()
                        .single();

                    if (error) throw error;

                    console.log(`     ✅ Sede "${branch.nombre}" creada`);
                    branchMap[branch.id] = newBranch.id;
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

async function migrateTechnicians(technicians) {
    console.log('👨‍🔧 Migrando técnicos...');
    const techMap = {};
    let created = 0;

    for (const tech of technicians) {
        try {
            const { data: existing } = tech.dni
                ? await supabase
                    .from('technicians')
                    .select('*')
                    .eq('document_number', tech.dni)
                    .maybeSingle()
                : { data: null };

            if (existing) {
                console.log(`   ✓ Técnico "${tech.nombre}" ya existe`);
                techMap[tech.id] = existing.id;
            } else {
                const { data: newTech, error } = await supabase
                    .from('technicians')
                    .insert({
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
                    })
                    .select()
                    .single();

                if (error) throw error;

                console.log(`   ✅ Técnico "${tech.nombre}" creado`);
                techMap[tech.id] = newTech.id;
                created++;
            }
        } catch (error) {
            console.error(`   ❌ Error con técnico "${tech.nombre}":`, error.message);
        }
    }

    console.log(`   📊 Total: ${created} técnicos nuevos creados\n`);
    return techMap;
}

async function migrateTickets(tickets, clientMap, branchMap, techMap) {
    console.log('🎫 Migrando tickets...');
    let created = 0;
    let skipped = 0;

    for (const ticket of tickets) {
        try {
            const clientId = clientMap[ticket.clienteId];
            const branchId = branchMap[ticket.sedeId];
            const techId = ticket.tecnicoAsignado?.id ? techMap[ticket.tecnicoAsignado.id] : null;

            if (!clientId || !branchId) {
                console.log(`   ⚠️  Ticket ${ticket.id} omitido (cliente o sede no encontrados)`);
                skipped++;
                continue;
            }

            const { error } = await supabase
                .from('tickets')
                .insert({
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

            if (error) throw error;

            console.log(`   ✅ Ticket #${ticket.id} migrado`);
            created++;
        } catch (error) {
            console.error(`   ❌ Error con ticket ${ticket.id}:`, error.message);
            skipped++;
        }
    }

    console.log(`   📊 Total: ${created} tickets creados, ${skipped} omitidos\n`);
}

async function runMigration() {
    console.log('═'.repeat(60));
    console.log('🚀 SINCRONIZACIÓN LOCALHOST → SUPABASE');
    console.log('═'.repeat(60) + '\n');

    try {
        const clientMap = await migrateClients(data.clients || []);
        const branchMap = await migrateBranches(data.clients || [], clientMap);
        const techMap = await migrateTechnicians(data.technicians || []);
        await migrateTickets(data.tickets || [], clientMap, branchMap, techMap);

        console.log('═'.repeat(60));
        console.log('✅ SINCRONIZACIÓN COMPLETADA');
        console.log('═'.repeat(60) + '\n');

        // Verificar resultados
        const { data: clients } = await supabase.from('clients').select('name');
        const { data: branches } = await supabase.from('branch_offices').select('id');
        const { data: techs } = await supabase.from('technicians').select('id');
        const { data: tickets } = await supabase.from('tickets').select('id');

        console.log('📊 ESTADO FINAL EN SUPABASE:');
        console.log(`   Clientes: ${clients.length}`);
        clients.forEach(c => console.log(`      - ${c.name}`));
        console.log(`   Sedes: ${branches.length}`);
        console.log(`   Técnicos: ${techs.length}`);
        console.log(`   Tickets: ${tickets.length}\n`);

    } catch (error) {
        console.error('\n❌ Error:', error.message);
    }
}

runMigration();

