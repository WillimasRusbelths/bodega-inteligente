# Indicadores, dashboard y storytelling

## Criterios generales

Todos los indicadores se calculan dentro del tenant autorizado y muestran fecha de actualización.
Las fórmulas son **preliminares** hasta validar grano, asignación de costos, precisión, filtros y línea
base. «Cantidad» significa unidades o peso realmente registrados; no suma magnitudes incompatibles ni
imputa cantidades a ventas por importe.

## Catálogo inicial de indicadores

### KPI-BI-001 — Ventas totales

- **Objetivo:** Conocer ingresos netos confirmados.
- **Fórmula conceptual preliminar:** suma de importe neto, excluyendo efectos anulados según regla.
- **Fuente:** FactVentas.
- **Dimensiones:** Tiempo, Bodega, Producto, Categoría, Modalidad y Vendedor.
- **Frecuencia:** Cada carga incremental; propuesta inicial diaria.
- **Visualización sugerida:** Tarjeta, línea temporal y columnas.
- **Interpretación:** Un aumento indica mayor ingreso neto, no necesariamente mayor margen.

### KPI-BI-002 — Número de ventas

- **Objetivo:** Medir transacciones confirmadas sin duplicarlas por detalle o lote.
- **Fórmula conceptual preliminar:** conteo distinto de ventas confirmadas.
- **Fuente:** FactVentas con identificador degenerado o puente trazable.
- **Dimensiones:** Tiempo, Bodega, Vendedor y Modalidad.
- **Frecuencia:** Cada carga incremental.
- **Visualización sugerida:** Tarjeta y línea.
- **Interpretación:** Debe conciliar con OLTP; no contar filas del hecho como ventas.

### KPI-BI-003 — Ticket promedio

- **Objetivo:** Conocer importe neto medio por venta.
- **Fórmula conceptual preliminar:** ventas totales / número de ventas, si el denominador es mayor a cero.
- **Fuente:** FactVentas.
- **Dimensiones:** Tiempo, Bodega y Vendedor.
- **Frecuencia:** Cada carga incremental.
- **Visualización sugerida:** Tarjeta y tendencia.
- **Interpretación:** Varía por mezcla de productos y no equivale a rentabilidad.

### KPI-BI-004 — Unidades o cantidades vendidas

- **Objetivo:** Analizar volumen real por unidad de medida compatible.
- **Fórmula conceptual preliminar:** suma de cantidad vendida agrupada por unidad y modalidad.
- **Fuente:** FactVentas y DimUnidad/Modalidad aplicable.
- **Dimensiones:** Tiempo, Producto, Categoría, Modalidad y unidad.
- **Frecuencia:** Cada carga incremental.
- **Visualización sugerida:** Barras separadas por unidad o tabla analítica.
- **Interpretación:** No sumar unidades con kilogramos ni incluir ventas por importe no medidas.

### KPI-BI-005 — Margen bruto

- **Objetivo:** Estimar o determinar resultado bruto atribuible.
- **Fórmula conceptual preliminar:** importe neto menos costo atribuido.
- **Fuente:** FactVentas y DimLote.
- **Dimensiones:** Tiempo, Producto, Categoría, Lote y Modalidad.
- **Frecuencia:** Cada carga incremental y cierre de lote.
- **Visualización sugerida:** Tarjeta, columnas y desglose estimado/definitivo.
- **Interpretación:** Nunca mezclar sin etiqueta márgenes estimados y definitivos.

### KPI-BI-006 — Productos más vendidos

- **Objetivo:** Identificar productos líderes por ingreso o cantidad compatible.
- **Fórmula conceptual preliminar:** ranking por importe neto; ranking físico separado por unidad.
- **Fuente:** FactVentas y DimProducto.
- **Dimensiones:** Tiempo, Producto, Categoría y Modalidad.
- **Frecuencia:** Cada carga incremental.
- **Visualización sugerida:** Barras ordenadas o Pareto.
- **Interpretación:** El criterio seleccionado debe mostrarse; ingreso no equivale a cantidad.

### KPI-BI-007 — Productos con mayor margen

