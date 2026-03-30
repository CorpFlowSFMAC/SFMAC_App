import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { routingAPI } from '@/lib/routing-api';

// ID de MiBanco (constante fija para este flujo)
const MIBANCO_ID = 'b65727ed-94d3-46ef-ab7d-62621ec46acb';

export async function POST(req: NextRequest) {
    // 1. SEGURIDAD Y VALIDACIÓN
    const secret = req.headers.get('x-corpflow-secret');
    const webhookSecret = process.env.WEBHOOK_SECRET;

    if (!webhookSecret || secret !== webhookSecret) {
        console.error('Webhook Auth Failed:', {
            received: secret,
            envSet: !!webhookSecret
        });
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const payload = await req.json();
        const { sender, subject, body } = payload;

        // Validar remitente estricto pero tolerante a formatos de nombre de Outlook
        if (!sender || !sender.toLowerCase().includes('j.portocarrero@sinfimac.pe')) {
            console.log(`Webhook ignorado: Remitente no es Janeth. Remitente real: ${sender}`);
            return NextResponse.json({ message: 'Ignorado: Remitente no autorizado' }, { status: 200 });
        }

        // 2. EXTRACCIÓN INTELIGENTE (REGEX) BISTURÍ DE TEXTO
        // Formato esperado: "ST: MB005563.26 - TIPO : INCIDENCIA MANTENIMIENTO - INMUEBLE : AG127 - AG HUARI MATRIZ"
        const subjectRegex = /ST:\s*(.*?)\s*-\s*TIPO\s*:\s*(.*?)\s*-\s*INMUEBLE\s*:\s*(.*)/i;
        const match = subject.match(subjectRegex);

        if (!match) {
            return NextResponse.json({ error: 'Formato de asunto no reconocido' }, { status: 400 });
        }

        const ticket_banco = match[1].trim(); // Ej: MB005563.26
        const tipo_incidencia = match[2].trim(); // Ej: INCIDENCIA MANTENIMIENTO
        const inmueble_raw = match[3].trim(); // Ej: AG127 - AG HUARI MATRIZ

        // Extraer código corto de sede para búsqueda (ej. "AG127")
        const inmuebleRegex = /^([\w\-]+)\s*-\s*(.*)$/;
        const inmuebleMatch = inmueble_raw.match(inmuebleRegex);
        const codigo_sede = inmuebleMatch ? inmuebleMatch[1].trim() : inmueble_raw.split(' ')[0];

        // 3. DEDUPLICACIÓN
        const { data: existing } = await supabase
            .from('tickets')
            .select('id, status_id')
            .eq('client_ticket_number', ticket_banco)
            .eq('client_id', MIBANCO_ID)
            .maybeSingle();

        if (existing) {
            console.log(`Ticket duplicado ignorado: ${ticket_banco}`);
            return NextResponse.json({
                id: existing.id,
                message: `Ticket ya existe con número ${ticket_banco}`,
                duplicate: true
            }, { status: 200 });
        }

        // 4. BÚSQUEDA Y ENRUTAMIENTO LOGÍSTICO (CASCADA)
        // Paso A: Match de Agencia
        const { data: branchData } = await supabase
            .from('branch_offices')
            .select('id')
            .eq('client_id', MIBANCO_ID)
            .ilike('codigo_cliente', `%${codigo_sede}%`)
            .maybeSingle();

        // Si no lo encuentra por código, intenta por nombre aproximado
        let finalBranchId = branchData?.id;
        if (!finalBranchId) {
             const { data: fallbackBranch } = await supabase
                .from('branch_offices')
                .select('id')
                .eq('client_id', MIBANCO_ID)
                .ilike('name', `%${codigo_sede}%`)
                .maybeSingle();
             finalBranchId = fallbackBranch?.id || null;
        }

        // Paso B: Enrutamiento en Cascada (routingAPI resuelve Agencia > Zona > Cliente)
        let gestoraId = null;
        if (finalBranchId) {
            gestoraId = await routingAPI.resolveGestora(finalBranchId);
            console.log(`🤖 Enrutamiento Inteligente Resuelto: Agencia ${finalBranchId} -> Gestora ${gestoraId}`);
        }

        const titulo = `${ticket_banco} - ${inmueble_raw}`;

        // 5. CREACIÓN DEL TICKET (MUTACIÓN Y NOTIFICACIÓN REALTIME AUTOMÁTICA)
        const ticketToCreate: any = {
            client_id: MIBANCO_ID,
            status_id: 'borrador', // Estado inicial de triage (requiere confirmación)
            description: body || `Ticket importado automáticamente. Tipo: ${tipo_incidencia}\nAsunto original: ${subject}`,
            client_ticket_number: ticket_banco,
            service_type: null,
            created_by: 'SISTEMA (IA - WEBHOOK)',
            branch_id: finalBranchId,
            gestora_id: gestoraId, // Asignación inteligente en cascada
            metadata: {
                titulo,
                subject_original: subject,
                remitente_original: sender,
                codigo_sede_extraido: codigo_sede,
                sede_reportada_cliente: inmueble_raw,
                tipo_incidencia_reportada: tipo_incidencia,
                origen: 'CORREO_A_TICKET',
                enrutamiento_cascada_aplicado: true,
                gestora_auto_asignada: !!gestoraId
            }
        };

        if (!finalBranchId) {
            ticketToCreate.sede_reportada_cliente = inmueble_raw;
        }

        const { data: newTicket, error: insertError } = await supabase
            .from('tickets')
            .insert(ticketToCreate)
            .select('id')
            .single();

        if (insertError) {
            console.error('Error insertando ticket:', insertError);
            return NextResponse.json({ error: 'Error al crear ticket', detail: insertError.message }, { status: 500 });
        }

        console.log(`✅ Ticket Inteligente creado: ${ticket_banco} -> ID: ${newTicket.id} -> Gestora: ${gestoraId || 'Sin Asignar'}`);
        return NextResponse.json({
            id: newTicket.id,
            ticket_numero: ticket_banco,
            sede_mapeada: !!finalBranchId,
            enrutado_a_gestora: !!gestoraId,
            gestora_id: gestoraId
        }, { status: 200 });

    } catch (error: any) {
        console.error('Webhook Error:', error);
        return NextResponse.json({ error: 'Internal Server Error', detail: error.message }, { status: 500 });
    }
}
