"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { supabase } from "@/lib/supabase";

// ─────────────────────────────────────────────────────────────────────────────
// Hook: useTurno
// Centraliza toda la lógica del control de asistencia (marcado de jornada).
// Reemplaza la lógica duplicada en GestorTurnoWidget.tsx y metrics/page.tsx.
//
// POLÍTICA: Sin setInterval. Las horas transcurridas se calculan en tiempo de
// render con useMemo sobre el timestamp inmutable de hora_ingreso. Los banners
// de hora tarde se evalúan solo al montar y cada vez que cambia turnoActivo.
// ─────────────────────────────────────────────────────────────────────────────

export type StatusAttendance = 'a_tiempo' | 'tardanza' | 'horas_extra';

export interface TurnoActivo {
    id: string;
    hora_ingreso: string;
    estado: string;
    status_attendance?: StatusAttendance;
}

export interface UseTurnoResult {
    turnoActivo: TurnoActivo | null;
    turnoHoyCerrado: boolean;
    turnoLoading: boolean;
    isLoaded: boolean;
    esTarde: boolean; // true si hora actual >= 18:00
    horasTranscurridas: string;
    userName: string;
    handleIngreso: () => Promise<void>;
    handleSalida: () => Promise<void>;
}

// ── Utilidades privadas ──────────────────────────────────────────────────────

function getEmailFromStorage(): string {
    if (typeof window === 'undefined') return '';
    // 1. localStorage
    const fromLocal = localStorage.getItem('userEmail');
    if (fromLocal) return fromLocal;
    // 2. Cookies (para flujos Azure AD)
    const match = document.cookie.match(/(?:^|;\s*)userEmail=([^;]+)/);
    return match ? decodeURIComponent(match[1]) : '';
}

function getUserRoleFromStorage(): string {
    if (typeof window === 'undefined') return '';
    const fromLocal = localStorage.getItem('userRole');
    if (fromLocal) return fromLocal;
    const match = document.cookie.match(/(?:^|;\s*)userRole=([^;]+)/);
    return match ? decodeURIComponent(match[1]) : '';
}

function getNameFromStorage(): string {
    if (typeof window === 'undefined') return '';
    return localStorage.getItem('userName') || '';
}

function calcularHoras(horaIngreso: string): string {
    const ms = Date.now() - new Date(horaIngreso).getTime();
    const totalMin = Math.floor(ms / 60_000);
    const hrs = Math.floor(totalMin / 60);
    const mins = totalMin % 60;
    return `${hrs}h ${mins}m`;
}

function calcStatusAttendance(): StatusAttendance {
    const now = new Date();
    const h = now.getHours();
    const m = now.getMinutes();
    // A tiempo si marca antes de las 09:30
    return (h < 9 || (h === 9 && m <= 30)) ? 'a_tiempo' : 'tardanza';
}

function captureGPS(): Promise<string | null> {
    return new Promise((resolve) => {
        if (typeof navigator === 'undefined' || !navigator.geolocation) {
            resolve(null);
            return;
        }
        navigator.geolocation.getCurrentPosition(
            (pos) => resolve(`${pos.coords.latitude},${pos.coords.longitude}`),
            () => resolve(null),
            { timeout: 5000, maximumAge: 60000 }
        );
    });
}

// ── Hook principal ───────────────────────────────────────────────────────────

