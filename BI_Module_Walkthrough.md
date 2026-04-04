# 📊 Módulo de Inteligencia de Negocios y Eficiencia Operativa

Hemos transformado el panel de reportes básico en un centro de comando de **Business Intelligence (BI)** y **Control Financiero**. El sistema ahora cruza la productividad operativa con el rendimiento financiero en tiempo real.

## 🚀 Innovaciones Implementadas

### 1. Centro de Comando de Controller Financiero
- **Corte Mensual Real:** Los contadores y métricas se reinician automáticamente el día 1 de cada mes (00:00).
- **Cálculo de Rentabilidad Neta:** No solo mostramos facturación, sino la utilidad real descontando:
  - `Inversión Directa`: Pagos a técnicos por ticket.
  - `Costo Laboral`: Sueldo base del gestor (almacenado en DB).
  - `Recursos Asignados`: Costos operativos fijos por gestor.

### 2. Visualizaciones Premium (Custom SVG)
Evitamos librerías pesadas usando componentes SVG nativos optimizados:
- **🎯 Funnel de Gestión:** Visualiza la "tasa de conversión" de tickets desde Nuevos hasta Cerrados.
- **🕒 Speedometer de Respuesta:** Mide la velocidad de cierre (SLA) con alertas visuales (Verde < 24h, Ámbar < 48h, Rojo > 48h).
- **📊 Gráfico de Doble Eje:** Compara la Facturación bruta vs. la Rentabilidad neta por cliente de forma simultánea.

### 3. Sistema de Rankeo "Clientes Oro"
Identificación automática de las cuentas que generan el mayor impacto en el margen de utilidad, permitiendo priorizar la atención a los clientes más rentables.

### 4. Matriz de Control de Riesgos
Alertas proactivas integradas en el flujo:
- **Alerta SLA (75%):** Notificación visual inmediata cuando un ticket alcanza las 54 horas sin cierre.
- **Riesgo de Margen (< 15%):** Detector de clientes con rentabilidad insuficiente para intervención del Controller.

## 🛠️ Cambios en la Infraestructura de Datos
Para dar soporte a estas métricas, realizamos las siguientes mejoras:
1. **Migración DB:** Añadimos columnas `costo_laboral_mensual` y `activos_mensuales_valor` a la tabla `gestoras`.
2. **API Extension:** Creamos `gestorasAPI` y hooks de TanStack Query para sincronización en tiempo real.
3. **Context Integration:** Integración total en `AppDataContext` para asegurar disponibilidad de datos en todo el ecosistema.

---
> [!TIP]
> Puedes cambiar entre "Mes Corriente" y "Mes Anterior" en la cabecera para ver el crecimiento **MoM (Month-over-Month)** y comparar el rendimiento de los gestores.

> [!IMPORTANT]
> Se ha implementado un sistema de **SLA de 72 horas** por defecto. Los tickets que superan este umbral se marcan automáticamente como "Riesgo Crítico" en el panel de Control de Riesgos.
