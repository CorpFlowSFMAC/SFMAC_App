"use client";

import React, { useState } from "react";
import { Clock, LogIn, LogOut, CheckCheck, X, Bell, Coffee } from "lucide-react";
import { useTurno } from "@/lib/useTurno";

/**
 * GestorTurnoWidget
 *
 * Banner de control de jornada laboral para gestores.
 * Consume el hook centralizado `useTurno` — sin lógica duplicada.
 * Se renderiza sólo cuando el turno necesita acción del usuario:
 *   - Al inicio del día (sin ingreso)
 *   - Al final del día (turno activo + hora >= 18:00)
 */
export default function GestorTurnoWidget() {
    const {
        turnoActivo,
        turnoHoyCerrado,
        turnoLoading,
        isLoaded,
        esTarde,
        horasTranscurridas,
        handleIngreso,
        handleSalida,
    } = useTurno();

    const [banner6pmDescartado, setBanner6pmDescartado] = useState(false);

    const handleDescartarBanner = () => {
        const key = 'banner6pm_dismissed_' + new Date().toDateString();
        localStorage.setItem(key, '1');
        setBanner6pmDescartado(true);
    };

    // Determinar visibilidad del widget principal según reglas de negocio
    const currentHour = new Date().getHours();
    const esHorarioIngreso = currentHour >= 9 && currentHour <= 10;
    const esHorarioSalida = currentHour >= 18;

    const mostrarIngreso = isLoaded && !turnoActivo && !turnoHoyCerrado && esHorarioIngreso;
    const mostrarSalida = isLoaded && turnoActivo && esHorarioSalida;

    if (!isLoaded || (!mostrarIngreso && !mostrarSalida)) {
        return null; // Cargando o fuera de horario de acción → ocultar widget
    }

    const esIngreso = mostrarIngreso;

    return (
        <div style={{ padding: "0 2rem", marginTop: "1.5rem" }}>

            {/* Banner recordatorio de salida (18:00+) */}
            {turnoActivo && esTarde && !banner6pmDescartado && (
                <div style={{
                    position: 'fixed', top: 20, left: '50%', transform: 'translateX(-50%)',
                    zIndex: 9999, background: 'linear-gradient(135deg,#FFFBEB,#FEF3C7)',
                    border: '1px solid #FCD34D', borderRadius: '14px', padding: '12px 20px',
                    display: 'flex', alignItems: 'center', gap: '12px',
                    boxShadow: '0 8px 32px rgba(251,191,36,0.3)', maxWidth: '520px', width: '90%'
                }}>
                    <Bell size={20} color="#D97706" style={{ flexShrink: 0 }} />
                    <p style={{ margin: 0, fontSize: '0.85rem', fontWeight: 600, color: '#92400E', flex: 1 }}>
                        ⏰ Tu jornada regular ha terminado. Recuerda marcar tu salida.
                    </p>
                    <button
                        onClick={handleDescartarBanner}
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
                    <button onClick={handleDescartarBanner} style={{
                        background: 'transparent', border: 'none', cursor: 'pointer',
                        color: '#D97706', padding: '4px', borderRadius: '6px', display: 'flex'
                    }}>
                        <X size={16} />
                    </button>
                </div>
            )}

            {/* Banner principal de marcado */}
            <div style={{
                background: esIngreso
                    ? 'linear-gradient(135deg, #2563EB 0%, #1E40AF 100%)'
                    : 'linear-gradient(135deg, #EA580C 0%, #9A3412 100%)',
                borderRadius: '16px', border: '1px solid rgba(255,255,255,0.1)',
                padding: '1.25rem 2rem', marginBottom: '1.25rem',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                boxShadow: esIngreso ? '0 10px 25px rgba(37,99,235,0.3)' : '0 10px 25px rgba(234,88,12,0.3)'
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
                            {esIngreso ? '¡Buen día! Inicia tu jornada laboral' : '¡Jornada finalizada! Registra tu salida'}
                        </div>
                        <div style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.85)', marginTop: '2px' }}>
                            {esIngreso
                                ? 'Marca tu ingreso para habilitar todas las funciones del sistema.'
                                : `Has trabajado durante ${horasTranscurridas}. Presiona el botón para cerrar tu turno.`}
                        </div>
                    </div>
                </div>

                <button
                    onClick={esIngreso ? handleIngreso : handleSalida}
                    disabled={turnoLoading}
                    style={{
                        display: 'flex', alignItems: 'center', gap: '8px',
                        background: 'white',
                        color: esIngreso ? '#1E40AF' : '#9A3412',
                        border: 'none', borderRadius: '12px',
                        padding: '0.7rem 1.5rem', cursor: turnoLoading ? 'not-allowed' : 'pointer',
                        fontSize: '0.95rem', fontWeight: 900,
                        boxShadow: '0 4px 14px rgba(0,0,0,0.15)',
                        opacity: turnoLoading ? 0.7 : 1, transition: 'all 0.2s',
                        transform: turnoLoading ? 'scale(0.98)' : 'scale(1)'
                    }}
                >
                    {esIngreso ? <LogIn size={18} /> : <LogOut size={18} />}
                    {turnoLoading
                        ? (esIngreso ? 'Registrando...' : 'Cerrando...')
                        : (esIngreso ? 'Marcar Ingreso' : 'Marcar Salida')}
                </button>
            </div>
        </div>
    );
}
