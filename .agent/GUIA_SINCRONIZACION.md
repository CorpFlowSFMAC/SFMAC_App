# 🔄 GUÍA DE SINCRONIZACIÓN: localhost ↔ Supabase

## 🎯 Problema Identificado

**Situación actual:**
- 🖥️ **localhost:** Usa `localStorage` (datos en tu navegador)
- ☁️ **Producción:** Usa Supabase (base de datos en la nube)
- ❌ **Resultado:** Los datos no coinciden

**Datos actuales:**
```
localhost (localStorage):
├── 3 clientes
├── X sedes
├── X técnicos
└── X tickets

Producción (Supabase):
├── 1 cliente (MiBanco)
├── 310 sedes
├── 0 técnicos
└── 0 tickets
```

---

## ✅ Solución: Sincronización en 2 Pasos

### **Paso 1: Migrar datos de localhost a Supabase** ⬆️
### **Paso 2: Actualizar localhost para usar Supabase** 🔄

---

## 📋 PASO 1: Migrar Datos (localStorage → Supabase)

### Opción A: Script Automático en el Navegador (Recomendado)

1. **Abre tu localhost en el navegador:**
   ```
   http://localhost:3000
   ```

2. **Abre la consola del navegador:**
   - Presiona `F12`
   - O clic derecho → "Inspeccionar" → pestaña "Console"

3. **Copia el script de sincronización:**
   - Archivo: `.agent/sync-localhost-to-supabase.js`
   - Copia TODO el contenido

4. **Pega en la consola y presiona Enter**

5. **Espera a que termine:**
   ```
   🔄 Iniciando sincronización localStorage → Supabase...
   
   📋 Paso 1: Migrando clientes...
      ✅ Cliente "MiBanco" creado en Supabase
      ✅ Cliente "Cliente 2" creado en Supabase
      ✅ Cliente "Cliente 3" creado en Supabase
      📊 Total: 3 clientes procesados
   
   🏢 Paso 2: Migrando sedes...
      ✅ Sede "Agencia Centro" creada
      ✅ Sede "Agencia Norte" creada
      📊 Total: X sedes nuevas creadas
   
   👨‍🔧 Paso 3: Migrando técnicos...
      ✅ Técnico "Juan Pérez" creado
      📊 Total: X técnicos nuevos creados
   
   🎫 Paso 4: Migrando tickets...
      ✅ Ticket #TKT-001 migrado
      📊 Total: X tickets creados
   
   ✅ SINCRONIZACIÓN COMPLETADA
   ```

### Opción B: Script Node.js (Alternativa)

Si prefieres ejecutar desde la terminal:

```bash
# Crear script de migración
node migrate_localhost_data.js
```

---

## 📋 PASO 2: Actualizar Componentes para Usar Supabase

Una vez migrados los datos, actualiza los componentes para que usen Supabase en lugar de localStorage.

### 2.1. Actualizar CreateTicketWizard

**Archivo:** `src/app/dashboard/admin/tickets/CreateTicketWizard.tsx`

**Antes (localStorage):**
```typescript
const [clients, setClients] = useState([]);

useEffect(() => {
  const stored = localStorage.getItem('clients');
  if (stored) {
    setClients(JSON.parse(stored));
  }
}, []);
```

**Después (Supabase):**
```typescript
import { useClients, useBranches } from '@/hooks/useSupabaseData';

const { clients, loading: loadingClients } = useClients();
const { branches, loading: loadingBranches } = useBranches(selectedClientId);
```

**Referencia completa:**
- Ver: `.agent/examples/CreateTicketWizardSupabase.example.tsx`

### 2.2. Actualizar TicketsPage

**Archivo:** `src/app/dashboard/admin/tickets/page.tsx`

**Antes:**
```typescript
const [tickets, setTickets] = useLocalStorage('tickets', []);
```

**Después:**
```typescript
import { useTickets } from '@/hooks/useSupabaseData';

const { tickets, loading, createTicket, updateTicket } = useTickets();
```

### 2.3. Actualizar TechnicianDrawer

**Archivo:** `src/app/dashboard/admin/tickets/TechnicianDrawer.tsx`

**Antes:**
```typescript
const [technicians, setTechnicians] = useLocalStorage('technicians', []);
```

**Después:**
```typescript
import { useTechnicians } from '@/hooks/useSupabaseData';

const { technicians, loading } = useTechnicians('active');
```

---

## 🔍 Verificación de Sincronización

### Verificar en Supabase Dashboard

1. **Ir a Supabase Dashboard:**
   ```
   https://supabase.com/dashboard/project/xqnghcdndqicqofnxvuf
   ```

2. **Ir a "Table Editor"**

3. **Verificar cada tabla:**
   - ✅ `clients` - Debe tener 3+ clientes
   - ✅ `branch_offices` - Debe tener todas las sedes
   - ✅ `technicians` - Debe tener todos los técnicos
   - ✅ `tickets` - Debe tener todos los tickets

### Verificar con SQL

