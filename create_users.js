const { createClient } = require('@supabase/supabase-js');
const SUPABASE_URL = 'https://xqnghcdndqicqofnxvuf.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhxbmdoY2RuZHFpY3FvZm54dnVmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAxNTMyOTQsImV4cCI6MjA4NTcyOTI5NH0.QijT6mgGlaiCXdHW2BO4es0Rwx_QIgDPGPW61H3x54M';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function createInitialUsers() {
    console.log('Intentando registrar admin...');
    const { data, error } = await supabase.auth.signUp({
        email: 'admin@corpflow.com',
        password: 'password123',
        options: { data: { role: 'admin' } }
    });
    if (error) console.log('Error:', error.message);
    else console.log('Admin creado:', data.user.email);
}
createInitialUsers();

