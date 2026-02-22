import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

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

        // Validar remitente estricto
        if (sender !== 'j.portocarrero@sinfimac.pe') {
            return NextResponse.json({ message: 'Ignorado: Remitente no autorizado' }, { status: 200 });
        }

        // 2. EXTRACCIÓN INTELIGENTE (REGEX)
        // Formato esperado: "ST: MB002507.26 - TIPO : INCIDENCIA MANTENIMIENTO - INMUEBLE : AG809 - AG PIURA GRAU"
        const subjectRegex = /ST:\s*(.*?)\s*-\s*TIPO\s*:\s*(.*?)\s*-\s*INMUEBLE\s*:\s*(.*)/i;
        const match = subject.match(subjectRegex);

        if (!match) {
            return NextResponse.json({ error: 'Formato de asunto no reconocido' }, { status: 400 });
        }

        const ticket_banco = match[1].trim();
        const inmueble_raw = match[3].trim();

        // Extraer código de sede (ej. "AG809")
        const inmuebleRegex = /^([\w\-]+)\s*-\s*(.*)$/;
        const inmuebleMatch = inmueble_raw.match(inmuebleRegex);
        const codigo_sede = inmuebleMatch ? inmuebleMatch[1].trim() : inmueble_raw.split(' ')[0];
        const nombre_sede_crudo = inmueble_raw;

        // 3. DEDUPLICACIÓN - Verificar si ya existe un ticket con este número de banco
        const { data: existing } = await supabase
            .from('tickets')
            .select('id, status_id')
            .eq('client_ticket_number', ticket_banco)
            .eq('client_id', MIBANCO_ID)
            .maybeSingle();

        if (existing) {
            console.log(`Ticket duplicado ignorado: ${ticket_banco} (ID: ${existing.id})`);
            return NextResponse.json({
                id: existing.id,
                message: `Ticket ya existe con número ${ticket_banco}`,
                duplicate: true
            }, { status: 200 });
        }

        // 4. AUTO-MAPPING: Buscar sede por codigo_cliente (Self-Learning)
        const { data: branchData } = await supabase
            .from('branch_offices')
            .select('id')
            .eq('client_id', MIBANCO_ID)
            .eq('codigo_cliente', codigo_sede)
            .maybeSingle();

        const titulo = `${ticket_banco} - ${nombre_sede_crudo}`;

        const ticketToCreate: any = {
            client_id: MIBANCO_ID,
            status_id: 'borrador', // Estado inicial de triage
            description: body,
            client_ticket_number: ticket_banco,
            service_type: null, // Se definirá en el Triage
            created_by: 'SISTEMA (EMAIL WEBHOOK)',
            branch_id: branchData ? branchData.id : null,
            metadata: {
                titulo,
                subject_original: subject,
                remitente_original: sender,
                codigo_sede_extraido: codigo_sede,
                sede_reportada_cliente: nombre_sede_crudo,
                origen: 'CORREO'
            }
        };

        // Si la sede no se mapeó automáticamente, guardamos el nombre crudo
        if (!branchData) {
            ticketToCreate.sede_reportada_cliente = nombre_sede_crudo;
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

        console.log(`✅ Ticket creado: ${ticket_banco} -> ID: ${newTicket.id}`);
        return NextResponse.json({
            id: newTicket.id,
            ticket_numero: ticket_banco,
            sede_mapeada: !!branchData
        }, { status: 200 });

    } catch (error: any) {
        console.error('Webhook Error:', error);
        return NextResponse.json({ error: 'Internal Server Error', detail: error.message }, { status: 500 });
    }
}
