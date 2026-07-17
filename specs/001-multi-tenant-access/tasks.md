# Tasks: Base multi-bodega, identidad y acceso

**Input**: `spec.md`, `plan.md`, `research.md`, `data-model.md`, `quickstart.md`,
`contracts/openapi.yaml`, `.specify/memory/constitution.md` y `docs/analisis/`.

**Formato**: `[ID] [P?] [HU?] Descripción — trazabilidad FR/SC — ruta concreta`.

**Total planificado**: 155 tareas, numeradas consecutivamente de T001 a T155.

**TDD**: En cada fase sensible, completar primero las tareas de prueba indicadas y comprobar que
fallan por la razón esperada antes de implementar. Todos los cambios de producto usan TypeScript
estricto; móvil y web consumen únicamente la API REST, y Prisma es la vía ordinaria de persistencia.

## Phase 1: Preparación del monorepo

**Propósito**: establecer la estructura aprobada sin incorporar todavía lógica funcional.

- [X] T001 Crear workspaces conforme al plan — FR-028 — `package.json`, `pnpm-workspace.yaml`, `apps/api/package.json`, `apps/mobile/package.json`, `apps/web/package.json`, `packages/api-contract/package.json`, `packages/authz-catalog/package.json`, `packages/config/package.json`, `packages/test-fixtures/package.json`
- [X] T002 [P] Configurar TypeScript estricto compartido sin `any` injustificado — FR-028 — `packages/config/tsconfig.base.json`, `apps/api/tsconfig.json`, `apps/mobile/tsconfig.json`, `apps/web/tsconfig.json`, `packages/api-contract/tsconfig.json`, `packages/authz-catalog/tsconfig.json`, `packages/config/tsconfig.json`, `packages/test-fixtures/tsconfig.json`
- [X] T003 [P] Configurar lint y formato compartidos con reglas que prohíban imports de infraestructura entre clientes y API — FR-028 — `packages/config/eslint.config.js`, `packages/config/prettier.config.js`
- [X] T004 [P] Definir comandos raíz para lint, typecheck, unidades, integración, contrato, E2E móvil/web, seguridad y rendimiento — SC-001, SC-003 — `package.json`
- [X] T005 Documentar la frontera del monorepo y la prohibición de acceso móvil/web directo a PostgreSQL — FR-018, FR-019, FR-028 — `README.md`, `docs/architecture/module-boundaries.md`

## Phase 2: Infraestructura común y configuración

**Propósito**: preparar componentes compartidos que bloquean toda implementación funcional.

- [X] T006 Definir validación tipada y fail-fast de configuración por ambiente, incluyendo URLs, TTL, Argon2id y versiones de pepper sin valores reales — FR-005, FR-027, FR-034, FR-035 — `apps/api/src/config/env.schema.ts`, `apps/api/src/config/config.module.ts`
- [X] T007 [P] Escribir primero pruebas del guard de ambientes que rechacen producción en tests, mezcla de secretos/URLs, credenciales productivas en integración/E2E y configuración obligatoria ausente — SC-001, SC-002 — `apps/api/test/config/environment.guard.spec.ts`
- [X] T008 Implementar salvaguardas de ambientes separados y fallo seguro hasta satisfacer la prueba anterior — SC-001, SC-002 — `.env.example`, `apps/api/src/config/environment.guard.ts`
- [X] T009 [P] Escribir primero pruebas de configuración `phoneBindingHmac` para clave externa, versión actual, fail-fast, separación por ambiente y ausencia de clave en código, DB, logs o auditoría — FR-027, FR-031 — `apps/api/test/config/phone-binding.config.spec.ts`
- [X] T010 Implementar configuración tipada de clave HMAC externa y versión actual por ambiente, integrada al esquema fail-fast sin valores reales — FR-027, FR-031 — `apps/api/src/config/phone-binding.config.ts`, `apps/api/src/config/env.schema.ts`
- [X] T011 [P] Definir utilidades compartidas para UUID, UTC, E.164, paginación por cursor, `Idempotency-Key` y `If-Match` — FR-011, FR-022, FR-027 — `apps/api/src/common/validation/`, `apps/api/src/common/http/`
- [X] T012 [P] Definir catálogo de errores seguros y filtro global con `correlationId`, respuestas anti-enumeración y equivalencia entre recurso ajeno e inexistente — FR-020, FR-027, FR-029 — `apps/api/src/common/errors/error-catalog.ts`, `apps/api/src/common/errors/http-exception.filter.ts`
- [X] T013 [P] Escribir primero prueba fallida de redacción que impida PIN, código manual, secreto QR, approval/polling secrets, access/refresh tokens, pepper, clave HMAC, E.164 crudo y datos biométricos — FR-023, FR-024, FR-027, FR-031, FR-034 — `apps/api/test/security/log-redaction.spec.ts`
- [X] T014 Implementar redacción y logger estructurado hasta satisfacer la prueba anterior, sin registrar secretos ni identificadores crudos — FR-023, FR-024, FR-027, FR-031, FR-034 — `apps/api/src/common/logging/redaction.ts`, `apps/api/src/common/logging/logger.service.ts`
- [X] T015 [P] Crear fixtures sintéticos reutilizables para tenants A/B, propietarios, miembros, roles, dispositivos y relojes controlados — SC-001, SC-002, SC-005 — `packages/test-fixtures/src/`

## Phase 3: Modelo de datos y persistencia

**Propósito**: materializar el modelo lógico y sus invariantes mediante Prisma y PostgreSQL.

- [X] T016 [P] Escribir pruebas de esquema para unicidad global de teléfono, unicidad `(tenantId,userId)` y coherencia de estados User/Tenant/Membership — FR-001, FR-002, FR-011, FR-012 — `apps/api/test/persistence/identity-schema.spec.ts`
- [X] T017 [P] Escribir pruebas de constraints MVP tenant-scoped para Membership/RBAC, perfil personal, Session MOBILE y relaciones compuestas A/B — FR-014, FR-018, FR-019, FR-020 — `apps/api/test/persistence/mvp-tenant-constraints.spec.ts`
- [X] T018 [P] Escribir pruebas MVP de ActivationChallenge/Alias, PIN, refresh e idempotencia, incluyendo hashes, TTL y consumo único — FR-005, FR-031, FR-035, FR-039 — `apps/api/test/persistence/mvp-auth-constraints.spec.ts`
- [X] T019 Definir modelos Prisma `User`, `Tenant`, `Membership`, `Role`, `Permission`, `RolePermission` y `MembershipRole` con estados, versiones e índices aprobados — FR-001…FR-017 — `prisma/schema.prisma`
- [X] T020 Definir modelos Prisma MVP `ActivationChallenge`, `ActivationManualAlias`, Device PERSONAL, DeviceProfile personal/PIN, Session MOBILE y RefreshCredential sin secretos crudos — FR-005, FR-031, FR-034…FR-039 — `prisma/schema.prisma`
- [X] T021 Definir modelos Prisma MVP `AuditEvent` e `IdempotencyRecord`, preservando tenant e historia — FR-023…FR-026 — `prisma/schema.prisma`
- [X] T022 Crear la migración MVP únicamente con identidad, RBAC, activación, dispositivo personal/PIN, sesión móvil, auditoría e idempotencia — FR-001…FR-029, FR-031…FR-039 — `prisma/migrations/0001_identity_access_mvp/migration.sql`
- [X] T023 Implementar PrismaModule y helpers transaccionales con aislamiento configurable, sin exponer Prisma a móvil/web — FR-002, FR-018, FR-022, FR-025 — `apps/api/src/infrastructure/prisma/prisma.module.ts`, `apps/api/src/infrastructure/prisma/transaction.ts`

