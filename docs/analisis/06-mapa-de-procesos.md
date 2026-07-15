# Mapa de procesos de negocio

## Propósito y límites

Este documento identifica los procesos del MVP de BodegIA y sus relaciones. Se basa en el bloque
documental `00` a `05` y en la constitución 1.0.0. No define pantallas, endpoints, tablas ni una
implementación. Las decisiones todavía abiertas conservan su referencia `PA` y no se resuelven aquí.

## Principios transversales

Todos los procesos protegidos ocurren dentro de una bodega autorizada. La pertenencia y los permisos
se validan en el backend; el identificador de tenant enviado por un cliente no es suficiente. Los
movimientos relevantes conservan usuario, fecha, hora y valores afectados, y la información de una
bodega no se mezcla con otra.

Las ventas y sus movimientos indispensables de inventario forman una operación atómica. Los lotes,
movimientos, ventas y auditorías conservan historia. Las fechas obtenidas mediante OCR solo se
vuelven autoritativas después de la confirmación o corrección humana.

## Procesos estratégicos

### PE-01 Configurar la operación de una bodega

- Define parámetros propios del tenant: stock mínimo, días de alerta, permisos de descuento, datos
  del ticket, categorías, proveedores y otras configuraciones aprobadas.
- Administra pertenencias, roles y permisos por bodega.
- Depende de PA-002 a PA-005 para cerrar alta, vinculación y permisos exactos.

### PE-02 Analizar la operación y decidir acciones

- Consulta indicadores autorizados de ventas, inventario, vencimientos y clientes.
- Emite alertas y recomendaciones de precio, promoción o reposición mediante reglas explicables.
- No usa un modelo predictivo propio en el MVP.
- Depende de PA-009, PA-010 y PA-017 a PA-020 para parámetros y resultados definitivos.

## Procesos operativos

### PO-01 Mantener catálogo y presentaciones

- Diferencia marca y presentación comercial.
- Registra códigos de barras o un código interno generado.
- Define unidad de compra, unidad base de inventario, modalidad de venta y forma de control del stock.
- Permite búsqueda por nombre, productos frecuentes y botones rápidos.

### PO-02 Recibir productos y abrir lotes

- Registra proveedor cuando corresponda, costo total, presentación recibida, lote y vencimiento.
- Registra unidades o peso aprovechable real cuando fueron contados o medidos.
- Para recipientes, bolsas o atados no medidos, conserva el costo y un control aproximado sin
  inventar peso, volumen ni porciones.
- La compra por caja, costal, jaba u otra presentación no obliga a usar esa misma unidad en la venta.

### PO-03 Transformar un producto de forma básica

- Consume una cantidad real de un producto y lote de origen.
- Atribuye su costo y, si se registran, costos adicionales.
- Genera un lote preparado vinculado con origen, fecha y usuario responsable.
- No constituye producción industrial. Los detalles siguen pendientes en PA-047 y PA-048.

### PO-04 Controlar inventario y vencimientos

- Consulta existencias exactas o estados aproximados según la forma de control.
- Aplica FEFO cuando existen lotes con vencimientos diferentes, salvo excepción aprobada y auditada.
- Registra ajustes, mermas, deterioros y descartes con referencia al lote.
- Cierra lotes agotados, descartados o finalizados sin eliminar su historia.

### PO-05 Registrar una venta

- Identifica la bodega, el usuario autorizado y los productos vendidos.
- Admite venta por unidad, por peso ingresado manualmente y por importe sin medición exacta.
- Puede asociar un cliente identificado o «Cliente general».
- Calcula el total, afecta inventario y emite un ticket interno como una operación íntegra.
- Registra auditoría; una falla indispensable revierte la venta completa.

### PO-06 Gestionar clientes dentro de una bodega

- Para un cliente identificado conserva código interno, nombre completo, teléfono y fecha de
  registro.
- No recopila DNI, dirección domiciliaria, fecha de nacimiento ni correo electrónico durante el MVP.
- Registra el consentimiento promocional de forma separada, explícita y auditable.
- Excluye a «Cliente general» de rankings, fidelización y análisis individual.

