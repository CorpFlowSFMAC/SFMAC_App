# 🎣 HOOKS DE SUPABASE - GUÍA DE USO

## 📋 Índice

1. [Hooks de Clientes](#hooks-de-clientes)
2. [Hooks de Sedes](#hooks-de-sedes)
3. [Hooks de Técnicos](#hooks-de-técnicos)
4. [Hooks de Tickets](#hooks-de-tickets)
5. [Hooks de Pagos](#hooks-de-pagos)
6. [Hooks de Evidencias](#hooks-de-evidencias)
7. [Hooks Utilitarios](#hooks-utilitarios)
8. [Ejemplos Completos](#ejemplos-completos)

---

## 🎯 Hooks de Clientes

### `useClients()`

Obtiene todos los clientes con operaciones CRUD.

```typescript
import { useClients } from '@/hooks/useSupabaseData';

function ClientsPage() {
  const { 
    clients,           // Array de clientes
    loading,           // Estado de carga
    error,             // Error si existe
    refresh,           // Función para recargar
    createClient,      // Crear cliente
    updateClient,      // Actualizar cliente
    deleteClient       // Eliminar cliente
  } = useClients();

  if (loading) return <div>Cargando...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <div>
      {clients.map(client => (
        <div key={client.id}>{client.name}</div>
      ))}
    </div>
  );
}
```

**Crear cliente:**
```typescript
const handleCreate = async () => {
  try {
    const newClient = await createClient({ name: 'Nuevo Cliente' });
    console.log('Cliente creado:', newClient);
  } catch (err) {
    console.error('Error:', err);
  }
};
```

**Actualizar cliente:**
```typescript
const handleUpdate = async (clientId: string) => {
  await updateClient(clientId, { name: 'Nombre Actualizado' });
};
```

**Eliminar cliente:**
```typescript
const handleDelete = async (clientId: string) => {
  await deleteClient(clientId);
};
```

### `useClient(id)`

Obtiene un cliente específico por ID.

```typescript
import { useClient } from '@/hooks/useSupabaseData';

function ClientDetail({ clientId }: { clientId: string }) {
  const { client, loading, error } = useClient(clientId);

  if (loading) return <div>Cargando...</div>;
  if (!client) return <div>Cliente no encontrado</div>;

  return <div>{client.name}</div>;
}
```

---

## 🏢 Hooks de Sedes

### `useBranches(clientId?)`

Obtiene todas las sedes o las de un cliente específico.

```typescript
import { useBranches } from '@/hooks/useSupabaseData';

// Todas las sedes
function AllBranches() {
  const { branches, loading } = useBranches();
  return <div>{branches.length} sedes</div>;
}

// Sedes de un cliente
function ClientBranches({ clientId }: { clientId: string }) {
  const { 
    branches, 
    loading, 
    createBranch,
    updateBranch,
    deleteBranch 
  } = useBranches(clientId);

  const handleCreate = async () => {
    await createBranch({
      client_id: clientId,
      name: 'Nueva Sede',
      address: 'Av. Principal 123',
      zone: 'LIMA'
    });
  };

  return (
    <div>
      {branches.map(branch => (
        <div key={branch.id}>
          {branch.name} - {branch.zone}
        </div>
      ))}
      <button onClick={handleCreate}>Agregar Sede</button>
    </div>
  );
}
```

### `useBranchesByZone(zone)`

Obtiene sedes filtradas por zona.

```typescript
import { useBranchesByZone } from '@/hooks/useSupabaseData';

function LimaBranches() {
  const { branches, loading } = useBranchesByZone('LIMA');
  
  return <div>{branches.length} sedes en Lima</div>;
}
```

---

## 👨‍🔧 Hooks de Técnicos

### `useTechnicians(status?)`

Obtiene todos los técnicos o filtrados por estado.

```typescript
import { useTechnicians } from '@/hooks/useSupabaseData';

// Todos los técnicos
function AllTechnicians() {
  const { technicians, loading, createTechnician } = useTechnicians();

  const handleCreate = async () => {
    await createTechnician({
      name: 'Juan Pérez',
      document_number: '12345678',
      phone: '+51987654321',
      email: 'juan@example.com',
      bank_name: 'BCP',
      account_number: '1234567890',
      cci: '00212345678901234567',
      yape_number: '987654321',
      status: 'active'
    });
  };

  return <div>{technicians.length} técnicos</div>;
}

// Solo técnicos activos
function ActiveTechnicians() {
  const { technicians, loading } = useTechnicians('active');
  
  return <div>{technicians.length} técnicos activos</div>;
}
```

**Actualizar técnico:**
```typescript
const { updateTechnician } = useTechnicians();

const handleUpdate = async (techId: string) => {
  await updateTechnician(techId, {
    status: 'inactive',
    phone: '+51999888777'
  });
};
```

---

## 🎫 Hooks de Tickets

### `useTickets(statusId?, technicianId?)`

Obtiene tickets con filtros opcionales.

```typescript
import { useTickets } from '@/hooks/useSupabaseData';

// Todos los tickets
function AllTickets() {
  const { 
    tickets, 
    loading, 
    createTicket,
    updateTicket,
    deleteTicket,
    refresh
  } = useTickets();

  const handleCreate = async () => {
    const newTicket = await createTicket({
      client_id: 'uuid-cliente',
      branch_id: 'uuid-sede',
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
    console.log('Ticket creado:', newTicket);
  };

  return (
    <div>
      {tickets.map(ticket => (
        <div key={ticket.id}>
          Ticket #{ticket.ticket_number} - {ticket.status_id}
        </div>
      ))}
    </div>
  );
}

// Tickets por estado
function NewTickets() {
  const { tickets, loading } = useTickets('nuevo');
  return <div>{tickets.length} tickets nuevos</div>;
}

// Tickets de un técnico
function TechnicianTickets({ techId }: { techId: string }) {
  const { tickets, loading } = useTickets(undefined, techId);
  return <div>{tickets.length} tickets asignados</div>;
}
```

**Actualizar estado de ticket:**
```typescript
const { updateTicket } = useTickets();

const handleAssign = async (ticketId: string, techId: string) => {
  await updateTicket(ticketId, {
    status_id: 'asignado',
    technician_id: techId
  });
};

const handleComplete = async (ticketId: string) => {
  await updateTicket(ticketId, {
    status_id: 'cerrado',
    closure_date: new Date().toISOString()
  });
};
```

### `useTicket(id)`

Obtiene un ticket específico con todas sus relaciones.

```typescript
import { useTicket } from '@/hooks/useSupabaseData';

function TicketDetail({ ticketId }: { ticketId: string }) {
  const { ticket, loading, updateTicket, refresh } = useTicket(ticketId);

  if (loading) return <div>Cargando...</div>;
  if (!ticket) return <div>Ticket no encontrado</div>;

  const handleStatusChange = async (newStatus: string) => {
    await updateTicket({ status_id: newStatus });
    refresh(); // Recargar datos
  };

  return (
    <div>
      <h2>Ticket #{ticket.ticket_number}</h2>
      <p>Cliente: {ticket.clients?.name}</p>
      <p>Sede: {ticket.branch_offices?.name}</p>
      <p>Técnico: {ticket.technicians?.name || 'Sin asignar'}</p>
      <p>Estado: {ticket.status_id}</p>
    </div>
  );
}
```

---

## 💰 Hooks de Pagos

### `useTicketPayments(ticketId)`

Obtiene todos los pagos de un ticket.

```typescript
import { useTicketPayments } from '@/hooks/useSupabaseData';

function TicketPayments({ ticketId }: { ticketId: string }) {
  const { 
    payments, 
    loading, 
    createPayment,
    updatePayment,
    deletePayment
  } = useTicketPayments(ticketId);

  const handleAddPayment = async () => {
    await createPayment({
      ticket_id: ticketId,
      amount: 500,
      payment_type: 'deposit',
      reference_number: 'OP-12345',
      status: 'completed'
    });
  };

  const totalPaid = payments.reduce((sum, p) => sum + Number(p.amount), 0);

  return (
    <div>
      <h3>Pagos: S/ {totalPaid}</h3>
      {payments.map(payment => (
        <div key={payment.id}>
          S/ {payment.amount} - {payment.payment_type}
        </div>
      ))}
      <button onClick={handleAddPayment}>Registrar Pago</button>
    </div>
  );
}
```

---

## 📸 Hooks de Evidencias

### `useTicketEvidences(ticketId)`

Obtiene todas las evidencias de un ticket.

```typescript
import { useTicketEvidences } from '@/hooks/useSupabaseData';

function TicketEvidences({ ticketId }: { ticketId: string }) {
  const { 
    evidences, 
    loading, 
    createEvidence,
    deleteEvidence
  } = useTicketEvidences(ticketId);

  const handleUpload = async (url: string) => {
    await createEvidence({
      ticket_id: ticketId,
      url: url,
      evidence_type: 'photo'
    });
  };

  return (
    <div>
      <h3>{evidences.length} evidencias</h3>
      {evidences.map(evidence => (
        <div key={evidence.id}>
          <img src={evidence.url} alt="Evidencia" />
          <button onClick={() => deleteEvidence(evidence.id)}>
            Eliminar
          </button>
        </div>
      ))}
    </div>
  );
}
```

---

## 🛠️ Hooks Utilitarios

### `useTicketStats()`

Obtiene estadísticas de tickets por estado.

```typescript
import { useTicketStats } from '@/hooks/useSupabaseData';

function TicketDashboard() {
  const { stats, loading } = useTicketStats();

  if (loading) return <div>Cargando estadísticas...</div>;

  return (
    <div>
      <div>Nuevos: {stats.nuevo || 0}</div>
      <div>Asignados: {stats.asignado || 0}</div>
      <div>En ejecución: {stats.en_ejecucion || 0}</div>
      <div>Cerrados: {stats.cerrado || 0}</div>
    </div>
  );
}
```

### `useHybridData()`

Modo híbrido: intenta Supabase, fallback a localStorage.

```typescript
import { useHybridData } from '@/hooks/useSupabaseData';
import { ticketsAPI } from '@/lib/supabase-api';

function HybridTickets() {
  const { data, loading, source } = useHybridData(
    () => ticketsAPI.getAll(),
    'tickets'
  );

  return (
    <div>
      <p>Fuente: {source}</p>
      <p>{data.length} tickets</p>
    </div>
  );
}
```

---

## 📚 Ejemplos Completos

### Ejemplo 1: Wizard de Creación de Tickets

```typescript
import { useState, useEffect } from 'react';
import { useClients, useBranches, useTickets } from '@/hooks/useSupabaseData';

export default function CreateTicketWizard() {
  const [step, setStep] = useState(1);
  const [selectedClient, setSelectedClient] = useState<any>(null);
  const [selectedBranch, setSelectedBranch] = useState<any>(null);

  // Hooks
  const { clients, loading: loadingClients } = useClients();
  const { branches, loading: loadingBranches } = useBranches(selectedClient?.id);
  const { createTicket } = useTickets();

  const handleSubmit = async (formData: any) => {
    try {
      const newTicket = await createTicket({
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
      // Cerrar wizard, mostrar éxito
    } catch (error) {
      console.error('❌ Error:', error);
    }
  };

  return (
    <div>
      {step === 1 && (
        <div>
          <h2>Selecciona Cliente</h2>
          {loadingClients ? (
            <div>Cargando...</div>
          ) : (
            clients.map(client => (
              <div 
                key={client.id}
                onClick={() => {
                  setSelectedClient(client);
                  setStep(2);
                }}
              >
                {client.name}
              </div>
            ))
          )}
        </div>
      )}

      {step === 2 && (
        <div>
          <h2>Selecciona Sede</h2>
          {loadingBranches ? (
            <div>Cargando...</div>
          ) : (
            branches.map(branch => (
              <div 
                key={branch.id}
                onClick={() => {
                  setSelectedBranch(branch);
                  setStep(3);
                }}
              >
                {branch.name} - {branch.zone}
              </div>
            ))
          )}
        </div>
      )}

      {/* Más pasos... */}
    </div>
  );
}
```

### Ejemplo 2: Dashboard de Técnico

```typescript
import { useTechnicians, useTickets } from '@/hooks/useSupabaseData';

function TechnicianDashboard({ techId }: { techId: string }) {
  const { technicians } = useTechnicians();
  const { tickets, updateTicket } = useTickets(undefined, techId);

  const technician = technicians.find(t => t.id === techId);
  const activeTickets = tickets.filter(t => 
    ['asignado', 'en_ejecucion'].includes(t.status_id)
  );

  const handleStartWork = async (ticketId: string) => {
    await updateTicket(ticketId, {
      status_id: 'en_ejecucion',
      execution_date: new Date().toISOString()
    });
  };

  return (
    <div>
      <h1>Hola, {technician?.name}</h1>
      <p>{activeTickets.length} tickets activos</p>
      
      {activeTickets.map(ticket => (
        <div key={ticket.id}>
          <h3>Ticket #{ticket.ticket_number}</h3>
          <p>{ticket.branch_offices?.name}</p>
          <p>{ticket.description}</p>
          
          {ticket.status_id === 'asignado' && (
            <button onClick={() => handleStartWork(ticket.id)}>
              Iniciar Trabajo
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
```

### Ejemplo 3: Gestión de Pagos

```typescript
import { useTicket, useTicketPayments } from '@/hooks/useSupabaseData';

function TicketFinancial({ ticketId }: { ticketId: string }) {
  const { ticket } = useTicket(ticketId);
  const { payments, createPayment } = useTicketPayments(ticketId);

  const totalQuoted = Number(ticket?.total_quoted_amount || 0);
  const totalPaid = payments.reduce((sum, p) => sum + Number(p.amount), 0);
  const remaining = totalQuoted - totalPaid;

  const handleAddDeposit = async (amount: number, reference: string) => {
    await createPayment({
      ticket_id: ticketId,
      amount: amount,
      payment_type: 'deposit',
      reference_number: reference,
      status: 'completed'
    });
  };

  return (
    <div>
      <h2>Liquidación Financiera</h2>
      <div>Monto cotizado: S/ {totalQuoted}</div>
      <div>Total pagado: S/ {totalPaid}</div>
      <div>Saldo: S/ {remaining}</div>

      <h3>Historial de Pagos</h3>
      {payments.map(payment => (
        <div key={payment.id}>
          {new Date(payment.payment_date).toLocaleDateString()} - 
          S/ {payment.amount} - 
          {payment.reference_number}
        </div>
      ))}
    </div>
  );
}
```

---

## ✅ Ventajas de Usar los Hooks

1. **Abstracción Completa:** No necesitas llamar a la API directamente
2. **Estado Automático:** Loading, error, y datos manejados automáticamente
3. **Reactividad:** Los componentes se actualizan cuando cambian los datos
4. **Reutilización:** Usa el mismo hook en múltiples componentes
5. **TypeScript:** Tipado completo para mejor DX
6. **CRUD Integrado:** Crear, leer, actualizar, eliminar en un solo hook
7. **Modo Híbrido:** Fallback a localStorage si Supabase falla

---

## 🔄 Migración desde localStorage

### Antes (localStorage)
```typescript
const [tickets, setTickets] = useState([]);

useEffect(() => {
  const stored = localStorage.getItem('tickets');
  if (stored) {
    setTickets(JSON.parse(stored));
  }
}, []);
```

### Después (Supabase)
```typescript
const { tickets, loading } = useTickets();
```

---

**Última actualización:** 11 Febrero 2026  
**Archivo:** `src/hooks/useSupabaseData.ts`
