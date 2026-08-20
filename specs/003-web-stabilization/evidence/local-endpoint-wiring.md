# Evidencia local de wiring de endpoints

**Fecha de validación**: 2026-08-01

**Rama**: `003-web-stabilization`

**Entorno**: API y PostgreSQL exclusivamente locales (`127.0.0.1`); base de pruebas `bodegia_test`.

## Alcance y método

La auditoría contrastó las rutas declaradas por `InventoryWebApi`, `InventoryBiApi` y el flujo de ventas rápidas con la cadena de handlers registrada por `createApiServer()` en `apps/api/src/http/main.ts`. Además, las lecturas críticas se ejecutaron contra un servidor HTTP real levantado en un puerto local efímero mediante:

- `apps/api/test/contract/web-inventory-wiring.contract.spec.ts`;
- `apps/api/test/contract/web-sales-bi-wiring.contract.spec.ts`.

Los contratos esperados de la columna **Respuesta web esperada** son los que consumen hoy los clientes web. “No montada” significa que existe controller o servicio de dominio, pero `createApiServer()` no le delega la ruta. No se ejecutó T004 ni T005 y no se cambió wiring productivo.

## InventoryWebApi

| Método | Ruta | Cliente web | Respuesta web esperada | Handler/controller/servicio existente | ¿Montada localmente? | Prueba o evidencia | Resultado observado | Brecha |
|---|---|---|---|---|---|---|---|---|
| GET | `/tenants/current/categories` | `InventoryWebApi.listCategories` | `Page<Category>`: `{ items, nextCursor }` | `CatalogController.listCategories` y servicio de catálogo | No | Inspección de `inventory-client.ts`, `catalog.controller.ts` y cadena de handlers de `main.ts` | La cadena HTTP no registra el controller | Falta wiring al controller existente |
| POST | `/tenants/current/categories` | `InventoryWebApi.createCategory` | `Category` | `CatalogController.createCategory` y servicio de catálogo | No | Inspección estática de cliente, controller y `main.ts` | Sin handler HTTP registrado | Falta wiring al controller existente |
| PATCH | `/tenants/current/categories/{categoryId}` | `InventoryWebApi.updateCategory` | `Category` | `CatalogController.updateCategory` y servicio de catálogo | No | Inspección estática de cliente, controller y `main.ts` | Sin handler HTTP registrado | Falta wiring al controller existente |
| PATCH | `/tenants/current/categories/{categoryId}/status` | `InventoryWebApi.setCategoryStatus` | `Category` | `CatalogController.setCategoryStatus` y servicio de catálogo | No | Inspección estática de cliente, controller y `main.ts` | Sin handler HTTP registrado | Falta wiring al controller existente |
| GET | `/tenants/current/units` | `InventoryWebApi.listUnits` | `Page<Unit>`: `{ items, nextCursor }` | `CatalogController.listUnits` y servicio de catálogo | No | Inspección estática de cliente, controller y `main.ts` | La cadena HTTP no registra el controller | Falta wiring al controller existente |
| POST | `/tenants/current/units` | `InventoryWebApi.createUnit` | `Unit` | `CatalogController.createUnit` y servicio de catálogo | No | Inspección estática de cliente, controller y `main.ts` | Sin handler HTTP registrado | Falta wiring al controller existente |
| PATCH | `/tenants/current/units/{unitId}` | `InventoryWebApi.updateUnit` | `Unit` | `CatalogController.updateUnit` y servicio de catálogo | No | Inspección estática de cliente, controller y `main.ts` | Sin handler HTTP registrado | Falta wiring al controller existente |
| PATCH | `/tenants/current/units/{unitId}/status` | `InventoryWebApi.setUnitStatus` | `Unit` | `CatalogController.setUnitStatus` y servicio de catálogo | No | Inspección estática de cliente, controller y `main.ts` | Sin handler HTTP registrado | Falta wiring al controller existente |
| GET | `/tenants/current/products` | `InventoryWebApi.listProducts` | `Page<Product>`: `{ items, nextCursor }` | `handleInventoryReadRoute` → `CatalogController.listProducts`; `availableStock` se toma del resultado de `QuickSaleService.listProducts` | Sí | Prueba boundary T002 antes y después de T004 | Antes: HTTP 200 solo con `{ data }`. Final: HTTP 200 con `{ items, nextCursor, data }`; el producto fixture conserva campos ricos y `availableStock: 7` autoritativo | Resuelta mediante respuesta compatible en la misma ruta, sin endpoint ni cálculo de stock nuevo |
| POST | `/tenants/current/products` | `InventoryWebApi.createProduct` | `Product` | `CatalogController.createProduct` y servicio de catálogo | No | Inspección estática de cliente, controller y `main.ts` | `handleSalesRoute` solo atiende GET en esta ruta | Falta wiring al controller existente |
| GET | `/tenants/current/products/{productId}` | `InventoryWebApi.getProduct` | `Product` | `CatalogController.getProduct` y servicio de catálogo | No | Inspección estática de cliente, controller y `main.ts` | Sin handler HTTP registrado | Falta wiring al controller existente |
| PATCH | `/tenants/current/products/{productId}` | `InventoryWebApi.updateProduct` | `Product` | `CatalogController.updateProduct` y servicio de catálogo | No | Inspección estática de cliente, controller y `main.ts` | Sin handler HTTP registrado | Falta wiring al controller existente |
| GET | `/tenants/current/products/{productId}/lots` | `InventoryWebApi.listProductLots` | `Page<Lot>`: `{ items, nextCursor }` | `LotsController.listProductLots` y servicio de lotes | No | Inspección estática de cliente, controller y `main.ts` | La cadena HTTP no registra el controller | Falta wiring al controller existente |
| POST | `/tenants/current/products/{productId}/lots` | `InventoryWebApi.createLot` | `Lot` | `LotsController.createLotReceipt` y servicio de lotes | No | Inspección estática de cliente, controller y `main.ts` | Sin handler HTTP registrado | Falta wiring al controller existente |
| GET | `/tenants/current/lots` | `InventoryWebApi.listLots` | `Page<Lot>`: `{ items, nextCursor }` | `handleInventoryReadRoute` → `LotsController.listTenantLots` → `LotReceiptService` | Sí | Prueba boundary T002 antes y después de T004 | Antes: HTTP 404 seguro. Final: HTTP 200 paginado | Resuelta con wiring al controller existente |
| GET | `/tenants/current/lots/{lotId}` | `InventoryWebApi.getLot` | `Lot` | `LotsController.getLot` y servicio de lotes | No | Inspección estática de cliente, controller y `main.ts` | Sin handler HTTP registrado | Falta wiring al controller existente |
| GET | `/tenants/current/inventory/balances` | `InventoryWebApi.listBalances` | `Page<InventoryBalance>`: `{ items, nextCursor }` | `handleInventoryReadRoute` → `InventoryController.listBalances` → `InventoryBalanceService` | Sí | Prueba boundary T002 antes y después de T004 | Antes: HTTP 404 seguro. Final: HTTP 200 paginado; lectura `seller` sin `unitCost` ni valorización | Resuelta con wiring; conserva proyección de privacidad del servicio |
| GET | `/tenants/current/inventory/movements` | `InventoryWebApi.listMovements` | `Page<InventoryMovement>`: `{ items, nextCursor }` | `handleInventoryReadRoute` → `InventoryController.listMovements` → `InventoryMovementService` | Sí | Prueba boundary T002 antes y después de T004 | Antes: HTTP 404 seguro. Final: HTTP 200 paginado | Resuelta con wiring al controller existente |
| POST | `/tenants/current/inventory/movements` | `InventoryWebApi.createMovement` | `InventoryMovement` | `InventoryController.createMovement` y servicio de inventario | No | Inspección estática de cliente, controller y `main.ts` | Sin handler HTTP registrado | Falta wiring al controller existente |
| GET | `/tenants/current/inventory/fefo/suggestions` | `InventoryWebApi.suggestFefo` | `{ productId, requestedQuantity, canFulfill, items }` | `handleInventoryReadRoute` → `InventoryController.suggestFefo` → `FefoService` → `FefoRepository` | Sí | Prueba boundary T002 antes y después de T004 con producto/lote fixture | Antes: HTTP 404 seguro. Final: HTTP 200, `canFulfill: true` y sugerencia del lote autoritativo | Resuelta con wiring y coerción mínima de `quantity` en el boundary HTTP |
| GET | `/tenants/current/inventory/alerts` | `InventoryWebApi.listAlerts` | `Page<InventoryAlert>`: `{ items, nextCursor }` | `handleInventoryReadRoute` → `AlertsController.list` → `AlertService` | Sí | Prueba boundary T002 antes y después de T004 | Antes: HTTP 404 seguro. Final: HTTP 200 paginado | Resuelta con wiring al controller existente |
| PATCH | `/tenants/current/alerts/{alertId}/resolve` | `InventoryWebApi.resolveAlert` | `InventoryAlert` | `AlertsController.resolve` y servicio de alertas | No | Inspección estática de cliente, controller y `main.ts` | Sin handler HTTP registrado | Falta wiring al controller existente; además la familia de ruta difiere de la lectura `/inventory/alerts` y debe conservarse como contrato existente |

