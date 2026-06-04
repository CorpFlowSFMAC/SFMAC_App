const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

function loadEnv(file) {
  const filePath = path.join(__dirname, '..', file);
  if (!fs.existsSync(filePath)) return;
  const content = fs.readFileSync(filePath, 'utf8');
  content.split('\n').forEach(line => {
    const match = line.match(/^\s*([^#=]+)\s*=\s*(.*)\s*$/);
    if (match) {
      const key = match[1].trim();
      let val = match[2].trim();
      if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
      if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1);
      process.env[key] = val;
    }
  });
}

loadEnv('.env');
loadEnv('.env.local');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://api.sinfimac.pe';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const client = createClient(supabaseUrl, supabaseAnonKey);

const normalizeStateId = (id) => {
  if (!id) return 'nuevo';
  return id.toLowerCase().trim();
};

const round2 = (num) => Math.round((num + Number.EPSILON) * 100) / 100;

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
      banco: tecnicoRaw.bank_name || tecnicoRaw.banco || "---",
      numeroCuenta:
        tecnicoRaw.account_number || tecnicoRaw.numeroCuenta || "---",
      cci: tecnicoRaw.cci || tecnicoRaw.cci_number || "---",
      yape:
        tecnicoRaw.yape_number || tecnicoRaw.yape || tecnicoRaw.phone,
      plin:
        tecnicoRaw.plin_number || tecnicoRaw.plin || tecnicoRaw.phone,
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
    costoManoObra: round2(
      Number(t.labor_cost || t.costoManoObra || realMetadata.costoManoObra || 0)
    ),
    costoMateriales: round2(
      Number(t.materials_cost ||
      t.costoMateriales ||
      realMetadata.costoMateriales ||
      0)
    ),
    costoVisita: round2(
      Number(t.visit_cost || t.costoVisita || realMetadata.costoVisita || 0)
    ),
    montoFinal: round2(
      Number(t.total_quoted_amount ||
      t.montoFinal ||
      realMetadata.montoFinal ||
      0)
    ),
    cliente,
    sede,
    tecnico,
    tipoServicio:
      t.service_type || t.tipoServicio || realMetadata.tipoServicio,
    creadoPor: t.created_by || t.creadoPor || realMetadata.creadoPor,
    diagnostico:
      t.diagnosis || t.diagnostico || realMetadata.diagnostico,
  };
};

async function main() {
  const { data, error } = await client
    .from('vw_tickets_strategic')
    .select('*')
    .limit(1);

  if (error) {
    console.error(error);
    return;
  }

  const raw = data[0];
  const normalized = normalizeTicket(raw);
  console.log('--- RAW TICKET GESTORA INFO ---');
  console.log('raw.gestora:', raw.gestora);
  console.log('raw.gestoras:', raw.gestoras);
  console.log('raw.gestora_id:', raw.gestora_id);
  
  console.log('\n--- NORMALIZED TICKET GESTORA INFO ---');
  console.log('normalized.gestora:', normalized.gestora);
  console.log('normalized.gestoras:', normalized.gestoras);
  console.log('normalized.gestora_id:', normalized.gestora_id);
}

main().catch(console.error);
