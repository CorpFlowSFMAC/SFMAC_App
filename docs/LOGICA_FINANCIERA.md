# Documentación del Motor Financiero y Lógica de Cálculos - SINFIMAC

Esta documentación detalla el funcionamiento del motor financiero centralizado (`calculations.ts`), que rige la rentabilidad de los tickets, los saldos de mano de obra y la categorización de gastos en todo el sistema.

---

## 1. Conceptos Fundamentales

### A. Ingresos (Venta)
*   **Monto Total Cotizado:** Es el valor final que se factura al cliente.
*   **Monto Base:** Si el ticket incluye IGV, el sistema calcula automáticamente el monto base restando el impuesto para que la rentabilidad se calcule sobre la utilidad real neta de la empresa.
*   **Campos de Referencia:** `total_quoted_amount`, `monto_final`, `ingresos_reales`.

### B. Mano de Obra Pactada (MO)
*   Representa el presupuesto asignado al técnico principal para la ejecución del servicio.
*   Es un **pasivo (deuda)** para la empresa desde el momento en que se aprueba la cotización.
*   **Campos de Referencia:** `labor_cost`, `monto_pactado_mo`.

### C. Gastos Operativos (Compras)
*   Incluye todo egreso adicional necesario para el servicio: materiales, viáticos, logística y pagos a especialistas externos (terceros).
*   Estos montos **reducen directamente la utilidad** del ticket.

---

## 2. Reglas de Categorización (Categorization Engine)

El sistema distingue automáticamente entre qué pagos afectan la deuda con el técnico y qué pagos afectan la utilidad del ticket.

### ¿Qué es Gasto Operativo? (`isOperating`)
Un ítem se considera gasto operativo si cumple cualquiera de estas condiciones:
1.  **Categoría:** Logística, Materiales, Viáticos, Insumos, Movilidad, Envíos, Repuestos.
2.  **Especialistas Externos:** Si un pago es de categoría "Mano de Obra" pero el `specialist_id` es **diferente** al ID del técnico principal del ticket.
3.  **Concepto:** Si contiene palabras clave como "compra", "taxi", "bus", "peaje", etc.

### ¿Qué es Mano de Obra (Técnico)? (`isLabor`)
Un ítem se considera pago de MO si:
1.  Es de categoría "Mano de Obra" y el beneficiario es el **técnico principal** del ticket.
2.  No cumple con ninguna de las reglas de Gasto Operativo.
3.  Reduce el saldo pendiente de la "Mano de Obra Pactada".

---

## 3. Fórmulas de Cálculo

### Rentabilidad Real (Utilidad Neta)
La rentabilidad es lo que queda para la empresa después de cubrir todos los costos previstos y reales.
> **Fórmula:** `Monto Base (Sin IGV)` - `Mano de Obra Pactada` - `Gastos Operativos Confirmados`

*Ejemplo (Ticket MB000009.26):*
*   Venta: S/ 4,720.00
*   MO Pactada: S/ 2,000.00
*   Gastos (Logística + Especialista): S/ 600.00
*   **Rentabilidad Real:** 4,720 - 2,000 - 600 = **S/ 2,120.00**

### Saldo Pendiente del Técnico
Es el monto que la empresa aún le debe al técnico principal.
> **Fórmula:** `Mano de Obra Pactada` - `Total Pagos de MO Confirmados`

---

## 4. Estados de Pago y su Impacto

*   **PAGADO / CONFIRMADO:** El monto se resta inmediatamente de la utilidad (si es gasto) o del saldo del técnico (si es MO).
*   **PENDIENTE:** No afecta la rentabilidad real todavía, pero se muestra como una "alerta" de gasto proyectado.
*   **RECHAZADO:** El monto no tiene ningún impacto financiero en los cálculos de utilidad ni de saldos.

---

## 5. Implementación Técnica

La lógica reside principalmente en `src/lib/calculations.ts` bajo la función `calculateTicketFinances`. Esta función es consumida por:
*   **Tesorería (`payments/page.tsx`):** Para mostrar los montos por desembolsar y la utilidad estirada.
*   **Resumen de Ticket (`TicketSummary.tsx`):** Para la barra de liquidación financiera.
*   **Reportes (`reportes/page.tsx`):** Para el cálculo de márgenes globales.

---

*Documentación generada el 09 de mayo de 2026 para la versión 3.0 del Motor Financiero SINFIMAC.*
