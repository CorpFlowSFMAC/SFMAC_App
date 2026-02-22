import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://xqnghcdndqicqofnxvuf.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhxbmdoY2RuZHFpY3FvZm54dnVmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAxNTMyOTQsImV4cCI6MjA4NTcyOTI5NH0.QijT6mgGlaiCXdHW2BO4es0Rwx_QIgDPGPW61H3x54M'

// Log para depuración interna (solo en desarrollo)
if (typeof window !== 'undefined') {
    console.log('🔄 Supabase Client Initialized with URL:', supabaseUrl);
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
