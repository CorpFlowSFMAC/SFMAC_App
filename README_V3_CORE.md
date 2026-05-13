# SFMAC Core Architecture - Financial V3

Este documento define la ley inmutable que rige el sistema financiero del ERP SFMAC. Cualquier refactorización futura debe respetar estos principios para evitar regresiones o duplicidad de datos.

## 1. El Principio de Identidad Única
El sistema se rige por la **Ley del ID Único**. 
*   Cada transacción en `ticket_costs` es independiente.
*   La deduplicación automática contra el historial Legacy solo ocurre si existe una coincidencia de ID o si el timestamp difiere por menos de **1 minuto** (Heurística de Seguridad).
*   **Diferentes IDs = Diferentes Pagos**. Nunca se deben agrupar o esconder registros con IDs distintos.

## 2. Motor Bipartito (Clasificación de Canal)
La arquitectura financiera separa estrictamente los flujos de dinero en dos canales:
1.  **Mano de Obra (Labor):** Pagos directos al técnico principal (Adelantos, Rescates, Liquidación Final).
2.  **Gastos Operativos (Operating):** Pagos a terceros, compras de materiales, viáticos y logística.

Cualquier cálculo de rentabilidad (`realProfitability`) debe restar ambos canales del ingreso facturado al cliente.

## 3. Sincronización en Tiempo Real (Realtime Sync)
*   **Propagación Directa:** El estado del ticket en la UI (`TicketWindow`) se sincroniza directamente con los props del `AppDataContext`.
*   **Merge Inteligente:** Durante una actualización Realtime, se preservan los campos locales en edición (diagnóstico, partidas) mientras se sincronizan los campos financieros del servidor (status, costos).

## 4. Inmutabilidad de Auditoría
*   Los registros de `ticket_costs` no deben borrarse manualmente por el usuario. 
*   Cualquier eliminación administrativa debe pasar por el flujo de **Hard Delete** con validación de dependencias.

---
*Versión: 3.0.0 (Quirúrgica)*
*Estado: Producción Estable*
