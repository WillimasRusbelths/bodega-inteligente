# Data Warehouse y DataMart de inventario

## Arquitectura

BodegIA mantiene las operaciones diarias en PostgreSQL bajo el modelo OLTP:
tenants, productos, categorias, unidades, lotes, movimientos, balances, alertas
y FEFO. El DataMart de inventario agrega un schema analitico separado llamado
`dw`, creado por la migracion `0004_inventory_datamart`.

El schema `dw` esta compuesto por vistas de solo lectura sobre el OLTP. Esto
evita duplicar escrituras, no modifica datos operativos y deja una superficie
estable para dashboards BI y herramientas externas.

## Modelo estrella

Dimensiones:

- `dw.dim_tenant`: bodega y nombre operativo.
- `dw.dim_product`: producto, SKU, codigo de barras, categoria, unidad,
  umbrales y estado.
- `dw.dim_category`: categoria tenant-scoped.
- `dw.dim_unit`: unidad tenant-scoped y escala de cantidad.
- `dw.dim_date`: calendario derivado de movimientos, vencimientos, alertas y
  fecha actual.

Hechos:

- `dw.fact_inventory_movement`: un registro por movimiento de inventario.
- `dw.fact_stock_snapshot`: un registro por balance actual de producto/lote.
- `dw.fact_expiration_risk`: un registro por lote con stock disponible.
- `dw.fact_inventory_alert`: un registro por alerta de inventario.

## Granularidad

- Movimiento: evento transaccional individual con tipo, cantidad, delta y
  balance antes/despues.
- Stock snapshot: corte actual por tenant, producto y lote.
- Riesgo de vencimiento: lote vigente con cantidad disponible, dias al
  vencimiento y perdida estimada cuando existe costo.
- Alerta: alerta individual con tipo, estado, valor observado y umbral.

## Metricas

- Stock disponible por categoria.
- Productos con stock bajo.
- Productos proximos a vencer.
- Productos vencidos.
- Movimientos por tipo y mes.
- Alertas por tipo y estado.
- Valorizacion de inventario para roles autorizados.
- Riesgo de perdida por vencimiento.

## Conexion con dashboard BI

El dashboard BI actual de BodegIA usa endpoints tenant-scoped de inventario.
Esos indicadores estan alineados con el DataMart `dw`: resumen de stock,
categorias, vencimiento, movimientos y alertas. Para la demo, el DataMart queda
disponible en PostgreSQL para consultas OLAP directas y el frontend muestra el
modelo dimensional como parte de la exposicion.

El servicio BI de la API permanece sobre el servicio tenant-aware existente para
no alterar los guards ni la autorizacion del MVP. Las vistas `dw` quedan listas
para una evolucion posterior con consultas server-side directas al DataMart.

## Power BI y Tableau

Power BI o Tableau pueden conectarse posteriormente con un usuario de solo
lectura limitado al schema `dw`. Esa integracion debe preservar tenant-scoping,
privacidad de costos y no dar acceso directo desde web o movil a PostgreSQL.

El roadmap de los DataMarts futuros esta documentado en
`docs/roadmap/sistema-final-bodegia.md`.
