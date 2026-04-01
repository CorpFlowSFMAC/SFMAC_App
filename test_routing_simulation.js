
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config();

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function testWebhookSimulation() {
    console.log("🚀 Iniciando Simulación de Ingesta de Ticket (Otuzco)...");

    // 1. Datos del correo simulado
    const rawPayload = {
        from: "mibancoseguridad@sinfimac.pe",
        subject: "Mantenimiento Otuzco - MB005559.26",
        body: "Ticket: MB005559.26\nAgencia: AG357 - AG OTUZCO MATRIZ\nServicio: MANTENIMIENTO PREVENTIVO\nPrioridad: ALTA",
        metadata: {
            remitente_original: "j.portocarrero@sinfimac.pe",
            titulo: "MB005559.26 - AG357 - AG OTUZCO MATRIZ"
        }
    };

    // 2. Simular la lógica de búsqueda de sede (Extraída de route.ts)
    const rawSede = "AG357 - AG OTUZCO MATRIZ";
    const cleanSede = rawSede.replace(/AG\d+/g, '').replace(/AG\s/g, '').replace(/MATRIZ|SUCURSAL|AGENCIA/g, '').trim();
    console.log(`🔍 Sede Limpia: [${cleanSede}]`);

    // 3. Buscar en Supabase
    const { data: branches } = await supabase.from('branch_offices').select('*, clients(*), zonas(*)');
    const matchedBranch = branches.find(b => cleanSede.toLowerCase().includes(b.name.toLowerCase()));
    
    if (!matchedBranch) {
        console.error("❌ No se encontró sede.");
        return;
    }

    console.log(`✅ Sede Encontrada: ${matchedBranch.name} (ID: ${matchedBranch.id})`);
    console.log(`👤 Gestora Asignada (Sede): ${matchedBranch.gestora_asignada_id}`);

    // 4. Crear el ticket
    const newTicket = {
        client_id: matchedBranch.client_id,
        branch_id: matchedBranch.id,
        gestora_id: matchedBranch.gestora_asignada_id, // DEBE SER JANETH
        service_type: "Mantenimiento preventivo",
        description: "Simulación de prueba de enrutamiento",
        client_ticket_number: "MB005559.26",
        status_id: "nuevo",
        metadata: {
            ...rawPayload.metadata,
            simulacion: true,
            enrutamiento_verificado: true
        }
    };

    const { data: ticket, error } = await supabase.from('tickets').insert(newTicket).select('*').single();
    if (error) {
        console.error("❌ Error creando ticket:", error);
    } else {
        console.log(`🎉 Ticket Creado: ID ${ticket.id} | Gestora ID ${ticket.gestora_id}`);
        console.log("--------------------------------------------------");
        console.log("RESULTADO ESPERADO:");
        console.log(`- Janeth Portocarrero (${ticket.gestora_id}) DEBE verlo.`);
        console.log(`- Francen Marin (9628f...) NO DEBE verlo.`);
    }
}

testWebhookSimulation();
