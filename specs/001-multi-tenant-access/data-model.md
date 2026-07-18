# Data Model: Identidad y acceso multi-bodega

Este es un modelo lógico/técnico de planificación. No es una migración ni modifica PostgreSQL.
Todos los identificadores son UUID opacos; fechas en UTC; secretos se representan solo por hashes.

## Conventions

- Entidades tenant-scoped incluyen `tenantId` e índices/relaciones compuestas.
- Estados reemplazan borrado físico para identidad, pertenencia, dispositivos y soporte.
- `createdAt`, `updatedAt` y `version` se omiten en descripciones repetitivas pero se exigen donde
  corresponda. `version` permite concurrencia optimista.
- Teléfonos se normalizan a E.164 antes de comparar; la política de números reciclados se aprueba
  antes de producción.
- PIN, código manual, secreto QR, approval/polling secrets, access/refresh tokens crudos, pepper y plantillas biométricas nunca
  aparecen en logs, auditoría ni respuestas posteriores. En base de datos solo se admiten hashes,
  salts, identificadores de versión y metadatos técnicos mínimos aprobados.

## Entity Relationship Overview

```text
User 1---* Membership *---1 Tenant
Membership *---* Role *---* Permission
User 1---* DeviceProfile *---1 Device
Membership 1---* ActivationChallenge
ActivationChallenge 1---0..1 ActivationManualAlias
DeviceProfile 1---* Session 1---* RefreshCredential
DeviceProfile 1---* WebPairingChallenge 0..1---1 Session
Tenant 1---* SupportCase 1---* SupportGrant
Tenant 1---* AuditEvent
```

## User

Identidad global; no contiene roles comerciales.

| Field | Type | Rules |
|---|---|---|
| id | UUID | Primary key |
| displayName | string | 1–120 caracteres, nombre de trabajo |
| phoneE164 | string | Normalizado, unicidad global inicial |
| status | enum | `ACTIVE`, `DISABLED` |
| disabledAt | timestamp? | Requerido cuando `DISABLED` |
| disabledReason | string? | Requerido cuando `DISABLED` |
| authVersion | integer | Incrementa al revocar globalmente |
| createdAt / updatedAt | timestamp | UTC |

**Sensitive data**: nombre y teléfono. Visibilidad limitada a pertenencias autorizadas y soporte
expresamente scopeado. No se registra teléfono crudo en eventos de fallo; se usa HMAC seudónimo.

**Transitions**: `ACTIVE -> DISABLED`; reactivación exige acción autorizada y auditoría. Desactivar
revoca todas las sesiones, pero conserva pertenencias e historia.

## Tenant

Bodega aislada.

| Field | Type | Rules |
|---|---|---|
| id | UUID | Primary key |
| name | string | 1–160 caracteres |
| status | enum | `ACTIVE`, `DISABLED` |
| disabledAt / disabledReason | timestamp? / string? | Motivo obligatorio al desactivar |
| createdByTechnicalAdminId | UUID | Actor técnico autorizado |
| createdAt / updatedAt / version | timestamp / integer | Concurrencia optimista |

**Invariant**: crear Tenant, primer propietario y AuditEvent es una transacción indivisible.

## Membership

Fuente autoritativa de acceso entre User y Tenant.

| Field | Type | Rules |
|---|---|---|
| id | UUID | Primary key |
| tenantId / userId | UUID | Unique compuesto `(tenantId,userId)` |
| status | enum | `PENDING_ACTIVATION`, `ACTIVE`, `DISABLED` |
| joinedAt | timestamp? | Al activar |
| createdByMembershipId | UUID? | Propietario responsable; null solo para bootstrap técnico |
| disabledAt / disabledReason | timestamp? / string? | Obligatorios al desactivar |
| disabledByMembershipId | UUID? | Actor autorizado |
| version | integer | ETag/If-Match |

**Invariant**: no se puede desactivar, retirar ni quitar `owner_admin` al último propietario activo.
**Transition**: `PENDING_ACTIVATION -> ACTIVE <-> DISABLED`; reactivar no restaura sesiones/dispositivos.

