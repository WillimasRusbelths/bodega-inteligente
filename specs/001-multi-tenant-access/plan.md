# Implementation Plan: Base multi-bodega, identidad y acceso

**Branch**: `001-multi-tenant-access` | **Date**: 2026-07-15 | **Spec**: [spec.md](spec.md)

**Input**: Especificación activa y decisiones aprobadas para identidad, autenticación, pertenencias,
roles, permisos, sesiones, dispositivos, soporte y auditoría.

## Summary

Construir una base de identidad global con autorización estrictamente derivada de la pertenencia a
cada bodega. Móvil y web consumirán una API REST NestJS; Prisma será la única vía ordinaria hacia
PostgreSQL. Las sesiones serán revocables, ligadas a perfiles de dispositivo y a un contexto de tenant
activo. El backend volverá a validar cuenta, bodega, pertenencia y permiso en cada operación protegida.
La auditoría append-only participará en la misma transacción que los cambios sensibles.

## Technical Context

**Language/Version**: TypeScript estricto sobre Node.js 22 LTS; versiones exactas de paquetes se fijan
al inicializar el monorepo, sin alterar las decisiones de este plan.

**Primary Dependencies**: NestJS, Prisma, React, Vite, React Native, Expo, Expo LocalAuthentication,
Expo SecureStore y generación OpenAPI de NestJS.

**Storage**: PostgreSQL administrado en Supabase mediante Prisma; Keychain/Keystore mediante
SecureStore para credenciales locales. Ningún cliente accede directamente a PostgreSQL.

**Testing**: Jest o Vitest para unidades, Jest + Supertest con PostgreSQL real aislado para
integración, Playwright para web, Maestro para móvil y k6 para rendimiento.

**Target Platform**: API Node.js; web moderna responsive; Android/iOS compatibles con la versión de
Expo que se fije durante la inicialización. La compatibilidad biométrica real se valida en dispositivos.

**Project Type**: Monorepo TypeScript con aplicación móvil, aplicación web, API REST y paquetes
compartidos de contratos, autorización, configuración y pruebas.

**Performance Goals**: p95 menor a 300 ms para autorización y lecturas de contexto, excluyendo
latencia de red del dispositivo; revocación efectiva en la siguiente operación; 100% de consumos
concurrentes de un código temporal producen un solo ganador.

**Constraints**: Sesiones máximas de 8 horas; bloqueo local tras 30 minutos; bloqueo server-side de
15 minutos tras 5 PIN erróneos; soporte excepcional máximo de 1 hora; respuestas anti-enumeración;
sin modo offline, SMS, correo, implementación comercial de ventas o inventario.

**Scale/Scope**: Piloto con una bodega y cuatro usuarios internos, diseñado desde el inicio para
múltiples bodegas. Esta fase cubre ocho historias y los requisitos FR-001…FR-040,
y los recorridos de identidad
y acceso; no crea funciones operativas de ventas o inventario.

**Usability evidence**: SC-006 usa los cuatro usuarios internos (dos propietarios y dos trabajadores)
y calcula `éxitos / 4 * 100`; el umbral `>=90%` exige 4/4. SC-007 usa solo los dos propietarios y
calcula `éxitos / 2 * 100`; el mismo umbral exige 2/2. Se emplean códigos anónimos, consentimiento,
ambiente controlado y cronometraje individual. El protocolo se prepara antes, pero los resultados no
se completan ni infieren hasta ejecutar la prueba real.

## Constitution Check

*GATE: evaluado antes de Phase 0 y nuevamente después del diseño de Phase 1.*

- **Specification and traceability — PASS**: HU-001…HU-008 y FR-001…FR-040 se trazan en el contrato,
  modelo, flujos y matriz de pruebas. Las tareas futuras deberán conservar esos identificadores.
- **Multi-tenant isolation — PASS**: pertenencias, dispositivos, sesiones, soporte y auditoría llevan
  límites explícitos; guards, repositorios tenant-aware, restricciones compuestas y pruebas A/B los
  refuerzan.
