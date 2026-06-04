const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://api.sinfimac.pe';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNvcnBmbG93c2ZtYWMtaGV0em5lciIsInJvbGUiOiJhbm9uIiwiaWF0IjoxNzc4NzQ4NTY5LCJleHAiOjIwODU3MjkyOTR9.UVpFZwAHuUFXKEwZANp58HP3x-9wgFGrvVY12yoC9MI';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

const normalizeStateId = (id) => {
  if (!id) return 'nuevo';
  return id.toLowerCase().trim();
};

const normalizeTicket = (t) => {
  if (!t) return null;
  let realMetadata = t.metadata || {};
  return {
    ...t,
    ...realMetadata,
    id: t.id,
    status_id: t.status_id,
    estadoId: normalizeStateId(t.status_id || t.estadoId || 'nuevo'),
  };
};

function findGestoraByEmail(gestorasList, email) {
    if (!email) return null;
    const emailLower = email.toLowerCase().trim();
    const username = emailLower.split('@')[0];
    
    // 1. Exact match
    let found = gestorasList.find((g) => g.email?.toLowerCase()?.trim() === emailLower);
    if (found) return found;
    
    // 2. Exact match of username part
    found = gestorasList.find((g) => {
        const gEmail = g.email?.toLowerCase()?.trim() || "";
        const gUsername = gEmail.split('@')[0];
        return gUsername === username;
    });
    if (found) return found;
    
    // 3. Fuzzy matches based on known gestoras
    // Janeth Portocarrero: j.portocarrero@sinfimac.pe
    if (emailLower.includes('portocarrero') || username === 'jp' || username === 'janeth' || username === 'jportocarrero') {
        found = gestorasList.find((g) => g.email?.toLowerCase()?.includes('portocarrero'));
        if (found) return found;
    }
    
    // Francen Marin: francen.marin@sinfimac.pe
    if (emailLower.includes('marin') || username === 'francen' || username === 'fmarin' || username === 'fhmarin') {
        found = gestorasList.find((g) => g.email?.toLowerCase()?.includes('marin'));
        if (found) return found;
    }
    
    return null;
}

async function testEmail(userEmail) {
  const { data: rawTickets } = await supabase.from('vw_tickets_strategic').select('*');
  const { data: allGestoras } = await supabase.from('gestoras').select('*');
  
  const myGestora = findGestoraByEmail(allGestoras || [], userEmail);
  const myGestoraId = myGestora?.id;

  console.log(`\nEmail tested: "${userEmail}"`);
  console.log(`Found Gestora ID: "${myGestoraId}" (${myGestora?.name})`);
  
  const normalizedTickets = rawTickets.map(normalizeTicket).filter(Boolean);
  
  const filtered = normalizedTickets.filter((t) => {
    // Check direct email match or fuzzy email match
    const tGestoraEmail = t.gestora?.email || t.gestoras?.email || '';
    const matchDirectEmail = tGestoraEmail.toLowerCase().trim() === userEmail.toLowerCase().trim();
    const matchFuzzyEmail = myGestora && tGestoraEmail.toLowerCase().includes('portocarrero') && userEmail.toLowerCase().includes('portocarrero');
    const matchFuzzyEmailMarin = myGestora && tGestoraEmail.toLowerCase().includes('marin') && userEmail.toLowerCase().includes('marin');
    
    if (matchDirectEmail || matchFuzzyEmail || matchFuzzyEmailMarin) {
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
  
  console.log(`Filtered Tickets Count: ${filtered.length}`);
}

async function main() {
  await testEmail('j.portocarrero@sinfimac.pe');
  await testEmail('janeth.portocarrero@sinfimac.pe');
  await testEmail('jp@sinfimac.com');
  await testEmail('jp@sinfimac.pe');
  await testEmail('francen.marin@sinfimac.pe');
  await testEmail('francen@sinfimac.pe');
}

main().catch(console.error);
