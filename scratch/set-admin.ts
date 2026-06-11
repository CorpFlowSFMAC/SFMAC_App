/**
 * Script para cambiar el rol de un usuario a ADMIN
 * Uso: npx tsx scratch/set-admin.ts
 */
import { createClient } from '@supabase/supabase-js';

const HETZNER_SUPABASE_URL = 'https://api.sinfimac.pe';
const HETZNER_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNvcnBmbG93c2ZtYWMtaGV0em5lciIsInJvbGUiOiJhbm9uIiwiaWF0IjoxNzc4NzQ4NTY5LCJleHAiOjIwODU3MjkyOTR9.UVpFZwAHuUFXKEwZANp58HP3x-9wgFGrvVY12yoC9MI';

// La SERVICE_ROLE_KEY se define como variable de entorno
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function queryPerfilesDirectly() {
    // We need to use a direct PostgreSQL connection
    const { Pool } = await import('pg');
    
    const pool = new Pool({
        host: '87.99.137.96',
        port: 5432,
        user: 'postgres',
        password: 'CorpFlowSFMAC_DB_2026',
        database: 'postgres',
        connectionTimeoutMillis: 10000
    });

    try {
        const client = await pool.connect();
        
        // Query the perfiles table directly
        const result = await client.query(
            'SELECT * FROM public.perfiles WHERE email = $1',
            [TARGET_EMAIL.toLowerCase()]
        );
        
        return { client, pool, rows: result.rows };
    } catch (e) {
        await pool.end();
        throw e;
    }
}

const TARGET_EMAIL = 'pjsr71081@gmail.com';

async function setAdmin() {
    console.log(`\n🔍 Buscando usuario: ${TARGET_EMAIL}\n`);

    const { client, pool, rows } = await queryPerfilesDirectly();
    
    try {
        if (rows.length === 0) {
            console.error('❌ Usuario no encontrado en la tabla perfiles.');
            await pool.end();
            process.exit(1);
        }

        const perfil = rows[0];
        console.log('📋 Datos actuales del usuario:');
        console.log(`   ID: ${perfil.id}`);
        console.log(`   Email: ${perfil.email}`);
        console.log(`   Nombre: ${perfil.nombre_completo || '(sin nombre)'}`);
        console.log(`   Rol actual: ${perfil.rol}`);
        console.log(`   Creado: ${perfil.created_at}`);

        if (perfil.rol === 'ADMIN') {
            console.log('\n✅ El usuario YA tiene rol ADMIN.\n');
            await pool.end();
            return;
        }

        // 2. Cambiar el rol a ADMIN
        console.log('\n⚙️  Cambiando rol a ADMIN...');

        const updateResult = await client.query(
            'UPDATE public.perfiles SET rol = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
            ['ADMIN', perfil.id]
        );

        if (updateResult.rows.length === 0) {
            console.error('❌ Error al actualizar rol.');
            await pool.end();
            process.exit(1);
        }

        const updated = updateResult.rows[0];
        console.log('\n✅ ¡Éxito! Usuario actualizado:');
        console.log(`   Nuevo rol: ${updated.rol}`);
        console.log(`   Updated at: ${updated.updated_at}`);
        console.log('\n📝 El usuario deberá cerrar sesión y volver a entrar para que el cambio de rol tome efecto.\n');
        
    } finally {
        await pool.end();
    }
}

setAdmin().catch(err => {
    console.error('❌ Error inesperado:', err);
    process.exit(1);
});