- **Decoupled architecture — PASS**: móvil y web solo consumen REST/OpenAPI; las reglas autoritativas
  residen en API/dominio y los clientes comparten tipos generados, no reglas de negocio.
- **Security and privacy — PASS**: secretos se hashean o guardan en almacenes del SO; BodegIA no
  conserva biometría; se minimizan metadatos de dispositivo y se separan ambientes.
- **Data integrity — PASS**: alta tenant-propietario, activación, revocación y cambios sensibles son
  transaccionales; versión optimista y serialización protegen concurrencia; no aplica FEFO.
- **Quality gates — PASS**: se planifican unidades, integración, E2E, seguridad, concurrencia,
  aislamiento y k6 con las herramientas constitucionales.
- **MVP discipline — PASS**: se excluyen ventas/inventario completos, BI, OCR, offline, sucursales,
  suscripciones y cualquier complejidad comercial no aprobada.

**Gate Result (pre-research)**: PASS, sin violaciones ni excepciones.

## Architecture

### Componentes y responsabilidades

1. **Identity/Auth** mantiene persona global, teléfono normalizado, PIN hasheado por perfil,
   activaciones, sesiones y rotación/revocación de credenciales.
2. **Tenant Access** resuelve pertenencia, tenant activo, roles combinados y permisos. Ningún rol
   comercial vive globalmente en la persona.
3. **Device Trust** registra dispositivos con identificadores aleatorios, tipo personal/compartido,
   perfiles separados y estado revocable; nunca usa IMEI ni advertising ID.
4. **Support Access** usa casos y concesiones temporales con scopes técnicos allowlist. No crea una
   pertenencia, no impersona al propietario y niega dominios comerciales por defecto.
5. **Audit** agrega eventos inmutables y sanitizados en la transacción de cada cambio sensible.
6. **Clients** implementan experiencia y validación de usabilidad; la API sigue siendo autoritativa.

### Cadena de autorización

Cada request protegido atraviesa: autenticidad de sesión → vigencia de cuenta y dispositivo →
tenant activo de la sesión → vigencia de bodega y pertenencia → permiso resultante de roles →
consulta tenant-scoped. Los identificadores enviados en URL o body nunca sustituyen esta cadena.
Para un recurso ajeno o inexistente se devuelve el mismo `RESOURCE_NOT_FOUND` sin revelar existencia.

### Defensa multi-tenant en profundidad

- `tenantId` obligatorio en toda entidad perteneciente a bodega y claves/relaciones compuestas cuando
  sea viable.
- Repositorios Prisma requieren `TenantContext`; no exponen búsquedas de negocio solo por `id`.
- Guards releen o validan con caché de invalidación fuerte los estados vigentes en cada operación.
- PostgreSQL RLS se evaluará como segunda barrera en un spike; nunca sustituirá filtros, constraints
  ni autorización de aplicación y solo se habilitará si `SET LOCAL` es seguro con el pool usado.
- CI ejecuta una suite negativa con bodegas A/B, IDs manipulados, relaciones anidadas y rutas raw.

## Authentication and Device Flows

### Activación presencial

