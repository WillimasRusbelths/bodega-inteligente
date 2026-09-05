# Matriz final de trazabilidad

**Fecha**: 2026-09-04 (`America/Lima`)  
**Feature**: `003-web-stabilization`

Abreviaturas de evidencia: **WEB** = `web-test-results.md` (`78/78`); **API** =
`api-regression-results.md` (`36/36` unit, `122/122` contract, `143/143` integration,
`102/102` security); **PW** = `playwright-results.md` (`13/13`); **TIME** = `local-timing.md`;
**AUTH** = `tenant-authorization-regression.md`; **SCOPE** = `scope-audit.md`.

## Functional Requirements

| Requisito | HU | Implementación | Tareas | Prueba ejecutada | Evidencia / resultado |
|---|---|---|---|---|---|
| FR-001 | HU-001 | `operational-data-adapter.ts`, `browser.ts`, controller agregado | T001–T006, T015, T019–T027, T035, T060, T062, T072 | no-fixtures, integration, stock-sale E2E | WEB, PW, SCOPE — PASS |
| FR-002 | HU-001 | normalización única y proyección de stock backend | T002, T010, T015, T020, T023, T025–T026, T029, T031, T035, T060, T062 | adapter, concurrency, stock, stock-sale | WEB, PW — 18→17 coherente |
| FR-003 | HU-001 | coordinador postventa e invalidación total | T010, T017, T021, T028–T029, T032–T037, T061–T062, T071 | post-sale suites, quick-sales, stock-sale | WEB, API, PW, TIME — PASS |
| FR-004 | HU-001 | GET autoritativos después del POST, sin resta local | T010, T015, T017, T020–T021, T028–T032, T035–T036, T061–T062 | post-sale sync, concurrency, quick-sales | WEB, API, PW — un POST |
| FR-005 | HU-001/HU-003 | `ResourceState`, stale selectivo y retry GET | T013, T016–T017, T019, T022, T024, T028, T030–T034, T048, T050–T051, T061, T065 | states, partial failure, recovery E2E | WEB, PW — PASS |
| FR-006 | HU-002 | contexto efectivo y navegación recalculada | T011, T018–T019, T025, T038–T044, T047, T063 | capability-context/navigation, capabilities E2E | WEB, PW — 4/4 roles/contexto |
| FR-007 | HU-002 | destinos no autorizados no renderizados | T011, T039, T043–T045, T063 | navigation, capabilities E2E | WEB, PW — PASS |
| FR-008 | HU-002 | matriz owner por capabilities | T011, T039, T042–T045, T063 | navigation owner, capabilities E2E | WEB, PW — PASS |
| FR-009 | HU-002 | matriz inventory manager sin administración owner | T011, T039, T042–T045, T063 | navigation inventory manager, E2E real | WEB, PW — PASS |
| FR-010 | HU-002 | matriz seller y proyección defensiva | T011–T012, T039–T046, T063–T064 | seller privacy unit/E2E | WEB, PW — PASS |
| FR-011 | HU-002 | autorización backend preservada | T004–T006, T008, T012, T036, T038, T040–T046, T064, T066, T068, T072 | security autorización/A-B y seller | API, AUTH, PW, SCOPE — PASS |
| FR-012 | HU-003 | estados independientes por recurso | T013, T016, T019, T022, T024, T030, T034, T037, T048, T051, T061, T065, T071 | states, recovery, slow refresh | WEB, PW, TIME — PASS |
| FR-013 | HU-003 | vacío específico por superficie | T013, T048, T051, T065 | states y recovery E2E | WEB, PW — PASS |
| FR-014 | HU-003 | `SafeWebApiError`, correlationId y error seguro | T013, T017, T021, T030, T034, T049–T053, T065 | safe-errors, forms, recovery E2E | WEB, PW — PASS |
| FR-015 | HU-003 | doble envío bloqueado, inputs seguros, retry no mutante | T013, T030, T033–T034, T050, T053, T061, T065 | forms, post-sale recovery | WEB, PW — PASS |
| FR-016 | HU-001/HU-003 | terminología común de stock/costo/valoración | T013, T048, T051, T054 | states, mvp/demo render | WEB — PASS |
| FR-017 | HU-002/HU-004 | orden, destino actual y `aria-current` | T011, T039, T043, T047, T056–T057, T063 | navigation/accessibility/capabilities | WEB, PW — PASS |
| FR-018 | HU-004 | layout de login, stock y venta 320–1440 | T014, T055, T057, T069 | responsive E2E 320/768/1440 | PW — PASS |
| FR-019 | HU-004 | tablas contenidas y responsive | T014, T055, T058, T069 | responsive E2E, overflow `[]` | PW — PASS |
| FR-020 | HU-004 | teclado, foco, nombres y anuncios | T014, T047, T053, T056, T058–T059, T069 | accessibility unit + keyboard E2E | WEB, PW — PASS |
| FR-021 | HU-001/HU-002 | contexto tenant y descarte cross-context | T001–T003, T008, T018, T021–T023, T025, T031, T039, T041, T047, T049, T052, T060, T063, T066, T068 | context, security A/B, API regression | WEB, API, AUTH — PASS |
| FR-022 | HU-001…004 | cobertura automatizada del sprint | T007, T009–T018, T027, T029–T031, T036, T038–T041, T048–T050, T055–T056, T060, T060–T065, T067, T069–T070 | 78 web + 403 API + 13 E2E | WEB, API, PW, quality — PASS funcional |
| FR-023 | HU-001/HU-002 | rechazo backend y aislamiento A/B | T008, T041, T066, T068 | security `102/102`, autorización Sprint 003 | API, AUTH — PASS |
| FR-024 | HU-001…004 | capacidades existentes, sin schema/reglas nuevas | T001–T008, T023, T036, T068, T070, T072 | contract/API regression + auditoría Git | API, SCOPE — PASS |

