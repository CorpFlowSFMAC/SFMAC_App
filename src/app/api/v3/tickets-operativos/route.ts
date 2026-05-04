import { NextRequest, NextResponse } from 'next/server';
import { normalizeStateId } from '@/lib/ticketStates';
import { createClient } from '@supabase/supabase-js';

/**
 * API v3 - Tickets Operativos
 * 
 * Arquitectura Híbrida: Intenta consultar la API de Hetzner (Iquitos),
 * si falla, usa Supabase como fallback
 */

// Configuración de Producción Iquitos (Hetzner)
const HETZNER_API = process.env.HETZNER_API_URL || 'https://api.sinfimac.pe';

// Configuración de Supabase fallback
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const gestorId = searchParams.get('gestor_id');
    
    try {
        // Intentar primero con API de Hetzner (Producción Iquitos)
        let apiUrl = `${HETZNER_API}/tickets`;
        if (gestorId) {
            apiUrl += `?gestor_id=${gestorId}`;
        }
        
        console.log('[Tickets] Fetching from Hetzner:', apiUrl);
        
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
                source: 'hetzner',
                count: normalizedTickets.length,
                data: normalizedTickets
            });
        }
        
        // FALLBACK: Si API de Hetzner falla, usar Supabase directo
        console.log('[Tickets] Hetzner API failed, using Supabase fallback');
        
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
            estado: normalizeStateId(t.estado || 'nuevo'),
            description: t.descripcionProblema || '',
            service_type: t.service_type,
            diagnosis: t.diagnosis,
            priority: t.priority,
            costoManoObra: parseFloat(t.costoManoObra || '0'),
            costoMateriales: parseFloat(t.costoMateriales || '0'),
            costoVisita: parseFloat(t.costoVisita || '0'),
            montoFinal: parseFloat(t.montoFinal || '0'),
            created_at: t.created_at,
        }));
        
        return NextResponse.json({
            success: true,
            source: 'supabase',
            count: normalizedTickets.length,
            data: normalizedTickets
        });
        
    } catch (err: any) {
        console.error('Error in /api/v3/tickets-operativos:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
