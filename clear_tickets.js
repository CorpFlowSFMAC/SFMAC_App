const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function clearDB() {
  console.log("Iniciando purga de tickets...");
  try {
    // We cannot truncate easily from the anon key without a postgres function, so we will use delete with not.is.null
    const { data: tickets, error: fetchErr } = await supabase
      .from('tickets')
      .select('id');
      
    if (fetchErr) throw fetchErr;
    
    console.log(`Encontrados ${tickets.length} tickets. Eliminando...`);
    
    // We can delete all where id is not null. 
    // IMPORTANT: Note that sometimes REST API requires a filter for DELETE. 
    const { error: delErr } = await supabase
      .from('tickets')
      .delete()
      .neq('id', 0) // dummy filter that matches all, as UUIDs are strings 
      .or('id.is.null,id.not.is.null'); // safer way to match all

    if (delErr) {
        console.error("Fallo con filtros, intentando eliminacion individual...");
        for(let i=0; i<tickets.length; i++) {
           await supabase.from('tickets').delete().eq('id', tickets[i].id);
        }
    }
    
    console.log("✅ Purga de tickets completada con éxito.");
  } catch (error) {
    console.error("❌ Error purgando base de datos:", error.message || error);
  }
}

clearDB();