## Role, Permission and MembershipRole

Catálogo versionado en producto y persistencia para trazabilidad.

| Entity | Fields | Rules |
|---|---|---|
| Role | `id`, `code`, `name`, `catalogVersion` | `code` único: `owner_admin`, `seller`, `inventory_manager` |
| Permission | `id`, `code`, `domain` | Código atómico estable |
| RolePermission | `roleId`, `permissionId` | Matriz fija aprobada |
| MembershipRole | `membershipId`, `roleId`, `tenantId`, timestamps, actor | Roles combinables, siempre mismo tenant |

Permisos efectivos son la unión de RolePermission para una Membership activa. Esta feature habilita
administración de acceso/auditoría; permisos de venta/inventario quedan reservados para futuras specs.

## ActivationChallenge

Invitación presencial de un uso.

| Field | Type | Rules |
|---|---|---|
| id | UUID | Primary key |
| tenantId / membershipId | UUID | Relación compuesta al mismo tenant |
| qrSecretHash | bytes/string | Hash del secreto QR aleatorio >=128 bits; nunca reversible |
| formatVersion | string | Permite evolucionar el payload QR opaco |
| purpose | enum | `INITIAL_ACTIVATION`, `DEVICE_REACTIVATION` |
| expiresAt | timestamp | Inicialmente 15 minutos |
| maxAttempts / failedAttempts | integer | Contador atómico compartido; máximo fijo de 5 |
| phoneBindingHmac | bytes/string | HMAC-SHA-256 determinístico del teléfono previamente normalizado a E.164 |
| phoneBindingKeyVersion | string/integer | Versión de la clave HMAC administrada fuera de la base |
| issuedByMembershipId | UUID | Propietario activo |
| targetDeviceNonce | string? | Liga reintento idempotente al mismo dispositivo |
| consumedAt / consumedByDeviceProfileId | timestamp? / UUID? | Solo un consumo |
| revokedAt | timestamp? | Revocación explícita |

**Transitions**: `ISSUED -> CONSUMED | EXPIRED | REVOKED`. Consumos concurrentes: exactamente uno.

El QR solo representa el secreto opaco: nunca contiene nombre, teléfono, `tenantId` ni otra PII
legible. Su valor crudo se entrega una sola vez y nunca se persiste, registra o devuelve después.
`ActivationChallenge` y sus aliases nunca guardan el E.164 crudo. Al validar, se normaliza la entrada,
se calcula HMAC-SHA-256 con `phoneBindingKeyVersion` y se compara en tiempo constante. Nuevos
challenges usan la versión actual; los vigentes usan su versión guardada hasta expirar en 15 minutos,
sin migrar expirados. Esto no sustituye el teléfono autorizado conservado en `User`.

## ActivationManualAlias

Alias manual opcional asociado server-side a un `ActivationChallenge`; no sustituye su secreto QR.

| Field | Type | Rules |
|---|---|---|
| id / challengeId | UUID | Relación única con el challenge |
| codeHash | bytes/string | Hash del código de 8 dígitos; nunca código crudo |
| expiresAt | timestamp | Igual o anterior al challenge; máximo 15 minutos |
| formatVersion | string | Versión del esquema de hash/código |

El alias hereda pertenencia, propósito, teléfono normalizado, máximo de cinco intentos, rate limiting
por IP/dispositivo/identificador seudonimizado y consumo único del challenge. No es una codificación
del secreto de 128 bits. Consumir QR o código invalida ambas vías atómicamente.

## Device

Instalación física/lógica con metadatos mínimos.

| Field | Type | Rules |
|---|---|---|
| id | UUID | Identificador aleatorio de app, no hardware invasivo |
| type | enum | `PERSONAL`, `TENANT_SHARED` |
| managedByTenantId | UUID? | Obligatorio para compartido |
| platform | enum | `ANDROID`, `IOS`, `WEB` |
| appVersion | string | Diagnóstico mínimo |
| status | enum | `ACTIVE`, `REVOKED` |
| lastSeenAt / revokedAt | timestamp? | UTC |
| revokedByMembershipId / reason | UUID? / string? | Auditoría de revocación |

