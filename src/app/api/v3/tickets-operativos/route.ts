import { NextRequest, NextResponse } from 'next/server';
import { normalizeStateId } from '@/lib/ticketStates';
import { createClient } from '@supabase/supabase-js';
import { getSupabaseAnonKey, getSupabaseUrl } from '@/lib/supabase-config';

/**
 * API v3 - Tickets Operativos
 *
 * Arquitectura V3 Core sobre Supabase self-hosted en Hetzner (Iquitos).
 */

// Configuración de Producción Iquitos (Hetzner)
const HETZNER_API = process.env.HETZNER_API_URL || '';

const SUPABASE_URL = getSupabaseUrl();
const SUPABASE_ANON_KEY = getSupabaseAnonKey();

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const gestorId = searchParams.get('gestor_id');

    try {
        if (HETZNER_API) {
            let apiUrl = `${HETZNER_API}/tickets`;
            if (gestorId) {
                apiUrl += `?gestor_id=${gestorId}`;
            }

            const response = await fetch(apiUrl, {
                headers: {
                    'Content-Type': 'application/json',
                },
                next: { revalidate: 30 }
            });

            if (response.ok) {
                const tickets = await response.json();
                const normalizedTickets = (tickets.data || tickets || []).map((t: any) => ({
                    id: t.id,
                    estado: normalizeStateId(t.status_id || t.estado || 'nuevo'),
                    description: t.description || t.descripcionProblema || '',
                    service_type: t.service_type,
                    diagnosis: t.diagnosis,
                    priority: t.priority,
                    costoManoObra: parseFloat(t.labor_cost || '0'),
                    costoMateriales: parseFloat(t.materials_cost || '0'),
                    costoVisita: parseFloat(t.visit_cost || '0'),
                    montoFinal: parseFloat(t.total_quoted_amount || '0'),
                    cliente: t.clients ? { id: t.clients.id, nombre: t.clients.name } : null,
                    sede: t.branch_offices ? { id: t.branch_offices.id, nombre: t.branch_offices.name } : null,
                    tecnico: t.technicians ? { id: t.technicians.id, nombre: t.technicians.name } : null,
                    fundadora: t.gestoras ? { id: t.gestoras.id, nombre: t.gestoras.name } : null,
                    created_at: t.created_at,
                }));

                return NextResponse.json({
                    success: true,
                    source: 'hetzner_api',
                    count: normalizedTickets.length,
                    data: normalizedTickets
                });
            }
        }

        if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
            throw new Error('Supabase not configured');
        }

        const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

        let query = supabase.from('tickets').select('*');
        if (gestorId) {
            query = query.eq('gestora_id', gestorId);
        }

        const { data: ticketsData, error: supabaseError } = await query;

        if (supabaseError) {
            throw new Error(`Supabase error: ${supabaseError.message}`);
        }

        const normalizedTickets = (ticketsData || []).map((t: any) => ({
            id: t.id,
            estado: normalizeStateId(t.status_id || 'nuevo'),
            description: t.description || '',
            service_type: t.service_type,
            diagnosis: t.diagnosis,
            priority: t.priority,
            costoManoObra: parseFloat(t.labor_cost || '0'),
            costoMateriales: parseFloat(t.materials_cost || '0'),
            costoVisita: parseFloat(t.visit_cost || '0'),
            montoFinal: parseFloat(t.total_quoted_amount || '0'),
            created_at: t.created_at,
        }));

        return NextResponse.json({
            success: true,
            source: 'hetzner_supabase',
            count: normalizedTickets.length,
            data: normalizedTickets
        });

    } catch (err: any) {
        console.error('Error in /api/v3/tickets-operativos:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
