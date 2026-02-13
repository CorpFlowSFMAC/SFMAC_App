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
        // Usamos la configuración más básica para garantizar compatibilidad entre versiones de API (v1/v1beta)
        const model = genAI.getGenerativeModel({
            model: "gemini-1.5-flash",
        });

        // Mover instrucciones al prompt para evitar errores 400 (parámetros desconocidos como systemInstruction o responseMimeType)
        const systemInstruction = \Eres un experto cotizador de mantenimiento para la empresa SINFIMAC. 
        Tu tarea es generar un DESGLOSE DETALLADO DE PARTIDAS (Cotización) en formato JSON.

        REGLAS:
        1. El precio de venta total debe respetar un margen del 55% sobre el costo técnico.
        2. Responde ÚNICAMENTE con el objeto JSON puro.
        3. No envíes bloques de código markdown (\\\json).
        
        FORMATO JSON REQUERIDO:
        { 
          "partidas": [{ "item": "string", "titulo": "string", "descripcion": "string", "unidad": "string", "cantidad": 0, "precio_unitario": 0, "precio_total": 0 }], 
          "resumen": { "costo_tecnico_total": 0, "precio_total_venta": 0, "margen_logrado": "string", "comentario_ia": "string" } 
        }\;

        const parts: any[] = [{ text: \\\\n\\nSOLICITUD DEL USUARIO:\\n\\ }];

        // Handle legacy single image field
        if (imageBase64) {
            const match = imageBase64.match(/^data:(image\\/[a-zA-Z]+);base64,(.+)$/);
            if (match) {
                parts.push({ inlineData: { mimeType: match[1], data: match[2] } });
            } else {
                parts.push({ inlineData: { mimeType: "image/jpeg", data: imageBase64 } });
            }
        }

        // Handle multiple images array
        if (images && Array.isArray(images)) {
            images.forEach((img: string) => {
                const match = img.match(/^data:(image\\/[a-zA-Z]+);base64,(.+)$/);
                if (match) {
                    parts.push({ inlineData: { mimeType: match[1], data: match[2] } });
                } else {
                    parts.push({ inlineData: { mimeType: "image/jpeg", data: img } });
                }
            });
        }

        const result = await model.generateContent(parts);
        const response = await result.response;
        let text = response.text();

        // Limpieza de posible markdown en la respuesta si la IA ignora la instrucción
        text = text.replace(/\\\json/g, "").replace(/\\\/g, "").trim();

        // Ensure we return valid JSON
        try {
            const jsonResponse = JSON.parse(text);
            return NextResponse.json(jsonResponse);
        } catch (e) {
            console.error("Failed to parse Gemini response as JSON:", text);
            return NextResponse.json({ raw: text }, { status: 200 });
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