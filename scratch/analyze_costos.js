const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://api.sinfimac.pe';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNvcnBmbG93c2ZtYWMtaGV0em5lciIsInJvbGUiOiJzZXJ2aWNlX3JvbGUiLCJpYXQiOjE3Nzg3NDg1NjksImV4cCI6MjA4NTcyOTI5NH0.vLLePfYAiz9YCvJEIwk-YLx2RXgyLNCKHMVHlc2vAEc';
const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

async function analyze() {
  const { data: costs, error } = await supabase
    .from('ticket_costs')
    .select('*')
    .eq('ticket_id', 'a64b9f8b-f180-4e07-a8be-ec0c34cc60d7');

  if (error) {
    console.error("Error fetching ticket:", error);
    return;
  }
  
  console.log("Ticket Costos:");
  console.log(JSON.stringify(costs, null, 2));
}

analyze();