El propietario crea la pertenencia e invitación. El QR contiene o representa únicamente un secreto
opaco aleatorio de al menos 128 bits; no incluye nombre, teléfono, `tenantId` ni PII legible. Como
alternativa, el propietario entrega un código temporal de ocho dígitos que no representa textualmente
el secreto completo: es un alias asociado server-side al mismo challenge. Se conservan solamente el
hash del secreto QR y el hash del código. Ambos se vinculan a pertenencia y propósito. El teléfono
recibido se normaliza a E.164 y se vincula mediante `phoneBindingHmac = HMAC-SHA-256(E.164)` con una
clave externa a la base y `phoneBindingKeyVersion`; nunca se duplica el E.164 crudo en el challenge.
La comparación usa tiempo constante y la versión guardada, de modo que challenges vigentes sobreviven
a una rotación de clave hasta expirar. Ambos expiran en 15 minutos, comparten un máximo de cinco intentos y permiten un único consumo
atómico. El consumo aplica rate limiting por IP, dispositivo e identificador seudonimizado. El
trabajador envía teléfono normalizado y una de las dos credenciales desde el dispositivo; el backend
valida todos los estados, establece autoritativamente `Device.type = PERSONAL`, rechaza cualquier
campo o valor que intente solicitar `TENANT_SHARED`, vincula el perfil y exige crear el PIN antes de
operar. El request MVP usa un schema exclusivo que no expone el tipo de dispositivo. `TENANT_SHARED`
solo se habilita tras `0004_biometric_shared_devices` mediante un endpoint tenant-scoped posterior,
autorizado para dispositivos administrados por la bodega. Los valores crudos
nunca se registran en logs, auditoría o respuestas posteriores. Los reintentos idempotentes solo
pueden recuperar un resultado sanitizado para el mismo dispositivo.

### PIN y biometría

El PIN de seis dígitos se transmite solo por TLS y se conserva como Argon2id con sal individual,
parámetros versionados y pepper fuera de la base. También se exige la credencial del dispositivo.
La biometría de Expo desbloquea una credencial en Keychain/Keystore; ninguna plantilla biométrica
llega a BodegIA. Cambios biométricos, indisponibilidad o error degradan explícitamente a PIN.

### Sesiones

La sesión server-side tiene expiración absoluta inmutable a 8 horas. Usa access token de 10 minutos
y refresh token opaco, rotatorio, hasheado y con detección de reutilización. La inactividad de 30
minutos bloquea UI y material sensible local, sin extender la expiración absoluta. Cinco PIN fallidos
por perfil-dispositivo bloquean 15 minutos según reloj del servidor; un éxito reinicia el contador.

### Emparejamiento web administrativo

La web crea una solicitud de emparejamiento de un solo uso, con expiración de cinco minutos, y genera
dos secretos opacos independientes de al menos 128 bits, persistidos solo como hashes. El
`approvalSecret` se muestra en el QR y nunca contiene un token de sesión ni el secreto de polling. El
`browserPollingSecret` se devuelve una sola vez al navegador iniciador, queda vinculado al navegador
y se exige junto con `pairingId` para consultar y recoger una única vez el resultado. La comparación
de hashes es en tiempo constante; expiración, rate limit, anti-enumeración e invalidación posterior
impiden polling o reutilización con solo el identificador. El contrato de polling discrimina
`PENDING`, `APPROVED`, `REJECTED` y `EXPIRED`: únicamente `APPROVED` contiene la sesión,
obligatoriamente y una sola vez. Al entregarla, el backend marca internamente `CONSUMED`, registra
`consumedAt` y el navegador receptor e invalida definitivamente el polling secret. Cualquier
reutilización, secreto incorrecto, pairing inexistente/expirado/consumido o navegador distinto recibe
el mismo `404 RESOURCE_NOT_FOUND` con mensaje genérico y `correlationId`; `CONSUMED` nunca es una
respuesta pública. Dos pollings concurrentes producen exactamente un ganador y un 404 genérico. El payload QR usa
`bodegia://pairing/approve?pairingId=<uuid>&secret=<base64url-sin-padding>`; el secreto tiene al menos
128 bits, el payload no contiene PII, polling secret ni token de sesión, y nunca se persiste completo.
Un propietario
administrador abre BodegIA en un celular ya activado, escanea el QR y revisa bodega, navegador,
momento y alcance solicitado. Tras confirmar con PIN o biometría, el backend crea una sesión WEB
independiente vinculada al usuario, navegador/dispositivo, pertenencia y tenant autorizados, con
duración máxima de ocho horas. La web no recibe el PIN ni datos biométricos y el teléfono por sí solo
no autentica. Revocar cuenta, pertenencia o dispositivo invalida también la sesión WEB. Acceder sin
un móvil previamente activado queda fuera del MVP como evolución o recuperación controlada.

