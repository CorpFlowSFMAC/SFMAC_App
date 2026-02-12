# 🔗 INTEGRACIÓN SUPABASE - GUÍA COMPLETA

## 📋 RESUMEN

Se ha completado la **integración completa con Supabase** para el proyecto CorpFlowSFMAC. La base de datos ahora contiene:

- ✅ **1 Cliente:** MiBanco
- ✅ **310 Sedes:** Migradas desde CSV con zonas asignadas
- ✅ **Políticas RLS:** Corregidas y securizadas
- ✅ **API TypeScript:** Módulo completo de integración

---

## 🗄️ ESTADO DE LA BASE DE DATOS

### Tablas Configuradas

| Tabla | Registros | RLS | Estado |
|-------|-----------|-----|--------|
| `clients` | 1 | ✅ | Activo |
| `branch_offices` | 310 | ✅ | Activo |
| `tickets` | 0 | ✅ | Listo |
| `technicians` | 0 | ✅ | Listo |
| `ticket_payments` | 0 | ✅ | Listo |
| `ticket_evidences` | 0 | ✅ | Listo |

### Distribución de Sedes por Zona

```
LIMA          ~150 sedes
NORTE         ~80 sedes
SUR           ~50 sedes
CENTRO        ~20 sedes
ORIENTE       ~10 sedes
```

---

## 🔐 POLÍTICAS DE SEGURIDAD RLS

### Antes (❌ Inseguro)
```sql
-- Todas las tablas tenían:
USING (true)  -- Acceso sin restricciones
```

### Después (✅ Seguro)

#### Clientes y Sedes
```sql
-- Lectura pública (para wizard de tickets)
CREATE POLICY "Public read access" ON public.clients
    FOR SELECT USING (true);

-- Escritura solo autenticados
CREATE POLICY "Authenticated write access" ON public.clients
    FOR ALL 
    USING (auth.role() = 'authenticated')
    WITH CHECK (auth.role() = 'authenticated');
```

#### Tickets, Técnicos, Pagos, Evidencias
```sql
-- Solo usuarios autenticados
CREATE POLICY "Authenticated full access" ON public.tickets
    FOR ALL
    USING (auth.role() = 'authenticated')
    WITH CHECK (auth.role() = 'authenticated');
```

---

## 📦 API DE INTEGRACIÓN

### Ubicación
```
src/lib/supabase-api.ts
```

### Módulos Disponibles

#### 1. **clientsAPI**
```typescript
import { clientsAPI } from '@/lib/supabase-api';

// Obtener todos los clientes
const clients = await clientsAPI.getAll();

// Obtener por ID
const client = await clientsAPI.getById('uuid');

// Crear cliente
const newClient = await clientsAPI.create({ name: 'Nuevo Cliente' });

// Actualizar
await clientsAPI.update('uuid', { name: 'Nombre Actualizado' });

// Eliminar
await clientsAPI.delete('uuid');
```

#### 2. **branchesAPI**
```typescript
import { branchesAPI } from '@/lib/supabase-api';

// Todas las sedes
const branches = await branchesAPI.getAll();

// Por cliente
const clientBranches = await branchesAPI.getByClient('client-uuid');

// Por zona
const limaBranches = await branchesAPI.getByZone('LIMA');

// Crear sede
const newBranch = await branchesAPI.create({
  client_id: 'uuid',
  name: 'Agencia Centro',
  address: 'Av. Principal 123',
  zone: 'LIMA'
});
```

#### 3. **techniciansAPI**
```typescript
import { techniciansAPI } from '@/lib/supabase-api';

// Todos los técnicos
const techs = await techniciansAPI.getAll();

// Por estado
const activeTechs = await techniciansAPI.getByStatus('active');

// Crear técnico
const newTech = await techniciansAPI.create({
  name: 'Juan Pérez',
  document_number: '12345678',
  phone: '+51987654321',
  email: 'juan@example.com',
  bank_name: 'BCP',
  account_number: '1234567890',
  cci: '00212345678901234567',
  yape_number: '987654321',
  plin_number: '987654321',
  status: 'active'
});
```

#### 4. **ticketsAPI**
```typescript
import { ticketsAPI } from '@/lib/supabase-api';

// Todos los tickets (con relaciones)
const tickets = await ticketsAPI.getAll();

// Por estado
const newTickets = await ticketsAPI.getByStatus('nuevo');

// Por técnico
const techTickets = await ticketsAPI.getByTechnician('tech-uuid');

// Crear ticket
const newTicket = await ticketsAPI.create({
  client_id: 'uuid',
  branch_id: 'uuid',
  technician_id: 'uuid',
  status_id: 'nuevo',
  description: 'Problema con AC',
  client_ticket_number: 'INC-12345',
  labor_cost: 500,
  materials_cost: 200,
  visit_cost: 100,
  total_quoted_amount: 800,
  metadata: {
    priority: 'high',
    service_type: 'refrigeracion'
  }
});

// Actualizar estado
await ticketsAPI.update('ticket-uuid', {
  status_id: 'asignado',
  technician_id: 'tech-uuid'
});
```

