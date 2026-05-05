import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Versión Básica: Solo proteger /dashboard
export function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;
    const userRole = request.cookies.get('userRole')?.value;
    
    console.log('[Middleware] Path:', pathname, '| Role:', userRole);
    
    // Rutas públicas - permitir todo
    if (pathname === '/login' || 
        pathname === '/' ||
        pathname.startsWith('/_next') ||
        pathname.startsWith('/api') ||
        pathname.includes('.')) {
        return NextResponse.next();
    }
    
    // callback de auth - permitir
    if (pathname.includes('callback')) {
        return NextResponse.next();
    }
    
    // Dashboard base - redirigir según rol
    if (pathname === '/dashboard') {
        if (userRole === 'admin') {
            return NextResponse.redirect(new URL('/dashboard/admin', request.url));
        } else if (userRole === 'gestora' || userRole === 'espectador') {
            return NextResponse.redirect(new URL('/dashboard/gestor', request.url));
        }
        return NextResponse.redirect(new URL('/login', request.url));
    }
    
    // Panel Admin - solo admin
    if (pathname.startsWith('/dashboard/admin')) {
        if (userRole === 'admin') {
            return NextResponse.next();
        }
        return NextResponse.redirect(new URL('/login', request.url));
    }
    
    // Panel Gestor - gestores y admin también pueden acceder
    if (pathname.startsWith('/dashboard/gestor')) {
        if (userRole === 'gestora' || userRole === 'espectador' || userRole === 'admin') {
            return NextResponse.next();
        }
        return NextResponse.redirect(new URL('/login', request.url));
    }
    
    // Sin acceso
    if (pathname === '/dashboard/sin-acceso') {
        return NextResponse.next();
    }
    
    return NextResponse.next();
}

export const config = {
    matcher: [
        '/dashboard/:path*',
        '/dashboard',
    ]
};
