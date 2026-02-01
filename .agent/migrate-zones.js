/**
 * SCRIPT DE MIGRACIÓN DE ZONAS
 * Ejecutar en la consola del navegador para normalizar las zonas
 * de técnicos y sedes de clientes
 */

// Mapa de migración
const ZONE_MIGRATION_MAP = {
    // Zonas antiguas de técnicos
    "ZONA NORTE": "NORTE",
    "ZONA SUR": "SUR",
    "ZONA CENTRO": "CENTRO",
    "ZONA ORIENTE": "ORIENTE",
    "LIMA METROPOLITANA": "LIMA_METROPOLITANA",

    // Zonas antiguas de clientes
    "Norte": "NORTE",
    "Sur": "SUR",
    "Centro": "CENTRO",
    "Oriente": "ORIENTE",
    "Lima Centro": "LIMA_METROPOLITANA",
    "Lima": "LIMA_METROPOLITANA",
};

function normalizeZone(oldZone) {
    if (!oldZone) return "LIMA_METROPOLITANA";
    return ZONE_MIGRATION_MAP[oldZone] || oldZone;
}

console.log("🔄 Iniciando migración de zonas...\n");

let totalMigrated = 0;

// 1. Migrar técnicos
try {
    const techs = JSON.parse(localStorage.getItem('technicians') || '[]');
    let techsMigrated = 0;

    const updatedTechs = techs.map(tech => {
        const oldZone = tech.zona;
        const newZone = normalizeZone(oldZone);

        if (oldZone !== newZone) {
            console.log(`  👨‍🔧 Técnico: ${tech.nombre || 'N/A'} - "${oldZone}" → "${newZone}"`);
            techsMigrated++;
        }

        return { ...tech, zona: newZone };
    });

    if (techsMigrated > 0) {
        localStorage.setItem('technicians', JSON.stringify(updatedTechs));
        console.log(`\n✅ ${techsMigrated} técnicos migrados`);
        totalMigrated += techsMigrated;
    }
} catch (e) {
    console.error("❌ Error migrando técnicos:", e);
}

// 2. Migrar clientes (sedes/agencias)
try {
    const clients = JSON.parse(localStorage.getItem('clients') || '[]');
    let branchesMigrated = 0;

    const updatedClients = clients.map(client => {
        if (client.agencias && Array.isArray(client.agencias)) {
            client.agencias = client.agencias.map(branch => {
                const oldZone = branch.zona;
                const newZone = normalizeZone(oldZone);

                if (oldZone !== newZone) {
                    console.log(`  🏢 Agencia: ${branch.nombre || 'N/A'} - "${oldZone}" → "${newZone}"`);
                    branchesMigrated++;
                }

                return { ...branch, zona: newZone };
            });
        }
        return client;
    });

    if (branchesMigrated > 0) {
        localStorage.setItem('clients', JSON.stringify(updatedClients));
        console.log(`\n✅ ${branchesMigrated} agencias migradas`);
        totalMigrated += branchesMigrated;
    }
} catch (e) {
    console.error("❌ Error migrando clientes:", e);
}

// 3. Migrar tickets existentes
try {
    const tickets = JSON.parse(localStorage.getItem('tickets') || '[]');
    let ticketsMigrated = 0;

    const updatedTickets = tickets.map(ticket => {
        let changed = false;

        // Migrar zona de la sede
        if (ticket.sede && ticket.sede.zona) {
            const oldZone = ticket.sede.zona;
            const newZone = normalizeZone(oldZone);

            if (oldZone !== newZone) {
                ticket.sede.zona = newZone;
                changed = true;
            }
        }

        // Migrar zona del técnico asignado
        if (ticket.tecnicoAsignado && ticket.tecnicoAsignado.zona) {
            const oldZone = ticket.tecnicoAsignado.zona;
            const newZone = normalizeZone(oldZone);

            if (oldZone !== newZone) {
                ticket.tecnicoAsignado.zona = newZone;
                changed = true;
            }
        }

        if (changed) {
            console.log(`  🎫 Ticket: ${ticket.id} - zonas normalizadas`);
            ticketsMigrated++;
        }

        return ticket;
    });

    if (ticketsMigrated > 0) {
        localStorage.setItem('tickets', JSON.stringify(updatedTickets));
        console.log(`\n✅ ${ticketsMigrated} tickets migrados`);
        totalMigrated += ticketsMigrated;
    }
} catch (e) {
    console.error("❌ Error migrando tickets:", e);
}

// 4. Migrar estados de tickets individuales
try {
    const keys = Object.keys(localStorage);
    let statesMigrated = 0;

    keys.forEach(key => {
        if (key.startsWith('ticket_state_')) {
            try {
                const ticketState = JSON.parse(localStorage.getItem(key));
                let changed = false;

                if (ticketState.sede && ticketState.sede.zona) {
                    const oldZone = ticketState.sede.zona;
                    const newZone = normalizeZone(oldZone);

                    if (oldZone !== newZone) {
                        ticketState.sede.zona = newZone;
                        changed = true;
                    }
                }

                if (ticketState.tecnicoAsignado && ticketState.tecnicoAsignado.zona) {
                    const oldZone = ticketState.tecnicoAsignado.zona;
                    const newZone = normalizeZone(oldZone);

                    if (oldZone !== newZone) {
                        ticketState.tecnicoAsignado.zona = newZone;
                        changed = true;
                    }
                }

                if (changed) {
                    localStorage.setItem(key, JSON.stringify(ticketState));
                    statesMigrated++;
                }
            } catch (e) {
                console.error(`❌ Error en ${key}:`, e);
            }
        }
    });

    if (statesMigrated > 0) {
        console.log(`\n✅ ${statesMigrated} estados de tickets migrados`);
        totalMigrated += statesMigrated;
    }
} catch (e) {
    console.error("❌ Error migrando estados:", e);
}

console.log(`\n\n✨ Migración completada!`);
console.log(`📊 Total de registros migrados: ${totalMigrated}`);
console.log(`\n💡 Las nuevas zonas son:`);
console.log(`   - LIMA_METROPOLITANA (Lima)`);
console.log(`   - NORTE (Tumbes, Piura, Lambayeque, La Libertad, Cajamarca, Amazonas)`);
console.log(`   - SUR (Arequipa, Moquegua, Tacna, Puno, Cusco, Apurímac)`);
console.log(`   - CENTRO (Ica, Huancavelica, Junín, Pasco, Huánuco, Ancash)`);
console.log(`   - ORIENTE (Loreto, San Martín, Ucayali, Madre de Dios)`);
console.log(`\n🔄 Recarga la página para ver los cambios`);
