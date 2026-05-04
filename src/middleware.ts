import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
    const userRole = request.cookies.get('userRole')?.value;
    const authStatus = request.cookies.get('auth_status')?.value;
    const azureCode = request.cookies.get('azure_code')?.value;
    const { pathname } = request.nextUrl;

    // 0. Allow auth callback to process OAuth
    if (pathname === '/auth/callback' || pathname.startsWith('/api/auth') || pathname.includes('azure-ad')) {
        return NextResponse.next();
    }
    
    // 0b. Allow access to static files and api
    if (pathname.startsWith('/_next') || pathname.startsWith('/api') || pathname.includes('.')) {
        return NextResponse.next();
    }

    // 0c. Allow login page
    if (pathname === '/login') {
        return NextResponse.next();
    }

    // 1. Permitir acceso al gateway /dashboard (sin subruta) para procesar OAuth callback
    if (pathname === '/dashboard') {
        // Si tiene auth de Azure, establecer rol por defecto y redirigir
        if (authStatus === 'azure_logged_in' || azureCode) {
            const defaultRole = 'gestor';
            const response = NextResponse.redirect(new URL('https://corpflow.sinfimac.pe/dashboard/gestor', request.url));
            response.cookies.set('userRole', defaultRole, {
                path: '/',
                maxAge: 60 * 60 * 24 * 7,
                httpOnly: false,
                sameSite: 'lax',
                secure: process.env.NODE_ENV === 'production',
            });
            return response;
        }
        
        // Si ya tiene rol, redirigir directamente al dashboard correcto
        if (userRole && userRole !== 'sin_acceso') {
            const dest = userRole === 'admin' ? 'https://corpflow.sinfimac.pe/dashboard/admin' : 'https://corpflow.sinfimac.pe/dashboard/gestor';
            return NextResponse.redirect(new URL(dest, request.url));
        }
        // Si no tiene rol o es sin_acceso, dejar pasar para que el gateway procese
        return NextResponse.next();
    }

    // 1. Permitir acceso a la página de "sin acceso" si tiene sesión (cualquiera)
    if (pathname === '/dashboard/sin-acceso') {
        // Si tiene un rol asignado (no sin_acceso), redirigir al dashboard correcto
        if (userRole && userRole !== 'sin_acceso') {
            const dest = userRole === 'admin' ? 'https://corpflow.sinfimac.pe/dashboard/admin' : 'https://corpflow.sinfimac.pe/dashboard/gestor';
            return NextResponse.redirect(new URL(dest, request.url));
        }
        return NextResponse.next();
    }

    // 2. Si intenta acceder a subrutas del dashboard sin rol, primero verificar si tiene auth de Azure
    if (pathname.startsWith('/dashboard')) {
        // Si tiene auth de Azure pero no userRole, establecer rol por defecto
        if (!userRole && (authStatus === 'azure_logged_in' || azureCode)) {
            const response = NextResponse.redirect(new URL('https://corpflow.sinfimac.pe/dashboard/gestor', request.url));
            response.cookies.set('userRole', 'gestor', {
                path: '/',
                maxAge: 60 * 60 * 24 * 7,
                httpOnly: false,
                sameSite: 'lax',
                secure: process.env.NODE_ENV === 'production',
            });
            return response;
        }
        
        // Si no tiene ningún tipo de auth, redirigir a login
        if (!userRole && !authStatus && !azureCode) {
            return NextResponse.redirect(new URL('https://corpflow.sinfimac.pe/login', request.url));
        }
        
        // 3. Si tiene rol SIN_ACCESO, redirigir a la sala de espera
        if (userRole === 'sin_acceso') {
            return NextResponse.redirect(new URL('/dashboard/sin-acceso', request.url));
        }

        // 4. Controlar acceso según el rol (seguridad RBAC)
        if (pathname.startsWith('/dashboard/admin')) {
            // La ruta de Usuarios y Accesos es SOLO para admins
            if (pathname.startsWith('/dashboard/admin/usuarios') && userRole !== 'admin') {
                return NextResponse.redirect(new URL('https://corpflow.sinfimac.pe/dashboard/gestor', request.url));
            }

            // Las rutas admin-only requieren rol admin
            if (userRole !== 'admin') {
                const isAllowedPath = pathname.startsWith('/dashboard/admin/tickets') ||
                    pathname.startsWith('/dashboard/admin/technicians') ||
                    pathname.startsWith('/dashboard/admin/reportes');

                if (!isAllowedPath) {
                    return NextResponse.redirect(new URL('https://corpflow.sinfimac.pe/dashboard/gestor', request.url));
                }
            }
        }
    }

    return NextResponse.next();
}

// Configurar en qué rutas se debe ejecutar el middleware
// Incluir /dashboard para procesar OAuth callback desde Microsoft
export const config = {
    matcher: ['/dashboard/:path*', '/dashboard', '/auth/callback', '/login', '/api/auth/:path*'],
};
