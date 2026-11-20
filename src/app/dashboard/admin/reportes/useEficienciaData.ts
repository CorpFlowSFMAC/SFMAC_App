"use client";

/**
 * useEficienciaData — Hook de datos para Reportes de Eficiencia V2
 *
 * Estrategia: Fetcha tickets cerrados + ticket_costs en 2 queries independientes
 * y los une en el cliente. Usa React Query con staleTime de 5 minutos.
 *
 * FUENTES DE VERDAD:
 *   - Ingreso Neto (sin IGV): metadata.ingresos_reales || metadata.montoSubtotal || total_quoted_amount
 *   - Inversión Real: SUM(ticket_costs.monto) WHERE estado_pago = 'pagado'
 *   - Gestora: tickets.gestora_id → gestoras.name
 *   - Mes: tickets.closure_date (AAAA-MM)
 */

import { useQuery } from "@tanstack/react-query";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://api.sinfimac.pe";
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

// ── Tipos ─────────────────────────────────────────────────────────────────────

export interface GestoraMes {
  mesKey: string;          // "2026-11"
  mesLabel: string;        // "Nov 2026"
  gestoraId: string;
  gestoraName: string;
  ticketsCerrados: number;
  ingresoNeto: number;     // Sin IGV
  inversion: number;       // ticket_costs pagados
  utilidadNeta: number;    // ingresoNeto - inversion
  margenPct: number;       // 0–100
  horasPromedio: number;   // promedio de (closure_date - created_at) en horas
}

export interface GestoraSummary {
  gestoraId: string;
  gestoraName: string;
  costoLaboralMensual: number;
  totalTickets: number;
  totalIngreso: number;
  totalInversion: number;
  totalUtilidad: number;
  margenPct: number;
  ticketPromedio: number;
  meses: GestoraMes[];
}

