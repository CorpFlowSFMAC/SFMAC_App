import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { routingAPI } from '@/lib/routing-api';

// ── Constantes ────────────────────────────────────────────────────
const MIBANCO_ID = process.env.MIBANCO_CLIENT_ID ?? 'b65727ed-94d3-46ef-ab7d-62621ec46acb';

/** Regex para parsear asuntos con formato SFMAC, incluye prefijos RV/FW/RE */
const MAIN_REGEX = /(?:RV:|FW:|FWD:|RE:)?\s*ST:\s*([\w.\-]+)\s*-\s*TIPO\s*:\s*(.+?)\s*-\s*INMUEBLE\s*:\s*(.+)/i;
const ALT_REGEX  = /Ticket:?\s*([\w.\-]+).*?Tipo:?\s*(.+?)(?:Sede|Inmueble|Agencia):?\s*(.+)/i;

/** Palabras de ruido a eliminar del nombre de sede para búsqueda limpia */
const SEDE_NOISE = /\b(AG|AGENCIA|MATRIZ|SUCURSAL|OF|OFICINA|SEDE|BN)\b/gi;

// ── Tipos internos ────────────────────────────────────────────────
interface ParsedTicket {
    ticketBanco: string;
    tipoIncidencia: string;
    inmuebleRaw: string;
    codigoSede: string;
    nombreSede: string;
    cleanNombre: string;
}

// ── Helpers ───────────────────────────────────────────────────────
function parseSubject(text: string): ParsedTicket | null {
    const match = text.match(MAIN_REGEX) ?? text.match(ALT_REGEX);
    if (!match) return null;

    const ticketBanco    = match[1].trim();
    const tipoIncidencia = match[2].trim();
    const inmuebleRaw    = match[3].trim();

    const inmuebleMatch = inmuebleRaw.match(/^([\w\-]+)\s*-\s*(.*)$/);
    const codigoSede    = inmuebleMatch ? inmuebleMatch[1].trim() : inmuebleRaw.split(' ')[0];
    const nombreSede    = inmuebleMatch ? inmuebleMatch[2].trim() : inmuebleRaw;
    const cleanNombre   = nombreSede
        .replace(SEDE_NOISE, '')
        .replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑ\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

    return { ticketBanco, tipoIncidencia, inmuebleRaw, codigoSede, nombreSede, cleanNombre };
}

async function resolveBranch(parsed: ParsedTicket): Promise<{ branchId: string | null; clientId: string }> {
    const { codigoSede, cleanNombre, inmuebleRaw } = parsed;

    // Paso 1 — búsqueda exacta por código (ej. AG094)
    const { data: byCode } = await supabase
        .from('branch_offices')
        .select('id, client_id')
        .eq('client_id', MIBANCO_ID)
        .ilike('codigo_cliente', `%${codigoSede}%`)
        .maybeSingle();

    if (byCode?.id) return { branchId: byCode.id, clientId: byCode.client_id || MIBANCO_ID };

    // Paso 2 — búsqueda por nombre limpio
    if (cleanNombre.length >= 4) {
        const { data: byName } = await supabase
            .from('branch_offices')
            .select('id, client_id')
            .eq('client_id', MIBANCO_ID)
            .ilike('name', `%${cleanNombre}%`)
            .maybeSingle();

        if (byName?.id) return { branchId: byName.id, clientId: byName.client_id || MIBANCO_ID };
    }

    // Paso 3 — fuzzy match en memoria (descarga única de sedes)
    const { data: allBranches } = await supabase
        .from('branch_offices')
        .select('id, name, client_id, codigo_cliente')
        .eq('client_id', MIBANCO_ID);

    const rawLow   = inmuebleRaw.toLowerCase();
    const cleanLow = cleanNombre.toLowerCase();

    const fuzzy = allBranches?.find(b => {
        const dbLow  = b.name.toLowerCase();
        const codLow = (b.codigo_cliente ?? '').toLowerCase();
        return rawLow.includes(dbLow) || dbLow.includes(cleanLow) || (codLow && rawLow.includes(codLow));
    });

    return fuzzy
        ? { branchId: fuzzy.id, clientId: fuzzy.client_id || MIBANCO_ID }
        : { branchId: null, clientId: MIBANCO_ID };
}

