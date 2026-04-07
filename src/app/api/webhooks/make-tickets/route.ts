import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { routingAPI } from '@/lib/routing-api';

const MIBANCO_ID = 'b65727ed-94d3-46ef-ab7d-62621ec46acb';

export async function POST(req: NextRequest) {
    const secret = req.headers.get('x-corpflow-secret');
    const webhookSecret = process.env.WEBHOOK_SECRET;

    let payload: any = {};
    try {
        payload = await req.json();
    } catch(e) {
        return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const diagLog: any = {
        timestamp: new Date().toISOString(),
        webhook: 'make-tickets',
        headers: Object.fromEntries(req.headers.entries()),
        payload,
        steps: []
    };

    const log = (step: string, detail: any) => {
        console.log(`[make-tickets] ${step}:`, detail);
        diagLog.steps.push({ step, detail, ts: new Date().toISOString() });
    };

    try {
        await supabase.from('debug_logs').insert({ log_data: diagLog });
    } catch(e) { /* ignore */ }

    if (webhookSecret && secret !== webhookSecret) {
        log('AUTH_FAILED', { received: secret });
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const sender  = payload.remitente || payload.sender  || payload.Sender  || payload.from || payload.From || '';
        const subject = payload.asunto    || payload.subject || payload.Subject || '';
        const body    = payload.cuerpo    || payload.body    || payload.Body    || '';

        log('CAMPOS', { sender, subject: subject.substring(0, 120) });

        const MAIN_REGEX = /(?:RV:|FW:|FWD:|RE:)?\s*ST:\s*([\w.\-]+)\s*-\s*TIPO\s*:\s*(.+?)\s*-\s*INMUEBLE\s*:\s*(.+)/i;
        const ALT_REGEX  = /Ticket:?\s*([\w.\-]+).*?Tipo:?\s*(.+?)(?:Sede|Inmueble|Agencia):?\s*(.+)/i;

        const textToParse = `${subject} \n ${body}`;
        let match = textToParse.match(MAIN_REGEX);
        if (!match) match = textToParse.match(ALT_REGEX);

        if (!match) {
            log('REGEX_FALLO', textToParse.substring(0, 200));
            const fallback = {
                client_id: MIBANCO_ID,
                status_id: 'borrador',
                description: body || `Asunto: ${subject}`,
                client_ticket_number: 'BORRADOR-' + Date.now().toString().slice(-6),
                created_by: 'SISTEMA (MAKE-WEBHOOK FAIL)',
                metadata: { origen: 'CORREO_FALLIDO', subject_original: subject, remitente_original: sender, diagLog }
            };
            await supabase.from('tickets').insert(fallback);
            return NextResponse.json({ error: 'Formato no reconocido — ticket en borrador', subject }, { status: 400 });
        }

        const ticket_banco    = match[1].trim();
        const tipo_incidencia = match[2].trim();
        const inmueble_raw    = match[3].trim();

        log('PARSED', { ticket_banco, tipo_incidencia, inmueble_raw });

        const inmuebleMatch = inmueble_raw.match(/^([\w\-]+)\s*-\s*(.*)$/);
        const codigo_sede   = inmuebleMatch ? inmuebleMatch[1].trim() : inmueble_raw.split(' ')[0];
        const nombre_sede   = inmuebleMatch ? inmuebleMatch[2].trim() : inmueble_raw;
        const cleanNombre   = nombre_sede
            .replace(/\b(AG|AGENCIA|MATRIZ|SUCURSAL|OF|OFICINA|SEDE|BN)\b/gi, '')
            .replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑ\s]/g, ' ')
            .replace(/\s+/g, ' ').trim();

        // DEDUPLICACIÓN
        const { data: existing } = await supabase
            .from('tickets')
            .select('id, status_id')
            .eq('client_ticket_number', ticket_banco)
            .eq('client_id', MIBANCO_ID)
            .maybeSingle();

        if (existing) {
            log('DUPLICADO', { id: existing.id });
            return NextResponse.json({ id: existing.id, message: `Ticket ya existe: ${ticket_banco}`, duplicate: true }, { status: 200 });
        }

        // BÚSQUEDA DE SEDE
        let finalBranchId: string | null = null;
        let resolvedClientId = MIBANCO_ID;

        const { data: byCode } = await supabase
            .from('branch_offices')
            .select('id, name, client_id')
            .eq('client_id', MIBANCO_ID)
            .ilike('codigo_cliente', `%${codigo_sede}%`)
            .maybeSingle();

        if (byCode?.id) {
            finalBranchId = byCode.id;
            resolvedClientId = byCode.client_id || MIBANCO_ID;
            log('SEDE_CODIGO', { branch: byCode.name });
        }

        if (!finalBranchId && cleanNombre.length >= 4) {
            const { data: byName } = await supabase
                .from('branch_offices')
                .select('id, name, client_id')
                .eq('client_id', MIBANCO_ID)
                .ilike('name', `%${cleanNombre}%`)
                .maybeSingle();
            if (byName?.id) { finalBranchId = byName.id; resolvedClientId = byName.client_id || MIBANCO_ID; log('SEDE_NOMBRE', { branch: byName.name }); }
        }

        if (!finalBranchId) {
            const { data: allBranches } = await supabase
                .from('branch_offices')
                .select('id, name, client_id, codigo_cliente')
                .eq('client_id', MIBANCO_ID);

            const fuzzy = allBranches?.find(b => {
                const dbLow  = b.name.toLowerCase();
                const rawLow = inmueble_raw.toLowerCase();
                const cLow   = cleanNombre.toLowerCase();
                const codLow = (b.codigo_cliente || '').toLowerCase();
                return rawLow.includes(dbLow) || dbLow.includes(cLow) || (codLow && rawLow.includes(codLow));
            });
            if (fuzzy) { finalBranchId = fuzzy.id; resolvedClientId = fuzzy.client_id || MIBANCO_ID; log('SEDE_FUZZY', { branch: fuzzy.name }); }
            else { log('SEDE_NO_ENCONTRADA', { codigo_sede, cleanNombre }); }
        }

        let gestoraId: string | null = null;
        if (finalBranchId) {
            gestoraId = await routingAPI.resolveGestora(finalBranchId);
            log('ENRUTAMIENTO', { finalBranchId, gestoraId });
        }

        const titulo = `${ticket_banco} - ${inmueble_raw}`;
        const ticketToCreate: any = {
            client_id: resolvedClientId,
            status_id: 'borrador',
            description: body || `Importado. Tipo: ${tipo_incidencia}\nAsunto: ${subject}`,
            client_ticket_number: ticket_banco,
            service_type: null,
            created_by: 'SISTEMA (MAKE-WEBHOOK)',
            branch_id: finalBranchId || null,
            gestora_id: gestoraId || null,
            metadata: {
                titulo, subject_original: subject, remitente_original: sender,
                codigo_sede_extraido: codigo_sede, nombre_sede_extraido: nombre_sede,
                sede_reportada_cliente: inmueble_raw,
                tipo_incidencia_reportada: tipo_incidencia,
                origen: 'CORREO_A_TICKET',
                enrutamiento_cascada_aplicado: true,
                gestora_auto_asignada: !!gestoraId,
                sede_mapeada: !!finalBranchId
            }
        };
        if (!finalBranchId) ticketToCreate.sede_reportada_cliente = inmueble_raw;

        const { data: newTicket, error: insertError } = await supabase
            .from('tickets').insert(ticketToCreate).select('id').single();

        if (insertError) {
            log('INSERT_ERROR', insertError);
            return NextResponse.json({ error: 'Error al crear ticket', detail: insertError.message }, { status: 500 });
        }

        log('TICKET_CREADO', { id: newTicket.id, ticket_banco, gestoraId });
        return NextResponse.json({
            id: newTicket.id, ticket_numero: ticket_banco,
            sede_mapeada: !!finalBranchId, enrutado_a_gestora: !!gestoraId, gestora_id: gestoraId
        }, { status: 200 });

    } catch (error: any) {
        console.error('[make-tickets] EXCEPCION:', error);
        return NextResponse.json({ error: 'Internal Server Error', detail: error.message }, { status: 500 });
    }
}
