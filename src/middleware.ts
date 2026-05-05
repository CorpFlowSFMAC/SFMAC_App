import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;
    
    // Normalizar rol a minúsculas para evitar problemas de mayúsculas
    const userRole = request.cookies.get('userRole')?.value?.toLowerCase() || '';
    
    // Debug: log requests
    console.log(`[MIDDLEWARE] ${pathname} - userRole: "${userRole}"`);
    
    // Rutas públicas - permitir todo
    if (pathname === '/login' || 
        pathname === '/' ||
        pathname.startsWith('/_next') ||
        pathname.startsWith('/api') ||
        pathname.includes('.')) {
        return NextResponse.next();
    }
    
    // Auth callback - permitir
    if (pathname.includes('callback') || pathname.includes('azure')) {
        return NextResponse.next();
    }
    
    // Dashboard base
    if (pathname === '/dashboard') {
        if (userRole && userRole !== 'sin_acceso') {
            const destino = userRole === 'admin' ? '/dashboard/admin' : '/dashboard/gestor';
            return NextResponse.redirect(new URL(destino, request.url));
        }
        return NextResponse.next();
    }
    
    // Panel Admin - permitir acceso según rol
    if (pathname.startsWith('/dashboard/admin')) {
        // Rutas permitidas para gestoras
        const allowedForGestora = ['/technicians', '/tickets'];
        const hasPermission = allowedForGestora.some(route => pathname.includes(route));
        
        if (userRole === 'admin') {
            return NextResponse.next();
        }
        // Gestora puede acceder a technicians y tickets
        if ((userRole === 'gestora' || userRole === 'espectador') && hasPermission) {
            return NextResponse.next();
        }
        if (userRole === 'gestora' || userRole === 'espectador') {
            return NextResponse.redirect(new URL('/dashboard/gestor', request.url));
        }
        return NextResponse.redirect(new URL('/login', request.url));
    }
    
    // Panel Gestor
    if (pathname.startsWith('/dashboard/gestor')) {
        if (userRole === 'admin' || userRole === 'gestora' || userRole === 'espectador') {
            return NextResponse.next();
        }
        return NextResponse.redirect(new URL('/login', request.url));
    }
    
    // Sin acceso
    if (pathname === '/dashboard/sin-acceso') {
        return NextResponse.next();
    }
    
    // Dashboard paths
    if (pathname.startsWith('/dashboard')) {
        return NextResponse.next();
    }
    
    return NextResponse.next();
}

export const config = {
    matcher: [
        '/dashboard/:path*',
        '/dashboard',
        '/login',
        '/auth/:path*',
        '/api/:path*'
    ],
};