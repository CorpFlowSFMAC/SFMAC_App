import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getSupabaseAuthKey, getSupabaseUrl } from '@/lib/supabase-config';
import { Client } from 'pg';

const supabaseUrl = getSupabaseUrl();
const supabaseKey = getSupabaseAuthKey();

export async function POST(request: Request) {
    try {
        const envKeys = Object.keys(process.env);
        const hasDbUrl = envKeys.includes('DATABASE_URL');
        const hasDirectUrl = envKeys.includes('DIRECT_URL');
        const hasServiceKey = envKeys.includes('SUPABASE_SERVICE_ROLE_KEY') || envKeys.includes('SUPABASE_SERVICE_KEY');

        // Prepare info about DB URL (without sensitive info)
        let dbUrlMasked = 'not defined';
        const rawDbUrl = process.env.DATABASE_URL || process.env.DIRECT_URL;
        if (rawDbUrl) {
            dbUrlMasked = rawDbUrl.replace(/:([^:@]+)@/, ':****@');
        }

        const supabase = createClient(supabaseUrl, supabaseKey, {
            auth: { persistSession: false }
        });

        // Query metadata using Supabase first (which works via HTTP API)
        const { data: gestoras } = await supabase.from('gestoras').select('*');
        const { data: perfiles } = await supabase.from('perfiles').select('*');

        // Let's connect to PostgreSQL using pg client.
        // We'll try the environment DATABASE_URL first, then fallback to hardcoded
        let pgResult: any = null;
        let pgError: string | null = null;

        const pgConfig = rawDbUrl ? {
            connectionString: rawDbUrl,
            ssl: rawDbUrl.includes('supabase') || rawDbUrl.includes('sinfimac.pe') ? false : { rejectUnauthorized: false }
        } : {
            host: '87.99.137.96',
            port: 5432,
            database: 'postgres',
            user: 'postgres',
            password: 'CorpFlowSFMAC_DB_2026',
            ssl: false
        };

        const client = new Client(pgConfig);
        try {
            await client.connect();
            
            // Query RLS tables and policies
            const tablesRes = await client.query(`
                SELECT tablename, rowsecurity 
                FROM pg_tables 
                WHERE schemaname = 'public' AND tablename IN ('tickets', 'gestoras', 'perfiles');
            `);

            const policiesRes = await client.query(`
                SELECT tablename, policyname, permissive, roles, cmd, qual, with_check 
                FROM pg_policies 
                WHERE schemaname = 'public';
            `);

            // Check Janeth's profile / auth mapping in the database
            const janethAuthRes = await client.query(`
                SELECT id, email, raw_user_meta_data 
                FROM auth.users 
                WHERE email = 'j.portocarrero@sinfimac.pe';
            `);

            const ticketsCountRes = await client.query('SELECT COUNT(*) as count FROM tickets;');

            pgResult = {
                tables: tablesRes.rows,
                policies: policiesRes.rows,
                janethAuthUser: janethAuthRes.rows,
                ticketsCount: ticketsCountRes.rows[0].count
            };
            
            await client.end();
        } catch (err: any) {
            pgError = err.message;
            try { await client.end(); } catch (e) {}
        }

        return NextResponse.json({
            success: true,
            env: {
                hasDbUrl,
                hasDirectUrl,
                hasServiceKey,
                dbUrlMasked,
                supabaseUrl
            },
            gestoras,
            perfiles,
            pgResult,
            pgError
        });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}