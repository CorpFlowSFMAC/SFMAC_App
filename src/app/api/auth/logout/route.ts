import { NextRequest, NextResponse } from 'next/server';

// EMERGENCY: Use env var or calculate from request URL
const getOrigin = (request: NextRequest) => {
    return process.env.NEXT_PUBLIC_SITE_URL || request.nextUrl.origin;
};

export async function POST(request: NextRequest) {
    const origin = getOrigin(request);
    const response = NextResponse.redirect(new URL(`${origin}/login`, request.url));
    
    // Clear all auth cookies
    response.cookies.set('auth_status', '', { path: '/', maxAge: 0 });
    response.cookies.set('azure_code', '', { path: '/', maxAge: 0 });
    response.cookies.set('userRole', '', { path: '/', maxAge: 0 });
    
    console.log('[Logout] Session cleared');
    return response;
}