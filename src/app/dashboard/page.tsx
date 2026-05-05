"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader } from "lucide-react";

/**
 * /dashboard — Gateway de Autenticación + RBAC
 * 
 * Flujo con cookies de Azure AD:
 * 1. Lee las cookies establecidas por el callback de Azure
 * 2. Si existe cookie userRole, redirige según el rol
 * 3. Si no, redirige al login
 */
export default function DashboardGateway() {
    const router = useRouter();
    const [status, setStatus] = useState("Verificando sesión...");
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        async function handleAuth() {
            try {
                const currentUrl = typeof window !== 'undefined' ? window.location.href : '';
                const searchParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
                const errorParam = searchParams?.get('error') || searchParams?.get('error_description');

                console.log("[Dashboard Gateway] URL:", currentUrl);

                // 📊 DIAGNÓSTICO: Mostrar cookies
                const cookies = typeof window !== 'undefined' ? document.cookie : '';
                console.log("[Dashboard Gateway] Cookies:", cookies);

                if (errorParam) {
                    setError(`Error de autenticación: ${errorParam}`);
                    setTimeout(() => router.push("/login"), 3000);
                    return;
                }

                setStatus("Procesando autenticación...");

                // 🚀 LEER COOKIES DE AZURE AD
                const cookiesArray = cookies.split(';').map(c => c.trim().split('='));
                const cookieObj: Record<string, string> = {};
                for (const [name, value] of cookiesArray) {
                    cookieObj[name] = decodeURIComponent(value);
                }

                console.log("[Dashboard Gateway] Cookie object:", cookieObj);

                const userRole = cookieObj['userRole'];
                const userEmail = cookieObj['userEmail'];
                const authStatus = cookieObj['auth_status'];

                console.log("[Dashboard Gateway] userRole:", userRole, "| userEmail:", userEmail, "| authStatus:", authStatus);

                // Si hay authenticated status, procesar
                if (authStatus === 'azure_logged_in' && userRole) {
                    console.log("[Dashboard Gateway] ✅ Autenticación válida, rol:", userRole);
                    
                    // Redirigir según rol
                    if (userRole === 'admin') {
                        router.push('/dashboard/admin');
                    } else if (userRole === 'gestora' || userRole === 'espectador') {
                        router.push('/dashboard/gestor');
                    } else {
                        router.push('/dashboard/sin-acceso');
                    }
                    return;
                }

                // 🚨 No hay autenticación válida --ir a login
                console.log("[Dashboard Gateway] ❌ No autenticado");
                setError("Sesión no encontrada. Por favor inicie sesión.");
                setTimeout(() => router.push("/login"), 2000);

            } catch (err: any) {
                console.log("[Dashboard Gateway] ❌ Excepción:", err?.message || err);
                setError("Error al procesar la sesión");
                setTimeout(() => router.push("/login"), 3000);
            }
        }

        handleAuth();
    }, []);

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
            <div className="text-center">
                <Loader className="w-12 h-12 animate-spin mx-auto mb-4 text-blue-600" />
                <h1 className="text-xl font-semibold text-gray-800 mb-2">SINFIMAC</h1>
                <p className="text-gray-600">{status}</p>
                {error && <p className="text-red-500 mt-2">{error}</p>}
            </div>
        </div>
    );
}
