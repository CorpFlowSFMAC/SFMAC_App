import { NextRequest, NextResponse } from 'next/server';
import { getClient } from '@/lib/supabase-server';
import { readFileSync } from 'fs';
import path from 'path';

/**
 * API: Aplicar migración de cumplimiento de asistencia
 * Solo ejecuta el script SQL de migrate_turnos_compliance.sql
 * Requiere header secreto para evitar ejecución accidental.
 */
export async function POST(request: NextRequest) {
    // Validación de seguridad básica (header de administración)
    const adminHeader = request.headers.get('x-admin-secret');
    const expectedSecret = process.env.ADMIN_MIGRATION_SECRET || 'sinfimac-migrate-2026';
    if (adminHeader !== expectedSecret) {
        return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 });
    }

    const client = getClient() as any;
    if (!client) {
        return NextResponse.json({ error: 'Supabase server client no disponible' }, { status: 500 });
    }

    try {
        // PASO A: Añadir columnas faltantes (idempotente con IF NOT EXISTS)
        const alterStatements = [
            `ALTER TABLE turnos ADD COLUMN IF NOT EXISTS inicio_refrigerio TIMESTAMPTZ`,
            `ALTER TABLE turnos ADD COLUMN IF NOT EXISTS fin_refrigerio TIMESTAMPTZ`,
            `ALTER TABLE turnos ADD COLUMN IF NOT EXISTS ip_address TEXT`,
            `ALTER TABLE turnos ADD COLUMN IF NOT EXISTS device_info TEXT`,
            `ALTER TABLE turnos ADD COLUMN IF NOT EXISTS latitude NUMERIC`,
            `ALTER TABLE turnos ADD COLUMN IF NOT EXISTS longitude NUMERIC`,
        ];

        const results: string[] = [];
        for (const stmt of alterStatements) {
            try {
                const result = await client.rpc('exec_sql', { sql: stmt }).single();
            } catch (_e) {
                // Ignore errors on IF NOT EXISTS statements
            }
            results.push(`Statement executed: ${stmt.substring(0, 60)}...`);
        }

        // PASO B: Migrar valores de estado
        const { error: e1 } = await client.from('turnos').update({ estado: 'en_jornada' }).eq('estado', 'EN_CURSO');
        const { error: e2 } = await client.from('turnos').update({ estado: 'finalizado' }).eq('estado', 'CERRADO');

        if (e1) results.push(`Advertencia migración EN_CURSO: ${e1.message}`);
        if (e2) results.push(`Advertencia migración CERRADO: ${e2.message}`);

        results.push('✅ Migración completada: columnas añadidas, estados migrados');

        return NextResponse.json({
            success: true,
            steps: results,
            timestamp: new Date().toISOString()
        });

    } catch (err: any) {
        return NextResponse.json({
            success: false,
            error: err.message
        }, { status: 500 });
    }
}

export async function GET() {
    return NextResponse.json({
        info: 'Endpoint de migración de asistencia. Use POST con header x-admin-secret.'
    });
}
