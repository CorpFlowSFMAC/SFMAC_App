import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { phone, message } = body;

        if (!phone || !message) {
            return NextResponse.json(
                { success: false, error: 'phone y message son campos requeridos' },
                { status: 400 }
            );
        }

        // HETZNER_API_URL en producción apunta a la API de Hetzner (ej: http://87.99.137.96:3001)
        const hetznerApiBase = process.env.HETZNER_API_URL || 'http://87.99.137.96:3001';
        
        console.log(`[WhatsApp Proxy] Enviando mensaje a ${phone} a través de ${hetznerApiBase}...`);

        const response = await fetch(`${hetznerApiBase}/send`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                phone: phone.trim(),
                message: message.trim()
            }),
        });

        if (!response.ok) {
            // Intentar con una ruta alternativa por si el microservicio local expone otra estructura
            console.warn(`[WhatsApp Proxy] Falló primer intento con ${response.status}. Intentando fallback...`);
            const fallbackResponse = await fetch(`${hetznerApiBase}/api/whatsapp/send`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    phone: phone.trim(),
                    message: message.trim()
                }),
            });

            if (!fallbackResponse.ok) {
                throw new Error(`Microservicio de WhatsApp falló. Código: ${fallbackResponse.status}`);
            }

            const data = await fallbackResponse.json();
            return NextResponse.json({ success: true, data });
        }

        const data = await response.json();
        return NextResponse.json({ success: true, data });
    } catch (err: any) {
        console.error('[WhatsApp Proxy Error]:', err.message);
        // Retornamos éxito parcial o indicamos el error de forma controlada 
        // para que no detenga el flujo de caja del cliente en el frontend
        return NextResponse.json(
            { success: false, error: err.message || 'Error al conectar con el microservicio de WhatsApp' },
            { status: 500 }
        );
    }
}
