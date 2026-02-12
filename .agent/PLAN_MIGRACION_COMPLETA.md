# 🎯 PLAN DE MIGRACIÓN: localStorage → Supabase

## 📊 Situación Actual

### ✅ Datos Sincronizados Correctamente
```
Supabase (Producción):
├── BCP          (0 sedes)
├── MiBanco      (310 sedes)
└── SANTANDER    (0 sedes)

Total: 3 clientes ✅
```

### ❌ Problema Identificado
```
App de Producción:
├── Usa localStorage (datos del navegador)
├── Solo ve 1 cliente (MiBanco)
└── No lee de Supabase ❌

localhost:
├── Usa localStorage (datos del navegador)
├── Ve 3 clientes
└── No lee de Supabase ❌
```

---

## 🎯 OBJETIVO

Hacer que **TODA la aplicación** (localhost y producción) lea datos de **Supabase** en lugar de localStorage.

---

## 📋 PLAN DE ACCIÓN (3 Fases)

### **FASE 1: Actualizar Componentes Principales** ⭐ (CRÍTICO)

Estos son los componentes que necesitan cambiar de localStorage a Supabase:

#### 1.1. Dashboard de Admin
**Archivo:** `src/app/dashboard/admin/page.tsx`

**Cambio:**
```typescript
// ❌ ANTES (localStorage)
const [tickets] = useLocalStorage<any[]>("tickets", []);
const [technicians] = useLocalStorage<any[]>("technicians", []);

// ✅ DESPUÉS (Supabase)
import { useTickets, useTechnicians } from '@/hooks/useSupabaseData';

const { tickets, loading: loadingTickets } = useTickets();
const { technicians, loading: loadingTechs } = useTechnicians();
```

#### 1.2. Página de Tickets
**Archivo:** `src/app/dashboard/tickets/page.tsx`

**Cambio:**
```typescript
// ❌ ANTES
const [tickets, setTickets] = useLocalStorage<Ticket[]>("tickets", []);
const [clients, setClients] = useLocalStorage<Client[]>("clients", []);

// ✅ DESPUÉS
import { useTickets, useClients } from '@/hooks/useSupabaseData';

const { tickets, loading: loadingTickets, refresh: refreshTickets } = useTickets();
const { clients, loading: loadingClients } = useClients();
```

#### 1.3. Wizard de Creación de Tickets
**Archivo:** `src/components/CreateTicketWizard.tsx`

**Cambio:**
```typescript
// ❌ ANTES
const [clients] = useLocalStorage<Client[]>("clients", []);
const [tickets, setTickets] = useLocalStorage<Ticket[]>("tickets", []);

// ✅ DESPUÉS
import { useClients, useTickets } from '@/hooks/useSupabaseData';

const { clients, loading: loadingClients } = useClients();
const { createTicket, refresh: refreshTickets } = useTickets();
```

#### 1.4. Drawer de Técnicos
**Archivo:** `src/components/TechnicianDrawer.tsx`

**Cambio:**
```typescript
// ❌ ANTES
const [technicians, setTechnicians] = useLocalStorage<Technician[]>("technicians", []);

// ✅ DESPUÉS
import { useTechnicians } from '@/hooks/useSupabaseData';

const { technicians, createTechnician, updateTechnician } = useTechnicians();
```

---

### **FASE 2: Actualizar Componentes Secundarios**

#### 2.1. TicketWindow
**Archivo:** `src/components/TicketWindow.tsx`

#### 2.2. Módulos de Gestora
**Archivos:**
- `src/app/dashboard/gestora/page.tsx`
- Otros componentes que usen localStorage

---

### **FASE 3: Limpieza y Optimización**

#### 3.1. Remover Dependencias de localStorage
- Eliminar imports de `useLocalStorage` no usados
- Limpiar código legacy

#### 3.2. Remover Botón de Sincronización
- Ya no será necesario después de la migración
- Comentar `<SyncToSupabaseButton />` en admin page

#### 3.3. Testing Completo
- Verificar que todo funcione en localhost
- Verificar que todo funcione en producción

---

## 🚀 EJECUCIÓN INMEDIATA

