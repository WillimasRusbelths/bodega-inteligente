# Quickstart de validación: Identidad y acceso multi-bodega

Esta guía define cómo validar la futura implementación. No instala dependencias, no crea migraciones
y no presupone que las aplicaciones ya existan. El contrato está en
[contracts/openapi.yaml](contracts/openapi.yaml) y el modelo en [data-model.md](data-model.md).

## Prerequisites

- Monorepo implementado conforme a [plan.md](plan.md).
- Node.js 22 LTS y gestor de paquetes fijado por el repositorio.
- PostgreSQL de pruebas separado de desarrollo y producción.
- Variables de prueba con secretos sintéticos; nunca credenciales productivas.
- Dos tenants sintéticos A/B, dos propietarios y usuarios con combinaciones de roles.
- Emulador o dispositivo Android/iOS compatible para Maestro; navegador para Playwright.
- Biometría mockeada solo en E2E automatizado y validada adicionalmente en dispositivo real.

Los nombres exactos de scripts se fijarán al inicializar el monorepo. Convención esperada:

```text
<package-manager> lint
<package-manager> typecheck
<package-manager> test:unit
<package-manager> test:integration
<package-manager> test:contract
<package-manager> test:e2e:web
<package-manager> test:e2e:mobile
<package-manager> test:security
<package-manager> test:performance
```

## Validation cuts

- **Gate MVP prioritario**: Gate 1 limitado a operaciones MVP; escenarios 1, 2, 4 sin pasos
  biométricos, 5–8 y 10; assertions de secretos/aislamiento/revocación correspondientes. No exige
  pairing web, soporte, biometría, dispositivo compartido ni rendimiento avanzado.
- **Gate de funcionalidad completa**: añade escenario 3, pasos biométricos de escenario 4, dispositivo
  compartido de escenario 9, soporte de escenario 11, rendimiento, hardening y pruebas guiadas reales
  de SC-006/SC-007. Solo este gate ejecuta la guía completa y cierra FR-001…FR-040/SC-001…SC-010.

La validación MVP aplica únicamente `prisma/migrations/0001_identity_access_mvp/migration.sql`.
Las migraciones `0002_web_pairing`, `0003_support_access` y `0004_biometric_shared_devices` se aplican
solo al validar su incremento correspondiente.

## Gate 1 — Static and contract validation

1. Ejecutar lint y TypeScript estricto sin `any` injustificado.
2. Validar `contracts/openapi.yaml` y compararlo con OpenAPI generado por NestJS.
3. Rechazar cambios incompatibles no versionados.
4. Confirmar que schemas de request usan `writeOnly` para entradas secretas y que schemas exclusivos
   de response entregan código/QR, tokens o polling secret únicamente en la respuesta inicial
   autorizada, sin `writeOnly` ni reutilización posterior. PIN, pepper y plantillas biométricas nunca
   se devuelven; ningún secreto crudo aparece en DB, logs o auditoría.

**Expected**: todos los controles pasan y el contrato generado conserva operationIds, errores y
esquemas planificados.

## Scenario 1 — Tenant bootstrap (HU-001)

1. Como administrador técnico, crear Bodega A con primer propietario usando `Idempotency-Key`.
2. Repetir la misma solicitud con la misma clave.
3. Simular fallo de auditoría dentro de la transacción.
4. Consultar el resumen técnico.

**Expected**: existe exactamente un tenant y owner; el retry devuelve el mismo resultado; el fallo
de auditoría revierte todo; el resumen no contiene ventas, clientes, costos ni inventario.

## Scenario 2 — In-person activation and PIN (HU-002, HU-004)

1. El propietario crea una pertenencia con nombre, teléfono E.164 y rol inicial.
2. Emitir un challenge y verificar que el QR representa un secreto opaco aleatorio de al menos 128
   bits sin nombre, teléfono, `tenantId` ni PII legible; comprobar que el código manual alternativo
   tiene exactamente 8 dígitos y no es una representación textual completa del secreto QR.
