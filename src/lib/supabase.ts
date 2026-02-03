import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://xqnghcdndqicqofnxvuf.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_DHL-l6BH0dVVfvNFYG9kdQ_18F8SeL3'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
