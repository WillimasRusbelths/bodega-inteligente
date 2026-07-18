import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";

interface MembershipState {
  id: string;
  tenantId: string;
  tenantName: string;
  userId: string;
  status: "ACTIVE" | "DISABLED";
  roles: string[];
  permissions: string[];
}

interface ActiveTenantState {
  user: { id: string; displayName: string; status: "ACTIVE" };
  memberships: MembershipState[];
  session: {
    id: string;
    userId: string;
    tenantId: string | null;
    activeMembershipId: string | null;
    authVersion: number;
    contextVersion: number;
    absoluteExpiresAt: Date;
    revokedAt: Date | null;
  };
  audits: Array<Record<string, unknown>>;
  logs: unknown[];
}

interface MembershipChoice {
  readonly membershipId: string;
  readonly tenantId: string;
  readonly tenantName: string;
  readonly roles: readonly string[];
}

interface ActiveTenantContractHarness {
  getMe(): Promise<{
    readonly userId: string;
    readonly displayName: string;
    readonly activeContext: MembershipChoice | null;
    readonly memberships: readonly MembershipChoice[];
  }>;
  listMemberships(): Promise<readonly MembershipChoice[]>;
  issueCurrentAccessToken(now: Date): Promise<string>;
  selectTenant(input: {
    readonly membershipId: string;
    readonly now: Date;
  }): Promise<{
    readonly accessToken: string;
    readonly tokenType: "Bearer";
    readonly expiresInSeconds: number;
    readonly sessionExpiresAt: string;
    readonly activeTenant: MembershipChoice & {
      readonly capabilities: readonly string[];
    };
    readonly contextVersion: number;
  }>;
  refresh(input: {
    readonly refreshToken: string;
    readonly now: Date;
  }): Promise<{
    readonly accessToken: string;
    readonly refreshToken: string;
    readonly absoluteExpiresAt: string;
    readonly activeContext: MembershipChoice | null;
  }>;
  authorize(
    accessToken: string,
    now: Date,
  ): Promise<{
    readonly tenantId: string | null;
    readonly membershipId: string | null;
    readonly contextVersion: number;
  }>;
}

interface ActiveTenantContractModule {
  createActiveTenantContractHarness(options: {
    readonly state: ActiveTenantState;
    readonly initialRefreshToken: string;
  }): ActiveTenantContractHarness;
}

const futurePaths = [
  "apps/api/src/modules/access/services/active-context.service.ts",
  "apps/api/src/modules/access/services/select-tenant.service.ts",
  "apps/api/src/modules/access/context/tenant-context.ts",
  "apps/api/src/modules/access/guards",
  "apps/api/src/infrastructure/prisma/tenant-repository.ts",
  "apps/api/src/modules/access/context.controller.ts",
].map((path) => resolve(process.cwd(), path));

const controllerPath = futurePaths[5];

async function loadModule(): Promise<ActiveTenantContractModule> {
  if (
    controllerPath === undefined ||
    futurePaths.some((path) => !existsSync(path))
  ) {
    throw new Error(
      "[T062-T066] Active context, tenant selection, guards, tenant-aware repository and context controller are required by T059.",
    );
  }
  const module = (await import(
    pathToFileURL(controllerPath).href
  )) as Partial<ActiveTenantContractModule>;
  if (module.createActiveTenantContractHarness === undefined) {
    throw new Error(
      "[T066] createActiveTenantContractHarness export is required by T059.",
    );
  }
  return {
    createActiveTenantContractHarness: module.createActiveTenantContractHarness,
  };
}

const now = new Date("2026-01-01T00:00:00.000Z");
const absoluteExpiresAt = new Date("2026-01-01T08:00:00.000Z");
const userId = "00000000-0000-4000-8000-000000000011";
const tenantA = "00000000-0000-4000-8000-000000000001";
const tenantB = "00000000-0000-4000-8000-000000000002";
const membershipA = "00000000-0000-4000-8000-000000000101";
const membershipB = "00000000-0000-4000-8000-000000000102";
const disabledMembership = "00000000-0000-4000-8000-000000000103";
const initialRefreshToken = "synthetic-refresh-context-family-000000000001";

