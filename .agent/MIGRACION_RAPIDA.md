# 🎯 MIGRACIÓN RÁPIDA - OPCIÓN B (Versión Simplificada)

## 📋 Resumen en 5 Pasos

```
┌─────────────────────────────────────────────────────────┐
│  PASO 1: Exportar datos del navegador                  │
│  ↓                                                      │
│  PASO 2: Guardar archivo en el proyecto                │
│  ↓                                                      │
│  PASO 3: Ejecutar script de migración                  │
│  ↓                                                      │
│  PASO 4: Verificar en Supabase                         │
│  ↓                                                      │
│  PASO 5: ✅ Listo!                                      │
└─────────────────────────────────────────────────────────┘
```

---

## 🚀 PASO 1: Exportar Datos

### En el navegador:

1. **Abre:** `http://localhost:3000`

2. **Presiona:** `F12` (abre la consola)

3. **Copia y pega esto:**
   ```javascript
   // Archivo: .agent/export-localhost-data.js
   // (Copia TODO el contenido del archivo)
   ```

4. **Presiona:** `Enter`

5. **Resultado:** Se descarga `localStorage-export.json`

---

## 💾 PASO 2: Guardar Archivo

1. **Encuentra el archivo** en tu carpeta de Descargas

2. **Muévelo a:**
   ```
   c:\CorpFlowSFMAC\localStorage-export.json
   ```

3. **Verifica que esté ahí:**
   ```powershell
   Test-Path .\localStorage-export.json
   # Debe decir: True
   ```

---

## ⚡ PASO 3: Migrar a Supabase

### En la terminal:

```powershell
node sync_from_file.js
```

**Espera a ver:**
```
✅ SINCRONIZACIÓN COMPLETADA

📊 ESTADO FINAL EN SUPABASE:
   Clientes: 3
   Sedes: 345
   Técnicos: 5
   Tickets: 12
```

---

## ✅ PASO 4: Verificar

### Opción A: En Supabase Dashboard

1. Ve a: https://supabase.com/dashboard/project/xqnghcdndqicqofnxvuf
2. Click en "Table Editor"
3. Revisa la tabla `clients` → Debes ver 3 clientes

### Opción B: En la terminal

```powershell
node -e "const { createClient } = require('@supabase/supabase-js'); const supabase = createClient('https://xqnghcdndqicqofnxvuf.supabase.co', 'sb_publishable_DHL-l6BH0dVVfvNFYG9kdQ_18F8SeL3'); (async () => { const { data } = await supabase.from('clients').select('name'); console.log('Clientes:', data.length); data.forEach(c => console.log('  -', c.name)); })();"
```

---

## 🎉 PASO 5: ¡Listo!

Tus datos ya están en Supabase y sincronizados con producción.

---

## ⚠️ Problemas Comunes

### "Archivo no encontrado"
```powershell
# Verifica que esté en la ubicación correcta
ls localStorage-export.json
```

### "No hay clientes en localStorage"
- Asegúrate de estar en `localhost:3000` (no en producción)
- Verifica que hayas creado clientes antes

### "Error de conexión"
- Verifica tu conexión a Internet
- Verifica que Supabase esté activo

---

## 📚 Documentación Completa

Para más detalles, ver:
- **Guía completa:** `.agent/GUIA_MIGRACION_OPCION_B.md`
- **Solución de problemas:** Sección "PASO 4" de la guía completa

---

**Tiempo estimado:** 5-10 minutos  
**Dificultad:** ⭐⭐☆☆☆ (Fácil)
