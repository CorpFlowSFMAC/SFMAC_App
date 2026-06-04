const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://api.sinfimac.pe';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNvcnBmbG93c2ZtYWMtaGV0em5lciIsInJvbGUiOiJhbm9uIiwiaWF0IjoxNzc4NzQ4NTY5LCJleHAiOjIwODU3MjkyOTR9.UVpFZwAHuUFXKEwZANp58HP3x-9wgFGrvVY12yoC9MI';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

const gestorasAPI = {
  async getAll() {
    const { data, error } = await supabase.from('gestoras').select('*');
    if (error) throw error;
    return data || [];
  }
};

const ticketsAPI = {
  async getSummaryAll() {
    const { data, error } = await supabase.from('vw_tickets_strategic').select('*').order('created_at', { ascending: false }).limit(300);
    if (error) throw error;
    return data || [];
  }
};

const normalizeStateId = (id) => {
  if (!id) return 'nuevo';
  return id.toLowerCase().trim();
};

const normalizeTicket = (t) => {
    if (!t) return null;

    let realMetadata = t.metadata || {};
    while (realMetadata.metadata && typeof realMetadata.metadata === "object") {
        realMetadata = { ...realMetadata, ...realMetadata.metadata };
        delete realMetadata.metadata;
    }

    const clienteRaw = t.clients || t.cliente || realMetadata.cliente;
    const cliente = clienteRaw
        ? {
            ...clienteRaw,
            nombre: clienteRaw.name || clienteRaw.nombre || "Sin Nombre",
            color: clienteRaw.color_aura || clienteRaw.color || "#8B5CF6",
            logo: clienteRaw.logo || realMetadata.logo || null,
        }
        : null;

    const sedeRaw = t.branch_offices || t.sede || realMetadata.sede;
    const sede = sedeRaw
        ? {
            ...sedeRaw,
            nombre: sedeRaw.name || sedeRaw.nombre || "Sin Sede",
            direccion: sedeRaw.address || sedeRaw.direccion || realMetadata.address || "Sin dirección",
            zona: sedeRaw.zone || sedeRaw.zona || "PAN PERÚ",
            departamento: sedeRaw.departamento || realMetadata.departamento,
            provincia: sedeRaw.provincia || realMetadata.provincia,
            distrito: sedeRaw.distrito || realMetadata.distrito,
        }
        : null;

    let tecnicoRaw = t.technicians || t.tecnico || realMetadata.tecnico;
    if (Array.isArray(tecnicoRaw)) tecnicoRaw = tecnicoRaw[0];

    let tecnico = null;
    if (tecnicoRaw) {
        const firstName = tecnicoRaw.first_name || tecnicoRaw.nombre || "";
        const lastName = tecnicoRaw.last_name || tecnicoRaw.apellido || "";
        const fullName =
            tecnicoRaw.name ||
            (firstName && lastName
                ? `${firstName} ${lastName}`.trim()
                : firstName || lastName);
        tecnico = {
            ...tecnicoRaw,
            id: tecnicoRaw.id,
            nombre: fullName || "Sin Técnico",
        };
    }

    const safeMetadata = { ...realMetadata };
    delete safeMetadata.status_id;
    delete safeMetadata.id;
    delete safeMetadata.labor_cost;
    delete safeMetadata.materials_cost;
    delete safeMetadata.visit_cost;
    delete safeMetadata.total_quoted_amount;

    return {
        ...t,
        ...safeMetadata,
        id: t.id,
        status_id: t.status_id,
        estadoId: normalizeStateId(
            t.status_id || t.estadoId || realMetadata.estadoId || "nuevo"
        ),
        descripcionProblema:
            t.description ||
            t.descripcionProblema ||
            realMetadata.descripcionProblema ||
            "",
        numeroTicketCliente:
            t.client_ticket_number ||
            t.numeroTicketCliente ||
            realMetadata.numeroTicketCliente ||
            (t.id ? `TK-${t.id.slice(-8).toUpperCase()}` : ""),
        fechaCreacion:
            t.created_at || t.fechaCreacion || realMetadata.fechaCreacion,
        createdAt:
            t.created_at || t.createdAt || t.fechaCreacion || realMetadata.createdAt,
        costoManoObra: Number(t.labor_cost || t.costoManoObra || realMetadata.costoManoObra || 0),
        costoMateriales: Number(t.materials_cost || t.costoMateriales || realMetadata.costoMateriales || 0),
        costoVisita: Number(t.visit_cost || t.costoVisita || realMetadata.costoVisita || 0),
        montoFinal: Number(t.total_quoted_amount || t.montoFinal || realMetadata.montoFinal || 0),
        cliente,
        sede,
        tecnico,
        tipoServicio: t.service_type || t.tipoServicio || realMetadata.tipoServicio,
    };
};

async function filterTicketsForActiveGestor(ticketsList, userEmail) {
    try {
        if (!userEmail) return ticketsList;

        let userRole = "GESTORA"; // Simulating gestor

        if (userRole === "ADMIN" || userRole === "SUPERADMIN") {
            return ticketsList;
        }

        const emailLower = userEmail.toLowerCase();
        
        const allGestoras = await gestorasAPI.getAll().catch(() => []);
        const myGestora = (allGestoras || []).find(g => g.email?.toLowerCase() === emailLower);
        const myGestoraId = myGestora?.id;

        console.log(`Filtering for email: ${userEmail}`);
        console.log(`Found myGestoraId: ${myGestoraId}`);

        return ticketsList.filter((t) => {
            // Log for first ticket to see fields
            if (t.gestora?.email && t.gestora.email.toLowerCase() === emailLower) {
                return true;
            }
            if (t.gestoras?.email && t.gestoras.email.toLowerCase() === emailLower) {
                return true;
            }
            if (myGestoraId) {
                const assignedGestoraId = t.gestora_id || t.metadata?.gestora_id;
                if (assignedGestoraId === myGestoraId) return true;

                if (t.branch_offices?.gestora_asignada_id === myGestoraId) return true;
                if (t.branch_offices?.zonas?.gestora_asignada_id === myGestoraId) return true;
                if (t.clients?.gestora_asignada_id === myGestoraId ||
                    t.branch_offices?.clients?.gestora_asignada_id === myGestoraId) {
                    return true;
                }
            }
            return false;
        });
    } catch (e) {
        console.error('[filterTicketsForActiveGestor] Error filtering:', e);
        return ticketsList;
    }
}

async function main() {
  const email = 'j.portocarrero@sinfimac.pe';
  const rawTickets = await ticketsAPI.getSummaryAll();
  const normalized = rawTickets.map(normalizeTicket).filter(Boolean);
  
  console.log(`Total normalized tickets: ${normalized.length}`);
  
  // Test filter
  const filtered = await filterTicketsForActiveGestor(normalized, email);
  console.log(`Filtered tickets count: ${filtered.length}`);
  
  if (filtered.length > 0) {
    console.log('Sample filtered ticket:', JSON.stringify(filtered[0], null, 2));
  }
}

main().catch(console.error);
