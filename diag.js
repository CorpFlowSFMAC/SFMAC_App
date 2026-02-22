const { createClient } = require('@supabase/supabase-js');

const url = 'https://xqnghcdndqicqofnxvuf.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhxbmdoY2RuZHFpY3FvZm54dnVmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAxNTMyOTQsImV4cCI6MjA4NTcyOTI5NH0.QijT6mgGlaiCXdHW2BO4es0Rwx_QIgDPGPW61H3x54M';

console.log('Testing with:');
console.log('URL:', url);

const supabase = createClient(url, key);

async function test() {
    try {
        const { data, error } = await supabase.from('clients').select('name').limit(1);
        if (error) {
            console.error('Error:', error.message);
        } else {
            console.log('Success:', data);
        }
    } catch (err) {
        console.error('Catch:', err.message);
    }
}

test();
