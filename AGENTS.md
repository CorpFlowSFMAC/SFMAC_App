# SINFIMAC - Conocimiento del Repositorio

## Reglas de Negocio - Pagos y Costos

### Regla: Estados de Pago en ticket_costs

**Regla Fija (2026-05-18)**: Toda solicitud de pago criada por el gestor (o cualquier usuario) debe nacer con estado `pendiente` en la tabla `ticket_costs`. Solo Tesorería/Admin puede cambiar el estado a `pagado`.

#### Locos donde se DEBE crear como "pendiente":
- Adelanto Operativo (Mano de Obra) - línea 1758 de TicketWindow.tsx ✅
- Adelanto Operativo (Materiales) - línea 1874 de TicketWindow.tsx ✅
- Gastos de Movilidad (ticket anulado) - línea 1517 de TicketWindow.tsx ✅
- Compras/Materiales del técnico - línea 2284 de TicketWindow.tsx ✅
- Rescate Financiero - línea 2445 de TicketWindow.tsx ✅

#### Lugares donde se cambia a "pagado" (solo Admin/Tesorería):
- Panel de pagos (`/dashboard/admin/payments`) - el admin confirman manually
- Líneas 1709-1710 de TicketWindow.tsx (cuando el admin confirma un inmue pendientes)

### Bug Corregido (2026-05-18)

**Problema**: Cuando el gestor hacía click en "Solicitar Adelanto" después confirmaba el inmue en el modal, el sistema automáticamente creaba el registro en `ticket_costs` con `estado_pago: "pagado"`, saltándose la validación del admin.

**Solución**: En `src/app/dashboard/admin/tickets/TicketWindow.tsx`, línea 1758:
- Antes: `estado_pago: "pagado"`
- Después: `estado_pago: "pendiente"`

**Archivo modificado**: `src/app/dashboard/admin/tickets/TicketWindow.tsx`