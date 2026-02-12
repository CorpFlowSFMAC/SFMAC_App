# 📘 GUÍA DETALLADA: OPCIÓN B - Migración desde Archivo

## 🎯 Objetivo
Migrar todos los datos de **localhost (localStorage)** a **Supabase (producción)** de forma segura usando un archivo intermedio.

---

## ✅ Ventajas de la Opción B

- ✅ **Segura:** Crea un backup antes de migrar
- ✅ **Verificable:** Puedes revisar los datos antes de subirlos
- ✅ **Reversible:** Guardas una copia de tus datos
- ✅ **Auditable:** Puedes ver exactamente qué se va a migrar

---

## 📋 PASO 1: Exportar Datos de localStorage

### 1.1. Abrir localhost en el navegador

1. **Asegúrate de que tu servidor esté corriendo:**
   - Verifica que en la terminal veas: `✓ Ready in X ms`
   - Si no está corriendo, ejecuta: `npm run dev`

2. **Abre tu navegador favorito** (Chrome, Edge, Firefox)

3. **Navega a:**
   ```
   http://localhost:3000
   ```

4. **Espera a que cargue completamente** la aplicación

### 1.2. Abrir la Consola del Navegador

**En Chrome/Edge:**
- Opción 1: Presiona `F12`
- Opción 2: Clic derecho → "Inspeccionar"
- Opción 3: `Ctrl + Shift + I` (Windows) o `Cmd + Option + I` (Mac)

**En Firefox:**
- Opción 1: Presiona `F12`
- Opción 2: `Ctrl + Shift + K`

**Resultado esperado:**
Se abrirá un panel en la parte inferior o lateral con varias pestañas.

### 1.3. Ir a la pestaña "Console"

1. **Busca la pestaña "Console"** (o "Consola" en español)
2. **Haz clic** en ella
3. **Verás un cursor parpadeante** donde puedes escribir

**Aspecto:**
```
> _
```

### 1.4. Copiar el Script de Exportación

1. **Abre el archivo:**
   ```
   c:\CorpFlowSFMAC\.agent\export-localhost-data.js
   ```

2. **Selecciona TODO el contenido** (`Ctrl + A`)

3. **Copia** (`Ctrl + C`)

**Contenido del script (para referencia):**
```javascript
/**
 * PASO 1: EXPORTAR DATOS DE LOCALHOST
 * 
 * Este script exporta todos los datos de localStorage
 * a un archivo JSON que puedes guardar y revisar.
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
```

### 1.5. Pegar y Ejecutar el Script

1. **Haz clic en la consola** (donde está el cursor parpadeante)

2. **Pega el script** (`Ctrl + V`)

3. **Presiona `Enter`**

**Resultado esperado en la consola:**
```
📦 Exportando datos de localStorage...

📊 Datos encontrados:
   Clientes: 3
   Técnicos: 5
   Tickets: 12

📋 Clientes:
   - MiBanco (150 sedes)
   - Cliente 2 (25 sedes)
   - Cliente 3 (10 sedes)

✅ Archivo descargado: localStorage-export.json
📍 Guárdalo en: c:\CorpFlowSFMAC\localStorage-export.json

💡 Siguiente paso: Ejecuta "node sync_from_file.js" en la terminal
```

### 1.6. Guardar el Archivo Descargado

1. **El navegador descargará automáticamente** un archivo llamado:
   ```
   localStorage-export.json
   ```

2. **Busca el archivo** en tu carpeta de Descargas:
   - Windows: `C:\Users\TuUsuario\Downloads\localStorage-export.json`

3. **Mueve el archivo** a la raíz del proyecto:
   ```
   Desde: C:\Users\TuUsuario\Downloads\localStorage-export.json
   Hasta: c:\CorpFlowSFMAC\localStorage-export.json
   ```

**Formas de mover el archivo:**

**Opción A: Arrastrar y soltar**
- Abre el Explorador de Archivos
- Arrastra el archivo desde Descargas a `c:\CorpFlowSFMAC\`

**Opción B: Copiar y pegar**
- Clic derecho en el archivo → Copiar
- Navega a `c:\CorpFlowSFMAC\`
- Clic derecho → Pegar

**Opción C: Desde la terminal**
```powershell
Move-Item "$env:USERPROFILE\Downloads\localStorage-export.json" "c:\CorpFlowSFMAC\"
```

### 1.7. Verificar el Archivo

1. **Abre el archivo** con un editor de texto (VS Code, Notepad++)

2. **Verifica que contenga tus datos:**
   ```json
   {
     "clients": [
       {
         "id": "CLI-001",
         "nombre": "MiBanco",
         "agencias": [
           {
             "id": "AGE-001",
             "nombre": "Agencia Centro",
             "direccion": "Av. Principal 123",
             "zona": "LIMA"
           }
         ]
       }
     ],
     "technicians": [...],
     "tickets": [...],
     "exportedAt": "2026-02-11T22:15:00.000Z"
   }
   ```

3. **Confirma que:**
   - ✅ Hay clientes
   - ✅ Cada cliente tiene sedes (agencias)
   - ✅ Los datos se ven correctos

---

## 📋 PASO 2: Migrar Datos a Supabase

### 2.1. Abrir la Terminal

**En VS Code:**
- Presiona `` Ctrl + ` `` (tecla de acento grave)
- O: Menú → Terminal → New Terminal

