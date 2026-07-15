# Phase 0 Research: Identidad y acceso multi-bodega

## Fuentes y precedencia

La especificación activa y la constitución prevalecen sobre preguntas antiguas de `docs/analisis/`.
PA-003, PA-004, PA-005 y el alcance de soporte se consideran resueltos por las aclaraciones del
2026-07-15. Los documentos de análisis aportan actores, procesos, riesgos y vocabulario, pero no
reabren decisiones aprobadas.

## R-001 — Identidad global y autorización por pertenencia

**Decision**: separar `User` global de `Membership` por `(userId, tenantId)`. Roles y permisos viven
en la pertenencia; ninguna identidad global concede acceso comercial.

**Rationale**: una persona puede trabajar en varias bodegas con responsabilidades distintas y la
constitución exige aislamiento y roles por pertenencia.

**Alternatives considered**: rol global en usuario, descartado por escalamiento entre tenants;
cuenta duplicada por bodega, descartada por fragmentar identidad y recuperación.

## R-002 — Tenant activo y cadena de autorización

**Decision**: guardar el contexto activo en una sesión server-side y emitir access token corto con
`sessionId`, `activeMembershipId`, `tenantId` y `contextVersion`. Seleccionar tenant actualiza la
Session, incrementa `contextVersion` y reemplaza solo el access token; el refresh token conserva la
familia y la expiración absoluta no se extiende. Cada request revalida estados y versión
y permiso; el tenant enviado por el cliente nunca es autoritativo.

**Rationale**: permite cambio completo de contexto y revocación inmediata sin confiar en claims
obsoletos.

**Rationale adicional**: separar versión de contexto de la familia refresh invalida inmediatamente
access tokens del tenant anterior sin rotar credenciales de larga duración por una selección normal.

**Alternatives considered**: header `tenantId` libre, descartado por IDOR; JWT autocontenido de ocho
horas, descartado por ventana de revocación; base/esquema por tenant, descartado por complejidad MVP.

## R-003 — Activación presencial

**Decision**: el QR contiene o representa un secreto opaco aleatorio de al menos 128 bits y ninguna
PII legible. El código manual alternativo tiene ocho dígitos y no es la representación textual del
secreto: funciona como alias temporal asociado server-side al challenge. Solo se guardan sus hashes.
Ambos se vinculan a pertenencia, propósito y teléfono normalizado, expiran en 15 minutos, comparten
un máximo de cinco intentos y un único consumo atómico. El consumo aplica rate limiting por IP,
dispositivo e identificador seudonimizado; los valores crudos no llegan a logs, auditoría ni
respuestas posteriores.

El vínculo telefónico se persiste como `phoneBindingHmac = HMAC-SHA-256(E.164)` y
`phoneBindingKeyVersion`, con clave fuera de la base y comparación en tiempo constante. No se duplica
E.164 crudo en challenges o aliases. Nuevos challenges usan la clave actual y los vigentes conservan
su versión hasta expirar; una versión desconocida falla de forma cerrada y los challenges expirados
no se migran. La configuración valida fail-fast clave y versión por ambiente y prohíbe persistirlas o
registrarlas. La activación MVP no recibe un tipo de dispositivo: el backend crea siempre `PERSONAL`
y rechaza campos extra como `TENANT_SHARED`. Este último se habilita exclusivamente después de
`0004_biometric_shared_devices` mediante una operación administrativa tenant-scoped separada. El
teléfono autorizado de `User` permanece como fuente de identidad.

**Rationale**: evita replay, doble consumo, filtración de datos en el QR y dependencia de mensajería.

**Alternatives considered**: usar el código numérico como secreto completo, rechazado por entropía;
QR con PII autocontenida, rechazado por privacidad; SMS/correo y activación offline, fuera del MVP.

## R-004 — Protección del PIN

**Decision**: PIN por perfil-dispositivo, enviado solo por TLS y persistido como Argon2id con sal
individual, parámetros versionados y pepper externo. Autenticar exige también credencial del
dispositivo. Cinco fallos atómicos causan bloqueo server-side de 15 minutos.

**Rationale**: seis dígitos tienen baja entropía; hash lento, segundo factor de contexto, rate limit y
bloqueo reducen el riesgo. El reloj server evita evasión local.

**Alternatives considered**: PIN en texto o hash rápido, rechazados; PIN global, rechazado por
reutilización; contador solo local, rechazado por manipulación/reinstalación.

## R-005 — Biometría

**Decision**: Expo LocalAuthentication solo autoriza al Keychain/Keystore a liberar una credencial
guardada con SecureStore. BodegIA no recibe plantillas. Cambio de matrícula o fallo exige PIN.