### PO-07 Preparar reposición y relación con proveedores

- Consulta alertas y recomendaciones determinísticas.
- Prepara o da seguimiento inicial a reposición y pedidos según el alcance que resuelva PA-019.
- Mantiene proveedores y decisiones separados por tenant.

## Procesos de soporte y control

### PS-01 Gestionar identidad, pertenencias y autorización

Autentica personas, selecciona una pertenencia activa y aplica permisos por bodega. Una misma persona
puede tener roles diferentes en bodegas distintas.

### PS-02 Auditar operaciones

Registra ventas, movimientos de stock, precios, anulaciones, descuentos y cambios relevantes. La
auditoría es inmutable y no sustituye la atomicidad de la operación principal.

### PS-03 Gestionar alertas e incidencias

Presenta alertas operativas y permite tratar errores o sospechas de acceso indebido. El procedimiento
final de incidentes permanece abierto en PA-032.

## Procesos analíticos

Los procesos siguientes pertenecen al componente BI académico y operan fuera del flujo transaccional.
No modifican directamente PostgreSQL operacional y conservan tenant, linaje y separación de ambientes.

### PBI-01 Gestionar calidad y gobierno de datos

- Perfila fuentes, aplica reglas de exactitud, completitud, consistencia, validez, unicidad,
  oportunidad y trazabilidad.
- Rechaza o pone en cuarentena datos inválidos sin corregir silenciosamente el OLTP.
- Define responsables, acceso, conservación y resolución de incidencias.

### PBI-02 Ejecutar ETL incremental

- Extrae cambios operacionales en modo de solo lectura.
- Conserva tenant, fuente, punto de corte y ejecución en staging.
- Limpia, transforma, valida, registra errores y permite reprocesamiento idempotente.

### PBI-03 Actualizar el Data Warehouse

- Carga dimensiones conformadas y hechos con historia y linaje.
- Evita duplicados y relaciones entre registros de tenants distintos.
- Publica un corte consistente solo después de controles y conciliación.

### PBI-04 Actualizar DataMarts

- Integra inicialmente DataMart de Ventas y DataMart de Inventario mediante dimensiones conformadas.
- Mantiene grano declarado y diferencia cantidad real, ausencia de medición y estado aproximado.
- Conserva margen estimado o definitivo según el estado del lote.

### PBI-05 Generar indicadores

- Calcula métricas con definición única, fórmula versionada, fuente y fecha de actualización.
- Produce indicadores de ventas, rentabilidad, inventario, vencimientos y mermas.
- No genera resultados predictivos ni comparaciones públicas entre bodegas.

### PBI-06 Visualizar en Power BI

- Consume únicamente DataMarts autorizados en modo de solo lectura.
- Aplica seguridad por tenant y muestra fecha de corte y limitaciones.
- El dashboard es un producto analítico posterior; este análisis no genera archivos PBIX.

## Relaciones principales

1. `PE-01` habilita usuarios y configuración para todos los procesos del tenant.
2. `PO-01` define cómo `PO-02`, `PO-04` y `PO-05` interpretan cada producto.
3. `PO-02` genera lotes disponibles; `PO-03` puede consumirlos y generar lotes preparados.
4. `PO-05` consume existencias mediante `PO-04` y puede usar datos autorizados de `PO-06`.
5. `PE-02` utiliza el historial estructurado de `PO-02` a `PO-07` sin cruzar tenants.
6. `PS-01` y `PS-02` atraviesan todos los procesos protegidos.
7. `PBI-01` controla la calidad aplicada por `PBI-02` a `PBI-06`.
8. `PBI-02` alimenta `PBI-03`; `PBI-03` publica datos para `PBI-04`.
9. `PBI-05` usa los DataMarts y `PBI-06` comunica sus resultados sin escribir en OLTP.

## Procesos fuera del MVP

Quedan fuera, entre otros, integración con balanzas, medición automática de porciones, producción
industrial, trazabilidad sanitaria avanzada, predicción de mermas, modelos predictivos propios y la
experiencia futura para consumidores descrita en el roadmap.
