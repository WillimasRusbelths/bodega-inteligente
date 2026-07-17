import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";

interface GuardClaims {
  readonly sessionId: string;
  readonly userId: string;
  readonly tenantId: string;
  readonly membershipId: string;
  readonly authVersion: number;
  readonly contextVersion: number;
}

interface GuardState {
  user: {
    id: string;
    status: "ACTIVE" | "DISABLED";
    authVersion: number;
    globalPermissions: string[];
  };
  session: {
    id: string;
    userId: string;
    tenantId: string;
    membershipId: string;
    contextVersion: number;
    revokedAt: Date | null;
  };
  memberships: Array<{
    id: string;
    userId: string;
    tenantId: string;
    status: "ACTIVE" | "DISABLED";
    roles: string[];
    permissions: string[];
  }>;
  tenants: Array<{
    id: string;
    status: "ACTIVE" | "DISABLED";
  }>;
  guardOrder: string[];
}

interface TenantGuardModule {
  createTenantGuardHarness(options: { readonly state: GuardState }): {
    authorize(input: {
      readonly claims: GuardClaims;
      readonly requestedTenantId: string;
      readonly requiredPermission: string;
    }): Promise<{
      readonly tenantId: string;
      readonly membershipId: string;
      readonly roles: readonly string[];
      readonly permissions: readonly string[];
    }>;
  };
}

const guardPath = resolve(
  process.cwd(),
  "apps/api/src/modules/access/guards/tenant-guard-chain.ts",
);

async function loadModule(): Promise<TenantGuardModule> {
  if (!existsSync(guardPath)) {
    throw new Error(
      "[T064] Identity, Session, Membership, Tenant and Permission guards are required by T060.",
    );
  }
  const module = (await import(
    pathToFileURL(guardPath).href
  )) as Partial<TenantGuardModule>;
  if (module.createTenantGuardHarness === undefined) {
    throw new Error(
      "[T064] createTenantGuardHarness export is required by T060.",
    );
  }
  return { createTenantGuardHarness: module.createTenantGuardHarness };
}

const userId = "00000000-0000-4000-8000-000000000011";
const sessionId = "00000000-0000-4000-8000-000000000401";
const tenantA = "00000000-0000-4000-8000-000000000001";
const tenantB = "00000000-0000-4000-8000-000000000002";
const missingTenant = "00000000-0000-4000-8000-000000000099";
const membershipA = "00000000-0000-4000-8000-000000000101";
const permission = "access.memberships.read";

function createState(): GuardState {
  return {
    user: {
      id: userId,
      status: "ACTIVE",
      authVersion: 1,
      globalPermissions: ["dangerous.global.permission"],
    },
    session: {
      id: sessionId,
      userId,
      tenantId: tenantA,
      membershipId: membershipA,
      contextVersion: 2,
      revokedAt: null,
    },
    memberships: [
      {
        id: membershipA,
        userId,
        tenantId: tenantA,
        status: "ACTIVE",
        roles: ["owner_admin"],
        permissions: [permission],
      },
    ],
    tenants: [
      { id: tenantA, status: "ACTIVE" },
      { id: tenantB, status: "ACTIVE" },
    ],
    guardOrder: [],
  };
}

function claims(): GuardClaims {
  return {
    sessionId,
    userId,
    tenantId: tenantA,
    membershipId: membershipA,
    authVersion: 1,
    contextVersion: 2,
  };
}

async function setup(mutate?: (state: GuardState) => void) {
  const state = createState();
  mutate?.(state);
  const guard = (await loadModule()).createTenantGuardHarness({ state });
  return { state, guard };
}

async function authorize(
  mutate?: (state: GuardState) => void,
  input: Partial<{
    claims: GuardClaims;
    requestedTenantId: string;
    requiredPermission: string;
  }> = {},
) {
  const { state, guard } = await setup(mutate);
  const result = guard.authorize({
    claims: input.claims ?? claims(),
    requestedTenantId: input.requestedTenantId ?? tenantA,
    requiredPermission: input.requiredPermission ?? permission,
  });
  return { state, result };
}

async function captureFailure(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  throw new Error("Expected authorization to fail.");
}

describe("tenant guard chain [T060; HU-007; FR-018..FR-020, FR-027, FR-029]", () => {
  it("accepts a valid identity, session, membership, tenant and permission", async () => {
    await expect((await authorize()).result).resolves.toMatchObject({
      tenantId: tenantA,
      membershipId: membershipA,
      roles: ["owner_admin"],
      permissions: [permission],
    });
  });

  it("executes the guards in the approved order", async () => {
    const { state, result } = await authorize();
    await result;
    expect(state.guardOrder).toEqual([
      "identity",
      "session",
      "membership",
      "tenant",
      "permission",
    ]);
  });

  it.each([
    {
      name: "identity",
      mutate: (state: GuardState) => {
        state.user.status = "DISABLED";
      },
    },
    {
      name: "session",
      mutate: (state: GuardState) => {
        state.session.revokedAt = new Date("2026-01-01T00:00:00.000Z");
      },
    },
    {
      name: "membership",
      mutate: (state: GuardState) => {
        const membership = state.memberships[0];
        if (membership !== undefined) membership.status = "DISABLED";
      },
    },
    {
      name: "tenant",
      mutate: (state: GuardState) => {
        const tenant = state.tenants[0];
        if (tenant !== undefined) tenant.status = "DISABLED";
      },
    },
  ])("rejects when $name is inactive", async ({ mutate }) => {
    await expect((await authorize(mutate)).result).rejects.toBeDefined();
  });

  it("rejects a missing membership permission", async () => {
    await expect(
      (
        await authorize((state) => {
          const membership = state.memberships[0];
          if (membership !== undefined) membership.permissions = [];
        })
      ).result,
    ).rejects.toMatchObject({ code: "INSUFFICIENT_PERMISSION" });
  });

  it("accepts only the tenant derived from the active membership", async () => {
    await expect(
      (await authorize(undefined, { requestedTenantId: tenantB })).result,
    ).rejects.toMatchObject({ code: "RESOURCE_NOT_FOUND" });
  });

  it("rejects stale contextVersion", async () => {
    await expect(
      (
        await authorize(undefined, {
          claims: { ...claims(), contextVersion: 1 },
        })
      ).result,
    ).rejects.toMatchObject({ code: "SESSION_INVALID" });
  });

  it("uses equivalent anti-enumeration errors for foreign and missing tenants", async () => {
    const foreign = await captureFailure(
      (await authorize(undefined, { requestedTenantId: tenantB })).result,
    );
    const missing = await captureFailure(
      (await authorize(undefined, { requestedTenantId: missingTenant })).result,
    );
    expect(JSON.stringify(foreign)).toBe(JSON.stringify(missing));
    expect(JSON.stringify([foreign, missing])).not.toMatch(
      /tenantId|membership|roles|ACTIVE|DISABLED/iu,
    );
  });

  it("does not honor permissions attached globally to User", async () => {
    await expect(
      (
        await authorize(undefined, {
          requiredPermission: "dangerous.global.permission",
        })
      ).result,
    ).rejects.toMatchObject({ code: "INSUFFICIENT_PERMISSION" });
  });
});
