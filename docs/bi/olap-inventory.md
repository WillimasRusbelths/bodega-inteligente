# BI/OLAP de inventario

## Proposito

BodegIA conserva las operaciones de inventario en un modelo OLTP normalizado en
PostgreSQL. Productos, lotes, balances, movimientos, alertas y FEFO se escriben
con `TenantContext`, claves compuestas por tenant y auditoria de cambios
sensibles. El OLTP sigue siendo la fuente transaccional.

El MVP final agrega un DataMart dimensional real en el schema analitico `dw`.
Sus vistas se crean con la migracion `0004_inventory_datamart` y permiten
consultas OLAP sin modificar las tablas operativas.

## Endpoints BI

La API mantiene endpoints tenant-scoped para el dashboard:

- `GET /tenants/current/bi/inventory-summary`
- `GET /tenants/current/bi/stock-by-category`
- `GET /tenants/current/bi/expiration-risk`
- `GET /tenants/current/bi/movement-summary`
- `GET /tenants/current/bi/alerts-summary`

Todas las consultas usan el `tenantId` del contexto autorizado. El rol `seller`
recibe indicadores operativos; costos, valorizacion y perdida estimada se
limitan a `owner_admin` e `inventory_manager`.

## Modelo estrella

Dimensiones disponibles en `dw`:

- `dw.dim_tenant`
- `dw.dim_product`
- `dw.dim_category`
- `dw.dim_unit`
- `dw.dim_date`

Hechos disponibles en `dw`:

- `dw.fact_inventory_movement`
- `dw.fact_stock_snapshot`
- `dw.fact_expiration_risk`
- `dw.fact_inventory_alert`

## Indicadores

El dashboard calcula total de productos, stock disponible, productos bajo el
umbral, productos proximos a vencer, productos vencidos, alertas activas, stock
por categoria, riesgo de vencimiento, movimientos por tipo y alertas por
condicion. La valorizacion de inventario se muestra solo para roles
autorizados.

## Relacion con el servicio BI

El servicio BI actual permanece sobre los repositorios y guards tenant-aware del
OLTP para no alterar la seguridad del MVP. Sus indicadores estan alineados con
las vistas del DataMart. El schema `dw` queda disponible para consultas OLAP,
validacion en PostgreSQL y herramientas BI externas.

## Integracion posterior

Power BI o Tableau podrian conectarse con un usuario de solo lectura limitado al
schema `dw`. Esa evolucion debe conservar aislamiento por tenant, privacidad de
costos y la regla de que web y movil no acceden directamente a PostgreSQL.

## Demo local

Con `DATABASE_URL` apuntando a la base PostgreSQL de pruebas:

```text
corepack pnpm exec prisma migrate deploy --schema prisma/schema.prisma
corepack pnpm seed:demo
corepack pnpm --filter @bodegia/api start:performance
corepack pnpm --dir apps/web dev
```

La demo web muestra OLTP, BI/OLAP y el modelo dimensional/DataMart. La pantalla
usa datos sinteticos en `Demo mode`; el DataMart real queda disponible en
PostgreSQL para consultas del archivo `docs/bi/olap-queries.sql`.
