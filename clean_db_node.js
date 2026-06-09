const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://xqnghcdndqicqofnxvuf.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhxbmdoY2RuZHFpY3FvZm54dnVmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAxNTMyOTQsImV4cCI6MjA4NTcyOTI5NH0.QijT6mgGlaiCXdHW2BO4es0Rwx_QIgDPGPW61H3x54M';

const supabase = createClient(supabaseUrl, supabaseKey);

async function cleanDummyCosts() {
    console.log("Cleaning up dummy 0.00 'Especialista' costs...");
    
    const { data, error } = await supabase
        .from('ticket_costs')
        .delete()
        .eq('concepto', 'Especialista')
        .eq('monto', 0);

    if (error) {
        console.error("Error deleting:", error);
    } else {
        console.log("Success! Dummy costs deleted.");
    }
}

cleanDummyCosts();
