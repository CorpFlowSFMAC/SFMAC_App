import {
    FileText,
    UserCheck,
    Calendar,
    CheckSquare,
    FileSpreadsheet,
    Send,
    Clock,
    Edit,
    ThumbsUp,
    Hammer,
    Upload,
    Scale,
    DollarSign,
    CheckCircle2,
    AlertTriangle,
    XCircle,
    Ban
} from "lucide-react";

export interface TicketState {
    id: string;
    order: number;
    nombre: string;
    nombreCorto: string;
    descripcion: string;
    actor: "Gestor(a)" | "Técnico" | "Cliente" | "Gerente" | "Sistema";
    tipo: "operativo" | "pausa" | "final" | "alerta";
    color: string;
    icon: any;
    transiciones: string[]; // IDs de estados a los que puede transitar
    reglas?: string[];
    accionesRequeridas?: string[];
}

export const TICKET_STATES: TicketState[] = [
    {
        id: "borrador",
        order: 0,
        nombre: "Borrador de Triage",
        nombreCorto: "Triage",
        descripcion: "Ticket recibido vía correo, requiere validación y clasificación",
        actor: "Sistema",
        tipo: "operativo",
        color: "#94A3B8",
        icon: Clock,
        transiciones: ["nuevo"],
    },
    {
        id: "pendiente",
        order: 1,
        nombre: "Nuevo / Pendiente de Asignación",
        nombreCorto: "Nuevo",
        descripcion: "Ticket activo, pendiente de asignar técnico",
        actor: "Gestor(a)",
        tipo: "operativo",
        color: "#8B5CF6",
        icon: FileText,
        transiciones: ["tecnico_asignado"],
        accionesRequeridas: ["Asignar técnico según zona y especialidad"]
    },
    {
        id: "nuevo",
        order: 1,
        nombre: "Nuevo Ticket",
        nombreCorto: "Nuevo",
        descripcion: "Ticket nuevo activo, pendiente de asignar técnico",
        actor: "Gestor(a)",
        tipo: "operativo",
        color: "#8B5CF6",
        icon: FileText,
        transiciones: ["tecnico_asignado"]
    },
    {
        id: "tecnico_asignado",
        order: 2,
        nombre: "Técnico Asignado",
        nombreCorto: "Asignado",
        descripcion: "Asignación del técnico según zona, especialidad y tipo de servicio",
        actor: "Gestor(a)",
        tipo: "operativo",
        color: "#3B82F6",
        icon: UserCheck,
        transiciones: ["en_inspeccion"],
        reglas: ["Validación automática de compatibilidad técnico–servicio"],
        accionesRequeridas: ["Programar visita técnica"]
    },
    {
        id: "en_inspeccion",
        order: 3,
        nombre: "En Inspección / Visita Programada",
        nombreCorto: "Visita Programada",
        descripcion: "Se agenda la visita técnica",
        actor: "Gestor(a)",
        tipo: "operativo",
        color: "#0EA5E9",
        icon: Calendar,
        transiciones: ["visita_realizada"],
        reglas: [
            "Si la visita tiene costo: Genera Orden de Pago por Visita Técnica",
            "Flujo de aprobación: Gestora → Gerente"
        ]
    },
    {
        id: "visita_realizada",
        order: 4,
        nombre: "Visita Realizada",
        nombreCorto: "Visitado",
        descripcion: "El técnico evalúa el trabajo en campo",
        actor: "Técnico",
        tipo: "operativo",
        color: "#06B6D4",
        icon: CheckSquare,
        transiciones: ["en_cotizacion"],
        reglas: [
            "Define: Mano de obra, Materiales, Modalidad (a todo costo o desagregado)"
        ],
        accionesRequeridas: ["Enviar fotos", "Evidencias", "Diagnóstico", "Definir costos"]
    },
    {
        id: "en_cotizacion",
        order: 5,
        nombre: "En Cotización",
        nombreCorto: "Cotizando",
        descripcion: "Elaboración de cotización formal en Excel",
        actor: "Gestor(a)",
        tipo: "operativo",
        color: "#10B981",
        icon: FileSpreadsheet,
        transiciones: ["cotizacion_enviada"],
        reglas: [
            "Uso obligatorio de plantilla oficial",
            "Archivo Excel adjunto al ticket"
        ]
    },
    {
        id: "cotizacion_enviada",
        order: 6,
        nombre: "Cotización Enviada",
        nombreCorto: "Enviada",
        descripcion: "El presupuesto es enviado al cliente",
        actor: "Gestor(a)",
        tipo: "operativo",
        color: "#F59E0B",
        icon: Send,
        transiciones: ["cotizacion_aprobada", "ticket_rechazado"]
    },
    {
        id: "cotizacion_aprobada",
        order: 7,
        nombre: "Cotización Aprobada",
        nombreCorto: "Aprobada",
        descripcion: "El cliente aprueba el presupuesto",
        actor: "Cliente",
        tipo: "operativo",
        color: "#22C55E",
        icon: ThumbsUp,
        transiciones: ["en_ejecucion"],
        reglas: [
            "Genera Orden de Adelanto (60% del costo fijo)",
            "Flujo de aprobación financiera",
            "El cronómetro sigue activo"
        ]
    },
    {
        id: "en_ejecucion",
        order: 8,
        nombre: "En Ejecución / Trabajo en Ejecución",
        nombreCorto: "Ejecutando",
        descripcion: "El técnico ejecuta el trabajo",
        actor: "Técnico",
        tipo: "operativo",
        color: "#8B5CF6",
        icon: Hammer,
        transiciones: ["documentacion_enviada"],
        reglas: [
            "Registro obligatorio de: Compras, Facturas, Gastos operativos",
            "Adjuntos obligatorios para rendición"
        ]
    },
    {
        id: "documentacion_enviada",
        order: 9,
        nombre: "Documentación Enviada",
        nombreCorto: "Documentado",
        descripcion: "Cierre técnico del servicio",
        actor: "Técnico",
        tipo: "operativo",
        color: "#6366F1",
        icon: Upload,
        transiciones: ["por_liquidar"],
        accionesRequeridas: [
            "Fotos del trabajo",
            "Facturas",
            "Acta de conformidad",
            "Firma digital del cliente (si aplica)"
        ]
    },
    {
        id: "por_liquidar",
        order: 10,
        nombre: "Por Liquidar / Validación Final",
        nombreCorto: "Por Liquidar",
        descripcion: "Validación técnica y administrativa",
        actor: "Gestor(a)",
        tipo: "operativo",
        color: "#A855F7",
        icon: Scale,
        transiciones: ["ticket_cerrado"],
        reglas: [
            "Genera Orden de Pago del saldo pendiente",
            "Consolida gastos y costos"
        ]
    },
    {
        id: "ticket_cerrado",
        order: 12,
        nombre: "Ticket Cerrado",
        nombreCorto: "Cerrado",
        descripcion: "Proceso finalizado y enviado a facturación / franqueo",
        actor: "Sistema",
        tipo: "final",
        color: "#059669",
        icon: CheckCircle2,
        transiciones: [],
        reglas: [
            "Cálculo de: Rentabilidad, Productividad del técnico, Cumplimiento de SLA"
        ]
    },
    {
        id: "requiere_revision_admin",
        order: 11,
        nombre: "Requiere Revisión de Administrador",
        nombreCorto: "Revisión Admin",
        descripcion: "Solicitud de liquidación o gasto excede el tope pactado. Requiere auditoría de Gerencia.",
        actor: "Gerente",
        tipo: "alerta",
        color: "#EF4444",
        icon: AlertTriangle,
        transiciones: ["por_liquidar", "ticket_cerrado"],
        accionesRequeridas: ["Validar justificación de exceso de presupuesto"]
    },
    {
        id: "vencido",
        order: 13,
        nombre: "Vencido",
        nombreCorto: "Vencido",
        descripcion: "Estado automático si se superan las 72h hábiles",
        actor: "Sistema",
        tipo: "alerta",
        color: "#DC2626",
        icon: AlertTriangle,
        transiciones: [],
        reglas: [
            "Penaliza KPIs",
            "Marca alerta crítica"
        ]
    },
    {
        id: "ticket_rechazado",
        order: 14,
        nombre: "Ticket Rechazado",
        nombreCorto: "Rechazado",
        descripcion: "El cliente no aprueba la cotización",
        actor: "Cliente",
        tipo: "final",
        color: "#EF4444",
        icon: XCircle,
        transiciones: []
    },
    {
        id: "ticket_cancelado",
        order: 15,
        nombre: "Ticket Cancelado",
        nombreCorto: "Cancelado",
        descripcion: "Cancelación por error, duplicado u otra causa administrativa",
        actor: "Gestor(a)",
        tipo: "final",
        color: "#6B7280",
        icon: Ban,
        transiciones: []
    }
];

