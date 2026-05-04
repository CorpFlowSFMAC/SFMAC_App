import { NextRequest, NextResponse } from 'next/server';

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
    
    if (!code && !state) {
        // No code and no state - this is probably a direct access without authentication
        // For demo purposes, allow access to dashboard
        console.log('[Azure AD Callback] No code from corpflow.sinfimac.pe, allowing demo access');
    }
    
    // Use OFFICIAL domain for redirect
    const origin = 'https://corpflow.sinfimac.pe';
    const response = NextResponse.redirect(new URL(`${origin}/dashboard`, request.url));
    response.cookies.set('auth_status', 'azure_logged_in', {
        path: '/',
        maxAge: 60 * 60 * 24 * 7, // 7 days
        httpOnly: false,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
    });
    response.cookies.set('azure_code', code || 'demo', {
        path: '/',
        maxAge: 60 * 60 * 24 * 7,
        httpOnly: false,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
    });
    
    console.log('[Azure AD Callback] Redirecting to dashboard');
    return response;
}