No se almacenan IMEI, advertising ID, huella del equipo ni datos biométricos.

## DeviceProfile

Vínculo individual de User/Membership con Device.

| Field | Type | Rules |
|---|---|---|
| id | UUID | Primary key |
| deviceId / userId / membershipId / tenantId | UUID | Relaciones coherentes y tenant compuesto |
| status | enum | `PENDING_PIN`, `ACTIVE`, `LOCKED`, `REVOKED` |
| pinHash / pinSaltVersion / pinPepperVersion | secret metadata | Argon2id; nunca PIN crudo |
| failedPinAttempts | integer | Se actualiza atómicamente |
| lockedUntil | timestamp? | 15 minutos tras quinto fallo |
| biometricEnabled | boolean | Preferencia; no plantilla |
| deviceCredentialHashOrPublicKey | bytes/string | Credencial de posesión |
| activatedAt / revokedAt | timestamp? | UTC |

**Constraints**: un Device `PERSONAL` solo tiene un DeviceProfile activo; uno compartido puede tener
varios, cada uno aislado. Un perfil revocado no vuelve a activarse: se crea nueva activación.

La activación presencial del MVP crea siempre `PERSONAL`; el tipo no es entrada del cliente y un
campo extra `type` se rechaza. `TENANT_SHARED` no se crea mediante `/auth/activations`: después de
aplicar `0004_biometric_shared_devices`, un propietario autorizado usa la operación tenant-scoped
`POST /tenants/current/shared-devices`, que exige `managedByTenantId` derivado del contexto activo.

## WebPairingChallenge

Solicitud de emparejamiento iniciada por un navegador y aprobada desde un móvil activado.

| Field | Type | Rules |
|---|---|---|
| id | UUID | Identificador opaco |
| approvalSecretHash | bytes/string | Hash del secreto QR >=128 bits; nunca valor crudo persistido |
| browserPollingSecretHash | bytes/string | Hash de secreto independiente >=128 bits; no aparece en QR |
| requestedTenantId / requestedMembershipId | UUID | Alcance solicitado; se revalida al aprobar |
| browserBindingHash / browserDisplay | bytes/string | Vínculo seudonimizado exigido al hacer polling y descripción mínima revisable |
| requestedScopes | string[] | Allowlist administrativa visible antes de confirmar |
| requestedAt / expiresAt | timestamp | `expiresAt <= requestedAt + 5 minutes` |
| approvedByDeviceProfileId | UUID? | Móvil previamente activado del propietario administrador |
| approvedAt / consumedAt / revokedAt | timestamp? | Un solo uso; estados terminales excluyentes |
| consumedByBrowserBindingHash | bytes/string? | Navegador que recibió la sesión una única vez |
| rejectedAt | timestamp? | Obligatorio solo en estado `REJECTED` |
| rejectedByUserId / rejectedByMembershipId / rejectedByDeviceProfileId | UUID? | Actor móvil autorizado que rechazó |
| rejectionReasonCode | enum? | `USER_REJECTED`, `UNKNOWN_BROWSER`, `WRONG_TENANT`, `REQUEST_NOT_EXPECTED`; nunca texto libre |

