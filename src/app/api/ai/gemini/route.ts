import { NextResponse } from "next/server";

// ═══════════════════════════════════════════════════════════════════════════════
//  CORPFLOW - MOTOR DE PRICING + IA MULTIMODAL
//  POST /api/ai/gemini
//
//  1. Recibe: costos técnicos, imágenes, ubicación de la sede
//  2. Calcula: viáticos por zona geográfica (Lima Metro / Provincia / Interior)
//  3. Aplica: Precio_Venta = Costo_Base / (1 - Margen)
//  4. Llama: Gemini IA (con fallback en cascada de modelos gratuitos)
//  5. Si IA falla: devuelve propuesta algorítmica con texto profesional
//
//  NUNCA devuelve error que crashee la UI.
// ═══════════════════════════════════════════════════════════════════════════════

// ── CONSTANTES ──────────────────────────────────────────────────────────────
const GEMINI_MODELS = [
    "gemini-1.5-flash",
    "gemini-1.5-flash-8b",
    "gemini-1.0-pro",
];

// Viáticos por zona (S/ por visita técnica)
const VIATICOS_POR_ZONA: Record<string, number> = {
    "Lima": 0,
    "Lima Metropolitana": 0,
    "Callao": 15,
    "Lima Norte": 25,
    "Lima Sur": 25,
    "Lima Este": 25,
    "Lima Cono Norte": 30,
    "Lima Cono Sur": 30,
    "default_provincia": 80,
    "default_interior": 150,
};

// Margen por defecto SINFIMAC (55%)
const MARGEN_DEFAULT = 0.55;

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
    zona?: string;
    departamento?: string;
    margenConfigured?: number;
    clienteNombre?: string;
}): PricingResult {
    const { costoManoObra, costoMateriales, zona, departamento, margenConfigured } = params;

    // Detectar viáticos por zona
    let viaticos = 0;
    let zonaDetectada = "No especificada";

    if (zona || departamento) {
        const zonaKey = zona || departamento || "";
        zonaDetectada = zonaKey;

        // Buscar match exacto
        if (VIATICOS_POR_ZONA[zonaKey] !== undefined) {
            viaticos = VIATICOS_POR_ZONA[zonaKey];
        } else {
            // Lima y sus variantes = 0 viáticos
            const limaPatterns = ["lima", "miraflores", "san isidro", "surco", "barranco", "chorrillos",
                "jesús maría", "magdalena", "pueblo libre", "san miguel", "la victoria",
                "ate", "san borja", "lince", "breña", "rímac", "el agustino", "cercado"];
            const isLima = limaPatterns.some(p => zonaKey.toLowerCase().includes(p));

            if (isLima) {
                viaticos = 0;
                zonaDetectada = "Lima Metropolitana";
            } else if (zonaKey.toLowerCase().includes("callao")) {
                viaticos = 15;
            } else if (departamento?.toLowerCase() === "lima") {
                viaticos = 30;
            } else {
                // Provincia fuera de Lima
                viaticos = 80;
                zonaDetectada = `${zonaKey} (Provincia)`;
            }
        }
    }

    const costoBaseTotal = costoManoObra + costoMateriales + viaticos;
    const margen = margenConfigured ?? MARGEN_DEFAULT;
    const precioVentaFinal = Math.round((costoBaseTotal / (1 - margen)) * 100) / 100;

    return {
        costoManoObra,
        costoMateriales,
        viaticos,
        costoBaseTotal,
        margenAplicado: margen * 100,
        precioVentaFinal,
        zonaDetectada,
        margenFuente: margenConfigured ? "Configuración por cliente" : "Estándar SINFIMAC (55%)",
    };
}