## Phase 4: Identidad global y alta de tenant

**Historia principal**: HU-001 (P1). **Corte MVP**.

**Independent Test**: crear una bodega con primer propietario produce exactamente un tenant y una
pertenencia; idempotencia repite el resultado y un fallo de auditoría revierte todo.

- [X] T024 [P] [HU-001] Escribir pruebas contractuales de `createTenantWithFirstOwner`, resumen técnico y cambio de estado — FR-001…FR-004, FR-023 — `apps/api/test/contract/technical-tenants.contract.spec.ts`
- [X] T025 [P] [HU-001] Escribir pruebas de integración para bootstrap atómico, rollback de auditoría, idempotencia y rechazo de actor no técnico — FR-001, FR-002, FR-023, SC-002 — `apps/api/test/integration/tenant-bootstrap.spec.ts`
- [X] T026 [P] [HU-001] Escribir pruebas de privacidad del resumen técnico que excluyan ventas, clientes, costos e inventario — FR-004, SC-009 — `apps/api/test/security/technical-summary-privacy.spec.ts`
- [X] T027 [HU-001] Implementar repositorios de identidad global y tenant con operaciones transaccionales y lookup de teléfono E.164 — FR-001, FR-002 — `apps/api/src/modules/identity/repositories/user.repository.ts`, `apps/api/src/modules/tenants/repositories/tenant.repository.ts`
- [X] T028 [HU-001] Implementar servicio idempotente de bootstrap Tenant + primer owner + roles + AuditEvent como unidad indivisible — FR-001, FR-002, FR-023, SC-002 — `apps/api/src/modules/tenants/services/bootstrap-tenant.service.ts`
- [X] T029 [HU-001] Implementar autorización técnica mínima, consulta de resumen y activación/desactivación con motivo — FR-003, FR-004 — `apps/api/src/modules/tenants/services/technical-tenant.service.ts`, `apps/api/src/modules/tenants/guards/technical-admin.guard.ts`
- [X] T030 [HU-001] Exponer endpoints técnicos con DTOs OpenAPI, validación y errores seguros — FR-001…FR-004, FR-027 — `apps/api/src/modules/tenants/technical-tenants.controller.ts`, `apps/api/src/modules/tenants/dto/`

## Phase 5: Activación presencial mediante QR y código manual

**Historias principales**: HU-002 y HU-004 (P1). **Corte MVP**.

**Independent Test**: QR y código manual activan una sola vez el mismo challenge; caducan a los 15
minutos, bloquean al quinto intento y nunca filtran valores crudos ni PII.

- [X] T031 [P] [HU-004] Escribir pruebas contractuales para crear Membership, emitir challenge y consumir QR/manual creando siempre Device PERSONAL; rechazar `type`/`TENANT_SHARED` sin crear Device ni DeviceProfile — FR-015, FR-031, FR-037, FR-039 — `apps/api/test/contract/activation.contract.spec.ts`
- [X] T032 [P] [HU-002] Escribir pruebas criptográficas que exijan secreto QR >=128 bits, código de 8 dígitos no derivado textualmente y persistencia exclusiva de hashes — FR-027, FR-031 — `apps/api/test/security/activation-secrets.spec.ts`
- [X] T033 [P] [HU-002] Escribir pruebas de `phoneBindingHmac`: normalización E.164, HMAC-SHA-256 determinístico, persistencia solo de HMAC/versión, selección de clave actual/anterior durante TTL, versión desconocida fail-closed, comparación constante y ausencia de E.164 crudo en tablas/logs/auditoría — FR-027, FR-031 — `apps/api/test/security/phone-binding.spec.ts`
- [X] T034 [P] [HU-002] Escribir pruebas concurrentes de consumo único compartido entre QR/código, TTL 15 minutos y máximo 5 intentos — FR-029, FR-031, FR-039 — `apps/api/test/integration/activation-consumption.spec.ts`
- [X] T035 [P] [HU-002] Escribir pruebas de rate limiting combinado por IP, dispositivo e identificador seudonimizado con respuesta anti-enumeración — FR-027, FR-029, FR-031 — `apps/api/test/security/activation-rate-limit.spec.ts`
- [X] T036 [HU-004] Implementar alta de Membership pendiente con nombre, teléfono normalizado y rol inicial dentro del tenant activo — FR-011, FR-015, FR-031 — `apps/api/src/modules/memberships/services/create-membership.service.ts`
- [X] T037 [HU-002] Implementar servicio de phone binding que normalice E.164, calcule HMAC-SHA-256 con clave externa versionada, persista solo HMAC/versión, compare en tiempo constante, mantenga versiones vigentes durante TTL y falle cerrado ante versión desconocida — FR-027, FR-031 — `apps/api/src/modules/activation/crypto/phone-binding.service.ts`
- [X] T038 [HU-004] Implementar emisión de `ActivationChallenge` y `ActivationManualAlias`, retorno único de valores crudos y persistencia de hashes vinculados a pertenencia, propósito y teléfono — FR-031, FR-039 — `apps/api/src/modules/activation/services/issue-activation.service.ts`
- [X] T039 [HU-002] Implementar consumo atómico e idempotente por QR o alias manual con contador común y rate limit; rechazar campos extra como `type`, establecer autoritativamente Device PERSONAL y crear DeviceProfile `PENDING_PIN` — FR-005, FR-027, FR-029, FR-031, FR-037 — `apps/api/src/modules/activation/services/consume-activation.service.ts`
- [X] T040 [HU-002] Exponer endpoints de emisión/consumo con DTOs discriminados, sanitización posterior y auditoría sin secretos — FR-023, FR-024, FR-027, FR-031 — `apps/api/src/modules/activation/activation.controller.ts`, `apps/api/src/modules/activation/dto/`

## Phase 6: PIN, biometría y dispositivos

**Historia principal**: HU-002 (P1). PIN y dispositivo personal pertenecen al **corte MVP**;
biometría y dispositivo compartido son incremento posterior.

