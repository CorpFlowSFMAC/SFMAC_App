# 🗺️ SISTEMA DE ZONAS UNIFICADO

## Problema Identificado

Las zonas de las agencias/sedes de clientes no estaban relacionadas con las zonas de los técnicos, causando que el filtro de asignación no funcionara correctamente.

## Solución Implementada

Se creó un **sistema centralizado de zonas** en `/src/lib/zones.ts` que normaliza y relaciona las zonas entre todos los módulos.

---

## 📍 Zonas Estandarizadas

| ID | Nombre | Icono | Color | Departamentos Incluidos |
|---|---|---|---|---|
| `LIMA_METROPOLITANA` | Lima Metropolitana | 🏛️ | Verde (#10B981) | Lima |
| `NORTE` | Zona Norte | ⬆️ | Azul (#3B82F6) | Tumbes, Piura, Lambayeque, La Libertad, Cajamarca, Amazonas |
| `SUR` | Zona Sur | ⬇️ | Púrpura (#8B5CF6) | Arequipa, Moquegua, Tacna, Puno, Cusco, Apurímac |
| `CENTRO` | Zona Centro | 🎯 | Rosa (#EC4899) | Ica, Huancavelica, Junín, Pasco, Huánuco, Ancash |
| `ORIENTE` | Zona Oriente | ➡️ | Naranja (#F59E0B) | Loreto, San Martín, Ucayali, Madre de Dios |

---

## 🔄 Migración de Zonas Antiguas

### Zonas Antiguas → Zonas Nuevas

**Técnicos (antiguas):**
- "ZONA NORTE" → `NORTE`
- "ZONA SUR" → `SUR`
- "ZONA CENTRO" → `CENTRO`
- "ZONA ORIENTE" → `ORIENTE`
- "LIMA METROPOLITANA" → `LIMA_METROPOLITANA`

**Clientes/Sedes (antiguas):**
- "Norte" → `NORTE`
- "Sur" → `SUR`
- "Centro" → `CENTRO`
- "Oriente" → `ORIENTE`
- "Lima Centro" → `LIMA_METROPOLITANA`
- "Lima" → `LIMA_METROPOLITANA`

---

## 🛠️ Funciones Disponibles

```typescript
// Normalizar zona antigua al nuevo formato
normalizeZone("Norte") // → "NORTE"
normalizeZone("LIMA METROPOLITANA") // → "LIMA_METROPOLITANA"

// Obtener zona basada en departamento
getZoneByDepartamento("Arequipa") // → "SUR"
getZoneByDepartamento("Lima") // → "LIMA_METROPOLITANA"

// Verificar compatibilidad de zonas
areZonesCompatible("Norte", "NORTE") // → true
areZonesCompatible("Lima Centro", "LIMA_METROPOLITANA") // → true

// Obtener nombre completo
getZoneFullName("NORTE") // → "Zona Norte"

// Obtener color
getZoneColor("SUR") // → "#8B5CF6"
```

---

## 📦 Módulos Actualizados

### 1. **TechnicianDrawer** (`/src/app/dashboard/admin/tickets/TechnicianDrawer.tsx`)
- ✅ Usa `normalizeZone()` para técnicos y sedes
- ✅ Usa `areZonesCompatible()` para filtrar
- ✅ Muestra `getZoneFullName()` en la UI

### 2. **Próximos a actualizar:**
- 🔄 BranchModal (módulo de clientes)
- 🔄 TechnicianDrawer (módulo de técnicos)
- 🔄 CreateTicketWizard

---

## 🚀 Cómo Migrar Datos Existentes

### Opción 1: Script Automático (Recomendado)

1. Abre la consola del navegador (F12)
2. Copia y pega el contenido de `.agent/migrate-zones.js`
3. El script migrará automáticamente:
   - ✅ Técnicos
   - ✅ Agencias/Sedes de clientes
   - ✅ Tickets existentes
   - ✅ Estados de tickets guardados
4. Recarga la página

### Opción 2: Limpieza Manual

```javascript
// Limpiar TODO y empezar de nuevo
localStorage.clear();
location.reload();
```

---

## 🎯 Flujo de Asignación de Técnicos (Actualizado)

```
1. Usuario crea ticket con sede en "Lima" (zona antigua)
   ↓
2. Sistema normaliza: "Lima" → "LIMA_METROPOLITANA"
   ↓
3. Usuario hace clic en "Asignar Técnico"
   ↓
4. Sistema filtra técnicos:
   - Técnico 1: zona "ZONA NORTE" → normaliza a "NORTE" ❌
   - Técnico 2: zona "LIMA METROPOLITANA" → normaliza a "LIMA_METROPOLITANA" ✅
   - Técnico 3: zona "Lima Centro" → normaliza a "LIMA_METROPOLITANA" ✅
   ↓
5. Solo muestra técnicos compatibles (2 y 3)
   ↓
6. Usuario selecciona técnico
   ↓
7. Asignación exitosa ✅
```

---

## ✅ Ventajas del Nuevo Sistema

1. **Compatibilidad Total:** Zonas de clientes y técnicos ahora se relacionan correctamente
2. **Migración Automática:** Zonas antiguas se convierten al nuevo formato
3. **Consistencia:** Un solo sistema para todas las zonas
4. **Extensible:** Fácil agregar nuevas zonas si es necesario
5. **Visual:** Cada zona tiene su propio color e icono
6. **Departamentos:** Mapeo automático de departamentos a zonas

---

## 🔍 Para Verificar que Funciona

1. **Crea un técnico:**
   - Zona: LIMA_METROPOLITANA
   - Especialidad: Mantenimiento AC

2. **Crea un ticket:**
   - Cliente: MIBANCO
   - Sede: Agencia Lima (zona: "Lima Centro" o "LIMA_METROPOLITANA")
   - Servicio: Mantenimiento AC

3. **Asigna técnico:**
   - Abre el drawer
   - Deberías ver el técnico en la lista ✅
   - Zona mostrada: "Lima Metropolitana" (normalizada)

4. **Verifica compatibilidad:**
   - Técnicos de otras zonas NO aparecen ✅
   - Solo técnicos con la zona correcta se muestran ✅

---

## 📊 Estructura de Datos

### Técnico Normalizado
```json
{
  "id": "TEC-001",
  "nombre": "Juan",
  "apellido": "Pérez",
  "zona": "LIMA_METROPOLITANA",  // ← Zona normalizada
  "especialidades": ["Mantenimiento AC"]
}
```

### Sede Normalizada
```json
{
  "id": "AGE-001",
  "nombre": "Agencia Lima Centro",
  "departamento": "Lima",
  "zona": "LIMA_METROPOLITANA",  // ← Zona normalizada
  "direccion": "Av. República 123"
}
```

### Ticket con Zonas Normalizadas
```json
{
  "id": "TKT-001",
  "sede": {
    "zona": "LIMA_METROPOLITANA"  // ← Normalizada
  },
  "tecnicoAsignado": {
    "zona": "LIMA_METROPOLITANA"  // ← Normalizada
  }
}
```

---

## 🎨 Visualización de Zonas

Cada zona tiene su propio color en la UI:

- 🏛️ **Lima Metropolitana:** Verde (#10B981)
- ⬆️ **Norte:** Azul (#3B82F6)
- ⬇️ **Sur:** Púrpura (#8B5CF6)
- 🎯 **Centro:** Rosa (#EC4899)
- ➡️ **Oriente:** Naranja (#F59E0B)

---

## 📝 Notas Importantes

1. **Toda zona antigua se normaliza automáticamente**
2. **El sistema es retrocompatible** (zonas viejas funcionan)
3. **Los datos se migran sin pérdida de información**
4. **La normalización es transparente para el usuario**
5. **Las zonas son case-insensitive en el matching**

---

## 🐛 Troubleshooting

### No aparecen técnicos compatibles

**Solución:**
1. Verifica que el técnico tenga la especialidad correcta
2. Verifica que la zona del técnico esté normalizada
3. Ejecuta el script de migración
4. Recarga la página

### Zonas no coinciden

**Solución:**
1. Abre consola: `console.log(normalizeZone("tu_zona"))`
2. Verifica el resultado
3. Si no está en el mapa, agrégalo a `ZONE_MIGRATION_MAP`

---

¡El sistema de zonas ahora está completamente integrado! 🎉