El propietario también puede rechazar explícitamente mientras el challenge permanece `PENDING`.
`POST /auth/web-pairings/{pairingId}/reject` exige Bearer móvil, approval secret, DeviceProfile y
Membership activos, y coincidencia con el tenant/contexto revisado. La transición transaccional
`PENDING -> REJECTED` registra instante, usuario, membership, dispositivo, reason code controlado y
AuditEvent sanitizado, invalida el approval secret y nunca crea Session WEB. Repetir el mismo rechazo
es idempotente; `APPROVED`, `REJECTED`, `EXPIRED` o `CONSUMED` no pueden cambiar a `REJECTED`.

### Dispositivos y recuperación

Un dispositivo personal admite un solo perfil activo. Uno compartido debe estar marcado como
administrado por la bodega y admite perfiles independientes, nunca una sesión implícita compartida.
Desactivar pertenencia o dispositivo revoca en una transacción perfiles y familias de sesión. La
pérdida exige revocar el equipo anterior y repetir activación presencial; no se migra el secreto.

### Tenant activo

La sesión comienza sin tenant si existen varias pertenencias. Seleccionar una pertenencia activa
recalcula tenant, roles y permisos, actualiza `activeMembershipId`/`tenantId`, incrementa
`contextVersion` y emite un nuevo access token. El refresh token conserva la misma familia y no rota
solo por seleccionar tenant; la expiración absoluta de ocho horas tampoco se reinicia. Access tokens
anteriores fallan al no coincidir su `contextVersion` con la Session vigente. El cambio se audita. El tenant del cliente
es solo una solicitud de selección; el backend deriva el tenant final desde la pertenencia autorizada.

## Authorization Model

El catálogo fijo inicial contiene `owner_admin`, `seller` e `inventory_manager`. La unión de permisos
de roles combinados se evalúa dentro de una sola pertenencia. `owner_admin` administra miembros,
roles y auditoría de acceso; los permisos futuros de ventas/inventario se reservan por dominio pero
no habilitan esas funciones en esta feature. Solo `owner_admin` concede roles.

La retirada del último propietario usa transacción serializable y bloqueo por tenant antes de contar
propietarios activos. Las actualizaciones de pertenencia usan `version` y `If-Match`; un estado viejo
devuelve `409 STALE_STATE`. Alta de tenant, activación y concesiones sensibles aceptan
`Idempotency-Key`.

## Audit and Support

`AuditEvent` es append-only. Cambios sensibles fallan si no puede persistirse su auditoría. Los
eventos guardan actor real, actor efectivo, tenant aplicable, sesión/dispositivo, acción, objetivo,
resultado, motivo, valores sanitizados y correlación; nunca secretos, polling tokens ni teléfonos
crudos en fallos.

Soporte consulta primero telemetría externa. Un `SupportGrant` aprobado por un propietario activo
concede scopes técnicos allowlist por máximo una hora, ligado a un caso y revocable. Cada request
comprueba vigencia y scope; la expiración se aplica por reloj server aunque falle un job. Toda acción
conserva `supportGrantId` y el administrador técnico real.

## Error Strategy

- `401 SESSION_INVALID`: autenticación ausente, expirada o revocada.
- `403 INSUFFICIENT_PERMISSION`: permiso insuficiente solo después de confirmar contexto propio.
- `404 RESOURCE_NOT_FOUND`: recurso ajeno o inexistente, con cuerpo idéntico.
- `409 STALE_STATE`, `LAST_ACTIVE_OWNER` o `ACTIVATION_ALREADY_USED`: conflictos seguros.
- `423 PROFILE_LOCKED`: solo dentro de un flujo ya autenticado; el inicio público conserva respuesta
  genérica.
- `429 TOO_MANY_REQUESTS`: rate limit por IP y claves HMAC de teléfono/dispositivo.

