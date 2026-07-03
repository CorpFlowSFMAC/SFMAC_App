import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET() {
    try {
        const { data: tickets, error } = await supabase
            .from('tickets')
            .select('id, client_ticket_number, status_id, closure_date, ingresos_reales, labor_cost')
            .order('created_at', { ascending: false })
            .limit(100);

        if (error) throw error;

        const julyClosed = (tickets || []).filter((t: any) => {
            const closure = t.closure_date;
            if (!closure) return false;
            return closure >= '2026-07-01' && closure <= '2026-07-31' && t.status_id === 'ticket_cerrado';
        });

        const totalIngresos = julyClosed.reduce((sum: number, t: any) => sum + (parseFloat(t.ingresos_reales) || 0), 0);
        const totalLaborCost = julyClosed.reduce((sum: number, t: any) => sum + (parseFloat(t.labor_cost) || 0), 0);

        return NextResponse.json({
            success: true,
            july_closed_count: julyClosed.length,
            july_tickets: julyClosed.map((t: any) => ({
                num: t.client_ticket_number,
                ingresos: t.ingresos_reales,
                labor: t.labor_cost,
                closure: t.closure_date,
            })),
            metrics: {
                total_ingresos: totalIngresos,
                total_labor: totalLaborCost,
                expected_utilidad: totalIngresos - totalLaborCost,
            },
        });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
