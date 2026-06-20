import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://api.sinfimac.pe';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNvcnBmbG93c2ZtYWMtaGV0em5lciIsInJvbGUiOiJzZXJ2aWNlX3JvbGUiLCJpYXQiOjE3Nzg3NDg1NjksImV4cCI6MjA4NTcyOTI5NH0.vLLePfYAiz9YCvJEIwk-YLx2RXgyLNCKHMVHlc2vAEc';
const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

async function repair() {
  const { data: ticket } = await supabase.from('tickets').select('*').eq('client_ticket_number', 'MB009696.26').single();
  
  if (ticket) {
      const metadata = ticket.metadata;
      metadata.saldo_tecnico = 0;
      metadata.final_balance = 0;
      
      const { error } = await supabase.from('tickets').update({
          metadata: metadata
      }).eq('id', ticket.id);
      
      if(error) console.error(error);
      else console.log("✅ Ticket MB009696.26 saldo reparado a 0.");
  }
}

repair();
