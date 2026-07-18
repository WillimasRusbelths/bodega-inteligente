import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createActivationConsumptionService } from "../../src/modules/activation/services/consume-activation.service.js";
import { createPinAttemptService } from "../../src/modules/auth/services/pin.service.js";
import { createRefreshRotationHarness } from "../../src/modules/auth/services/refresh-rotation.service.js";
import { createLastOwnerConcurrencyHarness } from "../../src/modules/memberships/services/change-roles.service.js";

const now = new Date("2026-01-01T00:00:00.000Z");
const absoluteExpiresAt = new Date(now.getTime() + 8 * 60 * 60 * 1_000);

describe("MVP concurrency [T123]", () => {
  it("allows exactly one activation consumer without an intermediate duplicate profile", async () => {
    const state = {
      challenge: {
        status: "ISSUED" as const,
        expiresAt: new Date(now.getTime() + 15 * 60 * 1_000),
        failedAttempts: 0,
        maxAttempts: 5,
        qrSecret: "synthetic-concurrent-qr",
        manualCode: "13572468",
      },
      devices: [] as Array<{ id: string; type: "PERSONAL" }>,
      profiles: [] as Array<{ id: string; status: "PENDING_PIN" }>,
    };
    const service = createActivationConsumptionService({
      state,
      transaction: async (work) => {
        const draft = structuredClone(state);
        const result = await work(draft);
        Object.assign(state, draft);
        return result;
      },
    });
    const results = await Promise.allSettled([
      service.consume(
        { type: "QR_SECRET", value: "synthetic-concurrent-qr" },
        now,
      ),
      service.consume({ type: "MANUAL_CODE", value: "13572468" }, now),
    ]);
    expect(results.map(({ status }) => status).sort()).toEqual([
      "fulfilled",
      "rejected",
    ]);
    expect(state.challenge.status).toBe("CONSUMED");
    expect(state.devices).toHaveLength(1);
    expect(state.profiles).toHaveLength(1);
  });

  it("allows one refresh rotation winner and safely revokes the family on reuse", async () => {
    const initialToken = "synthetic-concurrent-refresh-token";
    const rotatedToken = "synthetic-concurrent-rotated-token";
    const hashToken = (value: string): string =>
      createHash("sha256").update(value, "utf8").digest("base64url");
    const state = {
      session: {
        id: "00000000-0000-4000-8000-000000000501",
        absoluteExpiresAt,
        revokedAt: null as Date | null,
      },
      credentials: [
        {
          id: "00000000-0000-4000-8000-000000000601",
          sessionId: "00000000-0000-4000-8000-000000000501",
          familyId: "00000000-0000-4000-8000-000000000701",
          tokenHash: hashToken(initialToken),
          expiresAt: absoluteExpiresAt,
          rotatedAt: null,
          replacedById: null,
          revokedAt: null,
          reuseDetectedAt: null,
        },
      ] as Array<{
        id: string;
        sessionId: string;
        familyId: string;
        tokenHash: string;
        expiresAt: Date;
        rotatedAt: Date | null;
        replacedById: string | null;
        revokedAt: Date | null;
        reuseDetectedAt: Date | null;
      }>,
      audits: [] as Array<Record<string, unknown>>,
      logs: [] as unknown[],
    };
    const service = createRefreshRotationHarness({
      state,
      hashToken,
      issueOpaqueToken: () => rotatedToken,
      transaction: async (work) => {
        const draft = structuredClone(state);
        const result = await work(draft);
        Object.assign(state, draft);
        return result;
      },
    });
    const results = await Promise.allSettled([
      service.rotate(initialToken, now),
      service.rotate(initialToken, now),
    ]);
    expect(results.filter(({ status }) => status === "fulfilled")).toHaveLength(
      1,
    );
    expect(results.filter(({ status }) => status === "rejected")).toHaveLength(
      1,
    );
    expect(state.session.revokedAt).toEqual(now);
    expect(state.credentials.every(({ revokedAt }) => revokedAt !== null)).toBe(
      true,
    );
  });

  it("serializes the fifth PIN failure and leaves a single locked state", async () => {
    const state = {
      profile: {
        status: "ACTIVE" as "ACTIVE" | "LOCKED" | "REVOKED",
        membershipStatus: "ACTIVE" as "ACTIVE" | "DISABLED",
        failedPinAttempts: 4,
        lockedUntil: null as Date | null,
        pinHash: "synthetic-hash",
      },
      audits: [] as Array<Record<string, unknown>>,
    };
    const service = createPinAttemptService({
      state,
      verifyHash: () => Promise.resolve(false),
      transaction: async (work) => {
        const draft = structuredClone(state);
        const result = await work(draft);
        Object.assign(state, draft);
        return result;
      },
    });
    const results = await Promise.allSettled([
      service.attempt({ pin: "000000", serverNow: now }),
      service.attempt({ pin: "000000", serverNow: now }),
    ]);
    expect(results.every(({ status }) => status === "rejected")).toBe(true);
    expect(state.profile.status).toBe("LOCKED");
    expect(state.profile.failedPinAttempts).toBeGreaterThanOrEqual(5);
    expect(
      state.audits.filter(({ action }) => action === "PIN_PROFILE_LOCKED"),
    ).toHaveLength(1);
  });

  it("uses optimistic versioning so concurrent role changes have one explicit winner", async () => {
    const target = {
      id: "00000000-0000-4000-8000-000000000102",
      tenantId: "00000000-0000-4000-8000-000000000001",
      status: "ACTIVE" as const,
      roles: ["seller"],
      version: 1,
    };
    const memberships = [
      {
        id: "00000000-0000-4000-8000-000000000101",
        tenantId: target.tenantId,
        status: "ACTIVE" as const,
        roles: ["owner_admin"],
        version: 1,
      },
      target,
    ];
    const audits: Array<Record<string, unknown>> = [];
    const service = createLastOwnerConcurrencyHarness({
      memberships,
      audits,
      isolationLevels: [],
    });
    const results = await Promise.allSettled([
      service.changeRoles({
        actorMembershipId: memberships[0]?.id ?? "",
        targetMembershipId: target.id,
        roles: ["seller"],
        expectedVersion: 1,
        reason: "Synthetic role update one",
      }),
      service.changeRoles({
        actorMembershipId: memberships[0]?.id ?? "",
        targetMembershipId: target.id,
        roles: ["inventory_manager"],
        expectedVersion: 1,
        reason: "Synthetic role update two",
      }),
    ]);
    expect(results.filter(({ status }) => status === "fulfilled")).toHaveLength(
      1,
    );
    const rejected = results.find(({ status }) => status === "rejected");
    expect(rejected?.status).toBe("rejected");
    if (rejected?.status === "rejected") {
      const reason: unknown = rejected.reason;
      expect(reason).toMatchObject({ code: "STALE_STATE" });
    }
    expect(target.version).toBe(2);
    expect(audits).toHaveLength(1);
  });

  it("never exposes zero active owners during concurrent owner withdrawal", async () => {
    const tenantId = "00000000-0000-4000-8000-000000000001";
    const memberships = [
      {
        id: "owner-a",
        tenantId,
        status: "ACTIVE" as const,
        roles: ["owner_admin"],
        version: 1,
      },
      {
        id: "owner-b",
        tenantId,
        status: "ACTIVE" as const,
        roles: ["owner_admin"],
        version: 1,
      },
    ];
    const observations: number[] = [];
    const countOwners = (): number =>
      memberships.filter(
        ({ status, roles }) =>
          status === "ACTIVE" && roles.includes("owner_admin"),
      ).length;
    const service = createLastOwnerConcurrencyHarness({
      memberships,
      audits: [],
      isolationLevels: [],
    });
    observations.push(countOwners());
    const results = await Promise.allSettled(
      memberships.map((membership) =>
        service
          .changeRoles({
            actorMembershipId: membership.id,
            targetMembershipId: membership.id,
            roles: ["seller"],
            expectedVersion: 1,
            reason: "Synthetic owner withdrawal",
          })
          .finally(() => observations.push(countOwners())),
      ),
    );
    expect(results.filter(({ status }) => status === "fulfilled")).toHaveLength(
      1,
    );
    expect(results.filter(({ status }) => status === "rejected")).toHaveLength(
      1,
    );
    expect(observations.every((count) => count >= 1)).toBe(true);
    expect(countOwners()).toBe(1);
  });
});