// Helper functions
export const getStateById = (id: string): TicketState | undefined => {
    return TICKET_STATES.find(state => state.id === id);
};

export const getNextStates = (currentStateId: string): TicketState[] => {
    const currentState = getStateById(currentStateId);
    if (!currentState) return [];

    return currentState.transiciones
        .map(id => getStateById(id))
        .filter(Boolean) as TicketState[];
};

export const canTransitionTo = (fromStateId: string, toStateId: string): boolean => {
    const fromState = getStateById(fromStateId);
    if (!fromState) return false;

    return fromState.transiciones.includes(toStateId);
};

export const getStateColor = (stateId: string): string => {
    const state = getStateById(stateId);
    return state?.color || "#6B7280";
};

export const getStateIcon = (stateId: string): any => {
    const state = getStateById(stateId);
    return state?.icon || FileText;
};

/**
 * Normaliza los IDs de estado para asegurar compatibilidad con datos antiguos o numéricos
 */
export const normalizeStateId = (stateId: any): string => {
    if (!stateId) return "nuevo";

    const sid = String(stateId).toLowerCase().trim();

    // Mapeos de compatibilidad (Numéricos -> String)
    const mapping: { [key: string]: string } = {
        "1": "nuevo",
        "2": "tecnico_asignado",
        "3": "en_inspeccion",
        "4": "visita_realizada",
        "5": "en_cotizacion",
        "6": "cotizacion_enviada",
        "7": "cotizacion_aprobada",
        "8": "en_ejecucion",
        "9": "documentacion_enviada",
        "10": "por_liquidar",
        "11": "requiere_revision_admin",
        "12": "ticket_cerrado",
        "13": "vencido",
        "14": "ticket_rechazado",
        "15": "ticket_cancelado",
        "borrador": "borrador",
        "pendiente": "pendiente",
        "nuevo": "nuevo",
        "pend": "pendiente",
        "cerrado": "ticket_cerrado"
    };

    return mapping[sid] || sid;
};

export const TICKET_STATE_ORDER: Record<string, number> = {
    'borrador': 0,
    'pendiente': 1,
    'nuevo': 1,
    'tecnico_asignado': 2,
    'esperando_pago_visita': 2,
    'en_inspeccion': 3,
    'visita_realizada': 4,
    'en_cotizacion': 5,
    'cotizacion_enviada': 6,
    'cotizacion_aprobada': 7,
    'en_ejecucion': 8,
    'documentacion_enviada': 9,
    'requiere_revision_admin': 10,
    'por_liquidar': 11,
    'ticket_cerrado': 12,
    'vencido': 13,
    'ticket_rechazado': 14,
    'ticket_cancelado': 15
};
