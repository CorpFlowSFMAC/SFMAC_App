"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Importar el mismo componente de técnicos del admin
import TechniciansPage from "@/app/dashboard/admin/technicians/page";

export default function GestorTechniciansPage() {
    const router = useRouter();
    const userRole = typeof window !== 'undefined' ? localStorage.getItem('userRole') : null;
    const isAdmin = userRole?.toUpperCase() === 'ADMIN';
    
    // Si es admin,Ir aadmin technicians
    if (isAdmin) {
        return <TechniciansPage />;
    }
    
    // Si es gestor, tambiénIr a admin technicians (el middleware ya permite acceso)
    if (userRole?.toUpperCase() === 'GESTORA') {
        return <TechniciansPage />;
    }
    
    // Loading mientras carga
    return (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#f8fafc' }}>
            <div style={{ textAlign: 'center' }}>
                <div style={{
                    width: '40px', height: '40px',
                    border: '4px solid #0EA5E9', borderTopColor: 'transparent',
                    borderRadius: '50%', animation: 'spin 1s linear infinite',
                    margin: '0 auto 1rem'
                }} />
                <p style={{ color: '#64748b', fontWeight: 600 }}>Cargando Módulo Técnicos...</p>
            </div>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
    );
}
