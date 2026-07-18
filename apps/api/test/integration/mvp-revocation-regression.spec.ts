import { describe, expect, it } from "vitest";
import { createSessionGuardHarness } from "../../src/modules/auth/guards/session.guard.js";
import { createMembershipLifecycleHarness } from "../../src/modules/memberships/services/change-membership-status.service.js";

const now = new Date("2026-01-01T00:00:00.000Z");
const userId = "00000000-0000-4000-8000-000000000011";
const tenantId = "00000000-0000-4000-8000-000000000001";
const membershipId = "00000000-0000-4000-8000-000000000101";
const deviceId = "00000000-0000-4000-8000-000000000201";
const profileId = "00000000-0000-4000-8000-000000000301";
const sessionId = "00000000-0000-4000-8000-000000000401";

interface RevocationState {
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

function revocationState(): RevocationState {
  return {
    user: { id: userId, status: "ACTIVE", authVersion: 1 },
    tenants: [{ id: tenantId, status: "ACTIVE" }],
    memberships: [{ id: membershipId, tenantId, userId, status: "ACTIVE" }],
    devices: [{ id: deviceId, status: "ACTIVE" }],
    profiles: [
      {
        id: profileId,
        tenantId,
        membershipId,
        userId,
        deviceId,
        status: "ACTIVE",
      },
    ],
    sessions: [
      {
        id: sessionId,
        userId,
        tenantId,
        activeMembershipId: membershipId,
        deviceProfileId: profileId,
        authVersion: 1,
        contextVersion: 1,
        absoluteExpiresAt: new Date(now.getTime() + 8 * 60 * 60 * 1_000),
        revokedAt: null,
      },
    ],
    refreshFamilies: [{ id: "family-a", sessionId, status: "ACTIVE" }],
    validationReads: 0,
    audits: [],
    logs: [],
  };
}

const invalidations: ReadonlyArray<{
  readonly name: string;
  readonly mutate: (state: RevocationState) => void;
}> = [
  {
    name: "User disabled",
    mutate: (state) => {
      state.user.status = "DISABLED";
    },
  },
  {
    name: "Tenant disabled",
    mutate: (state) => {
      const row = state.tenants[0];
      if (row !== undefined) row.status = "DISABLED";
    },
  },
  {
    name: "Membership disabled",
    mutate: (state) => {
      const row = state.memberships[0];
      if (row !== undefined) row.status = "DISABLED";
    },
  },
  {
    name: "Device revoked",
    mutate: (state) => {
      const row = state.devices[0];
      if (row !== undefined) row.status = "REVOKED";
    },
  },
  {
    name: "DeviceProfile revoked",
    mutate: (state) => {
      const row = state.profiles[0];
      if (row !== undefined) row.status = "REVOKED";
    },
  },
  {
    name: "Session closed",
    mutate: (state) => {
      const row = state.sessions[0];
      if (row !== undefined) row.revokedAt = now;
    },
  },
  {
    name: "refresh family revoked",
    mutate: (state) => {
      const row = state.refreshFamilies[0];
      if (row !== undefined) row.status = "REVOKED";
    },
  },
  {
    name: "authVersion incremented",
    mutate: (state) => {
      state.user.authVersion += 1;
    },
  },
  {
    name: "contextVersion incremented",
    mutate: (state) => {
      const row = state.sessions[0];
      if (row !== undefined) row.contextVersion += 1;
    },
  },
];

describe("MVP revocation and reactivation regression [T124]", () => {
  it("accepts the unchanged active server-side chain", async () => {
    const state = revocationState();
    const guard = createSessionGuardHarness({
      state,
      decodeAccessToken: () => ({
        sessionId,
        userId,
        authVersion: 1,
        contextVersion: 1,
        tenantId,
        membershipId,
        expiresAt: new Date(now.getTime() + 10 * 60 * 1_000),
      }),
    });
    await expect(
      guard.authorize({ accessToken: "synthetic-access", serverNow: now }),
    ).resolves.toEqual({ tenantId, membershipId });
  });

  it.each(invalidations)(
    "rejects the next operation after $name",
    async ({ mutate }) => {
      const state = revocationState();
      mutate(state);
      const guard = createSessionGuardHarness({
        state,
        decodeAccessToken: () => ({
          sessionId,
          userId,
          authVersion: 1,
          contextVersion: 1,
          tenantId,
          membershipId,
          expiresAt: new Date(now.getTime() + 10 * 60 * 1_000),
        }),
      });
      await expect(
        guard.authorize({
          accessToken: "synthetic-still-unexpired",
          serverNow: now,
        }),
      ).rejects.toMatchObject({ code: "SESSION_INVALID" });
      expect(state.validationReads).toBeGreaterThan(0);
    },
  );

  it("preserves history on reactivation without restoring credentials or access artifacts", async () => {
    const actorMembershipId = "00000000-0000-4000-8000-000000000102";
    const targetMembershipId = membershipId;
    const state = {
      users: [{ id: userId }],
      memberships: [
        {
          id: actorMembershipId,
          tenantId,
          userId: "00000000-0000-4000-8000-000000000012",
          status: "ACTIVE" as const,
          roles: ["owner_admin"],
          version: 1,
          disabledAt: null,
          disabledReason: null,
          disabledByMembershipId: null,
        },
        {
          id: targetMembershipId,
          tenantId,
          userId,
          status: "ACTIVE" as "ACTIVE" | "DISABLED",
          roles: ["seller"],
          version: 1,
          disabledAt: null as Date | null,
          disabledReason: null as string | null,
          disabledByMembershipId: null as string | null,
        },
      ],
      deviceProfiles: [
        {
          id: profileId,
          membershipId: targetMembershipId,
          status: "ACTIVE" as "ACTIVE" | "REVOKED",
          pinHash: "synthetic-old-pin-hash" as string | null,
        },
      ],
      sessions: [
        {
          id: sessionId,
          membershipId: targetMembershipId,
          revokedAt: null as Date | null,
        },
      ],
      refreshCredentials: [
        {
          id: "refresh-a",
          sessionId,
          tokenHash: "synthetic-old-refresh-hash",
          revokedAt: null as Date | null,
        },
      ],
      challenges: [
        {
          id: "challenge-a",
          membershipId: targetMembershipId,
          revokedAt: null as Date | null,
        },
      ],
      audits: [] as Array<Record<string, unknown>>,
    };
    const lifecycle = createMembershipLifecycleHarness({ state });
    await lifecycle.changeStatus({
      actorMembershipId,
      actorTenantId: tenantId,
      targetMembershipId,
      expectedVersion: 1,
      status: "DISABLED",
      reason: "Synthetic approved revocation",
      now,
    });
    const reactivatedAt = new Date("2026-01-02T00:00:00.000Z");
    const result = await lifecycle.changeStatus({
      actorMembershipId,
      actorTenantId: tenantId,
      targetMembershipId,
      expectedVersion: 2,
      status: "ACTIVE",
      reason: "Synthetic approved reactivation",
      now: reactivatedAt,
    });
    expect(result.requiresActivation).toBe(true);
    expect(state.users).toEqual([{ id: userId }]);
    expect(state.memberships[1]).toMatchObject({
      status: "ACTIVE",
      roles: ["seller"],
      version: 3,
    });
    expect(state.deviceProfiles[0]).toMatchObject({
      status: "REVOKED",
      pinHash: null,
    });
    expect(state.sessions[0]?.revokedAt).toEqual(now);
    expect(state.refreshCredentials[0]?.revokedAt).toEqual(now);
    expect(state.challenges[0]?.revokedAt).toEqual(now);
    expect(state.audits.map(({ action }) => action)).toEqual([
      "MEMBERSHIP_DISABLED",
      "MEMBERSHIP_REACTIVATED",
    ]);
  });
});