**Transitions**: solo `PENDING -> APPROVED` o `PENDING -> REJECTED`; entregar la sesión cambia
internamente `APPROVED -> CONSUMED`. `APPROVED`, `REJECTED`, `EXPIRED` y `CONSUMED` son terminales
respecto de approve/reject, y una carrera approve/reject permite un único ganador. Aprobar
requiere PIN o biometría en el móvil y muestra bodega, navegador, momento y scopes. El QR no contiene
token de sesión ni `browserPollingSecret`. El navegador recibe este último una sola vez al crear el
pairing y debe presentarlo con `pairingId`; el backend compara su hash en tiempo constante, valida TTL,
rate limit y binding, entrega la sesión una sola vez e invalida el resultado. El navegador nunca
recibe PIN ni datos biométricos. Ninguno de los secretos crudos llega a DB, logs o auditoría.
El `approvalQrPayload` completo tampoco se persiste: representa
`bodegia://pairing/approve?pairingId=<uuid>&secret=<base64url-sin-padding>`. Solo `APPROVED` entrega
una Session WEB obligatoria; al hacerlo transiciona atómicamente a `CONSUMED`, registra `consumedAt`
y navegador receptor e invalida definitivamente el polling secret. `CONSUMED` permanece interno:
reutilización, secreto incorrecto, pairing no disponible o navegador distinto reciben el mismo 404
genérico. Rechazar exige móvil/Membership/DeviceProfile activos y contexto coincidente, persiste los
metadatos de rechazo únicamente en `REJECTED`, invalida approval secret, crea AuditEvent sanitizado y
no crea Session WEB.

## Session and RefreshCredential

Sesión revocable y familia rotatoria.

| Entity | Fields | Rules |
|---|---|---|
| Session | `id`, `userId`, `deviceProfileId?`, `webPairingChallengeId?`, `platform`, `browserBindingHash?`, `activeMembershipId?`, `tenantId?`, `authVersion`, `contextVersion`, `createdAt`, `absoluteExpiresAt`, `lastActivityAt`, `revokedAt`, `revokeReason` | `platform` es `MOBILE` o `WEB`; exactamente uno de perfil móvil o pairing web origina la sesión; `absoluteExpiresAt <= createdAt + 8h`; tenant deriva de membership; cambio de tenant incrementa `contextVersion` |
| RefreshCredential | `id`, `sessionId`, `familyId`, `tokenHash`, `issuedAt`, `expiresAt`, `rotatedAt`, `replacedById`, `revokedAt`, `reuseDetectedAt` | Token opaco, hash único, rotación de un uso |

Cambiar tenant actualiza `activeMembershipId`, `tenantId` y `contextVersion`, reemplaza solo el access
token y conserva refresh token/familia y expiración absoluta. Tokens anteriores se rechazan por versión.
Desactivar User, Tenant,
Membership o DeviceProfile revoca las sesiones afectadas dentro de la misma transacción. Revocar el
dispositivo móvil que aprobó un emparejamiento invalida también sus sesiones WEB derivadas.

## SupportCase and SupportGrant

Acceso técnico excepcional, separado de Membership.

| Entity | Fields | Rules |
|---|---|---|
| SupportCase | `id`, `tenantId`, `reason`, `status`, `openedByTechnicalAdminId`, `openedAt`, `closedAt` | `OPEN`, `CLOSED`, `CANCELLED` |
| SupportGrant | `id`, `caseId`, `tenantId`, `technicalAdminId`, `approvedByMembershipId`, `scopes[]`, `startsAt`, `expiresAt`, `revokedAt`, `closedAt` | Aprobador owner activo; duración <=1h; scopes allowlist |

**Invariant**: no contiene roles comerciales ni permite impersonación. Vigencia se verifica por reloj
del servidor en cada operación, aun si un job de expiración falla.

## AuditEvent

Registro append-only.

| Field | Type | Rules |
|---|---|---|
| id | UUID | Primary key |
| tenantId | UUID? | Null solo para evento técnico realmente global |
| actorType / actorId | enum / UUID? | Actor real |
| effectiveMembershipId | UUID? | Contexto autorizado, nunca impersonación |
| sessionId / deviceId / supportGrantId | UUID? | Evidencia cuando aplica |
| action | string enum/catalog | Acción estable |
| targetType / targetId | string / UUID? | Objeto afectado |
| result | enum | `SUCCEEDED`, `DENIED`, `FAILED` |
| reason | string? | Obligatorio en cambios sensibles |
| before / after | sanitized JSON? | Sin secretos ni PII innecesaria |
| occurredAt | timestamp | Inmutable, UTC |
| correlationId | UUID/string | Correlación segura |
| sourceIpHmac / userAgentClass | string? | Minimizados/pseudonimizados |

