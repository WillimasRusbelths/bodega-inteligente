import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";

interface AccessClaims {
  readonly sessionId: string;
  readonly userId: string;
  readonly authVersion: number;
  readonly contextVersion: number;
  readonly tenantId: string;
  readonly membershipId: string;
  readonly expiresAt: Date;
}

interface ImmediateRevocationState {
  user: { id: string; status: "ACTIVE" | "DISABLED"; authVersion: number };
  tenants: Array<{ id: string; status: "ACTIVE" | "DISABLED" }>;
  memberships: Array<{
    id: string;
    tenantId: string;
    userId: string;
    status: "ACTIVE" | "DISABLED";
  }>;
  devices: Array<{ id: string; status: "ACTIVE" | "REVOKED" }>;
  profiles: Array<{
    id: string;
    tenantId: string;
    membershipId: string;
    userId: string;
    deviceId: string;
    status: "ACTIVE" | "REVOKED";
  }>;
  sessions: Array<{
    id: string;
    userId: string;
    tenantId: string;
    activeMembershipId: string;
    deviceProfileId: string;
    authVersion: number;
    contextVersion: number;
    absoluteExpiresAt: Date;
    revokedAt: Date | null;
  }>;
  refreshFamilies: Array<{
    id: string;
    sessionId: string;
    status: "ACTIVE" | "REVOKED";
  }>;
  validationReads: number;
  audits: Array<Record<string, unknown>>;
  logs: unknown[];
}

interface SessionGuardHarness {
  authorize(input: {
    readonly accessToken: string;
    readonly serverNow: Date;
  }): Promise<{ readonly tenantId: string; readonly membershipId: string }>;
}

interface SessionGuardModule {
  createSessionGuardHarness(options: {
    readonly state: ImmediateRevocationState;
    readonly decodeAccessToken: (token: string) => AccessClaims;
  }): SessionGuardHarness;
}

const guardPath = resolve(
  process.cwd(),
  "apps/api/src/modules/auth/guards/session.guard.ts",
);

async function loadModule(): Promise<SessionGuardModule> {
  if (!existsSync(guardPath)) {
    throw new Error("[T057] SessionGuard is required by T054.");
  }
  const module = (await import(
    pathToFileURL(guardPath).href
  )) as Partial<SessionGuardModule>;
  if (module.createSessionGuardHarness === undefined) {
    throw new Error(
      "[T057] createSessionGuardHarness export is required by T054.",
    );
  }
  return { createSessionGuardHarness: module.createSessionGuardHarness };
}

const now = new Date("2026-01-01T00:00:00.000Z");
const accessExpiresAt = new Date(now.getTime() + 10 * 60 * 1_000);
const absoluteExpiresAt = new Date(now.getTime() + 8 * 60 * 60 * 1_000);
const userId = "00000000-0000-4000-8000-000000000011";
const tenantA = "00000000-0000-4000-8000-000000000001";
const tenantB = "00000000-0000-4000-8000-000000000002";
const membershipA = "00000000-0000-4000-8000-000000000101";
const membershipB = "00000000-0000-4000-8000-000000000102";
const deviceA = "00000000-0000-4000-8000-000000000201";
const deviceB = "00000000-0000-4000-8000-000000000202";
const profileA = "00000000-0000-4000-8000-000000000301";
const profileB = "00000000-0000-4000-8000-000000000302";
const sessionA = "00000000-0000-4000-8000-000000000401";
const sessionB = "00000000-0000-4000-8000-000000000402";
const familyA = "00000000-0000-4000-8000-000000000501";
const familyB = "00000000-0000-4000-8000-000000000502";
const accessTokenA = "synthetic-access-token-a";
const accessTokenB = "synthetic-access-token-b";

function claimsFor(
  sessionId: string,
  tenantId: string,
  membershipId: string,
): AccessClaims {
  return {
    sessionId,
    userId,
    authVersion: 1,
    contextVersion: 1,
    tenantId,
    membershipId,
    expiresAt: accessExpiresAt,
  };
}

