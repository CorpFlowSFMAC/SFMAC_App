# SINFIMAC Ecosystem - Documentación del Repositorio

## 📋 Descripción General

**SINFIMAC** (Sistema Integral de Gestión de Facility Management y Control) es una plataforma web desarrollada con Next.js que sirve como sistema de gestión operativa para una empresa de facility management en Perú. La aplicación permite gestionar tickets de servicio, asignar técnicos, administrar clientes (bancos), controlar rutas de atención por zonas/geografías, y calcular bonificaciones de productividad para gestoras.

### Características Principales
- **Sistema de Tickets**: Creación, seguimiento y resolución de tickets de servicio
- **Gestión de Técnicos**: Alta, baja, asignación y control de técnicos de campo
- **Gestión de Clientes**: Administración de clientes/empresas (ej. Mibanco, BBVA, etc.)
- **Enrutamiento Inteligente**: Asignación en cascada Cliente → Zona → Agencia
- **Dashboard de Métricas**: Reportes de eficiencia y productividad
- **Auth con Azure AD**: Autenticación corporativa via Microsoft

---

## 🏗️ Arquitectura Técnica

### Stack Tecnológico
- **Framework**: Next.js 14+ (App Router)
- **Base de Datos**: Supabase (PostgreSQL)
- **Estado Global**: React Context + TanStack Query
- **Estilos**: CSS Modules + Tailwind
- **Autenticación**: Supabase Auth + OAuth Azure AD
- **UI**: Lucide React (iconos)

### Estructura de Directorios
```
/src
├── app/                    # Next.js App Router
│   ├── api/               # API Routes (webhooks, AI, HR)
│   │   ├── ai/            # Integraciones con Gemini
│   │   ├── hr/            # Gestión de productividad/bonos
│   │   └── webhooks/      # Webhooks externos (email, Make, Power Automate)
│   ├── dashboard/         # Área privada
│   │   ├── admin/         # Panel de Administrador
│   │   │   ├── tickets/   # Gestión de tickets
│   │   │   ├── technicians/
│   │   │   ├── clients/
│   │   │   ├── payments/
│   │   │   ├── reportes/
│   │   │   ├── routing/
│   │   │   ├── asistencia/
│   │   │   ├── closing/
│   │   │   └── usuarios/
│   │   ├── gestor/        # Panel de Gestora Operativa
│   │   └── sin-acceso/    # Sala de espera para usuarios sin rol
│   ├── login/             # Página de login
│   └── page.tsx           # Landing页
├── components/            # Componentes reutilizables
│   └── ServiceWorkerRegister.tsx
├── lib/                   # Lógica de negocio
│   ├── supabase.ts        # Cliente Supabase
│   ├── profiles-api.ts    # API de perfiles (RBAC)
│   ├── routing-api.ts     # Motor de enrutamiento
│   ├── supabase-api.ts    # CRUD general (clients, technicians, tickets)
│   ├── useQueryHooks.ts   # TanStack Query hooks
│   ├── AppDataContext.tsx # Estado global (React Context)
│   ├── calculations.ts    # Funciones de cálculo
│   ├── formatters.ts      # Formateo de datos
│   ├── ticketStates.ts    # Estados de tickets
│   ├── zones.ts           # Definiciones de zonas
│   └── peru-locations.ts  # Ubicaciones de Perú
└── middleware.ts          # Control de acceso (RBAC)
```

---

## 🔐 Sistema de Autenticación y RBAC

### Flujo de Autenticación
1. Usuario accede a `/login`
2. Puede autenticarse via:
   - **Azure AD**: OAuth con provider `azure` (redirect a Microsoft)
   - **Credenciales**: Email + contraseña (fallback legacy)
3. Tras autenticación, redirect a `/dashboard`
4. El gateway `/dashboard/page.tsx` procesa la sesión:
   - Consulta tabla `perfiles` para obtener el rol RBAC
   - Setea cookie `userRole` y localStorage
   - Redirige según el rol

