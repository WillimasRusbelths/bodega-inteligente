# Modelo lógico de datos: Productos, inventario, lotes y vencimientos

Este documento define entidades, relaciones e invariantes lógicas para la funcionalidad 002. No
crea `prisma/schema.prisma`, tablas físicas ni migraciones. Todas las entidades operativas se
resuelven dentro de un `TenantContext` autorizado del módulo 001.

## Convenciones

- Identificadores: UUID opacos, no reutilizables.
- Fechas: timestamps (`timestamptz`) en UTC; `expiresAt` es una fecha de negocio (`YYYY-MM-DD`)
  interpretada al inicio del día operativo local configurado por el tenant. Ingreso y auditoría
  conservan timestamps UTC.
- Cantidades: decimal no negativo con precisión definida por `UnitOfMeasure`.
- Costos: decimal monetario no negativo; visible solo a `owner_admin` e `inventory_manager`.
- Estados desactivados se conservan; no hay borrado físico de productos con historia, lotes,
  movimientos, alertas o auditoría.
- Toda lectura o mutación tenant-scoped exige `TenantContext`, Membership activa y permiso.

## Entidades

### Product

Representa un artículo catalogado por una bodega.

| Campo lógico                              | Regla                                                               |
| ----------------------------------------- | ------------------------------------------------------------------- |
| `id`                                      | UUID estable.                                                       |
| `tenantId`                                | Obligatorio; propietario del producto.                              |
| `name`                                    | Obligatorio, normalizado para búsqueda; no se usa como clave única. |
| `sku`                                     | Opcional; normalizado; único por tenant cuando no es nulo.          |
| `barcode`                                 | Opcional; normalizado; único por tenant cuando no es nulo.          |
| `categoryId`                              | Opcional o referencia a categoría del mismo tenant.                 |
| `unitOfMeasureId`                         | Obligatorio; referencia a unidad permitida por el mismo tenant.     |
| `minimumStock`                            | Decimal no negativo para alerta de stock bajo.                      |
| `expiryAlertDays`                         | Entero no negativo para alerta de vencimiento.                      |
| `status`                                  | `ACTIVE` o `INACTIVE`; transición auditada.                         |
| `version`                                 | Entero de concurrencia optimista.                                   |
| `createdAt`, `updatedAt`, `deactivatedAt` | Fechas UTC y ciclo de vida lógico.                                  |

Índices lógicos: `(tenantId, normalizedName)`, `(tenantId, status)`, `(tenantId, sku)`,
`(tenantId, barcode)`. Las claves compuestas deben impedir que `categoryId` o `unitOfMeasureId` de
otro tenant sean aceptados.

### ProductCategory

Categoría configurable por tenant. Tiene `id`, `tenantId`, `name`, `normalizedName`, `status`,
`version`, `createdAt` y `updatedAt`. `normalizedName` es único por tenant mientras esté activo;
desactivarla no borra productos históricos.

### UnitOfMeasure

Unidad configurable disponible para productos de un único tenant. Tiene `id`, `tenantId` obligatorio,
`code`, `name`, `quantityScale`, `status` y timestamps. `(tenantId, code)` y el nombre normalizado son
únicos dentro del tenant para registros activos. Nunca se comparte entre tenants; una referencia de
otro tenant se rechaza como inexistente. El MVP usa una unidad principal por producto; conversiones
complejas quedan fuera.

### Lot

Entrada de un producto con vencimiento.

| Campo lógico                          | Regla                                           |
| ------------------------------------- | ----------------------------------------------- |
| `id`                                  | UUID estable.                                   |
| `tenantId`                            | Obligatorio y coherente con producto.           |
| `productId`                           | Obligatorio; no puede cambiar a otro producto.  |
| `receivedAt`                          | Fecha UTC de ingreso.                           |
| `expiresAt`                           | Fecha de vencimiento del lote.                  |
| `initialQuantity`                     | Decimal estrictamente positivo.                 |
| `availableQuantity`                   | Decimal no negativo; nunca mayor que inicial.   |
| `unitCost`                            | Decimal no negativo; visible por permiso.       |
| `status`                              | `AVAILABLE`, `DEPLETED`, `EXPIRED`, `INACTIVE`. |
| `version`                             | Entero para concurrencia.                       |
| `createdBy`, `createdAt`, `updatedAt` | Actor y timestamps auditables.                  |

