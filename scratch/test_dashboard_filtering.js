const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://api.sinfimac.pe';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNvcnBmbG93c2ZtYWMtaGV0em5lciIsInJvbGUiOiJhbm9uIiwiaWF0IjoxNzc4NzQ4NTY5LCJleHAiOjIwODU3MjkyOTR9.UVpFZwAHuUFXKEwZANp58HP3x-9wgFGrvVY12yoC9MI';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Normalize function from useQueryHooks.ts
const normalizeStateId = (id) => {
  if (!id) return 'nuevo';
  return id.toLowerCase().trim();
};

const normalizeTicket = (t) => {
  if (!t) return null;
  let realMetadata = t.metadata || {};
  const statusId = t.status_id;
  return {
    ...t,
    ...realMetadata,
    id: t.id,
    status_id: statusId,
    estadoId: normalizeStateId(statusId || t.estadoId || 'nuevo'),
    createdAt: t.created_at || t.createdAt,
  };
};

async function main() {
  const emailLower = 'j.portocarrero@sinfimac.pe';
  const myGestoraId = 'b804dc69-27b1-4335-8cea-bcc47557af0a';

  console.log('Fetching raw tickets from vw_tickets_strategic...');
  const { data: rawTickets, error } = await supabase
    .from('vw_tickets_strategic')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(300);

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log('Total raw tickets from view:', rawTickets.length);

  const normalizedTickets = rawTickets.map(normalizeTicket).filter(Boolean);

  // 1. Check filtering inside useQueryHooks (filterTicketsForActiveGestor)
  const filteredQueryHooks = normalizedTickets.filter((t) => {
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

  console.log('Tickets filtered by filterTicketsForActiveGestor:', filteredQueryHooks.length);
  console.log('Sample of filtered tickets (first 2):');
  console.log(JSON.stringify(filteredQueryHooks.slice(0, 2), null, 2));

  // 2. Check filtering inside metrics/page.tsx
  const filteredDashboard = filteredQueryHooks.filter((t) => {
    // Coincidencia directa por email
    if (t.gestora?.email && t.gestora.email.toLowerCase().trim() === emailLower) {
      return true;
    }
    if (t.gestoras?.email && t.gestoras.email.toLowerCase().trim() === emailLower) {
      return true;
    }

    // Coincidencia por ID de gestora asignada si lo tenemos
    if (myGestoraId) {
      const assignedGestoraId = t.gestora_id || t.metadata?.gestora_id;
      if (assignedGestoraId && assignedGestoraId === myGestoraId) {
        return true;
      }

      // Cascada (Sede / Zona / Cliente)
      if (t.branch_offices?.gestora_asignada_id === myGestoraId) return true;
      if (t.branch_offices?.zonas?.gestora_asignada_id === myGestoraId) return true;
      if (t.clients?.gestora_asignada_id === myGestoraId ||
          t.branch_offices?.clients?.gestora_asignada_id === myGestoraId) {
        return true;
      }
    }
    return false;
  });

  console.log('Tickets filtered by metrics/page.tsx (from filteredQueryHooks):', filteredDashboard.length);
}

main().catch(console.error);
