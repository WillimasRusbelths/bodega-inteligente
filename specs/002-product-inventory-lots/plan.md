# Implementation Plan: Productos, inventario, lotes y vencimientos

**Branch**: `002-product-inventory-lots` | **Date**: 2026-07-18 | **Spec**: [spec.md](spec.md)

**Input**: Especificación de productos, inventario, lotes, vencimientos, FEFO y alertas para una
bodega familiar multi-tenant.

## Summary

Extender el backend REST existente del módulo 001 con un bounded context de catálogo e inventario
OLTP. Products, categorías, unidades y lotes serán tenant-scoped; los movimientos formarán un kardex append-only y una
proyección de saldo protegida contra negativos. FEFO y alertas se calcularán con reglas por producto
y tenant. Web y móvil consumirán OpenAPI, sin acceso directo a PostgreSQL. Cada mutación sensible será
transaccional, idempotente cuando corresponda, concurrente de forma segura y auditada con el
`AuditEvent` existente.

## Technical Context

**Language/Version**: TypeScript estricto sobre Node.js 22 LTS.

**Primary Dependencies**: NestJS REST existente, Prisma 6.x, PostgreSQL 16.x, OpenAPI versionado,
Vitest, Supertest, Playwright, Maestro y k6 ya aprobados por el monorepo.

**Storage**: PostgreSQL mediante Prisma. La migración futura será posterior a
`0001_identity_access_mvp` (nombre propuesto `0002_product_inventory_lots`); esta fase no crea ni
aplica migraciones.

**Testing**: Vitest para unidades y contratos, PostgreSQL real de pruebas para persistencia e
integración, Supertest para HTTP, suite A/B de seguridad, Playwright/Maestro para superficies y k6
para objetivos de rendimiento. La regresión completa del módulo 001 debe pasar.

**Target Platform**: API Node.js; web React/Vite responsive; móvil React Native/Expo. Los clientes
solo consumen la API REST.

**Project Type**: Monorepo TypeScript con `apps/api`, `apps/web`, `apps/mobile` y paquetes compartidos
de contratos, autorización, configuración y fixtures.

**Performance Goals**: 95% de búsquedas y consultas operativas visibles en menos de 1 segundo en
ambiente controlado; p95 de endpoints de lectura/movimiento menor a 300 ms sin contar latencia del
dispositivo; cero saldos negativos o movimientos duplicados en carreras de prueba.

**Constraints**: Aislamiento por `TenantContext` en guards, servicios, repositorios, relaciones y
pruebas; categorías y unidades siempre pertenecen a un tenant; costos ocultos a `seller` mediante
proyecciones operativas separadas de las administrativas; auditoría atómica; FEFO sin consumo vencido normal; sin ventas,
clientes, OCR, BI, promociones, reposición inteligente, app de consumidores ni offline.

**Scale/Scope**: Piloto con datos sintéticos de dos tenants, productos, categorías, lotes y al menos
20 operaciones concurrentes sobre un lote; preparado para múltiples bodegas desde el inicio.

## Constitution Check

_GATE: evaluado antes de Phase 0 y nuevamente después del diseño._

- **Specification and traceability — PASS**: HU-001…HU-006, FR-001…FR-044 y SC-001…SC-010 se
  relacionan con modelo, contrato, quickstart, pruebas y tareas.
- **Multi-tenant isolation — PASS**: toda entidad de inventario lleva tenant; las relaciones y
  claves lógicas comprueban coherencia; se planifican pruebas negativas A/B y anti-enumeración.
- **Decoupled architecture — PASS**: web y móvil usan únicamente API REST/OpenAPI; Prisma queda en
  la API y no se exponen tablas ni reglas autoritativas a clientes.
- **Security and privacy — PASS**: RBAC por pertenencia, costos restringidos, validación server-side,
  errores seguros, correlationId y datos sintéticos; no se agregan secretos ni PII innecesaria.
- **Data integrity — PASS**: movimientos, saldos, alertas y auditoría comparten transacción;
  idempotencia, versiones/bloqueos, FEFO y rollback están definidos.
- **Quality gates — PASS**: se planifican unidades, persistencia, contratos, integración,
  aislamiento A/B, privacidad de costos, accesibilidad funcional, protocolo de usabilidad SC-008,
  E2E y k6, además de regresión del módulo 001.
- **MVP discipline — PASS**: ventas, clientes, OCR, BI, promociones, IA, reposición, consumidores y
  offline permanecen explícitamente fuera de alcance.

**Gate Result (pre-research)**: PASS, sin violaciones ni excepciones.

## Architecture

### Componentes y responsabilidades

1. **Catalog**: Product, ProductCategory y UnitOfMeasure; valida unicidad tenant-scoped, estados,
   CRUD y cambios de estado de categorías/unidades, búsqueda y visibilidad por rol.
2. **Lots**: alta de Lot ligada a Product del mismo tenant; conserva ingreso, vencimiento, costo,
   cantidad inicial y estado histórico.
3. **Inventory**: InventoryMovement append-only e InventoryBalance consistente; ejecuta transacciones,
   idempotencia, concurrencia y no-negativos.
4. **FEFO**: servicio de sugerencias ordenadas por vencimiento que excluye lotes vencidos salvo
   excepción manual autorizada.
5. **Alerts**: reglas por producto y alertas de stock bajo/próximo a vencer/vencido, tenant-scoped,
   resolubles y auditadas.
