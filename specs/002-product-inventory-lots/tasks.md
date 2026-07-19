---
description: "Tareas ordenadas para productos, inventario, lotes, vencimientos, FEFO y alertas"
---

# Tasks: Productos, inventario, lotes y vencimientos

**Input**: Design documents from `/specs/002-product-inventory-lots/`

**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `quickstart.md` y
`contracts/openapi.yaml`.

**Tests**: Las pruebas son obligatorias para reglas de stock, FEFO, lotes, endpoints, privacidad,
aislamiento multi-tenant, concurrencia, auditoría, regresión del módulo 001 y objetivos aprobados
de rendimiento. Deben escribirse antes de la implementación sensible.

**Regla transversal**: TypeScript estricto; Prisma solo desde `apps/api`; web y móvil solo REST;
ninguna tarea puede omitir `TenantContext`, Membership, permisos por pertenencia, auditoría o
restricciones compuestas tenant-scoped.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Preparar límites, permisos, configuración y fixtures sin alterar todavía el módulo 001.

- [ ] T001 Documentar el bounded context de catálogo/inventario y sus límites con 001 en `docs/architecture/module-boundaries.md`, incluyendo exclusiones de ventas, clientes, OCR, BI y offline — FR-026, FR-028, FR-044.
- [ ] T002 [P] Añadir al catálogo tipado de permisos `inventory.products.read`, `inventory.products.write`, `inventory.lots.read`, `inventory.lots.write`, `inventory.stock.read`, `inventory.movements.read`, `inventory.movements.write`, `inventory.alerts.read` e `inventory.alerts.write` en `packages/authz-catalog/src/index.ts` — FR-029, FR-030.
- [ ] T003 [P] Definir configuración tipada de precisión, moneda, stock mínimo y días de alerta en `packages/config/src/inventory.config.ts` y sus pruebas en `packages/config/src/inventory.config.spec.ts` — FR-020, FR-035, FR-042.
- [ ] T004 [P] Crear builders de productos, categorías, unidades, lotes, movimientos y alertas A/B con UUID y fechas UTC deterministas en `packages/test-fixtures/src/inventory.ts` y exportarlos desde `packages/test-fixtures/src/index.ts` — FR-001, FR-007, FR-011, SC-001.
- [ ] T005 [P] Añadir validadores compartidos de cantidad, costo, fecha de vencimiento, SKU, barcode, paginación e idempotencia en `apps/api/src/common/validation/inventory.ts` con pruebas unitarias — FR-003, FR-009, FR-015, FR-035.
- [ ] T006 Actualizar el catálogo de rutas y permisos permitidos en `apps/api/src/http/routes.ts`, sin exponer rutas de ventas/OCR/BI — FR-023, FR-039, FR-044.
- [ ] T007 Preparar variables de entorno de PostgreSQL sintético, reloj controlado y salvaguarda contra producción en `apps/api/test/setup/inventory-test-environment.ts` — FR-043, SC-010.
- [ ] T008 [P] Documentar el nombre de migración futura, backup y rollback en `docs/runbooks/product-inventory-migration.md`, sin crear ni ejecutar la migración — FR-043, SC-010.

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Crear primero pruebas y contratos que bloquean todas las historias.

