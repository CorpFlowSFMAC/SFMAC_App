/**
 * Verificación de Variables de Entorno
 * 
 * Este script verifica:
 * 1. Si las variables de entorno están definidas
 * 2. Si los valores son correctos
 * 3. Si están accesibles desde el código
 */

console.log('\n════════════════════════════════════════════════════════════');
console.log('🔍 VERIFICACIÓN DE VARIABLES DE ENTORNO');
console.log('════════════════════════════════════════════════════════════\n');

// Valores esperados
const EXPECTED_URL = 'https://xqnghcdndqicqofnxvuf.supabase.co';
const EXPECTED_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhxbmdoY2RuZHFpY3FvZm54dnVmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAxNTMyOTQsImV4cCI6MjA4NTcyOTI5NH0.QijT6mgGlaiCXdHW2BO4es0Rwx_QIgDPGPW61H3x54M';

// Verificar variables de entorno
console.log('📋 Variables de Entorno del Sistema:\n');

const envUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const envKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

console.log('1. NEXT_PUBLIC_SUPABASE_URL:');
if (envUrl) {
    console.log(`   ✅ Definida: ${envUrl}`);
    if (envUrl === EXPECTED_URL) {
        console.log('   ✅ Valor correcto');
    } else {
        console.log(`   ⚠️  Valor diferente al esperado`);
        console.log(`   Esperado: ${EXPECTED_URL}`);
    }
} else {
    console.log('   ⚠️  NO definida en variables de entorno');
    console.log('   ℹ️  Se usará el valor por defecto del código');
}

console.log('\n2. NEXT_PUBLIC_SUPABASE_ANON_KEY:');
if (envKey) {
    console.log(`   ✅ Definida: ${envKey.substring(0, 30)}...`);
    if (envKey === EXPECTED_KEY) {
        console.log('   ✅ Valor correcto');
    } else {
        console.log(`   ⚠️  Valor diferente al esperado`);
    }
} else {
    console.log('   ⚠️  NO definida en variables de entorno');
    console.log('   ℹ️  Se usará el valor por defecto del código');
}

console.log('\n════════════════════════════════════════════════════════════');
console.log('📁 Archivos de Variables de Entorno:\n');

const fs = require('fs');
const path = require('path');

const envFiles = [
    '.env',
    '.env.local',
    '.env.development',
    '.env.production'
];

let foundEnvFile = false;

envFiles.forEach(file => {
    const filePath = path.join(process.cwd(), file);
    if (fs.existsSync(filePath)) {
        console.log(`✅ ${file} - Existe`);
        foundEnvFile = true;

        // Leer contenido (sin mostrar valores sensibles)
        const content = fs.readFileSync(filePath, 'utf8');
        const lines = content.split('\n').filter(line => line.trim() && !line.startsWith('#'));
        console.log(`   Variables definidas: ${lines.length}`);
        lines.forEach(line => {
            const [key] = line.split('=');
            if (key) {
                console.log(`   - ${key.trim()}`);
            }
        });
    } else {
        console.log(`❌ ${file} - No existe`);
    }
});

if (!foundEnvFile) {
    console.log('\n⚠️  No se encontraron archivos .env');
    console.log('   Esto es normal si usas valores por defecto en el código');
}

console.log('\n════════════════════════════════════════════════════════════');
console.log('🔧 Configuración en el Código:\n');

console.log('Los siguientes archivos tienen valores por defecto:');
console.log('   1. src/lib/supabase.ts');
console.log('   2. src/lib/supabase-api.ts');
console.log('   3. src/components/SyncToSupabaseButton.tsx');

console.log('\nValores por defecto configurados:');
console.log(`   URL: ${EXPECTED_URL}`);
console.log(`   Key: ${EXPECTED_KEY.substring(0, 30)}...`);

console.log('\n════════════════════════════════════════════════════════════');
console.log('📊 RESUMEN:\n');

const usingEnvUrl = envUrl || EXPECTED_URL;
const usingEnvKey = envKey || EXPECTED_KEY;

console.log('Variables que se están usando actualmente:');
console.log(`   URL: ${usingEnvUrl}`);
console.log(`   Key: ${usingEnvKey.substring(0, 30)}...`);

if (!envUrl && !envKey) {
    console.log('\n✅ CONFIGURACIÓN: Usando valores por defecto del código');
    console.log('   Esto funciona correctamente en localhost.');
    console.log('   Para producción (Vercel), debes configurar las variables de entorno.');
} else if (envUrl && envKey) {
    console.log('\n✅ CONFIGURACIÓN: Usando variables de entorno');
    console.log('   Las variables están correctamente definidas.');
} else {
    console.log('\n⚠️  CONFIGURACIÓN: Mixta (algunas variables definidas, otras no)');
    console.log('   Recomendación: Define todas las variables o ninguna.');
}

console.log('\n════════════════════════════════════════════════════════════');
console.log('🚀 PARA VERCEL:\n');

console.log('Debes configurar estas variables en Vercel Dashboard:');
console.log('');
console.log('Variable 1:');
console.log(`   Name:  NEXT_PUBLIC_SUPABASE_URL`);
console.log(`   Value: ${EXPECTED_URL}`);
console.log('   Environments: ✓ Production  ✓ Preview  ✓ Development');
console.log('');
console.log('Variable 2:');
console.log(`   Name:  NEXT_PUBLIC_SUPABASE_ANON_KEY`);
console.log(`   Value: ${EXPECTED_KEY}`);
console.log('   Environments: ✓ Production  ✓ Preview  ✓ Development');

console.log('\n📖 Guía detallada: .agent/VERIFICAR_ENV_VERCEL.md');
console.log('════════════════════════════════════════════════════════════\n');

