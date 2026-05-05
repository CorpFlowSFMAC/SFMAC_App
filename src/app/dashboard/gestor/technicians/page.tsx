"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function GestorTechniciansPage() {
    const router = useRouter();
    
    useEffect(() => {
        router.push('/dashboard/gestor?view=technicians');
    }, [router]);
    
    return (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#f8fafc' }}>
            <div style={{ textAlign: 'center' }}>
                <div style={{ 
                    width: '40px', height: '40px', 
                    border: '4px solid #f97316', borderTopColor: 'transparent',
                    borderRadius: '50%', animation: 'spin 1s linear infinite',
                    margin: '0 auto 1rem'
                }} />
                <p style={{ color: '#64748b' }}>Cargando Mis Técnicos...</p>
            </div>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
    );
}