# Evidencia de bloqueo de T131–T133 y T135–T137

Fecha de revisión: 2026-07-17.

Estas tareas permanecen sin marcar porque no existe una superficie ejecutable
aprobada para verificarlas. No se simularon ejecuciones ni resultados.

| Tarea | Evidencia inspeccionada | Bloqueo concreto |
| --- | --- | --- |
| T131 | `apps/mobile` solo contiene cliente/máquinas TypeScript y pruebas Vitest; no existe `apps/mobile/e2e`. `Get-Command maestro` no encuentra el ejecutable. | Falta Maestro, runtime móvil/emulador y flujo móvil desplegable para ejecutar el recorrido MVP. |
| T132 | No existe `apps/web/e2e`, `playwright.config.*`, `@playwright/test` ni servidor web ejecutable. El comando `playwright test` disponible corresponde al CLI de Python y no admite ese subcomando. | No hay aplicación web ni runner Playwright compatibles con los selectores/credenciales del contrato. |
| T133 | El plan y las tareas T089–T105/T117–T118 siguen pendientes; el modelo solo define `SessionPlatform.MOBILE` y no hay pairing web implementado. | No existe `WebPairingChallenge`, sesión WEB ni endpoint autorizado que pueda probarse sin inventar funcionalidad. |
| T135 | Biometría/dispositivos compartidos (T046–T051/T111–T112) y su migración posterior siguen pendientes; no hay API de backup/restore ni `LocalAuthentication`. | No puede probarse restauración ni fallo biométrico sin implementar el incremento posterior. |
| T136 | `Get-Command k6` no encuentra k6; no existe `apps/api/test/performance/access.js`; la API no tiene un proceso HTTP/listener ejecutable. | No hay escenario ni target de carga para ejecutar contra el PostgreSQL local sin inventar endpoints. |
| T137 | T136 está bloqueada y no existe una ejecución de carga real. | No se registra p95: la tarea exige valores obtenidos de una ejecución real y no se inventan métricas. |

La única evidencia ejecutable de este bloque es
`apps/api/test/security/mvp-secret-absence.spec.ts` (T134), ejecutada contra
la base local `bodegia_test` con PostgreSQL 16.14.