Un lote no existe sin producto del mismo tenant. El producto no se elimina físicamente mientras
exista un lote.

### InventoryMovement

Kardex append-only de una variación de saldo.

| Campo lógico                              | Regla                                                                         |
| ----------------------------------------- | ----------------------------------------------------------------------------- |
| `id`                                      | UUID estable.                                                                 |
| `tenantId`, `productId`, `lotId`          | Obligatorios y coherentes entre sí.                                           |
| `type`                                    | `RECEIPT`, `POSITIVE_ADJUSTMENT`, `NEGATIVE_ADJUSTMENT`, `WASTE`, `SALE_OUT`. |
| `quantity`                                | Decimal positiva; el signo deriva de `type`.                                  |
| `quantityDelta`                           | Delta firmado persistido para reconstrucción.                                 |
| `balanceBefore`, `balanceAfter`           | Saldos del lote para evidencia.                                               |
| `reason`                                  | Motivo obligatorio en ajustes, merma, excepción y salida futura.              |
| `actorId`, `sessionId`, `deviceProfileId` | Actor y contexto disponibles.                                                 |
| `idempotencyKey`                          | Clave tenant-scoped para mutaciones repetibles.                               |
| `createdAt`                               | Fecha UTC inmutable.                                                          |

No se permite `UPDATE` o `DELETE` por la aplicación. Correcciones usan un movimiento inverso
autorizado.

### InventoryBalance

Proyección consistente de saldo por `(tenantId, productId, lotId)` con `availableQuantity`,
`reservedQuantity` (reservado para extensiones futuras, cero en el MVP), `version` y timestamps.
El stock disponible del producto es la suma de sus lotes no eliminados. Toda mutación actualiza esta
proyección y el movimiento dentro de la misma transacción.

### AlertRule

Configuración por producto y tenant: `minimumStock`, `expiryAlertDays`, `enabled`, `version` y
timestamps. Puede materializarse dentro de Product si el plan de implementación lo justifica, pero
la relación lógica es tenant-scoped y auditable.

### InventoryAlert

Alerta operativa con `id`, `tenantId`, `productId`, `lotId` opcional, `type` (`LOW_STOCK`,
`EXPIRING_SOON`, `EXPIRED`), `status` (`ACTIVE`, `RESOLVED`), `observedValue`, `thresholdValue`,
`triggeredAt`, `resolvedAt`, `resolvedBy`, `createdAt` y `updatedAt`.

Una alerta resuelta permanece para historial. La misma condición no debe duplicar alertas activas
para el mismo producto/lote.

### IdempotencyRecord (inventario)

Registro tenant-scoped con `tenantId`, `key`, `requestHash`, `operation`, `responseHash` o referencia
al resultado, `status`, `createdAt`, `expiresAt`. La combinación `(tenantId, key, operation)` es
única. Payload diferente para la misma combinación produce `409 IDEMPOTENCY_CONFLICT`.

### AuditEvent (reutilizado de 001)

Se extiende con acciones de inventario sin romper el modelo append-only existente. El payload
sanitizado puede incluir categorías, unidades, cantidades, tipo de movimiento, producto/lote y valores anterior/nuevo;
no incluye secretos. `tenantId`, actor, sesión/dispositivo, operación, resultado, motivo,
correlationId y timestamp son obligatorios cuando estén disponibles.

### Proyecciones de respuesta y privacidad

- `LotOperationalResponse` contiene identidad, producto, vencimiento, cantidades, estado y fechas, pero
  nunca `unitCost`.
- `LotAdminResponse` puede incluir `unitCost` únicamente para `owner_admin` e `inventory_manager` con
  permiso dentro del tenant activo. Un `seller` recibe siempre la proyección operativa.
