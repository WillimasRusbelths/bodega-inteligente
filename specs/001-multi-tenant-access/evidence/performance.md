# Evidencia de rendimiento del acceso MVP

Fecha de preparación: 2026-07-18.

## Estado

T136 queda completada a nivel de artefacto en `apps/api/test/performance/access.js`, con escenarios
k6 para login mediante PIN, refresh rotatorio, selección de tenant, cadena de
guards, listado tenant-scoped, revocación, errores anti-enumeración y consulta
autorizada de auditoría.

T142 queda completada: el workflow usa `start:performance`, espera `GET
/health` y conserva los artefactos de k6. T137 permanece **sin marcar**.
No se registran p95, throughput, errores ni
capacidad hasta disponer de una ejecución real de k6. El umbral de referencia
del plan es p95 menor a 300 ms para autorización/lecturas de contexto; no se
considera un SLA productivo.

## Datos y seguridad

El script recibe teléfono, PIN, credencial de dispositivo, UUIDs de
membership/dispositivo y el UUID de membership ajeno únicamente mediante
variables de entorno sintéticas. No contiene credenciales, tokens ni UUIDs
reales y no imprime cuerpos de respuesta.

Las rutas usadas corresponden al contrato OpenAPI vigente:

- `POST /auth/pin/unlock`
- `POST /auth/refresh`
- `PUT /sessions/current/tenant`
- `GET /me`
- `GET /tenants/current/members`
- `DELETE /tenants/current/members/{membershipId}/devices/{deviceProfileId}`
- `GET /tenants/current/audit-events`

La revocación es deliberadamente una operación explícita del escenario y
requiere datos de prueba proporcionados por el ambiente; no se ejecutó aquí.

## Workflow preparado

`.github/workflows/performance.yml` se ejecuta solamente con
`workflow_dispatch`, levanta PostgreSQL 16.14 como servicio de GitHub Actions,
aplica `prisma migrate deploy`, verifica que exista `start:performance` real de
la API, instala k6, ejecuta el script y conserva el resumen k6, el log de API y
este documento como artefactos.

## Bloqueos verificables

- `k6` no está instalado en el entorno local (`Get-Command k6` no devuelve un
  ejecutable), por lo que no se inventó una ejecución ni un resultado T137.
- Antes de este bloque `apps/api/package.json` solo exponía `typecheck` y no
  existía listener HTTP. Ahora existe `start:performance` y `GET /health`; el
  workflow espera ese endpoint antes de ejecutar k6.
- No se conectó Supabase ni se utilizó Docker local.

El valor `DATABASE_URL` local se mantiene como configuración de entorno y no
se persiste en este artefacto. No se modificaron migraciones.

## Validaciones locales

| Comando                                            | Resultado verificable                                                  |
| -------------------------------------------------- | ---------------------------------------------------------------------- |
| `corepack pnpm lint`                               | Verde                                                                  |
| `corepack pnpm format:check`                       | Verde                                                                  |
| Prettier sobre script, workflow y evidencia        | Verde                                                                  |
| `corepack pnpm typecheck`                          | Verde                                                                  |
| `node --check apps/api/test/performance/access.js` | Verde                                                                  |
| `start:performance` + `GET /health`                | Verde: proceso Node 22 respondió 200 en un puerto de prueba            |
| `corepack pnpm test:performance`                   | Bloqueado: `k6` no está instalado                                      |
| `corepack pnpm test`                               | Verde: 2 suites de configuración, 11 suites de seguridad y 109 pruebas |

Estos resultados no constituyen una medición de rendimiento. La evidencia de
T137 solo podrá actualizarse después de una ejecución real de k6 contra una API
iniciada y un dataset sintético autorizado.