## InventoryBiApi

| Método | Ruta | Cliente web | Respuesta web esperada | Handler/controller/servicio existente | ¿Montada localmente? | Prueba o evidencia | Resultado observado | Brecha |
|---|---|---|---|---|---|---|---|---|
| GET | `/tenants/current/bi/inventory-summary` | `InventoryBiApi.getInventorySummary` | `{ data: { totalProducts, totalStockAvailable, lowStockProducts, productsExpiringSoon, productsExpired, activeAlerts } }` | `handleBiRoute` → `BiController.getInventorySummary` → `InventoryBiService` | Sí | Prueba boundary T003 | HTTP 200; todos los indicadores mínimos son numéricos | Ninguna |
| GET | `/tenants/current/bi/stock-by-category` | `InventoryBiApi.getStockByCategory` | `{ data: Array }` | `handleBiRoute` → `BiController.getStockByCategory` → `InventoryBiService` | Sí | Prueba boundary T003 | HTTP 200 con arreglo | Ninguna |
| GET | `/tenants/current/bi/expiration-risk` | `InventoryBiApi.getExpirationRisk` | `{ data: Array }` | `handleBiRoute` → `BiController.getExpirationRisk` → `InventoryBiService` | Sí | Prueba boundary T003 | HTTP 200 con arreglo | Ninguna |
| GET | `/tenants/current/bi/movement-summary` | `InventoryBiApi.getMovementSummary` | `{ data: Array }` | `handleBiRoute` → `BiController.getMovementSummary` → `InventoryBiService` | Sí | Prueba boundary T003 | HTTP 200 con arreglo | Ninguna |
| GET | `/tenants/current/bi/alerts-summary` | `InventoryBiApi.getAlertsSummary` | `{ data: Array }` | `handleBiRoute` → `BiController.getAlertsSummary` → `InventoryBiService` | Sí | Prueba boundary T003 | HTTP 200 con arreglo | Ninguna |

