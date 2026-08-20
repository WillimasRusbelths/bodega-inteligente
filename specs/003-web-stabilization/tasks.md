---
description: "Tareas ordenadas para estabilizar datos, sincronización, permisos y experiencia web"
---

# Tasks: Estabilización funcional de la web

**Input**: `specs/003-web-stabilization/spec.md`, `specs/003-web-stabilization/plan.md` y
`.specify/memory/constitution.md`.

**Formato**: `[ID] [P?] [HU?] Descripción verificable — trazabilidad FR/SC — ruta concreta`.

**Total planificado**: 74 tareas, numeradas consecutivamente de T001 a T074.

**TDD y ambiente**: las pruebas indicadas se escriben o ajustan antes de la implementación que
protegen y deben fallar por la razón esperada. Toda validación se realiza localmente con datos
sintéticos y, cuando requiere persistencia, PostgreSQL en `127.0.0.1:5432`.

**Reglas transversales**: TypeScript estricto; la web consume solo REST; el backend conserva la
autoridad sobre tenant, permisos, stock, FEFO, transacciones y auditoría. No se crean reglas de
negocio, endpoints alternativos, tablas, cambios de esquema ni autenticación. Los datos de
`demo-data.ts` no pueden alimentar superficies operativas conectadas.

## Phase 1 — Preparación y auditoría del wiring local

**Propósito**: demostrar qué rutas existentes están montadas antes de tocar adquisición web o wiring.

- [x] T001 Crear la matriz local de rutas consumidas por `InventoryWebApi`, `InventoryBiApi` y ventas, con método, forma de respuesta, servicio existente y resultado observado — FR-001, FR-021, FR-024 — `specs/003-web-stabilization/evidence/local-endpoint-wiring.md`
- [x] T002 [P] Escribir y ejecutar primero pruebas de boundary para productos operativos, lotes, balances, movimientos, alertas y FEFO; registrar cada ruta montada o brecha reproducible — FR-001, FR-002, FR-021, FR-024 — `apps/api/test/contract/web-inventory-wiring.contract.spec.ts`
- [x] T003 [P] Escribir y ejecutar primero pruebas de boundary para resumen de productos de venta, ventas y las cinco lecturas BI existentes; registrar cada ruta montada o brecha reproducible — FR-001, FR-021, FR-024 — `apps/api/test/contract/web-sales-bi-wiring.contract.spec.ts`
- [x] T004 Aplicar, solo si T002 demuestra una ruta declarada desconectada, wiring mínimo en el servidor local hacia el controller/servicio de inventario ya existente; si no hay brecha, cerrar con evidencia y cero cambios backend — FR-001, FR-011, FR-024 — `apps/api/src/http/main.ts`, `apps/api/test/contract/web-inventory-wiring.contract.spec.ts`
- [x] T005 Aplicar, solo si T003 demuestra una ruta declarada desconectada, wiring mínimo hacia los servicios existentes de ventas o BI; si no hay brecha, cerrar con evidencia y cero cambios backend — FR-001, FR-011, FR-024 — `apps/api/src/http/main.ts`, `apps/api/test/contract/web-sales-bi-wiring.contract.spec.ts`
- [x] T006 Completar la matriz con evidencia verde de T002/T003 y, cuando aplique, T004/T005; confirmar que no se añadió ningún endpoint, regla ni implementación paralela — FR-001, FR-011, FR-024 — `specs/003-web-stabilization/evidence/local-endpoint-wiring.md`

**Checkpoint**: todas las rutas necesarias están demostradas; cualquier cambio backend está limitado
a wiring respaldado por una prueba previa.

---

## Phase 2 — Pruebas de regresión iniciales

**Propósito**: fijar el comportamiento actual y crear las pruebas rojas que guían el sprint.

