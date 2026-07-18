# Validación OpenAPI del gate MVP

Fecha de ejecución: 2026-07-17 (America/Lima).

## Alcance

Se validó únicamente el subconjunto MVP de `contracts/openapi.yaml` y su
snapshot generado en `packages/api-contract/src/generated/schema.snapshot.json`:

- Tenants técnicos: `createTenantWithFirstOwner`, `getTechnicalTenantSummary`, `changeTenantStatus`.
- Membership: `listCurrentTenantMembers`, `createMembership`, `getCurrentTenantMember`,
  `replaceMembershipRoles`, `changeMembershipStatus`.
- Activación y dispositivo personal: `issueActivationChallenge`, `listMemberDevices`,
  `revokeMemberDevice`, `activateDeviceProfile`.
- PIN y sesiones móviles: `setupPin`, `unlockWithPin`, `rotateRefreshToken`,
  `logoutCurrentSession`.
- Contexto: `getMyIdentity`, `listMyActiveMemberships`, `selectActiveTenant`.
- Dispositivos personales y auditoría: `listMyDevices`, `revokeMyDevice`,
  `listCurrentTenantAuditEvents`.

La prueba exige exactamente este allowlist de 22 `operationId`, método y ruta,
parámetros/header, presencia y obligatoriedad del request body, códigos de
respuesta y campos one-time de activación/sesión. También comprueba que el
contrato fuente contiene las mismas operaciones.

## Ejecución real

```text
corepack pnpm exec vitest run apps/api/test/contract/mvp-openapi-conformance.spec.ts packages/api-contract/test/generated-client.spec.ts --pool=threads --maxWorkers=1
```

Resultado observado:

- `apps/api/test/contract/mvp-openapi-conformance.spec.ts`: 25/25.
- `packages/api-contract/test/generated-client.spec.ts`: 9/9.
- Total de esta ejecución: 34/34, 2 archivos aprobados.
- Código de salida: 0.

La conformance MVP excluye explícitamente las operaciones diferidas de soporte,
pairing web, biometría y `TENANT_SHARED`. No se afirma conformidad de esas
operaciones ni se regeneró el cliente durante esta validación.