- `InventoryBalanceOperational` contiene stock por producto/lote sin costos. `InventoryBalanceAdmin`
  añade costos solo para los roles autorizados; no existe una respuesta seller con costo unitario,
  costo total o datos de compra.
- La proyección elegida por rol se aplica en listados, detalles, filtros, FEFO y respuestas de error;
  no basta con ocultar campos únicamente en la interfaz cliente.

## Relaciones tenant-scoped

```text
Tenant 1 ── * ProductCategory
Tenant 1 ── * UnitOfMeasure
Tenant 1 ── * Product ── * Lot ── * InventoryMovement
Product 1 ── * InventoryBalance (por lote)
Product 1 ── 1 AlertRule
Product/Lot 1 ── * InventoryAlert
Tenant 1 ── * IdempotencyRecord
Tenant 1 ── * AuditEvent
```

Las relaciones `Product -> Category/Unit`, `Lot -> Product`, `Movement -> Product/Lot`,
`Balance -> Product/Lot`, `Alert -> Product/Lot` e idempotencia deben validar el mismo `tenantId`.
Un repositorio no ofrece métodos de negocio que acepten solo un UUID sin contexto.

## Invariantes y transiciones

### Product

```text
ACTIVE -> INACTIVE (owner_admin o inventory_manager, auditado)
INACTIVE -> ACTIVE (owner_admin o inventory_manager, auditado)
```

Un producto inactivo no admite lotes nuevos. La reactivación no altera lotes ni movimientos.

### Lot

```text
AVAILABLE -> DEPLETED cuando availableQuantity = 0
AVAILABLE -> EXPIRED cuando expiresAt < fecha_operativa y queda saldo
EXPIRED -> AVAILABLE no está permitido automáticamente
```

La excepción de consumo de un lote vencido es un movimiento manual autorizado, nunca una mutación
de la fecha.

### Stock y movimientos

```text
newBalance = balanceBefore + quantityDelta
newBalance >= 0
sum(lot.availableQuantity) = product.availableStock
```

`RECEIPT` y `POSITIVE_ADJUSTMENT` tienen delta positivo. `NEGATIVE_ADJUSTMENT`, `WASTE` y
`SALE_OUT` tienen delta negativo. `SALE_OUT` no representa una venta ni crea clientes, precios,
pedidos o comprobantes.

## Visibilidad por rol

| Dato                                    | owner_admin                        | inventory_manager                  | seller                                |
| --------------------------------------- | ---------------------------------- | ---------------------------------- | ------------------------------------- |
| Nombre, SKU, barcode, categoría, unidad | Leer/escribir                      | Leer/escribir                      | Leer                                  |
| Stock por producto/lote                 | Leer/escribir mediante movimientos | Leer/escribir mediante movimientos | Leer, sin costos                      |
| Costo unitario/total                    | Leer                               | Leer                               | No visible                            |
| Crear/editar/desactivar producto        | Sí                                 | Sí, según permiso                  | No                                    |
| Registrar lote/movimiento               | Sí                                 | Sí                                 | No                                    |
| Sugerencia FEFO                         | Sí                                 | Sí                                 | Solo consulta autorizada si se expone |
| Reglas y resolución de alertas          | Sí                                 | Sí                                 | Solo lectura de alertas permitidas    |
| Auditoría sensible                      | Sí                                 | Según permiso explícito            | No                                    |

## Concurrencia, idempotencia y rollback

1. El servicio abre una transacción con `TenantContext` validado.
2. Lee producto/lote y versión dentro de la transacción.
3. Valida permiso, estado, fecha, cantidad, saldo y clave idempotente.
4. Inserta movimiento, actualiza balance/versiones y recalcula alertas.
5. Inserta AuditEvent sanitizado y confirma todo; cualquier error revierte todos los pasos.
6. Una carrera de la misma clave tiene un único ganador; una carrera de saldo tiene un único
   resultado válido o conflictos seguros.

## Datos fuera del modelo

No se modelan SalesOrder, Sale, Customer, OCR result, BI fact, promotion, replenishment proposal,
consumer account ni offline queue en esta funcionalidad.