function createState(): ImmediateRevocationState {
  return {
    user: { id: userId, status: "ACTIVE", authVersion: 1 },
    tenants: [
      { id: tenantA, status: "ACTIVE" },
      { id: tenantB, status: "ACTIVE" },
    ],
    memberships: [
      { id: membershipA, tenantId: tenantA, userId, status: "ACTIVE" },
      { id: membershipB, tenantId: tenantB, userId, status: "ACTIVE" },
    ],
    devices: [
      { id: deviceA, status: "ACTIVE" },
      { id: deviceB, status: "ACTIVE" },
    ],
    profiles: [
      {
        id: profileA,
        tenantId: tenantA,
        membershipId: membershipA,
        userId,
        deviceId: deviceA,
        status: "ACTIVE",
      },
      {
        id: profileB,
        tenantId: tenantB,
        membershipId: membershipB,
        userId,
        deviceId: deviceB,
        status: "ACTIVE",
      },
    ],
    sessions: [
      {
        id: sessionA,
        userId,
        tenantId: tenantA,
        activeMembershipId: membershipA,
        deviceProfileId: profileA,
        authVersion: 1,
        contextVersion: 1,
        absoluteExpiresAt,
        revokedAt: null,
      },
      {
        id: sessionB,
        userId,
        tenantId: tenantB,
        activeMembershipId: membershipB,
        deviceProfileId: profileB,
        authVersion: 1,
        contextVersion: 1,
        absoluteExpiresAt,
        revokedAt: null,
      },
    ],
    refreshFamilies: [
      { id: familyA, sessionId: sessionA, status: "ACTIVE" },
      { id: familyB, sessionId: sessionB, status: "ACTIVE" },
    ],
    validationReads: 0,
    audits: [],
    logs: [],
  };
}

function decodeAccessToken(token: string): AccessClaims {
  if (token === accessTokenA) return claimsFor(sessionA, tenantA, membershipA);
  if (token === accessTokenB) return claimsFor(sessionB, tenantB, membershipB);
  if (token === "foreign-resource-token") {
    return claimsFor(sessionA, tenantB, membershipB);
  }
  if (token === "missing-session-token") {
    return claimsFor(
      "00000000-0000-4000-8000-000000000499",
      tenantA,
      membershipA,
    );
  }
  throw new Error("Invalid access token.");
}

async function setup(mutate?: (state: ImmediateRevocationState) => void) {
  const state = createState();
  mutate?.(state);
  const guard = (await loadModule()).createSessionGuardHarness({
    state,
    decodeAccessToken,
  });
  return { state, guard };
}

async function captureFailure(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  throw new Error("Expected a revoked session failure.");
}

function authorizeA(guard: SessionGuardHarness): Promise<unknown> {
  return guard.authorize({ accessToken: accessTokenA, serverNow: now });
}

const revocations: ReadonlyArray<{
  readonly name: string;
  readonly mutate: (state: ImmediateRevocationState) => void;
}> = [
  {
    name: "User",
    mutate: (state) => {
      state.user.status = "DISABLED";
    },
  },
  {
    name: "Tenant",
    mutate: (state) => {
      const tenant = state.tenants.find(({ id }) => id === tenantA);
      if (tenant !== undefined) tenant.status = "DISABLED";
    },
  },
  {
    name: "Membership",
    mutate: (state) => {
      const membership = state.memberships.find(({ id }) => id === membershipA);
      if (membership !== undefined) membership.status = "DISABLED";
    },
  },
  {
    name: "Device",
    mutate: (state) => {
      const device = state.devices.find(({ id }) => id === deviceA);
      if (device !== undefined) device.status = "REVOKED";
    },
  },
  {
    name: "DeviceProfile",
    mutate: (state) => {
      const profile = state.profiles.find(({ id }) => id === profileA);
      if (profile !== undefined) profile.status = "REVOKED";
    },
  },
  {
    name: "Session",
    mutate: (state) => {
      const session = state.sessions.find(({ id }) => id === sessionA);
      if (session !== undefined) session.revokedAt = now;
    },
  },
  {
    name: "refresh family",
    mutate: (state) => {
      const family = state.refreshFamilies.find(({ id }) => id === familyA);
      if (family !== undefined) family.status = "REVOKED";
    },
  },
];

