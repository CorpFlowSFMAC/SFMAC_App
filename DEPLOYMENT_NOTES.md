# Notas de Despliegue — Julio 2026

## Problema Resuelto
El dashboard de administración mostraba "Total: 0 registros" para Ingresos y Utilidad Neta en julio 2026 debido a que los tickets con estado `ticket_cerrado` tenían `closure_date = NULL`.

## Corrección de Datos (Ejecutada)
Se ejecutó el script `scratch/fix_closure_date_supabase.js` que actualizó 35 tickets:
```bash
node scratch/fix_closure_date_supabase.js
```

Esto populó `closure_date` con el valor de `updated_at` para todos los tickets `ticket_cerrado` con `closure_date = NULL`.

## Trigger Automático (Pendiente de crear manualmente)
Para evitar que este problema ocurra en el futuro, ejecutar el SQL en Supabase Dashboard > SQL Editor:

```sql
-- 1. Eliminar trigger y función existentes
DROP TRIGGER IF EXISTS tr_populate_closure_date ON tickets;
DROP FUNCTION IF EXISTS populate_closure_date_tg();

-- 2. Crear la función
CREATE OR REPLACE FUNCTION populate_closure_date_tg()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status_id IN ('ticket_cerrado', 'liquidado') AND NEW.closure_date IS NULL THEN
    NEW.closure_date := NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Crear el trigger
CREATE TRIGGER tr_populate_closure_date
BEFORE INSERT OR UPDATE ON tickets
FOR EACH ROW
EXECUTE FUNCTION populate_closure_date_tg();
```

Archivo de referencia: `scratch/create_trigger.sql`

## Lógica de Negocio Aplicada
- **Ingresos y Utilidad Neta** se calculan SOLO de tickets en estados `["ticket_cerrado", "liquidado"]`
- La fecha de referencia es `closure_date` (o `updated_at` como fallback)
- Un ticket califica para un mes si su `closure_date` corresponde a ese mes
- Esta es la lógica contable estricta: el ingreso existe solo cuando el trabajo está ejecutado y formalmente cerrado

## Scripts Disponibles
| Script | Propósito |
|--------|-----------|
| `scratch/fix_closure_date_supabase.js` | Actualiza NULLs existentes |
| `scratch/create_trigger.sql` | SQL para crear trigger automático |
| `scratch/diagnose_july2026.mjs` | Diagnóstico de tickets |

## Estado de Datos (Julio 2026)
| Métrica | Valor |
|---------|-------|
| Total tickets `ticket_cerrado` | 57 |
| Con `closure_date` poblado | 57 (100%) |
| Con `closure_date` en Julio 2026 | 1 |
| Con `closure_date` en Junio 2026 | 56 |