## Success Criteria

| Criterio | HU | Implementación | Tareas | Prueba ejecutada | Evidencia / resultado |
|---|---|---|---|---|---|
| SC-001 | HU-001 | stock backend común en todas las proyecciones | T010, T015, T020, T025, T029, T031, T035, T054, T060, T062, T069 | stock/concurrency/integration/E2E | WEB, PW — 18→17 en todas |
| SC-002 | HU-001 | postventa autoritativa, una mutación | T010, T028–T029, T033, T035–T037, T061–T062, T069, T071 | post-sale + quick-sales + E2E medido | WEB, API, PW, TIME — `522.7806 ms`, un POST |
| SC-003 | HU-001 | superficies conectadas sin fixtures | T007, T009, T020, T026–T027, T060, T072 | no-fixtures + integration + auditoría | WEB, SCOPE — PASS |
| SC-004 | HU-002 | capabilities + denegación backend | T011, T038–T047, T063, T066, T068 | navigation/capabilities/security | WEB, PW, API, AUTH — PASS |
| SC-005 | HU-002 | privacidad seller en todo estado | T012, T040, T046, T064 | seller privacy unit/E2E/security | WEB, PW, API — PASS |
| SC-006 | HU-003 | loading/empty/error/stale/recovery | T007, T013, T016, T022, T024, T030, T034, T048–T054, T061, T065, T067, T069, T071 | states/forms/recovery/slow refresh | WEB, PW, TIME — PASS |
| SC-007 | HU-004 | tres flujos en 320/768/1440 | T014, T055, T057–T059, T069 | responsive E2E seis casos | PW — `13/13`, overflow `[]` |
| SC-008 | HU-004 | teclado y foco perceptible | T014, T047, T053, T056, T058–T059, T069 | accessibility + keyboard E2E | WEB, PW — PASS |

## Constitution Check final

| Principio | Resultado y evidencia |
|---|---|
| Tenant Isolation | PASS — context/concurrency y security A/B; `102/102`; AUTH |
| Roles and Authorization | PASS — capabilities `4/4`, seller privacy, denegaciones backend; PW/API |
| Transactions and Concurrency | PASS — integration `143/143`, concurrency y postventa de un POST; API/WEB |
| Audit and Historical Record | PASS — quick-sales persiste una venta y movimientos FEFO; API/PW |
| Security and Privacy | PASS — security `102/102`, seller sin costos y errores seguros; API/WEB/PW |
| Lot and FEFO Rules | PASS — servicio productivo intacto; FEFO test actualizado solo en fechas del setup; API |
| Human Confirmation | PASS — cero OCR/cámara y cero cambios en esas superficies; SCOPE |
| Environment Boundaries | PASS — solo PostgreSQL/API/Vite/Chromium locales; cleanup en cero; PW/SCOPE |
| Out of Scope | PASS — cero schema/migraciones/mobile/IA/OCR/despliegue/dependencias remotas; SCOPE |

## Resultado T073

Los `24` requisitos funcionales y los `8` criterios de éxito tienen HU, implementación, tareas,
prueba ejecutada y evidencia concreta. Constitution Check: `9/9` principios conformes. T073 queda
aprobada. El fallo histórico de Prettier en `main.ts` no deja un requisito funcional sin trazar, pero
se conserva como posible bloqueo independiente del gate T074.

