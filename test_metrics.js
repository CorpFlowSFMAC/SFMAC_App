const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://api.sinfimac.pe';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNvcnBmbG93c2ZtYWMtaGV0em5lciIsInJvbGUiOiJhbm9uIiwiaWF0IjoxNzc4NzQ4NTY5LCJleHAiOjIwODU3MjkyOTR9.UVpFZwAHuUFXKEwZANp58HP3x-9wgFGrvVY12yoC9MI';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

const APPROVED_EXEC_STATES = ["cotizacion_aprobada", "en_ejecucion", "documentacion_enviada", "por_liquidar", "requiere_revision_admin", "ticket_cerrado"];

const toNum = (val) => {
    if (typeof val === "number") return val;
    if (typeof val === "string") return parseFloat(val.replace(/[^0-9.-]/g, "")) || 0;
    return 0;
};

const extractIGV = (ticket) => {
    if (!ticket) return 0;
    return toNum(
        ticket.montoIGV ?? 
        ticket.monto_igv ?? 
        ticket.metadata?.montoIGV ?? 
        ticket.metadata?.monto_igv ?? 
        ticket.igv ?? 
        ticket.metadata?.igv ?? 
        0
    );
};

const CONFIRMED_STATUSES = new Set([
    "pagado", "abonado", "confirmado", "auditado",
    "ejecutado", "autorizado admin", "autorizado", "aprobado",
    "transferido", "completado", "depósito", "deposito",
]);

const isConfirmedTicketCostStatus = (status) => {
    const s = (status || "").toLowerCase().trim();
    return CONFIRMED_STATUSES.has(s) || [...CONFIRMED_STATUSES].some(v => s.includes(v));
};

const OPERATING_CATEGORIES = new Set([
    "materiales", "viáticos", "viaticos", "viáticos / movilidad", "viaticos / movilidad",
    "logística", "logistica", "envíos", "envios", "movilidad", "insumos",
    "otros", "otros egresos", "compras",
]);

const LABOR_CATEGORIES = new Set([
    "mano de obra", "rescate financiero", "rescate", "honorarios", "bono",
    "adelanto", "adelanto operativo",
]);

const OPERATING_KEYWORDS = [
    "compras", "materiales", "viáticos", "viatico", "logística",
    "insumos", "movilidad", "pasajes", "taxi", "bus", "transporte",
    "envíos", "gasto operativo", "compra mat", "herramientas",
    "repuestos", "insumo", "peaje", "estacionamiento", "egreso",
    "adelanto operativo",
];

const LABOR_KEYWORDS = [
    "mano de obra", "adelanto m.o", "pago mo", "pago_mo",
    "honorarios", "pago técnico", "pago_tecnico", "rescate",
    "liquidación", "liquidacion", "saldo mo", "mo final",
    "laboral", "técnico",
];

function classifyItem(item) {
    const sid = item.specialist_id ?? "";
    const mid = item.main_technician_id ?? "";
    const cat = (item.categoria || "").toLowerCase().trim();
    const con = (item.concepto || item.tipo || "").toLowerCase();
    const text = `${cat} ${con}`;

    if (OPERATING_CATEGORIES.has(cat)) return "operating";

    if (LABOR_CATEGORIES.has(cat)) {
        if (sid && mid) return sid === mid ? "labor" : "operating";
        if (LABOR_KEYWORDS.some(k => text.includes(k))) return "labor";
    }

    if (sid && mid) {
        return sid === mid ? "labor" : "operating";
    }

    if (OPERATING_KEYWORDS.some(k => text.includes(k))) return "operating";
    if (LABOR_KEYWORDS.some(k => text.includes(k)) || con.includes("pago")) return "labor";
    return "none";
}

const isLabor = (item) => classifyItem(item) === "labor";
const isOperating = (item) => classifyItem(item) === "operating";