El usuario DB de aplicación no recibe UPDATE/DELETE sobre AuditEvent. Los eventos de autenticación
fallida usan HMAC del identificador, no teléfono crudo.

## IdempotencyRecord

| Field | Type | Rules |
|---|---|---|
| id | UUID | Primary key |
| scopeActorId / tenantId? / operation | values | Unique junto con `idempotencyKeyHash` |
| idempotencyKeyHash / requestHash | bytes/string | No guardar clave cruda |
| responseStatus / responseBodySanitized | integer / JSON | Resultado repetible seguro |
| expiresAt | timestamp | Retención acotada |

Aplica a alta de tenant, emisión/consumo de activación y aprobaciones sensibles.

## Transaction Boundaries

1. Tenant + primer owner + roles + auditoría: todo o nada.
2. Consumo ActivationChallenge + Device/Profile + PIN pendiente + Session + auditoría: todo o nada.
3. Cambio Membership/roles + continuidad owner + revocaciones + auditoría: todo o nada.
4. Revocación Device/Profile + sesiones/familias + auditoría: todo o nada.
5. SupportGrant + aprobación + auditoría: todo o nada.
6. Aprobación/consumo WebPairingChallenge + Session WEB + auditoría: todo o nada.

## Required Indexes and Constraints

- Unique `(tenantId,userId)` en Membership.
- Unique parcial de DeviceProfile activo para Device personal.
- Índices `(tenantId,status)`, `(tenantId,id)` y `(tenantId,occurredAt,id)` en entidades consultadas.
- FKs compuestas que impidan MembershipRole, DeviceProfile, SupportGrant o relaciones con tenants
  diferentes.
- Unique `qrSecretHash`, `codeHash`, `approvalSecretHash`, `browserPollingSecretHash` y `tokenHash` según entidad; consumo/rotación
  condicionado por estado vigente. Los valores crudos nunca se persisten.
- Check `SupportGrant.expiresAt <= startsAt + 1 hour` y expiración Session <= 8 horas.
- Check `ActivationChallenge.maxAttempts = 5`, código manual de 8 dígitos antes de hashear y
  `WebPairingChallenge.expiresAt <= requestedAt + 5 minutes`.
- AuditEvent sin rutas de mutación y permisos DB append-only.

## Retention

Membership y auditoría se conservan históricamente. Sesiones, refresh hashes, idempotencia y tokens
expirados requieren una política operativa antes de producción; su depuración nunca borra AuditEvent
ni rompe referencias históricas. La retención exacta es una decisión técnica pendiente documentada.

## Persistence delivery order

- **MVP — `prisma/migrations/0001_identity_access_mvp/migration.sql`**: User, Tenant, Membership,
  Role, Permission, RolePermission, MembershipRole, ActivationChallenge, ActivationManualAlias,
  Device PERSONAL, DeviceProfile personal/PIN, Session MOBILE, RefreshCredential, AuditEvent MVP e
  IdempotencyRecord, con índices/constraints tenant-scoped y de aislamiento A/B.
- **Web pairing — `prisma/migrations/0002_web_pairing/migration.sql`**: WebPairingChallenge,
  approval/polling hashes, browser binding, consumo/TTL y relación Session WEB.
- **Support — `prisma/migrations/0003_support_access/migration.sql`**: SupportCase, SupportGrant,
  scopes, aprobador, TTL máximo de una hora, revocación y auditoría asociada.
- **Biometric/shared — `prisma/migrations/0004_biometric_shared_devices/migration.sql`**: cambios
  exclusivos para credenciales biométricas/dispositivo y Device TENANT_SHARED con perfiles aislados.

El modelo lógico completo no implica que las migraciones 0002–0004 formen parte del gate MVP.
