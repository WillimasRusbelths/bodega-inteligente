import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";

interface LifecycleState {
  users: Array<{ id: string }>;
  memberships: Array<{
    id: string;
    tenantId: string;
    userId: string;
    status: "ACTIVE" | "DISABLED";
    roles: string[];
    version: number;
    disabledAt: Date | null;
    disabledReason: string | null;
    disabledByMembershipId: string | null;
  }>;
  deviceProfiles: Array<{
    id: string;
    membershipId: string;
    status: "ACTIVE" | "REVOKED";
    pinHash: string | null;
  }>;
  sessions: Array<{
    id: string;
    membershipId: string;
    revokedAt: Date | null;
  }>;
  refreshCredentials: Array<{
    id: string;
    sessionId: string;
    tokenHash: string;
    revokedAt: Date | null;
  }>;
  challenges: Array<{
    id: string;
    membershipId: string;
    revokedAt: Date | null;
  }>;
  audits: Array<Record<string, unknown>>;
}

interface LifecycleHarness {
  changeStatus(input: {
    actorMembershipId: string;
    actorTenantId: string;
    targetMembershipId: string;
    expectedVersion: number;
    status: "ACTIVE" | "DISABLED";
    reason: string;
    now: Date;
  }): Promise<{
    membership: LifecycleState["memberships"][number];
    requiresActivation: boolean;
  }>;
}

interface LifecycleModule {
  createMembershipLifecycleHarness(options: {
    state: LifecycleState;
  }): LifecycleHarness;
}

const servicePath = resolve(
  process.cwd(),
  "apps/api/src/modules/memberships/services/change-membership-status.service.ts",
);

async function loadHarness(): Promise<LifecycleModule> {
  try {
    const module = (await import(
      pathToFileURL(servicePath).href
    )) as Partial<LifecycleModule>;
    if (module.createMembershipLifecycleHarness === undefined)
      throw new Error("missing export");
    return module as LifecycleModule;
  } catch {
    throw new Error(
      "[T071-T073] Transactional membership lifecycle is required by T070.",
    );
  }
}

const tenantA = "00000000-0000-4000-8000-000000000001";
const tenantB = "00000000-0000-4000-8000-000000000002";
const actorA = "00000000-0000-4000-8000-000000000101";
const targetA = "00000000-0000-4000-8000-000000000103";
const targetB = "00000000-0000-4000-8000-000000000106";
const user = "00000000-0000-4000-8000-000000000015";
const now = new Date("2026-01-01T01:00:00.000Z");

function createState(): LifecycleState {
  return {
    users: [{ id: user }],
    memberships: [
      {
        id: actorA,
        tenantId: tenantA,
        userId: "00000000-0000-4000-8000-000000000011",
        status: "ACTIVE",
        roles: ["owner_admin"],
        version: 1,
        disabledAt: null,
        disabledReason: null,
        disabledByMembershipId: null,
      },
      {
        id: targetA,
        tenantId: tenantA,
        userId: user,
        status: "ACTIVE",
        roles: ["seller"],
        version: 1,
        disabledAt: null,
        disabledReason: null,
        disabledByMembershipId: null,
      },
      {
        id: targetB,
        tenantId: tenantB,
        userId: user,
        status: "ACTIVE",
        roles: ["inventory_manager"],
        version: 1,
        disabledAt: null,
        disabledReason: null,
        disabledByMembershipId: null,
      },
    ],
    deviceProfiles: [
      {
        id: "profile-a",
        membershipId: targetA,
        status: "ACTIVE",
        pinHash: "hash-a",
      },
      {
        id: "profile-b",
        membershipId: targetB,
        status: "ACTIVE",
        pinHash: "hash-b",
      },
    ],
    sessions: [
      { id: "session-a", membershipId: targetA, revokedAt: null },
      { id: "session-b", membershipId: targetB, revokedAt: null },
    ],
    refreshCredentials: [
      {
        id: "refresh-a",
        sessionId: "session-a",
        tokenHash: "hash-refresh-a",
        revokedAt: null,
      },
      {
        id: "refresh-b",
        sessionId: "session-b",
        tokenHash: "hash-refresh-b",
        revokedAt: null,
      },
    ],
    challenges: [
      { id: "challenge-a", membershipId: targetA, revokedAt: null },
      { id: "challenge-b", membershipId: targetB, revokedAt: null },
    ],
    audits: [],
  };
}

async function setup() {
  const state = createState();
  const module = await loadHarness();
  return {
    state,
    service: module.createMembershipLifecycleHarness({ state }),
  };
}

