import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
    try {
        const { prompt, imageBase64, images } = await req.json();

        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            return NextResponse.json(
                { error: "GEMINI_API_KEY is not defined in environment variables" },
                { status: 500 }
            );
        }

        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({
            model: "gemini-1.5-flash-latest",
            generationConfig: {
                responseMimeType: "application/json",
                temperature: 0.2,
            },
            systemInstruction: `Eres un experto cotizador de mantenimiento (SINFIMAC). Tu tarea es generar un DESGLOSE DETALLADO DE PARTIDAS (Cotización).
            
            INPUT:
            1. Descripción del problema y contexto.
            2. Imágenes (Evidencia visual).
            3. (Opcional) Ejemplos históricos de cotizaciones aprobadas para aprender el estilo y precios.

            OUTPUT:
            JSON con el desglose de partidas. El precio de venta total debe respetar el margen del 55% sobre el costo técnico referencial, A MENOS que los ejemplos históricos sugieran otro patrón de precios de mercado.
            
            Formato JSON: { partidas: [{ item: string, titulo: string, descripcion: string, unidad: string, cantidad: number, precio_unitario: number, precio_total: number }], resumen: { costo_tecnico_total: number, precio_total_venta: number, margen_logrado: string, comentario_ia: string } }`
        });

        const parts: any[] = [{ text: prompt }];

        // Handle legacy single image field
        if (imageBase64) {
            const match = imageBase64.match(/^data:(image\/[a-zA-Z]+);base64,(.+)$/);
            if (match) {
                parts.push({ inlineData: { mimeType: match[1], data: match[2] } });
            } else {
                parts.push({ inlineData: { mimeType: "image/jpeg", data: imageBase64 } });
            }
        }

        // Handle multiple images array
        if (images && Array.isArray(images)) {
            images.forEach((img: string) => {
                const match = img.match(/^data:(image\/[a-zA-Z]+);base64,(.+)$/);
                if (match) {
                    parts.push({ inlineData: { mimeType: match[1], data: match[2] } });
                } else {
                    parts.push({ inlineData: { mimeType: "image/jpeg", data: img } });
                }
            });
        }

        const result = await model.generateContent(parts);
        const response = await result.response;
        const text = response.text();

        // Ensure we return valid JSON
        try {
            const jsonResponse = JSON.parse(text);
            return NextResponse.json(jsonResponse);
        } catch (e) {
            console.error("Failed to parse Gemini response as JSON:", text);
            return NextResponse.json({ raw: text }, { status: 200 }); // Return raw if parse fails, or 500
        }

    } catch (error) {
        console.error("Error processing AI request:", error);
        return NextResponse.json(
            {
                error: (error as Error).message,
                details: error
            },
            { status: 500 }
        );
    }
}