3. Verificar server-side que ambos hashes apuntan al mismo challenge, pertenencia, propósito y
   `phoneBindingHmac` HMAC-SHA-256 del E.164 y `phoneBindingKeyVersion`, expiran en 15 minutos y
   comparten máximo 5 intentos; comprobar que no existe E.164 crudo en challenge/alias.
4. Activar desde un Device personal con teléfono y, por separado, validar las vías QR y código;
   comprobar que el request no acepta `type`, que el backend crea siempre `PERSONAL` y que enviar
   `type: TENANT_SHARED` produce rechazo sin crear Device ni DeviceProfile.
5. Intentar consumos paralelos por ambas vías desde otro Device y exceder límites por IP, dispositivo
   e identificador seudonimizado.
6. Configurar un PIN de seis dígitos y comprobar que sus valores crudos no aparecen en DB, logs,
   auditoría ni respuestas posteriores.

**Expected**: un solo consumo gana; el perfil queda activo después del PIN; el secreto queda
consumido e invalida ambas vías; los intentos se limitan a cinco y la evidencia registra actores y
resultados sin secretos crudos.

## Scenario 3 — Administrative web pairing (HU-002, HU-003; FR-030)

1. Desde la web, crear una solicitud con `approvalSecret` y `browserPollingSecret` independientes de
   al menos 128 bits; validar que `approvalQrPayload` cumple
   `bodegia://pairing/approve?pairingId=<uuid>&secret=<base64url-sin-padding>`, decodificar UUID y
   secreto de al menos 128 bits, rechazar payload sin secreto, mal formado o con PII, mostrar solo el
   secreto de aprobación como QR y conservar el de polling temporalmente.
2. Escanearlo con BodegIA desde un móvil ya activado del propietario administrador.
3. Comprobar que el móvil muestra bodega, navegador, momento y alcance; confirmar con PIN y repetir
   el recorrido con biometría sin enviar ninguno de esos datos a la web.
4. En un challenge separado, rechazar desde el móvil con reason code controlado; verificar Bearer,
   approval token, DeviceProfile/Membership activos, tenant/contexto coincidente, metadatos y auditoría
   sanitizada, invalidación del approval secret y ausencia de Session WEB. Repetir el mismo rechazo y
   ejecutar una carrera approve/reject: solo un estado terminal puede ganar.
5. Verificar una sesión WEB independiente ligada a usuario, navegador, pertenencia y tenant, con
   expiración absoluta no mayor de 8 horas.
6. Intentar consultar/recoger usando solo `pairingId`, con polling secret incorrecto, otro navegador,
   después de 5 minutos y por encima del rate limit; intentar reutilizar ambos secretos o incluir el
   polling secret/token de sesión en el QR.
7. Validar respuestas públicas discriminadas: `PENDING`, `REJECTED` y `EXPIRED` no contienen
   `session`; el primer polling autorizado tras aprobar obtiene `APPROVED` con sesión obligatoria. Dos
   pollings concurrentes producen un ganador y un 404. Toda reutilización posterior, secreto erróneo,
   pairing inexistente/consumido o navegador distinto devuelve el mismo 404 `RESOURCE_NOT_FOUND`, sin
   sesión ni revelación del estado interno.
8. Revocar, por separado, pertenencia, dispositivo aprobador y cuenta mientras la sesión WEB vive.

**Expected**: el hash de cada secreto se compara con seguridad; solo el navegador vinculado con polling
secret válido recoge una vez la sesión y luego queda invalidado definitivamente. El rechazo no crea
sesión y conserva únicamente metadatos y auditoría sanitizados. La web jamás recibe PIN ni
biometría; los intentos inválidos no autentican; cada revocación invalida la sesión WEB. El acceso sin
móvil previamente activado queda documentado como evolución/recuperación controlada fuera del MVP.

## Scenario 4 — PIN, biometric gate and lockout (HU-002)

1. Iniciar con PIN correcto y comprobar expiración absoluta a ocho horas.
2. Bloquear la app tras treinta minutos simulados y desbloquear con PIN.
3. Habilitar biometría; verificar que el SO libera la credencial y que la API nunca recibe plantilla.
4. Invalidar matrícula biométrica y confirmar fallback explícito a PIN.
5. Enviar cinco PIN incorrectos concurrentes; reintentar antes y después de quince minutos server-side.

