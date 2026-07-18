import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";

type Credential =
  | { readonly type: "QR_SECRET"; readonly value: string }
  | { readonly type: "MANUAL_CODE"; readonly value: string };

interface ChallengeState {
  status: "ISSUED" | "CONSUMED";
  expiresAt: Date;
  failedAttempts: number;
  maxAttempts: number;
  qrSecret: string;
  manualCode: string;
}

interface ConsumptionState {
  challenge: ChallengeState;
  devices: Array<{ id: string; type: "PERSONAL" }>;
  profiles: Array<{ id: string; status: "PENDING_PIN" }>;
}

interface ConsumptionService {
  consume(
    credential: Credential,
    now: Date,
  ): Promise<{ deviceId: string; profileId: string }>;
}

interface ConsumptionModule {
  createActivationConsumptionService(options: {
    state: ConsumptionState;
    transaction: <T>(
      work: (draft: ConsumptionState) => Promise<T>,
    ) => Promise<T>;
    failAfterDevice?: boolean;
  }): ConsumptionService;
}

const servicePath = resolve(
  process.cwd(),
  "apps/api/src/modules/activation/services/consume-activation.service.ts",
);

async function loadModule(): Promise<ConsumptionModule> {
  if (!existsSync(servicePath)) {
    throw new Error(
      "[T039] consume-activation.service.ts is required by T034.",
    );
  }
  const module = (await import(
    pathToFileURL(servicePath).href
  )) as Partial<ConsumptionModule>;
  if (module.createActivationConsumptionService === undefined) {
    throw new Error(
      "[T039] createActivationConsumptionService export is required by T034.",
    );
  }
  return {
    createActivationConsumptionService:
      module.createActivationConsumptionService,
  };
}

const now = new Date("2026-01-01T00:00:00.000Z");

function setup(overrides?: Partial<ChallengeState>, failAfterDevice = false) {
  const state: ConsumptionState = {
    challenge: {
      status: "ISSUED",
      expiresAt: new Date(now.getTime() + 15 * 60 * 1_000),
      failedAttempts: 0,
      maxAttempts: 5,
      qrSecret: "synthetic-valid-qr",
      manualCode: "12345678",
      ...overrides,
    },
    devices: [],
    profiles: [],
  };
  return {
    state,
    create: async (): Promise<ConsumptionService> =>
      (await loadModule()).createActivationConsumptionService({
        state,
        failAfterDevice,
        transaction: async <T>(
          work: (draft: ConsumptionState) => Promise<T>,
        ) => {
          const draft = structuredClone(state);
          const result = await work(draft);
          Object.assign(state, draft);
          return result;
        },
      }),
  };
}

const qr = { type: "QR_SECRET", value: "synthetic-valid-qr" } as const;
const manual = { type: "MANUAL_CODE", value: "12345678" } as const;

describe("activation single consumption [T034; HU-002; FR-029, FR-031, FR-039]", () => {
  it("allows QR and manual alias to address the same challenge", async () => {
    for (const credential of [qr, manual]) {
      const harness = setup();
      await (await harness.create()).consume(credential, now);
      expect(harness.state.challenge.status).toBe("CONSUMED");
    }
  });

  it("has exactly one winner across concurrent QR and manual requests", async () => {
    const harness = setup();
    const service = await harness.create();
    const results = await Promise.allSettled([
      service.consume(qr, now),
      service.consume(manual, now),
    ]);
    expect(results.filter(({ status }) => status === "fulfilled")).toHaveLength(
      1,
    );
    expect(results.filter(({ status }) => status === "rejected")).toHaveLength(
      1,
    );
    expect(harness.state.devices).toHaveLength(1);
    expect(harness.state.profiles).toHaveLength(1);
  });

  it("returns the same safe failure shape after consumption", async () => {
    const harness = setup();
    const service = await harness.create();
    await service.consume(qr, now);
    await expect(service.consume(manual, now)).rejects.toMatchObject({
      code: "AUTHENTICATION_FAILED",
    });
  });

  it("enforces an exact 15-minute TTL", () => {
    expect(setup().state.challenge.expiresAt.getTime() - now.getTime()).toBe(
      15 * 60 * 1_000,
    );
  });

  it("rejects an expired challenge without device writes", async () => {
    const harness = setup({ expiresAt: new Date(now.getTime() - 1) });
    await expect(
      (await harness.create()).consume(qr, now),
    ).rejects.toBeDefined();
    expect(harness.state.devices).toHaveLength(0);
    expect(harness.state.profiles).toHaveLength(0);
  });

  it("shares the maximum five failures across alternating channels", async () => {
    const harness = setup();
    const service = await harness.create();
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const invalid: Credential =
        attempt % 2 === 0
          ? { type: "QR_SECRET", value: `invalid-${attempt}` }
          : { type: "MANUAL_CODE", value: "00000000" };
      await expect(service.consume(invalid, now)).rejects.toBeDefined();
    }
    expect(harness.state.challenge.failedAttempts).toBe(5);
    await expect(service.consume(qr, now)).rejects.toMatchObject({
      code: "AUTHENTICATION_FAILED",
    });
  });

  it("marks one successful consumption and creates pending PIN records", async () => {
    const harness = setup();
    await (await harness.create()).consume(manual, now);
    expect(harness.state.challenge.status).toBe("CONSUMED");
    expect(harness.state.devices).toEqual([
      expect.objectContaining({ type: "PERSONAL" }),
    ]);
    expect(harness.state.profiles).toEqual([
      expect.objectContaining({ status: "PENDING_PIN" }),
    ]);
  });

  it("rolls back Device and DeviceProfile when persistence fails", async () => {
    const harness = setup(undefined, true);
    await expect(
      (await harness.create()).consume(qr, now),
    ).rejects.toBeDefined();
    expect(harness.state.devices).toHaveLength(0);
    expect(harness.state.profiles).toHaveLength(0);
    expect(harness.state.challenge.status).toBe("ISSUED");
  });
});