async function disable(service: LifecycleHarness) {
  return service.changeStatus({
    actorMembershipId: actorA,
    actorTenantId: tenantA,
    targetMembershipId: targetA,
    expectedVersion: 1,
    status: "DISABLED",
    reason: "Synthetic employment ended",
    now,
  });
}

async function capture(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  throw new Error("Expected operation to fail.");
}

describe("membership lifecycle [T070; HU-006; FR-012, FR-017, FR-021, FR-038; SC-010]", () => {
  it("records reason, actor and time when disabling", async () => {
    const { service } = await setup();
    const result = await disable(service);
    expect(result.membership).toMatchObject({
      status: "DISABLED",
      disabledReason: "Synthetic employment ended",
      disabledByMembershipId: actorA,
      disabledAt: now,
      version: 2,
    });
  });

  it("preserves the global user, membership and historical roles", async () => {
    const { state, service } = await setup();
    await disable(service);
    expect(state.users).toContainEqual({ id: user });
    expect(state.memberships.find(({ id }) => id === targetA)).toMatchObject({
      roles: ["seller"],
      status: "DISABLED",
    });
  });

  it("revokes the profile, session and refresh credential immediately", async () => {
    const { state, service } = await setup();
    await disable(service);
    expect(state.deviceProfiles[0]).toMatchObject({ status: "REVOKED" });
    expect(state.sessions[0]?.revokedAt).toEqual(now);
    expect(state.refreshCredentials[0]?.revokedAt).toEqual(now);
  });

  it("does not restore old access after reactivation", async () => {
    const { state, service } = await setup();
    await disable(service);
    const result = await service.changeStatus({
      actorMembershipId: actorA,
      actorTenantId: tenantA,
      targetMembershipId: targetA,
      expectedVersion: 2,
      status: "ACTIVE",
      reason: "Synthetic approved return",
      now: new Date("2026-01-02T01:00:00.000Z"),
    });
    expect(result.requiresActivation).toBe(true);
    expect(state.deviceProfiles[0]).toMatchObject({ status: "REVOKED" });
    expect(state.sessions[0]?.revokedAt).not.toBeNull();
    expect(state.refreshCredentials[0]?.revokedAt).not.toBeNull();
  });

  it("requires a new activation and never reuses old PIN, refresh or challenge", async () => {
    const { state, service } = await setup();
    await disable(service);
    expect(state.deviceProfiles[0]).toMatchObject({
      status: "REVOKED",
      pinHash: null,
    });
    expect(state.refreshCredentials[0]?.revokedAt).toEqual(now);
    expect(state.challenges[0]?.revokedAt).toEqual(now);
  });

  it("does not affect the same user's membership in Tenant B", async () => {
    const { state, service } = await setup();
    await disable(service);
    expect(state.memberships.find(({ id }) => id === targetB)).toMatchObject({
      status: "ACTIVE",
      roles: ["inventory_manager"],
      version: 1,
    });
    expect(state.deviceProfiles[1]).toMatchObject({ status: "ACTIVE" });
    expect(state.sessions[1]?.revokedAt).toBeNull();
  });

  it("returns identical anti-enumeration errors for foreign and missing IDs", async () => {
    const { service } = await setup();
    const base = {
      actorMembershipId: actorA,
      actorTenantId: tenantA,
      expectedVersion: 1,
      status: "DISABLED" as const,
      reason: "Synthetic isolated withdrawal",
      now,
    };
    const foreign = await capture(
      service.changeStatus({ ...base, targetMembershipId: targetB }),
    );
    const missing = await capture(
      service.changeStatus({
        ...base,
        targetMembershipId: "00000000-0000-4000-8000-000000000999",
      }),
    );
    expect(JSON.stringify(foreign)).toBe(JSON.stringify(missing));
    expect(foreign).toMatchObject({ code: "RESOURCE_NOT_FOUND" });
  });

  it("writes one sanitized audit event in the same successful operation", async () => {
    const { state, service } = await setup();
    await disable(service);
    expect(state.audits).toHaveLength(1);
    expect(state.audits[0]).toMatchObject({
      action: "MEMBERSHIP_DISABLED",
      actorMembershipId: actorA,
      targetMembershipId: targetA,
      reason: "Synthetic employment ended",
      result: "SUCCEEDED",
    });
    expect(JSON.stringify(state.audits)).not.toMatch(
      /pinHash|tokenHash|hash-a|hash-refresh-a/iu,
    );
  });
});