La prueba T003 también envió `POST /tenants/current/bi/inventory-summary`: el método no permitido no fue aceptado y produjo HTTP 404 `RESOURCE_NOT_FOUND` con un cuerpo de error seguro.

## Ventas rápidas

| Método | Ruta | Cliente web | Respuesta web esperada | Handler/controller/servicio existente | ¿Montada localmente? | Prueba o evidencia | Resultado observado | Brecha |
|---|---|---|---|---|---|---|---|---|
| GET | `/tenants/current/products` | Carga de catálogo/resumen de ventas rápidas en `mvp-demo.ts` | `{ data: SaleProductResponse[] }` | `handleInventoryReadRoute` → `QuickSaleService.listProducts`, junto con `CatalogController.listProducts` | Sí | Prueba boundary T003 antes y después de T004 | HTTP 200 y `data` continúa siendo un arreglo con el mismo resumen; las claves operativas adicionales son compatibles | Ninguna; contrato de ventas preservado sin cambiar `QuickSaleService` |
| GET | `/tenants/current/sales` | Carga e historial de ventas rápidas en `mvp-demo.ts` | `{ data: SaleListItem[] }` | `handleSalesRoute` → `QuickSaleService.listSales` | Sí | Prueba boundary T003 | HTTP 200 con `data` como arreglo | Ninguna |
| POST | `/tenants/current/sales` | Registro de venta rápida en `mvp-demo.ts` | Venta creada; errores de validación en `{ error: { code, message, correlationId } }` | `handleSalesRoute` → `QuickSaleService.createSale` | Sí | Prueba boundary T003 con `items: []` para no crear una venta | HTTP 400 `VALIDATION_ERROR` seguro; demuestra método y validación sin mutación | Ninguna de wiring |
| GET | `/tenants/current/sales/{saleId}` | Detalle de venta rápida en `mvp-demo.ts` | `{ data: SaleDetail }`; error seguro si no existe | `handleSalesRoute` → `QuickSaleService.getSaleDetail` | Sí | Prueba boundary T003 con UUID inexistente | HTTP 404 `RESOURCE_NOT_FOUND` seguro | Ninguna de wiring |

