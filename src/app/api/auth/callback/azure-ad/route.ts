/**
 * Azure AD Callback - SOLUCIÓN DEFINITIVA
 * Proceso completo de autenticación con fallback automático
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// URLs de Supabase
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || '';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// Determinar qué key usar
const SERVICE_KEY = SUPABASE_SERVICE_KEY || SUPABASE_ANON_KEY;

// Crear cliente
const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

// APP_URL - Usar dominio dinámico baseado en request
const getAppUrl = (requestUrl: string) => {
    const urlObj = new URL(requestUrl);
    return `${urlObj.protocol}//${urlObj.host}`;
};
const APP_URL = getAppUrl(request.url);

// Admin especial - estos emails SIEMPRE serán admin
const ADMIN_EMAILS = ['acubas@sinfimac.pe', 'admin@sinfimac.pe'];

console.log('[CB] 🔑 Keys:', { 
    url: !!SUPABASE_URL, 
    serviceKey: !!SUPABASE_SERVICE_KEY, 
    anonKey: !!SUPABASE_ANON_KEY 
});

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const error = searchParams.get('error');
    
    console.log('[CB] 📥 Code:', !!code, 'Error:', error);

    if (error) {
        return NextResponse.redirect(new URL('/login?error=azure_denied', request.url));
    }
    
    if (!code) {
        return NextResponse.redirect(new URL('/login?error=no_code', request.url));
    }
    
    let userEmail = '';
    let userRole = 'sin_acceso';
    
    try {
        // Azure AD config - usar variables de entorno
        const clientId = process.env.AZURE_AD_CLIENT_ID || '18a47ee7-7ecc-4978-9e78-06fd4ea0b343';
        const tenantId = process.env.AZURE_AD_TENANT_ID || '7b359926-1313-48e4-a459-1f7a9f5c63aa';
        const clientSecret = process.env.AZURE_AD_CLIENT_SECRET;
        
        // Usar redirect_uri del request para que coincida exactamente
        const requestUrlObj = new URL(request.url);
        const baseUrl = `${requestUrlObj.protocol}//${requestUrlObj.host}`;
        const redirectUri = `${baseUrl}/api/auth/callback/azure-ad`;
        
        console.log('[CB] 🔧 redirectUri:', redirectUri);
        
        const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
        const tokenData = new URLSearchParams({
            client_id: clientId,
            client_secret: clientSecret || '',
            code: code,
            redirect_uri: redirectUri,
            grant_type: 'authorization_code',
            scope: 'openid profile email User.Read',
        });
        
        const tokenResp = await fetch(tokenUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: tokenData.toString(),
        });
        
        const token = await tokenResp.json();
        
        if (token.error) {
            console.log('[CB] ❌ Token error:', JSON.stringify(token));
            // Devolver json con el error para debugging
            return NextResponse.json({
                error: 'token_failed',
                details: token.error,
                error_description: token.error_description
            }, { status: 400 });
        }
        
        // 2. Obtener email del usuario
        const userResp = await fetch('https://graph.microsoft.com/v1.0/me', {
            headers: { 'Authorization': `Bearer ${token.access_token}` },
        });
        
        const userData = await userResp.json();
        userEmail = (userData.mail || userData.userPrincipalName || '').toLowerCase().trim();
        
        console.log('[CB] 👤 Email:', userEmail);
        
        if (!userEmail) {
            console.log('[CB] ❌ No email from Azure');
            return NextResponse.redirect(new URL('/login?error=no_email', request.url));
        }
        
        // 3. Buscar perfil en DB
        let rol = null;
        let perfilExiste = false;
        
        const { data: perfil } = await supabase
            .from('perfiles')
            .select('rol')
            .eq('email', userEmail)
            .single();
        
        if (perfil) {
            rol = perfil.rol;
            perfilExiste = true;
            console.log('[CB] ✅ Perfil encontrado:', rol);
        } else {
            console.log('[CB] 📝 Perfil no existe, creando...');
        }
        
        // 4. Si no existe perfil, crear uno
        if (!perfilExiste) {
            // Determinar rol inicial
            const esAdmin = ADMIN_EMAILS.includes(userEmail);
            rol = esAdmin ? 'ADMIN' : 'GESTORA';
            
            // Crear perfil
            const { error: insertError } = await supabase
                .from('perfiles')
                .insert({
                    email: userEmail,
                    nombre_completo: userData.displayName || userData.name || userEmail,
                    rol: rol
                });
            
            if (insertError) {
                console.log('[CB] ⚠️ Error creando perfil:', insertError.message);
                // Continuar con el rol determinado
            } else {
                console.log('[CB] ✅ Perfil creado con rol:', rol);
            }
        }
        
        // 5. Determinar rol final
        userRole = (rol || 'sin_acceso').toLowerCase();
        
        // FORZAR admin para acubas
        if (ADMIN_EMAILS.includes(userEmail)) {
            // Actualizar a admin en DB
            await supabase
                .from('perfiles')
                .update({ rol: 'ADMIN' })
                .eq('email', userEmail);
            
            userRole = 'admin';
            console.log('[CB] ⭐ Forzado admin para:', userEmail);
        }
        
        console.log('[CB] 🎯 Rol final:', userRole);
        
        // 6. Determinar destino - NORMALIZAR A minúsculas
        let destino = '/dashboard/sin-acceso';
        if (userRole === 'admin') {
            destino = '/dashboard/admin';
        } else if (userRole === 'gestora' || userRole === 'espectador') {
            destino = '/dashboard/gestor';
        }
        
        console.log('[CB] 🚀 Destino:', destino);
        
        // 7. Crear respuesta con cookies - MOSTRAR URL completa
        const redirectUrl = `${APP_URL}${destino}`;
        console.log('[CB] 🌐 Redirect URL completa:', redirectUrl);
        
        const respuesta = NextResponse.redirect(new URL(redirectUrl, request.url));
        
        respuesta.cookies.set('auth_status', 'azure_logged_in', {
            path: '/',
            httpOnly: false,
            sameSite: 'lax',
            secure: false, // Allow HTTP for testing
            maxAge: 86400
        });
        
        respuesta.cookies.set('azure_code', 'ok', {
            path: '/',
            httpOnly: false,
            sameSite: 'lax',
            secure: false, // Allow HTTP for testing
            maxAge: 86400
        });
        
        respuesta.cookies.set('userRole', userRole, {
            path: '/',
            httpOnly: false,
            sameSite: 'lax',
            secure: false, // Allow HTTP for testing
            maxAge: 86400
        });
        
        respuesta.cookies.set('userEmail', userEmail, {
            path: '/',
            httpOnly: false,
            sameSite: 'lax',
            secure: false, // Allow HTTP for testing
            maxAge: 86400
        });
        
        // También guardar en localStorage para el layout
        // (el layout lee de ahí)
        respuesta.headers.set('x-user-role', userRole);
        respuesta.headers.set('x-user-email', userEmail);
        
        console.log('[CB] ✅ Cookies establecidas');
        
        return respuesta;
        
    } catch (err: any) {
        console.log('[CB] ❌ Excepción:', err?.message || err);
        return NextResponse.redirect(new URL('/login?error=exception', request.url));
    }
}