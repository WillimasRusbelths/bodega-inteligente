# Resultados reales del quickstart MVP

Fecha de ejecución: 2026-07-17 (America/Lima). Las suites de persistencia e
integración se ejecutaron contra PostgreSQL local `bodegia_test` en
`localhost:5432`, con el esquema de la migración MVP ya aplicado. Se usaron
datos sintéticos y ejecución serial (`--pool=threads --maxWorkers=1`).

## Escenarios ejecutados

| Quickstart                                  | Suites ejecutadas                                                                                                                                                                                 |    Resultado real |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------: |
| 1. Bootstrap de tenant y primer propietario | `tenant-bootstrap.spec.ts`, `mvp-transaction-boundaries.spec.ts`                                                                                                                                  | 2 archivos, 24/24 |
| 2. Activación presencial y PIN              | `activation-consumption.spec.ts`, `activation-secrets.spec.ts`, `activation-rate-limit.spec.ts`, `phone-binding.spec.ts`, `personal-device.spec.ts`, `pin-hashing.spec.ts`, `pin-lockout.spec.ts` | 7 archivos, 74/74 |
| 4. PIN y bloqueo (sin pasos posteriores)    | Cubierto por la ejecución del escenario 2: `pin-hashing.spec.ts`, `pin-lockout.spec.ts`                                                                                                           | Incluido en 74/74 |
| 5. Sesión, refresh y revocación inmediata   | `session.contract.spec.ts`, `refresh-reuse.spec.ts`, `immediate-revocation.spec.ts`, `mvp-revocation-regression.spec.ts`                                                                          | 4 archivos, 55/55 |
| 6. Selección y contexto de tenant           | `active-tenant.contract.spec.ts`, `tenant-guard.spec.ts`, `tenant-aware-repositories.spec.ts`                                                                                                     | 3 archivos, 33/33 |
| 7. Aislamiento A/B y anti-enumeración       | `tenant-isolation.spec.ts`, `cross-tenant-enumeration.spec.ts`, `cross-tenant-constraints.spec.ts`                                                                                                |   3 archivos, 8/8 |
| 8. Roles, concurrencia y último propietario | `membership-management.contract.spec.ts`, `membership-lifecycle.spec.ts`, `last-owner-concurrency.spec.ts`, `mvp-concurrency.spec.ts`, `catalog.spec.ts`                                          | 5 archivos, 41/41 |
| 10. Auditoría inmutable                     | `audit-transaction.spec.ts`, `audit-append-only.spec.ts`, `audit-privacy.spec.ts`                                                                                                                 | 3 archivos, 19/19 |

Las ejecuciones anteriores suman 254 aserciones reportadas; no se agregan
resultados de suites no listadas ni se presentan como mediciones de usuarios.

## Comandos representativos

Cada fila se ejecutó con `corepack pnpm exec vitest run` sobre las rutas
indicadas, `--pool=threads --maxWorkers=1`, y terminó con código 0. Además, la
validación OpenAPI se registró por separado en
`mvp-openapi-validation.md`.

## Escenarios no ejecutados

- Scenario 3 (pairing web), Scenario 9 (dispositivo compartido) y Scenario 11
  (soporte) pertenecen a incrementos posteriores y no se ejecutaron.
- Los pasos biométricos del Scenario 4 no se ejecutaron; el gate MVP validado
  aquí usa PIN y dispositivo personal.
- SC-006 y SC-007 no se midieron: requieren participantes reales y están
  definidos únicamente en el protocolo T148.