function calculateTicketFinances(ticket, costs = []) {
    const mainTechId =
        ticket.technician_id ?? ticket.technicians?.id ?? ticket.metadata?.tecnico?.id ?? "";

    const enriched = Array.isArray(costs)
        ? costs.map(c => (c.main_technician_id ? c : { ...c, main_technician_id: mainTechId }))
        : [];

    const pactedMO =
        [ticket.labor_cost, ticket.monto_pactado_mo, ticket.costoManoObra, ticket.monto_acordado]
            .map(toNum)
            .find(v => v > 0) ?? 0;

    const montoFinal =
        [ticket.monto_presupuesto, ticket.total_quoted_amount,
         ticket.montoFinal, ticket.montoTotalCotizado]
            .map(toNum)
            .find(v => v > 0) ?? 0;

    const igv = extractIGV(ticket);
    const montoBase = igv > 0 
        ? Math.round((montoFinal - igv) * 100) / 100 
        : (ticket.ingresos_reales ? toNum(ticket.ingresos_reales) : montoFinal);

    const normalize = (c) => ({
        ...c,
        monto: toNum(c.monto ?? c.amount ?? 0),
        fecha: c.fecha_pago ?? c.fecha ?? c.date ?? c.created_at ?? new Date().toISOString(),
    });

    const confirmed = enriched.filter(c => isConfirmedTicketCostStatus(c.estado_pago ?? c.estado));
    const confirmedN = confirmed.map(normalize);

    const laborItems = confirmedN.filter(isLabor);
    const opItems = confirmedN.filter(isOperating);

    const sum = (arr) => Math.round(arr.reduce((a, c) => a + c.monto, 0) * 100) / 100;

    const totalLaborConfirmed = sum(laborItems);
    const totalOpConfirmed = sum(opItems);

    const totalCashOut = Math.round((totalLaborConfirmed + totalOpConfirmed) * 100) / 100;
    const realLaborCost = Math.max(pactedMO, totalLaborConfirmed);
    const totalAccrualCost = Math.round((realLaborCost + totalOpConfirmed) * 100) / 100;

    const realProfitability = Math.round((montoBase - totalAccrualCost) * 100) / 100;
    const margenReal = montoBase > 0 ? Math.round((realProfitability / montoBase) * 100) : 0;

    return {
        totalVenta: montoBase,
        netIncome: montoBase,
        totalLaborConfirmed,
        totalOpConfirmed,
        realProfitability,
        margenReal,
        totalExpenses: totalCashOut
    };
}

const normalizeStateId = (id) => {
  if (!id) return 'nuevo';
  return id.toLowerCase().trim();
};

const normalizeTicket = (t) => {
  if (!t) return null;
  return {
    ...t,
    id: t.id,
    status_id: t.status_id,
    estadoId: normalizeStateId(t.status_id || t.estadoId || 'nuevo'),
    createdAt: t.created_at || t.createdAt,
  };
};

async function attachTicketCosts(tickets) {
  const ticketIds = tickets.map((t) => t.id);
  if (ticketIds.length === 0) return tickets.map(t => ({ ...t, costos: [] }));

  // Query actual costs for these tickets using REST api
  const r = await fetch(`https://api.sinfimac.pe/rest/v1/ticket_costs?ticket_id=in.(${ticketIds.join(',')})`, {
    headers: {
      'apikey': supabaseAnonKey,
      'Authorization': `Bearer ${supabaseAnonKey}`
    }
  });
  const costs = await r.json();
  const costsByTicket = new Map();
  costs.forEach(c => {
    const list = costsByTicket.get(c.ticket_id) || [];
    list.push(c);
    costsByTicket.set(c.ticket_id, list);
  });

  return tickets.map(t => ({
    ...t,
    costos: costsByTicket.get(t.id) || []
  }));
}

async function main() {
  const emailLower = 'j.portocarrero@sinfimac.pe';
  const myGestoraId = 'b804dc69-27b1-4335-8cea-bcc47557af0a';

  const { data: rawTickets, error } = await supabase
    .from('vw_tickets_strategic')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error:', error);
    return;
  }

  const normalized = rawTickets.map(normalizeTicket).filter(Boolean);
  const myTickets = normalized.filter(t => {
    const assignedGestoraId = t.gestora_id || t.metadata?.gestora_id;
    return assignedGestoraId === myGestoraId;
  });

  const tickets = await attachTicketCosts(myTickets);
  
  const now = new Date('2026-06-04T11:43:05-05:00'); // Use exactly the user time!
  console.log(`Virtual current time: ${now.toISOString()}`);
  console.log(`Tickets loaded: ${tickets.length}`);

  const isInDateRange = (dateStr) => {
    const d = new Date(dateStr);
    const diff = (now.getTime() - d.getTime()) / 86_400_000;
    console.log(`  Ticket date: ${dateStr}, diff days: ${diff}`);
    return diff < 7; // dateFilter = "week"
  };

  const periodTickets = tickets.filter(t => isInDateRange(t.createdAt || t.created_at || now.toISOString()));
  console.log(`\nPeriod tickets: ${periodTickets.length}`);

  let totalInversion = 0;
  let totalFacturacion = 0;

  periodTickets.forEach((t) => {
    const finances = calculateTicketFinances(t, t.costos || []);
    const ticketInversion = toNum(t.materials_cost) + toNum(t.labor_cost) + finances.totalOpConfirmed;
    totalInversion += ticketInversion;

    const state = normalizeStateId(t.estadoId);
    if (APPROVED_EXEC_STATES.includes(state)) {
      totalFacturacion += finances.netIncome;
    }
  });

  const totalUtilidad = totalFacturacion - totalInversion;
  console.log(`\nCalculated Metrics:`);
  console.log(`Inversion: ${totalInversion}`);
  console.log(`Facturacion: ${totalFacturacion}`);
  console.log(`Utilidad: ${totalUtilidad}`);
}

main().catch(console.error);