La lectura protegida de ventas con una sesión inválida produjo HTTP 401 `SESSION_INVALID` y cuerpo seguro, confirmando que la prueba atraviesa el boundary de autenticación demo existente sin modificarlo.

## Estado antes de T004

- T003 estaba verde: 11 de 11 pruebas de ventas rápidas y BI pasaban; no existía una brecha que justificara T005 productiva.
- T002 estaba roja: las cinco lecturas operativas de lotes, balances, movimientos, alertas y FEFO devolvían HTTP 404.
- `GET /tenants/current/products` devolvía HTTP 200 con `{ data }`, pero no entregaba la página rica `{ items, nextCursor }` requerida por `InventoryWebApi`.
- Los controllers y servicios operativos existían y aplicaban `TenantContext`, permisos, tenant, privacidad y reglas autoritativas, pero no estaban registrados en `createApiServer()`.

## Cambios mínimos de T004

- Se añadió en `apps/api/src/http/main.ts` un único `handleInventoryReadRoute` antes del handler de ventas.
- El handler reconoce exclusivamente las seis rutas GET ya declaradas por los clientes y delega en `CatalogController`, `LotsController`, `InventoryController` y `AlertsController` con sus servicios existentes.
- `TenantContext` sigue construyéndose con `demoContext(request)` después de `requireDemoSession(request)`; los servicios conservan la validación autoritativa de pertenencia, permisos y tenant.
- FEFO reutiliza `FefoService` y `FefoRepository`; el boundary solo convierte `quantity` de query string a número para el DTO existente.
- Productos usa una respuesta compatible en la misma ruta: `data` permanece idéntico para ventas rápidas y `items/nextCursor` proviene de `CatalogController`. El único enriquecimiento es copiar `availableStock` de `QuickSaleService.listProducts`, cuyo valor procede de los balances backend. No se suma, resta ni reconstruye stock en el boundary.
- No se modificaron `QuickSaleService`, `BiController`, `InventoryBiService`, autenticación ni reglas de dominio.

## Estado final y pruebas

- Las seis lecturas operativas están montadas y responden con sus contratos existentes.
- T002 ampliada quedó verde: 7 de 7, incluidas forma rica de productos, FEFO con fixture real y ausencia de costos/valorización para `seller` en lotes y balances.
- T003 permaneció verde: 11 de 11 para ventas rápidas y las cinco lecturas BI.
- Ejecución conjunta focalizada: 18 de 18 pruebas verdes, 0 fallidas.
- `corepack pnpm test:contract`: 122 de 122 pruebas verdes en 14 archivos, 0 fallidas.
- Ejecución adicional directa de `apps/api/test/contract` sin `passWithNoTests`: 122 de 122 verdes en 14 archivos, 0 fallidas.
- `corepack pnpm --filter @bodegia/api typecheck`: exit code 0.
- `corepack pnpm lint`: exit code 0 después de sustituir matchers tipados como `any` en T003 por comprobaciones numéricas explícitas.

## Confirmaciones de alcance

- T005 se cierra con cero cambios productivos en ventas o BI: su prueba siguió verde antes y después de T004.
- No se agregó ningún endpoint: solo se montaron rutas ya declaradas.
- No se añadieron reglas de negocio, implementaciones paralelas de inventario, tablas, cambios Prisma, migraciones ni seeds globales.
- Los tests crean y eliminan fixtures sintéticos propios en PostgreSQL local; no usan mocks para ocultar el boundary.
- No se usaron servicios remotos ni se realizó despliegue.
