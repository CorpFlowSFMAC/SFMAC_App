import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET() {
    try {
        const { data: tickets, error } = await supabase
            .from('tickets')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(500);

        if (error) throw error;

        const julyStart = '2026-07-01';
        const julyEnd = '2026-07-31T23:59:59';
        
        let totalIngresos = 0;
        let totalUtilidad = 0;
        let totalLaborCost = 0;
        const julyTickets: any[] = [];

        for (const t of tickets || []) {
            const closureDate = t.closure_date;
            const statusId = t.status_id;
            
            if (statusId !== 'ticket_cerrado') continue;
            if (!closureDate || closureDate < julyStart || closureDate > julyEnd) continue;

            let ingresos = 0;
            if (t.ingresos_reales) {
                ingresos = parseFloat(t.ingresos_reales);
            } else if (t.metadata?.ingresos_reales) {
                ingresos = parseFloat(t.metadata.ingresos_reales);
            } else if (t.metadata?.montoSubtotal) {
                ingresos = parseFloat(t.metadata.montoSubtotal);
            }

            const laborCost = parseFloat(t.labor_cost || 0) || 0;
            const utilidad = ingresos - laborCost;

            totalIngresos += ingresos;
            totalLaborCost += laborCost;
            totalUtilidad += utilidad;

            julyTickets.push({
                num: t.client_ticket_number,
                ingresos,
                laborCost,
                utilidad,
                closure_date: closureDate,
            });
        }

        return NextResponse.json({
            success: true,
            july_tickets: julyTickets,
            metrics: {
                total_ingresos: Math.round(totalIngresos * 100) / 100,
                total_labor_cost: Math.round(totalLaborCost * 100) / 100,
                total_utilidad: Math.round(totalUtilidad * 100) / 100,
            },
            total_tickets_processed: tickets?.length || 0,
        });

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
