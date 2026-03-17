// 🔧 TIPOS DE SERVICIO CENTRALIZADOS CON ICONOS PROFESIONALES
// Este archivo es la fuente única de verdad para todos los tipos de servicio
// Usado por: módulo de técnicos, creación de tickets, asignación automática

import {
    Zap, Wrench, Droplet, Hammer, PaintBucket, Snowflake,
    Glasses, Flame, ClipboardCheck, Lightbulb, Cog, Drill,
    Ruler, ShieldCheck, type LucideIcon
} from "lucide-react";

export interface ServiceType {
    id: string;
    nombre: string;
    nombreCorto: string; // Para técnicos (ej: "ELECTRICIDAD")
    icon: LucideIcon;
    color: string;
    descripcion?: string;
}

// 🎨 TIPOS DE SERVICIO (Single Source of Truth)
export const SERVICE_TYPES: ServiceType[] = [
    {
        id: "electricidad",
        nombre: "Electricidad",
        nombreCorto: "ELECTRICIDAD",
        icon: Zap,
        color: "#F59E0B", // Ámbar profesional
        descripcion: "Instalaciones eléctricas, tableros, cableado, iluminación"
    },
    {
        id: "carpinteria",
        nombre: "Carpintería",
        nombreCorto: "CARPINTERÍA",
        icon: Hammer,
        color: "#92400E", // Marrón profesional
        descripcion: "Muebles, puertas, ventanas, estructuras de madera"
    },
    {
        id: "gasfiteria",
        nombre: "Gasfitería",
        nombreCorto: "GASFITERÍA",
        icon: Droplet,
        color: "#1E40AF", // Azul oscuro profesional
        descripcion: "Instalaciones sanitarias, tuberías, desagües"
    },
    {
        id: "albanileria",
        nombre: "Albañilería",
        nombreCorto: "ALBAÑILERÍA",
        icon: Drill,
        color: "#7C2D12", // Terracota profesional
        descripcion: "Construcción, revestimientos, tabiquería, acabados"
    },
    {
        id: "vidrio",
        nombre: "Vidrio",
        nombreCorto: "VIDRIO",
        icon: Glasses,
        color: "#0369A1", // Azul cielo profesional
        descripcion: "Instalación y reparación de vidrios, ventanas, mamparas"
    },
    {
        id: "pintura",
        nombre: "Pintura",
        nombreCorto: "PINTURA",
        icon: PaintBucket,
        color: "#DC2626", // Rojo profesional
        descripcion: "Pintado de paredes, techos, acabados decorativos"
    },
    {
        id: "refrigeracion",
        nombre: "Refrigeración",
        nombreCorto: "REFRIGERACIÓN",
        icon: Snowflake,
        color: "#0891B2", // Cyan profesional
        descripcion: "Cámaras frigoríficas, congeladoras, mantenimiento"
    },
    {
        id: "soldadura",
        nombre: "Soldadura",
        nombreCorto: "SOLDADURA",
        icon: Flame,
        color: "#EA580C", // Naranja fuego profesional
        descripcion: "Soldadura de estructuras metálicas, tuberías, reparaciones"
    },
    {
        id: "pre-post-itse",
        nombre: "Pre - Post ITSE",
        nombreCorto: "PRE - POST ITSE",
        icon: ShieldCheck,
        color: "#8B5CF6", // Violeta profesional
        descripcion: "Evaluación previa y posterior a la Inspección Técnica de Seguridad en Edificaciones"
    },
    {
        id: "visita-tecnica",
        nombre: "Visita Técnica",
        nombreCorto: "VISITA TÉCNICA",
        icon: ClipboardCheck,
        color: "#059669", // Verde profesional
        descripcion: "Diagnóstico, inspección, evaluación de proyectos"
    }
];

// 🔄 ESTADOS DEL FLUJO KANBAN
export const FLUJO_ESTADOS = [
    {
        id: 1,
        nombre: "Nuevo",
        nombreCorto: "NUEVO",
        icon: Lightbulb,
        color: "#7C3AED",
        descripcion: "Ticket recién creado, pendiente de asignación"
    },
    {
        id: 2,
        nombre: "Asignado",
        nombreCorto: "ASIGNADO",
        icon: Wrench,
        color: "#2563EB",
        descripcion: "Técnico asignado, pendiente de inicio"
    },
    {
        id: 3,
        nombre: "En Camino",
        nombreCorto: "EN CAMINO",
        icon: Zap,
        color: "#F59E0B",
        descripcion: "Técnico se dirige a la ubicación"
    },
    {
        id: 4,
        nombre: "En Sitio",
        nombreCorto: "EN SITIO",
        icon: Hammer,
        color: "#DC2626",
        descripcion: "Técnico en la ubicación, trabajando"
    },
    {
        id: 5,
        nombre: "En Revisión",
        nombreCorto: "EN REVISIÓN",
        icon: Ruler,
        color: "#9333EA",
        descripcion: "Trabajo completado, en revisión de calidad"
    },
    {
        id: 6,
        nombre: "Completado",
        nombreCorto: "COMPLETADO",
        icon: Wrench,
        color: "#059669",
        descripcion: "Ticket cerrado exitosamente"
    }
];

// 🔍 HELPER FUNCTIONS
export const getServiceByNombreCorto = (nombreCorto: string): ServiceType | undefined => {
    return SERVICE_TYPES.find(s => s.nombreCorto === nombreCorto);
};

export const getServiceById = (id: string): ServiceType | undefined => {
    return SERVICE_TYPES.find(s => s.id === id);
};

export const getServiceIcon = (nombreCorto: string): LucideIcon => {
    const service = getServiceByNombreCorto(nombreCorto);
    return service?.icon || Wrench;
};

export const getServiceColor = (nombreCorto: string): string => {
    const service = getServiceByNombreCorto(nombreCorto);
    return service?.color || "#6B7280";
};

export const getEstadoById = (id: number) => {
    return FLUJO_ESTADOS.find(e => e.id === id);
};

export const getEstadoByNombre = (nombre: string) => {
    return FLUJO_ESTADOS.find(e => e.nombre === nombre);
};

// 📊 Para compatibilidad con módulo de técnicos
export const SKILL_ICONS: { [key: string]: LucideIcon } = SERVICE_TYPES.reduce((acc, service) => {
    acc[service.nombreCorto] = service.icon;
    return acc;
}, {} as { [key: string]: LucideIcon });

export const SKILL_COLORS: { [key: string]: string } = SERVICE_TYPES.reduce((acc, service) => {
    acc[service.nombreCorto] = service.color;
    return acc;
}, {} as { [key: string]: string });

// 🎯 Para wizards y formularios
export const getAvailableServices = (): ServiceType[] => {
    return SERVICE_TYPES;
};

// 🔧 Para asignación automática de técnicos
export const findTechniciansByService = (nombreCorto: string, technicians: any[]): any[] => {
    return technicians.filter(tech =>
        tech.especialidades.includes(nombreCorto) &&
        tech.estado === "Activo"
    );
};

// 🎨 Para UI: obtener todos los servicios como opciones
export const getServicesAsOptions = () => {
    return SERVICE_TYPES.map(s => ({
        value: s.nombreCorto,
        label: s.nombre,
        icon: s.icon,
        color: s.color
    }));
};

// 📋 Validar si un servicio existe
export const isValidService = (nombreCorto: string): boolean => {
    return SERVICE_TYPES.some(s => s.nombreCorto === nombreCorto);
};
