# Rendimiento del módulo 002

`apps/api/test/performance/product-inventory.js` está preparado para k6 con
escenarios de búsqueda de productos, lotes, balances, FEFO, alertas y
movimientos. Usa `BASE_URL`, realiza solicitudes HTTP y registra métricas
funcionales propias.

No se ha ejecutado k6 en este cierre; no se inventan iteraciones, p95,
throughput ni tasas de error. T137/performance observada permanece pendiente
hasta contar con una ejecución real y un artefacto de resumen.
