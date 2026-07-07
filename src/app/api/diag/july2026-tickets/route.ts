/**
 * API de Diagnóstico - Tickets de Julio 2026
 * Verifica el estado de los tickets para el filtro de ingresos
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getSupabaseServiceKey, getSupabaseUrl } from '@/lib/supabase-config';

const supabaseUrl = getSupabaseUrl();
const supabaseServiceKey = getSupabaseServiceKey();

function getClient() {
    if (supabaseServiceKey && supabaseUrl) {
        return createClient(supabaseUrl, supabaseServiceKey);
    }
    return null;
}

// Zona horaria de Perú
const PERU_TIMEZONE = 'America/Lima';

function getYearMonthLima(dateStr: string | null): { year: number; month: number } | null {
    if (!dateStr) return null;
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return null;
    
    const formatter = new Intl.DateTimeFormat("en-US", {
        timeZone: PERU_TIMEZONE,
        year: "numeric", month: "2-digit"
    });
    const parts = formatter.formatToParts(d);
    const year = parseInt(parts.find(p => p.type === "year")!.value, 10);
    const month = parseInt(parts.find(p => p.type === "month")!.value, 10);
    return { year, month };
}

export async function GET(request: NextRequest) {
    const client = getClient();

    if (!client || !supabaseUrl) {
        return NextResponse.json({
            success: false,
            error: 'Supabase no configurado'
        }, { status: 500 });
    }

    try {
        // Obtener TODOS los tickets con status ticket_cerrado o liquidado
        // Y que tengan closure_date en algún momento
        const { data: tickets, error } = await client
            .from('tickets')
            .select('id, status_id, estadoId, created_at, closure_date, updated_at, total_quoted_amount, montoFinal, ingresos_reales, client_ticket_number')
            .or('status_id.ilike.%ticket_cerrado%,status_id.ilike.%liquidado%')
            .order('closure_date', { ascending: false });

        if (error) {
            return NextResponse.json({
                success: false,
                error: error.message,
                query: 'Failed to fetch tickets'
            }, { status: 500 });
        }

        // Período de julio 2026
        const JULIO_2026 = { year: 2026, month: 7 };

        // Analizar cada ticket
        const analysis = (tickets || []).map((t: any) => {
            const closureDateLima = getYearMonthLima(t.closure_date);
            const updatedAtLima = getYearMonthLima(t.updated_at);
            
            // UTC dates
            const closureUTC = t.closure_date ? new Date(t.closure_date) : null;
            
            // Verificar si califica para julio 2026
            const qualifiesByClosure = closureDateLima?.year === JULIO_2026.year && closureDateLima?.month === JULIO_2026.month;
            const qualifiesByUpdate = updatedAtLima?.year === JULIO_2026.year && updatedAtLima?.month === JULIO_2026.month;
            
            return {
                id: t.id,
                client_ticket_number: t.client_ticket_number,
                status_id: t.status_id,
                // Fechas originales
                created_at: t.created_at,
                closure_date: t.closure_date,
                updated_at: t.updated_at,
                // Análisis en Lima
                closureDateLima,
                updatedAtLima,
                // Análisis UTC
                closureDateUTC: closureUTC ? {
                    year: closureUTC.getFullYear(),
                    month: closureUTC.getMonth() + 1
                } : null,
                // Resultados
                qualifiesForJuly2026: qualifiesByClosure || qualifiesByUpdate,
                cualifyingField: qualifiesByClosure ? 'closure_date' : qualifiesByUpdate ? 'updated_at' : null,
                // Montos
                total_quoted_amount: t.total_quoted_amount,
                montoFinal: t.montoFinal,
                ingresos_reales: t.ingresos_reales
            };
        });

        // Filtrar solo los que califican para julio 2026
        const qualifyingTickets = analysis.filter(t => t.qualifiesForJuly2026);

        // Resumen
        const summary = {
            totalTicketsWithClosureStates: tickets?.length || 0,
            qualifyForJuly2026: qualifyingTickets.length,
            doNotQualify: (tickets?.length || 0) - qualifyingTickets.length,
            periodoBuscado: JULIO_2026
        };

        return NextResponse.json({
            success: true,
            summary,
            periodInfo: {
                year: JULIO_2026.year,
                month: JULIO_2026.month,
                timezone: PERU_TIMEZONE
            },
            qualifyingTickets: qualifyingTickets.slice(0, 50),
            allTicketsAnalysis: analysis.slice(0, 50)
        });
    } catch (err: any) {
        return NextResponse.json({
            success: false,
            error: err.message
        }, { status: 500 });
    }
}
