async function main() {
    const apiHeaders = {
        'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNvcnBmbG93c2ZtYWMtaGV0em5lciIsInJvbGUiOiJhbm9uIiwiaWF0IjoxNzc4NzQ4NTY5LCJleHAiOjIwODU3MjkyOTR9.UVpFZwAHuUFXKEwZANp58HP3x-9wgFGrvVY12yoC9MI',
        'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNvcnBmbG93c2ZtYWMtaGV0em5lciIsInJvbGUiOiJhbm9uIiwiaWF0IjoxNzc4NzQ4NTY5LCJleHAiOjIwODU3MjkyOTR9.UVpFZwAHuUFXKEwZANp58HP3x-9wgFGrvVY12yoC9MI'
    };

    console.log('🔍 INSPECCIONANDO TABLA gestoras...');
    let res = await globalThis.fetch('https://api.sinfimac.pe/rest/v1/gestoras?select=*', { headers: apiHeaders });
    let gestoras = await res.json();
    console.log('Gestoras registradas:');
    gestoras.forEach(g => {
        console.log(`- ID: ${g.id}, Name: ${g.name}, Email: ${g.email}`);
    });

    console.log('\n🔍 INSPECCIONANDO TABLA perfiles...');
    res = await globalThis.fetch('https://api.sinfimac.pe/rest/v1/perfiles?select=*', { headers: apiHeaders });
    let perfiles = await res.json();
    console.log('Perfiles registrados:');
    perfiles.forEach(p => {
        console.log(`- ID: ${p.id}, Name: ${p.name || p.nombre || 'N/A'}, Email: ${p.email}, Rol: ${p.rol}`);
    });
}

main().catch(console.error);
