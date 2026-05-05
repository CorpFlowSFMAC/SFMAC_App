"use client";

import { useState, useEffect } from "react";
import TechniciansPage from "@/app/dashboard/admin/technicians/page";

export default function GestorTechniciansPage() {
    const [isReady, setIsReady] = useState(false);
    
    useEffect(() => {
        // Wait for providers to be ready
        const timer = setTimeout(() => setIsReady(true), 500);
        return () => clearTimeout(timer);
    }, []);
    
    if (!isReady) {
        return (
            <div style={{ 
                display: 'flex', 
                justifyContent: 'center', 
                alignItems: 'center', 
                height: '100vh', 
                background: '#f8fafc' 
            }}>
                <div style={{ textAlign: 'center' }}>
                    <div style={{
                        width: '40px', height: '40px',
                        border: '4px solid #0EA5E9', borderTopColor: 'transparent',
                        borderRadius: '50%', animation: 'spin 1s linear infinite',
                        margin: '0 auto 1rem'
                    }} />
                    <p style={{ color: '#64748b', fontWeight: 600 }}>Cargando Módulo...</p>
                </div>
                <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
        );
    }
    
    return <TechniciansPage />;
}