- [ ] T009 [P] Escribir la matriz negativa A/B para categorías, unidades, productos, lotes, saldos, movimientos, FEFO, alertas, filtros, cursores y nested writes en `apps/api/test/security/inventory-tenant-isolation.matrix.ts` — FR-026, FR-027, FR-028, SC-001.
- [ ] T010 [P] Escribir pruebas de persistencia de constraints compuestos, claves tenant-scoped, unicidad de categorías/unidades, no-negativos e invariantes de relaciones en `apps/api/test/persistence/inventory-schema.spec.ts` — FR-003, FR-007, FR-013, FR-028, FR-034, FR-042.
- [ ] T011 [P] Escribir pruebas contractuales de todos los operationId de `contracts/openapi.yaml` en `apps/api/test/contract/product-inventory.contract.spec.ts`, incluyendo categorías, unidades, listado global de lotes, campos desconocidos, PATCH parcial y respuestas por rol — FR-006, FR-023, FR-036, FR-039, FR-042.
- [ ] T012 [P] Escribir pruebas unitarias de decimal, precisión, fechas UTC, cantidades y costos en `apps/api/test/unit/inventory/quantity-validation.spec.ts` — FR-009, FR-035, SC-002.
- [ ] T013 [P] Escribir pruebas de transacción y auditoría obligatoria ante rollback, incluyendo categorías y unidades, en `apps/api/test/integration/inventory-audit-transaction.spec.ts` — FR-031, FR-032, FR-033, SC-007.
- [ ] T014 Implementar el modelo Prisma lógico y la migración versionada futura en `prisma/schema.prisma` y `prisma/migrations/0002_product_inventory_lots/migration.sql`, con rollback ensayado antes de aplicar en pruebas — FR-001, FR-007, FR-011, FR-043.
- [ ] T015 Implementar repositorio base tenant-aware y transacciones tipadas en `apps/api/src/modules/inventory/repositories/inventory-transaction.repository.ts`, exigiendo `TenantContext` y sin métodos por ID global — FR-026, FR-028, FR-033.
- [ ] T016 Implementar guards de tenant/pertenencia/permiso para el dominio en `apps/api/src/modules/inventory/guards/inventory-tenant.guard.ts` y `apps/api/src/modules/inventory/guards/inventory-permission.guard.ts` — FR-026, FR-027, FR-029, FR-030.
- [ ] T017 [P] Añadir errores seguros `STOCK_INSUFFICIENT`, `LOT_EXPIRED`, `IDEMPOTENCY_CONFLICT`, `STALE_STATE` y `INVENTORY_NOT_FOUND` en `apps/api/src/common/errors/error-catalog.ts` y probar `correlationId` — FR-027, FR-038.
- [ ] T018 Implementar adaptador de auditoría e idempotencia tenant-scoped en `apps/api/src/modules/inventory/services/inventory-audit.service.ts` y `apps/api/src/modules/inventory/services/inventory-idempotency.service.ts` — FR-015, FR-031, FR-032, FR-033.
- [ ] T019 [P] Regenerar y validar tipos del contrato compartido en `packages/api-contract/src/generated/index.ts` mediante `packages/api-contract/scripts/generate-client.mjs`, sin acceso de clientes a Prisma — FR-023, FR-039.

## Phase 3: User Story 1 — Catálogo de productos (Priority: P1)

**Goal**: Crear, editar, activar/desactivar y buscar productos y sus categorías/unidades dentro del
tenant activo.

**Independent Test**: `apps/api/test/integration/product-catalog.spec.ts` crea un producto en A,
valida búsqueda y estado, y confirma que A no lee ni modifica productos de B; `seller` no recibe
costos.

### Tests for User Story 1 (TDD)

- [ ] T020 [P] [US1] Escribir pruebas unitarias de normalización, unicidad y estados de Product, ProductCategory y UnitOfMeasure en `apps/api/test/unit/catalog/product.service.spec.ts` — FR-001, FR-003, FR-004, FR-005, FR-042.
- [ ] T021 [P] [US1] Escribir pruebas de persistencia para ProductCategory, UnitOfMeasure, Product, unicidad por tenant y referencias cruzadas, incluyendo rechazo de unidades/categorías A↔B, en `apps/api/test/persistence/product-constraints.spec.ts` — FR-001, FR-003, FR-028, FR-042.
- [ ] T022 [P] [US1] Escribir pruebas de integración de CRUD, búsqueda, paginación, estado y aislamiento A/B en `apps/api/test/integration/product-catalog.spec.ts` — FR-004, FR-005, FR-027, SC-001.
- [ ] T023 [P] [US1] Escribir pruebas de privacidad de costos para owner, inventory_manager y seller en `apps/api/test/security/product-cost-privacy.spec.ts` — FR-006, FR-036, SC-006.

