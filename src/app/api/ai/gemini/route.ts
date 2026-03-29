import { NextResponse } from "next/server";

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/ai/gemini
// Genera propuesta de cotización usando Gemini 1.5 Flash vía REST (GRATUITO).
// Si la IA falla (cuota, error, timeout), devuelve un desglose algorítmico
// inteligente para que el botón NUNCA falle.
// ─────────────────────────────────────────────────────────────────────────────

interface Partida {
    item: string;
    titulo: string;
    descripcion: string;
    unidad: string;
    cantidad: number;
    precio_unitario: number;
    precio_total: number;
}

interface ProposalResponse {
    partidas: Partida[];
    resumen: {
        costo_tecnico_total: number;
        precio_total_venta: number;
        margen_logrado: string;
        comentario_ia: string;
        advertencia_ia: string;
    };
    fuente: "gemini" | "algoritmo";
}

// ── MODELOS A INTENTAR (orden de prioridad, todos gratuitos) ──
const GEMINI_MODELS = [
    "gemini-1.5-flash",
    "gemini-1.5-flash-8b",
    "gemini-1.0-pro",
];

// ── GENERADOR ALGORITMO INTELIGENTE (fallback garantizado) ──
function generarPropostaAlgoritmo(
    costoTotal: number,
    tipoServicio: string,
    descripcion: string,
    cliente: string
): ProposalResponse {
    const precioVenta = Math.round((costoTotal / 0.45) * 100) / 100;

    // Plantillas de partidas por tipo de servicio
    const plantillas: Record<string, { titulo: string; descripcion: string; proporcion: number }[]> = {
        electricidad: [
            { titulo: "Movilización y Desmontaje", descripcion: "Traslado del técnico a la sede, verificación inicial del sistema eléctrico y preparación del área de trabajo.", proporcion: 0.15 },
            { titulo: "Diagnóstico Eléctrico", descripcion: "Evaluación técnica del sistema eléctrico, medición de parámetros y detección del punto de falla.", proporcion: 0.20 },
            { titulo: "Suministro de Materiales Eléctricos", descripcion: "Provisión de materiales necesarios: cables, interruptores, canaletas o componentes según diagnóstico.", proporcion: 0.30 },
            { titulo: "Mano de Obra Especializada", descripcion: "Instalación, conexión y configuración del sistema eléctrico. Reparación o reemplazo del componente defectuoso.", proporcion: 0.25 },
            { titulo: "Pruebas y Puesta en Servicio", descripcion: "Verificación del correcto funcionamiento del sistema eléctrico, pruebas de carga y entrega técnica.", proporcion: 0.10 },
        ],
        mantenimiento: [
            { titulo: "Movilización e Inspección Inicial", descripcion: "Desplazamiento a la sede, evaluación integral del equipo o instalación a mantener.", proporcion: 0.15 },
            { titulo: "Limpieza y Desinfección Técnica", descripcion: "Limpieza profunda de componentes, retiro de suciedad, polvo o agentes contaminantes.", proporcion: 0.20 },
            { titulo: "Suministro de Insumos y Repuestos", descripcion: "Provisión de insumos de mantenimiento, lubricantes, filtros o piezas de recambio.", proporcion: 0.30 },
            { titulo: "Mantenimiento Preventivo/Correctivo", descripcion: "Ejecución del mantenimiento según protocolo técnico, ajuste y calibración de componentes.", proporcion: 0.25 },
            { titulo: "Informe Técnico y Garantía", descripcion: "Documentación del servicio, entrega de informe técnico y garantía de trabajo.", proporcion: 0.10 },
        ],
        default: [
            { titulo: "Movilización y Diagnóstico", descripcion: "Traslado del técnico especialista a la sede del cliente, evaluación inicial del problema reportado.", proporcion: 0.15 },
            { titulo: "Suministro de Materiales", descripcion: "Provisión de materiales, insumos y/o repuestos necesarios para la solución del servicio.", proporcion: 0.30 },
            { titulo: "Mano de Obra Especializada", descripcion: "Ejecución del servicio técnico por personal calificado. Reparación, instalación o mantenimiento según alcance.", proporcion: 0.30 },
            { titulo: "Supervisión y Control de Calidad", descripcion: "Supervisión técnica de la ejecución, revisión de estándares de calidad y conformidad del trabajo.", proporcion: 0.15 },
            { titulo: "Pruebas de Funcionamiento y Entrega", descripcion: "Verificación final del servicio, pruebas de operación y entrega formal con acta de conformidad.", proporcion: 0.10 },
        ],
    };

    // Detectar tipo de plantilla
    const servicioLower = (tipoServicio + " " + descripcion).toLowerCase();
    let plantilla = plantillas.default;
    if (servicioLower.includes("elec") || servicioLower.includes("luz") || servicioLower.includes("enchufe") || servicioLower.includes("cable") || servicioLower.includes("tomacorriente")) {
        plantilla = plantillas.electricidad;
    } else if (servicioLower.includes("mant") || servicioLower.includes("limpieza") || servicioLower.includes("preventivo")) {
        plantilla = plantillas.mantenimiento;
    }

    const partidas: Partida[] = plantilla.map((p, i) => {
        const precioPartida = Math.round(precioVenta * p.proporcion * 100) / 100;
        return {
            item: `${i + 1}.0`,
            titulo: p.titulo,
            descripcion: p.descripcion,
            unidad: "GLB",
            cantidad: 1,
            precio_unitario: precioPartida,
            precio_total: precioPartida,
        };
    });

    // Ajustar último item para que el total sea exacto
    const totalParcial = partidas.reduce((s, p) => s + p.precio_total, 0);
    const diferencia = Math.round((precioVenta - totalParcial) * 100) / 100;
    partidas[partidas.length - 1].precio_unitario += diferencia;
    partidas[partidas.length - 1].precio_total += diferencia;

    return {
        partidas,
        resumen: {
            costo_tecnico_total: costoTotal,
            precio_total_venta: precioVenta,
            margen_logrado: "55%",
            comentario_ia: `Propuesta generada automáticamente para ${cliente || "cliente corporativo"}. Precio de venta calculado con margen del 55% sobre costo técnico de S/ ${costoTotal.toFixed(2)}.`,
            advertencia_ia: "Propuesta generada por algoritmo SINFIMAC. Revise y ajuste las partidas según el alcance real del servicio antes de enviar al cliente.",
        },
        fuente: "algoritmo",
    };
}

