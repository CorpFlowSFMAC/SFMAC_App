import { MIBANCO_BRANCHES } from "./mibanco-branches";

export interface Client {
    id: number;
    name: string;
    ruc: string;
    logo: string | null;
    address: string;
    email: string;
    phone: string;
    zone: string;
    colorAura: string;
    icon: string;
    status: string;
    totalBranches: number;
    createdAt: string;
}

export interface ClientDetail extends Client {
    branches: any[];
}

export const INITIAL_CLIENTS_DATA: { [key: string]: ClientDetail } = {
    "1": {
        id: 1,
        name: "MiBanco",
        ruc: "20382036655",
        logo: "/logo-final.png",
        address: "Av. República de Panamá 3055, San Isidro",
        email: "contacto@mibanco.com.pe",
        phone: "+51 1 315 0600",
        zone: "LIMA",
        colorAura: "#FF9100", // Cheerful Orange
        icon: "🏦",
        status: "active",
        createdAt: "2024-01-15",
        totalBranches: MIBANCO_BRANCHES.length,
        branches: MIBANCO_BRANCHES
    },
    "2": {
        id: 2,
        name: "Banco de Crédito del Perú",
        ruc: "20100047218",
        logo: null,
        address: "Calle Centenario 156, La Molina",
        email: "contacto@bcp.com.pe",
        phone: "+51 1 311 9898",
        zone: "LIMA",
        colorAura: "#4F46E5", // Energetic Indigo
        icon: "💳",
        status: "active",
        createdAt: "2024-02-10",
        totalBranches: 2,
        branches: [
            { id: 101, tipo: "Matriz", codigoTopaz: "BCP001", nombre: "Sede Principal", direccion: "Calle Centenario 156", area: "LIMA", distrito: "La Molina", provincia: "Lima", departamento: "Lima", zona: "LIMA" },
            { id: 102, tipo: "Agencia", codigoTopaz: "BCP012", nombre: "San Isidro", direccion: "Av. República 450", area: "LIMA", distrito: "San Isidro", provincia: "Lima", departamento: "Lima", zona: "LIMA" },
        ]
    },
    "3": {
        id: 3,
        name: "Interbank",
        ruc: "20100053455",
        logo: null,
        address: "Av. Carlos Villarán 140, Santa Catalina",
        email: "contacto@interbank.pe",
        phone: "+51 1 311 5000",
        zone: "LIMA",
        colorAura: "#00D084", // Motivating Green
        icon: "💰",
        status: "active",
        createdAt: "2024-03-05",
        totalBranches: 1,
        branches: [
            { id: 201, tipo: "Matriz", codigoTopaz: "IBK001", nombre: "Sede Central", direccion: "Av. Carlos Villarán 140", area: "LIMA", distrito: "Santa Catalina", provincia: "Lima", departamento: "Lima", zona: "LIMA" },
        ]
    }
};

export const INITIAL_CLIENTS: Client[] = Object.values(INITIAL_CLIENTS_DATA).map(({ branches, ...client }) => ({
    ...client,
    totalBranches: branches.length
}));