Todos incluyen solo `code`, mensaje seguro, `correlationId` y errores sintácticos de campo cuando no
sean sensibles. Logs y telemetría excluyen PIN, activación, refresh tokens, approval secrets y
browser polling secrets.

## Test Strategy and Traceability

| Alcance | Evidencia | Trazabilidad principal |
|---|---|---|
| Alta tenant + primer propietario atómica | Supertest/PostgreSQL, rollback y auditoría | HU-001; FR-001…FR-004 |
| Activación, PIN, biometría y sesiones | Jest, Supertest y Maestro | HU-002, HU-004; FR-005…FR-008, FR-031, FR-034…FR-039 |
| Emparejamiento y sesión web | Supertest, Playwright y Maestro | HU-002, HU-003; FR-005…FR-010, FR-018…FR-021, FR-028, FR-030, FR-038 |
| Selección/cambio de tenant | Supertest, Playwright y Maestro | HU-003; FR-008…FR-010, FR-018…FR-020 |
| Roles, continuidad y concurrencia | Jest + carreras reales en PostgreSQL | HU-004…HU-006; FR-013…FR-017, FR-022, FR-032…FR-033 |
| Revocación inmediata | Supertest y E2E con token aún vigente | HU-006; FR-006…FR-007, FR-021, FR-038…FR-039 |
| Aislamiento A/B | Suite negativa lectura/modificación/admin | HU-007; FR-018…FR-020, FR-029; SC-001 |
| Auditoría y soporte | Integración append-only, scopes y expiración | HU-008; FR-023…FR-026, FR-040 |
| Rendimiento | k6 sobre auth, guards y listados | SC-003, metas p95 del plan |

CI ejecuta lint/typecheck, unidades, integración, validación OpenAPI, Playwright, Maestro en el
entorno habilitado y k6 en gate programado. Las pruebas usan datos sintéticos y ambientes separados.

### Delivery gates

- **Gate MVP prioritario**: bootstrap, Membership, QR/código manual, PIN, dispositivo personal,
  sesiones, tenant activo, RBAC, ciclo de pertenencia, último owner, auditoría MVP, suite A/B,
  recorridos mínimos móvil/web y CI asociado. No depende de soporte, pairing web, biometría,
  dispositivos compartidos, rendimiento avanzado ni evidencia final completa.
- **Gate de funcionalidad completa**: se ejecuta después e incorpora biometría, shared device,
  soporte temporal, pairing web de doble secreto, hardening/rendimiento, pruebas de usabilidad con
  participantes, quickstart completo y evidencia FR-001…FR-040/SC-001…SC-010.

### Persistencia por entrega

1. `0001_identity_access_mvp` contiene exclusivamente identidad, tenant, Membership/RBAC, activación,
   dispositivo personal/PIN, sesión móvil/refresh, auditoría MVP e idempotencia.
2. `0002_web_pairing` añade WebPairingChallenge, hashes approval/polling, browser binding y Session WEB.
3. `0003_support_access` añade SupportCase/SupportGrant, scopes, aprobación, TTL y revocación.
4. `0004_biometric_shared_devices` añade únicamente restricciones/credenciales requeridas por
   biometría y Device `TENANT_SHARED` con perfiles aislados.

Solo la primera migración pertenece al gate MVP; las otras se ejecutan con sus incrementos.

## Project Structure

### Documentation (this feature)

```text
specs/001-multi-tenant-access/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
└── contracts/
    └── openapi.yaml
```

### Source Code (target repository structure)

