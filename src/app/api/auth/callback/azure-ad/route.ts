import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://xxxxx.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJxxxxx';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const error = searchParams.get('error');
    const errorDescription = searchParams.get('error_description') || searchParams.get('error_message');
    const state = searchParams.get('state');
    
    console.log('[Azure AD Callback] Full URL:', request.url);
    console.log('[Azure AD Callback] Code present:', !!code);
    console.log('[Azure AD Callback] Error:', error);
    
    if (error) {
        console.error('[Azure AD Callback] Azure Error:', error, errorDescription);
        return NextResponse.redirect(new URL('/login?error=azure_denied', request.url));
    }
    
    // Variable para almacenar el email del usuario
    let userEmail = '';
    let userRole = 'gestor'; // Default role
    
    if (code) {
        console.log('[Azure AD Callback] Has auth code, attempting token exchange');
        // Intentar trocar el código por un token
        try {
            const clientId = '18a47ee7-7ecc-4978-9e78-06fd4ea0b343';
            // Use correct env variable name from Vercel
            const clientSecret = process.env.AZURE_AD_CLIENT_SECRET;
            const tenantId = '7b359926-1313-48e4-a459-1f7a9f5c63aa';
            const redirectUri = 'https://corpflow.sinfimac.pe/api/auth/callback/azure-ad';
            
            const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
            const tokenData = new URLSearchParams({
                client_id: clientId,
                client_secret: clientSecret || '',
                code: code,
                redirect_uri: redirectUri,
                grant_type: 'authorization_code',
                scope: 'openid profile email User.Read',
            });
            
            const tokenResponse = await fetch(tokenUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: tokenData.toString(),
            });
            
            const tokenResult = await tokenResponse.json();
            console.log('[Azure AD Callback] Token response status:', tokenResponse.status, 'has_error:', !!tokenResult.error);
            
            if (tokenResult.error) {
                console.error('[Azure AD Callback] Token error:', tokenResult.error_description || tokenResult.error);
                // Even if token exchange fails, try to get user from database with email from token if available
            }
            
            if (tokenResult.access_token) {
                // Obtener información del usuario con el token
                const userResponse = await fetch('https://graph.microsoft.com/v1.0/me', {
                    headers: { 'Authorization': `Bearer ${tokenResult.access_token}` },
                });
                
                if (userResponse.ok) {
                    const userData = await userResponse.json();
                    userEmail = userData.mail || userData.userPrincipalName;
                    console.log('[Azure AD Callback] User email:', userEmail);
                    
                    // Buscar el perfil en la tabla perfiles
                    if (userEmail) {
                        try {
                            console.log('[Azure AD Callback] Looking up perfil for:', userEmail);
                            
                            const { data: perfil, error: perfilError } = await supabase
                                .from('perfiles')
                                .select('rol, email')
                                .eq('email', userEmail.toLowerCase())
                                .single();
                            
                            console.log('[Azure AD Callback] Perfil result:', perfil, 'error:', perfilError);
                            
                            if (perfil && perfil.rol) {
                                userRole = perfil.rol.toLowerCase();
                                console.log('[Azure AD Callback] User role from DB:', userRole);
                            } else {
                                console.log('[Azure AD Callback] No perfil found for email:', userEmail);
                            }
                        } catch (dbError) {
                            console.error('[Azure AD Callback] DB Error:', dbError);
                        }
                    }
                }
            }
        } catch (err) {
            console.error('[Azure AD Callback] Error getting user info:', err);
        }
    } else {
        console.log('[Azure AD Callback] No code - allowing demo access');
    }
    
    // Map roles to paths
    const roleToPath: Record<string, string> = {
        admin: '/dashboard/admin',
        gestora: '/dashboard/gestor',
        espectador: '/dashboard/gestor',
        sin_acceso: '/dashboard/sin-acceso',
    };
    
    const destino = roleToPath[userRole] || '/dashboard/gestor';
    const origin = 'https://corpflow.sinfimac.pe';
    const response = NextResponse.redirect(new URL(`${origin}${destino}`, request.url));
    
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
    // Establecer el rol correcto del usuario - session cookie
    response.cookies.set('userRole', userRole, {
        path: '/',
        httpOnly: false,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
    });
    
    console.log('[Azure AD Callback] Redirecting to', destino, 'with role:', userRole);
    return response;
}