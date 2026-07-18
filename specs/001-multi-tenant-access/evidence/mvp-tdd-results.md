# MVP identity and access TDD gate evidence

Verification completed 2026-07-17 21:01 (America/Lima); T119-T124 were green.

## Verification run for T119-T125

The following commands were executed after the local PostgreSQL migration was
already up to date. All exited with code 0:

- `corepack pnpm exec vitest run apps/api/test/unit/mvp-access-regression.spec.ts --pool=threads --maxWorkers=1`: 1 file, 9/9.
- `corepack pnpm exec vitest run apps/api/test/integration/mvp-transaction-boundaries.spec.ts --pool=threads --maxWorkers=1`: 1 file, 6/6; PostgreSQL 16.14, `localhost`, database `bodegia_test`, role `bodegia_test`.
- `corepack pnpm exec vitest run apps/api/test/contract/mvp-openapi-conformance.spec.ts --pool=threads --maxWorkers=1`: 1 file, 25/25.
- `corepack pnpm exec vitest run apps/api/test/integration/mvp-idempotency.spec.ts --pool=threads --maxWorkers=1`: 1 file, 6/6.
- `corepack pnpm exec vitest run apps/api/test/integration/mvp-concurrency.spec.ts --pool=threads --maxWorkers=1`: 1 file, 5/5.
- `corepack pnpm exec vitest run apps/api/test/integration/mvp-revocation-regression.spec.ts --pool=threads --maxWorkers=1`: 1 file, 11/11.
- `corepack pnpm lint`: passed.
- `corepack pnpm format:check`: passed.
- `corepack pnpm typecheck`: passed for all workspaces.
- `corepack pnpm test:config`: 2 files, 14/14.
- `corepack pnpm test:security`: 8 files, 89/89.
- `corepack pnpm test`: configuration and security gates passed (10 files, 103/103).
- `corepack pnpm exec prisma migrate status`: database schema is up to date; exactly one migration is present.

The six task suites total 62 passing tests. T120 was executed against the
real local PostgreSQL instance; no mocks, SQLite, in-memory database,
Supabase, schema update, migration generation, or migration application was
used. T126 and later tasks were not executed.

## Execution environment

- Date: 2026-07-17.
- Repository: `001-multi-tenant-access` working tree; no commit was created by this execution.
- Runtime observed by pnpm: Node.js v24.18.0 and pnpm 10.20.0. The repository remains configured for Node.js 22.x; pnpm emitted the existing engine warning.
- Database: PostgreSQL 16.14 on `localhost:5432`, database `bodegia_test`, role `bodegia_test`, schema `public`.
- Database safety: T120 rejects non-local hosts and any database name other than `bodegia_test`. It truncates only functional test tables before/after cases and does not alter `_prisma_migrations`.
- Migration evidence: direct query of `_prisma_migrations` returned `0001_identity_access_mvp|t|t` (`finished_at` present and `rolled_back_at` absent).
- Prisma: 6.19.0 already installed. `corepack pnpm exec prisma validate` reported `prisma/schema.prisma` valid. No migration was generated or applied during this gate.

The real catalog contained the 15 feature tables `User`, `Tenant`, `Membership`, `Role`, `Permission`, `RolePermission`, `MembershipRole`, `ActivationChallenge`, `ActivationManualAlias`, `Device`, `DeviceProfile`, `Session`, `RefreshCredential`, `AuditEvent` and `IdempotencyRecord`, plus Prisma's `_prisma_migrations` table.

## T119–T124 results

