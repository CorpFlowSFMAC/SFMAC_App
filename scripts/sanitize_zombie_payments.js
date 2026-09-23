/**
 * scripts/sanitize_zombie_payments.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Script Node.js standalone para ejecutar el saneamiento de costos zombie MO.
 * Puede ejecutarse directamente: node scripts/sanitize_zombie_payments.js
 *
 * También sirve como SCRIPT DE AUDITORIA para detectar zombies sin mutar.
 * Pasar --dry-run para solo listar sin modificar.
 * ─────────────────────────────────────────────────────────────────────────────
 */
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://api.sinfimac.pe';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNvcnBmbG93c2ZtYWMtaGV0em5lciIsInJvbGUiOiJzZXJ2aWNlX3JvbGUiLCJpYXQiOjE3Nzg3NDg1NjksImV4cCI6MjA4NTcyOTI5NH0.vLLePfYAiz9YCvJEIwk-YLx2RXgyLNCKHMVHlc2vAEc';

const isDryRun = process.argv.includes('--dry-run');

// ── LABOR CATEGORIES — sincronizado con LABOR_CATEGORIES en src/lib/calculations.ts ──
const LABOR_CATEGORIES_LC = [
    'mano de obra', 'rescate financiero', 'rescate',
    'honorarios', 'bono', 'adelanto', 'adelanto operativo',
];
const CONFIRMED_STATUSES = new Set([
    'pagado', 'abonado', 'confirmado', 'auditado',
    'ejecutado', 'autorizado admin', 'autorizado',
    'transferido', 'completado',
]);

function isConfirmed(status) {
    const s = (status || '').toLowerCase().trim();
    return CONFIRMED_STATUSES.has(s) || [...CONFIRMED_STATUSES].some(v => s.includes(v));
}

function isLaborCost(cost, mainTechnicianId) {
    const cat = (cost.categoria || '').toLowerCase().trim();
    const isLaborCategory = LABOR_CATEGORIES_LC.some(lc => cat.includes(lc));
    if (!isLaborCategory) return false;
    // Relacional: specialist_id === mainTechnicianId → labor
    if (cost.specialist_id && mainTechnicianId) {
        return cost.specialist_id === mainTechnicianId;
    }
    return isLaborCategory;
}

async function main() {
    console.log(`\n══════════════════════════════════════════════════════`);
    console.log(`  SINFIMAC — Saneamiento Masivo Costos MO Zombie`);
    console.log(`  Modo: ${isDryRun ? 'DRY-RUN (solo lectura)' : 'PRODUCCION (mutacion activa)'}`);
    console.log(`  Fecha: ${new Date().toISOString()}`);
    console.log(`══════════════════════════════════════════════════════\n`);

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    // 1. Obtener costos pendientes MO
    const { data: pendingCosts, error } = await supabase
        .from('ticket_costs')
        .select('id, ticket_id, concepto, categoria, monto, estado_pago, specialist_id, created_at')
        .eq('estado_pago', 'pendiente');

    if (error) throw new Error(`Error consultando ticket_costs: ${error.message}`);

    const laborPending = (pendingCosts || []).filter(c => {
        const cat = (c.categoria || '').toLowerCase();
        return LABOR_CATEGORIES_LC.some(lc => cat.includes(lc));
    });

    console.log(`Costos MO pendientes encontrados: ${laborPending.length}`);
    if (laborPending.length === 0) {
        console.log('Nada que sanear. DB limpia.');
        return;
    }

    // 2. Agrupar por ticket
    const byTicket = {};
    laborPending.forEach(c => {
        if (!byTicket[c.ticket_id]) byTicket[c.ticket_id] = [];
        byTicket[c.ticket_id].push(c);
    });

    const ticketIds = Object.keys(byTicket);
    console.log(`Tickets afectados: ${ticketIds.length}\n`);

    const results = { zombiesFound: 0, saneados: 0, errores: 0, ok: 0 };

    for (const ticketId of ticketIds) {
        const { data: ticket } = await supabase
            .from('tickets')
            .select('id, client_ticket_number, technician_id, labor_cost')
            .eq('id', ticketId)
            .single();

        if (!ticket) { console.warn(`Ticket no encontrado: ${ticketId}`); continue; }

        const { data: allCosts } = await supabase
            .from('ticket_costs')
            .select('id, categoria, concepto, monto, estado_pago, specialist_id')
            .eq('ticket_id', ticketId);

        const mainTechId = ticket.technician_id;
        const pactedMO = parseFloat(ticket.labor_cost || 0);

        // Calcular totalLaborConfirmed
        const totalLaborConfirmed = (allCosts || [])
            .filter(c => isConfirmed(c.estado_pago) && isLaborCost(c, mainTechId))
            .reduce((sum, c) => sum + parseFloat(c.monto || 0), 0);

        const netLaborBalance = Math.max(0, pactedMO - totalLaborConfirmed);

        const zombies = byTicket[ticketId];

        for (const zombie of zombies) {
            const tag = `  [${ticket.client_ticket_number}] CostID=${zombie.id.substring(0,8)}... S/${zombie.monto}`;

            if (netLaborBalance <= 0) {
                results.zombiesFound++;
                console.log(`ZOMBIE ${tag} | saldo=S/${netLaborBalance.toFixed(2)} | pactado=S/${pactedMO} | pagado=S/${totalLaborConfirmed.toFixed(2)}`);

                if (!isDryRun) {
                    const { error: updErr } = await supabase
                        .from('ticket_costs')
                        .update({
                            estado_pago: 'RECHAZADO',
                            motivo: `Saneamiento automatico [${new Date().toISOString()}]: zombie. pactadoMO=S/${pactedMO} confirmado=S/${totalLaborConfirmed.toFixed(2)} saldo=S/${netLaborBalance.toFixed(2)}.`,
                            fecha_pago: new Date().toISOString(),
                        })
                        .eq('id', zombie.id)
                        .eq('estado_pago', 'pendiente');

                    if (updErr) {
                        console.error(`  ERROR al sanear: ${updErr.message}`);
                        results.errores++;
                    } else {
                        console.log(`  SANEADO`);
                        results.saneados++;
                    }
                }
            } else {
                results.ok++;
                console.log(`OK     ${tag} | saldo=S/${netLaborBalance.toFixed(2)} (saldo real positivo)`);
            }
        }
    }

    console.log(`\n══════════════════════════════════════════════════════`);
    console.log(`  RESUMEN FINAL:`);
    console.log(`  Zombies detectados : ${results.zombiesFound}`);
    if (!isDryRun) {
        console.log(`  Saneados OK        : ${results.saneados}`);
        console.log(`  Con errores        : ${results.errores}`);
    }
    console.log(`  Sin cambio (OK)    : ${results.ok}`);
    if (isDryRun) console.log(`  (Dry-run: sin mutaciones)`);
    console.log(`══════════════════════════════════════════════════════\n`);
}

main().catch(err => {
    console.error('Error fatal:', err);
    process.exit(1);
});