// ── LLAMADA A GEMINI VÍA REST (sin SDK, sin cuota de pago) ──
async function llamarGeminiRest(
    apiKey: string,
    modelName: string,
    promptCompleto: string
): Promise<string> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

    const body = {
        contents: [{ role: "user", parts: [{ text: promptCompleto }] }],
        generationConfig: {
            temperature: 0.2,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 4096,
        },
    };

    const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(20000), // 20s timeout
    });

    if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        const errMsg = errData?.error?.message || res.statusText;
        throw new Error(`[${modelName}] HTTP ${res.status}: ${errMsg}`);
    }

    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error(`[${modelName}] Respuesta vacía del modelo`);
    return text;
}

// ── PARSEAR RESPUESTA DE GEMINI ──
function parsearRespuestaGemini(raw: string): any {
    // Limpiar bloques markdown
    let cleaned = raw
        .replace(/```json\s*/gi, "")
        .replace(/```\s*/gi, "")
        .trim();

    // Buscar el primer { y el último }
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start !== -1 && end !== -1) {
        cleaned = cleaned.slice(start, end + 1);
    }

    return JSON.parse(cleaned);
}

// ── HANDLER PRINCIPAL ──
export async function POST(req: Request) {
    try {
        const body = await req.json().catch(() => ({}));
        const { prompt = "", costoTotal = 0, tipoServicio = "", descripcion = "", cliente = "" } = body;

        const apiKey = process.env.GEMINI_API_KEY;

        // Si no hay API key, ir directo al algoritmo
        if (!apiKey) {
            console.log("[Gemini API] Sin API key — usando algoritmo");
            const propuesta = generarPropostaAlgoritmo(costoTotal, tipoServicio, descripcion, cliente);
            return NextResponse.json(propuesta);
        }

        // ── CONSTRUIR PROMPT COMPLETO ──
        const promptCompleto = `Eres un experto cotizador de mantenimiento y servicios técnicos para la empresa SINFIMAC CORP en Perú.
Tu tarea es generar un DESGLOSE DETALLADO DE PARTIDAS para una cotización formal.

DATOS DEL SERVICIO:
${prompt || `
- Cliente: ${cliente}
- Tipo de Servicio: ${tipoServicio}
- Descripción del problema: ${descripcion}
- Costo técnico referencial (MO + Materiales): S/ ${costoTotal}
`}

REGLAS OBLIGATORIAS:
1. Margen: El precio total de venta = costo técnico / 0.45 (margen 55% sobre venta)
2. Desglosar en 4 a 6 partidas lógicas (no dar un monto global)
3. Usar terminología técnica profesional en español
4. Responder ÚNICAMENTE con JSON puro, sin texto adicional, sin markdown

FORMATO JSON REQUERIDO (cópialo exactamente):
{
  "partidas": [
    {
      "item": "1.0",
      "titulo": "Nombre corto de la partida",
      "descripcion": "Alcance técnico detallado de la actividad",
      "unidad": "GLB",
      "cantidad": 1,
      "precio_unitario": 0,
      "precio_total": 0
    }
  ],
  "resumen": {
    "costo_tecnico_total": 0,
    "precio_total_venta": 0,
    "margen_logrado": "55%",
    "comentario_ia": "Explicación breve de la estrategia de precios",
    "advertencia_ia": "Advertencias importantes sobre el servicio"
  }
}`;

        // ── INTENTAR CON CADA MODELO (cascada) ──
        let ultimoError = "";
        for (const modelo of GEMINI_MODELS) {
            try {
                console.log(`[Gemini API] Intentando con modelo: ${modelo}`);
                const rawText = await llamarGeminiRest(apiKey, modelo, promptCompleto);
                const parsed = parsearRespuestaGemini(rawText);

                // Validar estructura mínima
                if (!parsed?.partidas || !Array.isArray(parsed.partidas)) {
                    throw new Error("Estructura JSON inválida — sin campo 'partidas'");
                }

                // Calcular precio_total si falta
                parsed.partidas = parsed.partidas.map((p: any) => ({
                    ...p,
                    precio_total: p.precio_total || p.precio_unitario * (p.cantidad || 1),
                }));

                console.log(`[Gemini API] Éxito con modelo: ${modelo}`);
                return NextResponse.json({ ...parsed, fuente: "gemini" });

            } catch (err: any) {
                ultimoError = err?.message || String(err);
                console.warn(`[Gemini API] Falló ${modelo}: ${ultimoError}`);

                // Si es cuota agotada, intentar siguiente modelo
                if (ultimoError.includes("429") || ultimoError.includes("quota") || ultimoError.includes("RESOURCE_EXHAUSTED")) {
                    continue;
                }
                // Si es error grave (autenticación, etc), ir directo al algoritmo
                if (ultimoError.includes("401") || ultimoError.includes("403") || ultimoError.includes("API_KEY")) {
                    break;
                }
                continue;
            }
        }

        // ── TODOS LOS MODELOS FALLARON → USAR ALGORITMO ──
        console.warn(`[Gemini API] Todos los modelos fallaron. Usando algoritmo. Último error: ${ultimoError}`);
        const propuestaAlgo = generarPropostaAlgoritmo(costoTotal, tipoServicio, descripcion, cliente);
        return NextResponse.json(propuestaAlgo);

    } catch (error: any) {
        console.error("[Gemini API] Error crítico:", error);
        // Incluso en error total, intentar devolver algo útil
        try {
            const body = await req.json().catch(() => ({}));
            const propuesta = generarPropostaAlgoritmo(
                body.costoTotal || 0,
                body.tipoServicio || "",
                body.descripcion || "",
                body.cliente || ""
            );
            return NextResponse.json(propuesta);
        } catch {
            return NextResponse.json(
                { error: "Error interno del servidor", fuente: "error" },
                { status: 500 }
            );
        }
    }
}