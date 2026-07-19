# Quickstart de validación: Productos, inventario, lotes y vencimientos

Esta guía describe validaciones futuras para la implementación de 002. No crea código, migraciones,
datos reales ni conexiones remotas. El contrato está en [contracts/openapi.yaml](contracts/openapi.yaml)
y el modelo en [data-model.md](data-model.md).

## Prerequisites

- Módulo 001 implementado y sus suites de regresión verdes.
- Node.js 22 LTS y pnpm fijado por el monorepo.
- PostgreSQL 16 de pruebas separado de desarrollo/producción, con `DATABASE_URL` de prueba.
- Migración futura de 002 aplicada solo al ambiente de pruebas mediante `prisma migrate deploy`.
- Fixtures sintéticos deterministas: Tenant A/B, propietarios, inventory_manager, seller, productos,
  categorías, unidades, lotes y fechas UTC.
- Navegador para Playwright y dispositivo/emulador disponible para Maestro cuando se valide cliente.

## Quality gates

```text
corepack pnpm lint
corepack pnpm format:check
corepack pnpm typecheck
corepack pnpm test:unit
corepack pnpm test:integration
corepack pnpm test:contract
corepack pnpm test:security
corepack pnpm test:e2e:web
corepack pnpm test:e2e:mobile
corepack pnpm test:performance
```

Los nombres anteriores son la convención de validación; solo se ejecutan scripts existentes y no se
simulan comandos ausentes.

## Scenario 1 — Catálogo tenant-scoped (HU-001)

1. Iniciar sesión con `owner_admin` en Tenant A.
2. Crear categoría y unidad en A, comprobar sus listados, editar y cambiar sus estados; después
   crear el producto con nombre, SKU, barcode, umbral y días de alerta.
3. Buscar por nombre, SKU y barcode; editar el producto; desactivarlo y reactivarlo.
4. Repetir la búsqueda con sesión de Tenant B usando IDs, cursores y filtros de A.
5. Intentar duplicar SKU/barcode dentro de A y crear el mismo valor en B.
6. Intentar asociar al producto una categoría o unidad de B y comprobar el rechazo anti-enumeración.
7. Consultar como `seller` y comprobar que no aparecen costos.

**Expected**: unicidad por tenant, productos sin referencias cruzadas, categorías/unidades no
compartidas, estado lógico e información de costos filtrada por rol; A no revela datos a B.

## Scenario 2 — Ingreso de lotes (HU-002)

1. En A, registrar un lote del producto activo con ingreso UTC, vencimiento futuro, cantidad inicial
   y costo unitario.
2. Repetir con la misma `Idempotency-Key` y luego con payload diferente.
3. Intentar registrar lote con producto de B, producto inexistente, cantidad cero y fecha/costo inválidos.
4. Desactivar el producto e intentar registrar otro lote.
5. Consultar la trazabilidad del lote y la auditoría.
6. Consultar `GET /tenants/current/lots` con filtros de producto, categoría, estado, vencimiento,
   `expirationState`, `lowStock` y `stockState`, usando cursor estable del tenant.

**Expected**: un lote y un `RECEIPT` atómicos, retry equivalente, payload diferente en conflicto,
referencias A/B y valores inválidos rechazados, sin filas parciales; seller recibe proyección
operativa sin costo y owner/inventory_manager reciben costo solo cuando están autorizados.

## Scenario 3 — Kardex, saldos y no-negativos (HU-003)

1. Crear dos lotes vigentes con cantidades distintas.
2. Registrar ingreso, ajuste positivo, ajuste negativo, merma y `SALE_OUT` con motivos.
3. Consultar saldo por lote, saldo total y kardex paginado.
4. Intentar una salida mayor al saldo y una mutación con lote de B.
5. Ejecutar al menos 20 operaciones concurrentes sobre un lote.
6. Intentar editar o eliminar un movimiento confirmado.

**Expected**: saldo total igual a la suma de lotes, kardex append-only, cero saldo negativo,
rollback completo de fallos, un único resultado por idempotencia y conflictos seguros en carreras.

## Scenario 4 — FEFO y vencimientos (HU-004)

1. Crear tres lotes del mismo producto con vencimientos distintos y saldos disponibles.
2. Solicitar sugerencia FEFO para una cantidad parcial y una cantidad mayor al total.
3. Marcar un lote como vencido mediante reloj controlado.
4. Intentar consumir el lote vencido por flujo normal y luego mediante ajuste manual autorizado.
5. Verificar que `expiresAt` se envía como fecha (`YYYY-MM-DD`) y que el cambio de día se evalúa al
   inicio del día operativo local configurado para el tenant, mientras los timestamps permanecen UTC.

