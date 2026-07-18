/**
 * T132 — E2E Playwright de administración del MVP.
 *
 * Estado: PREPARACIÓN BLOQUEADA. El monorepo no contiene @playwright/test,
 * playwright.config, una aplicación web ejecutable ni un servidor HTTP de
 * desarrollo. Este archivo no inventa endpoints, credenciales ni selectores.
 * Cuando exista el runtime aprobado, los IDs de esta lista deben mapearse a
 * testIDs publicados por la UI y ejecutarse con:
 *
 *   corepack pnpm test:e2e:web
 *
 * La suite prevista cubre únicamente: sesión de desarrollo controlada, tenant
 * activo, listado y alta de memberships, emisión presencial de una sola vista,
 * cambio de roles con If-Match/ETag, STALE_STATE, protección del último owner,
 * desactivación/reactivación, auditoría paginada y errores seguros sin datos de
 * otro tenant. Pairing web y Session WEB no forman parte de este archivo.
 */
export const mvpAdminE2eScenarioIds = [
  "controlled-development-session",
  "active-tenant-and-member-list",
  "pending-membership-and-one-time-activation",
  "role-change-with-if-match",
  "stale-state-feedback",
  "last-owner-protection",
  "membership-deactivate-reactivate",
  "paginated-audit",
  "safe-errors-and-cross-tenant-absence",
] as const;
