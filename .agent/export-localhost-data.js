/**
 * PASO 1: EXPORTAR DATOS DE LOCALHOST
 * 
 * INSTRUCCIONES:
 * 1. Abre http://localhost:3000 en tu navegador
 * 2. Abre la consola del navegador (F12)
 * 3. Copia y pega este script
 * 4. Presiona Enter
 * 5. Se descargará un archivo "localStorage-export.json"
 * 6. Guarda ese archivo en la raíz del proyecto
 */

console.log('📦 Exportando datos de localStorage...\n');

// Recopilar todos los datos
const exportData = {
    clients: JSON.parse(localStorage.getItem('clients') || '[]'),
    technicians: JSON.parse(localStorage.getItem('technicians') || '[]'),
    tickets: JSON.parse(localStorage.getItem('tickets') || '[]'),
    exportedAt: new Date().toISOString()
};

// Mostrar resumen
console.log('📊 Datos encontrados:');
console.log(`   Clientes: ${exportData.clients.length}`);
console.log(`   Técnicos: ${exportData.technicians.length}`);
console.log(`   Tickets: ${exportData.tickets.length}`);

// Mostrar clientes
if (exportData.clients.length > 0) {
    console.log('\n📋 Clientes:');
    exportData.clients.forEach(c => {
        const branches = c.agencias ? c.agencias.length : 0;
        console.log(`   - ${c.nombre} (${branches} sedes)`);
    });
}

// Crear archivo para descargar
const dataStr = JSON.stringify(exportData, null, 2);
const dataBlob = new Blob([dataStr], { type: 'application/json' });
const url = URL.createObjectURL(dataBlob);

// Crear link de descarga
const link = document.createElement('a');
link.href = url;
link.download = 'localStorage-export.json';
document.body.appendChild(link);
link.click();
document.body.removeChild(link);

console.log('\n✅ Archivo descargado: localStorage-export.json');
console.log('📍 Guárdalo en: c:\\CorpFlowSFMAC\\localStorage-export.json');
console.log('\n💡 Siguiente paso: Ejecuta "node sync_from_file.js" en la terminal');