- [X] T041 [P] [HU-002] Escribir pruebas de PIN Argon2id con salt individual, pepper externo/versionado y ausencia de PIN crudo — FR-034, FR-036 — `apps/api/test/security/pin-hashing.spec.ts`
- [X] T042 [P] [HU-002] Escribir pruebas concurrentes del quinto fallo, bloqueo server-side de 15 minutos, reinicio tras éxito y reloj local irrelevante — FR-027, FR-036 — `apps/api/test/integration/pin-lockout.spec.ts`
- [X] T043 [P] [HU-002] Escribir pruebas de reglas para un perfil activo en dispositivo personal, revocación y recuperación presencial — FR-037…FR-039 — `apps/api/test/integration/personal-device.spec.ts`
- [X] T044 [HU-002] Implementar calibración/configuración Argon2id y servicio de setup/verificación de PIN con pepper fuera de DB — FR-034, FR-036 — `apps/api/src/modules/auth/services/pin.service.ts`, `apps/api/src/modules/auth/crypto/argon2.config.ts`
- [X] T045 [HU-002] Implementar registro, listado y revocación de Device/DeviceProfile con metadatos mínimos y cascada de sesiones — FR-037…FR-039 — `apps/api/src/modules/devices/services/device.service.ts`, `apps/api/src/modules/devices/devices.controller.ts`
- [ ] T046 [P] [HU-002] Escribir prueba contractual de challenge/proof biométrico sin plantillas, con credencial de dispositivo y fallback explícito — FR-034, FR-038 — `apps/api/test/contract/biometric-auth.contract.spec.ts`
- [ ] T047 [P] [HU-002] Escribir E2E móvil de aprobación del SO, invalidación biométrica y fallback a PIN — FR-034, FR-038 — `apps/mobile/e2e/biometric-fallback.yaml`
- [ ] T048 [P] [HU-002] Escribir primero prueba de integración fallida para `POST /tenants/current/shared-devices`: exigir owner/tenant activo y migración 0004, crear TENANT_SHARED administrado y aislar perfiles, PIN, contador, sesiones y revocación — FR-018, FR-034, FR-037 — `apps/api/test/integration/shared-device.spec.ts`
- [ ] T049 [HU-002] Definir cambios Prisma exclusivos de biometría/shared devices y migración posterior, sin aplicarla al MVP — FR-034, FR-037, FR-038 — `prisma/schema.prisma`, `prisma/migrations/0004_biometric_shared_devices/migration.sql`
- [ ] T050 [HU-002] Implementar challenges biométricos y verificación de credencial de posesión sin recibir datos biométricos — FR-034, FR-038 — `apps/api/src/modules/auth/services/biometric-challenge.service.ts`, `apps/api/src/modules/auth/auth.controller.ts`
- [ ] T051 [HU-002] Implementar `CreateTenantSharedDeviceRequest`, endpoint tenant-scoped y perfiles aislados exclusivamente para TENANT_SHARED administrado después de 0004 — FR-018, FR-034, FR-037 — `apps/api/src/modules/devices/services/shared-device.service.ts`, `apps/api/src/modules/devices/shared-devices.controller.ts`, `apps/api/src/modules/devices/dto/create-tenant-shared-device.dto.ts`

## Phase 7: Sesiones y rotación de credenciales

**Historias principales**: HU-002 y HU-006 (P1). **Corte MVP**.

- [X] T052 [P] [HU-002] Escribir pruebas contractuales de login PIN, refresh rotatorio y logout con expiración absoluta de 8 horas — FR-005, FR-035 — `apps/api/test/contract/session.contract.spec.ts`
- [X] T053 [P] [HU-002] Escribir pruebas de reutilización de refresh que revoquen toda la familia y mantengan respuestas anti-enumeración — FR-005, FR-027, FR-029 — `apps/api/test/security/refresh-reuse.spec.ts`
- [X] T054 [P] [HU-006] Escribir pruebas de revocación inmediata al desactivar User, Tenant, Membership o DeviceProfile aun con access token vigente — FR-006, FR-007, FR-021, FR-038, SC-003 — `apps/api/test/integration/immediate-revocation.spec.ts`
- [X] T055 [HU-002] Implementar Session server-side, access token de 10 minutos y RefreshCredential opaco almacenado como hash — FR-005, FR-035 — `apps/api/src/modules/auth/services/session.service.ts`, `apps/api/src/modules/auth/services/token.service.ts`
- [X] T056 [HU-002] Implementar rotación transaccional de refresh, detección de reuse y revocación de familia — FR-005, FR-023 — `apps/api/src/modules/auth/services/refresh-rotation.service.ts`
- [X] T057 [HU-002] Implementar guard de sesión que revalide authVersion y estados de cuenta, dispositivo, pertenencia y tenant en cada request — FR-006…FR-008, FR-018, FR-021 — `apps/api/src/modules/auth/guards/session.guard.ts`
- [X] T058 [HU-002] Exponer login PIN, refresh y logout con respuestas uniformes y tokens crudos solo en la respuesta inmediata autorizada — FR-005, FR-027, FR-034…FR-036 — `apps/api/src/modules/auth/auth.controller.ts`, `apps/api/src/modules/auth/dto/`

## Phase 8: Selección de tenant y autorización multi-tenant

**Historias principales**: HU-003 y HU-007 (P1). **Corte MVP**.

- [X] T059 [P] [HU-003] Escribir pruebas contractuales de identidad, lista de Membership activas y selección/cambio de tenant; exigir solo un access token nuevo, ausencia de refresh token en `TenantSelectionResponse`, incremento de `contextVersion`, rechazo inmediato del access token anterior, refresh posterior con el contexto vigente y conservación de la expiración absoluta de la familia — FR-008…FR-010, FR-023, FR-035 — `apps/api/test/contract/active-tenant.contract.spec.ts`
- [X] T060 [P] [HU-007] Escribir pruebas unitarias del guard chain y catálogo de errores para tenant solicitado, ajeno e inexistente — FR-018…FR-020, FR-027, FR-029 — `apps/api/test/unit/authorization/tenant-guard.spec.ts`
- [X] T061 [P] [HU-007] Escribir pruebas de repositorios que rechacen consultas sin `TenantContext` y relaciones anidadas cross-tenant — FR-018…FR-020 — `apps/api/test/integration/tenant-aware-repositories.spec.ts`
- [X] T062 [HU-003] Implementar resolución de Membership activas, auto-selección única y sesión sin tenant cuando existan varias — FR-008, FR-009 — `apps/api/src/modules/access/services/active-context.service.ts`
- [X] T063 [HU-003] Implementar cambio atómico de tenant: validar Membership, actualizar tenant/roles/permisos, incrementar `contextVersion`, emitir únicamente un access token nuevo dentro de la misma familia refresh, conservar su expiración absoluta de 8 horas, invalidar access tokens del contexto anterior y auditar el cambio — FR-010, FR-014, FR-023, FR-035, SC-005 — `apps/api/src/modules/access/services/select-tenant.service.ts`
- [X] T064 [HU-007] Implementar `TenantContext` inmutable y guards por identidad, sesión, Membership, Tenant y permiso — FR-018…FR-020 — `apps/api/src/modules/access/context/tenant-context.ts`, `apps/api/src/modules/access/guards/`
- [X] T065 [HU-007] Implementar repositorios base Prisma tenant-aware que requieran filtros compuestos y oculten existencia cross-tenant — FR-018…FR-020, FR-029 — `apps/api/src/infrastructure/prisma/tenant-repository.ts`
- [X] T066 [HU-003] Exponer `/me`, `/me/memberships` y `/sessions/current/tenant` según OpenAPI — FR-008…FR-010, FR-027 — `apps/api/src/modules/access/context.controller.ts`