```text
apps/
├── api/                    # NestJS REST, OpenAPI, Prisma access
│   ├── src/modules/{identity,access,devices,support,audit}/
│   └── test/{integration,security,contract}/
├── mobile/                 # Expo/React Native, SecureStore, LocalAuthentication
│   └── src/features/{activation,auth,tenant,devices}/
└── web/                    # React/Vite administrative experience
    └── src/features/{auth,memberships,audit,support}/
packages/
├── api-contract/           # Generated OpenAPI client/types; no business authority
├── authz-catalog/           # Permission identifiers and typed UI capabilities
├── config/                  # Shared lint/TypeScript/test configuration
└── test-fixtures/           # Synthetic tenants A/B and builders
prisma/
├── schema.prisma            # Created only during implementation
└── migrations/              # Not created by this plan
.github/workflows/                 # CI gates created only during implementation
```

**Structure Decision**: monorepo por superficies, con dominio autoritativo en `apps/api` y paquetes
compartidos limitados a contratos, identificadores estables y configuración. No se crean directorios
de producto durante esta fase de planificación.

## Phase 0: Research Results

Las decisiones, racionales y alternativas están en [research.md](research.md). No quedan aclaraciones
bloqueantes; los puntos que requieren spike tienen alternativa segura por defecto.

## Phase 1: Design Results

- Modelo lógico/técnico: [data-model.md](data-model.md).
- Contrato REST/OpenAPI: [contracts/openapi.yaml](contracts/openapi.yaml).
- Guía de validación: [quickstart.md](quickstart.md).

## Post-Design Constitution Check

**Gate Result**: PASS. El diseño conserva tenant extremo a extremo, autorización backend, mínimo
privilegio, transacciones, concurrencia, auditoría, borrado lógico, ambientes separados, pruebas y
documentación. RLS, claves hardware-backed y retención avanzada son hardening futuro y no sustituyen
ningún control obligatorio del MVP.

## Risks and Mitigations

| Riesgo | Mitigación |
|---|---|
| Fuga cross-tenant por consulta sin filtro | TenantContext obligatorio, constraints compuestos, revisión y suite A/B |
| PIN de baja entropía | Argon2id + pepper + dispositivo + rate limit + bloqueo server-side |
| Token robado tras desactivación | Sesión server-side, access token corto y revalidación fail-closed |
| Biometría/backup varía por plataforma | Spike en dispositivos, fallback a PIN y SecureStore no migrable |
| Dos cambios dejan cero propietarios | Serialización, bloqueo por tenant y retry acotado |
| Soporte deriva en superusuario | Grant separado, allowlist, una hora, actor real y auditoría |
| Auditoría filtra secretos o crece sin control | Sanitización, permisos DB append-only y política de retención antes de producción |
| UX compleja para usuarios piloto | Mobile-first, mensajes simples, pruebas guiadas SC-006/SC-007 |

## Pending Technical Decisions (non-blocking for design)

1. Calibrar Argon2id y formalizar custodia/rotación del pepper en el gestor de secretos elegido.
2. Validar `SecureStore.requireAuthentication`, invalidación biométrica y backup en Android/iOS;
   si la garantía no alcanza, usar development build con clave hardware-backed.
3. Aprobar el mecanismo para clasificar un dispositivo compartido y recuperar al último propietario
   que pierde su único dispositivo, sin crear una puerta trasera técnica.
4. Precisar como evolución el acceso web sin dispositivo móvil activado y su recuperación controlada;
   el emparejamiento web aprobado ya está definido como incremento posterior al gate MVP prioritario.
5. Ejecutar un spike posterior al MVP de RLS con Prisma/Supabase y pooling; validar `SET LOCAL` dentro
   de transacciones y ausencia de fuga entre conexiones. Si no es demostrablemente seguro, mantenerlo
   deshabilitado y conservar guards, filtros tenant-aware y constraints como controles obligatorios.
6. Fijar retención/particionado de auditoría y objetivos k6 con mediciones del piloto antes de producción.
7. Documentar después del MVP el catálogo exacto de operaciones sensibles que exigen reautenticación
   reciente, su antigüedad máxima, PIN/biometría permitidos, error seguro y auditoría; completar también
   los scopes diagnósticos permitidos al soporte.

## Complexity Tracking

No existen violaciones constitucionales que requieran justificación.
