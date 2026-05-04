import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const error = searchParams.get('error');
    const errorDescription = searchParams.get('error_description');
    
    console.log('[Azure AD Callback] Processing...');
    console.log('[Azure AD Callback] Code:', code ? 'received' : 'none');
    
    if (error) {
        console.error('[Azure AD Callback] Error:', error, errorDescription);
        return NextResponse.redirect(new URL('/login?error=azure_denied', request.url));
    }
    
    if (!code) {
        console.error('[Azure AD Callback] No code provided');
        return NextResponse.redirect(new URL('/login?error=no_code', request.url));
    }
    
    // Set auth cookie and redirect to dashboard
    const response = NextResponse.redirect(new URL('/dashboard', request.url));
    response.cookies.set('auth_status', 'azure_logged_in', {
        path: '/',
        maxAge: 60 * 60 * 24 * 7, // 7 days
        httpOnly: false,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
    });
    
    console.log('[Azure AD Callback] Success, redirecting to dashboard');
    return response;
}