### Implementation for User Story 1

- [ ] T024 [P] [US1] Implementar repositorios tenant-aware de categorías y unidades en `apps/api/src/modules/catalog/repositories/category.repository.ts` y `apps/api/src/modules/catalog/repositories/unit.repository.ts`, con unicidad, estados, `TenantContext` y anti-enumeración — FR-001, FR-028, FR-042.
- [ ] T025 [P] [US1] Implementar repositorio de productos con búsquedas por nombre/SKU/barcode y cursor tenant-scoped en `apps/api/src/modules/catalog/repositories/product.repository.ts` — FR-003, FR-005, FR-027, FR-037.
- [ ] T026 [US1] Implementar DTOs estrictos y validadores de producto, categoría y unidad en `apps/api/src/modules/catalog/dto/product.dto.ts`, `category.dto.ts` y `unit.dto.ts`, con `ProductUpdateRequest` parcial, sin `tenantId` ni campos desconocidos — FR-001, FR-002, FR-035, FR-039.
- [ ] T027 [US1] Implementar servicio de catálogo con CRUD/estado de categorías y unidades, activación/desactivación lógica de productos, If-Match, idempotencia y AuditEvent en `apps/api/src/modules/catalog/services/product.service.ts` — FR-004, FR-015, FR-016, FR-031, FR-033, FR-042.
- [ ] T028 [US1] Implementar controller REST de productos/categorías/unidades en `apps/api/src/modules/catalog/catalog.controller.ts` conforme a `contracts/openapi.yaml` — FR-005, FR-023, FR-038, FR-039.
- [ ] T029 [US1] Implementar serializadores por rol que omitan costos a seller en `apps/api/src/modules/catalog/dto/product-response.dto.ts` y añadir pruebas de regresión — FR-006, FR-036, SC-006.
- [ ] T030 [US1] Implementar únicamente la feature web de administración de productos, categorías, unidades y filtros en `apps/web/src/features/products/` — FR-023, FR-039.

## Phase 4: User Story 2 — Lotes e ingresos (Priority: P1)

**Goal**: Registrar lotes con vencimiento, cantidad, costo y trazabilidad únicamente para productos
del tenant activo.

**Independent Test**: `apps/api/test/integration/lot-receipt.spec.ts` crea un lote y su ingreso
atómico, fuerza errores y verifica rollback, auditoría y rechazo A/B.

### Tests for User Story 2 (TDD)

- [ ] T031 [P] [US2] Escribir pruebas unitarias de validación de lote, fechas, cantidad, costo y estado en `apps/api/test/unit/lots/lot.service.spec.ts` — FR-007, FR-008, FR-009, FR-010.
- [ ] T032 [P] [US2] Escribir pruebas de persistencia de Lot, referencias compuestas y prohibición de producto cross-tenant en `apps/api/test/persistence/lot-constraints.spec.ts` — FR-007, FR-009, FR-028.
- [ ] T033 [P] [US2] Escribir pruebas contractuales de alta/listado/detalle de lotes y del listado tenant-wide con filtros en `apps/api/test/contract/lots.contract.spec.ts`, incluyendo proyecciones de costo por rol — FR-007, FR-008, FR-036, FR-037, FR-039.
- [ ] T034 [P] [US2] Escribir integración de ingreso atómico, fallo de auditoría, idempotencia y rollback en `apps/api/test/integration/lot-receipt.spec.ts` — FR-015, FR-031, FR-033, SC-002, SC-007.

### Implementation for User Story 2

