"use client";

import React, { useState, useEffect } from "react";
import { Clock, Rocket, Lock, TrendingUp, Sparkles, Star, Target } from "lucide-react";
import { useTurno } from "@/lib/useTurno";
import type { StatusAttendance } from "@/lib/useTurno";

// ── Mensajes motivadores dinámicos ─────────────────────────────────────────
function getMotivationalMessage(
    name: string,
    status: StatusAttendance | undefined,
    percentMeta: number
): string {
    const firstName = name?.split(' ')[0] || 'Equipo';
    
    if (status === 'a_tiempo') {
        const msgs = [
            `¡Gran puntualidad, ${firstName}! Tu disciplina de hoy impulsa a Sinfimac. Estás al ${Math.round(percentMeta)}% de alcanzar tu meta mensual y activar tu bono variable. ¡Sigamos con todo hoy!`,
            `¡Excelente ${firstName}! Llegaste a tiempo y eso marca la diferencia. Cada día puntual te acerca más a tu meta de rendimiento. ¡Hoy será un gran día!`,
            `🌟 ${firstName}, tu compromiso con la puntualidad inspira al equipo. Llevas ${Math.round(percentMeta)}% de tu meta mensual. ¡Vamos por más!`,
        ];
        return msgs[new Date().getDate() % msgs.length];
    }
    
    if (status === 'tardanza') {
        const msgs = [
            `¡Hola ${firstName}! Empezamos un poco tarde, pero hay grandes proyectos listos en tu bandeja. ¡Tu talento es la clave para llegar a la meta hoy!`,
            `${firstName}, cada minuto cuenta y tu experiencia lo compensa. Tienes ${Math.round(percentMeta)}% de avance en tu meta. ¡Enfoquémonos en los tickets prioritarios!`,
            `¡Adelante ${firstName}! El día recién comienza para ti. Tu capacidad de gestión puede transformar esta jornada. ¡A darle con todo!`,
        ];
        return msgs[new Date().getDate() % msgs.length];
    }
    
    // Default / cerrado
    return `¡Buen día ${firstName}! Tu dedicación construye el éxito de Sinfimac. Llevas ${Math.round(percentMeta)}% de tu meta mensual. ¡Cada acción cuenta!`;
}

// ── Progress Bar animada ───────────────────────────────────────────────────
function ProgressBar({ percent }: { percent: number }) {
    const clampedPct = Math.min(Math.max(percent, 0), 100);
    const color = clampedPct >= 80 ? '#10B981' : clampedPct >= 50 ? '#F59E0B' : '#6366F1';
    
    return (
        <div style={{
            width: '100%', height: '10px', borderRadius: '999px',
            background: 'rgba(0,0,0,0.06)', overflow: 'hidden'
        }}>
            <div style={{
                width: `${clampedPct}%`, height: '100%', borderRadius: '999px',
                background: `linear-gradient(90deg, ${color}80, ${color})`,
                transition: 'width 1.2s cubic-bezier(0.4, 0, 0.2, 1)'
            }} />
        </div>
    );
}

// ── MAIN WIDGET ────────────────────────────────────────────────────────────
/**
 * GestorTurnoWidget — Versión Pastel Motivacional
 *
 * Banner de control de jornada laboral para gestores y técnicos.
 * Consume el hook centralizado `useTurno` — sin lógica duplicada.
 * Siempre visible si hay una acción pendiente (sin restricción de horario).
 * Incluye tarjeta "Mi Progreso y Motivación CorpFlow".
 */
