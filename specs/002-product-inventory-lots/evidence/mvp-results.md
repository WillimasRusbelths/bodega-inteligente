# Evidencia del gate MVP

Fecha de cierre documental: 2026-07-19.

Este archivo registra únicamente evidencia verificable. No se declaran métricas de
producción ni resultados de usabilidad o rendimiento sin una ejecución observada.

## Evidencia disponible

- El código del módulo contiene persistencia, endpoints, FEFO, alertas y clientes
  web/móvil tenant-scoped.
- Las suites existentes de contrato, integración, persistencia y seguridad están
  referenciadas en `tasks.md` y en los workflows del repositorio.
- La ejecución completa local depende de `DATABASE_URL` PostgreSQL de pruebas;
  cuando esa variable no está disponible, las suites que requieren Prisma se
  consideran bloqueadas y no se convierten en resultados verdes.

## Validaciones de cierre

| Comando                                | Resultado observado  | Nota                                                                                                                                                             |
| -------------------------------------- | -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `corepack pnpm lint`                   | Verde                | Ejecutado después de los cambios de cierre.                                                                                                                      |
| `corepack pnpm format:check`           | Verde                | Ejecutado después de formatear las superficies móviles existentes.                                                                                               |
| `corepack pnpm typecheck`              | Verde                | Los 7 workspaces comprobados finalizaron correctamente.                                                                                                          |
| `corepack pnpm test:unit`              | Verde                | 8 suites, 33 pruebas aprobadas.                                                                                                                                  |
| `corepack pnpm test:contract`          | Verde                | 11 suites, 101 pruebas aprobadas.                                                                                                                                |
| `corepack pnpm test:config`            | Verde                | Ejecución real reportada para el cierre; no se agregan conteos no proporcionados.                                                                                |
| `corepack pnpm test:security`          | Verde                | Ejecución real reportada para el cierre; no se agregan conteos no proporcionados.                                                                                |
| Generación de contrato compartido      | Verde                | `corepack pnpm --filter @bodegia/api-contract generate` completó 22 operaciones.                                                                                 |
| Pruebas específicas disponibles 002    | Verde                | Ejecución real reportada; las suites disponibles pasaron sin modificar sus aserciones.                                                                           |
| `vitest run apps/api/test/persistence` | Bloqueado localmente | 5 suites verdes, 9 pruebas omitidas; 3 suites requieren `DATABASE_URL` PostgreSQL local.                                                                         |
| `corepack pnpm test`                   | Bloqueado localmente | La ejecución local agotó el tiempo disponible; las suites completas requieren `DATABASE_URL` PostgreSQL local y el entorno sandbox puede producir `spawn EPERM`. |

Los workflows `quality.yml`, `security-tests.yml`, `mvp-api-tests.yml` y
`performance.yml` fueron inspeccionados: generan Prisma Client; los gates con
PostgreSQL aplican las migraciones comprometidas y ejecutan únicamente suites
existentes. No fue necesario modificarlos en este bloque.

T085 permanece pendiente porque este registro no contiene evidencia verificable
de la regresión completa 001 contra PostgreSQL (persistencia, integración y E2E).
T086 permanece pendiente porque no se han registrado métricas observadas para
SC-001…SC-010 ni una ejecución completa del quickstart. T088 permanece pendiente
porque requiere sesiones controladas con usuarios y resultados observados.
La usabilidad y el rendimiento continúan sin resultados inventados.
