import { NextResponse } from "next/server";

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

        // --- SISTEMA DE INSTRUCCIONES ---
        const systemPrompt = `Eres un experto cotizador de mantenimiento para la empresa SINFIMAC.
Genera un DESGLOSE DETALLADO DE PARTIDAS (Cotización) en formato JSON.

REGLAS:
1. Rentabilidad: Asegura un margen del 55% sobre el costo técnico.
2. Formato: Responde ÚNICAMENTE con el objeto JSON puro. Sin texto extra, sin bloques markdown (\`\`\`json).
3. Idioma: Español profesional.

FORMATO REQUERIDO:
{
  "partidas": [
    { "item": "1.0", "titulo": "...", "descripcion": "...", "unidad": "GLB/UND", "cantidad": 1, "precio_unitario": 0, "precio_total": 0 }
  ],
  "resumen": {
    "costo_tecnico_total": 0,
    "precio_total_venta": 0,
    "margen_logrado": "55%",
    "comentario_ia": "...",
    "advertencia_ia": "..."
  }
}`;

        // --- PREPARAR CONTENIDO PARA GOOGLE API (DIRECT FETCH) ---
        const contents = [
            {
                role: "user",
                parts: [
                    { text: `${systemPrompt}\n\nSOLICITUD DEL USUARIO:\n${prompt}` }
                ]
            }
        ];

        // Añadir imágenes si existen
        if (images && Array.isArray(images)) {
            images.forEach((img: string) => {
                const match = img.match(/^data:(image\/[a-zA-Z]+);base64,(.+)$/);
                if (match) {
                    contents[0].parts.push({
                        inline_data: {
                            mime_type: match[1],
                            data: match[2]
                        }
                    } as any);
                }
            });
        }

        // --- LLAMADA DIRECTA A LA API (BYPASS SDK) ---
        // Intentamos usar gemini-1.5-flash ya que 2.0-flash ha excedido la cuota
        const modelName = "gemini-1.5-flash";
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

        const apiResponse = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                contents,
                generationConfig: {
                    temperature: 0.1,
                    topP: 0.95,
                    topK: 40,
                    maxOutputTokens: 8192,
                }
            })
        });

        const data = await apiResponse.json();

        if (!apiResponse.ok) {
            console.error("Error de Google API:", data);
            return NextResponse.json(
                {
                    error: `Error de Google: ${data.error?.message || "Error desconocido"}`,
                    details: data
                },
                { status: apiResponse.status }
            );
        }

        let resultText = data.candidates?.[0]?.content?.parts?.[0]?.text || "";

        // Limpiamos la respuesta de cualquier envoltorio markdown si la IA ignora las reglas
        resultText = resultText.replace(/```json/g, "").replace(/```/g, "").trim();

        try {
            const jsonResponse = JSON.parse(resultText);
            return NextResponse.json(jsonResponse);
        } catch (parseError) {
            console.error("Error parseando JSON de la IA:", resultText);
            return NextResponse.json(
                { error: "La IA no devolvió un formato JSON válido.", raw: resultText },
                { status: 500 }
            );
        }

    } catch (error: any) {
        console.error("Error en /api/ai/gemini:", error);
        return NextResponse.json(
            { error: error.message || "Error interno del servidor" },
            { status: 500 }
        );
    }
}