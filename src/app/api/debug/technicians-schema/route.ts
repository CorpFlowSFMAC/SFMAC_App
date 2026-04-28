import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET() {
  try {
    const { data: columns, error: colError } = await supabase
      .from('information_schema.columns')
      .select('column_name, data_type, is_nullable')
      .eq('table_name', 'technicians')
      .eq('table_schema', 'public')
      .order('ordinal_position');
    
    if (colError) {
      return NextResponse.json({ error: colError.message }, { status: 500 });
    }
    
    const { data: sample, error: sampleError } = await supabase
      .from('technicians')
      .select('*')
      .limit(1);
    
    return NextResponse.json({
      columns: columns,
      sampleKeys: sample && sample.length > 0 ? Object.keys(sample[0]) : [],
      sample: sample?.[0]
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}