describe("immediate session revocation [T054; HU-006; FR-006, FR-007, FR-021, FR-038; SC-003]", () => {
  it.each(revocations)(
    "rejects an unexpired access token immediately after $name revocation",
    async ({ mutate }) => {
      const { guard } = await setup(mutate);
      await expect(authorizeA(guard)).rejects.toMatchObject({
        code: "SESSION_INVALID",
      });
    },
  );

  it("revalidates server-side state on every request", async () => {
    const { state, guard } = await setup();
    await authorizeA(guard);
    const firstReads = state.validationReads;
    await authorizeA(guard);
    expect(firstReads).toBeGreaterThan(0);
    expect(state.validationReads).toBeGreaterThan(firstReads);
  });

  it("invalidates prior access tokens when authVersion changes", async () => {
    const { guard } = await setup((state) => {
      state.user.authVersion += 1;
    });
    await expect(authorizeA(guard)).rejects.toMatchObject({
      code: "SESSION_INVALID",
    });
  });

  it("does not rely only on JWT expiration", async () => {
    const { guard } = await setup((state) => {
      const membership = state.memberships.find(({ id }) => id === membershipA);
      if (membership !== undefined) membership.status = "DISABLED";
    });
    expect(accessExpiresAt.getTime() - now.getTime()).toBe(10 * 60 * 1_000);
    await expect(authorizeA(guard)).rejects.toBeDefined();
  });

  it("does not grant access during the token's remaining ten minutes", async () => {
    const { guard } = await setup((state) => {
      const session = state.sessions.find(({ id }) => id === sessionA);
      if (session !== undefined) session.revokedAt = now;
    });
    for (const elapsedMinutes of [0, 5, 9]) {
      await expect(
        guard.authorize({
          accessToken: accessTokenA,
          serverNow: new Date(now.getTime() + elapsedMinutes * 60 * 1_000),
        }),
      ).rejects.toBeDefined();
    }
  });

  it("keeps Tenant B valid when only Tenant A is revoked", async () => {
    const { guard } = await setup((state) => {
      const tenant = state.tenants.find(({ id }) => id === tenantA);
      if (tenant !== undefined) tenant.status = "DISABLED";
    });
    await expect(
      guard.authorize({ accessToken: accessTokenB, serverNow: now }),
    ).resolves.toMatchObject({ tenantId: tenantB, membershipId: membershipB });
    await expect(authorizeA(guard)).rejects.toBeDefined();
  });

  it("revokes both Tenant A and B access when the global User is disabled", async () => {
    const { guard } = await setup((state) => {
      state.user.status = "DISABLED";
    });
    await expect(authorizeA(guard)).rejects.toBeDefined();
    await expect(
      guard.authorize({ accessToken: accessTokenB, serverNow: now }),
    ).rejects.toBeDefined();
  });

  it("uses equivalent responses for foreign, missing and revoked state", async () => {
    const revoked = await setup((state) => {
      const session = state.sessions.find(({ id }) => id === sessionA);
      if (session !== undefined) session.revokedAt = now;
    });
    const active = await setup();
    const failures = [
      await captureFailure(authorizeA(revoked.guard)),
      await captureFailure(
        active.guard.authorize({
          accessToken: "foreign-resource-token",
          serverNow: now,
        }),
      ),
      await captureFailure(
        active.guard.authorize({
          accessToken: "missing-session-token",
          serverNow: now,
        }),
      ),
    ];
    expect(failures.map((error) => JSON.stringify(error))).toEqual(
      Array.from({ length: 3 }, () => JSON.stringify(failures[0])),
    );
  });

  it("audits denials without raw tokens or sensitive state", async () => {
    const { state, guard } = await setup((draft) => {
      const profile = draft.profiles.find(({ id }) => id === profileA);
      if (profile !== undefined) profile.status = "REVOKED";
    });
    await expect(authorizeA(guard)).rejects.toBeDefined();
    expect(state.audits).toContainEqual(
      expect.objectContaining({ action: "SESSION_ACCESS_DENIED" }),
    );
    const telemetry = JSON.stringify({
      audits: state.audits,
      logs: state.logs,
    });
    expect(telemetry).not.toContain(accessTokenA);
    expect(telemetry).not.toMatch(/phone|pin|refreshToken/iu);
  });
});
