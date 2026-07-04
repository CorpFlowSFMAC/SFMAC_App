/**
 * API de Gestión de Trigger de closure_date
 * Ejecuta:
 * 1. Verifica si el trigger existe
 * 2. Crea el trigger si no existe
 * 3. Verifica el estado del trigger
 */
import { NextRequest, NextResponse } from 'next/server';
import { Client } from 'pg';

const PG_CONFIG = {
    host: '87.99.137.96',
    port: 5432,
    database: 'postgres',
    user: 'postgres',
    password: 'CorpFlowSFMAC_DB_2026',
    ssl: false
};

export async function GET(request: NextRequest) {
    const client = new Client(PG_CONFIG);
    
    try {
        await client.connect();
        
        const results: any = {
            triggerExists: false,
            functionCreated: false,
            triggerCreated: false,
            error: null
        };

        // ============================================================
        // STEP 1: Verificar si el trigger ya existe
        // ============================================================
        const checkTrigger = await client.query(`
            SELECT tgname, tgname 
            FROM pg_trigger 
            WHERE tgname = 'tr_populate_closure_date'
        `);
        
        results.triggerExists = checkTrigger.rows.length > 0;
        
        if (results.triggerExists) {
            results.message = 'El trigger ya existe y está activo';
        } else {
            // ============================================================
            // STEP 2: Crear la función
            // ============================================================
            await client.query(`
                CREATE OR REPLACE FUNCTION populate_closure_date_tg()
                RETURNS TRIGGER AS $$
                BEGIN
                  IF NEW.status_id IN ('ticket_cerrado', 'liquidado') AND NEW.closure_date IS NULL THEN
                    NEW.closure_date := NOW();
                  END IF;
                  RETURN NEW;
                END;
                $$ LANGUAGE plpgsql;
            `);
            results.functionCreated = true;
            
            // ============================================================
            // STEP 3: Crear el trigger
            // ============================================================
            await client.query(`
                CREATE TRIGGER tr_populate_closure_date
                BEFORE INSERT OR UPDATE ON tickets
                FOR EACH ROW
                EXECUTE FUNCTION populate_closure_date_tg();
            `);
            results.triggerCreated = true;
            results.message = 'Trigger creado exitosamente';
        }

        // ============================================================
        // STEP 4: Verificación final
        // ============================================================
        const verifyTrigger = await client.query(`
            SELECT tgname, tgname 
            FROM pg_trigger 
            WHERE tgname = 'tr_populate_closure_date'
        `);
        
        results.verification = {
            triggerActive: verifyTrigger.rows.length > 0,
            triggerName: verifyTrigger.rows.length > 0 ? verifyTrigger.rows[0].tgname : null
        };

        await client.end();

        return NextResponse.json({
            success: true,
            message: 'Trigger verificado y creado si no existía',
            results
        });

    } catch (err: any) {
        await client.end().catch(() => {});
        return NextResponse.json({
            success: false,
            error: err.message,
            detail: err.stack
        }, { status: 500 });
    }
}
