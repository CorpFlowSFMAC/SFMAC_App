# SINFIMAC - Scripts de Mantenimiento de Base de Datos

## ⚠️ ADVERTENCIA
Estos scripts eliminan datos de forma permanente. Úsalos con precaución.

---

## 🗑️ Limpieza Total de Base de Datos

### Opción 1: SQL Script (Recomendado para Supabase Dashboard)

1. Ve a [Supabase Dashboard](https://supabase.com/dashboard)
2. Selecciona tu proyecto → **SQL Editor**
3. Copia el contenido de `db-cleanup.sql`
4. Pégalo y ejecuta

### Opción 2: Script Node.js (para automatización CI/CD)

```bash
# Configurar la key
export SUPABASE_SERVICE_ROLE_KEY="tu_service_role_key"

# Ver estado (sin confirmar)
node scripts/db-cleanup.mjs

# Ejecutar limpieza
node scripts/db-cleanup.mjs --confirm
# O shorthand
node scripts/db-cleanup.mjs -y
```

---

## 📊 Tablas Afectadas

| Tabla | Descripción |
|-------|-------------|
| `tickets` | Tickets de servicio principales |
| `ticket_payments` | Pagos asociados a tickets |
| `ticket_costs` | Costos (MO, materiales, movilidad) |
| `ticket_evidences` | Evidencias fotográficas |
| `debug_logs` | Logs de desarrollo |
| `gestora_branch_assignments` | Asignaciones gestoras-agencias |
| `technician_branches` | Asignación técnicos-agencias |

---

## 📋 Lo que NO se elimina

- `clients` - Clientes (bancos)
- `branch_offices` - Sedes/agencias  
- `gestoras` - Gestoras operativas
- `technicians` - Técnicos
- `zonas` - Zonas geográficas
- `perfiles` - Usuarios y roles
- `turnos` - Turnos de trabajo

---

## 🔄 Restaurar desde Backup

Si necesitas restaurar, usa la función de Point-in-Time Recovery de Supabase:
1. Ve a **Database** → **Point in Time Recovery**
2. Selecciona el momento antes de la limpieza
3. Crea una nueva分支 para restaurar

---

## 🧪 Verificar Limpieza

Después de ejecutar, verifica en el SQL Editor:

```sql
SELECT 
    'tickets' AS tabla, COUNT(*) AS total FROM tickets
UNION ALL
SELECT 'ticket_payments', COUNT(*) FROM ticket_payments
UNION ALL
SELECT 'ticket_costs', COUNT(*) FROM ticket_costs
UNION ALL
SELECT 'ticket_evidences', COUNT(*) FROM ticket_evidences;
```

Todos deben retornar `0` o `1` (1 si hay constraint de no null).