- [ ] T007 Ejecutar la regresión web existente antes de cambios y registrar comandos, resultados y fallos preexistentes sin corregirlos todavía — FR-022, SC-003, SC-006 — `specs/003-web-stabilization/evidence/initial-web-regression.md`, `apps/web/test/demo.spec.ts`, `apps/web/test/mvp-web.spec.ts`, `apps/web/test/product-inventory.spec.tsx`, `apps/web/test/bi-dashboard.spec.ts`
- [ ] T008 Ejecutar localmente la regresión API existente de productos, inventario, FEFO, alertas, BI y ventas rápidas y registrar resultados sin cambiar reglas de negocio — FR-011, FR-021, FR-023, FR-024 — `specs/003-web-stabilization/evidence/initial-api-regression.md`, `apps/api/test/contract/product-inventory.contract.spec.ts`, `apps/api/test/integration/quick-sales.spec.ts`
- [ ] T009 [P] [HU-001] Escribir prueba roja que detecte imports o render operativo conectado desde `demo-data.ts`, incluido el snapshot conocido de stock — FR-001, FR-022, NFR-006, SC-003 — `apps/web/test/web-stabilization-no-fixtures.spec.ts`
- [ ] T010 [P] [HU-001] Escribir prueba roja de consistencia que compare el stock autoritativo del mismo producto en ventas rápidas, operación e indicadores antes y después de una venta — FR-001, FR-002, FR-003, FR-004, FR-022, SC-001, SC-002 — `apps/web/test/web-stabilization-stock.spec.ts`
- [ ] T011 [P] [HU-002] Escribir pruebas rojas de la matriz de navegación para `owner_admin`, `inventory_manager` y `seller`, incluyendo Data Warehouse, Empleados/roles integrados y ausencia de Permisos separado y Roadmap — FR-006, FR-007, FR-008, FR-009, FR-010, FR-017, FR-022, SC-004 — `apps/web/test/web-stabilization-navigation.spec.ts`
- [ ] T012 [P] [HU-002] Escribir prueba roja de privacidad que recorra contenido, estado, errores y HTML de `seller` buscando costos, valorización, pérdida estimada y datos de compra — FR-010, FR-011, FR-022, NFR-004, SC-005 — `apps/web/test/web-stabilization-seller-privacy.spec.ts`
- [ ] T013 [P] [HU-003] Escribir pruebas rojas para carga, contenido, vacío, error con `correlationId`, stale y recuperación por recurso sin perder entradas seguras — FR-005, FR-012, FR-013, FR-014, FR-015, FR-016, FR-022, SC-006 — `apps/web/test/web-stabilization-states.spec.ts`
- [ ] T014 [P] [HU-004] Preparar pruebas Playwright rojas de login, stock y venta en 320, 768 y 1440 px, con detección de overflow, superposición, foco y recorrido por teclado — FR-017, FR-018, FR-019, FR-020, FR-022, NFR-002, NFR-003, SC-007, SC-008 — `apps/web/e2e/web-stabilization-responsive-accessibility.spec.ts`

**Checkpoint**: la línea base está documentada y las regresiones del sprint fallan por las brechas
descritas en `spec.md`, no por configuración o datos ajenos al alcance.

---

## Phase 3 — Modelo agregado y adquisición de datos

**Propósito**: construir la única proyección web común sin calcular stock ni usar snapshots.

