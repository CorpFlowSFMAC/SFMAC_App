import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseAnonKey, getSupabaseUrl } from "@/lib/supabase-config";

// ═══════════════════════════════════════════════════════════════════════════════
//  CORPFLOW - MOTOR DE PRICING + IA MULTIMODAL CON APRENDIZAJE HISTÓRICO
//  POST /api/ai/gemini
// ═══════════════════════════════════════════════════════════════════════════════

const GEMINI_MODELS = [
    "gemini-1.5-flash",
    "gemini-1.5-flash-8b",
    "gemini-1.0-pro",
];

const VIATICOS_POR_ZONA: Record<string, number> = {
    "Lima": 0, "Lima Metropolitana": 0, "Callao": 15, "Lima Norte": 25, "Lima Sur": 25, "Lima Este": 25,
    "Lima Cono Norte": 30, "Lima Cono Sur": 30, "Tarapoto": 80, "Huancayo": 80, "Trujillo": 80,
    "Chiclayo": 80, "Piura": 100, "Arequipa": 120, "Cuzco": 150, "Puno": 150, "Loreto": 180,
    "Iquitos": 200, "default_provincia": 80, "default_interior": 150,
};

const MARGEN_DEFAULT = 0.55;

// ── SUPABASE CLIENT (para aprendizaje) - Lazy initialization ──────────────────
const getSupabaseClient = () => {
    const supabaseUrl = getSupabaseUrl();
    const supabaseKey = getSupabaseAnonKey();
    if (!supabaseUrl || !supabaseKey) {
        console.error('[Gemini] Supabase not configured');
        return null;
    }
    return createClient(supabaseUrl, supabaseKey);
};

// ── INTERFACES ────────────────────────────────────────────────────────────────
interface Partida {
    item: string;
    titulo: string;
    descripcion: string;
    unidad: string;
    cantidad: number;
    precio_unitario: number;
    precio_total: number;
}

interface PricingResult {
    costoManoObra: number;
    costoMateriales: number;
    viaticos: number;
    costoBaseTotal: number;
    margenAplicado: number;
    precioVentaFinal: number;
    zonaDetectada: string;
    margenFuente: string;
}

interface ProposalResponse {
    partidas: Partida[];
    pricing: PricingResult;
    diagnostico_profesional: string;
    justificacion_intervencion: string;
    tiempo_estimado: string;
    resumen: {
        costo_tecnico_total: number;
        precio_total_venta: number;
        margen_logrado: string;
        comentario_ia: string;
        advertencia_ia: string;
    };
    fuente: "gemini" | "algoritmo";
}

// ── MOTOR DE PRICING ──────────────────────────────────────────────────────────
function calcularPricing(params: {
    costoManoObra: number;
    costoMateriales: number;
    ciudad?: string;
    zona?: string;
    departamento?: string;
    provincia?: string;
    distrito?: string;
    margenConfigured?: number;
}): PricingResult {
    const { costoManoObra, costoMateriales, ciudad, zona, departamento, provincia, distrito, margenConfigured } = params;
    let viaticos = 0;
    const locText = `${ciudad || ''} ${provincia || ''} ${departamento || ''} ${distrito || ''} ${zona || ''}`.trim();
    let zonaDetectada = locText || "Ubicación Sede";

    const findMatch = (text: string) => {
        const lowerText = text.toLowerCase();
        for (const [key, value] of Object.entries(VIATICOS_POR_ZONA)) {
            if (lowerText.includes(key.toLowerCase())) return value;
        }
        return -1;
    };

    const matchValue = findMatch(locText);
    if (matchValue !== -1) {
        viaticos = matchValue;
    } else {
        const limaPatterns = ["lima", "miraflores", "san isidro", "surco", "barranco", "chorrillos", "cono"];
        const isLima = limaPatterns.some(p => locText.toLowerCase().includes(p));
        if (isLima) {
            viaticos = 0;
            if (!zonaDetectada.toLowerCase().includes("lima")) zonaDetectada = "Lima / Callao";
        } else if (locText.toLowerCase().includes("callao")) {
            viaticos = 15;
        } else {
            viaticos = 80;
        }
    }

    const costoBaseTotal = costoManoObra + costoMateriales + viaticos;
    const margen = margenConfigured ?? MARGEN_DEFAULT;
    const precioVentaFinal = Math.round((costoBaseTotal / (1 - margen)) * 100) / 100;

    return {
        costoManoObra, costoMateriales, viaticos, costoBaseTotal,
        margenAplicado: margen * 100, precioVentaFinal, zonaDetectada,
        margenFuente: margenConfigured ? "Configuración por cliente" : "Estándar SINFIMAC (55%)",
    };
}