## Phase 9: Roles, permisos y continuidad del propietario

**Historias principales**: HU-004, HU-005 y HU-006 (P1). **Corte MVP**.

- [X] T067 [P] [HU-005] Escribir pruebas unitarias del catálogo `owner_admin`, `seller`, `inventory_manager`, combinación por Membership y prohibición de permisos globales — FR-013, FR-014, FR-032 — `packages/authz-catalog/src/catalog.spec.ts`
- [X] T068 [P] [HU-005] Escribir pruebas contractuales de listar miembros, reemplazar roles y cambiar estado con `If-Match` — FR-015…FR-017, FR-022 — `apps/api/test/contract/membership-management.contract.spec.ts`
- [X] T069 [P] [HU-005] Escribir carrera serializable donde dos cambios intentan retirar al último owner y solo una operación permitida progresa — FR-022, FR-033, SC-008 — `apps/api/test/integration/last-owner-concurrency.spec.ts`
- [X] T070 [P] [HU-006] Escribir pruebas de desactivación/reactivación que preserven identidad, roles vigentes e historia sin restaurar sesiones/dispositivos — FR-012, FR-017, FR-021, FR-038, SC-010 — `apps/api/test/integration/membership-lifecycle.spec.ts`
- [X] T071 [HU-005] Implementar catálogo tipado y cálculo de permisos únicamente dentro de la Membership activa — FR-013, FR-014, FR-016, FR-032 — `packages/authz-catalog/src/index.ts`, `apps/api/src/modules/access/services/permission.service.ts`
- [X] T072 [HU-005] Implementar cambios de roles con versión optimista, `STALE_STATE` y protección serializable del último owner — FR-015, FR-016, FR-022, FR-033 — `apps/api/src/modules/memberships/services/change-roles.service.ts`
- [X] T073 [HU-006] Implementar desactivación/reactivación con motivo, actor, preservación histórica y revocación transaccional — FR-012, FR-017, FR-021, FR-038 — `apps/api/src/modules/memberships/services/change-membership-status.service.ts`, `apps/api/src/modules/memberships/memberships.controller.ts`

## Phase 10: Auditoría append-only

**Historia principal**: HU-008 (P2), con infraestructura requerida por el **corte MVP**.

- [X] T074 [P] [HU-008] Escribir pruebas de inserción transaccional y rollback del cambio sensible cuando falla AuditEvent — FR-023…FR-025, SC-004 — `apps/api/test/integration/audit-transaction.spec.ts`
- [X] T075 [P] [HU-008] Escribir pruebas que nieguen UPDATE/DELETE al usuario DB de aplicación y conserven historia tras desactivación — FR-025, SC-010 — `apps/api/test/persistence/audit-append-only.spec.ts`
- [X] T076 [P] [HU-008] Escribir pruebas de consulta tenant-scoped y sanitización de before/after, teléfono y secretos — FR-024, FR-026, FR-027 — `apps/api/test/security/audit-privacy.spec.ts`
- [X] T077 [HU-008] Implementar `AuditService` append-only con actor real/efectivo, tenant, sesión/dispositivo, resultado, motivo y correlación sanitizados — FR-023, FR-024 — `apps/api/src/modules/audit/services/audit.service.ts`
- [X] T078 [HU-008] Integrar AuditEvent en las transacciones MVP de bootstrap, identidad, Membership, activación, PIN/dispositivo personal, sesiones, tenant activo, roles, estados y denegaciones A/B — FR-023…FR-025, SC-004 — `apps/api/src/modules/audit/audited-transaction.ts`, `apps/api/src/modules/audit/mvp-audit.integration.ts`
- [X] T079 [HU-008] Implementar consulta paginada de eventos limitada al tenant y permiso del owner — FR-025, FR-026, SC-010 — `apps/api/src/modules/audit/audit.controller.ts`, `apps/api/src/modules/audit/repositories/audit.repository.ts`

## Phase 11: Soporte técnico temporal

**Historias principales**: HU-001 y HU-008. **Incremento posterior al MVP prioritario**.

- [ ] T080 [P] [HU-008] Escribir pruebas contractuales de abrir caso, aprobar/revocar/cerrar grant y diagnóstico allowlisted — FR-040 — `apps/api/test/contract/support.contract.spec.ts`
- [ ] T081 [P] [HU-008] Escribir pruebas negativas para aprobación por no-owner, scope/tenant ajeno, expiración >1 hora y acceso comercial — FR-004, FR-020, FR-040, SC-009 — `apps/api/test/security/support-boundaries.spec.ts`
- [ ] T082 [P] [HU-008] Escribir pruebas de expiración/revocación por reloj server y auditoría del actor técnico real sin impersonación — FR-023, FR-024, FR-040 — `apps/api/test/integration/support-lifecycle.spec.ts`
- [ ] T083 [P] [HU-008] Escribir pruebas de persistencia para SupportCase/SupportGrant, scopes, aprobador, TTL <=1h y revocación — FR-040 — `apps/api/test/persistence/support-schema.spec.ts`
- [ ] T084 [HU-008] Definir modelos Prisma de soporte y migración posterior, sin aplicarla al MVP — FR-040 — `prisma/schema.prisma`, `prisma/migrations/0003_support_access/migration.sql`
- [ ] T085 [HU-008] Implementar SupportCase y SupportGrant separados de Membership, con scopes técnicos allowlist y aprobación owner — FR-040 — `apps/api/src/modules/support/services/support-grant.service.ts`
- [ ] T086 [HU-001] Implementar guard de soporte que revalide caso, grant, actor, tenant, scope y TTL en cada request — FR-004, FR-018, FR-040 — `apps/api/src/modules/support/guards/support-grant.guard.ts`
- [ ] T087 [HU-008] Exponer endpoints de soporte y diagnóstico mínimo sin inventario, ventas, clientes ni costos — FR-004, FR-023, FR-040, SC-009 — `apps/api/src/modules/support/support.controller.ts`
- [ ] T088 [HU-008] Integrar AuditEvent específicamente en creación de SupportCase, aprobación/revocación/expiración de SupportGrant y cada operación realizada mediante soporte — FR-023, FR-024, FR-040 — `apps/api/src/modules/support/services/support-audit.service.ts`

## Phase 12: Emparejamiento web administrativo

**Historias principales**: HU-002 y HU-003. **Incremento posterior al MVP prioritario**.

