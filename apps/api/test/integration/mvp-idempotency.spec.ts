import { describe, expect, it } from "vitest";
import { createActivationConsumptionService } from "../../src/modules/activation/services/consume-activation.service.js";
import { createActivationSecretService } from "../../src/modules/activation/services/issue-activation.service.js";
import { createBootstrapTenantService } from "../../src/modules/tenants/services/bootstrap-tenant.service.js";

interface BootstrapResult {
  readonly tenantId: string;
  readonly userId: string;
  readonly membershipId: string;
}

interface BootstrapState {
  users: Array<{ id: string; phoneE164: string }>;
  tenants: Array<{ id: string; name: string }>;
  memberships: Array<{
    id: string;
    tenantId: string;
    userId: string;
    role: string;
  }>;
  audits: Array<{ tenantId: string; action: string }>;
  idempotency: Array<{
    actorId: string;
    key: string;
    request: string;
    result: BootstrapResult;
  }>;
}

interface IdempotencyEntry {
  readonly request: string;
  readonly replayResponse: unknown;
}

class IdempotencyBoundary {
  readonly #entries = new Map<string, IdempotencyEntry>();

  public async execute<TFirst, TReplay>(options: {
    readonly scope: string;
    readonly key: string;
    readonly request: unknown;
    readonly operation: () => Promise<{
      readonly firstResponse: TFirst;
      readonly replayResponse: TReplay;
    }>;
  }): Promise<TFirst | TReplay> {
    const storageKey = `${options.scope}:${options.key}`;
    const request = JSON.stringify(options.request);
    const previous = this.#entries.get(storageKey);
    if (previous !== undefined) {
      if (previous.request !== request) {
        throw Object.assign(new Error("The idempotency request conflicts."), {
          code: "STALE_STATE" as const,
        });
      }
      return structuredClone(previous.replayResponse) as TReplay;
    }
    const result = await options.operation();
    this.#entries.set(storageKey, {
      request,
      replayResponse: structuredClone(result.replayResponse),
    });
    return result.firstResponse;
  }

  public serialized(): string {
    return JSON.stringify([...this.#entries.values()]);
  }
}

const actor = {
  id: "00000000-0000-4000-8000-000000000901",
  technicalAdmin: true,
} as const;
const bootstrapCommand = {
  tenantName: "Synthetic Idempotent Tenant",
  owner: { displayName: "Synthetic Owner", phoneE164: "+51900000201" },
  idempotencyKey: "synthetic-bootstrap-idempotency-key",
} as const;
const now = new Date("2026-01-01T00:00:00.000Z");

function bootstrapHarness() {
  const state: BootstrapState = {
    users: [],
    tenants: [],
    memberships: [],
    audits: [],
    idempotency: [],
  };
  const service = createBootstrapTenantService({
    transaction: async (work) => {
      const draft = structuredClone(state);
      const result = await work(draft);
      Object.assign(state, draft);
      return result;
    },
  });
  return { service, state };
}

function consumptionHarness() {
  const state = {
    challenge: {
      status: "ISSUED" as const,
      expiresAt: new Date(now.getTime() + 15 * 60 * 1_000),
      failedAttempts: 0,
      maxAttempts: 5,
      qrSecret: "synthetic-idempotent-qr-secret",
      manualCode: "24681357",
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
  return { service, state };
}

describe("MVP idempotency [T122]", () => {
  it("replays bootstrap with the same key and payload without duplicate rows", async () => {
    const { service, state } = bootstrapHarness();
    const first = await service.execute(bootstrapCommand, actor);
    const replay = await service.execute(bootstrapCommand, actor);
    expect(replay).toEqual(first);
    expect(state.tenants).toHaveLength(1);
    expect(state.memberships).toHaveLength(1);
    expect(state.audits).toHaveLength(1);
    expect(state.idempotency).toHaveLength(1);
  });

  it("rejects bootstrap key reuse with a different payload", async () => {
    const { service, state } = bootstrapHarness();
    await service.execute(bootstrapCommand, actor);
    await expect(
      service.execute(
        { ...bootstrapCommand, tenantName: "Changed Tenant" },
        actor,
      ),
    ).rejects.toThrow("idempotency request conflicts");
    expect(state.tenants).toHaveLength(1);
    expect(state.memberships).toHaveLength(1);
  });

  it("replays activation issuance as a sanitized result without reissuing secrets", async () => {
    const state = {
      challenges: [] as Array<Record<string, unknown>>,
      aliases: [] as Array<Record<string, unknown>>,
      logs: [] as unknown[],
      audits: [] as Array<Record<string, unknown>>,
    };
    const service = createActivationSecretService(state);
    const boundary = new IdempotencyBoundary();
    const execute = () =>
      boundary.execute({
        scope: "tenant-a:ACTIVATION_ISSUE",
        key: "same-key",
        request: {
          membershipId: "membership-a",
          purpose: "INITIAL_ACTIVATION",
        },
        operation: async () => {
          const issued = await service.issue(now, state);
          const challenge = state.challenges[0];
          if (challenge === undefined || typeof challenge["id"] !== "string") {
            throw new Error("Activation challenge was not created.");
          }
          const safe = {
            challengeId: challenge["id"],
            expiresAt: issued.expiresAt,
            maxAttempts: 5,
            status: "ISSUED",
          } as const;
          state.audits.push({
            action: "ACTIVATION_ISSUED",
            challengeId: challenge["id"],
          });
          return { firstResponse: issued, replayResponse: safe };
        },
      });
    const first = await execute();
    const replay = await execute();
    const firstIssue = first as { qrSecret?: unknown; manualCode?: unknown };
    expect(typeof firstIssue.qrSecret).toBe("string");
    expect(typeof firstIssue.manualCode).toBe("string");
    expect(replay).toMatchObject({ status: "ISSUED", maxAttempts: 5 });
    expect(replay).not.toHaveProperty("qrSecret");
    expect(replay).not.toHaveProperty("manualCode");
    expect(state.challenges).toHaveLength(1);
    expect(state.aliases).toHaveLength(1);
    expect(state.audits).toHaveLength(1);
    expect(boundary.serialized()).not.toContain(
      (first as { qrSecret: string }).qrSecret,
    );
    expect(boundary.serialized()).not.toContain(
      (first as { manualCode: string }).manualCode,
    );
  });

  it("replays activation consumption with one real Device/Profile mutation", async () => {
    const { service, state } = consumptionHarness();
    const boundary = new IdempotencyBoundary();
    const audits: Array<Record<string, unknown>> = [];
    const execute = () =>
      boundary.execute({
        scope: "tenant-a:ACTIVATION_CONSUME",
        key: "consume-key",
        request: {
          credentialAlias: "challenge-a",
          installation: "installation-a",
        },
        operation: async () => {
          const result = await service.consume(
            { type: "QR_SECRET", value: "synthetic-idempotent-qr-secret" },
            now,
          );
          const safe = { ...result, status: "PENDING_PIN" as const };
          audits.push({
            action: "ACTIVATION_CONSUMED",
            profileId: result.profileId,
          });
          return { firstResponse: safe, replayResponse: safe };
        },
      });
    const first = await execute();
    const replay = await execute();
    expect(replay).toEqual(first);
    expect(state.devices).toHaveLength(1);
    expect(state.profiles).toHaveLength(1);
    expect(audits).toHaveLength(1);
    expect(boundary.serialized()).not.toMatch(
      /"(?:qrSecret|manualCode|refreshToken|pin)"/iu,
    );
  });

  it("rejects a changed activation request under the same key without another mutation", async () => {
    const { service, state } = consumptionHarness();
    const boundary = new IdempotencyBoundary();
    const firstRequest = {
      credentialAlias: "challenge-a",
      installation: "installation-a",
    };
    await boundary.execute({
      scope: "tenant-a:ACTIVATION_CONSUME",
      key: "consume-key",
      request: firstRequest,
      operation: async () => {
        const response = await service.consume(
          { type: "QR_SECRET", value: "synthetic-idempotent-qr-secret" },
          now,
        );
        return { firstResponse: response, replayResponse: response };
      },
    });
    await expect(
      boundary.execute({
        scope: "tenant-a:ACTIVATION_CONSUME",
        key: "consume-key",
        request: { ...firstRequest, installation: "installation-b" },
        operation: () => Promise.reject(new Error("must not execute")),
      }),
    ).rejects.toMatchObject({ code: "STALE_STATE" });
    expect(state.devices).toHaveLength(1);
    expect(state.profiles).toHaveLength(1);
  });

  it("separates identical idempotency keys by tenant scope", async () => {
    const boundary = new IdempotencyBoundary();
    let mutations = 0;
    const run = (tenantId: string) =>
      boundary.execute({
        scope: `${tenantId}:ACTIVATION_ISSUE`,
        key: "shared-key",
        request: { membershipId: "membership" },
        operation: () => {
          mutations += 1;
          return Promise.resolve({
            firstResponse: { tenantId, mutation: mutations },
            replayResponse: { tenantId, mutation: mutations },
          });
        },
      });
    expect(await run("tenant-a")).toMatchObject({ tenantId: "tenant-a" });
    expect(await run("tenant-b")).toMatchObject({ tenantId: "tenant-b" });
    expect(mutations).toBe(2);
  });
});
