/**
 * sanitizeOrphanPayments.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * FUNCIÓN DE SANEAMIENTO MASIVO — Objetivo 3 del Fix STD0011.26
 *
 * Identifica todas las ticket_costs en estado "pendiente" de categoría
 * Mano de Obra / Rescate cuyo monto ya esté cubierto por los pagos
 * confirmados del mismo ticket, y las actualiza a "RECHAZADO".
 *
 * REGLA: Un costo MO pendiente es zombie si netLaborBalance <= 0
 * IDEMPOTENTE: Si no hay zombies, no realiza ninguna mutación.
 *
 * USO:
 *   import { sanitizeOrphanMOPayments } from "@/lib/sanitizeOrphanPayments";
 *   const report = await sanitizeOrphanMOPayments(supabase);
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { calculateTicketFinances } from "./calculations";

/** Categorías de Mano de Obra — sincronizado con LABOR_CATEGORIES en @/lib/calculations.ts */
const LABOR_CATEGORIES_LC = [
    "mano de obra",
    "rescate financiero",
    "rescate",
    "honorarios",
    "bono",
    "adelanto",
    "adelanto operativo",
];

export interface OrphanRecord {
    costId: string;
    ticketId: string;
    ticketNumber: string;
    concepto: string;
    categoria: string;
    monto: number;
    netLaborBalance: number;
    totalLaborConfirmed: number;
    pactedMO: number;
    action: "marcado_rechazado" | "sin_cambio";
    error?: string;
}

export interface SanitationReport {
    scannedCosts: number;
    scannedTickets: number;
    zombiesFound: number;
    zombiesSanitized: number;
    zombiesWithErrors: number;
    records: OrphanRecord[];
    timestamp: string;
}

/**
 * Ejecuta el saneamiento masivo de costos de MO zombie.
 * @param supabase - Cliente Supabase con service_role.
 * @returns SanitationReport con el resultado de cada registro procesado.
 */
export async function sanitizeOrphanMOPayments(supabase: any): Promise<SanitationReport> {
    const report: SanitationReport = {
        scannedCosts: 0,
        scannedTickets: 0,
        zombiesFound: 0,
        zombiesSanitized: 0,
        zombiesWithErrors: 0,
        records: [],
        timestamp: new Date().toISOString(),
    };

    // ── PASO 1: Costos pendientes de MO/Rescate ──────────────────────────────
    const { data: pendingCosts, error: costsErr } = await supabase
        .from("ticket_costs")
        .select("id, ticket_id, concepto, categoria, monto, estado_pago, created_at")
        .eq("estado_pago", "pendiente");

    if (costsErr) {
        throw new Error(`[sanitizeOrphanMOPayments] Error: ${costsErr.message}`);
    }

    const laborPendingCosts = (pendingCosts || []).filter((c: any) => {
        const catLC = (c.categoria || "").toLowerCase().trim();
        return LABOR_CATEGORIES_LC.some(lc => catLC.includes(lc));
    });

    report.scannedCosts = laborPendingCosts.length;

    if (laborPendingCosts.length === 0) {
        console.log("[sanitizeOrphanMOPayments] Sin costos pendientes de MO. Nada que sanear.");
        return report;
    }

    // ── PASO 2: Agrupar por ticket_id ────────────────────────────────────────
    const ticketIds: string[] = [...new Set<string>(laborPendingCosts.map((c: any) => c.ticket_id))];
    report.scannedTickets = ticketIds.length;

    console.log(`[sanitizeOrphanMOPayments] ${laborPendingCosts.length} costos MO pendientes en ${ticketIds.length} tickets...`);

    // ── PASO 3: Por ticket, calcular balance real ────────────────────────────
    for (const ticketId of ticketIds) {
        const { data: ticket, error: tErr } = await supabase
            .from("tickets")
            .select("id, client_ticket_number, status_id, labor_cost, total_quoted_amount, metadata, technician_id")
            .eq("id", ticketId)
            .single();

        if (tErr || !ticket) {
            console.error(`[sanitizeOrphanMOPayments] No se pudo leer ticket ${ticketId}:`, tErr?.message);
            continue;
        }

        const { data: allCosts } = await supabase
            .from("ticket_costs")
            .select("*")
            .eq("ticket_id", ticketId);

        // Motor financiero V3 — fuente de verdad
        const finances = calculateTicketFinances(ticket, allCosts || []);
        const { netLaborBalance, totalLaborConfirmed, pactedMO } = finances;

        const zombiesForTicket = laborPendingCosts.filter((c: any) => c.ticket_id === ticketId);

        for (const zombie of zombiesForTicket) {
            const record: OrphanRecord = {
                costId: zombie.id,
                ticketId,
                ticketNumber: ticket.client_ticket_number || ticketId,
                concepto: zombie.concepto,
                categoria: zombie.categoria,
                monto: zombie.monto,
                netLaborBalance,
                totalLaborConfirmed,
                pactedMO,
                action: "sin_cambio",
            };

            // CRITERIO ZOMBIE: saldo neto ya es <= 0 (MO completamente cubierta)
            if (netLaborBalance <= 0) {
                report.zombiesFound++;
                console.warn(
                    `[sanitizeOrphanMOPayments] ZOMBIE: Ticket=${ticket.client_ticket_number} | ` +
                    `CostID=${zombie.id} | S/${zombie.monto} | saldo=${netLaborBalance}`
                );

                try {
                    const { error: updErr } = await supabase
                        .from("ticket_costs")
                        .update({
                            estado_pago: "RECHAZADO",
                            motivo:
                                `Saneamiento automatico [${new Date().toISOString()}]: ` +
                                `Costo zombie — saldo MO ya cubierto. ` +
                                `pactadoMO=S/${pactedMO} | confirmado=S/${totalLaborConfirmed} | saldo=S/${netLaborBalance}.`,
                            fecha_pago: new Date().toISOString(),
                        })
                        .eq("id", zombie.id)
                        .eq("estado_pago", "pendiente"); // idempotencia

                    if (updErr) throw new Error(updErr.message);

                    record.action = "marcado_rechazado";
                    report.zombiesSanitized++;
                    console.log(`[sanitizeOrphanMOPayments] Saneado: ${zombie.id}`);
                } catch (err: any) {
                    record.action = "sin_cambio";
                    record.error = err?.message || String(err);
                    report.zombiesWithErrors++;
                    console.error(`[sanitizeOrphanMOPayments] Error al sanear ${zombie.id}:`, err?.message);
                }
            } else {
                console.log(
                    `[sanitizeOrphanMOPayments] OK (saldo positivo): Ticket=${ticket.client_ticket_number} | ` +
                    `CostID=${zombie.id} | saldo=S/${netLaborBalance}`
                );
            }

            report.records.push(record);
        }
    }

    console.log(
        `[sanitizeOrphanMOPayments] RESUMEN: ` +
        `Escaneados=${report.scannedCosts} | Zombies=${report.zombiesFound} | ` +
        `Saneados=${report.zombiesSanitized} | Errores=${report.zombiesWithErrors}`
    );

    return report;
}