- [ ] T035 [P] [US2] Implementar repositorio tenant-aware de lotes en `apps/api/src/modules/lots/repositories/lot.repository.ts` — FR-007, FR-008, FR-028.
- [ ] T036 [US2] Implementar servicio transaccional de ingreso de lote, movimiento RECEIPT, balance inicial y auditoría en `apps/api/src/modules/lots/services/lot-receipt.service.ts` — FR-008, FR-012, FR-031, FR-033.
- [ ] T037 [US2] Implementar DTOs estrictos y controlador REST de lotes en `apps/api/src/modules/lots/dto/lot.dto.ts` y `apps/api/src/modules/lots/lots.controller.ts` — FR-007, FR-009, FR-023, FR-038.
- [ ] T038 [US2] Implementar repositorio/listado tenant-wide de lotes con cursor estable y filtros de producto, categoría, estado, vencimiento y stock, junto con serializadores `LotOperationalResponse`/`LotAdminResponse` en `apps/api/src/modules/lots/repositories/lot.repository.ts` y `apps/api/src/modules/lots/dto/lot-response.dto.ts` — FR-008, FR-036, FR-037.
- [ ] T039 [US2] Añadir pruebas móviles del ingreso básico con datos sintéticos en `apps/mobile/test/inventory/lot-receipt.spec.ts` y flujo preparado en `apps/mobile/e2e/inventory-receipt.yaml` — FR-024, FR-025, SC-010.

## Phase 5: User Story 3 — Stock, kardex y concurrencia (Priority: P1)

**Goal**: Mantener saldos por lote/producto, registrar movimientos inmutables y rechazar stock
negativo, duplicados y referencias A/B.

**Independent Test**: `apps/api/test/integration/inventory-movement.spec.ts` verifica el kardex y
saldos después de varios movimientos, rollback y carreras concurrentes sobre PostgreSQL real.

### Tests for User Story 3 (TDD)

- [ ] T040 [P] [US3] Escribir pruebas unitarias de deltas por tipo, saldo, redondeo y no-negativos en `apps/api/test/unit/inventory/movement.service.spec.ts` — FR-012, FR-013, FR-014.
- [ ] T041 [P] [US3] Escribir pruebas de persistencia de InventoryMovement/InventoryBalance, append-only y claves tenant-scoped en `apps/api/test/persistence/inventory-movement-constraints.spec.ts` — FR-013, FR-014, FR-028, FR-034, FR-041.
- [ ] T042 [P] [US3] Escribir pruebas de integración de rollback, idempotencia y concurrencia real en `apps/api/test/integration/inventory-movement.spec.ts` — FR-015, FR-016, FR-033, SC-002, SC-009.
- [ ] T043 [P] [US3] Escribir suite negativa A/B para categorías, unidades, path, body, query, cursor, nested write y no-enumeración en `apps/api/test/security/inventory-isolation.spec.ts` usando la matriz T009 — FR-027, FR-028, FR-037, FR-042, SC-001.
- [ ] T044 [P] [US3] Escribir pruebas de privacidad de kardex y costos por rol en `apps/api/test/security/inventory-cost-privacy.spec.ts` — FR-006, FR-036, SC-006.

### Implementation for User Story 3

- [ ] T045 [P] [US3] Implementar repositorios de movimientos y balances con transacciones Prisma en `apps/api/src/modules/inventory/repositories/movement.repository.ts` y `balance.repository.ts` — FR-013, FR-014, FR-028, FR-033.
- [ ] T046 [US3] Implementar servicio de movimientos con idempotencia, versión/bloqueo, cálculo de delta, rechazo negativo y rollback en `apps/api/src/modules/inventory/services/inventory-movement.service.ts` — FR-012, FR-013, FR-015, FR-016.
- [ ] T047 [US3] Implementar servicio de stock agregado por producto/lote y cursor en `apps/api/src/modules/inventory/services/inventory-balance.service.ts` — FR-011, FR-037.
- [ ] T048 [US3] Implementar DTOs, controller REST de balances y movimientos en `apps/api/src/modules/inventory/dto/movement.dto.ts` y `apps/api/src/modules/inventory/inventory.controller.ts` — FR-012, FR-023, FR-038, FR-039.
- [ ] T049 [US3] Implementar serialización de kardex que oculte costos a seller y errores seguros para stock insuficiente/cross-tenant en `apps/api/src/modules/inventory/dto/inventory-response.dto.ts` — FR-006, FR-027, FR-036.
- [ ] T050 [US3] Añadir pruebas de regresión append-only y fallo de auditoría para cada movimiento en `apps/api/test/integration/inventory-audit-regression.spec.ts` — FR-014, FR-031, FR-032, SC-007.