export function useTurno(): UseTurnoResult {
    const [turnoActivo, setTurnoActivo] = useState<TurnoActivo | null>(null);
    const [turnoHoyCerrado, setTurnoHoyCerrado] = useState(false);
    const [turnoLoading, setTurnoLoading] = useState(false);
    const [isLoaded, setIsLoaded] = useState(false);
    const [isMounted, setIsMounted] = useState(false);

    // Calcular si es tarde (>= 18:00) en tiempo de render
    const esTarde = useMemo(() => {
        if (!isMounted) return false;
        return new Date().getHours() >= 18;
    }, [isMounted]);

    // Horas transcurridas: recalcula sólo si cambia turnoActivo
    const horasTranscurridas = useMemo(() => {
        if (!turnoActivo?.hora_ingreso) return '0h 0m';
        return calcularHoras(turnoActivo.hora_ingreso);
    }, [turnoActivo]);

    // ── Carga inicial: consultar turno de hoy ──────────────────────────────
    useEffect(() => {
        setIsMounted(true);

        const loadTurno = async () => {
            let email = getEmailFromStorage();

            // Fallback definitivo: sesión Supabase Auth
            if (!email) {
                const { data: { user } } = await supabase.auth.getUser();
                email = user?.email || '';
            }

            if (!email) return;

            const today = new Date().toISOString().split('T')[0];
            const { data } = await supabase
                .from('turnos')
                .select('id, hora_ingreso, estado, status_attendance')
                .eq('usuario_email', email)
                .eq('fecha', today)
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();

            if (!data) {
                setIsLoaded(true);
                return;
            }

            // Compatibilidad con estado anterior (EN_CURSO) y nuevo (en_jornada)
            const estaActivo = data.estado === 'en_jornada' || data.estado === 'EN_CURSO' || data.estado === 'en_refrigerio';
            if (estaActivo) {
                setTurnoActivo({
                    id: data.id,
                    hora_ingreso: data.hora_ingreso,
                    estado: data.estado,
                    status_attendance: data.status_attendance || undefined
                });
            } else {
                setTurnoHoyCerrado(true);
            }
            setIsLoaded(true);
        };

        loadTurno();
    }, []);

    // ── Marcar Ingreso ─────────────────────────────────────────────────────
    const handleIngreso = useCallback(async () => {
        setTurnoLoading(true);

        const email = getEmailFromStorage();
        const nombre = getNameFromStorage();
        const userRole = getUserRoleFromStorage();
        const deviceInfo = typeof navigator !== 'undefined' ? navigator.userAgent.substring(0, 200) : '';

        if (!email) {
            alert('No se pudo detectar tu sesión. Por favor, recarga la página.');
            setTurnoLoading(false);
            return;
        }

        const statusAttendance = calcStatusAttendance();
        const locationGps = await captureGPS();

        try {
            // Intentar vía API V3 (server role key — evita RLS y captura IP/device)
            const response = await fetch('/api/v3/gestor', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'ingreso', email, nombre, userRole, deviceInfo, status_attendance: statusAttendance, location_gps: locationGps })
            });
            const result = await response.json();

            if (result.success && result.turno) {
                setTurnoActivo({
                    id: result.turno.id,
                    hora_ingreso: result.turno.hora_ingreso,
                    estado: 'en_jornada',
                    status_attendance: statusAttendance
                });
                setTurnoLoading(false);
                return;
            }
            throw new Error(result.error || 'Error desconocido en API');
        } catch (e: any) {
            console.warn('[useTurno] API V3 falló, usando fallback directo:', e.message);

            // Fallback directo a Supabase client (anon key)
            const today = new Date().toISOString().split('T')[0];
            const { data, error } = await supabase
                .from('turnos')
                .insert({
                    usuario_email: email,
                    usuario_nombre: nombre,
                    fecha: today,
                    estado: 'en_jornada',
                    device_info: deviceInfo,
                    status_attendance: statusAttendance,
                    location_gps: locationGps,
                })
                .select('id, hora_ingreso')
                .single();

            if (!error && data) {
                setTurnoActivo({ id: data.id, hora_ingreso: data.hora_ingreso, estado: 'en_jornada', status_attendance: statusAttendance });
            } else {
                alert('Error al marcar ingreso: ' + (error?.message || 'Error de conexión'));
            }
        }

        setTurnoLoading(false);
    }, []);

    // ── Marcar Salida ──────────────────────────────────────────────────────
    const handleSalida = useCallback(async () => {
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
                setTurnoLoading(false);
                return;
            }
        } catch (e) {
            console.warn('[useTurno] API V3 salida falló, usando fallback directo');
        }

        // Fallback directo
        await supabase
            .from('turnos')
            .update({ hora_salida: new Date().toISOString(), estado: 'finalizado' })
            .eq('id', turnoActivo.id);

        setTurnoActivo(null);
        setTurnoHoyCerrado(true);
        setTurnoLoading(false);
    }, [turnoActivo]);

    return {
        turnoActivo,
        turnoHoyCerrado,
        turnoLoading,
        isLoaded,
        esTarde,
        horasTranscurridas,
        userName: getNameFromStorage(),
        handleIngreso,
        handleSalida,
    };
}