- [ ] T089 [P] [HU-002] Escribir pruebas contractuales de inicio/aprobación y polling autenticado por `X-Pairing-Poll-Token`; exigir `oneOf` público PENDING/APPROVED/REJECTED/EXPIRED, sesión solo en APPROVED, dos pollings concurrentes con un ganador, y 404 `RESOURCE_NOT_FOUND` equivalente para reutilización, secreto incorrecto o pairing inexistente — FR-005, FR-027, FR-030 — `apps/api/test/contract/web-pairing.contract.spec.ts`
- [ ] T090 [P] [HU-002] Escribir prueba contractual que decodifique `approvalQrPayload`, valide UUID y secreto base64url sin padding >=128 bits, y rechace payload mal formado, sin secreto, con PII, polling secret o token de sesión — FR-027, FR-030 — `apps/api/test/contract/web-pairing-qr-payload.contract.spec.ts`
- [ ] T091 [P] [HU-002] Escribir pruebas de secretos approval/polling independientes >=128 bits, hashes, TTL 5 minutos, binding, rate limit, anti-enumeración, entrega única y rechazo con solo `pairingId` — FR-027, FR-030 — `apps/api/test/security/web-pairing-challenge.spec.ts`
- [ ] T092 [P] [HU-003] Escribir pruebas de revisión móvil de bodega/navegador/momento/scopes, confirmación PIN/biometría y rechazo de teléfono solo — FR-008…FR-010, FR-030 — `apps/api/test/integration/web-pairing-approval.spec.ts`
- [ ] T093 [P] [HU-002] Escribir pruebas de revocación de sesión WEB al revocar cuenta, pertenencia o dispositivo aprobador — FR-006, FR-021, FR-030, FR-038 — `apps/api/test/integration/web-session-revocation.spec.ts`
- [ ] T094 [P] [HU-002] Escribir pruebas de persistencia WebPairingChallenge: hashes approval/polling, browser binding, TTL, uso único y Session WEB — FR-030 — `apps/api/test/persistence/web-pairing-schema.spec.ts`
- [ ] T095 [P] [HU-002] Escribir prueba contractual de `rejectWebPairing`: Bearer + approval token, reasonCode allowlisted opcional, response REJECTED sanitizada e idempotencia segura sin tokens, secretos, sesión ni datos comerciales — FR-027, FR-030 — `apps/api/test/contract/web-pairing-reject.contract.spec.ts`
- [ ] T096 [P] [HU-003] Escribir prueba de integración transaccional para rechazo y carrera approve/reject: revalidar challenge PENDING, DeviceProfile, Membership y tenant/contexto; un único estado terminal ganador, metadatos/auditoría completos y cero Session WEB al rechazar — FR-008…FR-010, FR-023, FR-030 — `apps/api/test/integration/web-pairing-reject.spec.ts`
- [ ] T097 [HU-002] Definir WebPairingChallenge/Session WEB en Prisma y migración posterior, incluyendo metadatos de rechazo y consumo interno, sin aplicarla al MVP — FR-030 — `prisma/schema.prisma`, `prisma/migrations/0002_web_pairing/migration.sql`
- [ ] T098 [HU-002] Implementar WebPairingChallenge con hashes independientes, TTL, binding, rate limit y recogida atómica: marcar CONSUMED internamente, registrar navegador receptor, invalidar polling secret y devolver 404 genérico a toda reutilización o carrera perdedora — FR-027, FR-030 — `apps/api/src/modules/web-pairing/services/web-pairing.service.ts`
- [ ] T099 [HU-003] Implementar aprobación desde DeviceProfile owner activo y creación de Session `WEB` independiente <=8 horas — FR-008…FR-010, FR-030 — `apps/api/src/modules/web-pairing/services/approve-web-pairing.service.ts`
- [ ] T100 [HU-002] Implementar rechazo transaccional `PENDING -> REJECTED`, idempotencia del mismo rechazo, validación móvil/contexto, metadatos, invalidación del approval secret y prohibición de Session WEB — FR-023, FR-030 — `apps/api/src/modules/web-pairing/services/reject-web-pairing.service.ts`
- [ ] T101 [HU-002] Exponer inicio, review/approve y polling protegido por header; generar el URI QR validable, entregar la sesión APPROVED una sola vez y responder 404 genérico después sin exponer CONSUMED — FR-005, FR-027, FR-030 — `apps/api/src/modules/web-pairing/web-pairing.controller.ts`, `apps/api/src/modules/web-pairing/dto/`
- [ ] T102 [HU-002] Exponer `POST /auth/web-pairings/{pairingId}/reject` con Bearer + approval token y DTO allowlisted, delegando exclusivamente al servicio transaccional de rechazo — FR-027, FR-030 — `apps/api/src/modules/web-pairing/web-pairing.controller.ts`, `apps/api/src/modules/web-pairing/dto/reject-web-pairing.dto.ts`
- [ ] T103 [HU-008] Integrar AuditEvent sanitizado para rechazo con actor real, membership, dispositivo, tenant, reasonCode y resultado, sin secretos ni datos comerciales — FR-023, FR-024, FR-030 — `apps/api/src/modules/web-pairing/services/web-pairing-audit.service.ts`
- [ ] T104 [HU-002] Implementar interfaz móvil de revisión y aprobación: escanear QR, mostrar navegador/tenant/alcance y confirmar PIN o biometría sin mostrar polling secret — FR-030 — `apps/mobile/src/features/web-pairing/screens/WebPairingApprovalScreen.tsx`
- [ ] T105 [HU-002] Integrar acción móvil de rechazo con reasonCode controlado, confirmación visible y manejo idempotente, sin texto libre ni secretos en UI/telemetría — FR-027, FR-030 — `apps/mobile/src/features/web-pairing/screens/WebPairingApprovalScreen.tsx`, `apps/mobile/src/features/web-pairing/api/reject-web-pairing.ts`

## Phase 13: Aplicación móvil

**Historias principales**: HU-002, HU-003, HU-004 y HU-006. El recorrido QR/manual + PIN + selección
de tenant pertenece al **corte MVP**; biometría, compartidos y aprobación web son incrementales.