- [ ] T015 [P] [HU-001] Escribir contratos unitarios del normalizador para arreglo de resumen de ventas, respuesta `data` y página operativa; exigir preservación exacta de `availableStock` recibido y rechazo de formas inválidas — FR-001, FR-002, FR-004, FR-022, NFR-006, SC-001 — `apps/web/test/operational-data-adapter.spec.ts`
- [ ] T016 [P] [HU-003] Escribir pruebas unitarias de `ResourceState` para `idle`, `loading`, `ready`, `empty`, `error` y `stale`, con `receivedAt`, `correlationId` y ciclo de sincronización — FR-005, FR-012, FR-013, FR-014, SC-006 — `apps/web/test/operational-dashboard-state.spec.ts`
- [ ] T017 [P] [HU-001] Escribir pruebas del cliente de ventas para GET/POST existentes, errores seguros y ausencia de reintento automático de la mutación — FR-003, FR-004, FR-005, FR-014, FR-015, NFR-005 — `apps/web/test/sales-client.spec.ts`
- [ ] T018 [P] [HU-001] Escribir pruebas del contexto/generación que descarten respuestas tardías, limpien datos al cambiar tenant/pertenencia y no persistan datos operativos en `sessionStorage` — FR-006, FR-021, FR-022, SC-004 — `apps/web/test/operational-dashboard-context.spec.ts`
- [ ] T019 [HU-001] Implementar los tipos `WebSessionContext`, `ResourceState`, `SaleMutationState` y `OperationalDashboardState` sin campos de persistencia ni reglas de stock — FR-001, FR-005, FR-006, FR-012, NFR-006 — `apps/web/src/features/dashboard/operational-dashboard-state.ts`
- [ ] T020 [HU-001] Implementar el adaptador que normaliza contratos existentes al producto/modelo operativo común, conserva la procedencia del stock backend y elimina toda aritmética o fallback a snapshots — FR-001, FR-002, FR-004, NFR-006, SC-001, SC-003 — `apps/web/src/api/operational-data-adapter.ts`
- [ ] T021 [P] [HU-001] Implementar el cliente tipado de ventas sobre `GET/POST /tenants/current/sales` y el resumen existente de productos, preservando errores seguros — FR-001, FR-003, FR-004, FR-014, FR-021 — `apps/web/src/api/sales-client.ts`
- [ ] T022 [HU-001] Implementar el coordinador de carga por recurso con `Promise.allSettled`, `contextKey`, cancelación y descarte de respuestas de otro contexto — FR-001, FR-005, FR-012, FR-021, SC-006 — `apps/web/src/features/dashboard/operational-dashboard-controller.ts`
- [ ] T023 [P] [HU-001] Adaptar el cliente de inventario para entregar al normalizador productos ricos, lotes, balances, movimientos, alertas y FEFO desde rutas existentes, sin alterar sus contratos backend — FR-001, FR-002, FR-021, FR-024 — `apps/web/src/api/inventory-client.ts`
- [ ] T024 [P] [HU-001] Adaptar el controlador BI para conservar estados independientes de resumen, categorías, vencimiento, movimientos y alertas en vez de fallar como bloque único — FR-001, FR-005, FR-012, SC-006 — `apps/web/src/features/bi/inventory-bi-dashboard.ts`, `apps/web/src/features/bi/inventory-bi-client.ts`
- [ ] T025 [HU-001] Reemplazar `loadSalesData` por la carga agregada de sesión, productos, inventario, ventas e indicadores ligada al tenant activo — FR-001, FR-002, FR-006, FR-021, SC-001 — `apps/web/src/demo/browser.ts`
- [ ] T026 [HU-001] Convertir `renderBodegiaDashboard`, resumen, ventas, OLTP y BI en render puro del agregado y sus estados, sin invocar `createDemoInventoryData()` — FR-001, FR-002, FR-012, NFR-006, SC-003 — `apps/web/src/demo/mvp-demo.ts`, `apps/web/src/features/inventory-dashboard.ts`
- [ ] T027 [HU-001] Eliminar imports de `demo-data.ts` desde superficies conectadas y conservarlo únicamente como fixture aislado si alguna prueba lo necesita; hacer pasar T009 sin reemplazarlo por otro snapshot — FR-001, FR-022, NFR-006, SC-003 — `apps/web/src/demo/demo-data.ts`, `apps/web/src/demo/mvp-demo.ts`, `apps/web/src/demo/browser.ts`, `apps/web/test/demo.spec.ts`

**Independent Test HU-001 (corte de adquisición)**: con una sesión del tenant activo, cada superficie
carga datos reales normalizados, muestra el mismo stock para el mismo ciclo y no renderiza fixtures.

---

## Phase 4 — Consistencia de stock y sincronización posterior a venta

**Propósito**: separar confirmación de venta y resincronización, incluida recuperación parcial.