6. **Audit**: reutiliza `AuditEvent` append-only del módulo 001; una falla de auditoría revierte la
   mutación sensible.
7. **Clients**: web administra catálogo/inventario/lotes/filtros; móvil consulta, registra ingresos
   básicos y muestra alertas. Ambos definen etiquetas accesibles y estados de carga/vacío/error; ninguno
   accede a Prisma/PostgreSQL.

### Cadena de autorización

Cada request atraviesa autenticidad de sesión → vigencia de usuario, tenant y Membership → permiso
derivado de rol → `TenantContext` → repositorio tenant-aware → respuesta filtrada por rol. Un ID,
cursor, filtro o relación de otro tenant produce el mismo `404 RESOURCE_NOT_FOUND` seguro que un
recurso inexistente cuando no debe revelarse existencia.

El contrato OpenAPI incluye operaciones tenant-scoped para categorías y unidades (listar, crear,
editar y cambiar estado), productos, lotes por producto y un listado global de lotes con filtros por
producto, categoría, estado, vencimiento y stock. Las respuestas de lotes y saldos usan proyecciones
operativas sin costos o proyecciones administrativas con `unitCost` solo para `owner_admin` e
`inventory_manager`.

### Límites transaccionales

Alta de lote: valida producto → crea lote → movimiento `RECEIPT` → balance → alertas → AuditEvent.
Movimiento: valida estado/permiso → verifica idempotencia → bloquea o versiona lote/balance → calcula
delta → rechaza negativo → inserta kardex → actualiza proyección → recalcula alertas → audita. Todo
conflicto revierte la transacción completa.

### Persistencia y migración

El diseño lógico está en [data-model.md](data-model.md). La implementación creará una migración
Prisma posterior a la existente, con constraints e índices tenant-scoped, seed sintético y rollback
ensayado. No se alterará `0001_identity_access_mvp` salvo una incompatibilidad demostrada.

## Project Structure

### Documentation (this feature)

```text
specs/002-product-inventory-lots/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── openapi.yaml
├── checklists/
│   └── requirements.md
└── tasks.md
```

### Source Code (target repository structure)

```text
apps/api/src/modules/
├── catalog/
│   ├── dto/
│   ├── repositories/
│   ├── services/
│   └── catalog.controller.ts
├── inventory/
│   ├── dto/
│   ├── repositories/
│   ├── services/
│   ├── guards/
│   └── inventory.controller.ts
├── lots/
│   ├── dto/
│   ├── repositories/
│   ├── services/
│   └── lots.controller.ts
├── alerts/
│   ├── dto/
│   ├── repositories/
│   ├── services/
│   └── alerts.controller.ts
└── audit/                         # Reutiliza infraestructura de 001

apps/api/src/http/routes.ts         # Catálogo explícito de rutas y permisos del módulo

apps/api/test/
├── unit/{catalog,inventory,lots,alerts}/
├── persistence/{product,lot,inventory,alerts}/
├── contract/product-inventory.contract.spec.ts
├── integration/{product-lot,inventory-movement,alerts}.spec.ts
└── security/{inventory-tenant-isolation,cost-privacy,fefo-expired}.spec.ts

apps/web/src/features/
├── products/
├── inventory/
├── lots/
└── alerts/

apps/mobile/src/features/
├── products/
├── inventory/
└── alerts/

prisma/
└── migrations/0002_product_inventory_lots/ # futuro, no crear en esta fase de diseño
```

**Structure Decision**: Se mantienen módulos bounded-context dentro de la API existente y features
separadas en web/móvil. Los paquetes compartidos solo contienen tipos OpenAPI, catálogo de permisos,
configuración y fixtures; las reglas de stock permanecen en la API.

## Delivery Phases

1. **Foundation**: permisos, contratos, validadores tenant-aware, migración/fixtures de diseño y
   harness de pruebas PostgreSQL.
2. **P1 Catalog + Lots**: productos, categorías/unidades, lotes e ingreso atómico.
3. **P1 Inventory + FEFO**: kardex, balances, movimientos, concurrencia, idempotencia y sugerencias.
4. **P2 Alerts**: reglas, cálculo, listado, resolución e historial.
5. **P2 Clients**: pantallas web y móvil con estados de carga/vacío/error y filtros.
6. **Cross-cutting**: OpenAPI generado, seguridad A/B, privacidad de costos, E2E, k6, documentación
   y regresión 001.

## Post-design Constitution Check

- **Traceability — PASS**: el modelo, contrato, quickstart y tareas referencian FR/HU/SC de la
  especificación; las tareas de prueba preceden a la implementación sensible.
- **Tenant/security — PASS**: no existe endpoint sin tenant activo; los serializers de costos tienen
  matriz por rol; los intentos A/B, cursores y nested writes están en tareas.
- **Transactions/audit — PASS**: la secuencia movimiento → balance → alertas → auditoría es una
  unidad; rollback e idempotencia están en modelo, contrato y pruebas.
- **MVP/out-of-scope — PASS**: no se agregan rutas de ventas, clientes, OCR, BI, promociones, IA,
  consumidores u offline.

**Gate Result (post-design)**: PASS.

## Complexity Tracking

No se registran violaciones constitucionales. La separación Catalog/Lots/Inventory/Alerts conserva
responsabilidades claras dentro de la API existente y no introduce microservicios ni acceso alterno a
la base de datos.
