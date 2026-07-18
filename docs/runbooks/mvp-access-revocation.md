# Runbook del gate MVP: revocación y recuperación presencial

## Alcance

Este runbook cubre únicamente acceso móvil MVP con dispositivo personal,
PIN, pertenencias, sesiones móviles, selección de tenant y auditoría. No cubre
funcionalidad posterior ni acceso comercial.

La API es la única autoridad. Móvil y web consumen REST/OpenAPI; Prisma es la
vía ordinaria de acceso a PostgreSQL. Ningún cliente consulta PostgreSQL.

## Precondiciones operativas

1. Ejecutar solo contra un ambiente no productivo con credenciales sintéticas.
2. Confirmar que la migración `0001_identity_access_mvp` está aplicada y que
   `DATABASE_URL` apunta a la base de pruebas autorizada.
3. Confirmar que el actor tiene una sesión vigente, `TenantContext` válido y el
   permiso requerido para la operación.
4. Registrar un `correlationId` por solicitud y no copiar PIN, códigos, tokens,
   secretos, pepper o teléfonos crudos en notas operativas.

## Cadena de autorización

Cada request protegido debe revalidar, en este orden: identidad, `Session`,
`authVersion`, `Tenant`, `Membership` activa, `DeviceProfile` y permiso
derivado de roles. El tenant enviado por el cliente es solo una solicitud; el
backend lo deriva de la pertenencia autorizada. Un estado revocado debe fallar
en la siguiente operación aunque el access token aún no haya expirado.

## Revocar una pertenencia

1. El propietario administrador selecciona la pertenencia dentro del tenant
   activo y envía el motivo obligatorio junto con `If-Match`.
2. El servicio valida permiso, versión optimista y la regla de continuidad del
   último propietario antes de mutar.
3. En una única transacción se cambia el estado a inactivo, se conservan actor,
   fecha y motivo, y se revocan las sesiones, credenciales de refresh y perfiles
   afectados según el modelo MVP.
4. La misma transacción inserta un `AuditEvent` append-only sanitizado. Si la
   auditoría falla, se revierte todo el cambio.
5. Verificar con una nueva solicitud protegida que el resultado sea un error
   seguro (`SESSION_INVALID`, `FORBIDDEN` o equivalente anti-enumeración) y que
   no se exponga la existencia de recursos ajenos.
6. Consultar la auditoría con un propietario autorizado y comprobar que la
   historia de la pertenencia permanece disponible.

## Revocar un dispositivo personal

1. Confirmar que el actor administra la pertenencia y que el `deviceProfileId`
   pertenece al tenant activo.
2. Revocar el perfil y sus credenciales en una transacción tenant-scoped; no
   aceptar un identificador de otro tenant ni una relación anidada cruzada.
3. Revocar la sesión y la familia de refresh asociadas, registrar el motivo y
   escribir el evento de auditoría sanitizado.
4. Probar que el access token anterior falla en la siguiente operación y que el
   perfil revocado no puede volver a iniciar sesión.

## Desactivar una cuenta o una bodega

- La desactivación de una cuenta o tenant debe pasar por la autorización técnica
  correspondiente, conservar la historia y revocar las sesiones afectadas.
- Antes de cerrar la transacción se registra el motivo requerido y se crea el
  evento de auditoría; no se eliminan filas históricas.
- El guard vuelve a consultar el estado en cada request. No se usa la mera
  expiración del JWT como control de revocación.

## Recuperación presencial por pérdida o cambio de celular

1. El propietario verifica la pertenencia y revoca primero el dispositivo
   anterior. No se migra una sesión, un PIN ni un refresh token al equipo nuevo.
2. El propietario emite un nuevo `ActivationChallenge` para esa pertenencia y
   propósito. El QR representa un secreto opaco aleatorio; no contiene nombre,
   teléfono, `tenantId` ni PII legible.
3. Como alternativa, entrega el alias manual temporal de ocho dígitos. El
   alias es un identificador server-side del mismo challenge, expira a los 15
   minutos, admite como máximo cinco intentos y se vincula al teléfono
   normalizado mediante su binding autorizado.
4. QR y alias se consumen una sola vez. En PostgreSQL solo quedan hashes,
   versiones y metadatos técnicos mínimos; los valores crudos se entregan
   únicamente en la respuesta inicial autorizada y nunca se registran.
5. El nuevo celular consume el challenge, crea un único `Device` personal y su
   `DeviceProfile` pendiente de PIN. Un consumo concurrente perdedor no crea
   filas parciales.
6. El trabajador configura un PIN personal de seis dígitos. El PIN se almacena
   únicamente como hash con salt y pepper externo/versionado.
7. El primer login crea una sesión móvil con expiración absoluta de ocho horas.
   La selección de tenant recalcula pertenencia, roles y permisos sin extender
   esa expiración.
8. Verificar la auditoría de revocación, emisión, consumo y configuración sin
   secretos ni teléfono crudo.

## Respuesta ante fallos

- Ante `STALE_STATE`, repetir solo después de consultar el estado vigente; no
  sobrescribir cambios concurrentes.
- Ante un fallo de auditoría o persistencia, tratar la operación como fallida y
  comprobar rollback completo.
- Ante credenciales inválidas, recurso ajeno o inexistente, devolver el error
  seguro definido por el catálogo y conservar el `correlationId` sin datos
  internos.
- Si el equipo anterior reaparece después de la recuperación, mantenerlo
  revocado hasta una activación presencial explícita.

## Checklist de cierre

- [ ] Motivo y actor verificados.
- [ ] Regla de último propietario verificada.
- [ ] Sesiones y refresh revocados.
- [ ] Próxima operación protegida rechazada cuando corresponde.
- [ ] Auditoría append-only creada y sanitizada.
- [ ] Historia consultable por un actor autorizado.
- [ ] No se registraron secretos, PIN, tokens ni teléfonos crudos.
- [ ] No se modificó producción ni se generó una migración.