**Resultado esperado:**
```
PS c:\CorpFlowSFMAC>
```

### 2.2. Verificar que el Archivo Existe

Ejecuta:
```powershell
Test-Path .\localStorage-export.json
```

**Resultado esperado:**
```
True
```

**Si dice `False`:**
- El archivo no está en la ubicación correcta
- Vuelve al Paso 1.6 y mueve el archivo

### 2.3. Ejecutar el Script de Migración

```powershell
node sync_from_file.js
```

**Resultado esperado (progreso en tiempo real):**

```
📦 Datos cargados desde archivo:
   Clientes: 3
   Técnicos: 5
   Tickets: 12

════════════════════════════════════════════════════════════
🚀 SINCRONIZACIÓN LOCALHOST → SUPABASE
════════════════════════════════════════════════════════════

📋 Migrando clientes...
   ✓ Cliente "MiBanco" ya existe
   ✅ Cliente "Cliente 2" creado
   ✅ Cliente "Cliente 3" creado
   📊 Total: 3 clientes procesados

🏢 Migrando sedes...
   Procesando sedes de "MiBanco"...
     ✓ Sede "Agencia Centro" ya existe
     ✓ Sede "Agencia Norte" ya existe
     ... (continúa con todas las sedes)
   Procesando sedes de "Cliente 2"...
     ✅ Sede "Sede A" creada
     ✅ Sede "Sede B" creada
   Procesando sedes de "Cliente 3"...
     ✅ Sede "Sucursal 1" creada
   📊 Total: 35 sedes nuevas creadas

👨‍🔧 Migrando técnicos...
   ✅ Técnico "Juan Pérez" creado
   ✅ Técnico "María García" creado
   ✅ Técnico "Carlos López" creado
   ✅ Técnico "Ana Martínez" creado
   ✅ Técnico "Luis Rodríguez" creado
   📊 Total: 5 técnicos nuevos creados

🎫 Migrando tickets...
   ✅ Ticket #TKT-001 migrado
   ✅ Ticket #TKT-002 migrado
   ✅ Ticket #TKT-003 migrado
   ... (continúa con todos los tickets)
   📊 Total: 12 tickets creados, 0 omitidos

════════════════════════════════════════════════════════════
✅ SINCRONIZACIÓN COMPLETADA
════════════════════════════════════════════════════════════

📊 ESTADO FINAL EN SUPABASE:
   Clientes: 3
      - MiBanco
      - Cliente 2
      - Cliente 3
   Sedes: 345
   Técnicos: 5
   Tickets: 12
```

### 2.4. Interpretar los Resultados

**Símbolos:**
- ✅ = Creado exitosamente
- ✓ = Ya existía (no se duplicó)
- ⚠️ = Advertencia (no crítico)
- ❌ = Error (revisar)

**Si ves errores (❌):**
- Lee el mensaje de error
- Generalmente indica datos faltantes o inválidos
- El script continúa con los demás registros

---

## 📋 PASO 3: Verificar la Migración

### 3.1. Verificar en Supabase Dashboard

1. **Abre tu navegador**

2. **Ve a:**
   ```
   https://supabase.com/dashboard/project/xqnghcdndqicqofnxvuf
   ```

3. **Inicia sesión** si es necesario

4. **Click en "Table Editor"** (en el menú lateral)

5. **Verifica cada tabla:**

   **Tabla `clients`:**
   - Click en "clients"
   - Deberías ver 3 clientes
   - Verifica que los nombres sean correctos

   **Tabla `branch_offices`:**
   - Click en "branch_offices"
   - Deberías ver ~345 sedes
   - Verifica que tengan `client_id` asignado

   **Tabla `technicians`:**
   - Click en "technicians"
   - Deberías ver 5 técnicos
   - Verifica nombres y datos

   **Tabla `tickets`:**
   - Click en "tickets"
   - Deberías ver 12 tickets
   - Verifica que tengan `client_id`, `branch_id`

### 3.2. Verificar desde la Terminal

Ejecuta este comando para ver un resumen:

```powershell
node -e "const { createClient } = require('@supabase/supabase-js'); const supabase = createClient('https://xqnghcdndqicqofnxvuf.supabase.co', 'sb_publishable_DHL-l6BH0dVVfvNFYG9kdQ_18F8SeL3'); (async () => { const { data: clients } = await supabase.from('clients').select('name'); console.log('Clientes en Supabase:', clients.length); clients.forEach(c => console.log('  -', c.name)); })();"
```