- **Objetivo:** Priorizar productos con mayor contribución bruta.
- **Fórmula conceptual preliminar:** ranking por margen bruto validado.
- **Fuente:** FactVentas.
- **Dimensiones:** Tiempo, Producto, Categoría, Lote y Modalidad.
- **Frecuencia:** Cada carga incremental y cierre.
- **Visualización sugerida:** Barras y dispersión ingreso-margen.
- **Interpretación:** Separar margen estimado y definitivo.

### KPI-BI-008 — Productos con menor rotación

- **Objetivo:** Detectar inventario con pocas salidas.
- **Fórmula conceptual preliminar:** cantidad de salidas o frecuencia de venta en una ventana aprobada.
- **Fuente:** FactVentas y FactMovimientosInventario.
- **Dimensiones:** Tiempo, Producto, Categoría y Bodega.
- **Frecuencia:** Diaria propuesta.
- **Visualización sugerida:** Barras ascendentes o matriz con alerta.
- **Interpretación:** Ventana, unidad y disponibilidad deben acompañar el resultado.

### KPI-BI-009 — Stock actual

- **Objetivo:** Consultar la última existencia exacta disponible.
- **Fórmula conceptual preliminar:** último stock posterior válido por producto, lote y unidad.
- **Fuente:** FactMovimientosInventario.
- **Dimensiones:** Tiempo de corte, Producto, Lote, Bodega y Unidad.
- **Frecuencia:** Cada carga incremental.
- **Visualización sugerida:** Tabla/matriz y tarjetas filtradas.
- **Interpretación:** Para lotes no medidos se muestra estado aproximado, no stock numérico inventado.

### KPI-BI-010 — Productos agotados

- **Objetivo:** Identificar productos sin existencia elegible.
- **Fórmula conceptual preliminar:** conteo de productos cuyo stock exacto es cero o cuyo estado aprobado
  es agotado.
- **Fuente:** FactMovimientosInventario y DimLote.
- **Dimensiones:** Producto, Categoría, Bodega y Tiempo de corte.
- **Frecuencia:** Cada carga incremental.
- **Visualización sugerida:** Tarjeta y lista priorizada.
- **Interpretación:** Distinguir agotado de vencido, descartado o no actualizado.

### KPI-BI-011 — Productos con stock bajo

- **Objetivo:** Apoyar revisión de reposición.
- **Fórmula conceptual preliminar:** stock actual menor o igual al umbral configurado aplicable.
- **Fuente:** Inventario y configuración operacional extraída.
- **Dimensiones:** Producto, Categoría, Bodega y Tiempo.
- **Frecuencia:** Cada carga incremental.
- **Visualización sugerida:** Tarjeta, semáforo y lista.
- **Interpretación:** El umbral definitivo depende de PA-009 y es propio del tenant.

### KPI-BI-012 — Productos próximos a vencer

- **Objetivo:** Visibilizar lotes dentro de la ventana de alerta.
- **Fórmula conceptual preliminar:** conteo o valor de lotes elegibles cuya fecha cae en el intervalo
  configurado.
- **Fuente:** DimLote, inventario y configuración.
- **Dimensiones:** Tiempo, Producto, Categoría, Lote y Bodega.
- **Frecuencia:** Diaria propuesta.
- **Visualización sugerida:** Lista, barras por días restantes y semáforo.
- **Interpretación:** Días y niveles dependen de PA-010; un lote vencido se muestra aparte.

### KPI-BI-013 — Valor de mermas

- **Objetivo:** Cuantificar costo registrado de pérdidas.
- **Fórmula conceptual preliminar:** suma del costo atribuido a movimientos clasificados como merma.
- **Fuente:** FactMovimientosInventario.
- **Dimensiones:** Tiempo, Producto, Categoría, Lote, Motivo y Bodega.
- **Frecuencia:** Cada carga incremental.
- **Visualización sugerida:** Tarjeta, columnas y Pareto por motivo.
- **Interpretación:** Solo representa mermas registradas y valorizadas.

### KPI-BI-014 — Tasa de merma

- **Objetivo:** Relacionar pérdida con una base operativa comparable.
- **Fórmula conceptual preliminar:** valor o cantidad de merma / base aprobada de entradas, stock o
  ventas; la base final está pendiente.