### Roles RBAC
| Rol | Descripción | Dashboard |
|-----|-------------|-----------|
| `ADMIN` | Administrador completo | `/dashboard/admin` |
| `GESTORA` | Gestora operativa | `/dashboard/gestor` |
| `ESPECTADOR` | Solo lectura | `/dashboard/gestor` |
| `SIN_ACCESO` | Sin acceso, sala de espera | `/dashboard/sin-acceso` |

### Tabla `perfiles`
```sql
CREATE TABLE perfiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  nombre_completo TEXT,
  rol TEXT CHECK (rol IN ('ADMIN', 'GESTORA', 'ESPECTADOR', 'SIN_ACCESO')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

### Middleware (src/middleware.ts)
- Protege todas las rutas `/dashboard/*`
- Valida cookie `userRole`
- Redirige según rol:
  - `admin` → `/dashboard/admin`
  - `gestor`/`espectador` → `/dashboard/gestor`
  - `sin_acceso` → `/dashboard/sin-acceso`
  - Sin cookie → `/login`

---

## 🗄️ Conexión a Supabase

### Cliente Supabase (src/lib/supabase.ts)
```typescript
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
```

### Variables de Entorno Requeridas
```
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJxxxxx
```

### Tablas Principales
| Tabla | Descripción |
|-------|-------------|
| `perfiles` | Usuarios y roles RBAC |
| `clients` | Empresas/clientes (bancos) |
| `branch_offices` | Sucursales/agencias |
| `zonas` | Zonas geográficas por cliente |
| `gestoras` | Gestoras operativas |
| `technicians` | Técnicos de campo |
| `tickets` | Tickets de servicio |
| `gestoras_targets` | Metas y bonos de gestoras |
| `gestora_branch_assignments` | Asignaciones específicas de agencias |

---

## 🛣️ Sistema de Rutas

### Rutas Públicas
- `/` - Landing page
- `/login` - Login con Azure AD o credenciales

### Rutas Protegidas (middleware)
- `/dashboard` - Gateway de autenticación
- `/dashboard/admin` - Panel admin (solo ADMIN)
- `/dashboard/admin/tickets` - Tickets (ADMIN + GESTORA)
- `/dashboard/admin/technicians` - Técnicos (ADMIN + GESTORA)
- `/dashboard/admin/clients` - Clientes (solo ADMIN)
- `/dashboard/admin/payments` - Pagos (solo ADMIN)
- `/dashboard/admin/routing` - Enrutamiento (solo ADMIN)
- `/dashboard/admin/usuarios` - Gestión usuarios (solo ADMIN)
- `/dashboard/admin/reportes` - Reportes (ADMIN + GESTORA)
- `/dashboard/gestor` - Panel gestora (GESTORA/ESPECTADOR)
- `/dashboard/sin-acceso` - Sala de espera

### Navigación Admin
```typescript
// Sidebar del AdminLayout
const navItems = [
  { href: '/dashboard/admin', icon: LayoutDashboard, label: 'Inicio / Métricas', adminOnly: false },
  { href: '/dashboard/admin/clients', icon: Users, label: 'Gestión Clientes', adminOnly: true },
  { href: '/dashboard/admin/technicians', icon: UserCog, label: 'Gestión Técnicos', adminOnly: false },
  { href: '/dashboard/admin/tickets', icon: Ticket, label: 'Sistema Tickets', adminOnly: false },
  { href: '/dashboard/admin/payments', icon: DollarSign, label: 'Pagos y Tesorería', adminOnly: true },
  { href: '/dashboard/admin/reportes', icon: BarChart3, label: 'Reportes de Eficiencia', adminOnly: false },
  { href: '/dashboard/admin/routing', icon: Route, label: 'Enrutamiento', adminOnly: true },
  { href: '/dashboard/admin/asistencia', icon: Clock, label: 'Asistencia y Planillas', adminOnly: true },
  { href: '/dashboard/admin/closing', icon: Calculator, label: 'Cierre de Mes', adminOnly: true },
  { href: '/dashboard/admin/usuarios', icon: Shield, label: 'Usuarios y Accesos', adminOnly: true },
]
```

---

## 🎫 Sistema de Tickets

### Estados de Ticket
```typescript
// src/lib/ticketStates.ts
enum TicketState {
  CREADO = 'creado',
  ASIGNADO = 'asignado',
  EN_CAMINO = 'en_camino',
  ATENCION = 'atencion',
  PENDIENTE_REPUESTOS = 'pendiente_repuestos',
  REPARADO = 'reparado',
  COBRAR = 'cobrar',
  COBRADO = 'cobrado',
  CERRADO = 'cerrado'
}
```

### Flujo de Estados
```
creado → asignado → en_camino → atencion → reparado → cobrar → cobrado → cerrado
                                    ↓
                    pendiente_repuestos → ...
```

### Componentes Principales
- **TicketWindow.tsx**: Ventana principal de tickets (279KB - muy completo)
- **TicketSummary.tsx**: Resumen de ticket
- **CreateTicketWizard.tsx**: Wizard de creación (53KB)
- **TechnicianAssignment.tsx**: Asignación de técnicos
- **OnlineQuotationEditor.tsx**: Editor de cotizaciones

### API de Tickets (src/lib/supabase-api.ts)
```typescript
export const ticketsAPI = {
  async getAll()
  async getById(id: string)
  async create(data: TicketInput)
  async update(id: string, updates: Partial<Ticket>)
  async updatePaymentSafe(id, newPago, additionalUpdates)
  async delete(id: string)
  // ... más métodos
}
```

---

## 🔄 Motor de Enrutamiento (Cascada)

### Lógica de Asignación
El sistema resuelve la gestora asignada a una agencia en cascada:

1. **Agencia directa**: `branch.gestora_asignada_id`
2. **Asignación específica**: `gestora_branch_assignments` (agencias de otras zonas)
3. **Zona**: `zonas.gestora_asignada_id` (a través de `branch.zona_id`)
4. **Cliente**: `clients.gestora_asignada_id` (a través de `branch.client_id`)

### Tablas de Enrutamiento
```sql
-- Clients: Nivel Nacional
CREATE TABLE clients (
  id UUID PRIMARY KEY,
  name TEXT,
  gestora_asignada_id UUID REFERENCES gestoras(id)
);

-- Zonas: Nivel Regional
CREATE TABLE zonas (
  id UUID PRIMARY KEY,
  nombre TEXT,
  client_id UUID REFERENCES clients(id),
  gestora_asignada_id UUID REFERENCES gestoras(id)
);

-- Branch Offices: Nivel Agencia
CREATE TABLE branch_offices (
  id UUID PRIMARY KEY,
  name TEXT,
  client_id UUID REFERENCES clients(id),
  zona_id UUID REFERENCES zonas(id),
  gestora_asignada_id UUID REFERENCES gestoras(id)
);

-- Asignaciones específicas de gestoras a agencias
CREATE TABLE gestora_branch_assignments (
  gestiona_id UUID REFERENCES gestoras(id),
  branch_id UUID REFERENCES branch_offices(id)
);
```

### API de Routing (src/lib/routing-api.ts)
```typescript
export const routingAPI = {
  async assignGestoraToClient(clientId, rawGestoraId)
  async assignGestoraToZona(zonaId, gestoraId)
  async assignGestoraToBranch(branchId, rawGestoraId)
  async resolveGestora(branchId): Promise<string | null>  // ← Cascada
  async getRoutingSummary()
}

export const gestorasAPI = {
  async getAll()    // Combina gestoras de tabla legacy + perfiles RBAC
  async getById(id)
  async create(gestora)
  async update(id, updates)
  async delete(id)
}

export const zonasAPI = {
  async getAll()
  async getByClient(clientId)
  async create(zona)
  async updateGestora(id, rawGestoraId)
  async delete(id)
}

export const gestoraBranchAPI = {
  async getByGestora(rawGestoraId)
  async syncBranchAssignments(rawGestoraId, branchIds)
  async addBranch(rawGestoraId, branchId)
  async removeBranch(rawGestoraId, branchId)
}
```

---

## 📊 Estado Global (AppDataContext)

### Provider: AppDataProvider
- Envuelve toda la aplicación del dashboard
- Provee datos de clientes, técnicos, tickets, gestoras via React Context
- Usa TanStack Query internamente para cache y refetch

### Hook: useAppData()
```typescript
const {
  clients, loadingClients, refreshClients,
  technicians, loadingTechnicians, refreshTechnicians,
  tickets, loadingTickets, refreshTickets,
  gestoras, loadingGestoras, refreshGestoras,
  gestorasTargets, loadingTargets, refreshTargets,
  createTicket, updateTicket, updatePaymentSafe,
  setTarget
} = useAppData()
```

### Sincronización Realtime
- Canales Supabase Realtime para cada tabla
- Invalidación de caché automática en cambios
- Optimistic updates en el cliente

---

## 🤖 APIs Externas

### Webhooks
| Endpoint | Descripción |
|----------|-------------|
| `/api/webhooks/email-ticket` | Recibe tickets por email |
| `/api/webhooks/make-tickets` | Integración con Make.com |
| `/api/webhooks/power-automate-tickets` | Integración con Power Automate |

### AI (Gemini)
- `/api/ai/gemini/*` - Integración con Google Gemini para análisis

### HR/Productividad
- `/api/hr/productivity-bonus` - Cálculo de bonos de productividad

---

## 📝 Reglas de Negocio Importantes

### 1. Asignación de Tickets
- Un ticket se asigna a una gestora según el cliente/zona/agencia
- La gestora puede reasignar a un técnico de su zona
- El técnico actualiza el estado del ticket

### 2. Estados de Pago
- `cobrar`: Ticket requiere cobro al cliente
- `cobrado`: Pago registrado
- Solo usuarios ADMIN pueden modificar pagos

### 3. Metas de Gestoras
- Las gestoras tienen metas mensuales en `gestoras_targets`
- El sistema calcula bonificaciones según productividad
- Acceso: `/dashboard/admin/payments`

### 4. Permisos por Rol
| Recurso | ADMIN | GESTORA | ESPECTADOR |
|---------|-------|---------|------------|
| Crear clientes | ✅ | ❌ | ❌ |
| Ver clientes | ✅ | ❌ | ❌ |
| Gestionar técnicos | ✅ | ✅ | ❌ |
| Crear tickets | ✅ | ✅ | ❌ |
| Ver tickets | ✅ | ✅ | ✅ |
| Reportes | ✅ | ✅ | ✅ |
| Enrutamiento | ✅ | ❌ | ❌ |
| Usuarios/Accesos | ✅ | ❌ | ❌ |
| Pagos | ✅ | ❌ | ❌ |

### 5. Autenticación Azure AD
- Provider: Microsoft Azure AD (OIDC)
- Scopes: `openid profile email`
- Callback: `/dashboard` (procesa el hash de OAuth)

---

## 🔧 Configuración de Desarrollo

### Instalación
```bash
npm install
```

### Variables de Entorno
Crear `.env.local`:
```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJxxxxx
```

### Ejecución
```bash
npm run dev
```

### Build
```bash
npm run build
```

---

## 📁 Archivos Clave para Referencia

| Archivo | Propósito |
|---------|-----------|
| `src/middleware.ts` | Control de acceso RBAC |
| `src/app/dashboard/page.tsx` | Gateway de autenticación |
| `src/lib/profiles-api.ts` | API de perfiles RBAC |
| `src/lib/routing-api.ts` | Motor de enrutamiento |
| `src/lib/supabase-api.ts` | CRUD principal |
| `src/lib/useQueryHooks.ts` | TanStack Query hooks |
| `src/lib/AppDataContext.tsx` | Estado global |
| `src/lib/ticketStates.ts` | Estados de tickets |

---

*Documentación generada para comprensión del sistema SINFIMAC. Actualizado: 2026-04-27*