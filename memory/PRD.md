# SINFIMAC Platform — PRD

## Problema reportado (Ene 2026)
> "la bandeja del usuario administrador no carga los tikets, mientras que la gestora si puede visualizar ticket — revisa analiza y repara"

## Stack
- Next.js 16 + React 19 + Supabase + Azure AD (login)
- Auth: Azure AD callback → cookies (userRole, userEmail, userName, userAvatar)

## Bug fix aplicado (Ene 2026)
**Causa raíz:** Azure AD callback solo escribe cookies, nunca localStorage. La página
`/dashboard/admin/tickets/page.tsx` leía exclusivamente localStorage, así que para un
admin recién logueado:
- `isAdminState=false` (no leía cookie de rol)
- `myGestoraId=null` (no leía cookie de email)
- `isVisibleForMe()` retornaba `false` para todos los tickets → bandeja vacía.

La gestora no veía el bug porque su page tiene fallback a cookies y `isVisibleForMe`
retorna `true` cuando no hay myGestoraId.

**Archivos modificados:**
- `src/app/dashboard/admin/layout.tsx` — sync cookies → localStorage on mount
- `src/app/dashboard/admin/tickets/page.tsx` — init y fetchGestora con fallback a cookies; removido widget de debug
- `src/app/dashboard/gestor/page.tsx` — refuerzo paralelo (cookie fallback para userRole, soporte SUPERADMIN)

## Status
- TypeScript: compila sin errores (tsc --noEmit OK)
- Bandeja admin ahora carga tickets correctamente

## Backlog / Next
- Considerar centralizar la lectura de identidad (cookies + localStorage + supabase.auth)
  en un único hook `useAuthIdentity()` para evitar la duplicación de lógica.

## Iteración 2 (Ene 2026) — Aislamiento gestora + unificación de bandeja
**Reportado:** "bandeja de gestores solo deben visualizar sus tickets asignados.
restructura la bandeja del gestor con el mismo formato de presentación de ticket
al igual que la bandeja del administrador"

**Cambios:**
- `src/app/dashboard/gestor/page.tsx`:
  - `isVisibleForMe`: ahora retorna `false` cuando no hay match. Antes retornaba
    `true` cuando no había `myGestoraId` o cuando la cascada no aplicaba — eso
    permitía que una gestora viera tickets ajenos.
  - La vista "Tickets" del dashboard ahora renderiza `<AdminTicketsPage />` en lugar
    de la lista horizontal anterior. Resultado: misma presentación de cards,
    kanban operativo, búsqueda global, triage/activos/cerrados.
  - La barra de filtros de fecha/prioridad/servicio sólo se muestra en la vista
    "Métricas" (dashboard), no en "Tickets".

**Validación:** `tsc --noEmit` OK.
