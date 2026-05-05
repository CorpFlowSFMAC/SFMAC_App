import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// EMERGENCY: Prohibit redirects to old domain
const OLD_DOMAIN = 'sinfimac.pe';
const ALLOWED_DOMAINS = ['corpflow.sinfimac.pe', 'localhost', 'work-1-nmyrzygswczqzcbk.prod-runtime.all-hands.dev', 'work-2-nmyrzygswczqzcbk.prod-runtime.all-hands.dev'];

// Modo desarrollo - permitir acceso sin autenticación
const isDevMode = process.env.NODE_ENV !== 'production';

export function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;
    const fullUrl = request.url; // Usar la URL completa como cadena
    
    // BLOCK any redirect to old domain
    if (fullUrl.includes(OLD_DOMAIN)) {
        console.log('[Middleware] BLOCKED redirect to old domain:', fullUrl);
        return NextResponse.redirect(new URL('/login', request.url));
    }
    
    const userRole = request.cookies.get('userRole')?.value;
    
    // DEV MODE: Permitir acceso ohne autenticación
    if (isDevMode && (pathname.startsWith('/dashboard'))) {
        console.log('[Middleware] DEV MODE - Allowing access without auth');
        return NextResponse.next();
    }
    
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
    
    // Panel Admin - solo admin tiene acceso completo
    if (pathname.startsWith('/dashboard/admin')) {
        if (userRole === 'admin') {
            return NextResponse.next();
        }
        // Admin puede acceder pero gestores no
        if (userRole === 'gestora' || userRole === 'espectador') {
            return NextResponse.redirect(new URL('/dashboard/gestor', request.url));
        }
        return NextResponse.redirect(new URL('/login', request.url));
    }
    
    // Panel Gestor - gestores tienen acceso limitado
    if (pathname.startsWith('/dashboard/gestor')) {
        // Gestores y espectadores pueden acceder
        if (userRole === 'admin' || userRole === 'gestora' || userRole === 'espectador') {
            // RESTRINGIR rutas específicas del admin para gestores
            // /dashboard/gestor/clients, /dashboard/gestor/routing, etc NO son accesibles para gestores
            if (userRole !== 'admin') {
                // Rutas que SOLO admin puede acceder desde el panel gestor
                const adminOnlyRoutesGestor = ['/clients', '/routing', '/usuarios', '/asistencia', '/closing'];
                for (const route of adminOnlyRoutesGestor) {
                    if (pathname.includes(route)) {
                        console.log('[Middleware] Gestor blocked from:', pathname);
                        return NextResponse.redirect(new URL('/dashboard/gestor', request.url));
                    }
                }
            }
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
        '/auth/:path*'
    ],
};