- [ ] T106 Generar una sola vez el cliente TypeScript para operaciones MVP desde OpenAPI, validar responses one-time de activación/sesión y publicar el artefacto compartido — FR-005, FR-028, FR-031 — `packages/api-contract/src/generated/index.ts`, `packages/api-contract/src/generated/schema.snapshot.json`
- [ ] T107 [HU-002] Implementar la capa HTTP móvil consumiendo el cliente OpenAPI ya generado, sin regenerarlo ni acceder a Supabase/PostgreSQL — FR-018, FR-019, FR-028 — `apps/mobile/src/api/client.ts`
- [ ] T108 [HU-004] Implementar pantallas mobile-first para escanear QR o introducir código de 8 dígitos, mostrar expiración y configurar PIN — FR-027, FR-031, FR-034 — `apps/mobile/src/features/activation/`
- [ ] T109 [HU-002] Implementar sesión móvil y credenciales de posesión en SecureStore, bloqueo local tras 30 minutos y cierre total — FR-005, FR-035, FR-037 — `apps/mobile/src/features/auth/`, `apps/mobile/src/security/secure-store.ts`
- [ ] T110 [HU-003] Implementar selector de bodega y reemplazo visible del contexto/roles sin conservar permisos previos — FR-008…FR-010, SC-005 — `apps/mobile/src/features/tenant/`
- [ ] T111 [P] [HU-002] Implementar biometría con LocalAuthentication que solo desbloquee credencial local y degrade explícitamente a PIN — FR-034, FR-038 — `apps/mobile/src/features/auth/biometric.ts`, `apps/mobile/src/features/auth/BiometricUnlockScreen.tsx`
- [ ] T112 [HU-002] Implementar interfaz móvil de Device TENANT_SHARED administrado: selección de perfil, PIN/bloqueo independientes y revocación aislada — FR-034, FR-037 — `apps/mobile/src/features/devices/SharedDeviceProfileScreen.tsx`

## Phase 14: Plataforma web

**Historias principales**: HU-001…HU-008. Administración básica pertenece al **corte MVP**; login por
pairing corresponde al incremento de Phase 12.

- [ ] T113 [HU-001] Implementar la capa HTTP web consumiendo el cliente OpenAPI ya generado, sin regenerarlo ni acceder a Supabase/PostgreSQL — FR-018, FR-019, FR-028 — `apps/web/src/api/client.ts`
- [ ] T114 [HU-004] Implementar administración tenant-scoped de miembros, alta pendiente y emisión presencial QR/manual con exposición única — FR-015, FR-027, FR-031 — `apps/web/src/features/memberships/`
- [ ] T115 [HU-005] Implementar edición de roles y estados con ETag/If-Match, conflictos comprensibles y protección visible del último owner — FR-015…FR-017, FR-022, FR-033 — `apps/web/src/features/memberships/RoleEditor.tsx`, `apps/web/src/features/memberships/StatusEditor.tsx`
- [ ] T116 [HU-008] Implementar consulta paginada de auditoría de acceso/membresía sin datos de otros tenants — FR-024…FR-026 — `apps/web/src/features/audit/`
- [ ] T117 [HU-002] Implementar pantalla de login por pairing que crea/presenta QR, hace polling y nunca solicita teléfono o PIN — FR-027, FR-030 — `apps/web/src/features/auth/WebPairingLogin.tsx`
- [ ] T118 [HU-003] Implementar shell de sesión WEB con tenant/scopes visibles, expiración <=8 horas y cierre/revocación — FR-008…FR-010, FR-030 — `apps/web/src/features/auth/WebSessionProvider.tsx`, `apps/web/src/features/tenant/`

## Phase 15: Pruebas unitarias e integración

**Propósito**: consolidar reglas críticas y recorridos de API; completar estas pruebas forma parte del
**corte MVP** para las capacidades prioritarias.

- [ ] T119 [P] Completar únicamente unidades faltantes del gate MVP para estados de Membership, TTL de activación/PIN, catálogo RBAC, sanitización y errores seguros; esperar 100% de reglas críticas aprobadas — FR-005…FR-029, FR-031…FR-039 — `apps/api/test/unit/mvp-access-regression.spec.ts`
- [ ] T120 [P] Validar transacciones MVP en PostgreSQL real para bootstrap, activación, revocación, roles y auditoría; esperar rollback total ante cada fallo inducido — FR-002, FR-012, FR-021…FR-025, FR-031, FR-033, FR-038, SC-002, SC-004 — `apps/api/test/integration/mvp-transaction-boundaries.spec.ts`
- [ ] T121 [P] Comparar los operationId MVP implementados de tenants, members, activation, PIN, sessions, context, devices y audit contra OpenAPI; esperar cero divergencias — FR-001…FR-029, FR-031…FR-039 — `apps/api/test/contract/mvp-openapi-conformance.spec.ts`
- [ ] T122 [P] Validar idempotencia MVP de bootstrap y emisión/consumo de activación; esperar una sola mutación y respuesta sanitizada repetible — FR-002, FR-022, FR-031 — `apps/api/test/integration/mvp-idempotency.spec.ts`
- [ ] T123 [P] Validar concurrencia MVP de activación, refresh, PIN, roles y último propietario; esperar un ganador o conflicto seguro sin pérdida silenciosa — FR-022, FR-031, FR-033, FR-036, SC-008 — `apps/api/test/integration/mvp-concurrency.spec.ts`
- [ ] T124 Validar desactivación/reactivación histórica y revocación inmediata en todos los guards MVP; esperar rechazo en la siguiente operación — FR-006, FR-007, FR-012, FR-017, FR-021, FR-038, SC-003, SC-010 — `apps/api/test/integration/mvp-revocation-regression.spec.ts`
- [ ] T125 Consolidar evidencia TDD solo del gate MVP para bootstrap, activación, PIN, sesión, tenant, RBAC, revocación, auditoría y A/B; registrar fallo previo y éxito posterior — FR-001…FR-029, FR-031…FR-039, SC-001…SC-005, SC-008, SC-010 — `specs/001-multi-tenant-access/evidence/mvp-tdd-results.md`

## Phase 16: Suite negativa de aislamiento A/B

**Historia principal**: HU-007 (P1). **Gate obligatorio del corte MVP**.

- [ ] T126 [P] [HU-007] Crear matriz de rutas y operaciones A/B para lectura, listado, modificación, administración y relaciones anidadas — FR-018…FR-020, FR-029, SC-001 — `apps/api/test/security/tenant-isolation.matrix.ts`
- [ ] T127 [HU-007] Implementar suite negativa que manipule path, body, query, cursor, IDs y nested writes contra tenant B desde sesión A — FR-018…FR-020, FR-029, SC-001 — `apps/api/test/security/tenant-isolation.spec.ts`
- [ ] T128 [P] [HU-007] Comparar status/body/tiempo de recurso ajeno e inexistente para impedir enumeración — FR-020, FR-027, FR-029 — `apps/api/test/security/cross-tenant-enumeration.spec.ts`
- [ ] T129 [P] [HU-007] Verificar constraints compuestos y que ningún fallo A/B lea o mute filas del tenant objetivo — FR-018…FR-020, SC-001 — `apps/api/test/persistence/cross-tenant-constraints.spec.ts`
- [ ] T130 [HU-007] Convertir la suite A/B en gate reusable para cada nuevo repositorio o endpoint tenant-scoped — FR-018…FR-020, FR-029, SC-001 — `apps/api/test/security/tenant-isolation.harness.ts`

## Phase 17: Pruebas E2E, seguridad y rendimiento