**Rationale**: delega captura/comparación al SO, limita datos biométricos y no convierte biometría en
identidad portable.

**Alternatives considered**: persistir huella/rostro, prohibido; AsyncStorage, rechazado; biometría
como prueba independiente al servidor, descartada.

## R-006 — Sesiones revocables

**Decision**: sesión server-side por familia, access token de 10 minutos y refresh token opaco
rotatorio hasheado con detección de reutilización. Expiración absoluta a ocho horas; bloqueo local a
treinta minutos sin extenderla.

**Rationale**: limita el valor de un token robado y permite revocar inmediatamente pertenencias,
dispositivos o familias completas.

**Alternatives considered**: JWT largo, rechazado; sesión deslizante indefinida, incompatible;
revocar siempre tras inactividad, seguro pero innecesariamente costoso para UX.

## R-007 — Modelo de dispositivo

**Decision**: identificador aleatorio generado por la app y metadatos mínimos. Dispositivo personal
admite un perfil activo; compartido, marcado como administrado, admite perfiles aislados con PIN,
contador y sesiones propios. SecureStore no es fuente de verdad.

**Rationale**: preserva privacidad, responsabilidad individual y revocación sin fingerprints
invasivos.

**Alternatives considered**: IMEI/advertising ID, rechazados; perfil implícito compartido, rechazado;
par de claves hardware-backed queda como hardening sujeto a spike Expo.

## R-008 — RBAC fijo por pertenencia

**Decision**: catálogo estable de roles `owner_admin`, `seller`, `inventory_manager` y permisos
atómicos. La unión de roles se calcula solo dentro de una pertenencia; solo propietario modifica
roles.

**Rationale**: hace autorización y pruebas predecibles, preserva mínimo privilegio y evita permisos
configurables arbitrarios en el MVP.

**Alternatives considered**: ACL libre por usuario, descartada por complejidad y auditoría; rol único
exclusivo, descartado porque los actores reales combinan funciones.

## R-009 — Defensa multi-tenant

**Decision**: guards por capas, `TenantContext` obligatorio, repositorios Prisma tenant-aware,
`tenantId` y constraints/relaciones compuestas. Evaluar RLS como barrera secundaria, nunca única.

**Rationale**: ningún control aislado cubre guards omitidos, nested writes, raw SQL o errores de
consulta. Las pruebas A/B validan lectura, escritura y administración.

**Alternatives considered**: middleware Prisma automático como único control, insuficiente; RLS sin
contexto transaccional fiable, riesgoso con pooling.

## R-010 — Concurrencia y continuidad

**Decision**: `Membership.version` + `If-Match` para cambios ordinarios. La protección del último
propietario usa transacción serializable, bloqueo por tenant y retry acotado. Activación y alta usan
idempotencia.

**Rationale**: evita actualizaciones perdidas, doble consumo y carreras que dejan la bodega sin dueño.

**Alternatives considered**: última escritura gana, rechazada; contar propietarios fuera de la
transacción, vulnerable; bloqueo global, innecesariamente restrictivo.

## R-011 — Auditoría inmutable

**Decision**: `AuditEvent` append-only, sin UPDATE/DELETE para el usuario de aplicación. El evento
sanitizado se inserta en la misma transacción del cambio sensible; si falla, falla el cambio.

**Rationale**: garantiza trazabilidad y evita operaciones parcialmente auditadas.

**Alternatives considered**: auditoría asíncrona best-effort, rechazada; hash encadenado/firma
periódica, posible hardening futuro pero no necesario para inmutabilidad operacional MVP.

## R-012 — Acceso de soporte

**Decision**: `SupportCase` y `SupportGrant` separados de membresía. Requiere propietario aprobador,
scopes técnicos allowlist, motivo y expiración <=1 hora. Cada operación revalida grant y actor real.

**Rationale**: atiende incidentes sin crear superusuario, impersonación ni acceso comercial implícito.

**Alternatives considered**: rol global superadmin, impersonación y aprobación posterior, rechazados.

## R-013 — Errores y anti-enumeración

**Decision**: autenticación/activación usan cuerpos y coste comparables; recurso ajeno e inexistente
comparten `404 RESOURCE_NOT_FOUND`. Rate limit combina IP con claves HMAC de teléfono/dispositivo.

**Rationale**: reduce enumeración de usuarios, tenants y recursos sin impedir diagnóstico mediante
`correlationId` y auditoría autorizada.