**Resultado esperado:**
```
Clientes en Supabase: 3
  - MiBanco
  - Cliente 2
  - Cliente 3
```

### 3.3. Verificar en la App de Producción

1. **Espera 2-3 minutos** (para que Vercel termine el deployment)

2. **Abre tu app de producción:**
   ```
   https://tu-app.vercel.app
   ```

3. **Verifica que:**
   - ✅ Se vean los 3 clientes
   - ✅ Al seleccionar un cliente, se vean sus sedes
   - ✅ Los técnicos aparezcan en el drawer
   - ✅ Los tickets se muestren correctamente

---

## 🔍 PASO 4: Solución de Problemas

### Problema 1: "Archivo no encontrado"

**Error:**
```
❌ Archivo no encontrado: localStorage-export.json
```

**Solución:**
1. Verifica que el archivo esté en `c:\CorpFlowSFMAC\`
2. Ejecuta: `ls localStorage-export.json`
3. Si no está, vuelve al Paso 1.6

### Problema 2: "No hay clientes en localStorage"

**Error en consola del navegador:**
```
📊 Datos encontrados:
   Clientes: 0
   Técnicos: 0
   Tickets: 0
```

**Solución:**
1. Verifica que estés en `http://localhost:3000` (no en producción)
2. Verifica que hayas creado clientes en localhost
3. Abre DevTools → Application → Local Storage → `http://localhost:3000`
4. Verifica que existan las keys: `clients`, `technicians`, `tickets`

### Problema 3: "Error de conexión a Supabase"

**Error:**
```
❌ Error con "Cliente 2": fetch failed
```

**Solución:**
1. Verifica tu conexión a Internet
2. Verifica que las credenciales de Supabase sean correctas
3. Verifica que el proyecto de Supabase esté activo

### Problema 4: "Tickets omitidos"

**Mensaje:**
```
⚠️ Ticket TKT-001 omitido (cliente o sede no encontrados)
```

**Explicación:**
- El ticket tiene un `clienteId` o `sedeId` que no existe
- Esto es normal si los IDs no coinciden

**Solución:**
- Revisa el archivo `localStorage-export.json`
- Verifica que los tickets tengan `clienteId` y `sedeId` válidos

---

## 📊 PASO 5: Backup y Limpieza

### 5.1. Guardar Backup

**Recomendado:** Guarda una copia del archivo exportado

```powershell
Copy-Item localStorage-export.json localStorage-export-backup-$(Get-Date -Format 'yyyyMMdd').json
```

Esto crea un archivo como:
```
localStorage-export-backup-20260211.json
```

### 5.2. Opcional: Limpiar localStorage

**Solo si quieres empezar de cero en localhost:**

En la consola del navegador:
```javascript
localStorage.clear();
location.reload();
```

**⚠️ ADVERTENCIA:** Esto borrará TODOS los datos de localhost.

---

## ✅ CHECKLIST FINAL

Marca cada paso cuando lo completes:

### Paso 1: Exportar
- [ ] Servidor localhost corriendo
- [ ] Navegador abierto en `http://localhost:3000`
- [ ] Consola del navegador abierta
- [ ] Script de exportación ejecutado
- [ ] Archivo descargado
- [ ] Archivo movido a `c:\CorpFlowSFMAC\`
- [ ] Contenido del archivo verificado

### Paso 2: Migrar
- [ ] Terminal abierta
- [ ] Archivo existe (verificado con `Test-Path`)
- [ ] Script `sync_from_file.js` ejecutado
- [ ] Migración completada sin errores críticos
- [ ] Resumen final mostrado

### Paso 3: Verificar
- [ ] Supabase Dashboard revisado
- [ ] Clientes verificados (3)
- [ ] Sedes verificadas (~345)
- [ ] Técnicos verificados (5)
- [ ] Tickets verificados (12)
- [ ] App de producción verificada

### Paso 4: Backup
- [ ] Backup del archivo creado
- [ ] Archivo guardado en lugar seguro

---

## 🎯 RESULTADO ESPERADO

Al finalizar, deberías tener:

✅ **En Supabase:**
- 3 clientes (MiBanco + 2 más)
- ~345 sedes (310 de MiBanco + las nuevas)
- 5 técnicos
- 12 tickets

✅ **En tu computadora:**
- Archivo `localStorage-export.json` (datos originales)
- Archivo `localStorage-export-backup-YYYYMMDD.json` (backup)

✅ **En producción:**
- App funcionando con datos de Supabase
- Los 3 clientes visibles
- Todas las funcionalidades operativas

---

## 📞 ¿Necesitas Ayuda?

Si tienes problemas en algún paso:

1. **Revisa la sección "Solución de Problemas"**
2. **Verifica los logs en la terminal**
3. **Revisa la consola del navegador**
4. **Pregúntame específicamente en qué paso estás**

---

**¡Listo para empezar!** 🚀

Comienza con el **Paso 1.1** y avanza paso a paso.
