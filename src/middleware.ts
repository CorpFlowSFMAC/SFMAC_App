import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
    const userRole = request.cookies.get('userRole')?.value;
    const { pathname } = request.nextUrl;

    // 1. Si intenta acceder al dashboard sin rol, redirigir a login
    if (pathname.startsWith('/dashboard')) {
        if (!userRole) {
            return NextResponse.redirect(new URL('/login', request.url));
        }

        // 2. Controlar acceso según el rol (seguridad básica)
        if (pathname.startsWith('/dashboard/admin') && userRole !== 'admin') {
            // Permitir a la gestora entrar solo a Tickets, Técnicos y Reportes (NO Pagos)
            const isAllowedPath = pathname.startsWith('/dashboard/admin/tickets') ||
                pathname.startsWith('/dashboard/admin/technicians') ||
                pathname.startsWith('/dashboard/admin/reportes');

            if (!isAllowedPath) {
                return NextResponse.redirect(new URL('/dashboard/gestor', request.url));
            }
        }
    }

    return NextResponse.next();
}

// Configurar en qué rutas se debe ejecutar el middleware
export const config = {
    matcher: ['/dashboard/:path*'],
};
