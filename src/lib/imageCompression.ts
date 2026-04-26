import imageCompression from 'browser-image-compression';

export interface CompressionOptions {
    maxSizeMB?: number;
    maxWidthOrHeight?: number;
    useWebWorker?: boolean;
    initialQuality?: number;
}

const defaultOptions: CompressionOptions = {
    maxSizeMB: 0.8, // 800 KB max
    maxWidthOrHeight: 1920,
    useWebWorker: true,
    initialQuality: 0.8
};

/**
 * Comprime una imagen antes de subirla al servidor.
 * @param file Archivo original
 * @param options Opciones de compresión personalizadas
 * @returns Archivo comprimido
 */
export async function compressImage(file: File, options: CompressionOptions = {}): Promise<File> {
    if (!file.type.startsWith('image/')) {
        return file; // No es una imagen, devolver original
    }

    // No comprimir si ya es suficientemente pequeña (e.g. < 500KB)
    if (file.size < 500 * 1024) {
        return file;
    }

    try {
        const finalOptions = { ...defaultOptions, ...options };
        const compressedBlob = await imageCompression(file, finalOptions);
        
        // Mantener el nombre original pero asegurar que sea un File object
        return new File([compressedBlob], file.name, {
            type: compressedBlob.type,
            lastModified: Date.now(),
        });
    } catch (error) {
        console.error('Error comprimiendo imagen:', error);
        return file; // Si falla, devolver original por seguridad
    }
}