// ── Webhook Handler ───────────────────────────────────────────────
export async function POST(req: NextRequest) {
    const secret        = req.headers.get('x-corpflow-secret');
    const webhookSecret = process.env.WEBHOOK_SECRET;

    let payload: Record<string, any> = {};
    try {
        payload = await req.json();
    } catch {
        return NextResponse.json({ error: 'JSON inválido en el cuerpo de la solicitud' }, { status: 400 });
    }

    // Validación de secreto
    if (webhookSecret && secret !== webhookSecret) {
        return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    try {
        const sender  = payload.remitente ?? payload.sender  ?? payload.Sender  ?? payload.from  ?? payload.From  ?? '';
        const subject = payload.asunto    ?? payload.subject ?? payload.Subject ?? '';
        const body    = payload.cuerpo    ?? payload.body    ?? payload.Body    ?? '';

        const parsed = parseSubject(`${subject}\n${body}`);

        // Sin parseo — guardar como borrador para no perder el correo
        if (!parsed) {
            const { data: draft } = await supabase.from('tickets').insert({
                client_id:            MIBANCO_ID,
                status_id:            'borrador',
                description:          body || `Asunto: ${subject}`,
                client_ticket_number: `BORRADOR-${Date.now().toString().slice(-6)}`,
                created_by:           'SISTEMA (MAKE-WEBHOOK)',
                metadata: { origen: 'CORREO_FORMATO_INVALIDO', subject_original: subject, remitente: sender }
            }).select('id').single();

            return NextResponse.json(
                { error: 'Formato de asunto no reconocido — guardado como borrador', id: draft?.id },
                { status: 422 }
            );
        }

        // Deduplicación
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

        // Resolver sede y gestora
        const { branchId, clientId } = await resolveBranch(parsed);
        const gestoraId = branchId ? await routingAPI.resolveGestora(branchId) : null;

        const { data: newTicket, error: insertError } = await supabase
            .from('tickets')
            .insert({
                client_id:            clientId,
                status_id:            'borrador',
                description:          body || `Importado via Make.com. Tipo: ${parsed.tipoIncidencia}\nAsunto: ${subject}`,
                client_ticket_number: parsed.ticketBanco,
                service_type:         null,
                created_by:           'SISTEMA (MAKE-WEBHOOK)',
                branch_id:            branchId,
                gestora_id:           gestoraId,
                ...(branchId ? {} : { sede_reportada_cliente: parsed.inmuebleRaw }),
                metadata: {
                    subject_original:           subject,
                    remitente_original:         sender,
                    codigo_sede_extraido:       parsed.codigoSede,
                    nombre_sede_extraido:       parsed.nombreSede,
                    sede_reportada_cliente:     parsed.inmuebleRaw,
                    tipo_incidencia_reportada:  parsed.tipoIncidencia,
                    origen:                     'CORREO_A_TICKET',
                    gestora_auto_asignada:      !!gestoraId,
                    sede_mapeada:               !!branchId,
                }
            })
            .select('id')
            .single();

        if (insertError) {
            throw new Error(insertError.message);
        }

        return NextResponse.json({
            id:                newTicket.id,
            ticket_numero:     parsed.ticketBanco,
            sede_mapeada:      !!branchId,
            enrutado_a_gestora: !!gestoraId,
            gestora_id:        gestoraId,
        }, { status: 200 });

    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : 'Error desconocido';
        console.error('[make-tickets] Error no controlado:', msg);
        return NextResponse.json({ error: 'Error interno del servidor', detail: msg }, { status: 500 });
    }
}
