import { NextRequest, NextResponse } from 'next/server';
import { normalizeStateId } from '@/lib/ticketStates';

/**
 * API v3 - Tickets Operativos
 * 
 * Arquitectura Híbrida: Consulta la API local de Hetzner
 * en lugar de Supabase Cloud para obtener datos reales
 */

const HETZNER_API = process.env.HETZNER_API_URL || 'https://api.sinfimac.pe';

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const gestorId = searchParams.get('gestor_id');
    
    try {
        // Consultar API local de Hetzner
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
        
        if (!response.ok) {
            throw new Error(`Hetzner API error: ${response.status}`);
        }
        
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
            count: normalizedTickets.length,
            data: normalizedTickets
        });
        
    } catch (err: any) {
        console.error('Error in /api/v3/tickets-operativos:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