## Phase 6: User Story 4 — FEFO y vencimientos (Priority: P1)

**Goal**: Sugerir el lote que vence primero, excluir vencidos del flujo normal y auditar excepciones.

**Independent Test**: `apps/api/test/integration/fefo.spec.ts` crea lotes con fechas distintas,
comprueba el orden y prueba el rechazo/permiso de consumo vencido.

### Tests for User Story 4 (TDD)

- [ ] T051 [P] [US4] Escribir pruebas unitarias de orden FEFO, empates, saldos y fechas UTC en `apps/api/test/unit/inventory/fefo.service.spec.ts` — FR-017, FR-019, SC-004.
- [ ] T052 [P] [US4] Escribir pruebas negativas de lote vencido, excepción manual, permiso y motivo en `apps/api/test/security/fefo-expired.spec.ts` — FR-018, FR-038, SC-004.
- [ ] T053 [P] [US4] Escribir integración de sugerencia FEFO y auditoría de excepción en `apps/api/test/integration/fefo.spec.ts` — FR-017, FR-018, FR-031, FR-033.

### Implementation for User Story 4

- [ ] T054 [US4] Implementar repositorio de consulta FEFO con filtro tenant/lote vigente en `apps/api/src/modules/inventory/repositories/fefo.repository.ts` — FR-017, FR-027, FR-028.
- [ ] T055 [US4] Implementar servicio de sugerencias y autorización de ajuste vencido en `apps/api/src/modules/inventory/services/fefo.service.ts` — FR-017, FR-018, FR-019.
- [ ] T056 [US4] Exponer endpoint de sugerencia FEFO y reason code de excepción en `apps/api/src/modules/inventory/inventory.controller.ts` y `apps/api/src/modules/inventory/dto/fefo.dto.ts` — FR-019, FR-023, FR-038, FR-039.

## Phase 7: User Story 5 — Alertas de inventario (Priority: P2)

**Goal**: Generar, listar, filtrar y resolver alertas tenant-scoped de stock y vencimiento.

**Independent Test**: `apps/api/test/integration/inventory-alerts.spec.ts` cambia saldos/fechas,
comprueba las tres alertas, resolución, historial y aislamiento A/B.

### Tests for User Story 5 (TDD)

- [ ] T057 [P] [US5] Escribir pruebas unitarias de reglas LOW_STOCK, EXPIRING_SOON y EXPIRED y transición activo/resuelto en `apps/api/test/unit/alerts/alert.service.spec.ts` — FR-020, FR-021, FR-022, SC-005.
- [ ] T058 [P] [US5] Escribir pruebas de persistencia de AlertRule/InventoryAlert, no duplicación activa e historial lógico en `apps/api/test/persistence/alert-constraints.spec.ts` — FR-020, FR-021, FR-034.
- [ ] T059 [P] [US5] Escribir integración de recálculo después de movimiento, cambio de regla, resolución y fallo transaccional en `apps/api/test/integration/inventory-alerts.spec.ts` — FR-021, FR-022, FR-031, FR-033, SC-005.
- [ ] T060 [P] [US5] Escribir suite negativa de alertas A/B, filtros, cursores y permisos seller en `apps/api/test/security/alert-isolation.spec.ts` — FR-027, FR-036, FR-037, SC-001, SC-006.

