"use client";

import React, { useState, useEffect } from "react";
import { Clock, LogIn, LogOut, CheckCheck, X, Bell } from "lucide-react";
import { supabase } from "@/lib/supabase";

export default function GestorTurnoWidget() {
    const [turnoActivo, setTurnoActivo] = useState<{id:string; hora_ingreso:string} | null>(null);
    const [turnoHoyCerrado, setTurnoHoyCerrado] = useState(false);
    const [turnoLoading, setTurnoLoading] = useState(false);
    const [bannerDesc, setBannerDesc] = useState(false);
    const [showBanner6PM, setShowBanner6PM] = useState(false);
    const [turnoTickle, setTurnoTickle] = useState(0);

    // Cargar turno activo al montar
    useEffect(() => {
        const email = typeof window !== 'undefined' ? localStorage.getItem('userEmail') : null;
        if (!email) return;
        
        const today = new Date();
        today.setHours(0,0,0,0);
        
        supabase
            .from('turnos')
            .select('id, hora_ingreso, estado')
            .eq('usuario_email', email)
            .gte('fecha', today.toISOString().split('T')[0])
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle()
            .then(({ data }) => {
                if (data) {
                    if (data.estado === 'EN_CURSO') {
                        setTurnoActivo({ id: data.id, hora_ingreso: data.hora_ingreso });
                    } else {
                        setTurnoHoyCerrado(true);
                    }
                }
            });
    }, []);

    // Verificar banner 6PM cada minuto
    useEffect(() => {
        const checkBanner = () => {
            const dismissed = localStorage.getItem('banner6pm_dismissed_' + new Date().toDateString());
            if (dismissed) { setBannerDesc(true); return; }
            const h = new Date().getHours();
            if (h >= 18 && turnoActivo) setShowBanner6PM(true);
            else if (h < 18) setShowBanner6PM(false);
        };
        checkBanner();
        const interval = setInterval(() => {
            checkBanner();
            setTurnoTickle(t => t + 1);
        }, 60_000);
        return () => clearInterval(interval);
    }, [turnoActivo]);

    const handleBannerDismiss = () => {
        localStorage.setItem('banner6pm_dismissed_' + new Date().toDateString(), '1');
        setBannerDesc(true);
        setShowBanner6PM(false);
    };

    const handleIngreso = async () => {
        setTurnoLoading(true);
        const email = localStorage.getItem('userEmail') || '';
        const nombre = localStorage.getItem('userName') || '';
        
        try {
            const response = await fetch('/api/v3/gestor', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'ingreso', email, nombre })
            });
            const result = await response.json();
            if (result.success && result.turno) {
                setTurnoActivo({ id: result.turno.id, hora_ingreso: result.turno.hora_ingreso });
                setTurnoLoading(false);
                return;
            }
        } catch (e) {
            console.log('[Gestor] V3 ingreso failed, trying client:', e);
        }
        
        // Fallback
        const { data, error } = await supabase
            .from('turnos')
            .insert({ usuario_email: email, usuario_nombre: nombre, fecha: new Date().toISOString().split('T')[0] })
            .select('id, hora_ingreso')
            .single();
        if (!error && data) setTurnoActivo({ id: data.id, hora_ingreso: data.hora_ingreso });
        setTurnoLoading(false);
    };

    const handleSalida = async () => {
        if (!turnoActivo) return;
        setTurnoLoading(true);
        
        try {
            const response = await fetch('/api/v3/gestor', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'salida', turnoId: turnoActivo.id })
            });
            const result = await response.json();
            if (result.success) {
                setTurnoActivo(null);
                setTurnoHoyCerrado(true);
                setShowBanner6PM(false);
                setTurnoLoading(false);
                return;
            }
        } catch (e) {
            console.log('[Gestor] V3 salida failed, trying client:', e);
        }
        
        // Fallback
        await supabase
            .from('turnos')
            .update({ hora_salida: new Date().toISOString(), estado: 'CERRADO' })
            .eq('id', turnoActivo.id);
        setTurnoActivo(null);
        setTurnoHoyCerrado(true);
        setShowBanner6PM(false);
        setTurnoLoading(false);
    };

    function horasTranscurridas(ingreso: string): string {
        const h = (Date.now() - new Date(ingreso).getTime()) / 3_600_000;
        const hrs = Math.floor(h);
        const mins = Math.round((h - hrs) * 60);
        return `${hrs}h ${mins}m`;
    }

    const currentHour = new Date().getHours();
    const isLate = currentHour >= 18;

    // LÓGICA DE BUCLE RRHH:
    // Oculto por defecto si ya existe registro de entrada (activo o cerrado) PERO es antes de las 18:00
    // Si ya ingresó y es tarde (18:00+), mostrar SOLO botón salir
    // Si ya cerró su turno hoy, se oculta hasta el día siguiente
    
    let shouldShow = false;
    if (!turnoActivo && !turnoHoyCerrado) shouldShow = true; // No ha ingresado hoy
    if (turnoActivo && isLate) shouldShow = true; // Turno activo, es tarde, necesita salir

    if (!shouldShow) {
        return null; // Oculto
    }

    return (
        <div style={{ padding: "0 2rem", marginTop: "1.5rem" }}>
            {showBanner6PM && !bannerDesc && (
                <div style={{
                    position: 'fixed', top: 20, left: '50%', transform: 'translateX(-50%)',
                    zIndex: 9999, background: 'linear-gradient(135deg,#FFFBEB,#FEF3C7)',
                    border: '1px solid #FCD34D', borderRadius: '14px', padding: '12px 20px',
                    display: 'flex', alignItems: 'center', gap: '12px',
                    boxShadow: '0 8px 32px rgba(251,191,36,0.3)', maxWidth: '520px', width: '90%'
                }}>
                    <Bell size={20} color="#D97706" style={{ flexShrink: 0 }} />
                    <p style={{ margin: 0, fontSize: '0.85rem', fontWeight: 600, color: '#92400E', flex: 1 }}>
                        ⏰ Tu jornada regular ha terminado. Recuerda marcar tu salida cuando termines.
                    </p>
                    <button
                        onClick={handleBannerDismiss}
                        style={{
                            display: 'flex', alignItems: 'center', gap: '5px',
                            background: '#F59E0B', color: 'white', border: 'none',
                            borderRadius: '8px', padding: '6px 12px', cursor: 'pointer',
                            fontSize: '0.75rem', fontWeight: 800, flexShrink: 0, whiteSpace: 'nowrap'
                        }}
                    >
                        <CheckCheck size={13} />
                        Entendido
                    </button>
                    <button onClick={handleBannerDismiss} style={{
                        background: 'transparent', border: 'none', cursor: 'pointer',
                        color: '#D97706', padding: '4px', borderRadius: '6px', display: 'flex'
                    }}>
                        <X size={16} />
                    </button>
                </div>
            )}

            <div style={{
                background: 'white', borderRadius: '14px', border: '1px solid #E2E8F0',
                padding: '1rem 1.5rem', marginBottom: '1.25rem',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{
                        width: 40, height: 40, borderRadius: '12px',
                        background: turnoActivo ? '#DCFCE7' : '#F1F5F9',
                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}>
                        <Clock size={20} color={turnoActivo ? '#15803D' : '#94A3B8'} />
                    </div>
                    <div>
                        <div style={{ fontSize: '0.8rem', fontWeight: 800, color: '#1E293B' }}>
                            {turnoActivo ? '🟢 Turno en curso' : '⚪ Sin turno activo'}
                        </div>
                        <div style={{ fontSize: '0.72rem', color: '#64748B' }}>
                            {turnoActivo
                                ? `Ingresaste a las ${new Date(turnoActivo.hora_ingreso).toLocaleTimeString('es-PE',{hour:'2-digit',minute:'2-digit',hour12:true})} · ${horasTranscurridas(turnoActivo.hora_ingreso)} trabajados`
                                : 'Presiona "Marcar Ingreso" para iniciar tu jornada'}
                        </div>
                    </div>
                </div>
                <div>
                    {!turnoActivo ? (
                        <button
                            onClick={handleIngreso}
                            disabled={turnoLoading}
                            style={{
                                display: 'flex', alignItems: 'center', gap: '6px',
                                background: 'linear-gradient(135deg,#059669,#047857)',
                                color: 'white', border: 'none', borderRadius: '10px',
                                padding: '0.55rem 1.25rem', cursor: 'pointer',
                                fontSize: '0.85rem', fontWeight: 800,
                                boxShadow: '0 4px 14px rgba(5,150,105,0.35)',
                                opacity: turnoLoading ? 0.7 : 1, transition: 'all 0.2s'
                            }}
                        >
                            <LogIn size={15} />
                            {turnoLoading ? 'Registrando...' : 'Marcar Ingreso'}
                        </button>
                    ) : (
                        <button
                            onClick={handleSalida}
                            disabled={turnoLoading}
                            style={{
                                display: 'flex', alignItems: 'center', gap: '6px',
                                background: 'linear-gradient(135deg,#EF4444,#DC2626)',
                                color: 'white', border: 'none', borderRadius: '10px',
                                padding: '0.55rem 1.25rem', cursor: 'pointer',
                                fontSize: '0.85rem', fontWeight: 800,
                                boxShadow: '0 4px 14px rgba(239,68,68,0.35)',
                                opacity: turnoLoading ? 0.7 : 1, transition: 'all 0.2s'
                            }}
                        >
                            <LogOut size={15} />
                            {turnoLoading ? 'Cerrando...' : 'Marcar Salida'}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
