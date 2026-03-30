import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { routingAPI } from '@/lib/routing-api';

// ID de MiBanco (constante fija para este flujo)
const MIBANCO_ID = 'b65727ed-94d3-46ef-ab7d-62621ec46acb';

export async function POST(req: NextRequest) {
    // 1. SEGURIDAD Y VALIDACIÓN
    const secret = req.headers.get('x-corpflow-secret');
    const webhookSecret = process.env.WEBHOOK_SECRET;

    let payload: any = {};
    try {
        payload = await req.json();
    } catch(e) {
        return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    // 1.B DUMPEO A BASE DE DATOS PARA DIAGNÓSTICO (TODO SE GUARDA)
    try {
        await supabase.from('debug_logs').insert({ log_data: { 
            headers: Object.fromEntries(req.headers.entries()),
            payload: payload, 
            secretReceived: secret,
            webhookSecretEnv: webhookSecret || 'UNDEFINED'
        }});
    } catch(e) { /* ignore */ }

    // 2. SEGURIDAD RELAJADA (SI VERCEL NO TIENE EL SECRETO AÚN, LO DEJAMOS PASAR POR AHORA)
    if (webhookSecret && secret !== webhookSecret) {
        console.error('Webhook Auth Failed:', {
            received: secret,
            envSet: !!webhookSecret
        });
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        // Soportar keys capitalizadas de Power Automate
        const sender = payload.sender || payload.Sender || payload.from || payload.From || '';
        const subject = payload.subject || payload.Subject || '';
        const body = payload.body || payload.Body || '';

        // Validar remitente estricto pero tolerante a formatos de nombre de Outlook
        if (!sender.toLowerCase().includes('j.portocarrero@sinfimac.pe')) {
            console.log(`Webhook ignorado: Remitente no es Janeth. Remitente real: ${sender}`);
            return NextResponse.json({ message: 'Ignorado: Remitente no autorizado', receivedSender: sender }, { status: 200 });
        }

        // 2. EXTRACCIÓN INTELIGENTE (REGEX) BISTURÍ DE TEXTO
        const textToParse = `${subject} \n ${body}`;
        const formatRegex = /ST:?\s*([a-zA-Z0-9.\-_]*)\s*-\s*TIPO\s*:\s*(.*?)\s*-\s*INMUEBLE\s*:\s*(.*)/i;
        let match = textToParse.match(formatRegex);
        
        // Intentar otro formato si es necesario (ej: sin guiones)
        if (!match) {
            const altRegex = /Ticket:?\s*([a-zA-Z0-9.\-_]+).*?Tipo:?\s*(.*?)(?:Sede|Inmueble|Agencia):?\s*(.*)/i;
            match = textToParse.match(altRegex);
        }

        if (!match) {
            // Si el texto no encaja, forzar creación como Ticket de Diagnóstico (Borrador) para no perder el correo
            console.error('El texto no cuadra con la Regex:', textToParse.substring(0, 100));
            const fallbackTicket = {
                client_id: MIBANCO_ID,
                status_id: 'borrador',
                description: body || `Error en Asunto: ${subject}`,
                client_ticket_number: 'DESC-' + Date.now().toString().slice(-4),
                created_by: 'SISTEMA (IA - WEBHOOK FAIL)',
                metadata: { origen: 'CORREO_FALLIDO', subject_original: subject, sender }
            };
            await supabase.from('tickets').insert(fallbackTicket);
            return NextResponse.json({ error: 'Formato no reconocido pero ticket guardado en borrador' }, { status: 400 });
        }

        let ticket_banco = match[1]?.trim() || ''; 
        const tipo_incidencia = match[2]?.trim() || ''; 
        const inmueble_raw = match[3]?.trim() || '';

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