- [ ] T131 [P] Crear E2E Maestro del recorrido MVP: activación QR/manual, PIN, login, selección de tenant, bloqueo y revocación — FR-005…FR-010, FR-031, FR-034…FR-039 — `apps/mobile/e2e/mvp-access-flow.yaml`
- [ ] T132 [P] Crear E2E Playwright para miembros, roles, último owner, auditoría y errores seguros — FR-015…FR-017, FR-022…FR-027, FR-033 — `apps/web/e2e/access-admin.spec.ts`
- [ ] T133 [P] Crear E2E combinado Playwright/Maestro para pairing web de un uso y revocación de sesión WEB — FR-030 — `apps/web/e2e/web-pairing.spec.ts`, `apps/mobile/e2e/approve-web-pairing.yaml`
- [ ] T134 [P] Validar en el gate MVP ausencia de PIN, código manual, secreto QR y access/refresh tokens crudos en DB, logs, auditoría y respuestas posteriores — FR-023, FR-024, FR-027, FR-031, FR-034 — `apps/api/test/security/mvp-secret-absence.spec.ts`
- [ ] T135 [P] Crear pruebas de restauración/backup móvil y fallo biométrico que no migren una sesión utilizable — FR-034, FR-037…FR-039 — `apps/mobile/e2e/device-recovery.yaml`
- [ ] T136 [P] Crear escenarios k6 para login, refresh, selección de tenant, guard chain, listados y revocación bajo carga — FR-005, FR-018, FR-021, SC-003 — `apps/api/test/performance/access.js`
- [ ] T137 Ejecutar objetivos p95 <300 ms y documentar capacidad del ambiente sin convertirla en SLA definitivo — SC-003 — `specs/001-multi-tenant-access/evidence/performance.md`

## Phase 18: Automatización mediante GitHub Actions

- [ ] T138 [P] Crear workflow de calidad para lint, formato y TypeScript estricto — FR-028 — `.github/workflows/quality.yml`
- [ ] T139 [P] Crear workflow del gate MVP para unidades, integración PostgreSQL, contratos, concurrencia y usabilidad automatizable de tenants, activación, sesiones, RBAC, revocación y auditoría — FR-001…FR-029, FR-031…FR-039, SC-002, SC-003, SC-008 — `.github/workflows/mvp-api-tests.yml`
- [ ] T140 [P] Crear workflow de seguridad que bloquee por suite A/B, ausencia de secretos y auditoría append-only — FR-018…FR-027, FR-029, SC-001, SC-004 — `.github/workflows/security-tests.yml`
- [ ] T141 [P] Crear workflow E2E del gate MVP para administración web y recorrido móvil QR/manual + PIN + tenant, sin pairing, biometría ni dispositivo compartido — FR-005…FR-010, FR-015…FR-017, FR-022…FR-027, FR-031, FR-034…FR-039 — `.github/workflows/mvp-e2e.yml`
- [ ] T142 Crear workflow k6 programado/manual con artefactos de evidencia y umbrales del plan — SC-003 — `.github/workflows/performance.yml`

## Phase 19: Documentación y validación final

- [ ] T143 [P] Validar el subconjunto OpenAPI del gate MVP —tenants, Membership, activation, PIN, sessions, context, personal devices y audit— y esperar cero cambios incompatibles — FR-001…FR-029, FR-031…FR-039 — `specs/001-multi-tenant-access/evidence/mvp-openapi-validation.md`
- [ ] T144 [P] Documentar arquitectura y runbook del gate MVP para revocación/recuperación presencial, sin incluir soporte, pairing, biometría ni shared device — FR-005…FR-029, FR-031…FR-039 — `docs/runbooks/mvp-access-revocation.md`
- [ ] T145 Ejecutar solo escenarios MVP de quickstart: bootstrap, activación/PIN, sesión, tenant, A/B, roles/owner y auditoría; conservar resultados esperados — FR-001…FR-029, FR-031…FR-039, SC-001…SC-005, SC-008, SC-010 — `specs/001-multi-tenant-access/evidence/mvp-quickstart-results.md`
- [ ] T146 Verificar en el gate MVP ausencia de ventas/inventario funcional, OCR, BI, offline, SMS, correo y dependencias de incrementos posteriores — FR-004, FR-031 — `specs/001-multi-tenant-access/evidence/mvp-scope-audit.md`
- [ ] T147 Completar matriz del gate MVP requisito → HU → tarea → prueba → evidencia, limitada a capacidades prioritarias y con Constitution Check — FR-001…FR-029, FR-031…FR-039, SC-001…SC-005, SC-008, SC-010 — `specs/001-multi-tenant-access/evidence/mvp-traceability-matrix.md`

### Gate de funcionalidad completa

- [ ] T148 [P] Preparar protocolo e instrumento con ambiente controlado, códigos anónimos, consentimiento/privacidad, cronometraje individual, definiciones exactas de ayuda correctiva y primer intento, y prohibición de inventar resultados; SC-006 usa 4 internos y fórmula `éxitos/4*100 >=90%` (exige 4/4), SC-007 usa 2 owners y fórmula `éxitos/2*100 >=90%` (exige 2/2) — SC-006, SC-007 — `specs/001-multi-tenant-access/evidence/usability-protocol.md`
- [ ] T149 Ejecutar posteriormente con los 4 usuarios internos codificados la medición real de login y selección correcta <2 minutos sin ayuda correctiva, completar el instrumento y calcular `exitosos/4*100`, sin anticipar ni inventar resultados — SC-006 — `specs/001-multi-tenant-access/evidence/usability-results.md`
- [ ] T150 Ejecutar posteriormente con los 2 propietarios codificados incorporación, cambio de rol y desactivación en primer intento, completar el instrumento y calcular `exitosos/2*100`, sin anticipar ni inventar resultados — SC-007 — `specs/001-multi-tenant-access/evidence/usability-results.md`
- [ ] T151 [P] Ejecutar spike RLS con Prisma, Supabase, pool y `SET LOCAL`; probar ausencia de fuga entre conexiones y mantener RLS deshabilitado si no es seguro, sin sustituir guards/repositorios/constraints — FR-018…FR-020, SC-001 — `specs/001-multi-tenant-access/evidence/rls-spike.md`
- [ ] T152 [P] Definir catálogo de reautenticación sensible para propietarios, dispositivos, recuperación, soporte y roles, incluyendo antigüedad máxima, PIN/biometría, error seguro, auditoría y cierre — FR-015, FR-023, FR-033, FR-038…FR-040 — `specs/001-multi-tenant-access/evidence/sensitive-reauth-policy.md`
- [ ] T153 Validar contrato completo y regenerar secuencialmente el cliente compartido con biometría, shared device, soporte, doble secreto de pairing y responses one-time; esperar cero divergencias — FR-030, FR-034, FR-037, FR-040 — `apps/api/test/contract/full-feature-openapi-conformance.spec.ts`, `packages/api-contract/src/generated/index.ts`
- [ ] T154 Ejecutar el quickstart completo después de todos los incrementos y conservar evidencia real de seguridad, soporte, pairing, rendimiento y usabilidad — FR-001…FR-040, SC-001…SC-010 — `specs/001-multi-tenant-access/evidence/full-quickstart-results.md`
- [ ] T155 Completar matriz final de funcionalidad completa y Constitution Check con evidencia FR-001 a FR-040 y SC-001 a SC-010 — FR-001…FR-040, SC-001…SC-010 — `specs/001-multi-tenant-access/evidence/full-traceability-matrix.md`

