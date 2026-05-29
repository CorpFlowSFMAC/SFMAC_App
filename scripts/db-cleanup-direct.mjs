#!/usr/bin/env node
/**
 * SINFIMAC - Direct Database Cleanup (sin API)
 * 
 * ⚠️  ADVERTENCIA: Este script ELIMINA TODOS LOS DATOS
 * 
 * Uso directo:
 *   SUPABASE_SERVICE_ROLE_KEY=xxx node scripts/db-cleanup-direct.mjs
 * 
 * O desde CI/CD:
 *   node scripts/db-cleanup-direct.mjs
 */

import { createClient } from '@supabase/supabase-js';

const HETZNER_URL = 'https://api.sinfimac.pe';
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!serviceKey) {
    console.error('❌ Error: SUPABASE_SERVICE_ROLE_KEY no configurada');
    console.error('');
    console.error('Exporta la key:');
    console.error('  export SUPABASE_SERVICE_ROLE_KEY="tu_key"');
    console.error('');
    console.error('O ejecuta inline:');
    console.error('  SUPABASE_SERVICE_ROLE_KEY="tu_key" node scripts/db-cleanup-direct.mjs');
    process.exit(1);
}

const supabase = createClient(HETZNER_URL, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false }
});

const TABLES = [
    'ticket_payments',
    'ticket_costs',
    'ticket_evidences',
    'gestora_branch_assignments',
    'technician_branches',
    'debug_logs',
    'tickets'
];

async function getCounts() {
    const counts = {};
    for (const table of TABLES) {
        try {
            const { count, error } = await supabase
                .from(table)
                .select('*', { count: 'exact', head: true });
            counts[table] = error ? 'error' : (count || 0);
        } catch {
            counts[table] = 'error';
        }
    }
    return counts;
}

async function deleteAll(table) {
    try {
        // Truncar es más eficiente, pero puede no funcionar con RLS
        // Primero intentar DELETE
        const { error } = await supabase
            .from(table)
            .delete()
            .neq('id', '00000000-0000-0000-0000-000000000000');
        
        if (error) {
            // Intentar DELETE via SQL directo
            console.log(`   ↳ Intento alternativa...`);
            const { error: sqlErr } = await supabase.rpc('exec', {
                sql_query: `DELETE FROM ${table};`
            });
            if (sqlErr) return { error: sqlErr.message };
        }
        return { success: true };
    } catch (e) {
        return { error: e.message };
    }
}

async function disableRLS() {
    const tables = ['ticket_payments', 'ticket_costs', 'ticket_evidences', 
                   'tickets', 'debug_logs', 'gestora_branch_assignments', 'technician_branches'];
    
    for (const t of tables) {
        try {
            await supabase.rpc('exec', { sql_query: `ALTER TABLE ${t} DISABLE ROW LEVEL SECURITY;` });
        } catch {}
    }
}

async function enableRLS() {
    const tables = ['ticket_payments', 'ticket_costs', 'ticket_evidences', 
                   'tickets', 'debug_logs', 'gestora_branch_assignments', 'technician_branches'];
    
    for (const t of tables) {
        try {
            await supabase.rpc('exec', { sql_query: `ALTER TABLE ${t} ENABLE ROW LEVEL SECURITY;` });
        } catch {}
    }
}

async function main() {
    console.log('');
    console.log('╔══════════════════════════════════════════════╗');
    console.log('║    SINFIMAC - LIMPIEZA TOTAL DE DATABASE     ║');
    console.log('╚══════════════════════════════════════════════╝');
    console.log('');
    
    // Estado inicial
    console.log('📊 Estado inicial:');
    const before = await getCounts();
    for (const [t, c] of Object.entries(before)) {
        console.log(`   • ${t}: ${c}`);
    }
    console.log('');
    
    // Verificar confirmación
    if (!process.argv.includes('--confirm') && !process.argv.includes('-y')) {
        console.log('⚠️  Este script ELIMINARÁ TODOS LOS DATOS');
        console.log('');
        console.log('Para confirmar, ejecuta con:');
        console.log('  node scripts/db-cleanup-direct.mjs --confirm');
        console.log('  node scripts/db-cleanup-direct.mjs -y');
        console.log('');
        process.exit(0);
    }
    
    console.log('🔥 INICIANDO LIMPIEZA...');
    console.log('');
    
    // Desactivar RLS
    console.log('🔓 Desactivando RLS...');
    await disableRLS();
    console.log('');
    
    // Eliminar
    let errors = 0;
    for (const table of TABLES) {
        process.stdout.write(`🗑️  Eliminando ${table}... `);
        const result = await deleteAll(table);
        if (result.error) {
            console.log(`ERROR: ${result.error}`);
            errors++;
        } else {
            console.log('✓');
        }
    }
    console.log('');
    
    // Reactivar RLS
    console.log('🔒 Reactivando RLS...');
    await enableRLS();
    console.log('');
    
    // Estado final
    console.log('📊 Estado final:');
    const after = await getCounts();
    for (const [t, c] of Object.entries(after)) {
        console.log(`   • ${t}: ${c}`);
    }
    console.log('');
    
    if (errors === 0) {
        console.log('✅ LIMPIEZA COMPLETADA EXITOSAMENTE');
    } else {
        console.log(`⚠️  LIMPIEZA COMPLETADA CON ${errors} ERRORES`);
    }
    console.log('');
}

main().catch(e => {
    console.error('❌ Error fatal:', e.message);
    process.exit(1);
});