### Implementation for User Story 5

- [ ] T061 [P] [US5] Implementar repositorios de reglas y alertas tenant-aware en `apps/api/src/modules/alerts/repositories/alert-rule.repository.ts` y `alert.repository.ts` — FR-020, FR-021, FR-028.
- [ ] T062 [US5] Implementar servicio de evaluación, deduplicación, resolución e historial en `apps/api/src/modules/alerts/services/alert.service.ts` — FR-021, FR-022, FR-031, FR-034.
- [ ] T063 [US5] Integrar el recálculo de alertas en las transacciones de lotes y movimientos mediante `apps/api/src/modules/alerts/services/inventory-alert-hook.service.ts` — FR-021, FR-033.
- [ ] T064 [US5] Implementar DTOs y endpoints de alertas, incluida la resolución en `PATCH /tenants/current/alerts/{alertId}/resolve`, en `apps/api/src/modules/alerts/dto/alert.dto.ts` y `apps/api/src/modules/alerts/alerts.controller.ts` — FR-022, FR-023, FR-038, FR-039.
- [ ] T065 [US5] Implementar serialización por rol y auditoría de resolución en `apps/api/src/modules/alerts/dto/alert-response.dto.ts` — FR-031, FR-036, SC-006, SC-007.

## Phase 8: User Story 6 — Web y móvil (Priority: P2)

**Goal**: Entregar vistas operativas web y móvil sobre el mismo contrato y reglas del backend.

**Independent Test**: Playwright y Maestro recorren consulta, filtros, ingreso básico y alertas con
datos sintéticos, comprobando estados de carga/vacío/error y aislamiento.

### Tests for User Story 6 (TDD)

- [ ] T066 [P] [US6] Escribir E2E Playwright de productos, inventario, lotes tenant-wide, filtros, costos y auditoría visible en `apps/web/e2e/product-inventory.spec.ts` — FR-023, FR-036, FR-039, SC-006, SC-010.
- [ ] T067 [P] [US6] Preparar flujo Maestro de consulta, ingreso básico y alertas en `apps/mobile/e2e/inventory-access-flow.yaml` con datos sintéticos y sin OCR — FR-024, FR-025, FR-044.
- [ ] T068 [P] [US6] Escribir pruebas de componentes de estados loading/empty/error, etiquetas accesibles, foco/teclado web y accesibilidad móvil del tenant activo en `apps/web/test/product-inventory.spec.tsx` y `apps/mobile/test/inventory.spec.ts` — FR-023, FR-024, SC-010.

### Implementation for User Story 6

- [ ] T069 [P] [US6] Implementar el cliente tipado web de productos, categorías, unidades, lotes, inventario, FEFO y alertas en `apps/web/src/api/inventory-client.ts` — FR-023, FR-039.
- [ ] T070 [US6] Implementar pantalla web de administración de productos y filtros en `apps/web/src/features/products/` — FR-002, FR-005, FR-023.
- [ ] T071 [US6] Implementar pantalla web de inventario, kardex, listado tenant-wide de lotes y vencimientos en `apps/web/src/features/inventory/` y `apps/web/src/features/lots/` — FR-008, FR-011, FR-012, FR-023.
- [ ] T072 [US6] Implementar vista web de alertas con filtros por categoría, stock bajo y vencimiento en `apps/web/src/features/alerts/` — FR-020, FR-021, FR-022, FR-023.
- [ ] T073 [US6] Implementar cliente móvil y consulta rápida de productos/stock, registro básico de ingreso y alertas en `apps/mobile/src/api/inventory-client.ts` y `apps/mobile/src/features/products/` — FR-006, FR-024.
- [ ] T074 [US6] Implementar registro móvil básico de ingreso y vista de alertas en `apps/mobile/src/features/inventory/` y `apps/mobile/src/features/alerts/` — FR-024, FR-025.
- [ ] T075 [US6] Añadir estados de carga, vacío, error seguro, etiquetas accesibles y selector de tenant reutilizando `TenantContext` en web/móvil — FR-026, FR-027, FR-038, SC-001.

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: Validar contrato, seguridad, rendimiento, documentación y regresión sin ampliar el alcance.