**Expected**: bloqueo consistente tras cinco fallos; no se puede evadir cambiando reloj local; las
respuestas públicas no distinguen usuario inexistente, desactivado, PIN incorrecto o bloqueo.

## Scenario 5 — Session rotation and immediate revocation (HU-002, HU-006)

1. Rotar refresh token y reusar el token anterior.
2. Desactivar la pertenencia mientras existe un access token vigente.
3. Intentar una operación inmediatamente después.
4. Reactivar pertenencia sin reactivar Device/Profile previo.

**Expected**: reuse revoca la familia; la siguiente operación tras desactivar falla aunque el token
esté firmado; historia permanece; reactivación exige nuevo challenge presencial.

## Scenario 6 — Active tenant switching (HU-003)

1. Usar un User con Membership en A (`seller`) y B (`inventory_manager`).
2. Iniciar sesión sin tenant activo y listar pertenencias.
3. Seleccionar A; intentar permiso de B.
4. Cambiar a B y reusar el access token/contexto de A.
5. Verificar que la respuesta contiene nuevo access token y `contextVersion`, pero ningún refresh
   token nuevo; refrescar después y comprobar que usa el contexto B sin extender las ocho horas.

**Expected**: antes de seleccionar no hay operación tenant-scoped; cada selección deriva tenant desde
Membership; el contexto anterior queda reemplazado y no mezcla permisos. El access token anterior
falla por versión, el refresh conserva su familia y la expiración absoluta no cambia.

## Scenario 7 — Mandatory A/B isolation suite (HU-007)

Para cada recurso de miembros, roles, dispositivos y auditoría:

1. Con sesión de A, leer/listar/modificar/eliminar usando ID de B.
2. Repetir con UUID inexistente.
3. Manipular path, body, query y relaciones anidadas.
4. Intentar conectar una entidad A con una relación B.
5. Comparar status/body de ID ajeno e inexistente y revisar que no haya cambios ni filtración auditada.

**Expected**: 100% rechazado; ajeno e inexistente producen la misma respuesta segura; cero filas de B
se leen o mutan. Esta suite es gate obligatorio de CI, incluso con una sola bodega piloto.

## Scenario 8 — Roles, concurrency and last owner (HU-005, HU-006)

1. Validar la matriz y combinación de roles dentro de una Membership.
2. Intentar que seller/inventory_manager modifiquen miembros.
3. Enviar dos PATCH con el mismo `If-Match`.
4. Con dos owners, ejecutar retiros concurrentes que intentarían dejar cero propietarios.

**Expected**: solo owner concede roles; un PATCH gana y otro devuelve `STALE_STATE`; nunca quedan cero
owners y la operación rechazada devuelve `LAST_ACTIVE_OWNER` sin perder auditoría.

## Scenario 9 — Personal and shared devices

1. Activar User A en Device personal; intentar mantener User B activo.
2. Cerrar totalmente y activar B mediante nuevo challenge.
3. Marcar un Device como administrado/compartido mediante el flujo aprobado.
4. Activar perfiles A/B con PIN, contador y sesiones independientes.
5. Revocar uno y comprobar que el otro no hereda identidad ni permisos.

**Expected**: personal tiene un perfil activo; compartido mantiene separación individual; revocación
afecta solo el alcance autorizado y nunca crea sesión compartida implícita.

## Scenario 10 — Immutable audit (HU-008)

1. Ejecutar altas, roles, bloqueos, desactivaciones, denegaciones A/B y soporte.
2. Forzar fallo del insert de AuditEvent en una operación sensible.
3. Intentar UPDATE/DELETE con el usuario DB de aplicación.
4. Consultar desde A un evento de B.

**Expected**: evento contiene actor, tenant, sesión/dispositivo, cambios sanitizados y correlación;
fallo revierte el cambio; UPDATE/DELETE es imposible; evento B no se revela.

## Scenario 11 — Temporary support (HU-001, HU-008)

