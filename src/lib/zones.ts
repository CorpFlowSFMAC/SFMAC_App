/**
 * SISTEMA DE ZONAS ESTANDARIZADO
 * Este archivo define las zonas geográficas que se usarán en toda la aplicación
 * para relacionar sedes de clientes con técnicos
 */

export interface Zone {
    id: string;           // ID único para programación
    label: string;        // Nombre corto para mostrar
    fullName: string;     // Nombre completo
    icon: string;         // Emoji para visualización
    color: string;        // Color distintivo
    departamentos: string[]; // Departamentos que pertenecen a esta zona
}

export const ZONES: Zone[] = [
    {
        id: "LIMA",
        label: "Lima",
        fullName: "Lima Metropolitana",
        icon: "🏙️",
        color: "#10B981",
        departamentos: ["Lima"]
    },
    {
        id: "NORTE",
        label: "Norte",
        fullName: "Zona Norte",
        icon: "🏔️",
        color: "#3B82F6",
        departamentos: [
            "Tumbes",
            "Piura",
            "Lambayeque",
            "La Libertad",
            "Cajamarca",
            "Amazonas"
        ]
    },
    {
        id: "SUR",
        label: "Sur",
        fullName: "Zona Sur",
        icon: "🌄",
        color: "#8B5CF6",
        departamentos: [
            "Arequipa",
            "Moquegua",
            "Tacna",
            "Puno",
            "Cusco",
            "Apurímac"
        ]
    },
    {
        id: "CENTRO",
        label: "Centro",
        fullName: "Zona Centro",
        icon: "🗺️",
        color: "#EC4899",
        departamentos: [
            "Ica",
            "Huancavelica",
            "Junín",
            "Pasco",
            "Huánuco",
            "Ancash"
        ]
    },
    {
        id: "ORIENTE",
        label: "Oriente",
        fullName: "Zona Oriente",
        icon: "🌴",
        color: "#F59E0B",
        departamentos: [
            "Loreto",
            "San Martín",
            "Ucayali",
            "Madre de Dios"
        ]
    }
];

/**
 * Mapa para convertir de zonas antiguas a nuevas
 */
export const ZONE_MIGRATION_MAP: Record<string, string> = {
    // Zonas antiguas de técnicos
    "ZONA NORTE": "NORTE",
    "ZONA SUR": "SUR",
    "ZONA CENTRO": "CENTRO",
    "ZONA ORIENTE": "ORIENTE",
    "LIMA METROPOLITANA": "LIMA",

    // Zonas antiguas de clientes
    "Norte": "NORTE",
    "Sur": "SUR",
    "Centro": "CENTRO",
    "Oriente": "ORIENTE",
    "Lima Centro": "LIMA",
    "Lima": "LIMA",
    "LIMA_METROPOLITANA": "LIMA"
};

/**
 * Normaliza una zona antigua al nuevo formato
 */
export function normalizeZone(oldZone: string | undefined): string {
    if (!oldZone) return "LIMA"; // Default

    // Si ya está en el formato nuevo, retornar
    if (ZONES.find(z => z.id === oldZone)) {
        return oldZone;
    }

    // Buscar en el mapa de migración
    return ZONE_MIGRATION_MAP[oldZone] || "LIMA";
}

/**
 * Obtiene la zona basada en el departamento
 */
export function getZoneByDepartamento(departamento: string): string {
    const zone = ZONES.find(z =>
        z.departamentos.some(d =>
            d.toLowerCase() === departamento.toLowerCase()
        )
    );

    return zone?.id || "LIMA";
}

/**
 * Obtiene el objeto Zone completo por ID
 */
export function getZoneById(zoneId: string): Zone | undefined {
    return ZONES.find(z => z.id === zoneId);
}

/**
 * Obtiene todas las zonas
 */
export function getAllZones(): Zone[] {
    return ZONES;
}

/**
 * Obtiene el nombre completo de una zona
 */
export function getZoneFullName(zoneId: string): string {
    const zone = getZoneById(zoneId);
    return zone?.fullName || zoneId;
}

/**
 * Obtiene el color de una zona
 */
export function getZoneColor(zoneId: string): string {
    const zone = getZoneById(zoneId);
    return zone?.color || "#9CA3AF";
}

/**
 * Verifica si dos zonas son compatibles
 */
export function areZonesCompatible(zone1: string, zone2: string): boolean {
    const normalizedZone1 = normalizeZone(zone1);
    const normalizedZone2 = normalizeZone(zone2);
    return normalizedZone1 === normalizedZone2;
}