**Alternatives considered**: mensajes específicos públicos, rechazados; ocultar todo error dentro del
tenant propio, descartado por mala operabilidad.

## R-014 — Contrato y estructura del monorepo

**Decision**: API `/v1` documentada en OpenAPI, UUID opacos, ISO-8601 UTC, cursor, ETag/If-Match e
Idempotency-Key. Monorepo con `apps/api`, `apps/mobile`, `apps/web` y paquetes solo para contratos,
catálogo tipado, configuración y fixtures.

**Rationale**: cumple desacoplamiento y permite resultados equivalentes sin duplicar reglas.

**Alternatives considered**: acceso Supabase directo desde clientes, prohibido por constitución;
duplicar reglas en móvil/web, rechazado; microservicios, complejidad prematura.

## R-015 — Estrategia de pruebas

**Decision**: unidades para matrices/guards/estados; integración Supertest contra PostgreSQL real para
constraints/transacciones; Playwright y Maestro para recorridos; k6 para p95; suite negativa A/B y
carreras concurrentes obligatorias.

**Rationale**: mocks de persistencia no demuestran constraints, aislamiento ni semántica transaccional.

**Alternatives considered**: solo E2E, lento y poco diagnóstico; solo mocks, evidencia insuficiente;
pruebas contra producción, prohibidas.

## R-016 — Emparejamiento web administrativo

**Decision**: la web genera dos secretos opacos independientes de al menos 128 bits, ambos de un solo
uso, TTL máximo de cinco minutos y persistencia exclusiva como hashes. El `approvalSecret` se incluye
en el QR para el móvil activado. El `browserPollingSecret` se devuelve una sola vez al navegador, no
aparece en el QR y se exige con `pairingId` para polling y recogida única de la sesión. La validación
usa comparación en tiempo constante, binding de navegador, rate limit y respuesta anti-enumeración.
El QR se serializa como
`bodegia://pairing/approve?pairingId=<uuid>&secret=<base64url-sin-padding>` y se valida por formato,
UUID y secreto de al menos 22 caracteres base64url; no contiene PII, polling secret ni sesión y no se
persiste completo. El polling usa respuestas públicas discriminadas: solo `APPROVED` porta
obligatoriamente la sesión de entrega única; `PENDING`, `REJECTED` y `EXPIRED` nunca la contienen. La
entrega marca internamente `CONSUMED` e invalida definitivamente el polling secret; toda reutilización
o pairing no disponible recibe el mismo `404 RESOURCE_NOT_FOUND`, sin variante pública `CONSUMED`.
En carreras, una transacción recoge la sesión y las demás reciben el mismo 404 sin revelar el motivo.
El móvil puede rechazar mediante una operación separada autenticada con Bearer y approval secret.
Solo `PENDING` transiciona a `REJECTED`; se revalidan DeviceProfile, Membership, tenant y contexto
mostrado, se guardan IDs del actor y reason code allowlisted, se audita, se invalida el approval
secret y no se crea sesión. El mismo rechazo es idempotente, pero ningún estado terminal distinto
puede sobrescribirse.
Un propietario revisa bodega, navegador, momento y alcance y confirma mediante PIN o biometría. El
backend crea una sesión WEB independiente de máximo ocho horas; revocar cuenta, pertenencia o
dispositivo la invalida. Ningún secreto crudo llega a DB, logs o auditoría.

**Rationale**: separa la capacidad de aprobar de la capacidad de recoger el resultado y evita que
conocer solo `pairingId` o escanear el QR permita robar la sesión del navegador iniciador.

**Alternatives considered**: polling solo con UUID, login solo con teléfono, PIN en web y QR con token
de sesión, rechazados. El acceso sin móvil activado se difiere como recuperación controlada.

## Decisiones sujetas a spike o aprobación antes de producción

No bloquean el diseño porque existe una opción segura por defecto:

1. Calibración Argon2id, proveedor de secretos y rotación del pepper.
2. Semántica real de SecureStore/biometría/backup por plataforma.
3. Clasificación confiable de dispositivo compartido y recuperación del último propietario.
4. Catálogo de operaciones web sensibles que exigirán reautenticación reciente.
5. Compatibilidad RLS con Prisma, Supabase y pool de conexiones.
6. Retención/particionado de auditoría, scopes finales de soporte y umbrales k6 del piloto.

## Evolución expresamente diferida

El registro offline de ventas se especificará aparte. Podrá evaluar almacenamiento local cifrado,
operaciones pendientes, idempotencia y conflictos de inventario; ninguna de esas capacidades se
diseña o implementa en esta feature.
