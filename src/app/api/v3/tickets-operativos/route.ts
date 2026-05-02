import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { normalizeStateId } from '@/lib/ticketStates';

/**
 * API v3 - Tickets Operativos
 * 
 * Devuelve los tickets operativos con mapeo de columnas:
 * - estado (en lugar de status_id/estadoId)
 * - description (en lugar de description/descripcionProblema)
 */

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const gestorId = searchParams.get('gestor_id');
    
    try {
        // Construir consulta con filtro opcional por gestor
        let query = supabase
            .from('tickets')
            .select(`
                id,
                status_id,
                service_type,
                description,
                diagnosis,
                client_ticket_number,
                created_at,
                labor_cost,
                materials_cost,
                visit_cost,
                total_quoted_amount,
                priority,
                current_step,
                created_by,
                client_id,
                branch_id,
                technician_id,
                gestora_id,
                metadata,
                clients(id, name),
                branch_offices(id, name, address, client_id, zona_id, clients(id, name), zonas(id, nombre, client_id, gestora_asignada_id), gestora_asignada_id),
                technicians(id, name, email, phone),
                gestoras(id, name, email)
            `)
            .order('created_at', { ascending: false })
            .limit(200);

        // Aplicar filtro por gestor si se proporciona
        if (gestorId) {
            query = query.eq('gestora_id', gestorId);
        }

        const { data: tickets, error } = await query;

        if (error) {
            console.error('Error fetching tickets:', error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        // Normalizar campos para compatibilidad con el frontend
        const normalizedTickets = (tickets || []).map((t: any) => {
            const metadata = t.metadata || {};
            
            // Mapear status_id -> estado
            const estado = normalizeStateId(
                t.status_id || 
                t.estado || 
                metadata.estadoId || 
                'nuevo'
            );
            
            // Mapear description -> description (ya viene así de Supabase)
            const description = t.description || t.descripcionProblema || metadata.descripcionProblema || '';
            
            // Mapear client_ticket_number -> numeroTicketCliente
            const numeroTicketCliente = t.client_ticket_number || t.numeroTicketCliente || metadata.numeroTicketCliente || '';
            
            // Mapear created_at -> fechaCreacion
            const fechaCreacion = t.created_at || t.fechaCreacion || metadata.fechaCreacion || '';
            
            // Mapear labor_cost -> costoManoObra
            const costoManoObra = parseFloat(t.labor_cost || metadata.costoManoObra || '0');
            
            // Mapear materials_cost -> costoMateriales
            const costoMateriales = parseFloat(t.materials_cost || metadata.costoMateriales || '0');
            
            // Mapear visit_cost -> costoVisita
            const costoVisita = parseFloat(t.visit_cost || metadata.costoVisita || '0');
            
            // Mapear total_quoted_amount -> montoFinal
            const montoFinal = parseFloat(t.total_quoted_amount || metadata.montoFinal || '0');
            
            // Mapear client -> cliente
            const cliente = t.clients ? { id: t.clients.id, nombre: t.clients.name } : null;
            
            // Mapear branch_offices -> sede
            const sede = t.branch_offices ? {
                id: t.branch_offices.id,
                nombre: t.branch_offices.name,
                direccion: t.branch_offices.address,
                client_id: t.branch_offices.client_id,
                zona_id: t.branch_offices.zona_id,
                clients: t.branch_offices.clients,
                zonas: t.branch_offices.zonas
            } : null;
            
            // Mapear technician -> tecnico
            const tecnico = t.technicians ? {
                id: t.technicians.id,
                nombre: t.technicians.name,
                email: t.technicians.email,
                phone: t.technicians.phone
            } : null;
            
            // Mapear gestoras -> gestora
            const gestora = t.gestoras ? {
                id: t.gestoras.id,
                nombre: t.gestoras.name,
                email: t.gestoras.email
            } : null;

            return {
                // Campos principales con nombres correctos
                id: t.id,
                estado,
                description,
                numeroTicketCliente: numeroTicketCliente || t.client_ticket_number || '',
                fechaCreacion: fechaCreacion || t.created_at || '',
                service_type: t.service_type,
                diagnosis: t.diagnosis,
                priority: t.priority,
                costoManoObra,
                costoMateriales,
                costoVisita,
                montoFinal,
                
                // RelacionesRenameadas
                cliente,
                sede,
                tecnico,
                gestora,
                
                // Datos crudos también accesibles
                status_id: t.status_id,
                client_ticket_number: t.client_ticket_number,
                created_at: t.created_at,
                total_quoted_amount: t.total_quoted_amount,
            };
        });

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