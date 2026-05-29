#!/usr/bin/env node
/**
 * SINFIMAC - Database Cleanup Script
 * 
 * ⚠️  ADVERTENCIA: Este script ELIMINA TODOS LOS DATOS de las siguientes tablas:
 *    - ticket_payments
 *    - ticket_costs  
 *    - ticket_evidences
 *    - tickets
 *    - debug_logs
 *    - gestoras_branch_assignments
 *    - technician_branches
 * 
 * Uso:
 *   node scripts/db-cleanup.mjs --confirm
 *   node scripts/db-cleanup.mjs -y
 * 
 * Con service key personalizada:
 *   SUPABASE_SERVICE_ROLE_KEY=xxx node scripts/db-cleanup.mjs --confirm
 */

import { createClient } from '@supabase/supabase-js';

const HETZNER_SUPABASE_URL = 'https://api.sinfimac.pe';
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

if (!serviceKey) {
    console.error('❌ Error: SUPABASE_SERVICE_ROLE_KEY no está configurada.');
    console.error('');
    console.error('Configura la variable de entorno:');
    console.error('  export SUPABASE_SERVICE_ROLE_KEY="tu_service_role_key"');
    console.error('');
    console.error('O ejecuta directamente:');
    console.error('  SUPABASE_SERVICE_ROLE_KEY="tu_key" node scripts/db-cleanup.mjs --confirm');
    process.exit(1);
}

const supabase = createClient(HETZNER_SUPABASE_URL, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false }
});

const TABLES_ORDERED = [
    'ticket_payments',
    'ticket_costs', 
    'ticket_evidences',
    'gestora_branch_assignments',
    'technician_branches',
    'debug_logs',
    'tickets'
];

async function countRecords(table) {
    try {
        const { count, error } = await supabase
            .from(table)
            .select('*', { count: 'exact', head: true });
        
        if (error) throw error;
        return count || 0;
    } catch {
        return -1;
    }
}

async function deleteTable(table) {
    console.log(`🗑️  Eliminando '${table}'...`);
    
    try {
        // Intentar DELETE directo
        const { error, count } = await supabase
            .from(table)
            .delete()
            .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all rows
        
        if (error) {
            // Si falla por RLS, usar DELETE via RPC
            console.log(`   ⚠️  RLS activo, intentando via RPC...`);
            
            const { error: rpcError } = await supabase.rpc('exec', {
                sql_query: `DELETE FROM ${table};`
            });
            
            if (rpcError) {
                console.log(`   ❌ Error: ${rpcError.message}`);
                return false;
            }
        }
        
        console.log(`   ✅ '${table}' eliminado`);
        return true;
    } catch (err) {
        console.log(`   ❌ Error: ${err.message}`);
        return false;
    }
}

async function disableRLS() {
    console.log('🔓 Desactivando RLS temporalmente...');
    try {
        await supabase.rpc('exec', {
            sql_query: `
                ALTER TABLE ticket_payments DISABLE ROW LEVEL SECURITY;
                ALTER TABLE ticket_costs DISABLE ROW LEVEL SECURITY;
                ALTER TABLE ticket_evidences DISABLE ROW LEVEL SECURITY;
                ALTER TABLE tickets DISABLE ROW LEVEL SECURITY;
                ALTER TABLE debug_logs DISABLE ROW LEVEL SECURITY;
            `
        });
        console.log('   ✅ RLS desactivado');
        return true;
    } catch {
        console.log('   ⚠️  No se pudo desactivar RLS (requiere superuser)');
        return false;
    }
}

async function enableRLS() {
    console.log('🔒 Reactivando RLS...');
    try {
        await supabase.rpc('exec', {
            sql_query: `
                ALTER TABLE ticket_payments ENABLE ROW LEVEL SECURITY;
                ALTER TABLE ticket_costs ENABLE ROW LEVEL SECURITY;
                ALTER TABLE ticket_evidences ENABLE ROW LEVEL SECURITY;
                ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;
                ALTER TABLE debug_logs ENABLE ROW LEVEL SECURITY;
            `
        });
        console.log('   ✅ RLS reactivado');
        return true;
    } catch {
        console.log('   ⚠️  No se pudo reactivar RLS');
        return false;
    }
}

async function main() {
    console.log('');
    console.log('╔════════════════════════════════════════════════════════════════╗');
    console.log('║      SINFIMAC - LIMPIEZA TOTAL DE BASE DE DATOS              ║');
    console.log('╠════════════════════════════════════════════════════════════════╣');
    console.log(`║  URL: ${HETZNER_SUPABASE_URL.padEnd(47)}║`);
    console.log('╚════════════════════════════════════════════════════════════════╝');
    console.log('');

    // Contar antes
    console.log('📊 Registros actuales:');
    for (const table of TABLES_ORDERED) {
        const count = await countRecords(table);
        const status = count >= 0 ? `${count} registros` : 'Error al contar';
        console.log(`   • ${table}: ${status}`);
    }
    console.log('');

    // Confirmación
    const confirm = process.argv.includes('--confirm') || process.argv.includes('-y');
    
    if (!confirm) {
        console.log('⚠️  ATENCIÓN: Esta acción es IRREVERSIBLE.');
        console.log('');
        console.log('   Para confirmar la limpieza, ejecuta con:');
        console.log('   node scripts/db-cleanup.mjs --confirm');
        console.log('   node scripts/db-cleanup.mjs -y');
        console.log('');
        process.exit(0);
    }

    console.log('🔥 Iniciando limpieza...');
    console.log('');

    // Intentar desactivar RLS
    await disableRLS();
    console.log('');

    // Eliminar en orden
    let allSuccess = true;
    for (const table of TABLES_ORDERED) {
        const success = await deleteTable(table);
        if (!success) allSuccess = false;
        await new Promise(r => setTimeout(r, 100)); // Pausa entre deletes
    }

    console.log('');

    // Reactivar RLS
    await enableRLS();
    console.log('');

    // Contar después
    console.log('📊 Estado final:');
    for (const table of TABLES_ORDERED) {
        const count = await countRecords(table);
        console.log(`   • ${table}: ${count} registros`);
    }
    
    console.log('');
    if (allSuccess) {
        console.log('✅ LIMPIEZA COMPLETADA EXITOSAMENTE');
    } else {
        console.log('⚠️  LIMPIEZA COMPLETADA CON ERRORES');
        console.log('   Algunas tablas pueden requerir limpieza manual via SQL.');
    }
    console.log('');
}

main().catch(err => {
    console.error('❌ Error Fatal:', err.message);
    process.exit(1);
});