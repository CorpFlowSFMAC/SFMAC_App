const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'http://87.99.137.96:8000';
const SUPABASE_ANON_KEY = 'CorpFlowSFMAC_Anon_Key_2026';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function run() {
  try {
    console.log('1. Consultando conteo de tickets...');
    const { count, error } = await supabase
      .from('tickets')
      .select('*', { count: 'exact', head: true });
    
    if (error) {
      console.error('Error al obtener conteo:', error.message);
    } else {
      console.log('Conteo de tickets exitoso:', count);
    }

    console.log('\n2. Consultando tickets...');
    const { data: tickets, error: ticketsError } = await supabase
      .from('tickets')
      .select('*');
    
    if (ticketsError) {
      console.error('Error al obtener tickets:', ticketsError.message);
    } else {
      console.log('Tickets obtenidos:', tickets.length);
      console.table(tickets.map(t => ({ id: t.id, codigo: t.codigo, creado_en: t.creado_en || t.created_at, gestor_email: t.gestor_email, estado: t.estado || t.status_id })));
    }

  } catch (err) {
    console.error('Error general:', err.message);
  }
}

run();