- [ ] T076 [P] Validar que el contrato implementado coincide con `specs/002-product-inventory-lots/contracts/openapi.yaml` mediante `apps/api/test/contract/openapi-conformance.spec.ts` — FR-039, SC-010.
- [ ] T077 [P] Ejecutar matriz reutilizable de aislamiento A/B para cada endpoint/repositorio en `apps/api/test/security/inventory-isolation.matrix.ts` y `inventory-isolation.spec.ts` — FR-027, FR-028, SC-001.
- [ ] T078 [P] Ejecutar suite de ausencia de costos y secretos en DB, logs, auditoría y respuestas en `apps/api/test/security/inventory-privacy.spec.ts` — FR-006, FR-031, FR-036, SC-006, SC-007.
- [ ] T079 [P] Ejecutar pruebas append-only de kardex y AuditEvent con rollback ante fallo en `apps/api/test/persistence/inventory-audit-append-only.spec.ts` — FR-014, FR-031, FR-032, FR-034.
- [ ] T080 [P] Preparar escenarios k6 de búsquedas, listado de lotes, balances, FEFO, alertas y movimientos en `apps/api/test/performance/product-inventory.js` sin inventar métricas — FR-005, FR-011, FR-017, FR-021, SC-003.
- [ ] T081 Actualizar workflows `.github/workflows/quality.yml`, `security-tests.yml`, `mvp-api-tests.yml` y `performance.yml` para generar Prisma Client, aplicar migración de prueba y ejecutar solo suites existentes — FR-040, FR-043, SC-010.
- [ ] T082 [P] Documentar la validación completa y resultados reales en `specs/002-product-inventory-lots/evidence/` y actualizar `quickstart.md` — FR-040, SC-010.
- [ ] T083 [P] Verificar que no se agregaron rutas, dependencias o artefactos de ventas, clientes, OCR, BI, promociones, IA, reposición, consumidores u offline en `specs/002-product-inventory-lots/evidence/scope-audit.md` — FR-044, SC-010.
- [ ] T084 Ejecutar lint, format, TypeScript estricto y revisión de `any` injustificado en todo el monorepo — FR-035, FR-040, SC-010.
- [ ] T085 Ejecutar regresión completa del módulo 001 (configuración, seguridad, persistencia, contrato, integración y E2E disponibles) contra PostgreSQL de pruebas — FR-040, SC-010.
- [ ] T086 Ejecutar la validación de `quickstart.md`, comprobar métricas de SC-001…SC-010 y dejar el gate documentado en `specs/002-product-inventory-lots/evidence/mvp-results.md` — FR-040, SC-001, SC-002, SC-003, SC-004, SC-005, SC-006, SC-007, SC-008, SC-009, SC-010.
- [ ] T087 [P] Preparar el protocolo e instrumento de usabilidad controlada para SC-008 en `specs/002-product-inventory-lots/evidence/usability.md`, con cuatro usuarios internos sintéticos (mínimo `owner_admin`/responsable de bodega, `inventory_manager`/encargado de inventario y `seller`/vendedor operativo), consentimiento/privacidad, códigos anónimos, orden de escenarios, cronometraje individual, primer intento y definición de ayuda correctiva — FR-040, SC-008.
- [ ] T088 Ejecutar, cuando existan las superficies implementadas, los escenarios de SC-008 (crear producto; registrar lote con vencimiento; consultar stock; revisar alerta de stock bajo; revisar alerta de vencimiento; verificar que `seller` no identifica campos de costo) y registrar únicamente resultados observados en `specs/002-product-inventory-lots/evidence/usability.md`: tiempo por tarea, tasa de finalización, errores, comprensión de alertas, confirmación de privacidad de costos y comentarios cualitativos; aprobar solo si ≥90% de la cohorte completa cada escenario en <2 minutos sin ayuda correctiva en el primer intento — FR-006, FR-023, FR-024, FR-036, SC-008.

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: T001–T008 no dependen de historias; T002–T005 pueden ejecutarse en paralelo.
- **Foundational (Phase 2)**: T009–T013 son pruebas rojas y bloquean T014–T019; T009–T013 pueden
  ejecutarse en paralelo en archivos distintos.
