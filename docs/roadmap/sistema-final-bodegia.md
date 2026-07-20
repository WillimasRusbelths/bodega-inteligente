# Roadmap del sistema final de BodegIA

Este documento separa el alcance implementado del MVP actual del roadmap del
sistema final. Las capacidades futuras quedan registradas como planificadas, no
como funcionalidades disponibles.

## Alcance del MVP actual

Actualmente BodegIA tiene implementado el nucleo de inventario y BI operativo:

- OLTP de inventario sobre PostgreSQL.
- Productos.
- Categorias.
- Unidades de medida.
- Lotes.
- Movimientos de inventario.
- Stock y balances.
- Alertas de stock bajo y vencimiento.
- FEFO para sugerir salida desde el lote que vence primero.
- DataMart de Inventario en el schema analitico `dw`.
- Dimensiones `dw.dim_tenant`, `dw.dim_product`, `dw.dim_category`,
  `dw.dim_unit` y `dw.dim_date`.
- Hechos `dw.fact_inventory_movement`, `dw.fact_stock_snapshot`,
  `dw.fact_expiration_risk` y `dw.fact_inventory_alert`.
- Consultas OLAP de inventario.
- Dashboard web demo para OLTP, BI/OLAP y modelo dimensional.
- Login web MVP demo con usuarios sinteticos `propietario`, `inventario` y
  `vendedor`.
- Configuracion MVP de bodega activa: nombre, ubicacion textual, moneda, horario
  referencial y estado.
- Vista web MVP de empleados y roles para `owner_admin`.
- Venta rapida MVP desde web con descuento de stock por FEFO.
- Historial basico `Sale/SaleItem` y movimientos `SALE_OUT` en el kardex de
  inventario.

El unico DataMart implementado en el MVP actual es el DataMart de Inventario.
Los demas DataMarts descritos abajo forman parte del roadmap del sistema final.

## Arquitectura del sistema final

El sistema completo de BodegIA se proyecta como una plataforma multi-bodega con:

- Aplicacion web administrativa y analitica.
- Aplicacion movil operativa.
- Backend API.
- Base OLTP para operaciones transaccionales.
- Data Warehouse.
- Multiples DataMarts por dominio.
- BI/OLAP para indicadores y analisis.
- Integracion futura con Power BI o Tableau mediante accesos controlados de
  solo lectura.

La arquitectura final mantendra el aislamiento por tenant, RBAC, auditoria y
privacidad de costos definidos desde el MVP.

## Modulos futuros

Las siguientes capacidades quedan registradas para fases posteriores:

- Hardening de login web productivo, recuperacion de cuenta y sesiones web
  completas.
- Login real movil.
- APK Android.
- Escaneo QR y codigo de barras.
- OCR de fechas de vencimiento.
- Flujo de ventas completo: anulaciones, devoluciones, comprobantes y cierre de
  caja.
- Pagos complejos y calculo de vuelto.
- Clientes.
- Proveedores.
- Compras y reabastecimiento.
- Promociones.
- Recomendacion de precios.
- Reportes avanzados.
- Modo offline movil.

## DataMarts futuros

### DataMart de Ventas

Objetivo: analizar el flujo de ventas completo, volumen de operaciones,
productos vendidos, metodos de pago y comportamiento diario de la bodega.

Dimensiones esperadas:

- `dim_tenant`
- `dim_product`
- `dim_category`
- `dim_date`
- `dim_time`
- `dim_seller`
- `dim_payment_method`

Hechos esperados:

- `fact_sale`
- `fact_sale_line`
- `fact_sale_payment`

Indicadores BI esperados:

- Ventas por dia, semana y mes.
- Unidades vendidas por producto.
- Ticket promedio.
- Productos mas vendidos.
- Ventas por vendedor.
- Distribucion por medio de pago.

### DataMart de Clientes

Objetivo: analizar clientes registrados, frecuencia de compra y comportamiento
de consumo cuando el modulo de clientes exista.

Dimensiones esperadas:

- `dim_tenant`
- `dim_customer`
- `dim_date`
- `dim_product`
- `dim_category`

Hechos esperados:

- `fact_customer_purchase`
- `fact_customer_frequency`
- `fact_customer_balance`

Indicadores BI esperados:

- Clientes activos.
- Frecuencia de compra.
- Recencia de compra.
- Valor acumulado por cliente.
- Productos preferidos por cliente.

### DataMart de Compras/Reabastecimiento

Objetivo: analizar compras a proveedores, rotacion, reposicion y riesgo de
quiebre de stock.

Dimensiones esperadas:

- `dim_tenant`
- `dim_supplier`
- `dim_product`
- `dim_category`
- `dim_date`
- `dim_unit`

Hechos esperados:

- `fact_purchase_order`
- `fact_purchase_line`
- `fact_replenishment_recommendation`
- `fact_supplier_delivery`

Indicadores BI esperados:

- Compras por proveedor.
- Costo de compra por producto.
- Tiempo de entrega.
- Quiebres de stock evitados.
- Productos con necesidad de reposicion.

### DataMart Financiero/Rentabilidad

Objetivo: analizar margen, valorizacion, costo, rentabilidad y perdida por
merma o vencimiento.

Dimensiones esperadas:

- `dim_tenant`
- `dim_product`
- `dim_category`
- `dim_date`
- `dim_cost_center`

Hechos esperados:

- `fact_inventory_valuation`
- `fact_margin`
- `fact_loss`
- `fact_cash_movement`

Indicadores BI esperados:

- Valorizacion de inventario.
- Margen bruto.
- Perdidas por vencimiento.
- Perdidas por merma.
- Rentabilidad por categoria.

### DataMart de Promociones y Precios

Objetivo: analizar efectividad de promociones, cambios de precio y respuesta de
la demanda.

Dimensiones esperadas:

- `dim_tenant`
- `dim_product`
- `dim_category`
- `dim_date`
- `dim_promotion`
- `dim_price_policy`

Hechos esperados:

- `fact_promotion_performance`
- `fact_price_change`
- `fact_discount_effect`

Indicadores BI esperados:

- Promociones activas y finalizadas.
- Incremento de ventas por promocion.
- Descuento promedio.
- Elasticidad operativa de precio.
- Productos candidatos a promocion.

## Aclaracion importante

El unico DataMart implementado en el MVP actual es el DataMart de Inventario.
La venta rapida MVP impacta ese DataMart indirectamente mediante movimientos
`SALE_OUT`, pero el DataMart de Ventas todavia no esta implementado. Los
DataMarts de Ventas, Clientes, Compras/Reabastecimiento,
Financiero/Rentabilidad y Promociones/Precios son roadmap del sistema final. No
deben presentarse como funcionalidades ya implementadas.