### Opción A: Migración Completa (Recomendado)

**Ventajas:**
- ✅ Solución definitiva
- ✅ App completamente en Supabase
- ✅ Funciona en localhost y producción

**Desventajas:**
- ⏱️ Requiere actualizar varios archivos
- ⏱️ Tiempo estimado: 30-45 minutos

**Pasos:**
1. Actualizar componentes uno por uno
2. Probar en localhost
3. Commit y push a GitHub
4. Vercel despliega automáticamente
5. Verificar en producción

---

### Opción B: Migración Rápida (Solo Lectura)

**Ventajas:**
- ✅ Rápido (10 minutos)
- ✅ La app lee de Supabase inmediatamente

**Desventajas:**
- ⚠️ Solo lectura (no puede crear/editar)
- ⚠️ Solución temporal

**Pasos:**
1. Actualizar solo los componentes de lectura
2. Mantener localStorage para escritura
3. Deploy rápido

---

### Opción C: Modo Híbrido (Transición Gradual)

**Ventajas:**
- ✅ Funciona con localStorage Y Supabase
- ✅ Migración gradual sin romper nada

**Desventajas:**
- ⚠️ Más complejo
- ⚠️ Datos pueden desincronizarse

**Pasos:**
1. Usar hook `useHybridData` (ya existe)
2. Lee de Supabase, escribe en ambos
3. Migrar gradualmente

---

## 🎯 MI RECOMENDACIÓN

### **OPCIÓN A: Migración Completa** ⭐

**Razones:**
1. ✅ Es la solución definitiva
2. ✅ Los hooks ya están creados y probados
3. ✅ Tenemos ejemplos de implementación
4. ✅ No hay riesgo de desincronización
5. ✅ Una vez hecho, funciona para siempre

**Plan de ejecución:**
```
1. Actualizar CreateTicketWizard.tsx (15 min)
   ↓
2. Actualizar page.tsx de tickets (10 min)
   ↓
3. Actualizar page.tsx de admin (5 min)
   ↓
4. Probar en localhost (5 min)
   ↓
5. Commit + Push (2 min)
   ↓
6. Esperar deployment de Vercel (3 min)
   ↓
7. Verificar en producción (5 min)
   ↓
✅ LISTO - App 100% en Supabase
```

**Tiempo total:** 45 minutos

---

## 📝 ARCHIVOS A MODIFICAR (Opción A)

### Prioridad Alta (Críticos)
1. ✅ `src/components/CreateTicketWizard.tsx`
2. ✅ `src/app/dashboard/tickets/page.tsx`
3. ✅ `src/app/dashboard/admin/page.tsx`

### Prioridad Media
4. ⏳ `src/components/TechnicianDrawer.tsx`
5. ⏳ `src/components/TicketWindow.tsx`

### Prioridad Baja
6. ⏳ Otros componentes que usen localStorage

---

## 🔧 RECURSOS DISPONIBLES

### Documentación
- ✅ `.agent/HOOKS_SUPABASE_GUIA.md` - Guía completa de hooks
- ✅ `.agent/examples/CreateTicketWizardSupabase.example.tsx` - Ejemplo completo

### Hooks Listos
- ✅ `useClients()` - Gestión de clientes
- ✅ `useBranches()` - Gestión de sedes
- ✅ `useTechnicians()` - Gestión de técnicos
- ✅ `useTickets()` - Gestión de tickets
- ✅ `useHybridData()` - Modo híbrido (si es necesario)

### API Completa
- ✅ `src/lib/supabase-api.ts` - Todas las funciones CRUD

---

## ✅ SIGUIENTE PASO

**¿Qué opción prefieres?**

**A) Migración Completa** (45 min - Recomendado)
   - Actualizo todos los componentes principales
   - App 100% en Supabase
   - Solución definitiva

**B) Migración Rápida** (10 min - Solo lectura)
   - Solo actualizo lectura de datos
   - Funciona rápido pero limitado

**C) Modo Híbrido** (20 min - Transición gradual)
   - Lee de Supabase, escribe en ambos
   - Migración sin romper nada

---

**Dime cuál opción prefieres y empiezo inmediatamente.** 🚀