**Expected**: orden por vencimiento, ingreso e ID; lotes vencidos excluidos del flujo normal; la
excepción exige permiso/motivo y deja movimiento y auditoría.

## Scenario 5 — Alertas (HU-005)

1. Configurar stock mínimo y días de alerta para productos de A.
2. Reducir saldo por debajo del mínimo; acercar y superar fechas de vencimiento.
3. Consultar filtros por tipo, estado, categoría y cursor.
4. Resolver una alerta y volver a consultar su historial.
5. Consultar desde B usando IDs y cursores de A.

**Expected**: alertas LOW_STOCK, EXPIRING_SOON y EXPIRED correctas, sin duplicados activos,
resolución auditada y cero filtración A/B.

## Scenario 6 — Superficies web y móvil (HU-006)

1. En Playwright, consultar catálogo, inventario y lotes; usar filtros de categoría, estado, stock
   bajo y vencimiento, incluido el listado tenant-wide; confirmar ocultamiento de costos para seller.
2. En Maestro, consultar producto, registrar ingreso básico y abrir alertas.
3. Verificar estados de carga, vacío y error, y que ninguna app intenta abrir PostgreSQL.
4. Confirmar que no existen pasos OCR, ventas, clientes, BI u offline en el MVP.

**Expected**: web y móvil muestran solo el tenant activo, usan REST/OpenAPI y mantienen reglas
autoritativas en la API.

## Security assertions

- Comparar recurso de otro tenant contra UUID inexistente: mismo status, cuerpo y `correlationId`
  sanitizado cuando corresponda.
- Intentar cross-tenant en path, query, body, cursor, nested write, producto, lote, movimiento,
  balance, alerta y auditoría.
- Confirmar que `seller` nunca recibe `unitCost`, costo total, proveedor ni datos de compra.
- Confirmar que las respuestas `LotOperationalResponse` e `InventoryBalanceOperational` nunca
  incluyen costos, y que `LotAdminResponse`/`InventoryBalanceAdmin` solo los incluyen para roles
  autorizados del tenant activo.
- Buscar secretos o PII no autorizada en DB, logs, auditoría, errores y respuestas.
- Confirmar que la auditoría se revierte con la mutación cuando el insert de AuditEvent falla.

## Usability protocol — SC-008

La preparación y ejecución se limita al módulo 002 y no usa usuarios reales. La cohorte mínima es de
cuatro participantes sintéticos: al menos un `owner_admin` o responsable de bodega, un
`inventory_manager` o encargado de inventario y un `seller` o vendedor operativo; el cuarto participante
puede repetir uno de esos perfiles. Cada participante recibe un código anónimo, consentimiento y aviso
de privacidad, sin registrar nombres, teléfonos, correos ni credenciales.

Cada sesión se ejecuta en ambiente controlado con datos sintéticos y reloj/configuración de tenant
documentados. En orden fijo, cada participante intenta: crear producto; registrar lote con vencimiento;
consultar stock; revisar alerta de stock bajo; revisar alerta de vencimiento; y verificar que `seller`
no identifica campos de costo. Se cronometra cada tarea desde la instrucción hasta la finalización.
Se registra si fue completada en el primer intento, errores observables, solicitudes de ayuda correctiva,
comprensión de las alertas, confirmación de ausencia de costos para `seller` y comentarios cualitativos.

Una ayuda correctiva es cualquier explicación, indicación de control o intervención del evaluador; se
registra aparte y no convierte el primer intento en exitoso. La tasa de finalización es tareas completadas
sin ayuda en el primer intento dividida entre tareas intentadas. SC-008 se aprueba únicamente si al menos
90% de la cohorte completa todos los escenarios definidos en menos de 2 minutos por tarea y se conserva
la tabla individual de tiempos, errores, comprensión, privacidad y comentarios. Si no se ejecuta, el
resultado queda como pendiente, nunca como aprobado.

La evidencia se prepara y luego se completa solo con observaciones reales en
`specs/002-product-inventory-lots/evidence/usability.md`.

## Evidence

Conservar resultados reales en `specs/002-product-inventory-lots/evidence/` (a crear durante la
implementación), incluyendo el protocolo y los resultados de SC-008 en `usability.md`. No completar
métricas de rendimiento, usabilidad o E2E sin ejecución verificable.