export interface EficienciaData {
  gestoras: GestoraSummary[];
  mesesDisponibles: string[];  // sorted asc "YYYY-MM"
  mesActual: string;
  raw: {
    tickets: any[];
    costs: any[];
    gestorasInfo: any[];
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const MONTH_LABELS: Record<string, string> = {
  "01": "Ene", "02": "Feb", "03": "Mar", "04": "Abr",
  "05": "May", "06": "Jun", "07": "Jul", "08": "Ago",
  "09": "Set", "10": "Oct", "11": "Nov", "12": "Dic",
};

function mesLabel(key: string): string {
  const [year, month] = key.split("-");
  return `${MONTH_LABELS[month] || month} ${year}`;
}

function safeFloat(val: any): number {
  if (typeof val === "number") return val;
  if (typeof val === "string") return parseFloat(val.replace(/[^0-9.-]/g, "")) || 0;
  return 0;
}

/** Extrae ingreso neto (sin IGV) de un ticket normalizado */
function extractIngresoNeto(ticket: any): number {
  const meta = ticket.metadata || {};
  // Prioridad: ingresos_reales > montoSubtotal > total_quoted_amount / 1.18
  const direct =
    safeFloat(meta.ingresos_reales) ||
    safeFloat(meta.montoSubtotal) ||
    safeFloat(meta.monto_base_cobrado);
  if (direct > 0) return direct;
  // Fallback: total_quoted_amount dividido entre 1.18 (precio con IGV incluido)
  const gross = safeFloat(ticket.total_quoted_amount) || safeFloat(meta.montoFinal);
  return gross > 0 ? Math.round((gross / 1.18) * 100) / 100 : 0;
}

// ── Fetcher principal ─────────────────────────────────────────────────────────

async function fetchEficienciaData(): Promise<EficienciaData> {
  const headers = {
    "apikey": SUPABASE_ANON,
    "Authorization": `Bearer ${SUPABASE_ANON}`,
    "Content-Type": "application/json",
  };

  // ── 1. Gestoras ─────────────────────────────────────────────────────────────
  const gestorasRes = await fetch(
    `${SUPABASE_URL}/rest/v1/gestoras?select=id,name,email,costo_laboral_mensual,activos_mensuales_valor,status&status=eq.active`,
    { headers }
  );
  const gestorasInfo: any[] = gestorasRes.ok ? await gestorasRes.json() : [];

  // ── 2. Tickets cerrados con closure_date ────────────────────────────────────
  const ticketsRes = await fetch(
    `${SUPABASE_URL}/rest/v1/tickets?select=id,ticket_number,gestora_id,status_id,closure_date,created_at,total_quoted_amount,metadata&status_id=in.(ticket_cerrado,por_liquidar,liquidado)&closure_date=not.is.null&order=closure_date.desc`,
    { headers }
  );
  const tickets: any[] = ticketsRes.ok ? await ticketsRes.json() : [];

  // ── 3. ticket_costs pagados ─────────────────────────────────────────────────
  const costsRes = await fetch(
    `${SUPABASE_URL}/rest/v1/ticket_costs?select=id,ticket_id,monto,estado_pago,categoria,fecha_pago&estado_pago=eq.pagado`,
    { headers }
  );
  const costs: any[] = costsRes.ok ? await costsRes.json() : [];

  // ── 4. Mapa de costos por ticket ────────────────────────────────────────────
  const costMap: Record<string, number> = {};
  costs.forEach((c) => {
    const m = safeFloat(c.monto);
    costMap[c.ticket_id] = (costMap[c.ticket_id] || 0) + m;
  });

  // ── 5. Mapa de gestoras ─────────────────────────────────────────────────────
  const gestoraMap: Record<string, any> = {};
  gestorasInfo.forEach((g) => {
    gestoraMap[g.id] = g;
  });

  // ── 6. Agrupar por gestoraId + mesKey ──────────────────────────────────────
  type MesData = {
    tickets: number;
    ingreso: number;
    inversion: number;
    horasSum: number;
    horasCount: number;
  };
  const grouped: Record<string, Record<string, MesData>> = {};
  // gestoraId → mesKey → data

  tickets.forEach((t) => {
    if (!t.gestora_id || !t.closure_date) return;
    const mesKey = t.closure_date.substring(0, 7);
    const gid = t.gestora_id;

    if (!grouped[gid]) grouped[gid] = {};
    if (!grouped[gid][mesKey]) {
      grouped[gid][mesKey] = { tickets: 0, ingreso: 0, inversion: 0, horasSum: 0, horasCount: 0 };
    }

    const slot = grouped[gid][mesKey];
    slot.tickets++;
    slot.ingreso += extractIngresoNeto(t);
    slot.inversion += costMap[t.id] || 0;

    // Calcular horas reales (sólo si closure_date y created_at son válidas y closure > created)
    const created = new Date(t.created_at).getTime();
    const closed = new Date(t.closure_date).getTime();
    const horas = (closed - created) / 3600000;
    // Ignorar si < 0.1h (cierre inmediato: probablemente cierre manual retroactivo)
    // o > 8760h (> 1 año: dato corrupto)
    if (horas >= 0.5 && horas <= 8760) {
      slot.horasSum += horas;
      slot.horasCount++;
    }
  });

  // ── 7. Construir GestoraSummary[] ─────────────────────────────────────────
  const mesesSet = new Set<string>();
  const gesturasSummary: GestoraSummary[] = [];

  for (const gid of Object.keys(grouped)) {
    const gestoraInfo = gestoraMap[gid];
    const gestoraName = gestoraInfo?.name || `Gestora ${gid.slice(-6)}`;
    const costoLaboralMensual = safeFloat(gestoraInfo?.costo_laboral_mensual);

    const meses: GestoraMes[] = [];
    let totalTickets = 0;
    let totalIngreso = 0;
    let totalInversion = 0;

    for (const [mesKey, slot] of Object.entries(grouped[gid])) {
      mesesSet.add(mesKey);
      const utilidad = slot.ingreso - slot.inversion;
      const margen = slot.ingreso > 0 ? Math.min(100, Math.max(0, (utilidad / slot.ingreso) * 100)) : 0;
      const horasPromedio = slot.horasCount > 0 ? Math.round(slot.horasSum / slot.horasCount) : 0;

      meses.push({
        mesKey,
        mesLabel: mesLabel(mesKey),
        gestoraId: gid,
        gestoraName,
        ticketsCerrados: slot.tickets,
        ingresoNeto: Math.round(slot.ingreso * 100) / 100,
        inversion: Math.round(slot.inversion * 100) / 100,
        utilidadNeta: Math.round(utilidad * 100) / 100,
        margenPct: Math.round(margen * 10) / 10,
        horasPromedio,
      });

      totalTickets += slot.tickets;
      totalIngreso += slot.ingreso;
      totalInversion += slot.inversion;
    }

    meses.sort((a, b) => a.mesKey.localeCompare(b.mesKey));

    const totalUtilidad = totalIngreso - totalInversion;
    const margenPct = totalIngreso > 0 ? Math.min(100, Math.max(0, (totalUtilidad / totalIngreso) * 100)) : 0;

    gesturasSummary.push({
      gestoraId: gid,
      gestoraName,
      costoLaboralMensual,
      totalTickets,
      totalIngreso: Math.round(totalIngreso),
      totalInversion: Math.round(totalInversion),
      totalUtilidad: Math.round(totalUtilidad),
      margenPct: Math.round(margenPct * 10) / 10,
      ticketPromedio: totalTickets > 0 ? Math.round(totalIngreso / totalTickets) : 0,
      meses,
    });
  }

  gesturasSummary.sort((a, b) => b.totalUtilidad - a.totalUtilidad);

  const mesesDisponibles = [...mesesSet].sort();
  const now = new Date();
  const mesActual = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  return {
    gestoras: gesturasSummary,
    mesesDisponibles,
    mesActual,
    raw: { tickets, costs, gestorasInfo },
  };
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useEficienciaData() {
  return useQuery<EficienciaData>({
    queryKey: ["eficiencia-v2"],
    queryFn: fetchEficienciaData,
    staleTime: 1000 * 60 * 5,      // 5 minutos
    gcTime: 1000 * 60 * 30,         // 30 minutos en caché
    refetchOnWindowFocus: false,
    refetchOnMount: true,
    retry: 2,
    retryDelay: 1500,
  });
}
