// SCRIPT DE MIGRACIÓN DE TICKETS
// Ejecutar en la consola del navegador para limpiar estados antiguos

console.log("🔄 Iniciando migración de tickets...");

// 1. Limpiar localStorage de tickets guardados con estados incorrectos
const keys = Object.keys(localStorage);
let migratedCount = 0;

keys.forEach(key => {
    if (key.startsWith('ticket_state_')) {
        try {
            const data = JSON.parse(localStorage.getItem(key));
            if (data && (data.estadoId === 1 || data.estadoId === "1" || !data.estadoId)) {
                data.estadoId = "nuevo";
                localStorage.setItem(key, JSON.stringify(data));
                migratedCount++;
                console.log(`✅ Migrado: ${key}`);
            }
        } catch (e) {
            console.error(`❌ Error en ${key}:`, e);
        }
    }
});

// 2. Migrar la lista principal de tickets
try {
    const tickets = JSON.parse(localStorage.getItem('tickets') || '[]');
    let ticketsMigrated = 0;

    const updatedTickets = tickets.map(ticket => {
        if (ticket.estadoId === 1 || ticket.estadoId === "1" || !ticket.estadoId) {
            ticket.estadoId = "nuevo";
            ticketsMigrated++;
            return ticket;
        }
        return ticket;
    });

    if (ticketsMigrated > 0) {
        localStorage.setItem('tickets', JSON.stringify(updatedTickets));
        console.log(`✅ ${ticketsMigrated} tickets migrados en la lista principal`);
    }
} catch (e) {
    console.error("❌ Error migrando lista de tickets:", e);
}

console.log(`\n✨ Migración completada!`);
console.log(`📊 ${migratedCount} estados de tickets individuales migrados`);
console.log(`\n💡 Recarga la página para ver los cambios`);
