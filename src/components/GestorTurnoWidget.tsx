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
    const [justClickedIngreso, setJustClickedIngreso] = useState(false);
    const [isMounted, setIsMounted] = useState(false);

    // Cargar turno activo al montar
    useEffect(() => {
        const loadInitialData = async () => {
            setIsMounted(true);
            
            // Intentar obtener email desde localStorage, luego cookies, luego sesión
            let email = localStorage.getItem('userEmail');
            if (!email) {
                const getCookie = (name: string) => {
                    const value = `; ${document.cookie}`;
                    const parts = value.split(`; ${name}=`);
                    if (parts.length === 2) return parts.pop()?.split(';').shift();
                    return null;
                };
                email = getCookie('userEmail') || null;
            }
            
            if (!email) {
                const { data: { user } } = await supabase.auth.getUser();
                email = user?.email || null;
            }

            if (!email) return;
            
            const today = new Date();
            today.setHours(0,0,0,0);
            
            // Usar API V3 para evitar bloqueos RLS en la carga inicial si es posible
            // O usar el cliente si estamos seguros de la sesión.
            // Para lectura, el cliente suele funcionar si hay RLS para "sus propios turnos"
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
        };
        
        loadInitialData();
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
        
        // Obtener datos actualizados
        const getCookie = (name: string) => {
            const value = `; ${document.cookie}`;
            const parts = value.split(`; ${name}=`);
            if (parts.length === 2) return parts.pop()?.split(';').shift();
            return null;
        };

        const email = localStorage.getItem('userEmail') || getCookie('userEmail') || '';
        const nombre = localStorage.getItem('userName') || getCookie('userName') || '';
        
        if (!email) {
            alert("No se pudo detectar tu sesión. Por favor, reinicia la página.");
            setTurnoLoading(false);
            return;
        }

        try {
            console.log('[Turno] Intentando marcar ingreso para:', email);
            const response = await fetch('/api/v3/gestor', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'ingreso', email, nombre })
            });
            const result = await response.json();
            
            if (result.success && result.turno) {
                console.log('[Turno] Ingreso exitoso:', result.turno);
                setTurnoActivo({ id: result.turno.id, hora_ingreso: result.turno.hora_ingreso });
                setJustClickedIngreso(true);
                setTurnoLoading(false);
                return;
            } else {
                console.error('[Turno] API devolvió error:', result.error);
                throw new Error(result.error || 'Error desconocido en API');
            }
        } catch (e: any) {
            console.log('[Turno] V3 ingreso failed, trying direct client:', e);
            
            // Fallback directo a Supabase
            const { data, error } = await supabase
                .from('turnos')
                .insert({ 
                    usuario_email: email, 
                    usuario_nombre: nombre, 
                    fecha: new Date().toISOString().split('T')[0] 
                })
                .select('id, hora_ingreso')
                .single();
                
            if (!error && data) {
                setTurnoActivo({ id: data.id, hora_ingreso: data.hora_ingreso });
                setJustClickedIngreso(true);
            } else {
                console.error('[Turno] Error crítico en marcación:', error || e);
                alert("Error al marcar ingreso: " + (error?.message || e.message || "Error de conexión"));
            }
        }
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

    // Calcular cuánto tiempo lleva en el turno (en horas) para la UI
    // NOTA: Para evitar bugs de zona horaria con la base de datos que hagan que 'horas' sea > 0.25 erróneamente,
    // usaremos el flag `justClickedIngreso` para la lógica de ocultamiento inmediato.
    let horas = 0;
    if (turnoActivo) {
        horas = (Date.now() - new Date(turnoActivo.hora_ingreso).getTime()) / 3_600_000;
    }

    // LÓGICA DE BUCLE RRHH:
    let shouldShow = false;
    if (!turnoActivo && !turnoHoyCerrado) shouldShow = true; // No ha ingresado hoy
    if (turnoActivo && isLate && !justClickedIngreso) shouldShow = true; // Turno activo, es tarde, necesita salir y no acaba de ingresar en esta sesión

    if (!shouldShow) {
        return null; // Oculto
    }

    const isIngreso = !turnoActivo;

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
                background: isIngreso 
                    ? 'linear-gradient(135deg, #2563EB 0%, #1E40AF 100%)' 
                    : 'linear-gradient(135deg, #EA580C 0%, #9A3412 100%)',
                borderRadius: '16px', border: '1px solid rgba(255,255,255,0.1)',
                padding: '1.25rem 2rem', marginBottom: '1.25rem',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                boxShadow: isIngreso ? '0 10px 25px rgba(37,99,235,0.3)' : '0 10px 25px rgba(234,88,12,0.3)'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div style={{
                        width: 50, height: 50, borderRadius: '14px',
                        background: 'rgba(255,255,255,0.15)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.2)'
                    }}>
                        <Clock size={26} color="white" />
                    </div>
                    <div>
                        <div style={{ fontSize: '1.2rem', fontWeight: 900, color: 'white', letterSpacing: '-0.3px' }}>
                            {isIngreso ? '¡Buen día! Inicia tu jornada laboral' : '¡Jornada finalizada! Registra tu salida'}
                        </div>
                        <div style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.85)', marginTop: '2px' }}>
                            {isIngreso
                                ? 'Es necesario marcar tu ingreso para habilitar tus funciones del día.'
                                : `Has estado trabajando por ${horasTranscurridas(turnoActivo!.hora_ingreso)}. Presiona el botón para cerrar tu turno.`}
                        </div>
                    </div>
                </div>
                <div>
                    {isIngreso ? (
                        <button
                            onClick={handleIngreso}
                            disabled={turnoLoading}
                            style={{
                                display: 'flex', alignItems: 'center', gap: '8px',
                                background: 'white', color: '#1E40AF', border: 'none', borderRadius: '12px',
                                padding: '0.7rem 1.5rem', cursor: 'pointer',
                                fontSize: '0.95rem', fontWeight: 900,
                                boxShadow: '0 4px 14px rgba(0,0,0,0.15)',
                                opacity: turnoLoading ? 0.7 : 1, transition: 'all 0.2s',
                                transform: turnoLoading ? 'scale(0.98)' : 'scale(1)'
                            }}
                        >
                            <LogIn size={18} />
                            {turnoLoading ? 'Registrando...' : 'Marcar Ingreso'}
                        </button>
                    ) : (
                        <button
                            onClick={handleSalida}
                            disabled={turnoLoading}
                            style={{
                                display: 'flex', alignItems: 'center', gap: '8px',
                                background: 'white', color: '#9A3412', border: 'none', borderRadius: '12px',
                                padding: '0.7rem 1.5rem', cursor: 'pointer',
                                fontSize: '0.95rem', fontWeight: 900,
                                boxShadow: '0 4px 14px rgba(0,0,0,0.15)',
                                opacity: turnoLoading ? 0.7 : 1, transition: 'all 0.2s',
                                transform: turnoLoading ? 'scale(0.98)' : 'scale(1)'
                            }}
                        >
                            <LogOut size={18} />
                            {turnoLoading ? 'Cerrando...' : 'Marcar Salida'}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