function createMemberships(): MembershipState[] {
  return [
    {
      id: membershipA,
      tenantId: tenantA,
      tenantName: "Synthetic Tenant A",
      userId,
      status: "ACTIVE",
      roles: ["seller"],
      permissions: ["sales.orders.read"],
    },
    {
      id: membershipB,
      tenantId: tenantB,
      tenantName: "Synthetic Tenant B",
      userId,
      status: "ACTIVE",
      roles: ["inventory_manager"],
      permissions: ["inventory.stock.read"],
    },
    {
      id: disabledMembership,
      tenantId: "00000000-0000-4000-8000-000000000003",
      tenantName: "Synthetic Disabled Tenant",
      userId,
      status: "DISABLED",
      roles: ["owner_admin"],
      permissions: ["access.memberships.manage"],
    },
  ];
}

function createState(memberships = createMemberships()): ActiveTenantState {
  return {
    user: { id: userId, displayName: "Synthetic User", status: "ACTIVE" },
    memberships,
    session: {
      id: "00000000-0000-4000-8000-000000000401",
      userId,
      tenantId: null,
      activeMembershipId: null,
      authVersion: 1,
      contextVersion: 1,
      absoluteExpiresAt,
      revokedAt: null,
    },
    audits: [],
    logs: [],
  };
}

async function setup(memberships = createMemberships()) {
  const state = createState(memberships);
  const harness = (await loadModule()).createActiveTenantContractHarness({
    state,
    initialRefreshToken,
  });
  return { state, harness };
}

