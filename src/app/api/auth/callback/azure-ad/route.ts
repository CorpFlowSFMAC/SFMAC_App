/**
 * Azure AD Callback - Procesa autenticación de Azure AD
 * Usa Service Role Key para evitar RLS al buscar perfil
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://xxxxx.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
const supabase = supabaseServiceKey 
    ? createClient(supabaseUrl, supabaseServiceKey)
    : createClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJxxxxx');

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://corpflow.sinfimac.pe';

console.log('[Azure Callback] 🔐 Service Key configured:', !!supabaseServiceKey);

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const error = searchParams.get('error');
    const errorDescription = searchParams.get('error_description');
    
    console.log('[Azure Callback] 📥 Request received, code present:', !!code);
    console.log('[Azure Callback] 🌐 APP_URL:', APP_URL);

    if (error) {
        console.error('[Azure Callback] ❌ Azure error:', error, errorDescription);
        return NextResponse.redirect(new URL('/login?error=azure_denied', request.url));
    }
    
    let userEmail = '';
    let userRole = 'sin_acceso';
    let perfilEncontrado = false;
    
    if (code) {
        try {
            const clientId = '18a47ee7-7ecc-4978-9e78-06fd4ea0b343';
            const clientSecret = process.env.AZURE_AD_CLIENT_SECRET;
            const tenantId = '7b359926-1313-48e4-a459-1f7a9f5c63aa';
            const redirectUri = `${APP_URL}/api/auth/callback/azure-ad`;
            
            const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
            const tokenData = new URLSearchParams({
                client_id: clientId,
                client_secret: clientSecret || '',
                code: code,
                redirect_uri: redirectUri,
                grant_type: 'authorization_code',
                scope: 'openid profile email User.Read',
            });
            
            console.log('[Azure Callback] 🔄 Exchanging code for token...');
            
            const tokenResponse = await fetch(tokenUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: tokenData.toString(),
            });
            
            const tokenResult = await tokenResponse.json();
            console.log('[Azure Callback] 📬 Token response status:', tokenResponse.status);
            
            if (tokenResult.error) {
                console.error('[Azure Callback] ❌ Token error:', tokenResult.error_description || tokenResult.error);
            }
            
            if (tokenResult.access_token) {
                console.log('[Azure Callback] ✅ Token obtained, fetching user info...');
                
                const userResponse = await fetch('https://graph.microsoft.com/v1.0/me', {
                    headers: { 'Authorization': `Bearer ${tokenResult.access_token}` },
                });
                
                if (userResponse.ok) {
                    const userData = await userResponse.json();
                    userEmail = userData.mail || userData.userPrincipalName;
                    console.log('[Azure Callback] 👤 User email from Azure:', userEmail);
                    
                    if (userEmail) {
                        const normalizedEmail = userEmail.toLowerCase().trim();
                        console.log('[Azure Callback] 🔍 Looking up perfil for:', normalizedEmail);
                        
                        // Usar service role para evitar RLS
                        const { data: perfil, error: perfilError } = await supabase
                            .from('perfiles')
                            .select('rol, email, nombre_completo')
                            .eq('email', normalizedEmail)
                            .single();
                        
                        console.log('[Azure Callback] 📊 Perfil lookup result:', { perfil, error: perfilError?.message });
                        
                        if (perfil && perfil.rol) {
                            userRole = perfil.rol.toLowerCase();
                            perfilEncontrado = true;
                            console.log('[Azure Callback] ✅ PERFIL ENCONTRADO - Rol:', userRole);
                        } else {
                            console.log('[Azure Callback] ❌ PERFIL NO ENCONTRADO en DB para:', normalizedEmail);
                            console.log('[Azure Callback] 💡 DEBUG - Buscando perfil con service role key:', !!supabaseServiceKey);
                        }
                    }
                }
            }
        } catch (err: any) {
            console.error('[Azure Callback] ❌ Exception:', err?.message || err);
        }
    }
    
    // Map roles to rutas
    const roleToPath: Record<string, string> = {
        admin: '/dashboard/admin',
       ADMIN: '/dashboard/admin',
        gestora: '/dashboard/gestor',
       GESTORA: '/dashboard/gestor',
        espectador: '/dashboard/gestor',
       ESPECTADOR: '/dashboard/gestor',
        sin_acceso: '/dashboard/sin-acceso',
        SIN_ACCESO: '/dashboard/sin-acceso',
    };
    
    // Normalize role
    const finalRole = userRole.toUpperCase();
    let destino = roleToPath[finalRole] || roleToPath[userRole] || '/dashboard/sin-acceso';
    
    // Sipieler perfil, siempre ir al dashboard correspondiente
    console.log('[Azure Callback] 🎯 Final decision:', {
        userEmail,
        userRole,
        perfilEncontrado,
        destino
    });
    
    const response = NextResponse.redirect(new URL(`${APP_URL}${destino}`, request.url));
    
    // cookies para sesión
    response.cookies.set('auth_status', 'azure_logged_in', {
        path: '/',
        httpOnly: false,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
    });
    response.cookies.set('azure_code', code || 'demo', {
        path: '/',
        httpOnly: false,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
    });
    response.cookies.set('userRole', userRole, {
        path: '/',
        httpOnly: false,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
    });
    response.cookies.set('userEmail', userEmail, {
        path: '/',
        httpOnly: false,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
    });
    
    return response;
}