- **US1, US2, US3 y US4 (P1)**: dependen de Foundation. US2 depende de las entidades de US1; US3
  depende de productos/lotes; US4 depende de saldos y lotes. Dentro de cada historia, tests preceden
  implementación.
- **US5 (P2)**: depende de saldos/lotes y se integra con movimientos.
- **US6 (P2)**: depende de endpoints estabilizados de US1–US5 y del cliente generado.
- **Polish**: T076–T088 dependen de las historias que validan y no agregan funcionalidad comercial;
  T087 prepara el protocolo y T088 solo puede ejecutarse después de US6 y T087.

### User Story Dependencies

- **US1 (P1)**: después de T019; habilita el catálogo base para US2.
- **US2 (P1)**: después de US1; habilita lotes y saldo inicial para US3/US4.
- **US3 (P1)**: después de US2; habilita kardex y stock para US4/US5.
- **US4 (P1)**: después de US3; prepara salidas futuras sin ventas.
- **US5 (P2)**: después de US3 y puede comenzar en paralelo con US4 cuando existan balances.
- **US6 (P2)**: después de contratos y endpoints; web y móvil pueden implementarse en paralelo.

### Parallel Opportunities

- T002–T005 y T008 en paralelo después de revisar la especificación.
- T009–T013 en paralelo como primera fase TDD.
- En US1: T020–T023 en paralelo; luego T024/T025 en paralelo y T026–T030 en secuencia por servicio.
- En US2: T031–T034 en paralelo; T035 y DTOs pueden comenzar tras el modelo; integración solo tras servicio.
- En US3: T040–T044 en paralelo; repositorios T045 y pruebas de aislamiento pueden avanzar separados.
- En US4 y US5, pruebas unitarias/seguridad/persistencia de cada historia son paralelas antes del servicio.
- En US6, web (T070–T072) y móvil (T073–T074) son paralelos tras T069.
- T076–T083 y T087 son paralelos una vez estabilizados los endpoints; T084–T086 y T088 cierran el gate
  cuando existan las ejecuciones verificables.

## Implementation Strategy

### MVP First (P1)

1. Completar Setup y Foundation, manteniendo las pruebas rojas antes de código.
2. Completar US1: catálogo tenant-scoped y privacidad de costos.
3. Completar US2: lotes e ingreso atómico.
4. Completar US3: kardex, saldos, no-negativos, concurrencia e idempotencia.
5. Completar US4: FEFO y excepciones vencidas.
6. Detenerse y validar el MVP P1 con PostgreSQL real, aislamiento A/B, auditoría y regresión 001.

### Incremental Delivery

1. Añadir US5 (alertas) y validar sus transiciones e historial.
2. Añadir US6 web/móvil sin duplicar reglas ni acceso a PostgreSQL.
3. Ejecutar Polish, k6 y evidencia real; no activar ventas, clientes, OCR, BI u offline.

### Definition of Done

Cada tarea solo se marca cuando la prueba o evidencia indicada existe, es ejecutable y pasa en el
ambiente autorizado. Las migraciones se revisan y ensayan en PostgreSQL de pruebas; no se ejecutan
contra producción. Todos los recursos permanecen tenant-scoped y la regresión del módulo 001 continúa
verde.