- [ ] T028 [P] [HU-001] Escribir pruebas unitarias del grafo de invalidación `catalog-stock`, `inventory-detail`, `alerts`, `sales` e `indicators` después de una venta confirmada — FR-003, FR-004, FR-005, SC-002 — `apps/web/test/post-sale-invalidation.spec.ts`
- [ ] T029 [P] [HU-001] Escribir integración web que exija exactamente un POST, refresque productos, ventas, lotes, balances, movimientos, alertas e indicadores y no aplique resta local — FR-002, FR-003, FR-004, FR-022, NFR-005, SC-001, SC-002 — `apps/web/test/post-sale-synchronization.spec.ts`
- [ ] T030 [P] [HU-003] Escribir integración de fallo parcial postventa: conservar venta confirmada, marcar únicamente recursos fallidos como stale y reintentar solo sus GET — FR-005, FR-012, FR-014, FR-015, FR-022, NFR-005, SC-006 — `apps/web/test/post-sale-partial-failure.spec.ts`
- [ ] T031 [P] [HU-001] Escribir caso concurrente y de producto agotado/desactivado que acepte únicamente el saldo de la siguiente respuesta backend y descarte el valor positivo previo — FR-002, FR-004, FR-005, FR-021, SC-001 — `apps/web/test/authoritative-stock-concurrency.spec.ts`
- [ ] T032 [HU-001] Implementar invalidaciones y ciclos de resincronización selectivos en el coordinador, manteniendo separados éxito de mutación y vigencia de lecturas — FR-003, FR-004, FR-005, NFR-005 — `apps/web/src/features/dashboard/operational-dashboard-controller.ts`
- [ ] T033 [HU-001] Reestructurar el submit de venta para bloquear doble envío, registrar una sola confirmación y delegar el refresh sin volver a ejecutar el POST — FR-003, FR-004, FR-005, FR-015, NFR-005, SC-002 — `apps/web/src/demo/browser.ts`
- [ ] T034 [HU-003] Renderizar confirmación, regiones stale, listado de recursos no sincronizados y acción “Reintentar actualización” separada del formulario de venta — FR-005, FR-012, FR-014, FR-015, SC-006 — `apps/web/src/demo/mvp-demo.ts`
- [ ] T035 [HU-001] Integrar productos, lotes, balances, movimientos, alertas, ventas e indicadores en el mismo ciclo postventa y hacer pasar T028–T031 — FR-001, FR-002, FR-003, FR-004, FR-005, SC-001, SC-002 — `apps/web/src/features/dashboard/operational-dashboard-controller.ts`, `apps/web/src/demo/browser.ts`
- [ ] T036 [P] [HU-001] Añadir regresión de ventas rápidas que verifique una única venta persistida y movimientos FEFO existentes sin cambiar reglas backend — FR-003, FR-004, FR-011, FR-022, FR-024, SC-002 — `apps/api/test/integration/quick-sales.spec.ts`
- [ ] T037 [HU-001] Medir localmente que el ciclo exitoso postventa presenta las superficies afectadas en menos de 2 segundos y que esperas superiores mantienen estado perceptible — FR-003, FR-012, NFR-001, SC-002 — `apps/web/test/post-sale-synchronization.spec.ts`, `specs/003-web-stabilization/evidence/local-timing.md`

**Independent Test HU-001 (corte de venta)**: una venta exitosa aparece una sola vez y todas las
superficies muestran el saldo backend posterior; un GET fallido deja stale recuperable sin otro POST.

---

## Phase 5 — Navegación y privacidad por capacidades

**Propósito**: presentar únicamente módulos, datos y acciones permitidos por la pertenencia activa.

- [ ] T038 [P] [HU-002] Escribir pruebas unitarias que prioricen `activeTenant.capabilities`/permisos efectivos y usen el rol singular solo como fallback del adaptador demo — FR-006, FR-011, FR-022, SC-004 — `apps/web/test/capability-context.spec.ts`
- [ ] T039 [P] [HU-002] Completar las pruebas de navegación para owner, inventory manager y seller, incluidos deep links y recálculo total al cambiar tenant — FR-006, FR-007, FR-008, FR-009, FR-010, FR-017, FR-021, SC-004 — `apps/web/test/web-stabilization-navigation.spec.ts`
- [ ] T040 [P] [HU-002] Completar la prueba estructural de privacidad seller sobre lotes, balances, BI, estados y mensajes, incluyendo respuestas malformadas que traigan costos — FR-010, FR-011, FR-022, NFR-004, SC-005 — `apps/web/test/web-stabilization-seller-privacy.spec.ts`
- [ ] T041 [P] [HU-002] Añadir regresión API que invoque directamente operaciones sin permiso y accesos A/B, demostrando que ocultar UI no altera las denegaciones backend — FR-011, FR-021, FR-023, SC-004 — `apps/api/test/security/web-stabilization-authorization.spec.ts`
- [ ] T042 [HU-002] Implementar el adaptador de contexto que expone capacidades efectivas y limita `permissionsForRoles(role)` al login demo local — FR-006, FR-008, FR-009, FR-010, FR-011 — `apps/web/src/features/navigation/capability-context.ts`, `apps/web/src/demo/browser.ts`
- [ ] T043 [HU-002] Definir destinos y requisitos de capacidad: owner con configuración, Empleados, inventario, ventas y Data Warehouse; inventory manager con inventario operativo; seller con catálogo/stock y ventas — FR-006, FR-007, FR-008, FR-009, FR-010, FR-017 — `apps/web/src/features/navigation/capability-navigation.ts`
- [ ] T044 [HU-002] Renderizar solo destinos/secciones autorizados, retirar Roadmap para todos y retirar el módulo Permisos separado — FR-006, FR-007, FR-008, FR-009, FR-010, SC-004 — `apps/web/src/demo/mvp-demo.ts`
- [ ] T045 [HU-002] Integrar la gestión autorizada de roles/permisos dentro de Empleados para owner sin duplicar reglas ni exponerla a otros roles — FR-007, FR-008, FR-009, FR-010, FR-011 — `apps/web/src/features/memberships/RoleEditor.tsx`, `apps/web/src/features/memberships/membership-admin.ts`, `apps/web/src/demo/mvp-demo.ts`
- [ ] T046 [HU-002] Aplicar proyección defensiva seller en el límite del adaptador y BI, eliminando `unitCost`, `inventoryValuation`, `estimatedLoss` y derivados antes del render — FR-010, FR-011, NFR-004, SC-005 — `apps/web/src/api/operational-data-adapter.ts`, `apps/web/src/api/inventory-client.ts`, `apps/web/src/features/bi/inventory-bi-dashboard.ts`
- [ ] T047 [HU-002] Implementar destino actual con `aria-current`, fallback al primer destino permitido y limpieza/reconstrucción completa de navegación y datos al cambiar contexto — FR-006, FR-017, FR-020, FR-021, SC-004, SC-008 — `apps/web/src/features/navigation/capability-navigation.ts`, `apps/web/src/demo/browser.ts`, `apps/web/src/demo/mvp-demo.ts`

