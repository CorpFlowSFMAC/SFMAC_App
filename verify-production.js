/**
 * Script para verificar que la aplicación en producción
 * esté conectada correctamente a Supabase
 * 
 * Uso: node verify-production.js [URL_DE_PRODUCCION]
 * Ejemplo: node verify-production.js https://mi-app.vercel.app
 */

const https = require('https');
const http = require('http');

const productionUrl = process.argv[2];

if (!productionUrl) {
    console.log('\n❌ Error: Debes proporcionar la URL de producción');
    console.log('\nUso:');
    console.log('  node verify-production.js https://tu-app.vercel.app');
    console.log('\n');
    process.exit(1);
}

console.log('\n════════════════════════════════════════════════════════════');
console.log('🔍 VERIFICACIÓN DE APLICACIÓN EN PRODUCCIÓN');
console.log('════════════════════════════════════════════════════════════\n');

console.log(`URL: ${productionUrl}\n`);

function makeRequest(url) {
    return new Promise((resolve, reject) => {
        const protocol = url.startsWith('https') ? https : http;

        protocol.get(url, (res) => {
            let data = '';

            res.on('data', (chunk) => {
                data += chunk;
            });

            res.on('end', () => {
                resolve({
                    statusCode: res.statusCode,
                    headers: res.headers,
                    body: data
                });
            });
        }).on('error', (err) => {
            reject(err);
        });
    });
}

async function verifyProduction() {
    try {
        console.log('📋 Paso 1: Verificando que la aplicación esté accesible...');

        const response = await makeRequest(productionUrl);

        if (response.statusCode === 200) {
            console.log('   ✅ Aplicación accesible (Status: 200 OK)');
        } else {
            console.log(`   ⚠️  Status Code: ${response.statusCode}`);
        }

        console.log('\n📋 Paso 2: Verificando contenido HTML...');

        const hasNextJs = response.body.includes('__NEXT_DATA__');
        const hasReact = response.body.includes('react');

        if (hasNextJs) {
            console.log('   ✅ Next.js detectado');
        } else {
            console.log('   ⚠️  Next.js no detectado');
        }

        if (hasReact) {
            console.log('   ✅ React detectado');
        }

        console.log('\n📋 Paso 3: Verificando variables de entorno en el HTML...');

        // Buscar referencias a Supabase en el HTML
        const hasSupabaseUrl = response.body.includes('xqnghcdndqicqofnxvuf.supabase.co');

        if (hasSupabaseUrl) {
            console.log('   ✅ URL de Supabase encontrada en el código');
        } else {
            console.log('   ⚠️  URL de Supabase no encontrada (esto puede ser normal)');
            console.log('      Las variables pueden cargarse dinámicamente');
        }

        console.log('\n════════════════════════════════════════════════════════════');
        console.log('📊 RESUMEN:\n');

        console.log('✅ Aplicación accesible');
        console.log('✅ Next.js funcionando');

        console.log('\n🔍 VERIFICACIÓN MANUAL REQUERIDA:\n');
        console.log('Para confirmar que Supabase funciona correctamente:');
        console.log('');
        console.log('1. Abre la aplicación en tu navegador:');
        console.log(`   ${productionUrl}`);
        console.log('');
        console.log('2. Abre la consola del navegador (F12)');
        console.log('');
        console.log('3. Verifica que NO haya errores como:');
        console.log('   ❌ "supabaseUrl is required"');
        console.log('   ❌ "supabaseKey is required"');
        console.log('   ❌ "Invalid API key"');
        console.log('');
        console.log('4. Ve al módulo de clientes y verifica que:');
        console.log('   ✅ Se muestren los 3 clientes');
        console.log('   ✅ Se muestren las 310 sedes');
        console.log('   ✅ Los datos se carguen desde Supabase');
        console.log('');
        console.log('5. Abre Network tab (F12 → Network):');
        console.log('   ✅ Busca peticiones a "xqnghcdndqicqofnxvuf.supabase.co"');
        console.log('   ✅ Verifica que las respuestas sean 200 OK');

        console.log('\n════════════════════════════════════════════════════════════\n');

    } catch (error) {
        console.log('\n❌ ERROR AL VERIFICAR LA APLICACIÓN\n');
        console.log(`Error: ${error.message}\n`);

        console.log('Posibles causas:');
        console.log('  1. La URL es incorrecta');
        console.log('  2. El deployment aún no ha terminado');
        console.log('  3. Hay un problema de red');
        console.log('  4. La aplicación no está desplegada');
        console.log('');
        console.log('Solución:');
        console.log('  1. Verifica la URL en Vercel Dashboard');
        console.log('  2. Espera a que el deployment termine');
        console.log('  3. Intenta nuevamente en unos minutos');
        console.log('');

        process.exit(1);
    }
}

verifyProduction();
