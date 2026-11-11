import { NextRequest, NextResponse } from "next/server";
import { PDFParse } from "pdf-parse";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData();
        const file = formData.get("file") as File | null;
        if (!file) {
            return NextResponse.json({ success: false, error: "No se seleccionó ningún archivo PDF" }, { status: 400 });
        }

        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        const parser = new PDFParse({ data: buffer });
        const textResult = await parser.getText();
        const text = typeof textResult === 'string' ? textResult : (textResult.text || "");

        // 1. Extraer N° OC (preferir números de 4 a 10 dígitos o alfanumérico limpio)
        let ocNumber = "";
        const numOcMatch = text.match(/ORDEN\s+DE\s+COMPRA\s+(?:N[°º\.]*)?\s*([0-9]{4,10})/i);
        if (numOcMatch) {
            ocNumber = numOcMatch[1];
        } else {
            const rawMatch = text.match(/ORDEN\s+DE\s+COMPRA\s+(?:N[°º\.]*)?\s*([A-Z0-9_-]+)/i);
            if (rawMatch) {
                ocNumber = rawMatch[1].replace(/P[aá]gina.*$/i, '').trim();
            }
        }

        // 2. Extraer Fecha
        let fechaOc = "";
        const fechaMatch = text.match(/Fecha(?:\s+de\s+entrega)?:\s*([0-9]{2}[\/\-][0-9]{2}[\/\-][0-9]{4})/i);
        if (fechaMatch) {
            const [d, m, y] = fechaMatch[1].split(/[\/\-]/);
            fechaOc = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
        }

        // 3. Extraer Totales
        const totalMatches = Array.from(text.matchAll(/TOTAL\s+([0-9,]+\.[0-9]{2})/gi));
        let total = 0;
        if (totalMatches.length > 0) {
            const lastTotal = totalMatches[totalMatches.length - 1][1];
            total = parseFloat(lastTotal.replace(/,/g, ''));
        }

        const subtotalMatches = Array.from(text.matchAll(/Subtotal\s+([0-9,]+\.[0-9]{2})/gi));
        let subtotal = 0;
        if (subtotalMatches.length > 0) {
            const lastSub = subtotalMatches[subtotalMatches.length - 1][1];
            subtotal = parseFloat(lastSub.replace(/,/g, ''));
        }

        // 4. Extraer códigos de tickets únicos
        const ticketRegex = /([A-Z]{2,4}\d{4,8}(?:\.\d{2})?)/g;
        const matches = text.match(ticketRegex) || [];
        const excludedPrefixes = ["ORDEN", "TOTAL", "PAGINA", "SERIE", "COMPRA", "SRV", "RUC", "TELF"];
        const uniqueTickets = Array.from(new Set(matches))
            .map(t => t.trim().toUpperCase())
            .filter(t => !excludedPrefixes.some(p => t.startsWith(p)));

        return NextResponse.json({
            success: true,
            fileName: file.name,
            ocNumber,
            fechaOc,
            subtotal,
            total,
            ticketCount: uniqueTickets.length,
            tickets: uniqueTickets,
            rawText: text
        });

    } catch (err: any) {
        console.error("[parse-oc-pdf API] Error:", err);
        return NextResponse.json({
            success: false,
            error: err?.message || "Error procesando el documento PDF"
        }, { status: 500 });
    }
}
