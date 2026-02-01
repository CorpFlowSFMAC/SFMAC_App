// Basic structure of Peru Departments, Provinces, and Districts
// In a real app this would be a larger JSON or API call. 
// We will include full departments and a few key provinces/districts for demo.

export const PERU_LOCATIONS: Record<string, { provinces: Record<string, string[]> }> = {
    "Amazonas": {
        provinces: {
            "Chachapoyas": ["Chachapoyas", "Asunción", "Balsas", "Cheto"],
            "Bagua": ["Bagua", "Aramango", "Copallin"]
        }
    },
    "Áncash": {
        provinces: {
            "Huaraz": ["Huaraz", "Independencia", "Jangas"],
            "Santa": ["Chimbote", "Nuevo Chimbote", "Coishco"]
        }
    },
    "Apurímac": {
        provinces: {
            "Abancay": ["Abancay", "Chacoche", "Circa"],
            "Andahuaylas": ["Andahuaylas", "Andarapa"]
        }
    },
    "Arequipa": {
        provinces: {
            "Arequipa": ["Arequipa", "Alto Selva Alegre", "Cayma", "Cerro Colorado", "Yanahuara"],
            "Camaná": ["Camaná", "José María Quimper"],
            "Caylloma": ["Chivay", "Majes"]
        }
    },
    "Ayacucho": { provinces: { "Huamanga": ["Ayacucho", "Acocro"] } },
    "Cajamarca": { provinces: { "Cajamarca": ["Cajamarca", "Baños del Inca"] } },
    "Callao": { provinces: { "Callao": ["Callao", "Bellavista", "Carmen de la Legua", "La Perla", "La Punta", "Ventanilla", "Mi Perú"] } },
    "Cusco": {
        provinces: {
            "Cusco": ["Cusco", "San Jerónimo", "San Sebastián", "Santiago", "Wanchaq"],
            "Urubamba": ["Urubamba", "Machupicchu"]
        }
    },
    "Huancavelica": { provinces: { "Huancavelica": ["Huancavelica", "Acobamba"] } },
    "Huánuco": { provinces: { "Huánuco": ["Huánuco", "Amarilis", "Pillco Marca"] } },
    "Ica": { provinces: { "Ica": ["Ica", "Parcona"], "Pisco": ["Pisco", "San Andrés"] } },
    "Junín": { provinces: { "Huancayo": ["Huancayo", "El Tambo", "Chilca"] } },
    "La Libertad": {
        provinces: {
            "Trujillo": ["Trujillo", "El Porvenir", "Florencia de Mora", "La Esperanza", "Víctor Larco Herrera"],
            "Pacasmayo": ["Pacasmayo", "San Pedro de Lloc"]
        }
    },
    "Lambayeque": { provinces: { "Chiclayo": ["Chiclayo", "José Leonardo Ortiz", "La Victoria"] } },
    "Lima": {
        provinces: {
            "Lima": [
                "Cercado de Lima", "Ate", "Barranco", "Breña", "Chorrillos", "Comas",
                "El Agustino", "Independencia", "Jesús María", "La Molina", "La Victoria",
                "Lince", "Los Olivos", "Lurigancho", "Lurín", "Magdalena del Mar",
                "Miraflores", "Pachacámac", "Pucusana", "Pueblo Libre", "Puente Piedra",
                "Punta Hermosa", "Punta Negra", "Rímac", "San Bartolo", "San Borja",
                "San Isidro", "San Juan de Lurigancho", "San Juan de Miraflores",
                "San Luis", "San Martín de Porres", "San Miguel", "Santa Anita",
                "Santa María del Mar", "Santa Rosa", "Santiago de Surco", "Surquillo",
                "Villa El Salvador", "Villa María del Triunfo"
            ],
            "Barranca": ["Barranca", "Paramonga"],
            "Cañete": ["San Vicente de Cañete", "Asia", "Mala"],
            "Huaral": ["Huaral", "Chancay"],
            "Huaura": ["Huacho", "Huaura"]
        }
    },
    "Loreto": { provinces: { "Maynas": ["Iquitos", "Belén", "Punchana", "San Juan Bautista"] } },
    "Madre de Dios": { provinces: { "Tambopata": ["Puerto Maldonado"] } },
    "Moquegua": { provinces: { "Mariscal Nieto": ["Moquegua"] } },
    "Pasco": { provinces: { "Pasco": ["Chaupimarca"] } },
    "Piura": {
        provinces: {
            "Piura": ["Piura", "Castilla", "Veintiséis de Octubre"],
            "Sullana": ["Sullana"],
            "Talara": ["Pariñas (Talara)"]
        }
    },
    "Puno": { provinces: { "Puno": ["Puno"], "San Román": ["Juliaca"] } },
    "San Martín": { provinces: { "Moyobamba": ["Moyobamba"], "San Martín": ["Tarapoto"] } },
    "Tacna": { provinces: { "Tacna": ["Tacna", "Coronel Gregorio Albarracín Lanchipa"] } },
    "Tumbes": { provinces: { "Tumbes": ["Tumbes"] } },
    "Ucayali": { provinces: { "Coronel Portillo": ["Callería (Pucallpa)", "Manantay", "Yarinacocha"] } }
};

export function getDepartments() {
    return Object.keys(PERU_LOCATIONS).sort();
}

export function getProvinces(department: string) {
    if (!PERU_LOCATIONS[department]) return [];
    return Object.keys(PERU_LOCATIONS[department].provinces).sort();
}

export function getDistricts(department: string, province: string) {
    if (!PERU_LOCATIONS[department] || !PERU_LOCATIONS[department].provinces[province]) return [];
    return PERU_LOCATIONS[department].provinces[province].sort();
}