**Independent Test HU-002**: cada rol ve exactamente su matriz; seller no contiene costos en ningún
estado y las invocaciones directas no autorizadas continúan rechazadas por el backend.

---

## Phase 6 — Estados de interfaz y recuperación

**Propósito**: hacer inequívocos carga, vacío, error, contenido y desactualización parcial.

- [ ] T048 [P] [HU-003] Completar pruebas de render por región para loading/ready/empty/error/stale sin convertir arreglos vacíos durante carga en ceros confirmados — FR-005, FR-012, FR-013, FR-016, FR-022, SC-006 — `apps/web/test/web-stabilization-states.spec.ts`
- [ ] T049 [P] [HU-003] Escribir pruebas de `SafeWebApiError` para conservar status, code y `correlationId`, y limpiar estado operativo ante 401 sin revelar recursos en 403/404 — FR-014, FR-021, FR-022, SC-006 — `apps/web/test/safe-web-errors.spec.ts`
- [ ] T050 [P] [HU-003] Escribir pruebas de formularios para conservar entradas seguras, bloquear doble envío y distinguir fallo recuperable, éxito confirmado y resultado stale — FR-005, FR-014, FR-015, FR-022, NFR-005, SC-006 — `apps/web/test/web-stabilization-forms.spec.ts`
- [ ] T051 [HU-003] Implementar componentes/funciones de render comunes para estado de superficie, vacío específico, error seguro, stale y reintento autorizado — FR-005, FR-012, FR-013, FR-014, FR-016 — `apps/web/src/features/dashboard/surface-state-view.ts`, `apps/web/src/demo/mvp-demo.ts`
- [ ] T052 [HU-003] Preservar metadatos seguros de error y soportar AbortSignal en la capa HTTP sin exponer detalles internos — FR-014, FR-021, SC-006 — `apps/web/src/api/client.ts`
- [ ] T053 [HU-003] Integrar estados de formularios de venta/configuración, conservación de entradas y foco al resumen de error recuperable — FR-014, FR-015, FR-020, NFR-005, SC-006, SC-008 — `apps/web/src/demo/browser.ts`, `apps/web/src/demo/mvp-demo.ts`
- [ ] T054 [HU-003] Unificar terminología de stock de producto, stock por lote, costos, valorización, acciones y mensajes en todas las superficies — FR-016, SC-001, SC-006 — `apps/web/src/demo/mvp-demo.ts`, `apps/web/src/features/inventory-dashboard.ts`, `apps/web/src/features/bi/inventory-bi-dashboard.ts`

**Independent Test HU-003**: cada región diferencia los cinco estados, conserva correlationId cuando
existe y permite recuperarse sin perder datos seguros ni repetir una venta confirmada.

---

## Phase 7 — Responsive y accesibilidad

**Propósito**: completar los tres flujos principales desde 320 px y por teclado sin rediseño integral.

