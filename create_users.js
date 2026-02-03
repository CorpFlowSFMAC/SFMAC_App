const { createClient } = require('@supabase/supabase-js');
const SUPABASE_URL = 'https://xqnghcdndqicqofnxvuf.supabase.co';
const SUPABASE_KEY = 'sb_publishable_DHL-l6BH0dVVfvNFYG9kdQ_18F8SeL3';
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