// ── GENERADOR ALGORITMICO (fallback) ───────────────────────────────────────────
function generarPropostaAlgoritmo(params: {
    tipoServicio: string;
    descripcion: string;
    cliente: string;
    pricing: PricingResult;
}): ProposalResponse {
    const { tipoServicio, descripcion, cliente, pricing } = params;
    const precioVenta = pricing.precioVentaFinal;
    const servicioLower = (tipoServicio + " " + descripcion).toLowerCase();

    let plantilla = [
        { titulo: "Movilización y Diagnóstico Técnico en Sitio", descripcion: "Evaluación técnica completa del sistema afectado.", proporcion: 0.12 },
        { titulo: "Suministro de Materiales e Insumos", descripcion: "Provisión de repuestos y materiales necesarios.", proporcion: 0.38 },
        { titulo: "Mano de Obra Especializada", descripcion: "Ejecución del servicio por personal certificado.", proporcion: 0.38 },
        { titulo: "Pruebas y Entrega", descripcion: "Verificación de correcto funcionamiento.", proporcion: 0.12 },
    ];

    if (pricing.viaticos > 0) {
        plantilla.splice(1, 0, {
            titulo: "Viáticos y Logística",
            descripcion: `Traslado a ${pricing.zonaDetectada}.`,
            proporcion: pricing.viaticos / precioVenta,
        });
        const sum = plantilla.reduce((s, p) => s + p.proporcion, 0);
        plantilla = plantilla.map(p => ({ ...p, proporcion: p.proporcion / sum }));
    }

    const partidas: Partida[] = plantilla.map((p, i) => {
        const pTotal = Math.round(precioVenta * p.proporcion * 100) / 100;
        return { item: `${i + 1}.0`, titulo: p.titulo, descripcion: p.descripcion, unidad: "GLB", cantidad: 1, precio_unitario: pTotal, precio_total: pTotal };
    });

    const diff = Math.round((precioVenta - partidas.reduce((s, p) => s + p.precio_total, 0)) * 100) / 100;
    if (partidas.length > 0) {
        partidas[partidas.length - 1].precio_unitario += diff;
        partidas[partidas.length - 1].precio_total += diff;
    }

    return {
        partidas, pricing, diagnostico_profesional: `Evaluación de ${tipoServicio} en sede de ${cliente}.`,
        justificacion_intervencion: "Necesario para garantizar operatividad.", tiempo_estimado: "4-8 horas",
        resumen: { costo_tecnico_total: pricing.costoBaseTotal, precio_total_venta: precioVenta, margen_logrado: "55%", comentario_ia: "Generado automáticamente.", advertencia_ia: "Revisar." },
        fuente: "algoritmo"
    };
}

// ── LLAMADA GEMINI ─────────────────────────────────────────────────────────────
async function llamarGeminiRest(apiKey: string, modelName: string, prompt: string, images: string[] = [], imageUrls: string[] = []): Promise<string> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
    const parts: any[] = [{ text: prompt }];

    if (images.length > 0 && modelName !== "gemini-1.0-pro") {
        images.slice(0, 3).forEach((img) => {
            const m = img.match(/^data:(image\/[a-zA-Z]+);base64,(.+)$/);
            if (m) parts.push({ inlineData: { mimeType: m[1], data: m[2] } });
        });
    }
    if (imageUrls.length > 0) parts[0].text += `\n\n[SISTEMA: ${imageUrls.length} fotos adicionales disponibles.]`;

    const res = await fetch(url, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [{ role: "user", parts }], generationConfig: { temperature: 0.1, maxOutputTokens: 6000 } }),
        signal: AbortSignal.timeout(30000)
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const d = await res.json();
    return d?.candidates?.[0]?.content?.parts?.[0]?.text || "";
}

function parseJSON(raw: string) {
    let c = raw.replace(/```json\s*/gi, "").replace(/```\s*/gi, "").trim();
    const s = c.indexOf("{"), e = c.lastIndexOf("}");
    return (s !== -1 && e !== -1) ? JSON.parse(c.slice(s, e + 1)) : null;
}

