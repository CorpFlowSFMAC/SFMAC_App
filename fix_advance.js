const fs = require('fs');
const file = 'src/app/dashboard/admin/tickets/TicketWindow.tsx';
let content = fs.readFileSync(file, 'utf8');

const target1 = `            const createResult = await ticketCostsAPI.create({
                ticket_id: currentId,
                concepto: conceptPrefix,
                categoria: category,
                specialist_id: technicianId,
                monto: amount,`;

// We'll replace the text starting from \`const createResult\` up to \`setTicketData(updated);\`
const split1 = content.split('const createResult = await ticketCostsAPI.create({');

if (split1.length > 3) {
    // There are multiple ticketCostsAPI.create calls. We know it's inside \`handleConfirmAdvance\`
    // So let's look for:
}

// Alternatively, let's just replace the exact lines:
content = content.replace(
    /const createResult = await ticketCostsAPI\.create\(\{\n\s*ticket_id: currentId,\n\s*concepto: conceptPrefix,\n\s*categoria: category,\n\s*specialist_id: technicianId,\n\s*monto: amount,\n\s*estado_pago: "pendiente",[\s\S]*?setTicketData\(updated\);/,
    \`const newState = ticketData.status_id === 'cotizacion_aprobada' ? 'en_ejecucion' : ticketData.status_id;
            const createResult = await ticketCostsAPI.create({
                ticket_id: currentId,
                concepto: conceptPrefix,
                categoria: category,
                specialist_id: technicianId,
                monto: amount,
                estado_pago: "pagado",
                solicitado_por: myProfileId || undefined
            });
            if (!createResult) {
                throw new Error('API rejected cost creation');
            }
            const patchResult = await ticketsAPI.patchMetadata(ticketData.id, { solicitudAdelanto: null }, { status_id: newState });
            if (!patchResult) {
                throw new Error('API rejected metadata patch');
            }
            const updated = {
                ...ticketData,
                estadoId: newState,
                status_id: newState,
                adelantoPagado: !isForMaterials || ticketData.adelantoPagado,
                solicitudAdelanto: null,
                metadata: {
                    ...(ticketData.metadata || {}),
                    solicitudAdelanto: null,
                },
            };
            setTicketData(updated);\`
);

fs.writeFileSync(file, content);
console.log("Done");
