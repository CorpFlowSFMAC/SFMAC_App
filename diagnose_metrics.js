import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://api.sinfimac.pe';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNvcnBmbG93c2ZtYWMtaGV0em5lciIsInJvbGUiOiJhbm9uIiwiaWF0IjoxNzc4NzQ4NTY5LCJleHAiOjIwODU3MjkyOTR9.UVpFZwAHuUFXKEwZANp58HP3x-9wgFGrvVY12yoC9MI';

const supabase = createClient(supabaseUrl, supabaseKey);

const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

async function main() {
    console.log('🔍 Diagnóstico de Métricas de Ingresos\n');
    console.log('='.repeat(60));
    
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    console.log('📅 Período actual:', startOfMonth, '→', now.toISOString());
    console.log('='.repeat(60));
    
    // Tickets cerrados en este mes
    const { data: closedTickets } = await supabase
        .from('tickets')
        .select('id, client_ticket_number, status_id, closure_date, total_quoted_amount, labor_cost, materials_cost, visit_cost, ticket_costs(count)')
        .eq('status_id', 'ticket_cerrado')
        .gte('closure_date', startOfMonth);
    
    console.log('\n📊 Tickets cerrados en este mes:', closedTickets?.length || 0);
    
    if (closedTickets && closedTickets.length > 0) {
        let totalIngresosBase = 0;
        let totalInversion = 0;
        
        console.log('\n┌────────────────────────────────────┬────────────┬────────────┬────────────┬────────────┐');
        console.log('│ Ticket                             │ Total Quote│ Base (÷1.18)│ Labor Cost │ Utilidad   │');
        console.log('├────────────────────────────────────┼────────────┼────────────┼────────────┼────────────┤');
        
        closedTickets.forEach(t => {
            const totalQuoted = parseFloat(t.total_quoted_amount || 0);
            const baseSinIGV = round2(totalQuoted / 1.18);
            const laborCost = parseFloat(t.labor_cost || 0);
            const materialsCost = parseFloat(t.materials_cost || 0);
            const visitCost = parseFloat(t.visit_cost || 0);
            const inversion = laborCost + materialsCost + visitCost;
            const utilidad = baseSinIGV - inversion;
            
            totalIngresosBase += baseSinIGV;
            totalInversion += inversion;
            
            const ticketNum = (t.client_ticket_number || t.id).substring(0, 30).padEnd(30);
            console.log(`│ ${ticketNum} │ S/ ${totalQuoted.toFixed(2).padStart(8)} │ S/ ${baseSinIGV.toFixed(2).padStart(8)} │ S/ ${inversion.toFixed(2).padStart(8)} │ S/ ${utilidad.toFixed(2).padStart(8)} │`);
        });
        
        console.log('└────────────────────────────────────┴────────────┴────────────┴────────────┴────────────┘');
        
        const totalUtilidad = totalIngresosBase - totalInversion;
        const margen = totalIngresosBase > 0 ? (totalUtilidad / totalIngresosBase * 100) : 0;
        
        console.log('\n📈 RESUMEN DE MÉTRICAS:');
        console.log('─'.repeat(50));
        console.log(`  Total Ingresos (Base sin IGV): S/ ${totalIngresosBase.toFixed(2)}`);
        console.log(`  Total Inversión (Costos):      S/ ${totalInversion.toFixed(2)}`);
        console.log(`  Utilidad Neta:                S/ ${totalUtilidad.toFixed(2)}`);
        console.log(`  Margen de Utilidad:           ${margen.toFixed(1)}%`);
        console.log('─'.repeat(50));
        
        if (totalIngresosBase > 0) {
            console.log('\n✅ Las métricas DEBERÍAN mostrar valores > 0 después del fix');
        } else {
            console.log('\n⚠️  No hay tickets con montos para calcular');
        }
    } else {
        console.log('\n⚠️  No hay tickets cerrados en este mes');
    }
    
    // Verificar columna ingresos_reales
    console.log('\n📋 Verificación de columna ingresos_reales:');
    const { error: colError } = await supabase
        .from('tickets')
        .update({ ingresos_reales: 0 })
        .eq('id', '00000000-0000-0000-0000-000000000000');
    
    if (colError && colError.message.includes('ingresos_reales')) {
        console.log('  ⚠️  Columna ingresos_reales NO existe en la tabla tickets');
        console.log('  📝 Los cambios de código usan fallback a total_quoted_amount/1.18');
        console.log('  💡 Para persistencia, ejecutar: sql/add_ingresos_reales_column.sql');
    } else {
        console.log('  ✅ Columna ingresos_reales existe');
    }
    
    console.log('\n✅ Diagnóstico completado');
}

main().catch(console.error);