describe("active tenant contract [T059; HU-003; FR-008..FR-010, FR-023, FR-035]", () => {
  it("declares the approved /me, membership list and tenant selection operations", () => {
    const openapi = readFileSync(
      resolve(
        process.cwd(),
        "specs/001-multi-tenant-access/contracts/openapi.yaml",
      ),
      "utf8",
    );
    for (const declaration of [
      "operationId: getMyIdentity",
      "operationId: listMyActiveMemberships",
      "operationId: selectActiveTenant",
      "TenantSelectionResponse:",
      "Does not return or rotate the refresh token",
    ]) {
      expect(openapi).toContain(declaration);
    }
  });

  it("returns only the safe current identity through /me", async () => {
    const me = await (await setup()).harness.getMe();
    expect(me).toMatchObject({ userId, displayName: "Synthetic User" });
    expect(JSON.stringify(me)).not.toMatch(/phone|pin|token|permissions/iu);
  });

  it("lists exclusively active memberships", async () => {
    const memberships = await (await setup()).harness.listMemberships();
    expect(memberships.map(({ membershipId }) => membershipId)).toEqual([
      membershipA,
      membershipB,
    ]);
  });

  it("auto-selects the only active membership", async () => {
    const onlyA = createMemberships().filter(({ id }) => id !== membershipB);
    const { state, harness } = await setup(onlyA);
    const me = await harness.getMe();
    expect(me.activeContext).toMatchObject({ membershipId: membershipA });
    expect(state.session).toMatchObject({
      tenantId: tenantA,
      activeMembershipId: membershipA,
    });
  });

  it("keeps the session without tenant when multiple memberships are active", async () => {
    const { state, harness } = await setup();
    expect((await harness.getMe()).activeContext).toBeNull();
    expect(state.session.tenantId).toBeNull();
    expect(state.session.activeMembershipId).toBeNull();
  });

  it("selects an initial tenant and later replaces it", async () => {
    const { state, harness } = await setup();
    await harness.selectTenant({ membershipId: membershipA, now });
    await harness.selectTenant({ membershipId: membershipB, now });
    expect(state.session).toMatchObject({
      tenantId: tenantB,
      activeMembershipId: membershipB,
      contextVersion: 3,
    });
  });

  it("rejects selection of a disabled membership", async () => {
    await expect(
      (await setup()).harness.selectTenant({
        membershipId: disabledMembership,
        now,
      }),
    ).rejects.toMatchObject({ code: "RESOURCE_NOT_FOUND" });
  });

  it("returns a new access token without any refresh token", async () => {
    const { harness } = await setup();
    const previous = await harness.issueCurrentAccessToken(now);
    const selected = await harness.selectTenant({
      membershipId: membershipA,
      now,
    });
    expect(selected.accessToken).not.toBe(previous);
    expect(JSON.stringify(selected)).not.toMatch(/refreshToken/iu);
  });

  it("increments contextVersion and invalidates the previous access token", async () => {
    const { harness } = await setup();
    const previous = await harness.issueCurrentAccessToken(now);
    const selected = await harness.selectTenant({
      membershipId: membershipA,
      now,
    });
    expect(selected.contextVersion).toBe(2);
    await expect(harness.authorize(previous, now)).rejects.toMatchObject({
      code: "SESSION_INVALID",
    });
    await expect(harness.authorize(selected.accessToken, now)).resolves.toEqual(
      { tenantId: tenantA, membershipId: membershipA, contextVersion: 2 },
    );
  });

  it("refreshes with the currently stored tenant and contextVersion", async () => {
    const { harness } = await setup();
    await harness.selectTenant({ membershipId: membershipB, now });
    const refreshed = await harness.refresh({
      refreshToken: initialRefreshToken,
      now: new Date(now.getTime() + 60_000),
    });
    expect(refreshed.activeContext).toMatchObject({
      tenantId: tenantB,
      membershipId: membershipB,
    });
    await expect(
      harness.authorize(
        refreshed.accessToken,
        new Date(now.getTime() + 60_000),
      ),
    ).resolves.toMatchObject({ tenantId: tenantB, contextVersion: 2 });
  });

  it("preserves the original absolute eight-hour expiration", async () => {
    const { harness } = await setup();
    const selected = await harness.selectTenant({
      membershipId: membershipA,
      now: new Date(now.getTime() + 60 * 60 * 1_000),
    });
    const refreshed = await harness.refresh({
      refreshToken: initialRefreshToken,
      now: new Date(now.getTime() + 2 * 60 * 60 * 1_000),
    });
    expect(selected.sessionExpiresAt).toBe(absoluteExpiresAt.toISOString());
    expect(refreshed.absoluteExpiresAt).toBe(absoluteExpiresAt.toISOString());
  });

  it("switches roles and permissions without accumulating Tenant A and B", async () => {
    const { harness } = await setup();
    const selectedA = await harness.selectTenant({
      membershipId: membershipA,
      now,
    });
    const selectedB = await harness.selectTenant({
      membershipId: membershipB,
      now,
    });
    expect(selectedA.activeTenant.roles).toEqual(["seller"]);
    expect(selectedA.activeTenant.capabilities).toEqual(["sales.orders.read"]);
    expect(selectedB.activeTenant.roles).toEqual(["inventory_manager"]);
    expect(selectedB.activeTenant.capabilities).toEqual([
      "inventory.stock.read",
    ]);
    expect(JSON.stringify(selectedB)).not.toContain("sales.orders.read");
  });

  it("audits context changes without secrets or permissions from another tenant", async () => {
    const { state, harness } = await setup();
    await harness.selectTenant({ membershipId: membershipA, now });
    expect(state.audits).toContainEqual(
      expect.objectContaining({ action: "ACTIVE_TENANT_CHANGED" }),
    );
    const telemetry = JSON.stringify({
      audits: state.audits,
      logs: state.logs,
    });
    expect(telemetry).not.toMatch(/accessToken|refreshToken|pin/iu);
    expect(telemetry).not.toContain("inventory.stock.read");
  });
});