// ── HANDLER ──────────────────────────────────────────────────────────────────
export async function POST(req: Request) {
    try {
        const body = await req.json();
        const {
            costoManoObra = 0, costoMateriales = 0, tecnicoNombre = "Especialista", tecnicoCosto = 0,
            tipoServicio = "", descripcion = "", diagnostico = "", cliente = "", ciudad = "",
            zona = "", departamento = "", provincia = "", distrito = "", address = "",
            margenConfigured, images = [], imageUrls = []
        } = body;

        const mo = costoManoObra > 0 ? costoManoObra : (tecnicoCosto > 0 ? tecnicoCosto : 0);
        const pricing = calcularPricing({ costoManoObra: mo, costoMateriales, ciudad, zona, departamento, provincia, distrito, margenConfigured });

        // ── APRENDIZAJE: BUSCAR COTIZACIONES PREVIAS SIMILARES ──
        let historialContext = "";
        try {
            const { data: previousTickets } = await supabase
                .from("tickets")
                .select("description, total_quoted_amount, service_type, metadata")
                .ilike("service_type", `%${tipoServicio}%`)
                .in("status_id", ["completado", "liquidado", "cerrado", "cotizacion_aprobada"])
                .order("created_at", { ascending: false })
                .limit(3);

            if (previousTickets && previousTickets.length > 0) {
                historialContext = "\n═══ HISTORIAL DE COTIZACIONES APROBADAS SIMILARES ═══\n";
                previousTickets.forEach((t, i) => {
                    historialContext += `REF ${i + 1}: [${t.service_type}] Desc: ${t.description?.substring(0, 80)}... -> Venta: S/ ${t.total_quoted_amount}\n`;
                });
                historialContext += "Usa estas referencias para mantener coherencia en precios y partidas si el trabajo es de complejidad similar.\n";
            }
        } catch (e) { console.error("Error fetching history:", e); }

        const apiKey = process.env.GEMINI_API_KEY;
        if (apiKey) {
            const prompt = `Eres un experto en presupuestos para SINFIMAC CORP (Mantenimiento Bancario).
OBJETIVO: Generar propuesta formal basada en evidencia y aprendizaje histórico.

═══ DATOS DEL TICKET ACTUAL ═══
- CLIENTE: ${cliente} | SEDE: ${ciudad} (${address})
- TÉCNICO: ${tecnicoNombre} | SERVICIO: ${tipoServicio}
- DIAGNÓSTICO: ${diagnostico} | RESUMEN: ${descripcion}
${historialContext}
═══ MOTOR DE PRICING (CONFIDENCIAL) ═══
- Costo Base: S/ ${pricing.costoBaseTotal.toFixed(2)} (MO: ${mo}, Mat: ${costoMateriales}, Viáticos: ${pricing.viaticos})
- PRECIO VENTA OBJETIVO: S/ ${pricing.precioVentaFinal.toFixed(2)}

INSTRUCCIONES:
1. DIAGNÓSTICO PROFESIONAL: Basado en el reporte de ${tecnicoNombre}.
2. JUSTIFICACIÓN TÉCNICA: Riesgos operativos si no se interviene.
3. PARTIDAS: 3-5 partidas que sumen EXACTAMENTE S/ ${pricing.precioVentaFinal.toFixed(2)}.

RESPONDE SOLO JSON:
{
  "diagnostico_profesional": "...", "justificacion_intervencion": "...", "tiempo_estimado": "...",
  "partidas": [{ "item": "1.0", "titulo": "...", "descripcion": "...", "unidad": "GLB", "cantidad": 1, "precio_unitario": 0, "precio_total": 0 }],
  "resumen": { "comentario_ia": "Considerando el historial de ${tipoServicio} y el reporte en campo..." }
}`;

            for (const m of GEMINI_MODELS) {
                try {
                    const raw = await llamarGeminiRest(apiKey, m, prompt, images, imageUrls);
                    const parsed = parseJSON(raw);
                    if (parsed?.partidas) {
                        const totalP = parsed.partidas.reduce((s: number, p: any) => s + (p.precio_total || 0), 0);
                        const diff = Math.round((pricing.precioVentaFinal - totalP) * 100) / 100;
                        if (Math.abs(diff) > 0) {
                            parsed.partidas[parsed.partidas.length - 1].precio_unitario += diff;
                            parsed.partidas[parsed.partidas.length - 1].precio_total += diff;
                        }
                        return NextResponse.json({ ...parsed, pricing, fuente: "gemini" });
                    }
                } catch (e) { console.warn(`AI Falló ${m}`); }
            }
        }

        return NextResponse.json(generarPropostaAlgoritmo({ tipoServicio, descripcion, cliente, pricing }));
    } catch (e: any) {
        return NextResponse.json({ error: "Error" }, { status: 500 });
    }
}