#### 5. **paymentsAPI**
```typescript
import { paymentsAPI } from '@/lib/supabase-api';

// Pagos de un ticket
const payments = await paymentsAPI.getByTicket('ticket-uuid');

// Registrar pago
const payment = await paymentsAPI.create({
  ticket_id: 'uuid',
  amount: 500,
  payment_type: 'deposit',
  reference_number: 'OP-12345',
  status: 'completed'
});
```

#### 6. **evidencesAPI**
```typescript
import { evidencesAPI } from '@/lib/supabase-api';

// Evidencias de un ticket
const evidences = await evidencesAPI.getByTicket('ticket-uuid');

// Agregar evidencia
const evidence = await evidencesAPI.create({
  ticket_id: 'uuid',
  url: 'https://storage.supabase.co/...',
  evidence_type: 'photo'
});
```

---

## 🔄 MIGRACIÓN DE DATOS LOCALES

### Opción 1: Migración Manual (Recomendada)

Para migrar datos existentes de `localStorage` a Supabase:

```typescript
// Ejemplo: Migrar técnicos
import { techniciansAPI } from '@/lib/supabase-api';

async function migrateTechnicians() {
  const localTechs = JSON.parse(localStorage.getItem('technicians') || '[]');
  
  for (const tech of localTechs) {
    await techniciansAPI.create({
      name: tech.nombre,
      document_number: tech.dni,
      phone: tech.telefono,
      email: tech.email,
      // ... mapear campos
    });
  }
}
```

### Opción 2: Modo Híbrido (Transición)

Usar ambos sistemas temporalmente:

```typescript
// Hook personalizado
function useTickets() {
  const [tickets, setTickets] = useState([]);
  
  useEffect(() => {
    // Intentar cargar de Supabase
    ticketsAPI.getAll()
      .then(setTickets)
      .catch(() => {
        // Fallback a localStorage
        const local = JSON.parse(localStorage.getItem('tickets') || '[]');
        setTickets(local);
      });
  }, []);
  
  return tickets;
}
```

---

## 🚀 PRÓXIMOS PASOS

### 1. Actualizar Componentes (Prioridad Alta)

#### CreateTicketWizard
```typescript
// Antes
const clients = JSON.parse(localStorage.getItem('clients') || '[]');

// Después
import { clientsAPI, branchesAPI } from '@/lib/supabase-api';

const [clients, setClients] = useState([]);
const [branches, setBranches] = useState([]);

useEffect(() => {
  clientsAPI.getAll().then(setClients);
}, []);

// Al seleccionar cliente
const handleClientSelect = async (clientId: string) => {
  const clientBranches = await branchesAPI.getByClient(clientId);
  setBranches(clientBranches);
};
```

#### TechnicianDrawer
```typescript
// Antes
const technicians = JSON.parse(localStorage.getItem('technicians') || '[]');

// Después
import { techniciansAPI } from '@/lib/supabase-api';

const [technicians, setTechnicians] = useState([]);

useEffect(() => {
  techniciansAPI.getByStatus('active').then(setTechnicians);
}, []);
```

### 2. Crear Hooks Personalizados

```typescript
// src/hooks/useSupabaseData.ts
import { useState, useEffect } from 'react';
import { clientsAPI, branchesAPI, ticketsAPI, techniciansAPI } from '@/lib/supabase-api';

export function useClients() {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    clientsAPI.getAll()
      .then(setClients)
      .catch(setError)
      .finally(() => setLoading(false));
  }, []);

  return { clients, loading, error };
}

export function useBranches(clientId?: string) {
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (clientId) {
      branchesAPI.getByClient(clientId)
        .then(setBranches)
        .finally(() => setLoading(false));
    } else {
      branchesAPI.getAll()
        .then(setBranches)
        .finally(() => setLoading(false));
    }
  }, [clientId]);

  return { branches, loading };
}

export function useTickets(statusId?: string) {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = statusId 
      ? ticketsAPI.getByStatus(statusId)
      : ticketsAPI.getAll();
    
    fetch
      .then(setTickets)
      .finally(() => setLoading(false));
  }, [statusId]);

  const createTicket = async (ticketData: any) => {
    const newTicket = await ticketsAPI.create(ticketData);
    setTickets(prev => [newTicket, ...prev]);
    return newTicket;
  };

  const updateTicket = async (id: string, updates: any) => {
    const updated = await ticketsAPI.update(id, updates);
    setTickets(prev => prev.map(t => t.id === id ? updated : t));
    return updated;
  };

  return { tickets, loading, createTicket, updateTicket };
}

export function useTechnicians(status?: string) {
  const [technicians, setTechnicians] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = status
      ? techniciansAPI.getByStatus(status)
      : techniciansAPI.getAll();
    
    fetch
      .then(setTechnicians)
      .finally(() => setLoading(false));
  }, [status]);

  return { technicians, loading };
}
```

