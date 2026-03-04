import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
    const userRole = request.cookies.get('userRole')?.value;
    const { pathname } = request.nextUrl;

    // 0. Permitir acceso al gateway /dashboard (sin subruta) para procesar OAuth callback
    if (pathname === '/dashboard') {
        // Si ya tiene rol, redirigir directamente al dashboard correcto
        if (userRole && userRole !== 'sin_acceso') {
            const dest = userRole === 'admin' ? '/dashboard/admin' : '/dashboard/gestor';
            return NextResponse.redirect(new URL(dest, request.url));
        }
        // Si no tiene rol o es sin_acceso, dejar pasar para que el gateway procese
        return NextResponse.next();
    }

    // 1. Permitir acceso a la página de "sin acceso" si tiene sesión (cualquiera)
    if (pathname === '/dashboard/sin-acceso') {
        // Si tiene un rol asignado (no sin_acceso), redirigir al dashboard correcto
        if (userRole && userRole !== 'sin_acceso') {
            const dest = userRole === 'admin' ? '/dashboard/admin' : '/dashboard/gestor';
            return NextResponse.redirect(new URL(dest, request.url));
        }
        return NextResponse.next();
    }

    // 2. Si intenta acceder a subrutas del dashboard sin rol, redirigir a login
    if (pathname.startsWith('/dashboard')) {
        if (!userRole) {
            return NextResponse.redirect(new URL('/login', request.url));
        }

        // 3. Si tiene rol SIN_ACCESO, redirigir a la sala de espera
        if (userRole === 'sin_acceso') {
            return NextResponse.redirect(new URL('/dashboard/sin-acceso', request.url));
        }

        // 4. Controlar acceso según el rol (seguridad RBAC)
        if (pathname.startsWith('/dashboard/admin')) {
            // La ruta de Usuarios y Accesos es SOLO para admins
            if (pathname.startsWith('/dashboard/admin/usuarios') && userRole !== 'admin') {
                return NextResponse.redirect(new URL('/dashboard/gestor', request.url));
            }

            // Las rutas admin-only (clients, payments, routing, usuarios) requieren rol admin
            if (userRole !== 'admin') {
                const isAllowedPath = pathname.startsWith('/dashboard/admin/tickets') ||
                    pathname.startsWith('/dashboard/admin/technicians') ||
                    pathname.startsWith('/dashboard/admin/reportes');

                if (!isAllowedPath) {
                    return NextResponse.redirect(new URL('/dashboard/gestor', request.url));
                }
            }
        }
    }

    return NextResponse.next();
}

// Configurar en qué rutas se debe ejecutar el middleware
export const config = {
    matcher: ['/dashboard/:path*'],
};
