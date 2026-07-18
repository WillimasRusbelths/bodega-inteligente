# Preparación E2E del gate MVP (T131, T132, T141)

Fecha de revisión: 2026-07-18.

## Estado verificable

Se inspeccionó el monorepo antes de crear los artefactos:

- `apps/mobile` contiene máquinas de estado y pruebas Vitest, pero no un
  runtime Expo/React Native renderizable ni el directorio E2E previo.
- `apps/web` contiene clientes/máquinas de estado y pruebas Vitest, pero no una
  aplicación Vite ejecutable, servidor HTTP, `playwright.config.*` ni
  `@playwright/test`.
- `maestro` no está disponible en el PATH.
- El comando `playwright` disponible en el entorno es el CLI de Python y no
  ofrece el subcomando `playwright test` requerido por el script del proyecto.

Por estas razones no se inventan selectores, credenciales, endpoints,
emuladores, usuarios ni resultados de E2E. El YAML móvil deja documentado el
recorrido y sus prerrequisitos; el archivo web deja documentados los escenarios
que deben implementarse con `testID` publicados por la UI.

## Workflow

`.github/workflows/mvp-e2e.yml` prepara Node 22 y pnpm con lockfile, comprueba
el formato/estructura del YAML, bloquea marcadores de ejecución de incrementos
posteriores y detecta asignaciones literales de secretos. Después ejecuta
`corepack pnpm test:e2e:web` sin convertir la ausencia del runtime en un éxito.
No inicia emulador Android, no ejecuta pairing web, biometría ni dispositivo
compartido.

## Resultado de validación local

La existencia del runtime se verificó con `Get-Command`: no se encontró
`maestro`; tampoco hay `@playwright/test` ni configuración/servidor web. Por
ello T132 y la ejecución de T141 permanecen bloqueadas hasta que el runtime
aprobado exista. T131 queda como preparación documental permitida por la
especificación, pero no tiene una ejecución Maestro verificable todavía.

Comandos ejecutados y resultados observados:

| Comando                                                        | Resultado                                                                                                |
| -------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `corepack pnpm lint`                                           | Verde                                                                                                    |
| `corepack pnpm format:check`                                   | Verde                                                                                                    |
| `corepack pnpm exec prettier --check` sobre los artefactos E2E | Verde                                                                                                    |
| `corepack pnpm typecheck`                                      | Verde                                                                                                    |
| `corepack pnpm test` con la URL de la base local autorizada    | Verde: 2 suites de configuración y 11 suites de seguridad, 109 pruebas aprobadas                         |
| `corepack pnpm --filter @bodegia/web test`                     | Verde: 7 pruebas                                                                                         |
| `corepack pnpm --filter @bodegia/mobile test`                  | Verde: 6 pruebas                                                                                         |
| `corepack pnpm test:e2e:web`                                   | Bloqueado: el ejecutable `playwright` disponible es el CLI de Python y responde `unknown command 'test'` |

No se registran resultados Maestro ni Playwright porque no hubo una ejecución
válida de esas herramientas.

T133, T135, T136, T137, T142, T149 y T150 no fueron implementadas ni
ejecutadas en este bloque. T134 no fue modificada; su prueba existente se
ejecutó incidentalmente porque el script obligatorio `corepack pnpm test` la
incluye, y pasó contra la base local autorizada.
