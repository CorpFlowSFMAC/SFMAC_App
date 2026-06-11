/**
 * Check user status in perfiles table
 */
import { createClient } from '@supabase/supabase-js';

const HETZNER_SUPABASE_URL = 'https://api.sinfimac.pe';
const HETZNER_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNvcnBmbG93c2ZtYWMtaGV0em5lciIsInJvbGUiOiJhbm9uIiwiaWF0IjoxNzc4NzQ4NTY5LCJleHAiOjIwODU3MjkyOTR9.UVpFZwAHuUFXKEwZANp58HP3x-9wgFGrvVY12yoC9MI';

const supabase = createClient(HETZNER_SUPABASE_URL, HETZNER_SUPABASE_ANON_KEY);

async function checkUser() {
    const email = 'pjsr71081@gmail.com';
    
    console.log(`\n🔍 Checking user: ${email}\n`);
    
    // Try to get the user directly
    const { data, error } = await supabase
        .from('perfiles')
        .select('*')
        .eq('email', email.toLowerCase())
        .maybeSingle();
    
    if (error) {
        console.log('❌ Error:', error.message);
        return;
    }
    
    if (!data) {
        console.log('❌ User NOT FOUND in perfiles table');
        console.log('\nPossible reasons:');
        console.log('1. RLS policy is blocking the query');
        console.log('2. User profile was never created');
        console.log('3. Email format mismatch in database');
        return;
    }
    
    console.log('✅ User FOUND:');
    console.log(JSON.stringify(data, null, 2));
}

checkUser();