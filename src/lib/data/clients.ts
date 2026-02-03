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
    }
};

export const INITIAL_CLIENTS: Client[] = Object.values(INITIAL_CLIENTS_DATA).map(({ branches, ...client }) => ({
    ...client,
    totalBranches: branches.length
}));
