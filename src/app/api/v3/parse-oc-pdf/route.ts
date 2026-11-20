import { NextRequest, NextResponse } from "next/server";
import zlib from "zlib";

export const dynamic = "force-dynamic";

function extractTextFromPdfBuffer(buffer: Buffer): string {
    const raw = buffer.toString('latin1');
    const streamRegex = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
    let match: RegExpExecArray | null;
    let fullText = '';

    while ((match = streamRegex.exec(raw)) !== null) {
        const streamData = Buffer.from(match[1], 'latin1');
        let decompressed: Buffer | null = null;
        try {
            decompressed = zlib.inflateSync(streamData);
        } catch {
            try {
                decompressed = zlib.inflateRawSync(streamData);
            } catch {
                decompressed = streamData;
            }
        }

        if (!decompressed) continue;

        const streamText = decompressed.toString('latin1');
        const textParts: string[] = [];

        // Operadores de texto Tj: (texto) Tj
        const tjRegex = /\(([\s\S]*?)\)\s*(?:Tj|'|")/g;
        let tMatch: RegExpExecArray | null;
        while ((tMatch = tjRegex.exec(streamText)) !== null) {
            textParts.push(tMatch[1]);
        }

        // Operadores de arreglo TJ: [(texto1) 120 (texto2)] TJ
        const arrayTjRegex = /\[([\s\S]*?)\]\s*TJ/gi;
        let arrMatch: RegExpExecArray | null;
        while ((arrMatch = arrayTjRegex.exec(streamText)) !== null) {
            const inner = arrMatch[1];
            const partRegex = /\(([\s\S]*?)\)/g;
            let pMatch: RegExpExecArray | null;
            while ((pMatch = partRegex.exec(inner)) !== null) {
                textParts.push(pMatch[1]);
            }
        }

        if (textParts.length > 0) {
            fullText += ' ' + textParts.join(' ');
        }
    }
    return fullText;
}

export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData();
        const file = formData.get("file") as File | null;
        if (!file) {
            return NextResponse.json({ success: false, error: "No se seleccionó ningún archivo" }, { status: 400 });
        }

        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const fileName = file.name || "";
        const isXml = fileName.toLowerCase().endsWith(".xml") || buffer.toString("utf8", 0, 100).includes("<?xml");

        let text = "";
        if (isXml) {
            text = buffer.toString("utf8");
        } else {
            text = extractTextFromPdfBuffer(buffer);
            // Fallback si stream parsing extrajo poco texto
            if (!text || text.length < 50) {
                const rawUtf8 = buffer.toString("utf8");
                text = rawUtf8.replace(/[^\x20-\x7E\xA0-\xFF\n\r\t]/g, " ");
            }
        }

        // 1. Extraer N° OC si existe
        let ocNumber = "";
        const numOcMatch = text.match(/ORDEN\s+DE\s+COMPRA\s+(?:N[º°\.]*)?\s*([0-9]{4,10})/i);
        if (numOcMatch) {
            ocNumber = numOcMatch[1];
        } else {
            const rawMatch = text.match(/ORDEN\s+DE\s+COMPRA\s+(?:N[º°\.]*)?\s*([A-Z0-9_-]+)/i);
            if (rawMatch) {
                ocNumber = rawMatch[1].replace(/P[aá]gina.*$/i, '').trim();
            }
        }

        // 2. Extraer N° de Factura / Comprobante Electrónico (Series F..., E..., B..., etc.)
        let docNumber = "";
        let isInvoice = false;

        if (isXml) {
            const xmlId = text.match(/<cbc:ID>([A-Z0-9]{4}-[0-9]{1,8})<\/cbc:ID>/i);
            if (xmlId) {
                docNumber = xmlId[1].trim().toUpperCase();
                isInvoice = true;
            }
        }

        if (!docNumber) {
            // Regex para Factura Electrónica en PDF: F001-0004521, E001-12345, F001-123, etc.
            const invPattern = /(?:FACTURA(?:\s+ELECTR[OÓ]NICA)?|BOLETA(?:\s+ELECTR[OÓ]NICA)?|COMPROBANTE)\s*(?:DE\s+VENTA)?\s*(?:ELECTR[OÓ]NICO)?\s*(?:N[°º\.]*)?\s*([FEB][A-Z0-9]{3}[-\s]+[0-9]{1,8})/i;
            const invMatch = text.match(invPattern);
            if (invMatch) {
                docNumber = invMatch[1].replace(/\s+/g, '-').toUpperCase();
                isInvoice = true;
            }
        }

        if (!docNumber) {
            // Búsqueda directa por serie común peruana: F001-12345, E001-1234, FE01-123
            const seriesMatch = text.match(/\b([FEB][A-Z0-9]{3}-[0-9]{1,8})\b/i);
            if (seriesMatch) {
                docNumber = seriesMatch[1].toUpperCase();
                isInvoice = true;
            }
        }

        if (!docNumber && fileName) {
            // En caso de que el archivo se llame 20601234567-01-F001-0004521.pdf o F001-0004521.pdf
            const fnMatch = fileName.match(/([FEB][A-Z0-9]{3}-[0-9]{1,8})/i);
            if (fnMatch) {
                docNumber = fnMatch[1].toUpperCase();
                isInvoice = true;
            }
        }

        // 3. Extraer Fecha (Fecha de Emisión o Fecha de OC)
        let fechaOc = "";
        let fechaEmision = "";

        if (isXml) {
            const xmlDate = text.match(/<cbc:IssueDate>([0-9]{4}-[0-9]{2}-[0-9]{2})<\/cbc:IssueDate>/i);
            if (xmlDate) {
                fechaEmision = xmlDate[1];
                fechaOc = xmlDate[1];
            }
        }

        if (!fechaEmision) {
            const fechaEmisMatch = text.match(/Fecha(?:\s+de)?\s+emisi[óo]n\s*[:\s]*([0-9]{2}[\/\-][0-9]{2}[\/\-][0-9]{4})/i);
            if (fechaEmisMatch) {
                const [d, m, y] = fechaEmisMatch[1].split(/[\/\-]/);
                fechaEmision = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
            }
        }

        const fechaMatch = text.match(/Fecha(?:\s+de\s+entrega)?:\s*([0-9]{2}[\/\-][0-9]{2}[\/\-][0-9]{4})/i);
        if (fechaMatch) {
            const [d, m, y] = fechaMatch[1].split(/[\/\-]/);
            fechaOc = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
        }
        if (!fechaOc && fechaEmision) {
            fechaOc = fechaEmision;
        }

        // 4. Extraer Totales generales
        let total = 0;
        let subtotal = 0;
        let igv = 0;

        if (isXml) {
            const xmlPayable = text.match(/<cbc:PayableAmount[^>]*>([0-9\.]+)<\/cbc:PayableAmount>/i);
            if (xmlPayable) total = parseFloat(xmlPayable[1]);

            const xmlTaxable = text.match(/<cbc:TaxableAmount[^>]*>([0-9\.]+)<\/cbc:TaxableAmount>/i);
            if (xmlTaxable) subtotal = parseFloat(xmlTaxable[1]);

            const xmlTax = text.match(/<cbc:TaxAmount[^>]*>([0-9\.]+)<\/cbc:TaxAmount>/i);
            if (xmlTax) igv = parseFloat(xmlTax[1]);
        }

        if (total === 0) {
            const totalMatches = Array.from(text.matchAll(/(?:IMPORTE\s+TOTAL|TOTAL\s+A\s+PAGAR|TOTAL\s+VENTA|TOTAL)\s*[:\s]*S?\/?\.?\s*([0-9,]+\.[0-9]{2})/gi));
            if (totalMatches.length > 0) {
                const lastTotal = totalMatches[totalMatches.length - 1][1];
                total = parseFloat(lastTotal.replace(/,/g, ''));
            }
        }

        if (subtotal === 0) {
            const subtotalMatches = Array.from(text.matchAll(/(?:OP(?:ERACIONES)?\.?\s*GRAVADA[S]?|VALOR\s+VENTA|Subtotal)\s*[:\s]*S?\/?\.?\s*([0-9,]+\.[0-9]{2})/gi));
            if (subtotalMatches.length > 0) {
                const lastSub = subtotalMatches[subtotalMatches.length - 1][1];
                subtotal = parseFloat(lastSub.replace(/,/g, ''));
            }
        }

        if (igv === 0) {
            const igvMatches = Array.from(text.matchAll(/IGV\s*(?:\(18%\)|18%)?\s*[:\s]*S?\/?\.?\s*([0-9,]+\.[0-9]{2})/gi));
            if (igvMatches.length > 0) {
                const lastIgv = igvMatches[igvMatches.length - 1][1];
                igv = parseFloat(lastIgv.replace(/,/g, ''));
            }
        }

        if (total > 0 && subtotal === 0) {
            subtotal = Math.round((total / 1.18 + Number.EPSILON) * 100) / 100;
        }
        if (total === 0 && subtotal > 0) {
            total = Math.round((subtotal * 1.18 + Number.EPSILON) * 100) / 100;
        }
        if (igv === 0 && total > 0 && subtotal > 0) {
            igv = Math.round((total - subtotal + Number.EPSILON) * 100) / 100;
        }

        // 5. Extraer códigos de tickets y sus montos individuales
        const ticketRegex = /([A-Z]{2,4}\d{4,8}(?:\.\d{2})?)/g;
        const matches = text.match(ticketRegex) || [];
        const excludedPrefixes = [
            "ORDEN", "TOTAL", "PAGINA", "SERIE", "COMPRA", "SRV", "RUC", "TELF", "SIS",
            "FACT", "VALO", "GRAV", "VENT", "PAGA", "FECH", "ITEM", "CANT", "PREC", "DESC", "MONE"
        ];
        const uniqueTickets = Array.from(new Set(matches))
            .map(t => t.trim().toUpperCase())
            .filter(t => !excludedPrefixes.some(p => t.startsWith(p)));

        // Extraer detalles de cada línea (subtotal y total con IGV)
        const ticketDetails: Record<string, { subtotal: number; total: number }> = {};
        let lineMatch: RegExpExecArray | null;
        ticketRegex.lastIndex = 0;

        while ((lineMatch = ticketRegex.exec(text)) !== null) {
            const tCode = lineMatch[1].toUpperCase();
            if (excludedPrefixes.some(p => tCode.startsWith(p))) continue;

            const snippet = text.substring(lineMatch.index, lineMatch.index + 250);
            const igvMatch = snippet.match(/IGV\s*(?:18\s*%)?\s*[:\s]*([0-9,]+\.[0-9]{2,4})/i);
            let itemSubtotal = 0;
            if (igvMatch) {
                itemSubtotal = parseFloat(igvMatch[1].replace(/,/g, ''));
            } else {
                const numMatches = Array.from(snippet.matchAll(/([0-9]{1,3}(?:,[0-9]{3})*\.[0-9]{2,4})/g));
                if (numMatches.length > 0) {
                    itemSubtotal = parseFloat(numMatches[numMatches.length - 1][1].replace(/,/g, ''));
                }
            }

            const itemTotal = Math.round((itemSubtotal * 1.18 + Number.EPSILON) * 100) / 100;
            if (itemSubtotal > 0) {
                ticketDetails[tCode] = {
                    subtotal: itemSubtotal,
                    total: itemTotal
                };
            }
        }

        return NextResponse.json({
            success: true,
            fileName: file.name,
            ocNumber,
            docNumber: docNumber || null,
            fechaOc,
            fechaEmision: fechaEmision || fechaOc || null,
            subtotal,
            igv,
            total,
            isInvoice: Boolean(docNumber || isInvoice),
            ticketCount: uniqueTickets.length,
            tickets: uniqueTickets,
            ticketDetails,
            rawText: text.substring(0, 5000)
        });

    } catch (err: any) {
        console.error("[parse-oc-pdf API] Error:", err);
        return NextResponse.json({
            success: false,
            error: err?.message || "Error procesando el documento PDF / XML"
        }, { status: 500 });
    }
}
