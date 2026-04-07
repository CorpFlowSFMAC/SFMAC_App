/**
 * Utilidades compartidas para todos los webhooks de ingesta de tickets.
 * Centraliza el parsing del asunto y la búsqueda de sede para evitar duplicación.
 */
import { supabase } from '@/lib/supabase';
import { routingAPI } from '@/lib/routing-api';

export const MIBANCO_ID = process.env.MIBANCO_CLIENT_ID ?? 'b65727ed-94d3-46ef-ab7d-62621ec46acb';

const MAIN_REGEX = /(?:RV:|FW:|FWD:|RE:)?\s*ST:\s*([\w.\-]+)\s*-\s*TIPO\s*:\s*(.+?)\s*-\s*INMUEBLE\s*:\s*(.+)/i;
const ALT_REGEX  = /Ticket:?\s*([\w.\-]+).*?Tipo:?\s*(.+?)(?:Sede|Inmueble|Agencia):?\s*(.+)/i;
const SEDE_NOISE = /\b(AG|AGENCIA|MATRIZ|SUCURSAL|OF|OFICINA|SEDE|BN)\b/gi;

export interface ParsedTicket {
    ticketBanco: string;
    tipoIncidencia: string;
    inmuebleRaw: string;
    codigoSede: string;
    nombreSede: string;
    cleanNombre: string;
}

export interface ResolvedBranch {
    branchId: string | null;
    clientId: string;
}

/** Parsea el asunto del correo y extrae los campos del ticket. Devuelve null si el formato es inválido. */
export function parseEmailSubject(text: string): ParsedTicket | null {
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

/** Resuelve la sede en cascada: código exacto → nombre → fuzzy en memoria. */
export async function resolveBranchFromParsed(parsed: ParsedTicket): Promise<ResolvedBranch> {
    const { codigoSede, cleanNombre, inmuebleRaw } = parsed;

    const { data: byCode } = await supabase
        .from('branch_offices')
        .select('id, client_id')
        .eq('client_id', MIBANCO_ID)
        .ilike('codigo_cliente', `%${codigoSede}%`)
        .maybeSingle();

    if (byCode?.id) return { branchId: byCode.id, clientId: byCode.client_id || MIBANCO_ID };

    if (cleanNombre.length >= 4) {
        const { data: byName } = await supabase
            .from('branch_offices')
            .select('id, client_id')
            .eq('client_id', MIBANCO_ID)
            .ilike('name', `%${cleanNombre}%`)
            .maybeSingle();

        if (byName?.id) return { branchId: byName.id, clientId: byName.client_id || MIBANCO_ID };
    }

    const { data: all } = await supabase
        .from('branch_offices')
        .select('id, name, client_id, codigo_cliente')
        .eq('client_id', MIBANCO_ID);

    const rawLow   = inmuebleRaw.toLowerCase();
    const cleanLow = cleanNombre.toLowerCase();

    const fuzzy = all?.find(b => {
        const dbLow  = b.name.toLowerCase();
        const codLow = (b.codigo_cliente ?? '').toLowerCase();
        return rawLow.includes(dbLow) || dbLow.includes(cleanLow) || (codLow && rawLow.includes(codLow));
    });

    return fuzzy
        ? { branchId: fuzzy.id, clientId: fuzzy.client_id || MIBANCO_ID }
        : { branchId: null, clientId: MIBANCO_ID };
}

/** Construye y persiste un ticket en Supabase. */
export async function createTicketFromEmail(opts: {
    parsed: ParsedTicket;
    branchId: string | null;
    clientId: string;
    gestoraId: string | null;
    sender: string;
    subject: string;
    body: string;
    createdBy: string;
}) {
    const { parsed, branchId, clientId, gestoraId, sender, subject, body, createdBy } = opts;
    return supabase
        .from('tickets')
        .insert({
            client_id:            clientId,
            status_id:            'borrador',
            description:          body || `Tipo: ${parsed.tipoIncidencia}\nAsunto: ${subject}`,
            client_ticket_number: parsed.ticketBanco,
            service_type:         null,
            created_by:           createdBy,
            branch_id:            branchId,
            gestora_id:           gestoraId,
            ...(branchId ? {} : { sede_reportada_cliente: parsed.inmuebleRaw }),
            metadata: {
                subject_original:          subject,
                remitente_original:        sender,
                codigo_sede_extraido:      parsed.codigoSede,
                nombre_sede_extraido:      parsed.nombreSede,
                sede_reportada_cliente:    parsed.inmuebleRaw,
                tipo_incidencia_reportada: parsed.tipoIncidencia,
                origen:                    'CORREO_A_TICKET',
                gestora_auto_asignada:     !!gestoraId,
                sede_mapeada:              !!branchId,
            }
        })
        .select('id')
        .single();
}

/** Resuelve la gestora correcta para una sede (si existe). */
export async function resolveGestora(branchId: string | null): Promise<string | null> {
    if (!branchId) return null;
    return routingAPI.resolveGestora(branchId);
}