- [ ] T055 [P] [HU-004] Completar primero la matriz Playwright de viewports 320/768/1440 para login, consulta de stock y venta rápida, con aserciones de overflow y acciones alcanzables — FR-018, FR-019, FR-022, NFR-003, SC-007 — `apps/web/e2e/web-stabilization-responsive-accessibility.spec.ts`
- [ ] T056 [P] [HU-004] Añadir pruebas de teclado, orden de foco, `aria-current`, nombres accesibles, landmarks y anuncios de carga/éxito/error — FR-017, FR-020, FR-022, NFR-002, SC-008 — `apps/web/test/web-stabilization-accessibility.spec.ts`
- [ ] T057 [HU-004] Ajustar navegación, grillas, formularios, controles táctiles y breakpoints para evitar overflow/superposición entre 320 y 1440 px — FR-017, FR-018, NFR-003, SC-007 — `apps/web/demo/index.html`
- [ ] T058 [HU-004] Contener tablas anchas dentro de regiones con nombre accesible y encabezados asociables, adaptando la presentación móvil sin mezclar etiquetas y valores — FR-019, FR-020, NFR-002, NFR-003, SC-007, SC-008 — `apps/web/demo/index.html`, `apps/web/src/demo/mvp-demo.ts`, `apps/web/src/features/inventory-dashboard.ts`
- [ ] T059 [HU-004] Añadir foco `:focus-visible`, contraste AA, áreas táctiles, `aria-live`/roles y respeto por movimiento reducido; hacer pasar T055/T056 — FR-020, NFR-002, NFR-003, SC-007, SC-008 — `apps/web/demo/index.html`, `apps/web/src/demo/mvp-demo.ts`, `apps/web/src/features/dashboard/surface-state-view.ts`

**Independent Test HU-004**: login, stock y venta se completan en 320/768/1440 px y solo con teclado,
sin overflow de página, superposición, pérdida de acciones ni mensajes imperceptibles.

---

## Phase 8 — Integración web y E2E local

**Propósito**: validar los recorridos completos y el aislamiento con la aplicación y base locales.

- [ ] T060 [P] [HU-001] Consolidar integración web de carga inicial real, normalización, ausencia de fixtures y consistencia de stock entre superficies — FR-001, FR-002, FR-021, FR-022, NFR-006, SC-001, SC-003 — `apps/web/test/web-stabilization-integration.spec.ts`
- [ ] T061 [P] [HU-003] Consolidar integración web de venta única, refresh total, fallo parcial, stale y recuperación exclusiva de GET — FR-003, FR-004, FR-005, FR-012, FR-015, FR-022, NFR-005, SC-002, SC-006 — `apps/web/test/web-stabilization-sale-recovery.spec.ts`
- [ ] T062 [P] [HU-001] Crear E2E Playwright local de stock idéntico antes/después de una venta y exactamente un registro de venta, usando PostgreSQL local con datos sintéticos — FR-001, FR-002, FR-003, FR-004, FR-022, SC-001, SC-002 — `apps/web/e2e/web-stabilization-stock-sale.spec.ts`
- [ ] T063 [P] [HU-002] Crear E2E Playwright local de navegación/capacidades para los tres roles, cambio de contexto y deep links no autorizados — FR-006, FR-007, FR-008, FR-009, FR-010, FR-017, FR-021, FR-022, SC-004 — `apps/web/e2e/web-stabilization-capabilities.spec.ts`
- [ ] T064 [P] [HU-002] Crear E2E Playwright local exclusivo de privacidad seller sobre DOM, estados, tablas y respuestas visibles, sin costos ni valorización — FR-010, FR-011, FR-022, NFR-004, SC-005 — `apps/web/e2e/web-stabilization-seller-privacy.spec.ts`
- [ ] T065 [P] [HU-003] Crear E2E Playwright local que intercepte una lectura postventa, confirme stale y recuperación sin segundo POST, y cubra loading/empty/error — FR-005, FR-012, FR-013, FR-014, FR-015, FR-022, SC-006 — `apps/web/e2e/web-stabilization-recovery.spec.ts`
- [ ] T066 [HU-002] Ejecutar regresión local de autorización e aislamiento A/B para rutas de inventario, BI y ventas y conservar evidencia de rechazo sin enumeración — FR-011, FR-021, FR-023, SC-004 — `apps/api/test/security/web-stabilization-authorization.spec.ts`, `specs/003-web-stabilization/evidence/tenant-authorization-regression.md`

**Checkpoint**: HU-001…HU-004 pasan de forma independiente y combinada sobre la superficie local.

---

## Phase 9 — Documentación, regresión y gate final local

**Propósito**: cerrar trazabilidad, evidencia y calidad sin ampliar el sprint.

