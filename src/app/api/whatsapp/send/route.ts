import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// Configuración del microservicio de WhatsApp
const HETZNER_API_BASE = process.env.HETZNER_API_URL || 'http://87.99.137.96:3001';
const ID_SECRETO = process.env.id_secreto || 'sinf1mac_2024_!Q';

// Tipos para el estado del servicio
interface WhatsAppStatus {
    connected: boolean;
    service: string;
    version: string;
    qrAvailable: boolean;
    lastError?: string;
    lastCheck: string;
}

// Caché del estado del servicio (se refresca cada 30 segundos)
let statusCache: WhatsAppStatus | null = null;
let statusCacheTime = 0;
const STATUS_CACHE_TTL = 30000; // 30 segundos

/**
 * Obtiene el estado del microservicio de WhatsApp
 */
async function getWhatsAppStatus(): Promise<WhatsAppStatus> {
    const now = Date.now();
    
    // Usar cache si aun es valido
    if (statusCache && (now - statusCacheTime) < STATUS_CACHE_TTL) {
        return statusCache;
    }
    
    try {
        const response = await fetch(`${HETZNER_API_BASE}/`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
            signal: AbortSignal.timeout(5000)
        });
        
        if (response.ok) {
            const data = await response.json();
            statusCache = {
                connected: data.status !== 'disconnected',
                service: data.service || 'SINFIMAC WhatsApp Bridge',
                version: '2.0.0',
                qrAvailable: !!data.qrImage,
                lastCheck: new Date().toISOString()
            };
        } else {
            statusCache = {
                connected: false,
                service: 'Unknown',
                version: 'Unknown',
                qrAvailable: false,
                lastError: `HTTP ${response.status}`,
                lastCheck: new Date().toISOString()
            };
        }
    } catch (error: any) {
        statusCache = {
            connected: false,
            service: 'SINFIMAC WhatsApp Bridge',
            version: '2.0.0',
            qrAvailable: false,
            lastError: error.message,
            lastCheck: new Date().toISOString()
        };
    }
    
    statusCacheTime = now;
    return statusCache;
}

/**
 * Envía un mensaje de WhatsApp con retry automático
 */
async function sendWhatsAppMessage(phone: string, message: string, retries = 2): Promise<{ success: boolean; data?: any; error?: string }> {
    const headers = {
        'Content-Type': 'application/json',
        'x-api-key': ID_SECRETO.trim(),
        'Authorization': `Bearer ${ID_SECRETO.trim()}`
    };
    
    const payload = {
        phone: phone.trim(),
        message: message.trim()
    };
    
    for (let attempt = 0; attempt <= retries; attempt++) {
        try {
            console.log(`[WhatsApp] Intento ${attempt + 1}/${retries + 1} a ${phone}...`);
            
            const response = await fetch(`${HETZNER_API_BASE}/send`, {
                method: 'POST',
                headers,
                body: JSON.stringify(payload),
                signal: AbortSignal.timeout(15000)
            });
            
            const data = await response.json();
            
            if (response.ok && data.success !== false) {
                return { success: true, data };
            }
            
            // Si WhatsApp no está conectado, no tiene sentido reintentar
            if (data.error?.includes('no conectado') || data.error?.includes('disconnected')) {
                return { success: false, error: data.error };
            }
            
            // Si es el último intento, retornar el error
            if (attempt === retries) {
                return { success: false, error: data.error || `HTTP ${response.status}` };
            }
            
            // Esperar antes de reintentar (exponential backoff)
            await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, attempt)));
            
        } catch (error: any) {
            if (attempt === retries) {
                return { success: false, error: error.message };
            }
            await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, attempt)));
        }
    }
    
    return { success: false, error: 'Max retries exceeded' };
}

// ================================================================
// GET: Obtener estado del servicio
// ================================================================
export async function GET(request: NextRequest) {
    const url = new URL(request.url);
    const action = url.searchParams.get('action');
    
    // Endpoint de estado rapido
    if (action === 'status') {
        const status = await getWhatsAppStatus();
        return NextResponse.json(status);
    }
    
    // Endpoint de QR code
    if (action === 'qr') {
        try {
            const response = await fetch(`${HETZNER_API_BASE}/qr.png`, {
                signal: AbortSignal.timeout(10000)
            });
            
            if (response.ok) {
                const buffer = await response.arrayBuffer();
                return new NextResponse(buffer, {
                    headers: {
                        'Content-Type': 'image/png',
                        'Cache-Control': 'no-cache'
                    }
                });
            }
            
            return NextResponse.json(
                { error: 'QR code no disponible' },
                { status: 404 }
            );
        } catch (error: any) {
            return NextResponse.json(
                { error: error.message },
                { status: 500 }
            );
        }
    }
    
    // Estado por defecto
    const status = await getWhatsAppStatus();
    return NextResponse.json({
        status: 'ok',
        whatsapp: status
    });
}

// ================================================================
// POST: Enviar mensaje de WhatsApp
// ================================================================
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { phone, message, skipStatusCheck } = body;

        if (!phone || !message) {
            return NextResponse.json(
                { success: false, error: 'phone y message son campos requeridos' },
                { status: 400 }
            );
        }

        console.log(`[WhatsApp Proxy] Enviando mensaje a ${phone}...`);

        // Verificar estado del servicio (a menos que se omita)
        if (!skipStatusCheck) {
            const status = await getWhatsAppStatus();
            if (!status.connected) {
                console.warn(`[WhatsApp Proxy] Servicio desconectado. QR disponible: ${status.qrAvailable}`);
                return NextResponse.json(
                    { 
                        success: false, 
                        error: 'WhatsApp no conectado',
                        details: {
                            connected: false,
                            qrAvailable: status.qrAvailable,
                            lastError: status.lastError,
                            message: 'El servicio de WhatsApp está desconectado. Por favor escanee el código QR para reconnectar.'
                        }
                    },
                    { status: 503 } // Service Unavailable
                );
            }
        }

        // Enviar mensaje con retry
        const result = await sendWhatsAppMessage(phone, message);
        
        if (result.success) {
            return NextResponse.json({ success: true, data: result.data });
        }
        
        // Manejar errores específicos
        let statusCode = 500;
        if (result.error?.includes('no conectado') || result.error?.includes('disconnected')) {
            statusCode = 503;
        }
        
        return NextResponse.json(
            { success: false, error: result.error },
            { status: statusCode }
        );
        
    } catch (err: any) {
        console.error('[WhatsApp Proxy Error]:', err.message);
        return NextResponse.json(
            { success: false, error: err.message || 'Error al conectar con el microservicio de WhatsApp' },
            { status: 500 }
        );
    }
}
