import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const error = searchParams.get('error');
    const errorDescription = searchParams.get('error_description');
    
    if (error) {
        console.error('[Auth Callback] Azure Error:', error, errorDescription);
        return NextResponse.redirect(new URL('/login?error=azure_denied', request.url));
    }
    
    if (!code) {
        console.error('[Auth Callback] No code provided');
        return NextResponse.redirect(new URL('/login?error=no_code', request.url));
    }
    
    console.log('[Auth Callback] Code received, redirecting to dashboard...');
    
    // Create response with redirect to dashboard
    const response = NextResponse.redirect(new URL('/dashboard', request.url));
    
    // Set authentication cookie
    response.cookies.set('auth_status', 'azure_logged_in', {
        path: '/',
        maxAge: 60 * 60 * 24 * 7, // 7 days
        httpOnly: false,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
    });
    
    return response;
}