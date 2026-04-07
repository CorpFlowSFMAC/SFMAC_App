import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import {
    MIBANCO_ID,
    parseEmailSubject,
    resolveBranchFromParsed,
    resolveGestora,
    createTicketFromEmail,
} from '../_webhook-utils';

export async function POST(req: NextRequest) {
    const secret        = req.headers.get('x-corpflow-secret');
    const webhookSecret = process.env.WEBHOOK_SECRET;

    let payload: Record<string, any> = {};
    try {
        payload = await req.json();
    } catch {
        return NextResponse.json({ error: 'JSON inválido en el cuerpo de la solicitud' }, { status: 400 });
    }

    if (webhookSecret && secret !== webhookSecret) {
        return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    try {
        const sender  = payload.remitente ?? payload.sender  ?? payload.Sender  ?? payload.from  ?? payload.From  ?? '';
        const subject = payload.asunto    ?? payload.subject ?? payload.Subject ?? '';
        const body    = payload.cuerpo    ?? payload.body    ?? payload.Body    ?? '';

        const parsed = parseEmailSubject(`${subject}\n${body}`);

        if (!parsed) {
            const { data: draft } = await supabase.from('tickets').insert({
                client_id:            MIBANCO_ID,
                status_id:            'borrador',
                description:          body || `Asunto: ${subject}`,
                client_ticket_number: `BORRADOR-${Date.now().toString().slice(-6)}`,
                created_by:           'SISTEMA (PA-WEBHOOK)',
                metadata: { origen: 'CORREO_FORMATO_INVALIDO', subject_original: subject, remitente: sender }
            }).select('id').single();

            return NextResponse.json(
                { error: 'Formato de asunto no reconocido — guardado como borrador', id: draft?.id },
                { status: 422 }
            );
        }

        const { data: existing } = await supabase
            .from('tickets')
            .select('id')
            .eq('client_ticket_number', parsed.ticketBanco)
            .eq('client_id', MIBANCO_ID)
            .maybeSingle();

        if (existing) {
            return NextResponse.json(
                { id: existing.id, ticket_numero: parsed.ticketBanco, duplicate: true },
                { status: 200 }
            );
        }

        const { branchId, clientId } = await resolveBranchFromParsed(parsed);
        const gestoraId = await resolveGestora(branchId);

        const { data: newTicket, error: insertError } = await createTicketFromEmail({
            parsed, branchId, clientId, gestoraId, sender, subject, body,
            createdBy: 'SISTEMA (POWER-AUTOMATE)',
        });

        if (insertError) throw new Error(insertError.message);

        return NextResponse.json({
            id:                 newTicket!.id,
            ticket_numero:      parsed.ticketBanco,
            sede_mapeada:       !!branchId,
            enrutado_a_gestora: !!gestoraId,
            gestora_id:         gestoraId,
        }, { status: 200 });

    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : 'Error desconocido';
        console.error('[power-automate] Error no controlado:', msg);
        return NextResponse.json({ error: 'Error interno del servidor', detail: msg }, { status: 500 });
    }
}
