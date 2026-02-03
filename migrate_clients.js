const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://xqnghcdndqicqofnxvuf.supabase.co';
const SUPABASE_KEY = 'sb_publishable_DHL-l6BH0dVVfvNFYG9kdQ_18F8SeL3';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const client = {
    name: 'MiBanco',
    metadata: {
        ruc: '20382036655',
        address: 'Av. República de Panamá 3055, San Isidro',
        email: 'contacto@mibanco.com.pe',
        phone: '+51 1 315 0600',
        zone: 'LIMA'
    }
};

async function migrate() {
    console.log('Migrando Cliente...');
    const { data: clientData, error: clientError } = await supabase
        .from('clients')
        .upsert({ name: client.name }, { onConflict: 'name' })
        .select()
        .single();

    if (clientError) {
        console.error('Error migrando cliente:', clientError);
        return;
    }

    const clientId = clientData.id;
    console.log('Cliente migrado:', clientData.name, 'ID:', clientId);

    const branches = [
        { name: 'ABANCAY', address: 'AV. DIAZ PARCENA N° 917 ABANCAY-APURIMAC', zone: 'SUR' },
        { name: 'ALBARRACIN MUNICIPAL', address: 'AV. MUNICIPAL N° 701', zone: 'SUR' },
        { name: 'ALTO SELVA ALEGRE', address: 'PUEBLO JOVEN APURIMAC MZ. L LOTE 1 Y LOTE 1-A', zone: 'SUR' },
        { name: 'ALTO TRUJILLO', address: 'MZ P LOTE 21 BARRIO 3 - SECTOR T3, CENTRO POBLADO ALTO TRUJILLO', zone: 'NORTE' },
        { name: 'ANCON', address: 'CALLE ANCASH MZ M LOTE 17 URB. ZONA 3', zone: 'LIMA' }
    ];

    console.log('Migrando sedes...');
    const branchesToInsert = branches.map(b => ({
        client_id: clientId,
        name: b.name,
        address: b.address,
        zone: b.zone
    }));

    const { error: branchesError } = await supabase
        .from('branch_offices')
        .insert(branchesToInsert);

    if (branchesError) {
        console.error('Error migrando sedes:', branchesError);
    } else {
        console.log('Migración completada exitosamente.');
    }
}

migrate();
