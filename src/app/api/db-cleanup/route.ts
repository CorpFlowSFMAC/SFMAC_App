import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';

/**
 * SINFIMAC - Database Cleanup Endpoint
 * 
 * ⚠️  ADVERTENCIA: Este endpoint ELIMINA TODOS LOS DATOS
 * 
 * Para ejecutar: POST /api/db-cleanup
 * Headers necesarios:
 *   Authorization: Bearer CLEANUP_SECRET_KEY
 *   Content-Type: application/json
 * 
 * Body:
 *   { "confirm": true }
 */

const CLEANUP_SECRET = process.env.CLEANUP_SECRET_KEY || 'sfmac-cleanup-2026';

const TABLES_ORDERED = [
    'ticket_payments',
    'ticket_costs', 
    'ticket_evidences',
    'gestora_branch_assignments',
    'technician_branches',
    'debug_logs',
    'tickets'
];

export async function POST(request: Request) {
    try {
        // Verificar authorization
        const authHeader = request.headers.get('authorization');
        const expectedAuth = `Bearer ${CLEANUP_SECRET}`;
        
        if (authHeader !== expectedAuth) {
            return NextResponse.json(
                { error: 'Unauthorized', message: 'Invalid authorization key' },
                { status: 401 }
            );
        }

        // Obtener body para confirmar
        let body: any = {};
        try {
            body = await request.json();
        } catch {}

        const confirm = body.confirm || request.headers.get('X-Confirm') === 'true';
        
        if (!confirm) {
            const counts = await getCounts();
            return NextResponse.json({
                status: 'pending',
                message: 'Cleanup requires confirmation. Send { "confirm": true } in body.',
                tables: TABLES_ORDERED,
                recordCounts: counts
            });
        }

        console.log('🗑️ SINFIMAC Database Cleanup - INICIANDO');

        const results: any = {};

        // Desactivar RLS
        try {
            await supabaseServer.rpc('exec', {
                sql_query: `
                    ALTER TABLE ticket_payments DISABLE ROW LEVEL SECURITY;
                    ALTER TABLE ticket_costs DISABLE ROW LEVEL SECURITY;
                    ALTER TABLE ticket_evidences DISABLE ROW LEVEL SECURITY;
                    ALTER TABLE tickets DISABLE ROW LEVEL SECURITY;
                    ALTER TABLE debug_logs DISABLE ROW LEVEL SECURITY;
                    ALTER TABLE gestoras_branch_assignments DISABLE ROW LEVEL SECURITY;
                    ALTER TABLE technician_branches DISABLE ROW LEVEL SECURITY;
                `
            });
        } catch (e: any) {
            console.log('RLS disable warning:', e.message);
        }

        // Eliminar tablas en orden
        for (const table of TABLES_ORDERED) {
            try {
                const { error } = await supabaseServer
                    .from(table)
                    .delete()
                    .neq('id', '00000000-0000-0000-0000-000000000000');
                
                results[table] = error ? { status: 'error', message: error.message } : { status: 'success' };
                console.log(`✓ ${table}: ${error ? 'ERROR - ' + error.message : 'ELIMINADO'}`);
            } catch (e: any) {
                results[table] = { status: 'error', message: e.message };
                console.log(`✗ ${table}: ERROR - ${e.message}`);
            }
        }

        // Reactivar RLS
        try {
            await supabaseServer.rpc('exec', {
                sql_query: `
                    ALTER TABLE ticket_payments ENABLE ROW LEVEL SECURITY;
                    ALTER TABLE ticket_costs ENABLE ROW LEVEL SECURITY;
                    ALTER TABLE ticket_evidences ENABLE ROW LEVEL SECURITY;
                    ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;
                    ALTER TABLE debug_logs ENABLE ROW LEVEL SECURITY;
                    ALTER TABLE gestoras_branch_assignments ENABLE ROW LEVEL SECURITY;
                    ALTER TABLE technician_branches ENABLE ROW LEVEL SECURITY;
                `
            });
        } catch (e: any) {
            console.log('RLS enable warning:', e.message);
        }

        const finalCounts = await getCounts();

        console.log('🗑️ SINFIMAC Database Cleanup - COMPLETADO');

        return NextResponse.json({
            status: 'completed',
            timestamp: new Date().toISOString(),
            results,
            finalCounts
        });

    } catch (error: any) {
        console.error('Cleanup fatal error:', error);
        return NextResponse.json(
            { error: 'Cleanup failed', message: error.message },
            { status: 500 }
        );
    }
}

export async function GET() {
    const counts = await getCounts();
    
    return NextResponse.json({
        status: 'ready',
        tables: TABLES_ORDERED,
        recordCounts: counts,
        method: 'POST /api/db-cleanup with { "confirm": true }'
    });
}

async function getCounts() {
    const counts: any = {};
    
    for (const table of TABLES_ORDERED) {
        try {
            const { count, error } = await supabaseServer
                .from(table)
                .select('*', { count: 'exact', head: true });
            
            counts[table] = error ? 'error' : (count || 0);
        } catch {
            counts[table] = 'error';
        }
    }
    
    return counts;
}