const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

async function resolveGestorasId(rawId) {
    if (!rawId) return null;

    // Primero intentamos buscar directamente en gestoras (id nativo)
    const { data: direct } = await supabase
        .from('gestoras')
        .select('id')
        .eq('id', rawId)
        .maybeSingle();

    if (direct) {
        console.log('Found directly in gestoras:', direct.id);
        return direct.id;
    }

    // Si no existe, el rawId podría ser auth_user_id (de perfiles RBAC)
    const { data: byAuthId } = await supabase
        .from('gestoras')
        .select('id')
        .eq('auth_user_id', rawId)
        .maybeSingle();

    if (byAuthId) {
        console.log('Found by auth_user_id:', byAuthId.id);
        return byAuthId.id;
    }

    // No encontrado en gestoras → intentamos upsert
    console.log('Not found in gestoras, trying perfiles...');
    const { data: perfil } = await supabase
        .from('perfiles')
        .select('id, email, nombre_completo')
        .eq('id', rawId)
        .maybeSingle();

    if (perfil) {
        console.log('Found in perfiles:', perfil);
        const { data: newGestora, error } = await supabase
            .from('gestoras')
            .upsert({
                auth_user_id: perfil.id,
                email: perfil.email,
                name: perfil.nombre_completo || perfil.email?.split('@')[0] || 'Gestora',
                status: 'active'
            }, { onConflict: 'email' })
            .select('id')
            .single();

        if (error) {
            console.error('Upsert Error:', error);
            return null;
        }
        console.log('Upsert succeeded:', newGestora.id);
        return newGestora.id;
    }

    console.log('Nothing found');
    return null;
}

// id de perfiles de la gestora silvia.cenepo@sinfimac.pe
// vamos a obtener su id primero

async function test() {
    const { data: p } = await supabase.from('perfiles').select('id').eq('email', 'silvia.cenepo@sinfimac.pe').single();
    if(p) {
        console.log("Testing auth_user_id:", p.id);
        await resolveGestorasId(p.id);
    }
}
test();
