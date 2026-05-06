// API Route para migración de tickets
import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

const DEFAULT_VALUES = {
    status_id: 'nuevo',
    priority: 'media',
    current_step: 1,
    labor_cost: 0,
    materials_cost: 0,
    visit_cost: 0,
    total_quoted_amount: 0,
};

export async function POST() {
    try {
        console.log('[Migration API] Starting tickets migration...');
        
        // Get tickets missing required V3 fields
        const { data: tickets, error } = await supabase
            .from('tickets')
            .select('id, status_id, service_type, created_at')
            .or('status_id.is.null,service_type.is.null')
            .limit(100);
        
        if (error) throw error;
        
        if (!tickets || tickets.length === 0) {
            return NextResponse.json({ 
                message: 'No tickets need migration',
                migrated: 0 
            });
        }
        
        console.log(`[Migration API] Found ${tickets.length} tickets to migrate`);
        
        // Update each with V3 defaults
        for (const ticket of tickets) {
            const { error: updateError } = await supabase
                .from('tickets')
                .update({
                    status_id: ticket.status_id || DEFAULT_VALUES.status_id,
                    service_type: ticket.service_type || 'Mantenimiento',
                    priority: DEFAULT_VALUES.priority,
                    current_step: DEFAULT_VALUES.current_step,
                    labor_cost: DEFAULT_VALUES.labor_cost,
                    materials_cost: DEFAULT_VALUES.materials_cost,
                    visit_cost: DEFAULT_VALUES.visit_cost,
                    total_quoted_amount: DEFAULT_VALUES.total_quoted_amount,
                    actualizado_en: new Date().toISOString(),
                })
                .eq('id', ticket.id);
            
            if (updateError) {
                console.error(`Error updating ${ticket.id}:`, updateError);
            }
        }
        
        return NextResponse.json({ 
            message: 'Migration complete',
            migrated: tickets.length 
        });
        
    } catch (error: any) {
        console.error('[Migration API] Error:', error);
        return NextResponse.json({ 
            error: error.message 
        }, { status: 500 });
    }
}