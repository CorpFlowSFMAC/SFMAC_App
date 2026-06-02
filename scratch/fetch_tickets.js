async function measureLatency(url, headers, label) {
    console.log(`⏱️ Midiendo latencia para ${label}...`);
    const times = [];
    let payloadSize = 0;
    for (let i = 0; i < 5; i++) {
        const start = Date.now();
        const res = await globalThis.fetch(url, { headers });
        const text = await res.text();
        payloadSize = text.length;
        const duration = Date.now() - start;
        times.push(duration);
        console.log(`  - Petición #${i+1}: ${duration} ms (Tamaño: ${(text.length / 1024).toFixed(2)} KB)`);
    }
    const avg = times.reduce((a, b) => a + b, 0) / times.length;
    console.log(`📊 Promedio ${label}: ${avg.toFixed(2)} ms (Payload: ${(payloadSize / 1024).toFixed(2)} KB)\n`);
    return avg;
}

async function main() {
    const apiHeaders = {
        'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNvcnBmbG93c2ZtYWMtaGV0em5lciIsInJvbGUiOiJhbm9uIiwiaWF0IjoxNzc4NzQ4NTY5LCJleHAiOjIwODU3MjkyOTR9.UVpFZwAHuUFXKEwZANp58HP3x-9wgFGrvVY12yoC9MI',
        'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNvcnBmbG93c2ZtYWMtaGV0em5lciIsInJvbGUiOiJhbm9uIiwiaWF0IjoxNzc4NzQ4NTY5LCJleHAiOjIwODU3MjkyOTR9.UVpFZwAHuUFXKEwZANp58HP3x-9wgFGrvVY12yoC9MI'
    };

    console.log('📡 PRUEBA DE LATENCIA DE PRODUCCIÓN CON FILTRADO SELECTIVO (SIN METADATA)\n');
    
    // Medir la latencia con la selección optimizada de columnas
    await measureLatency(
        'https://api.sinfimac.pe/rest/v1/tickets?select=id,ticket_number,status_id,service_type,description,client_ticket_number,created_at,labor_cost,materials_cost,visit_cost,total_quoted_amount,client_id,branch_id,technician_id,gestora_id,diagnosis,priority,sede_reportada_cliente',
        apiHeaders,
        'Supabase API OPTIMIZADA (Sin metadata)'
    );
}

main().catch(console.error);