### 3. Actualizar Módulos Principales

#### Orden de Migración Recomendado:

1. ✅ **Clientes y Sedes** (Ya migrado)
2. 🔄 **Técnicos** (Siguiente)
3. 🔄 **Tickets** (Después)
4. 🔄 **Pagos y Evidencias** (Final)

---

## 📝 EJEMPLO COMPLETO: Crear Ticket con Supabase

```typescript
// CreateTicketWizard.tsx
import { useState, useEffect } from 'react';
import { clientsAPI, branchesAPI, ticketsAPI } from '@/lib/supabase-api';

export default function CreateTicketWizard() {
  const [clients, setClients] = useState([]);
  const [branches, setBranches] = useState([]);
  const [selectedClient, setSelectedClient] = useState(null);
  const [selectedBranch, setSelectedBranch] = useState(null);
  const [loading, setLoading] = useState(false);

  // Cargar clientes al montar
  useEffect(() => {
    clientsAPI.getAll().then(setClients);
  }, []);

  // Cargar sedes al seleccionar cliente
  useEffect(() => {
    if (selectedClient) {
      branchesAPI.getByClient(selectedClient.id).then(setBranches);
    }
  }, [selectedClient]);

  const handleCreateTicket = async (formData: any) => {
    setLoading(true);
    try {
      const newTicket = await ticketsAPI.create({
        client_id: selectedClient.id,
        branch_id: selectedBranch.id,
        status_id: 'nuevo',
        description: formData.description,
        client_ticket_number: formData.ticketNumber,
        metadata: {
          service_type: formData.serviceType,
          priority: formData.priority
        }
      });

      console.log('✅ Ticket creado:', newTicket);
      // Cerrar wizard, mostrar éxito, etc.
    } catch (error) {
      console.error('❌ Error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    // ... JSX del wizard
  );
}
```

---

## ✅ CHECKLIST DE INTEGRACIÓN

### Base de Datos
- [x] Migración de 310 sedes
- [x] Políticas RLS corregidas
- [x] Cliente MiBanco configurado
- [ ] Migrar técnicos existentes
- [ ] Migrar tickets de prueba

### Código
- [x] API de Supabase creada (`supabase-api.ts`)
- [ ] Hooks personalizados (`useSupabaseData.ts`)
- [ ] Actualizar `CreateTicketWizard`
- [ ] Actualizar `TechnicianDrawer`
- [ ] Actualizar `TicketsPage`
- [ ] Actualizar módulo de clientes

### Testing
- [ ] Probar creación de tickets
- [ ] Probar asignación de técnicos
- [ ] Probar actualización de estados
- [ ] Probar pagos y evidencias

---

## 🔧 COMANDOS ÚTILES

### Verificar Estado de la BD
```bash
node -e "
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://xqnghcdndqicqofnxvuf.supabase.co', 'sb_publishable_DHL-l6BH0dVVfvNFYG9kdQ_18F8SeL3');

(async () => {
  const { data: clients } = await supabase.from('clients').select('count');
  const { data: branches } = await supabase.from('branch_offices').select('count');
  const { data: tickets } = await supabase.from('tickets').select('count');
  const { data: techs } = await supabase.from('technicians').select('count');
  
  console.log('Clientes:', clients);
  console.log('Sedes:', branches);
  console.log('Tickets:', tickets);
  console.log('Técnicos:', techs);
})();
"
```

### Limpiar Datos de Prueba
```sql
-- En Supabase SQL Editor
DELETE FROM tickets;
DELETE FROM technicians;
-- Las sedes y clientes se mantienen
```

---

## 📚 RECURSOS

- [Documentación Supabase](https://supabase.com/docs)
- [Supabase JS Client](https://supabase.com/docs/reference/javascript/introduction)
- [Row Level Security](https://supabase.com/docs/guides/auth/row-level-security)

---

**Última actualización:** 11 Febrero 2026  
**Estado:** ✅ Base de datos sincronizada y lista para integración