- [ ] T067 [P] Ejecutar todas las suites unitarias y de integración web del sprint y registrar comandos, conteos y resultados observados — FR-001…FR-022, SC-001…SC-006 — `specs/003-web-stabilization/evidence/web-test-results.md`
- [ ] T068 Ejecutar regresión API local de contrato, integración y seguridad para acceso, productos, lotes, inventario, FEFO, alertas, BI y ventas; documentar cero regresiones o bloqueadores reales — FR-011, FR-021, FR-023, FR-024, SC-004 — `specs/003-web-stabilization/evidence/api-regression-results.md`
- [ ] T069 Ejecutar las suites Playwright del sprint en 320/768/1440 y registrar resultados de stock, roles, seller, recuperación, responsive y teclado — FR-018, FR-019, FR-020, FR-022, SC-001…SC-008 — `specs/003-web-stabilization/evidence/playwright-results.md`
- [ ] T070 [P] Ejecutar lint, format check y TypeScript estricto del monorepo; documentar cualquier fallo sin silenciar reglas ni introducir `any` injustificado — FR-022, FR-024 — `specs/003-web-stabilization/evidence/quality-results.md`
- [ ] T071 Consolidar mediciones locales de NFR-001 para carga inicial y postventa, registrando únicamente tiempos observados y carga perceptible cuando se excedan 2 segundos — FR-003, FR-012, NFR-001, SC-002, SC-006 — `specs/003-web-stabilization/evidence/local-timing.md`
- [ ] T072 [P] Auditar el alcance final: sin snapshots operativos, cambios de esquema, nuevas reglas/endpoints, autenticación, superficies no aprobadas ni dependencias externas de ejecución — FR-001, FR-011, FR-024, NFR-006, SC-003 — `specs/003-web-stabilization/evidence/scope-audit.md`
- [ ] T073 Completar matriz requisito → HU → tarea → prueba → evidencia para FR-001…FR-024 y SC-001…SC-008, incluyendo Constitution Check final — FR-001…FR-024, SC-001…SC-008 — `specs/003-web-stabilization/evidence/traceability-matrix.md`
- [ ] T074 Ejecutar el gate final local tras T067–T073 y registrar aprobación o bloqueadores verificables sin marcar resultados no ejecutados — FR-022, FR-023, FR-024, SC-001…SC-008 — `specs/003-web-stabilization/evidence/final-local-gate.md`

## Dependencies & Execution Order

### Phase dependencies

1. **Phase 1** inicia de inmediato. T002 y T003 son paralelas; T004 depende de T002 y T005 depende de
   T003. T004/T005 son condicionales y T006 cierra la auditoría.
2. **Phase 2** depende de T006 para conocer el boundary real. T009–T014 pueden escribirse en paralelo;
   deben fallar por la brecha esperada antes de implementar.
3. **Phase 3** depende de las pruebas rojas de Phase 2. T015–T018 son pruebas paralelas; T019/T020
   bloquean el coordinador T022; T021, T023 y T024 pueden avanzar en archivos distintos.
4. **Phase 4** depende del agregado/carga T019–T027. T028–T031 preceden T032–T035; T036 puede avanzar
   en paralelo sin cambiar reglas backend; T037 se mide después de T035.
5. **Phase 5** depende del contexto agregado T019/T022. T038–T041 preceden T042–T047. Puede avanzar en
   paralelo con Phase 4 tras estabilizar el contrato del agregado, salvo los archivos compartidos
   `browser.ts` y `mvp-demo.ts`.
6. **Phase 6** depende de `ResourceState` T019 y sincronización T032–T035. T048–T050 preceden T051–T054.
7. **Phase 7** depende de navegación y estados renderizados. T055/T056 preceden T057–T059.
8. **Phase 8** depende de completar Phases 3–7; T060–T065 son suites en archivos distintos y T066
   consolida autorización después de T041.
9. **Phase 9** depende de todas las historias. T067, T070 y T072 son comprobaciones paralelizables;
   T068, T069 y T071 se ejecutan en secuencia para no competir por servidor o PostgreSQL local. T073
   depende de sus evidencias y T074 es el último gate.

### Story dependencies and independent criteria

