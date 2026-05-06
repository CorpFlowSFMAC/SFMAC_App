// ═════════════════════════════════════════════════════════════
// 🔄 MIGRACIÓN DE TICKETS ANTIGUOS
// Agrega campos faltantes a tickets históricos para compatibilidad V3
// ═════════════════════════════════════════════════════════════

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

// Campos requeridos por la V3
const DEFAULT_VALUES = {
    // Ticket basic fields
    status_id: 'nuevo',
    service_type: 'Mantenimiento',
    priority: 'media',
    current_step: 1,
    
    // Financial fields
    labor_cost: 0,
    materials_cost: 0,
    visit_cost: 0,
    total_quoted_amount: 0,
    
    // Assignment fields
    gestor_id: null,
    technician_id: null,
    
    // Location fields  
    id_sucursal: null,
    branch_id: null,
    zona_id: null,
    
    // Dates
    creado_en: new Date().toISOString(),
    actualizado_en: new Date().toISOString(),
};

// Run migration
export async function migrateOldTickets() {
    console.log('[Migration] Starting tickets migration...');
    
    // Get all tickets
    const { data: tickets, error } = await supabase
        .from('tickets')
        .select('id, status_id, service_type, priority, created_at')
        .order('created_at', { ascending: false });
    
    if (error) {
        console.error('[Migration] Error fetching tickets:', error);
        return;
    }
    
    console.log(`[Migration] Found ${tickets?.length || 0} tickets`);
    
    // Find tickets missing critical fields
    const toMigrate = tickets?.filter(t => 
        !t.status_id && !t.service_type
    ) || [];
    
    if (toMigrate.length === 0) {
        console.log('[Migration] No tickets need migration');
        return;
    }
    
    console.log(`[Migration] Migrating ${toMigrate.length} tickets...`);
    
    // Update each ticket with defaults
    for (const ticket of toMigrate) {
        const { error: updateError } = await supabase
            .from('tickets')
            .update({
                status_id: DEFAULT_VALUES.status_id,
                service_type: DEFAULT_VALUES.service_type,
                priority: DEFAULT_VALUES.priority,
                current_step: DEFAULT_VALUES.current_step,
                labor_cost: DEFAULT_VALUES.labor_cost,
                materials_cost: DEFAULT_VALUES.materials_cost,
                visit_cost: DEFAULT_VALUES.visit_cost,
                total_quoted_amount: DEFAULT_VALUES.total_quoted_amount,
                creado_en: ticket.created_at || new Date().toISOString(),
                actualizado_en: new Date().toISOString(),
            })
            .eq('id', ticket.id);
        
        if (updateError) {
            console.error(`[Migration] Error updating ticket ${ticket.id}:`, updateError);
        }
    }
    
    console.log('[Migration] Migration complete');
    
    return {
        total: tickets?.length || 0,
        migrated: toMigrate.length
    };
}

// Export for API route
export default async function handler(req: any, res: any) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }
    
    try {
        const result = await migrateOldTickets();
        res.status(200).json(result);
    } catch (error) {
        console.error('[Migration] Error:', error);
        res.status(500).json({ error: 'Migration failed' });
    }
}