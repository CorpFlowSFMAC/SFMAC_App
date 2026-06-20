const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://api.sinfimac.pe';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNvcnBmbG93c2ZtYWMtaGV0em5lciIsInJvbGUiOiJzZXJ2aWNlX3JvbGUiLCJpYXQiOjE3Nzg3NDg1NjksImV4cCI6MjA4NTcyOTI5NH0.vLLePfYAiz9YCvJEIwk-YLx2RXgyLNCKHMVHlc2vAEc';
const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

async function analyze() {
  const { data: ticket, error } = await supabase
    .from('tickets')
    .select('*')
    .eq('client_ticket_number', 'MB009696.26')
    .single();

  if (error) {
    console.error("Error fetching ticket:", error);
    return;
  }
  
  console.log("Ticket Data:");
  console.log(JSON.stringify(ticket, null, 2));
}

analyze();