// ── GENERADOR ALGORITMICO (fallback garantizado) ───────────────────────────────
function generarPropostaAlgoritmo(params: {
    costoTotal: number;
    tipoServicio: string;
    descripcion: string;
    cliente: string;
    zona: string;
    pricing: PricingResult;
}): ProposalResponse {
    const { tipoServicio, descripcion, cliente, pricing } = params;
    const precioVenta = pricing.precioVentaFinal;

    const servicioLower = (tipoServicio + " " + descripcion).toLowerCase();

    // Plantillas inteligentes por tipo de servicio
    let plantilla: { titulo: string; descripcion: string; proporcion: number }[] = [];
    let diagnosticoProfesional = "";
    let justificacion = "";
    let tiempoEstimado = "4 a 8 horas hábiles";

    if (servicioLower.includes("elec") || servicioLower.includes("luz") ||
        servicioLower.includes("enchufe") || servicioLower.includes("cable") ||
        servicioLower.includes("tomacorriente") || servicioLower.includes("tablero")) {
        plantilla = [
            { titulo: "Movilización y Diagnóstico Eléctrico", descripcion: "Desplazamiento del técnico especialista a la sede, inspección preliminar del sistema eléctrico, medición de parámetros y localización precisa del punto de falla.", proporcion: 0.12 },
            { titulo: "Desmontaje y Evaluación de Componentes", descripcion: "Desmontaje controlado de los elementos eléctricos afectados, evaluación del estado de cableado, terminales, protecciones y equipos de maniobra.", proporcion: 0.18 },
            { titulo: "Suministro de Materiales Eléctricos Certificados", descripcion: "Provisión de materiales homologados: conductores eléctricos, interruptores termomagnético, tomacorrientes, canaletas, tuberías conduit y accesorios según normativa NTP.", proporcion: 0.28 },
            { titulo: "Instalación y Conexionado Técnico", descripcion: "Ejecución de la instalación eléctrica conforme al Código Nacional de Electricidad. Conexionado, empalmes con terminales de compresión, identificación de circuitos y peinado del tablero.", proporcion: 0.28 },
            { titulo: "Pruebas de Funcionamiento y Protocolo de Entrega", descripcion: "Verificación con instrumento calibrado (multímetro/pinza amperimétrica) del correcto funcionamiento. Entrega de informe técnico, acta de conformidad y garantía de 30 días.", proporcion: 0.14 },
        ];
        diagnosticoProfesional = `Se ha detectado una falla en el sistema eléctrico de la instalación correspondiente a ${cliente}. El diagnóstico preliminar evidencia deficiencias en los componentes de distribución eléctrica que comprometen la operatividad de las instalaciones y representan un riesgo potencial para la continuidad del servicio bancario.`;
        justificacion = `La intervención técnica especializada es imperativa para garantizar la continuidad operativa de la agencia y el cumplimiento de las normativas de seguridad eléctrica vigentes. La postergación de la corrección incrementa el riesgo de incidentes mayores e interrupciones prolongadas del servicio.`;
        tiempoEstimado = "6 a 10 horas hábiles";

    } else if (servicioLower.includes("aire") || servicioLower.includes("ac") ||
        servicioLower.includes("acondicionado") || servicioLower.includes("clima") ||
        servicioLower.includes("refriger")) {
        plantilla = [
            { titulo: "Inspección y Diagnóstico del Sistema de Climatización", descripcion: "Evaluación integral del equipo de climatización: verificación de presiones de gas refrigerante, estado del compresor, condensador, evaporador y sistema de control electrónico.", proporcion: 0.12 },
            { titulo: "Limpieza y Mantenimiento Profundo", descripcion: "Limpieza profesional de filtros, evaporador y condensador con equipos de alta presión. Desinfección con producto biocida certificado. Inspección y limpieza de purgadores de condensado.", proporcion: 0.20 },
            { titulo: "Suministro de Repuestos y Refrigerante", descripcion: "Provisión de repuestos originales o equivalentes certificados según especificaciones del fabricante. Carga o recarga de gas refrigerante ecológico según tipo de equipo.", proporcion: 0.30 },
            { titulo: "Reparación y Puesta en Marcha Técnica", descripcion: "Ejecución de la reparación según diagnóstico: cambio de componentes defectuosos, carga de refrigerante, ajuste de presiones y verificación de parámetros eléctricos del sistema.", proporcion: 0.26 },
            { titulo: "Pruebas de Rendimiento y Entrega Documental", descripcion: "Medición de temperatura de ingreso y salida, verificación del COP del equipo, entrega de informe técnico con registro fotográfico y certificado de mantenimiento.", proporcion: 0.12 },
        ];
        diagnosticoProfesional = `El sistema de climatización de la instalación de ${cliente} presenta anomalías de funcionamiento que han sido identificadas mediante inspección técnica especializada. El diagnóstico revela la necesidad de intervención correctiva para restablecer los parámetros óptimos de operación del equipo.`;
        justificacion = `El correcto funcionamiento del sistema de climatización es esencial para mantener las condiciones ambientales requeridas por las normativas bancarias y para preservar el bienestar del personal y clientes. La falla presente afecta directamente la calidad del servicio prestado en la agencia.`;
        tiempoEstimado = "4 a 8 horas hábiles";

    } else if (servicioLower.includes("red") || servicioLower.includes("cableado") ||
        servicioLower.includes("internet") || servicioLower.includes("switch") ||
        servicioLower.includes("router") || servicioLower.includes("datos")) {
        plantilla = [
            { titulo: "Diagnóstico de Infraestructura de Red", descripcion: "Evaluación completa del cableado estructurado, equipos activos (switches, routers, access points) y puntos de red. Uso de tester de cable y analizador de red.", proporcion: 0.15 },
            { titulo: "Suministro de Materiales de Infraestructura", descripcion: "Provisión de cable UTP Cat6/Cat6A certificado, conectores RJ45, patch panels, canaletas, y equipos activos de red según especificaciones requeridas.", proporcion: 0.35 },
            { titulo: "Instalación y Certificación de Cableado", descripcion: "Tendido de cableado estructurado siguiendo normas ANSI/TIA-568. Terminación de puntos de red, parcheo en rack y certificación con equipo Fluke.", proporcion: 0.30 },
            { titulo: "Configuración y Pruebas de Conectividad", descripcion: "Configuración de equipos activos, pruebas de conectividad extremo a extremo, verificación de velocidades de transferencia y documentación de la topología resultante.", proporcion: 0.20 },
        ];
        diagnosticoProfesional = `La infraestructura de red de la sede de ${cliente} presenta fallas que impactan la conectividad y continuidad de los sistemas críticos bancarios. La evaluación técnica determina la necesidad de intervención inmediata en el cableado estructurado y/o equipos activos de red.`;
        justificacion = `La conectividad de red es un servicio crítico para las operaciones bancarias. Cualquier degradación o interrupción impacta directamente en los sistemas transaccionales, la seguridad de la información y la atención al cliente, generando pérdidas operativas significativas.`;
        tiempoEstimado = "6 a 12 horas hábiles";

    } else {
        // Genérico profesional
        plantilla = [
            { titulo: "Movilización y Diagnóstico Técnico en Sitio", descripcion: "Desplazamiento del técnico especialista a las instalaciones de la sede, evaluación técnica completa del sistema o equipo afectado y elaboración del diagnóstico formal.", proporcion: 0.12 },
            { titulo: "Suministro de Materiales e Insumos Técnicos", descripcion: "Provisión de materiales, insumos, repuestos y elementos necesarios para la correcta ejecución del servicio, de acuerdo con las especificaciones técnicas del fabricante.", proporcion: 0.30 },
            { titulo: "Mano de Obra Técnica Especializada", descripcion: "Ejecución del servicio técnico por personal certificado y con experiencia comprobada en instalaciones bancarias. Intervención siguiendo protocolos de seguridad y calidad corporativos.", proporcion: 0.30 },
            { titulo: "Supervisión Técnica y Control de Calidad", descripcion: "Supervisión especializada de la ejecución, verificación del cumplimiento de los estándares de calidad SINFIMAC y validación de los resultados obtenidos.", proporcion: 0.16 },
            { titulo: "Pruebas Finales, Documentación y Entrega Formal", descripcion: "Verificación integral del correcto funcionamiento post-intervención, entrega de informe técnico detallado, acta de conformidad firmada y certificado de garantía de trabajo.", proporcion: 0.12 },
        ];
        diagnosticoProfesional = `Se ha realizado la evaluación técnica de la instalación de ${cliente} y se ha identificado la necesidad de intervención especializada para restablecer el correcto funcionamiento de los sistemas afectados. El diagnóstico técnico confirma la viabilidad y urgencia de la intervención propuesta.`;
        justificacion = `La presente intervención técnica es necesaria para garantizar la continuidad operativa de la sede, mantener los estándares de seguridad requeridos por la entidad bancaria y cumplir con los acuerdos de nivel de servicio (SLA) establecidos contractualmente.`;
    }

    // Incluir viáticos si aplica
    if (pricing.viaticos > 0) {
        plantilla.splice(1, 0, {
            titulo: "Viáticos y Logística de Desplazamiento",
            descripcion: `Costos de traslado del equipo técnico hacia la sede ubicada en ${pricing.zonaDetectada}. Incluye pasajes, peajes o gastos de movilidad interprovincial según la ubicación geográfica de la agencia.`,
            proporcion: pricing.viaticos / precioVenta,
        });
        // Re-normalizar proporciones del resto
        const sum = plantilla.reduce((s, p) => s + p.proporcion, 0);
        plantilla = plantilla.map(p => ({ ...p, proporcion: p.proporcion / sum }));
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

    // Ajustar para que sume exacto
    const totalParcial = partidas.reduce((s, p) => s + p.precio_total, 0);
    const dif = Math.round((precioVenta - totalParcial) * 100) / 100;
    partidas[partidas.length - 1].precio_unitario += dif;
    partidas[partidas.length - 1].precio_total += dif;

    return {
        partidas,
        pricing,
        diagnostico_profesional: diagnosticoProfesional,
        justificacion_intervencion: justificacion,
        tiempo_estimado: tiempoEstimado,
        resumen: {
            costo_tecnico_total: pricing.costoBaseTotal,
            precio_total_venta: precioVenta,
            margen_logrado: `${pricing.margenAplicado.toFixed(0)}%`,
            comentario_ia: `Propuesta SINFIMAC generada automáticamente. Precio de venta S/ ${precioVenta.toFixed(2)} asegura margen del ${pricing.margenAplicado.toFixed(0)}% sobre costo base total S/ ${pricing.costoBaseTotal.toFixed(2)}${pricing.viaticos > 0 ? ` (incluye S/ ${pricing.viaticos} de viáticos por ${pricing.zonaDetectada})` : ''}.`,
            advertencia_ia: "Propuesta generada por motor algorítmico SINFIMAC. Revise y ajuste el texto del diagnóstico y los precios de cada partida antes de enviar al cliente.",
        },
        fuente: "algoritmo",
    };
}

// ── LLAMADA GEMINI REST ────────────────────────────────────────────────────────
async function llamarGeminiRest(
    apiKey: string,
    modelName: string,
    promptCompleto: string,
    images: string[] = []
): Promise<string> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

    // Construir partes del mensaje (texto + imágenes opcionales)
    const parts: any[] = [{ text: promptCompleto }];

    // Solo agregar imágenes para modelos que las soportan
    if (images.length > 0 && modelName !== "gemini-1.0-pro") {
        images.slice(0, 4).forEach((img) => { // Max 4 imágenes
            const match = img.match(/^data:(image\/[a-zA-Z]+);base64,(.+)$/);
            if (match) {
                parts.push({
                    inlineData: { mimeType: match[1], data: match[2] }
                });
            }
        });
    }

    const body = {
        contents: [{ role: "user", parts }],
        generationConfig: {
            temperature: 0.15,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 6000,
        },
    };

    const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(25000),
    });

    if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        const errMsg = errData?.error?.message || res.statusText;
        throw new Error(`[${modelName}] HTTP ${res.status}: ${errMsg}`);
    }

    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error(`[${modelName}] Respuesta vacía`);
    return text;
}