| Historia | Dependencias críticas | Criterio independiente |
|---|---|---|
| HU-001 (P1) | Phases 1–3; sincronización T028–T037 | Mismo stock backend en todas las superficies antes/después de una venta, sin fixtures ni POST duplicado |
| HU-002 (P1) | Contexto/capacidades T019/T022; T038–T047 | Matriz exacta por capacidades, seller sin costos y backend deniega acceso directo no autorizado |
| HU-003 (P2) | Estado T019 y ciclo postventa T032–T035 | Loading/empty/error/stale distinguibles y recuperación sin perder entradas ni repetir venta |
| HU-004 (P2) | Navegación/render de HU-002/HU-003 | Login, stock y venta funcionan en 320/768/1440 y por teclado con foco/anuncios perceptibles |

### Critical task chain

`T001–T006 → T009–T018 → T019/T020 → T022 → T025–T027 → T028–T035 → T038–T047 →
T048–T054 → T055–T059 → T060–T066 → T073 → T074`.

## Parallel Opportunities

- Phase 1: T002/T003.
- Phase 2: T009–T014, además de las ejecuciones independientes T007/T008.
- Phase 3: T015–T018; después T021/T023/T024 cuando sus contratos estén definidos.
- Phase 4: T028–T031 y T036 usan archivos distintos antes de la integración secuencial T032–T035.
- Phase 5: T038–T041; luego trabajo de navegación y proyección puede dividirse evitando editar a la
  vez `mvp-demo.ts`.
- Phase 6: T048–T050.
- Phase 7: T055/T056.
- Phase 8: T060–T065.
- Phase 9: T067, T070 y T072, con salidas de evidencia separadas y sin compartir runtime local.

## Coverage Matrix

| Cobertura | Tareas principales | Evidencia de aceptación |
|---|---|---|
| HU-001; FR-001…FR-005, FR-021, FR-022; SC-001…SC-003 | T002–T003, T009–T010, T015, T017–T037, T060, T062 | Contratos normalizados, stock consistente, venta única y ausencia de fixtures |
| HU-002; FR-006…FR-011, FR-021…FR-023; SC-004, SC-005 | T011–T012, T038–T047, T063–T064, T066 | Navegación por capacidades, privacidad seller y rechazo backend/A-B |
| HU-003; FR-005, FR-012…FR-016, FR-020, FR-022; SC-006 | T013, T016, T030, T034, T048–T054, T061, T065 | Estados inequívocos, correlationId, stale y recuperación sin repetir mutación |
| HU-004; FR-017…FR-020, FR-022; SC-007, SC-008 | T014, T047, T055–T059, T069 | Tres viewports, tablas contenidas, teclado, foco y anuncios |
| FR-024 y límites constitucionales | T001–T008, T036, T041, T066, T068, T070, T072–T074 | Wiring mínimo demostrado, regresión local, scope audit y gate final |

Todos los FR-001…FR-024 y SC-001…SC-008 quedan cubiertos por al menos una tarea de implementación y
una tarea de prueba/evidencia; T073 valida la trazabilidad completa antes del gate.

## Implementation Strategy

### MVP P1

1. Completar auditoría y regresión inicial (Phases 1–2).
2. Completar adquisición agregada y HU-001 (Phases 3–4).
3. Detenerse y validar stock coherente, ausencia de fixtures, venta única y recuperación parcial.
4. Completar HU-002 (Phase 5) y validar capacidades/privacidad de forma independiente.

### Incremento P2

1. Completar estados y recuperación de HU-003 (Phase 6).
2. Completar responsive/accesibilidad de HU-004 (Phase 7).
3. Ejecutar integración/E2E y cierre local (Phases 8–9).

### Definition of Done

Una tarea solo se marca cuando su prueba o evidencia existe, se ejecutó localmente y produjo el
resultado indicado. Las tareas condicionales T004/T005 se consideran completas sin cambios backend
cuando T002/T003 demuestran wiring íntegro y T006 lo registra. El sprint termina únicamente si T074
confirma todas las historias, requisitos y criterios sin ampliar el alcance.

## Checklist de formato y alcance

- Todas las tareas usan checkbox pendiente, ID secuencial, ruta concreta y trazabilidad FR/SC.
- `[P]` aparece solo cuando la tarea usa archivos distintos y no depende de otra tarea incompleta.
- Las tareas funcionales usan `[HU-001]`…`[HU-004]`; preparación y cierre transversal no fuerzan una
  historia artificial.
- Las pruebas sensibles preceden o acompañan la implementación correspondiente.
- No existe tarea de cambio de esquema, persistencia nueva, publicación, superficie no aprobada ni
  integración con servicios externos.