export default function GestorTurnoWidget() {
    const {
        turnoActivo,
        turnoHoyCerrado,
        turnoLoading,
        isLoaded,
        horasTranscurridas,
        userName,
        handleIngreso,
        handleSalida,
    } = useTurno();

    const [progressData, setProgressData] = useState<{ percentMeta: number; achievedUtility: number } | null>(null);
    const [animateIn, setAnimateIn] = useState(false);

    // Cargar progreso económico del gestor
    useEffect(() => {
        const loadProgress = async () => {
            try {
                const now = new Date();
                const month = now.getMonth() + 1;
                const year = now.getFullYear();
                const res = await fetch(`/api/hr/productivity-bonus?month=${month}&year=${year}`);
                if (res.ok) {
                    const data = await res.json();
                    // Find current user's progress
                    const gestoraName = userName || localStorage.getItem('userName') || '';
                    const myReport = data.details?.find((d: any) => 
                        d.gestora?.toLowerCase().includes(gestoraName.toLowerCase().split(' ')[0])
                    );
                    if (myReport) {
                        setProgressData({
                            percentMeta: myReport.percentMeta || 0,
                            achievedUtility: myReport.achievedUtility || 0
                        });
                    } else {
                        // Fallback: use total
                        setProgressData({
                            percentMeta: (data.totalUtility / 35000) * 100,
                            achievedUtility: data.totalUtility || 0
                        });
                    }
                }
            } catch {
                // Silently fail — motivation widget is non-critical
                setProgressData({ percentMeta: 0, achievedUtility: 0 });
            }
        };
        loadProgress();
    }, [userName]);

    // Trigger animation
    useEffect(() => {
        if (isLoaded) {
            const timer = setTimeout(() => setAnimateIn(true), 100);
            return () => clearTimeout(timer);
        }
    }, [isLoaded]);

    // Determinar visibilidad: siempre visible si hay acción pendiente
    const mostrarIngreso = isLoaded && !turnoActivo && !turnoHoyCerrado;
    const mostrarSalida = isLoaded && turnoActivo !== null;
    const mostrarResumen = isLoaded && turnoHoyCerrado;

    if (!isLoaded) return null;

    const esIngreso = mostrarIngreso;
    const statusAttendance = turnoActivo?.status_attendance;
    const percentMeta = progressData?.percentMeta || 0;
    const achievedUtility = progressData?.achievedUtility || 0;

    const motivationalMsg = getMotivationalMessage(
        userName,
        statusAttendance,
        percentMeta
    );

    return (
        <div style={{
            padding: "0 clamp(0.75rem, 3vw, 2rem)",
            marginTop: "1.5rem",
            opacity: animateIn ? 1 : 0,
            transform: animateIn ? 'translateY(0)' : 'translateY(12px)',
            transition: 'all 0.5s cubic-bezier(0.4, 0, 0.2, 1)'
        }}>

            {/* ── Botón de Marcación One-Click ── */}
            {(mostrarIngreso || mostrarSalida) && (
                <div style={{
                    background: esIngreso
                        ? 'linear-gradient(135deg, #D1FAE5 0%, #A7F3D0 50%, #6EE7B7 100%)'
                        : 'linear-gradient(135deg, #FEE2E2 0%, #FCA5A5 50%, #F87171 100%)',
                    borderRadius: '20px',
                    border: esIngreso ? '1px solid #86EFAC' : '1px solid #FCA5A5',
                    padding: 'clamp(1.2rem, 4vw, 2rem)',
                    marginBottom: '1rem',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    flexWrap: 'wrap', gap: 'clamp(0.75rem, 2vw, 1rem)',
                    boxShadow: esIngreso
                        ? '0 8px 30px rgba(16,185,129,0.15)'
                        : '0 8px 30px rgba(248,113,113,0.15)',
                    transition: 'all 0.4s ease'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flex: '1 1 220px', minWidth: 0 }}>
                        <div style={{
                            width: 52, height: 52, borderRadius: '16px',
                            background: esIngreso ? 'rgba(5,150,105,0.15)' : 'rgba(220,38,38,0.12)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            flexShrink: 0
                        }}>
                            {esIngreso
                                ? <Rocket size={26} color="#059669" />
                                : <Lock size={26} color="#DC2626" />
                            }
                        </div>
                        <div style={{ minWidth: 0 }}>
                            <div style={{
                                fontSize: 'clamp(0.95rem, 2.5vw, 1.2rem)',
                                fontWeight: 900,
                                color: esIngreso ? '#065F46' : '#991B1B',
                                letterSpacing: '-0.3px', lineHeight: 1.25
                            }}>
                                {esIngreso ? '¡Buen día! Inicia tu jornada' : '¡Jornada en curso!'}
                            </div>
                            <div style={{
                                fontSize: 'clamp(0.72rem, 1.8vw, 0.85rem)',
                                color: esIngreso ? '#047857' : '#B91C1C',
                                marginTop: '3px', lineHeight: 1.4, opacity: 0.85
                            }}>
                                {esIngreso
                                    ? 'Marca tu ingreso para habilitar todas las funciones del sistema.'
                                    : `Llevas ${horasTranscurridas} trabajando. Registra tu salida cuando termines.`}
                            </div>
                        </div>
                    </div>

                    <button
                        onClick={esIngreso ? handleIngreso : handleSalida}
                        disabled={turnoLoading}
                        style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                            background: esIngreso ? '#059669' : '#DC2626',
                            color: 'white',
                            border: 'none', borderRadius: '14px',
                            padding: '0.85rem 1.8rem',
                            cursor: turnoLoading ? 'not-allowed' : 'pointer',
                            fontSize: 'clamp(0.88rem, 2vw, 1rem)', fontWeight: 900,
                            boxShadow: esIngreso
                                ? '0 4px 16px rgba(5,150,105,0.35)'
                                : '0 4px 16px rgba(220,38,38,0.35)',
                            opacity: turnoLoading ? 0.7 : 1,
                            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                            transform: turnoLoading ? 'scale(0.97)' : 'scale(1)',
                            flex: '1 1 auto', minWidth: '180px', maxWidth: '240px',
                            whiteSpace: 'nowrap', letterSpacing: '0.3px'
                        }}
                    >
                        {esIngreso ? <Rocket size={18} /> : <Lock size={18} />}
                        {turnoLoading
                            ? (esIngreso ? 'Registrando...' : 'Cerrando...')
                            : (esIngreso ? 'Iniciar Jornada 🚀' : 'Terminar Jornada 🔒')}
                    </button>
                </div>
            )}

            {/* ── Resumen post-jornada ── */}
            {mostrarResumen && (
                <div style={{
                    background: 'linear-gradient(135deg, #EDE9FE 0%, #DDD6FE 100%)',
                    borderRadius: '16px', border: '1px solid #C4B5FD',
                    padding: '1rem 1.5rem', marginBottom: '1rem',
                    display: 'flex', alignItems: 'center', gap: '12px',
                    boxShadow: '0 4px 16px rgba(139,92,246,0.1)'
                }}>
                    <Star size={22} color="#7C3AED" />
                    <div>
                        <div style={{ fontWeight: 800, fontSize: '0.88rem', color: '#5B21B6' }}>
                            ✅ Jornada completada hoy
                        </div>
                        <div style={{ fontSize: '0.78rem', color: '#6D28D9', opacity: 0.8, marginTop: '2px' }}>
                            Tu registro de asistencia ha sido guardado correctamente.
                        </div>
                    </div>
                </div>
            )}

            {/* ── Tarjeta "Mi Progreso y Motivación CorpFlow" ── */}
            {(mostrarSalida || mostrarResumen) && (
                <div style={{
                    background: 'white',
                    borderRadius: '18px',
                    border: '1px solid #E2E8F0',
                    padding: 'clamp(1rem, 3vw, 1.5rem)',
                    marginBottom: '1.25rem',
                    boxShadow: '0 2px 12px rgba(0,0,0,0.04)',
                    transition: 'all 0.3s ease'
                }}>
                    {/* Header */}
                    <div style={{
                        display: 'flex', alignItems: 'center', gap: '10px',
                        marginBottom: '1rem', paddingBottom: '0.75rem',
                        borderBottom: '1px solid #F1F5F9'
                    }}>
                        <div style={{
                            width: 36, height: 36, borderRadius: '10px',
                            background: 'linear-gradient(135deg, #EEF2FF, #E0E7FF)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center'
                        }}>
                            <Sparkles size={18} color="#4338CA" />
                        </div>
                        <div>
                            <div style={{ fontWeight: 800, fontSize: '0.88rem', color: '#1E293B' }}>
                                Mi Progreso y Motivación CorpFlow
                            </div>
                            <div style={{ fontSize: '0.7rem', color: '#94A3B8', fontWeight: 600 }}>
                                Meta mensual: S/. 35,000
                            </div>
                        </div>
                    </div>

                    {/* Progress bar */}
                    <div style={{ marginBottom: '0.75rem' }}>
                        <div style={{
                            display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
                            marginBottom: '6px'
                        }}>
                            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569' }}>
                                <Target size={12} style={{ verticalAlign: 'middle', marginRight: '4px' }} />
                                Progreso económico
                            </span>
                            <span style={{
                                fontSize: '0.82rem', fontWeight: 900,
                                color: percentMeta >= 80 ? '#059669' : percentMeta >= 50 ? '#D97706' : '#4338CA'
                            }}>
                                {Math.round(percentMeta)}%
                            </span>
                        </div>
                        <ProgressBar percent={percentMeta} />
                        <div style={{
                            display: 'flex', justifyContent: 'space-between',
                            marginTop: '4px'
                        }}>
                            <span style={{ fontSize: '0.68rem', color: '#94A3B8' }}>
                                S/. {achievedUtility.toLocaleString('es-PE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                            </span>
                            <span style={{ fontSize: '0.68rem', color: '#94A3B8' }}>
                                S/. 35,000
                            </span>
                        </div>
                    </div>

                    {/* Attendance badge */}
                    {statusAttendance && (
                        <div style={{
                            display: 'inline-flex', alignItems: 'center', gap: '5px',
                            padding: '3px 10px', borderRadius: '999px', fontSize: '0.7rem', fontWeight: 800,
                            marginBottom: '0.6rem',
                            ...(statusAttendance === 'a_tiempo'
                                ? { background: '#D1FAE5', color: '#065F46', border: '1px solid #A7F3D0' }
                                : statusAttendance === 'tardanza'
                                ? { background: '#FEF3C7', color: '#92400E', border: '1px solid #FDE68A' }
                                : { background: '#FEE2E2', color: '#991B1B', border: '1px solid #FECACA' }
                            )
                        }}>
                            {statusAttendance === 'a_tiempo' ? '✓ A tiempo' : statusAttendance === 'tardanza' ? '⏰ Tardanza' : '🔥 Horas extra'}
                        </div>
                    )}

                    {/* Motivational message */}
                    <div style={{
                        background: statusAttendance === 'tardanza'
                            ? 'linear-gradient(135deg, #FFFBEB, #FEF3C7)'
                            : 'linear-gradient(135deg, #F0FDF4, #DCFCE7)',
                        borderRadius: '12px',
                        padding: '0.85rem 1rem',
                        border: statusAttendance === 'tardanza' ? '1px solid #FDE68A' : '1px solid #BBF7D0'
                    }}>
                        <div style={{
                            display: 'flex', alignItems: 'flex-start', gap: '8px'
                        }}>
                            <TrendingUp size={16} color={statusAttendance === 'tardanza' ? '#D97706' : '#059669'} style={{ flexShrink: 0, marginTop: '2px' }} />
                            <p style={{
                                margin: 0, fontSize: '0.8rem', lineHeight: 1.5,
                                color: statusAttendance === 'tardanza' ? '#92400E' : '#065F46',
                                fontWeight: 600
                            }}>
                                {motivationalMsg}
                            </p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