function parsearJSON(raw: string): any {
    let cleaned = raw.replace(/```json\s*/gi, "").replace(/```\s*/gi, "").trim();
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start !== -1 && end !== -1) cleaned = cleaned.slice(start, end + 1);
    return JSON.parse(cleaned);
}

// ── HANDLER PRINCIPAL ─────────────────────────────────────────────────────────
export async function POST(req: Request) {
    try {
        const body = await req.json().catch(() => ({}));
        const {
            costoManoObra = 0,
            costoMateriales = 0,
            costoTotal = 0, // compatibilidad hacia atrás
            tipoServicio = "",
            descripcion = "",
            diagnostico = "",
            cliente = "",
            zona = "",
            departamento = "",
            address = "",
            margenConfigured,
            images = [],
        } = body;

        // Normalizar costos (algunas versiones pasan costoTotal como total combinado)
        const mo = costoManoObra > 0 ? costoManoObra : costoTotal * 0.55;
        const mat = costoMateriales > 0 ? costoMateriales : costoTotal * 0.45;

        // ── CALCULAR PRICING ──
        const pricing = calcularPricing({
            costoManoObra: mo,
            costoMateriales: mat,
            zona: zona || address,
            departamento,
            margenConfigured,
            clienteNombre: cliente,
        });

        // ── INTENTAR IA ──
        const apiKey = process.env.GEMINI_API_KEY;

        if (apiKey) {
            const promptIA = `Eres un redactor técnico corporativo senior de SINFIMAC CORP, especialista en mantenimiento para entidades bancarias en Perú.

INSTRUCCIÓN PRINCIPAL:
Analiza los datos del trabajo de campo y las fotos adjuntas. Redacta una propuesta de cotización PROFESIONAL con el tono formal requerido por entidades bancarias como Mibanco, BCP, Santander, BBVA, etc.

═══ DATOS DEL TICKET ═══
Cliente: ${cliente}
Tipo de servicio: ${tipoServicio}
Descripción del problema (apuntes informales del técnico): "${descripcion}"
Diagnóstico técnico en campo: "${diagnostico || 'Ver fotos adjuntas'}"
Ubicación / Zona: ${zona || departamento || address || 'Lima'}

${images.length > 0 ? `FOTOS ADJUNTAS: ${images.length} imagen(es) del trabajo en campo. Analízalas para detallar mejor el alcance.` : ''}

═══ MOTOR DE PRICING PRECALCULADO ═══
(NO revelar estos costos al cliente - son datos internos de SINFIMAC)
- Mano de Obra del técnico: S/ ${mo.toFixed(2)}
- Materiales/Repuestos: S/ ${mat.toFixed(2)}
- Viáticos por ubicación (${pricing.zonaDetectada}): S/ ${pricing.viaticos.toFixed(2)}
- COSTO BASE TOTAL (confidencial): S/ ${pricing.costoBaseTotal.toFixed(2)}
- PRECIO DE VENTA FINAL (con ${pricing.margenAplicado.toFixed(0)}% margen): S/ ${pricing.precioVentaFinal.toFixed(2)}

═══ LO QUE DEBES GENERAR ═══
1. Un "Diagnóstico Técnico" profesional (3-4 oraciones, tono técnico formal, orientado a justificar la inversión ante el banco)
2. Una "Justificación de Intervención" (2-3 oraciones explicando por qué es necesario actuar)  
3. Un "Tiempo Estimado" de ejecución
4. Un desglose en 4-6 "Partidas" que sumen exactamente S/ ${pricing.precioVentaFinal.toFixed(2)}
   - NUNCA mostrar el costo del técnico por separado
   - Distribuir el precio de venta estratégicamente entre las partidas
   - Usar nombres de partidas profesionales y técnicos

RESPONDE SOLO CON JSON PURO (sin markdown, sin texto extra):
{
  "diagnostico_profesional": "Texto formal del diagnóstico técnico...",
  "justificacion_intervencion": "Texto de justificación...",
  "tiempo_estimado": "X a Y horas hábiles",
  "partidas": [
    {
      "item": "1.0",
      "titulo": "Nombre técnico de la partida",
      "descripcion": "Alcance detallado y profesional de la actividad",
      "unidad": "GLB",
      "cantidad": 1,
      "precio_unitario": 0,
      "precio_total": 0
    }
  ],
  "resumen": {
    "precio_total_venta": ${pricing.precioVentaFinal},
    "margen_logrado": "${pricing.margenAplicado.toFixed(0)}%",
    "comentario_ia": "Breve nota sobre la estrategia de precios aplicada",
    "advertencia_ia": "Consideraciones importantes para la gestora"
  }
}`;

            let ultimoError = "";
            for (const modelo of GEMINI_MODELS) {
                try {
                    console.log(`[PricingEngine] Modelo: ${modelo} | Imágenes: ${images.length}`);
                    const rawText = await llamarGeminiRest(apiKey, modelo, promptIA,
                        images.filter((img: string) => img.startsWith("data:image")));
                    const parsed = parsearJSON(rawText);

                    if (!parsed?.partidas || !Array.isArray(parsed.partidas)) {
                        throw new Error("Sin campo 'partidas' en respuesta IA");
                    }

                    // Asegurar precio_total en cada partida
                    parsed.partidas = parsed.partidas.map((p: any) => ({
                        ...p,
                        precio_total: p.precio_total || (p.precio_unitario * (p.cantidad || 1)),
                    }));

                    // Ajustar para que sume exactamente el precio_venta_final
                    const totalPartidas = parsed.partidas.reduce((s: number, p: any) => s + (p.precio_total || 0), 0);
                    const difCorreccion = Math.round((pricing.precioVentaFinal - totalPartidas) * 100) / 100;
                    if (Math.abs(difCorreccion) > 0.01) {
                        parsed.partidas[parsed.partidas.length - 1].precio_unitario += difCorreccion;
                        parsed.partidas[parsed.partidas.length - 1].precio_total += difCorreccion;
                    }

                    console.log(`[PricingEngine] Éxito con ${modelo}`);
                    return NextResponse.json({ ...parsed, pricing, fuente: "gemini" });

                } catch (err: any) {
                    ultimoError = err?.message || String(err);
                    console.warn(`[PricingEngine] Falló ${modelo}: ${ultimoError}`);
                    if (ultimoError.includes("401") || ultimoError.includes("403")) break;
                    continue;
                }
            }
            console.warn(`[PricingEngine] IA no disponible. Usando algoritmo. Último error: ${ultimoError}`);
        }

        // ── FALLBACK: ALGORITMO SINFIMAC ──
        const propuesta = generarPropostaAlgoritmo({
            costoTotal: pricing.costoBaseTotal,
            tipoServicio,
            descripcion,
            cliente,
            zona: pricing.zonaDetectada,
            pricing,
        });

        return NextResponse.json(propuesta);

    } catch (error: any) {
        console.error("[PricingEngine] Error crítico:", error);
        return NextResponse.json(
            { error: "Error interno del motor de pricing", detalle: error?.message },
            { status: 500 }
        );
    }
}