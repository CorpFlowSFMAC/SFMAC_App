const { createClient } = require('@supabase/supabase-js');
const readline = require('readline');

const SUPABASE_URL = 'https://xqnghcdndqicqofnxvuf.supabase.co';
const SUPABASE_KEY = 'sb_publishable_DHL-l6BH0dVVfvNFYG9kdQ_18F8SeL3';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Datos de ejemplo - REEMPLAZAR con tus datos reales de localStorage
const SAMPLE_DATA = {
    clients: [
        {
            id: 'CLI-001',
            nombre: 'MiBanco',
            ruc: '20382036655',
            agencias: []
        },
        {
            id: 'CLI-002',
            nombre: 'Cliente Ejemplo 2',
            ruc: '20123456789',
            agencias: []
        },
        {
            id: 'CLI-003',
            nombre: 'Cliente Ejemplo 3',
            ruc: '20987654321',
            agencias: []
        }
    ],
    technicians: [],
    tickets: []
};

async function migrateClients(clients) {
    console.log('📋 Migrando clientes...');
    const clientMap = {};

    for (const client of clients) {
        try {
            // Verificar si ya existe
            const { data: existing } = await supabase
                .from('clients')
                .select('*')
                .eq('name', client.nombre)
                .single();

            if (existing) {
                console.log(`   ✓ Cliente "${client.nombre}" ya existe`);
                clientMap[client.id] = existing.id;
            } else {
                // Crear nuevo
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

        for (const branch of client.agencias) {
            try {
                const { data: existing } = await supabase
                    .from('branch_offices')
                    .select('*')
                    .eq('name', branch.nombre)
                    .eq('client_id', supabaseClientId)
                    .single();

                if (existing) {
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

                    branchMap[branch.id] = newBranch.id;
                    totalBranches++;
                }
            } catch (error) {
                console.error(`   ❌ Error con sede "${branch.nombre}":`, error.message);
            }
        }
    }

    console.log(`   📊 Total: ${totalBranches} sedes creadas\n`);
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
                    .single()
                : { data: null };

            if (existing) {
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

                techMap[tech.id] = newTech.id;
                created++;
            }
        } catch (error) {
            console.error(`   ❌ Error con técnico "${tech.nombre}":`, error.message);
        }
    }

    console.log(`   📊 Total: ${created} técnicos creados\n`);
    return techMap;
}

async function migrateTickets(tickets, clientMap, branchMap, techMap) {
    console.log('🎫 Migrando tickets...');
    let created = 0;

    for (const ticket of tickets) {
        try {
            const clientId = clientMap[ticket.clienteId];
            const branchId = branchMap[ticket.sedeId];
            const techId = ticket.tecnicoAsignado?.id ? techMap[ticket.tecnicoAsignado.id] : null;

            if (!clientId || !branchId) {
                console.log(`   ⚠️  Ticket ${ticket.id} omitido`);
                continue;
            }

            const { error } = await supabase
                .from('tickets')
                .insert({
                    client_id: clientId,
                    branch_id: branchId,
                    technician_id: techId,
                    status_id: ticket.estadoId || 'nuevo',
                    description: ticket.descripcionProblema || '',
                    client_ticket_number: ticket.numeroTicketCliente || 'PENDIENTE',
                    labor_cost: ticket.costoManoObra || 0,
                    materials_cost: ticket.costoMateriales || 0,
                    visit_cost: ticket.costoVisita || 0,
                    total_quoted_amount: ticket.montoCotizado || 0,
                    metadata: {
                        service_type: ticket.tipoServicio,
                        original_id: ticket.id
                    }
                });

            if (error) throw error;
            created++;
        } catch (error) {
            console.error(`   ❌ Error con ticket ${ticket.id}:`, error.message);
        }
    }

    console.log(`   📊 Total: ${created} tickets creados\n`);
}

async function runMigration(data) {
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
        console.log(`\n📊 Clientes en Supabase: ${clients.length}`);
        clients.forEach(c => console.log(`   - ${c.name}`));

    } catch (error) {
        console.error('\n❌ Error:', error.message);
    }
}

// Ejecutar con datos de ejemplo
console.log('⚠️  USANDO DATOS DE EJEMPLO');
console.log('Para usar tus datos reales, exporta localStorage y pásalo como argumento\n');

runMigration(SAMPLE_DATA);