## Dependencies & Execution Order

### Phase dependencies

1. Phase 1 bloquea Phase 2.
2. Phase 2 bloquea persistencia y todas las fases funcionales.
3. Phase 3 entrega únicamente la persistencia MVP mediante T022 y bloquea el núcleo de Phases 4–10; las migraciones T097, T084 y T049 se ejecutan después del gate MVP y bloquean solo pairing web, soporte y biometría/shared devices, respectivamente.
4. El núcleo MVP progresa en este orden: Phase 4 → 5 → 6 (PIN/personal) → 7 → 8 → 9 → 10.
5. Phase 13 y Phase 14 pueden avanzar por superficie cuando sus endpoints correspondientes estén
   estables; nunca acceden directamente a PostgreSQL.
6. Phase 15 y Phase 16 consolidan el gate MVP. Phase 17 integra E2E/seguridad/rendimiento.
7. Phase 18 depende de comandos de prueba estables. Phase 19 cierra documentación y evidencia.
8. Soporte (Phase 11), pairing web (Phase 12), biometría/shared device (T046–T051, T111–T112),
   rendimiento y validación completa se ejecutan únicamente después de superar el gate MVP.
9. En pairing web, T089–T096 deben fallar antes de T097–T103; T100 bloquea T102/T103, y el contrato
   estable de T102 bloquea la integración móvil de rechazo T105. La rama approve/reject comparte una
   única transición transaccional terminal.

### Story dependencies and independent criteria

| Historia | Dependencias funcionales | Criterio independiente |
|---|---|---|
| HU-001 | Phases 1–3 | Bootstrap atómico e idempotente; resumen técnico mínimo |
| HU-002 | HU-001 para datos iniciales | Activación, PIN, sesión y revocación sin enumeración |
| HU-003 | Sesión HU-002 | Selección/cambio completo de tenant sin mezclar roles |
| HU-004 | Tenant HU-001 | Alta pendiente y emisión presencial dentro del tenant activo |
| HU-005 | HU-004 | Cambio de roles con concurrencia y continuidad de owner |
| HU-006 | HU-002/HU-004 | Desactivar/reactivar preservando historia y revocando acceso |
| HU-007 | HU-002/HU-003 | 100% de matriz A/B rechazada sin revelar existencia |
| HU-008 | Eventos producidos por las anteriores | Auditoría inmutable, tenant-scoped y sanitizada |

## Parallel Opportunities

- T002–T004 pueden ejecutarse en paralelo después de T001.
- T007, T009, T011–T013 y T015 pueden escribirse en paralelo después de T006; T008 depende de T007,
  T010 depende de T009 y T014 depende de T013.
- T016–T018 pueden escribirse en paralelo antes de T019–T022.
- En cada fase funcional, todas las tareas de prueba `[P]` pueden escribirse simultáneamente y deben
  fallar antes de comenzar las tareas de implementación de esa fase.
- API, móvil y web pueden avanzar en paralelo cuando el contrato de su recorrido esté estabilizado.
- Las pruebas T089–T096 pueden prepararse en paralelo porque usan archivos distintos; las tareas de
  rechazo T100, T102, T103 y T105 son secuenciales por servicio, controller, auditoría y cliente.
- T126, T128 y T129 permiten dividir la suite A/B por matriz, enumeración y constraints.
- T131–T136 y T138–T141 se reparten por herramienta/workflow sin compartir archivos.

## Implementation Strategy

### Gate MVP prioritario

Completar T001–T045, T052–T079, T106–T110, T113–T116, T119–T132, T134,
T138–T141 y T143–T147. Este corte no depende de soporte, pairing web, biometría, dispositivo
compartido, rendimiento avanzado ni validación completa.

| Capacidad MVP | Tareas | Migración | Prueba de aceptación | Dependencia posterior |
|---|---|---|---|---|
| Identidad global, tenant y primer propietario | T024–T030 | `0001_identity_access_mvp` (T022) | T120, T122, T145 | Ninguna |
| Membership y activación QR/código manual | T031–T040 | `0001_identity_access_mvp` (T022) | T122, T123, T131, T134 | Ninguna |
| Dispositivo personal y PIN | T041–T045, T106–T110 | `0001_identity_access_mvp` (T022) | T119, T131, T134 | Ninguna |
| Sesión móvil, refresh y revocación | T052–T058 | `0001_identity_access_mvp` (T022) | T123, T124, T131 | Ninguna |
| Selección de tenant y aislamiento A/B | T059–T066, T126–T130 | `0001_identity_access_mvp` (T022) | T121, T126–T130 | Ninguna |
| RBAC, último propietario y auditoría | T067–T079, T113–T116 | `0001_identity_access_mvp` (T022) | T120, T123, T132 | Ninguna |
| Gates automatizados y evidencia MVP | T119–T134, T138–T141, T143–T147 | No añade migración | T139–T141, T145–T147 | Ninguna |

### Gate de funcionalidad completa

Después del MVP, completar biometría/shared device (T046–T051, T111–T112, T135), soporte
(T080–T088), pairing web (T089–T105, T117–T118, T133), rendimiento/hardening (T136–T137, T142)
y validación completa (T148–T155).

| Capacidad posterior | Tareas | Migración | Prueba de aceptación | Dependencia previa |
|---|---|---|---|---|
| Emparejamiento web administrativo | T089–T105, T117–T118, T133 | `0002_web_pairing` (T097) | T089–T096, T133 | Gate MVP aprobado |
| Soporte técnico temporal | T080–T088 | `0003_support_access` (T084) | T080–T083 | Gate MVP aprobado |
| Biometría | T046–T047, T049–T050, T111, T135 | `0004_biometric_shared_devices` (T049) | T046–T047, T135 | Gate MVP aprobado |
| Dispositivo compartido administrado | T048–T049, T051, T112, T135 | `0004_biometric_shared_devices` (T049) | T048, T135 | Gate MVP aprobado |
| Hardening, rendimiento y cierre completo | T136–T137, T142, T148–T155 | No añade migración | T137, T149–T151, T153–T155 | Incrementos aplicables completos |

## Checklist de formato y alcance

- Todas las tareas usan checkbox, ID secuencial, ruta concreta y trazabilidad FR/SC.
- `[P]` solo identifica trabajo en archivos distintos sin dependencia inmediata pendiente.
- Las fases funcionales incluyen `[HU-xxx]`; setup, infraestructura y cierre no fuerzan una historia.
- Las pruebas preceden a implementación en autenticación, autorización, concurrencia, auditoría,
  soporte y pairing.
- No se incluyen productos, ventas, inventario funcional, OCR, BI, offline, SMS ni correo.