- **Fuente:** FactMovimientosInventario y, según definición, FactVentas.
- **Dimensiones:** Tiempo, Producto, Categoría y Bodega.
- **Frecuencia:** Cada carga incremental.
- **Visualización sugerida:** Tarjeta porcentual y tendencia.
- **Interpretación:** No publicar sin indicar denominador, unidad y cobertura.

### KPI-BI-015 — Ingresos por modalidad de venta

- **Objetivo:** Comparar ingresos por unidad, peso e importe.
- **Fórmula conceptual preliminar:** suma de importe neto agrupada por modalidad.
- **Fuente:** FactVentas y DimModalidadVenta.
- **Dimensiones:** Tiempo, Modalidad, Producto, Categoría y Bodega.
- **Frecuencia:** Cada carga incremental.
- **Visualización sugerida:** Columnas apiladas o dona con valores absolutos.
- **Interpretación:** Compara dinero, no cantidades físicas incompatibles.

### KPI-BI-016 — Margen de lotes vendidos por importe

- **Objetivo:** Evaluar recuperación del costo de lotes no medidos.
- **Fórmula conceptual preliminar:** ingresos acumulados menos costo atribuible y costos adicionales
  registrados, por lote.
- **Fuente:** FactVentas y DimLote.
- **Dimensiones:** Lote, Producto, Tiempo, Bodega y estado de margen.
- **Frecuencia:** Cada carga y cierre de lote.
- **Visualización sugerida:** Tabla con ingreso, costo, margen y estado; barras divergentes.
- **Interpretación:** Es estimado mientras el lote esté abierto y definitivo al cierre.

### KPI-BI-017 — Lotes abiertos con margen estimado

- **Objetivo:** Identificar lotes cuyo resultado aún no es definitivo.
- **Fórmula conceptual preliminar:** conteo de lotes no medidos abiertos con ventas registradas.
- **Fuente:** DimLote y FactVentas.
- **Dimensiones:** Producto, Lote, Tiempo desde apertura y Bodega.
- **Frecuencia:** Cada carga incremental.
- **Visualización sugerida:** Tarjeta y lista de antigüedad.
- **Interpretación:** No representa pérdida ni ganancia definitiva.

### KPI-BI-018 — Clientes frecuentes identificados

- **Objetivo:** Identificar recurrencia únicamente de clientes identificados.
- **Fórmula conceptual preliminar:** ranking por número de ventas o frecuencia en periodo aprobado.
- **Fuente:** FactVentas y DimCliente mínima.
- **Dimensiones:** Tiempo, Cliente interno y Bodega.
- **Frecuencia:** Cada carga incremental.
- **Visualización sugerida:** Tabla restringida o barras con código anonimizado.
- **Interpretación:** Excluye «Cliente general» y no expone teléfono innecesariamente; la definición de
  frecuencia está pendiente. No constituye un DataMart completo de Clientes.

## Storytelling del dashboard

1. **Situación general de ventas:** KPI-BI-001 a KPI-BI-003, con tendencia y fecha de corte.
2. **Productos que generan ingresos y margen:** KPI-BI-004 a KPI-BI-007 y KPI-BI-015.
3. **Estado del inventario:** KPI-BI-008 a KPI-BI-011.
4. **Riesgos por vencimiento y merma:** KPI-BI-012 a KPI-BI-014.
5. **Necesidades de reposición:** combinación explicable de stock, rotación, agotamientos y alertas;
   no constituye predicción de demanda.
6. **Acciones recomendadas:** lista priorizada basada en reglas, con evidencia y responsable humano.

## Visualizaciones posibles en Power BI

Power BI puede usar tarjetas, líneas temporales, columnas, barras, matrices, tablas de detalle,
segmentadores, indicadores tipo semáforo, Pareto y dispersión. Mapas no son necesarios para el MVP y
no deben revelar ubicación exacta. Gráficos circulares se reservan para pocas categorías y siempre
acompañados por valores. El diseño final debe ser accesible, mobile-first cuando corresponda y evitar
colores como único medio de interpretación.

## Salvaguardas

El dashboard muestra tenant y fecha de actualización, aplica seguridad autoritativa y no permite
escribir en OLTP. Tableau queda como comparación teórica. No se inventan resultados ni se publican
fórmulas preliminares como métricas validadas.
