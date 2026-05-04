"use client";

import { useEffect, Suspense } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

function CallbackContent() {
    const router = useRouter();

    useEffect(() => {
        const handleCallback = async () => {
            console.log('[Callback] Processing OAuth callback...');
            
            // Get the session from URL hash (Supabase puts it there after OAuth)
            const { data, error } = await supabase.auth.getSession();
            
            if (error) {
                console.error('[Callback] Error:', error);
                router.push('/login?error=auth_failed');
                return;
            }
            
            if (data?.session) {
                console.log('[Callback] Session found, redirecting to dashboard...');
                router.push('/dashboard');
            } else {
                console.log('[Callback] No session, checking for code...');
                // Supabase might still be processing, wait a moment
                setTimeout(async () => {
                    const { data: retryData } = await supabase.auth.getSession();
                    if (retryData?.session) {
                        router.push('/dashboard');
                    } else {
                        router.push('/login?error=no_session');
                    }
                }, 2000);
            }
        };

        handleCallback();
    }, [router]);

    return (
        <div style={{ 
            display: 'flex', 
            justifyContent: 'center', 
            alignItems: 'center', 
            height: '100vh',
            background: '#0a0a0a',
            color: 'white'
        }}>
            <div style={{ textAlign: 'center' }}>
                <div style={{ 
                    width: 40, 
                    height: 40, 
                    border: '3px solid #333',
                    borderTop: '3px solid #00a4ef',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite',
                    margin: '0 auto 20px'
                }} />
                <p>Procesando autenticación...</p>
            </div>
            <style>{`
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    );
}

export default function AuthCallback() {
    return (
        <Suspense fallback={
            <div style={{ 
                display: 'flex', 
                justifyContent: 'center', 
                alignItems: 'center', 
                height: '100vh',
                background: '#0a0a0a',
                color: 'white'
            }}>
                <div style={{ textAlign: 'center' }}>
                    <div style={{ 
                        width: 40, 
                        height: 40, 
                        border: '3px solid #333',
                        borderTop: '3px solid #00a4ef',
                        borderRadius: '50%',
                        animation: 'spin 1s linear infinite',
                        margin: '0 auto 20px'
                    }} />
                    <p>Cargando...</p>
                </div>
                <style>{`
                    @keyframes spin {
                        0% { transform: rotate(0deg); }
                        100% { transform: rotate(360deg); }
                    }
                `}</style>
            </div>
        }>
            <CallbackContent />
        </Suspense>
    );
}