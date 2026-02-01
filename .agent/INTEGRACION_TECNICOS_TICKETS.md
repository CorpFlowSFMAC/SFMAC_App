# 🔗 INTEGRACIÓN MÓDULOS: TÉCNICOS ↔ TICKETS

## 📋 RESUMEN EJECUTIVO

Se ha creado un **sistema centralizado de tipos de servicio** que sirve como **fuente única de verdad** para ambos módulos, asegurando consistencia y mantenibilidad.

---

## 🎯 PROBLEMA RESUELTO

**Antes:**
- ❌ Tipos de servicio hardcoded en el wizard
- ❌ Especialidades hardcoded en técnicos
- ❌ Sin relación entre ambos módulos
- ❌ Difícil de mantener (cambios duplicados)

**Ahora:**
- ✅ **Single Source of Truth** en `/src/lib/serviceTypes.ts`
- ✅ Ambos módulos usan la misma fuente
- ✅ Fácil de mantener (un solo lugar)
- ✅ Tipos de servicio dinámicos

---

## 🗂️ ARQUITECTURA

```
📁 src/lib/serviceTypes.ts
    ↓
    ├─→ 🎫 Módulo de TICKETS (CreateTicketWizard.tsx)
    │   └─ Usa: SERVICE_TYPES[] para Paso 3
    │
    └─→ 👷 Módulo de TÉCNICOS (page.tsx)
        └─ Usa: SKILL_ICONS, SKILL_COLORS
```

---

## 📦 ARCHIVO CENTRALIZADO: `serviceTypes.ts`

### **Ubicación:**
```
src/lib/serviceTypes.ts
```

### **Contenido:**
```typescript
export interface ServiceType {
    id: string;              // "electricidad"
    nombre: string;          // "Electricidad"
    nombreCorto: string;     // "ELECTRICIDAD" (para técnicos)
    icon: LucideIcon;        // Zap
    color: string;           // "#FBBF24"
    descripcion?: string;    // Descripción larga
}

export const SERVICE_TYPES: ServiceType[] = [
    {
        id: "electricidad",
        nombre: "Electricidad",
        nombreCorto: "ELECTRICIDAD",
        icon: Zap,
        color: "#FBBF24"
    },
    // ... 6 más (Carpintería, Gasfitería, etc.)
];
```

---

## 🎨 TIPOS DE SERVICIO DISPONIBLES

| ID | Nombre | NombreCorto | Icon | Color | Uso en Técnicos |
|----|--------|-------------|------|-------|-----------------|
| `electricidad` | Electricidad | ELECTRICIDAD | ⚡ Zap | #FBBF24 | ✅ |
| `carpinteria` | Carpintería | CARPINTERÍA | 🔧 Wrench | #8B5CF6 | ✅ |
| `gasfiteria` | Gasfitería | GASFITERÍA | 💧 Droplet | #3B82F6 | ✅ |
| `albanileria` | Albañilería | ALBAÑILERÍA | 🏢 Building | #EF4444 | ✅ |
| `aire-acondicionado` | Aire Acondicionado | AIRE ACOND. | 💨 Wind | #10B981 | ✅ |
| `pintura` | Pintura | PINTURA | 🎨 Paintbrush | #F59E0B | ✅ |
| `refrigeracion` | Refrigeración | REFRIGERACIÓN | ❄️ Snowflake | #06B6D4 | ⚠️ Nuevo |

---

## 🔄 USO EN MÓDULO DE TICKETS

### **Archivo:** `CreateTicketWizard.tsx`

```typescript
import { SERVICE_TYPES } from "@/lib/serviceTypes";

// En el Paso 3
<div className={styles.serviciosGrid}>
    {SERVICE_TYPES.map(tipo => {
        const IconComponent = tipo.icon;
        const isSelected = formData.tipoServicio === tipo.id;
        
        return (
            <div key={tipo.id} onClick={() => handleSelect(tipo.id)}>
                <IconComponent size={32} color={tipo.color} />
                <span>{tipo.nombre}</span>
            </div>
        );
    })}
</div>
```

### **Datos Guardados:**
```javascript
{
    tipoServicio: "electricidad",         // ID
    tipoServicioNombre: "ELECTRICIDAD"    // NombreCorto
}
```

---

## 👷 USO EN MÓDULO DE TÉCNICOS

### **Archivo:** `page.tsx`

```typescript
import { SKILL_ICONS, SKILL_COLORS } from "@/lib/serviceTypes";

// En las tarjetas de técnicos
{tech.especialidades.map((skill: string) => {
    const Icon = SKILL_ICONS[skill] || Wrench;
    return (
        <div style={{ background: `${SKILL_COLORS[skill]}20` }}>
            <Icon size={12} color={SKILL_COLORS[skill]} />
            <span>{skill}</span>
        </div>
    );
})}
```

### **Especialidades en Técnicos:**
```javascript
{
    id: 1,
    nombre: "JUAN CARLOS",
    especialidades: ["ELECTRICIDAD", "GASFITERÍA"], // NombresCortos
    ...
}
```

---

## 🔗 RELACIÓN ENTRE MÓDULOS

### **Flujo de Datos:**

```
1. TICKET CREADO
   ├─ tipoServicio: "electricidad"
   └─ tipoServicioNombre: "ELECTRICIDAD"

2. BÚSQUEDA DE TÉCNICOS
   └─ findTechniciansByService("ELECTRICIDAD", allTechnicians)
       └─ Retorna técnicos con especialidades.includes("ELECTRICIDAD")

3. ASIGNACIÓN AUTOMÁTICA (Próximamente)
   └─ Filtrar por: especialidad + estado + zona
```

### **Helpers Disponibles:**