| Suite | Traceability | Actual red evidence | Final result | Exact command | Tests |
|---|---|---|---|---|---:|
| `mvp-access-regression.spec.ts` | FR-005–FR-029, FR-031–FR-039 | N/A — regression gate added over already implemented behavior; no functional red state was observed | GREEN | `corepack pnpm exec vitest run apps/api/test/unit/mvp-access-regression.spec.ts --pool=threads --maxWorkers=1` | 9/9 |
| `mvp-transaction-boundaries.spec.ts` | FR-002, FR-012, FR-021–FR-025, FR-031, FR-033, FR-038; SC-002, SC-004 | N/A — the first real PostgreSQL execution was green | GREEN on PostgreSQL 16.14 | `corepack pnpm exec vitest run apps/api/test/integration/mvp-transaction-boundaries.spec.ts --pool=threads --maxWorkers=1` | 6/6 |
| `mvp-openapi-conformance.spec.ts` | FR-001–FR-029, FR-031–FR-039 | RED observed: 1/25 failed because inline audit query parameters were incorrectly treated as component `$ref` parameters; the contract did not diverge | GREEN after correcting the test parser | `corepack pnpm exec vitest run apps/api/test/contract/mvp-openapi-conformance.spec.ts --pool=threads --maxWorkers=1` | 25/25 |
| `mvp-idempotency.spec.ts` | FR-002, FR-022, FR-031 | RED observed: 1/6 failed because the secret-key regex also matched the approved state name `PENDING_PIN`; no secret was present | GREEN after matching exact sensitive keys | `corepack pnpm exec vitest run apps/api/test/integration/mvp-idempotency.spec.ts --pool=threads --maxWorkers=1` | 6/6 |
| `mvp-concurrency.spec.ts` | FR-022, FR-031, FR-033, FR-036; SC-008 | N/A — first execution was green | GREEN | `corepack pnpm exec vitest run apps/api/test/integration/mvp-concurrency.spec.ts --pool=threads --maxWorkers=1` | 5/5 |
| `mvp-revocation-regression.spec.ts` | FR-006, FR-007, FR-012, FR-017, FR-021, FR-038; SC-003, SC-010 | N/A — first execution was green | GREEN | `corepack pnpm exec vitest run apps/api/test/integration/mvp-revocation-regression.spec.ts --pool=threads --maxWorkers=1` | 11/11 |

The six new suites contain 62 distinct tests, all green. T120 used real PostgreSQL; no mock, SQLite or in-memory database substituted for its persistence assertions.

## Existing MVP regression evidence

These results were produced after adding T119–T124 and are recorded without summing overlapping executions:

| Gate | MVP evidence included | Command | Actual result |
|---|---|---|---:|
| Root configuration and security | environment protection, phone binding, PIN hashes, activation secrets/rate limiting, refresh reuse, audit privacy, log redaction | `corepack pnpm test` | 10 files, 103/103 (14 configuration + 89 security) |
| Unit | Tenant guards plus T119 rules for Membership, TTL, PIN lock, RBAC, sanitization, safe errors, PERSONAL devices, absolute expiry and TenantContext | `corepack pnpm test:unit` | 2 files, 20/20 |
| Integration | bootstrap, activation, PIN, devices, sessions/revocation, tenant-aware repositories A/B, membership lifecycle, last owner, audit, T120, idempotency and concurrency | `corepack pnpm test:integration` | 13 files, 122/122 |
| Contract | technical tenant, activation, session, active tenant, membership management and MVP OpenAPI conformance | `corepack pnpm test:contract` | 6 files, 86/86 |

## Requirement evidence summary

- Bootstrap and first owner: `tenant-bootstrap.spec.ts` (18/18) and T120's real PostgreSQL bootstrap case.
- Activation: `activation-consumption.spec.ts` (8/8), activation security suites, T120 real issuance/consumption, T122 replay and T123 concurrency.
- PIN: `pin-lockout.spec.ts` (12/12), `pin-hashing.spec.ts` (18/18), T119 TTL/lock rule and T123 fifth-attempt race.
- Sessions: `session.contract.spec.ts` (17/17), `refresh-reuse.spec.ts` (12/12), `immediate-revocation.spec.ts` (15/15), T123 refresh race and T124 revocation matrix.
- Tenant selection and context: `active-tenant.contract.spec.ts` (13/13), `tenant-guard.spec.ts` (11/11) and T119 TenantContext/contextVersion coverage.
- RBAC and owner continuity: `membership-lifecycle.spec.ts` (8/8), `last-owner-concurrency.spec.ts` (8/8), T120 real role/last-owner assertions and T123 version races.
- Revocation/reactivation: `immediate-revocation.spec.ts` (15/15), `membership-lifecycle.spec.ts` (8/8) and T124 (11/11).
- Audit: `audit-transaction.spec.ts` (6/6), `audit-privacy.spec.ts` (7/7) and T120's real same-transaction/rollback assertions.
- Tenant A/B: `tenant-aware-repositories.spec.ts` (9/9), existing lifecycle isolation cases, and T120's real cross-tenant rejection.

## Gate conclusions

- OpenAPI: 22 MVP operation IDs matched the approved method, route, request-body presence, required parameter/header references and response/error codes. Deferred support, pairing, biometric and `TENANT_SHARED` operations were excluded.
- Idempotency: bootstrap replay, payload conflict, activation issuance replay, consumption replay, single mutation, sanitized stored responses and tenant-separated scopes were green.
- Concurrency: activation, refresh, fifth PIN failure, optimistic role versioning and last-owner withdrawal produced one winner or a safe explicit conflict with no invalid intermediate state.
- PostgreSQL rollback: AuditEvent insertion failure and an independent induced mid-transaction failure both left zero partial business rows.
