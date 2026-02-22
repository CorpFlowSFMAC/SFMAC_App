import { NextResponse } from "next/server";
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "@google/generative-ai";

// ─────────────────────────────────────────────────────────
// POST /api/ai/gemini
// Genera una propuesta de cotización detallada (partidas)
// usando Gemini 2.0 Flash vía el SDK oficial de Google.
// ─────────────────────────────────────────────────────────
export async function POST(req: Request) {
    try {
        const { prompt, images } = await req.json();

        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            return NextResponse.json(
                { error: "GEMINI_API_KEY no está configurada en las variables de entorno." },
                { status: 500 }
            );
        }

        // --- INICIALIZAR SDK OFICIAL ---
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({
            model: "gemini-2.0-flash",
            safetySettings: [
                { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
                { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
                { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
                { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
            ],
            generationConfig: {
                temperature: 0.1,
                topP: 0.95,
                topK: 40,
                maxOutputTokens: 8192,
                responseMimeType: "application/json",
            },
        });

        // --- SISTEMA DE INSTRUCCIONES ---
        const systemPrompt = `Eres un experto cotizador de mantenimiento para la empresa SINFIMAC.
Genera un DESGLOSE DETALLADO DE PARTIDAS (Cotización) en formato JSON.

REGLAS:
1. Rentabilidad: Asegura un margen del 55% sobre el costo técnico total.
2. Formato: Responde ÚNICAMENTE con el objeto JSON puro. Sin texto extra, sin bloques markdown.
3. Idioma: Español profesional.

FORMATO REQUERIDO (JSON estricto):
{
  "partidas": [
    {
      "item": "1.0",
      "titulo": "Título corto de la partida",
      "descripcion": "Alcance detallado de la actividad",
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
    "comentario_ia": "Breve explicación de la estrategia de precios",
    "advertencia_ia": "Advertencias o consideraciones importantes"
  }
}`;

        // --- CONSTRUIR PARTES DEL MENSAJE ---
        const parts: any[] = [
            { text: `${systemPrompt}\n\nSOLICITUD DEL USUARIO:\n${prompt}` }
        ];

        // Añadir imágenes si existen (multimodal)
        if (images && Array.isArray(images)) {
            images.forEach((img: string) => {
                const match = img.match(/^data:(image\/[a-zA-Z]+);base64,(.+)$/);
                if (match) {
                    parts.push({
                        inlineData: {
                            mimeType: match[1],
                            data: match[2],
                        }
                    });
                }
            });
        }

        // --- LLAMADA AL MODELO ---
        const result = await model.generateContent({ contents: [{ role: "user", parts }] });
        const response = result.response;
        let resultText = response.text();

        // Limpiar markdown si la IA lo ignora pese al responseMimeType
        resultText = resultText.replace(/```json/g, "").replace(/```/g, "").trim();

        // --- PARSEAR Y DEVOLVER JSON ---
        try {
            const jsonResponse = JSON.parse(resultText);
            return NextResponse.json(jsonResponse);
        } catch (parseError) {
            console.error("[Gemini API] Error parseando JSON:", resultText.substring(0, 500));
            return NextResponse.json(
                { error: "La IA no devolvió un formato JSON válido.", raw: resultText },
                { status: 500 }
            );
        }

    } catch (error: any) {
        console.error("[Gemini API] Error interno:", error?.message || error);
        return NextResponse.json(
            { error: error?.message || "Error interno del servidor al llamar a Gemini." },
            { status: 500 }
        );
    }
}