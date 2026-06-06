import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(request: NextRequest) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    const fakeId = '00000000-0000-0000-0000-000000000000';

    // Try update with assigned_zones
    const updates = { assigned_zones: ['LIMA'] };
    const { error: err1 } = await supabase.from('technicians').update(updates).eq('id', fakeId).select();
    
    // Try update without assigned_zones
    const updates2 = { rating: 5 };
    const { error: err2 } = await supabase.from('technicians').update(updates2).eq('id', fakeId).select();

    return NextResponse.json({ err1: err1, err2: err2 });
}