```typescript
// Desde serviceTypes.ts

// Obtener servicio por nombreCorto
getServiceByNombreCorto("ELECTRICIDAD")
// → { id: "electricidad", nombre: "Electricidad", ... }

// Obtener servicio por ID
getServiceById("electricidad")  
// → { id: "electricidad", nombre: "Electricidad", ... }

// Obtener icono
getServiceIcon("ELECTRICIDAD")
// → Zap

// Obtener color
getServiceColor("ELECTRICIDAD")
// → "#FBBF24"

// Encontrar técnicos por servicio
findTechniciansByService("ELECTRICIDAD", technicians)
// → [técnico1, técnico2, ...]
```

---

## 🎯 VENTAJAS DE ESTA ARQUITECTURA

### **1. Consistencia:**
- ✅ Mismos colores en ambos módulos
- ✅ Mismos iconos
- ✅ Mismos nombres

### **2. Mantenibilidad:**
- ✅ Un solo lugar para agregar servicios
- ✅ Cambios se propagan automáticamente
- ✅ Menos código duplicado

### **3. Escalabilidad:**
- ✅ Fácil agregar nuevos servicios
- ✅ Fácil agregar nuevas propiedades (ej: prioridad, costo base)
- ✅ Preparado para asignación automática

### **4. Type Safety:**
- ✅ Interface `ServiceType` con TypeScript
- ✅ Autocompletado en IDE
- ✅ Menos errores en tiempo de ejecución

---

## 📝 CÓMO AGREGAR UN NUEVO SERVICIO

### **Paso 1:** Editar `src/lib/serviceTypes.ts`

```typescript
import { Hammer } from "lucide-react"; // Importar ícono

export const SERVICE_TYPES: ServiceType[] = [
    // ... servicios existentes
    {
        id: "soldadura",
        nombre: "Soldadura",
        nombreCorto: "SOLDADURA",
        icon: Hammer,
        color: "#EF4444", // Rojo
        descripcion: "Soldadura industrial y artesanal"
    }
];
```

### **Paso 2:** ¡Listo!

Los cambios automáticamente aparecerán en:
- ✅ Wizard de creación de tickets (Paso 3)
- ✅ Módulo de técnicos (al asignar especialidades)

---

## 🧪 PRUEBAS

### **1. Verificar en Tickets:**
```
1. http://localhost:3000/dashboard/admin/tickets
2. Click "Crear Ticket"
3. Avanzar hasta Paso 3
4. ✅ Se deben mostrar 7 servicios con colores vibrantes
```

### **2. Verificar en Técnicos:**
```
1. http://localhost:3000/dashboard/admin/technicians
2. Ver tarjetas de técnicos
3. ✅ Badges de especialidades deben tener mismos colores e iconos
```

### **3. Verificar Helpers:**
```typescript
import { getServiceByNombreCorto } from "@/lib/serviceTypes";

const service = getServiceByNombreCorto("ELECTRICIDAD");
console.log(service);
// ✅ Debe retornar objeto completo con id, nombre, icon, color
```

---

## 🚀 PRÓXIMOS PASOS (FUTURO)

### **1. Asignación Automática de Técnicos:**
```typescript
// Cuando se crea un ticket
const tipoServicio = ticket.tipoServicioNombre; // "ELECTRICIDAD"
const sede = ticket.sede;

// Buscar técnicos disponibles
const techsDisponibles = findTechniciansByService(
    tipoServicio,
    allTechnicians
).filter(t => 
    t.zona === sede.zona && 
    t.estado === "Activo"
);

// Asignar al mejor técnico (menor carga actual)
const selectedTech = seleccionarMejorTecnico(techsDisponibles);
```

### **2. Dashboard de Especialidades:**
```typescript
// Estadísticas por tipo de servicio
SERVICE_TYPES.forEach(tipo => {
    const ticketsCount = tickets.filter(t => 
        t.tipoServicio === tipo.id
    ).length;
    
    const techsCount = technicians.filter(t =>
        t.especialidades.includes(tipo.nombreCorto)
    ).length;
    
    console.log(`${tipo.nombre}: ${ticketsCount} tickets, ${techsCount} técnicos`);
});
```

### **3. Validaciones:**
```typescript
// Antes de crear ticket, verificar que hay técnicos disponibles
const hayTecnicos = findTechniciansByService(
    tipoServicioNombre,
    allTechnicians
).length > 0;

if (!hayTecnicos) {
    alert(`⚠️ No hay técnicos disponibles para ${tipoServicio}`);
}
```

---

## 📊 ESTADO ACTUAL

```
✓ Sistema centralizado creado
✓ Wizard de tickets actualizado
✓ Módulo de técnicos actualizado
✓ 7 tipos de servicio disponibles
✓ Colores vibrantes aplicados
✓ Helpers implementados
✓ Compilación exitosa
```

---

## 🎨 PALETA DE COLORES POR SERVICIO

```css
Electricidad:      #FBBF24 (Amarillo Dorado)
Carpintería:       #8B5CF6 (Violeta)
Gasfitería:        #3B82F6 (Azul Brillante)
Albañilería:       #EF4444 (Rojo)
Aire Acond.:       #10B981 (Verde Esmeralda)
Pintura:           #F59E0B (Ámbar)
Refrigeración:     #06B6D4 (Cyan Brillante)
```

---

## ✅ CONCLUSIÓN

Los módulos de **Técnicos** y **Tickets** ahora están **completamente integrados** mediante un sistema centralizado de tipos de servicio, garantizando:

- 🎯 **Consistencia visual y funcional**
- 🔧 **Fácil mantenimiento**
- 🚀 **Preparado para asignación automática**
- 📈 **Escalable para futuros servicios**

**¡Todo listo para producción!** 🎉
