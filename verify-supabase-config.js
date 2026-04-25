/**
 * Script de Verificación de Configuración de Supabase
 * 
 * Este script verifica que:
 * 1. Las credenciales de Supabase sean correctas
 * 2. La conexión a Supabase funcione
 * 3. Las tablas principales existan
 * 4. Haya datos en las tablas
 */

const { createClient } = require('@supabase/supabase-js');

// Colores para la consola
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m',
};

// Credenciales de Supabase ACTUALIZADAS (Hetzner Server)
const SUPABASE_URL = 'http://87.99.137.96:8000';
const SUPABASE_ANON_KEY = 'CorpFlowSFMAC_Anon_Key_2026';

console.log(`${colors.bright}${colors.cyan}
╔════════════════════════════════════════════════════════════╗
🔍 VERIFICACIÓN DE CONFIGURACIÓN DE SUPABASE (HETZNER)
╚════════════════════════════════════════════════════════════╝
${colors.reset}\n`);

async function verificarSupabase() {
    try {
        // 1. Verificar credenciales
        console.log(`${colors.blue}📋 Paso 1: Verificando credenciales...${colors.reset}`);
        console.log(`    URL: ${SUPABASE_URL}`);
        console.log(`    Key: ${SUPABASE_ANON_KEY.substring(0, 10)}...`);

        if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
            throw new Error('Credenciales de Supabase no configuradas');
        }
        console.log(`    ${colors.green}✓ Credenciales configuradas${colors.reset}\n`);

        // 2. Crear cliente de Supabase
        console.log(`${colors.blue}📋 Paso 2: Creando cliente de Supabase...${colors.reset}`);
        const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        console.log(`    ${colors.green}✓ Cliente creado${colors.reset}\n`);

        // 3. Verificar conexión y tablas
        console.log(`${colors.blue}📋 Paso 3: Verificando conexión a la base de datos...${colors.reset}`);

        const tablas = [
            { nombre: 'clients', descripcion: 'Clientes' },
            { nombre: 'branch_offices', descripcion: 'Sedes' },
            { nombre: 'technicians', descripcion: 'Técnicos' },
            { nombre: 'tickets', descripcion: 'Tickets' },
        ];

        const resultados = {};

        for (const tabla of tablas) {
            try {
                const { data, error, count } = await supabase
                    .from(tabla.nombre)
                    .select('*', { count: 'exact', head: true });

                if (error) {
                    console.log(`    ${colors.red}✘ ${tabla.descripcion}: Error - ${error.message}${colors.reset}`);
                    resultados[tabla.nombre] = { exito: false, error: error.message };
                } else {
                    console.log(`    ${colors.green}✓ ${tabla.descripcion}: ${count} registros${colors.reset}`);
                    resultados[tabla.nombre] = { exito: true, count };
                }
            } catch (err) {
                console.log(`    ${colors.red}✘ ${tabla.descripcion}: Error de conexión${colors.reset}`);
                resultados[tabla.nombre] = { exito: false, error: err.message };
            }
        }

        console.log('');

        // 4. Verificar datos específicos
        console.log(`${colors.blue}📋 Paso 4: Verificando datos...${colors.reset}`);

        // Verificar clientes
        const { data: clients, error: clientsError } = await supabase
            .from('clients')
            .select('id, name')
            .limit(5);

        if (clientsError) {
            console.log(`    ${colors.red}✘ Error al obtener clientes: ${clientsError.message}${colors.reset}`);
        } else if (clients && clients.length > 0) {
            console.log(`    ${colors.green}✓ Clientes encontrados:${colors.reset}`);
            clients.forEach(c => {
                console.log(`      - ${c.name} (ID: ${c.id})`);
            });
        } else {
            console.log(`    ${colors.yellow}⚠️  No hay clientes en la base de datos${colors.reset}`);
        }

        console.log('');

        // 5. Resumen final
        console.log(`${colors.bright}${colors.cyan}
╔════════════════════════════════════════════════════════════╗
📋 RESUMEN DE VERIFICACIÓN
╚════════════════════════════════════════════════════════════╝
${colors.reset}`);

        const todasExitosas = Object.values(resultados).every(r => r.exito);

        if (todasExitosas) {
            console.log(`${colors.green}${colors.bright}✓ VERIFICACIÓN EXITOSA${colors.reset}`);
            console.log(`${colors.green}Todas las tablas están accesibles y la conexión a Supabase funciona correctamente en Hetzner.${colors.reset}`);
        } else {
            console.log(`${colors.red}${colors.bright}✘ VERIFICACIÓN FALLIDA${colors.reset}`);
            console.log(`${colors.red}Hay problemas con la conexión a Supabase o con las tablas.${colors.reset}`);
        }

        console.log(`\n${colors.cyan}╔════════════════════════════════════════════════════════════╗
${colors.reset}\n`);

    } catch (error) {
        console.log(`\n${colors.red}${colors.bright}✘ ERROR CRÍTICO${colors.reset}`);
        console.log(`${colors.red}Error: ${error.message}${colors.reset}`);
        process.exit(1);
    }
}

// Ejecutar verificación
verificarSupabase();
