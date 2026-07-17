const tenantContextBrand: unique symbol = Symbol("TenantContext");

export interface AuthorizedTenantContextInput {
  readonly sessionId: string;
  readonly userId: string;
  readonly tenantId: string;
  readonly membershipId: string;
  readonly contextVersion: number;
  readonly roles: readonly string[];
  readonly permissions: readonly string[];
}

export interface TenantContext {
  readonly sessionId: string;
  readonly userId: string;
  readonly tenantId: string;
  readonly membershipId: string;
  readonly contextVersion: number;
  readonly roles: readonly string[];
  readonly permissions: readonly string[];
  readonly [tenantContextBrand]: true;
}

function nonEmpty(value: string): boolean {
  return value.trim().length > 0;
}

/**
 * Server-side authorization boundary. API clients cannot manufacture the
 * branded result because the brand is module-private and absent from DTOs.
 */
export function createTenantContextFromAuthorization(
  input: AuthorizedTenantContextInput,
): TenantContext {
  if (
    !nonEmpty(input.sessionId) ||
    !nonEmpty(input.userId) ||
    !nonEmpty(input.tenantId) ||
    !nonEmpty(input.membershipId) ||
    !Number.isSafeInteger(input.contextVersion) ||
    input.contextVersion < 1
  ) {
    throw new Error("The authorized tenant context is invalid.");
  }
  const roles = Object.freeze([...new Set(input.roles)]);
  const permissions = Object.freeze([...new Set(input.permissions)]);
  return Object.freeze({
    sessionId: input.sessionId,
    userId: input.userId,
    tenantId: input.tenantId,
    membershipId: input.membershipId,
    contextVersion: input.contextVersion,
    roles,
    permissions,
    [tenantContextBrand]: true as const,
  });
}

export function isTenantContext(value: unknown): value is TenantContext {
  return (
    value !== null &&
    typeof value === "object" &&
    tenantContextBrand in value &&
    value[tenantContextBrand] === true &&
    Object.isFrozen(value)
  );
}

/** Test-only adapter; production code uses createTenantContextFromAuthorization. */
export function createTenantContextHarness(
  input: AuthorizedTenantContextInput,
): TenantContext {
  return createTenantContextFromAuthorization(input);
}