```sql
-- Contar registros
SELECT 
  'clients' as tabla, 
  COUNT(*) as total 
FROM clients
UNION ALL
SELECT 'branch_offices', COUNT(*) FROM branch_offices
UNION ALL
SELECT 'technicians', COUNT(*) FROM technicians
UNION ALL
SELECT 'tickets', COUNT(*) FROM tickets;
```

### Verificar en la App de Producción

1. **Desplegar cambios a Vercel:**
   ```bash
   git push origin main
   ```

2. **Esperar deployment automático** (2-3 minutos)

3. **Abrir app de producción:**
   ```
   https://tu-app.vercel.app
   ```

4. **Verificar que se vean los 3 clientes**

---

## 🛠️ Modo Híbrido (Transición)

Si quieres una transición gradual, usa el hook `useHybridData`:

```typescript
import { useHybridData } from '@/hooks/useSupabaseData';
import { clientsAPI } from '@/lib/supabase-api';

function MyComponent() {
  const { data: clients, source } = useHybridData(
    () => clientsAPI.getAll(),
    'clients'
  );

  // source será 'supabase' o 'localStorage'
  console.log('Fuente de datos:', source);

  return (
    <div>
      {clients.map(client => (
        <div key={client.id}>{client.name}</div>
      ))}
    </div>
  );
}
```

**Ventajas:**
- ✅ Intenta Supabase primero
- ✅ Fallback automático a localStorage si falla
- ✅ No rompe la app si Supabase está caído
- ✅ Transición suave

---

## 📊 Checklist de Sincronización

### Fase 1: Migración de Datos
- [ ] Ejecutar script de sincronización en localhost
- [ ] Verificar datos en Supabase Dashboard
- [ ] Confirmar que todos los clientes están en Supabase
- [ ] Confirmar que todas las sedes están en Supabase
- [ ] Confirmar que todos los técnicos están en Supabase
- [ ] Confirmar que todos los tickets están en Supabase

### Fase 2: Actualización de Código
- [ ] Actualizar `CreateTicketWizard.tsx` para usar hooks
- [ ] Actualizar `TicketsPage.tsx` para usar hooks
- [ ] Actualizar `TechnicianDrawer.tsx` para usar hooks
- [ ] Actualizar módulo de clientes para usar hooks
- [ ] Probar en localhost que todo funciona

### Fase 3: Despliegue
- [ ] Commit y push de cambios
- [ ] Verificar deployment en Vercel
- [ ] Probar app de producción
- [ ] Confirmar que se ven los 3 clientes en producción

---

## ⚠️ Consideraciones Importantes

### 1. **Backup de localStorage**

Antes de migrar, haz un backup:

```javascript
// En la consola del navegador
const backup = {
  clients: localStorage.getItem('clients'),
  technicians: localStorage.getItem('technicians'),
  tickets: localStorage.getItem('tickets'),
  timestamp: new Date().toISOString()
};

console.log('Backup:', JSON.stringify(backup));
// Copia el output y guárdalo en un archivo
```

### 2. **Duplicados**

El script verifica duplicados por nombre/documento antes de crear:
- ✅ Clientes: Por nombre
- ✅ Sedes: Por nombre + cliente
- ✅ Técnicos: Por número de documento
- ✅ Tickets: Siempre crea nuevos (con ID original en metadata)

### 3. **Mapeo de IDs**

Los IDs de localStorage son diferentes a los de Supabase:
- localStorage: `"CLI-001"`, `"TKT-123"`
- Supabase: UUIDs (`"b65727ed-94d3-46ef-ab7d-62621ec46acb"`)

El script maneja esto automáticamente.

### 4. **Relaciones**

El script mantiene las relaciones:
- Ticket → Cliente (via `client_id`)
- Ticket → Sede (via `branch_id`)
- Ticket → Técnico (via `technician_id`)
- Sede → Cliente (via `client_id`)

---

## 🚀 Comandos Rápidos

### Verificar estado actual de Supabase
```bash
node -e "
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://xqnghcdndqicqofnxvuf.supabase.co', 'sb_publishable_DHL-l6BH0dVVfvNFYG9kdQ_18F8SeL3');

(async () => {
  const { data: clients } = await supabase.from('clients').select('*');
  console.log('Clientes en Supabase:', clients.length);
  clients.forEach(c => console.log('  -', c.name));
})();
"
```

### Limpiar datos de Supabase (si necesitas empezar de nuevo)
```sql
-- ⚠️ CUIDADO: Esto borra TODOS los datos
DELETE FROM ticket_evidences;
DELETE FROM ticket_payments;
DELETE FROM tickets;
DELETE FROM technicians;
DELETE FROM branch_offices WHERE client_id != 'b65727ed-94d3-46ef-ab7d-62621ec46acb';
DELETE FROM clients WHERE name != 'MiBanco';
```

---

## 📞 Soporte

Si encuentras problemas:

1. **Revisa la consola del navegador** para errores
2. **Verifica las credenciales** de Supabase
3. **Confirma que RLS** permite las operaciones
4. **Revisa los logs** en Supabase Dashboard

---

**Última actualización:** 11 Febrero 2026  
**Estado:** ✅ Script de sincronización listo para usar