1. Verificar diagnóstico por telemetría externa sin grant.
2. Abrir caso y solicitar grant; intentar aprobar con no-owner.
3. Aprobar con owner por menos de una hora y scope `session.health.read`.
4. Intentar inventario, otro scope y otro tenant.
5. Revocar manualmente y repetir; crear otro grant y simular expiración aunque el job no corra.

**Expected**: no-owner no aprueba; solo funciona scope/tenant vigente; datos comerciales siempre
denegados por defecto; revocación/expiración son inmediatas; acciones incluyen actor y grant reales.

## Security and privacy assertions

- Buscar PIN crudo, código manual crudo, secreto QR crudo, approval secret, browser polling secret,
  access token crudo, refresh token crudo, pepper y plantillas biométricas en base de datos, logs,
  auditoría, trazas, errores y respuestas posteriores a su entrega única autorizada.
- Confirmar que la base solo contiene los hashes autorizados de PIN/código/QR/tokens/challenges,
  salts, identificadores de versión y metadatos técnicos mínimos aprobados; un hash autorizado no se
  considera equivalente ni prueba de presencia del secreto crudo.
- Confirmar rate limit por IP y HMAC de identificador sin almacenar teléfono crudo en fallos.
- Confirmar fail-fast sin clave/versión HMAC, selección de versiones actual y anterior durante el TTL,
  fallo cerrado con versión desconocida, comparación en tiempo constante y ausencia de clave HMAC en
  código, PostgreSQL, logs y auditoría.
- Confirmar secretos de ambientes separados y ausencia de datos productivos en tests.
- Confirmar que SecureStore no migra una sesión utilizable a otro dispositivo/restauración.
- Probar fail-closed ante indisponibilidad de validación de pertenencia o sesión.

**Expected**: ninguna filtración; toda incertidumbre de estado rechaza la operación protegida.

## Guided usability protocol (SC-006 and SC-007)

Preparar antes de observar resultados un instrumento con códigos anónimos, consentimiento y
protección de datos, ambiente controlado, cronometraje individual y definiciones inequívocas de
“ayuda correctiva” y “primer intento”. No completar ni inferir resultados antes de la prueba real.

- **SC-006**: participan los cuatro usuarios internos —dos propietarios y dos trabajadores—. Cada uno
  inicia sesión, selecciona la bodega correcta cuando corresponda, termina en menos de dos minutos y
  no recibe ayuda correctiva. Fórmula: `usuarios exitosos / 4 * 100`; aprobar exige `>= 90%`, que con
  esta muestra equivale a 4/4.
- **SC-007**: participan los dos propietarios. Cada uno incorpora un trabajador, cambia su rol y
  desactiva la pertenencia en el primer intento. Fórmula: `propietarios exitosos / 2 * 100`; aprobar
  exige `>= 90%`, que con esta muestra equivale a 2/2.

El protocolo se prepara en `evidence/usability-protocol.md`; observaciones, tiempos y cálculos reales
se completan únicamente durante la ejecución en `evidence/usability-results.md`.

## Performance validation

Con k6 y dataset sintético multi-tenant:

1. Medir login/PIN, refresh, selección de tenant, guard chain y listados paginados.
2. Verificar p95 <300 ms para autorización/lectura de contexto en el ambiente de referencia.
3. Simular revocación bajo carga y confirmar rechazo en la siguiente operación.
4. Registrar capacidad y errores sin convertir el objetivo inicial en SLA productivo definitivo.

## Evidence checklist

- [ ] Resultados unitarios y typecheck.
- [ ] Integración PostgreSQL, transacciones y concurrencia.
- [ ] Diff/validación OpenAPI.
- [ ] Suite negativa A/B completa.
- [ ] Playwright web y Maestro móvil.
- [ ] Validación biométrica/SecureStore en Android e iOS reales.
- [ ] Reporte k6 y ambiente de referencia.
- [ ] Evidencia de ausencia de secretos y de auditoría append-only.

## Explicit exclusions

No validar aquí ventas, inventario funcional, OCR, BI, ETL, Power BI ni operaciones offline. El
modo offline se abordará mediante una futura especificación de ventas con cifrado local,
idempotencia, sincronización y resolución de conflictos propios.
