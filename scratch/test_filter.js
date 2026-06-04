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

async function main() {
  const { data: rawTickets, error: tError } = await client
    .from('vw_tickets_strategic')
    .select('*');

  if (tError) {
    console.error('Error fetching tickets:', tError);
    return;
  }

  const { data: gestoras, error: gError } = await client
    .from('gestoras')
    .select('*');

  if (gError) {
    console.error('Error fetching gestoras:', gError);
    return;
  }

  const now = new Date(); // In actual dashboard this is June 4, 2026 (local time)
  console.log(`Current Local Time in script: ${now.toISOString()}`);

  const testEmails = ['j.portocarrero@sinfimac.pe', 'francen.marin@sinfimac.pe'];

  for (const authEmail of testEmails) {
    console.log(`\n========================================`);
    console.log(`Testing filtering for: ${authEmail}`);
    console.log(`========================================`);

    // Replicate tickets useMemo
    const tickets = rawTickets.filter((t) => {
        if (t.gestora?.email && t.gestora.email.toLowerCase() === authEmail.toLowerCase()) {
            return true;
        }
        if (t.gestoras?.email && t.gestoras.email.toLowerCase() === authEmail.toLowerCase()) {
            return true;
        }

        const myGestora = gestoras.find(g => g.email?.toLowerCase() === authEmail.toLowerCase());
        if (!myGestora) return false;

        const myGestoraId = myGestora.id;
        const assignedGestoraId = t.gestora_id || t.metadata?.gestora_id;
        if (assignedGestoraId) {
            return assignedGestoraId === myGestoraId;
        }

        if (t.branch_offices?.gestora_asignada_id === myGestoraId) return true;
        if (t.branch_offices?.zonas?.gestora_asignada_id === myGestoraId) return true;
        if (t.clients?.gestora_asignada_id === myGestoraId ||
            t.branch_offices?.clients?.gestora_asignada_id === myGestoraId) {
            return true;
        }
        return false;
    });

    console.log(`Tickets matching gestora filter: ${tickets.length}`);

    // Replicate date range filter
    const dateFilters = ['today', 'week', 'month', 'all'];
    for (const filter of dateFilters) {
      const isInDateRange = (dateStr) => {
        const d = new Date(dateStr);
        const diff = (now.getTime() - d.getTime()) / 86_400_000;
        if (filter === 'today') return diff < 1;
        if (filter === 'week') return diff < 7;
        if (filter === 'month') return diff < 30;
        return true;
      };

      const periodTickets = tickets.filter(t => {
        const dateStr = t.created_at || t.createdAt || now.toISOString();
        return isInDateRange(dateStr);
      });

      console.log(`  - Filter "${filter}": resulting count = ${periodTickets.length}`);
      if (periodTickets.length > 0) {
        console.log(`    First ticket date: ${periodTickets[0].created_at || periodTickets[0].createdAt}`);
      }
    }
  }
}

main().catch(console.error);
