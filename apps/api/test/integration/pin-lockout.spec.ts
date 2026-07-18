import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it, vi } from "vitest";

interface LockoutProfile {
  status: "ACTIVE" | "LOCKED" | "REVOKED";
  membershipStatus: "ACTIVE" | "DISABLED";
  failedPinAttempts: number;
  lockedUntil: Date | null;
  pinHash: string;
}

interface AttemptState {
  profile: LockoutProfile;
  audits: Array<Record<string, unknown>>;
}

interface PinAttemptService {
  attempt(options: {
    pin: string;
    serverNow: Date;
    deviceNow?: Date;
  }): Promise<{ authenticated: boolean }>;
}

interface PinModule {
  createPinAttemptService(options: {
    state: AttemptState;
    transaction: <T>(work: (draft: AttemptState) => Promise<T>) => Promise<T>;
    verifyHash?: (pin: string, hash: string) => Promise<boolean>;
  }): PinAttemptService;
}

const servicePath = resolve(
  process.cwd(),
  "apps/api/src/modules/auth/services/pin.service.ts",
);

async function loadModule(): Promise<PinModule> {
  if (!existsSync(servicePath)) {
    throw new Error(
      "[T044] pin.service.ts lockout behavior is required by T042.",
    );
  }
  const module = (await import(
    pathToFileURL(servicePath).href
  )) as Partial<PinModule>;
  if (module.createPinAttemptService === undefined) {
    throw new Error(
      "[T044] createPinAttemptService export is required by T042.",
    );
  }
  return { createPinAttemptService: module.createPinAttemptService };
}

const start = new Date("2026-01-01T00:00:00.000Z");

async function setup(
  overrides?: Partial<LockoutProfile>,
  verifyHash?: (pin: string, hash: string) => Promise<boolean>,
) {
  const state: AttemptState = {
    profile: {
      status: "ACTIVE",
      membershipStatus: "ACTIVE",
      failedPinAttempts: 0,
      lockedUntil: null,
      pinHash: "synthetic-hash",
      ...overrides,
    },
    audits: [],
  };
  const service = (await loadModule()).createPinAttemptService({
    state,
    ...(verifyHash === undefined ? {} : { verifyHash }),
    transaction: async <T>(work: (draft: AttemptState) => Promise<T>) => {
      const draft = structuredClone(state);
      const result = await work(draft);
      Object.assign(state, draft);
      return result;
    },
  });
  return { state, service };
}

async function expectSafeFailure(promise: Promise<unknown>): Promise<void> {
  await expect(promise).rejects.toMatchObject({
    code: "AUTHENTICATION_FAILED",
  });
}

describe("server-side PIN lockout [T042; HU-002; FR-027, FR-036]", () => {
  it("increments the server-side counter after every failure", async () => {
    const { state, service } = await setup();
    await expectSafeFailure(
      service.attempt({ pin: "000000", serverNow: start }),
    );
    expect(state.profile.failedPinAttempts).toBe(1);
  });

  it("allows four failures without entering permanent lockout", async () => {
    const { state, service } = await setup();
    for (let attempt = 0; attempt < 4; attempt += 1) {
      await expectSafeFailure(
        service.attempt({ pin: "000000", serverNow: start }),
      );
    }
    expect(state.profile.failedPinAttempts).toBe(4);
    expect(state.profile.lockedUntil).toBeNull();
  });

  it("locks for exactly 15 minutes on the fifth failure", async () => {
    const { state, service } = await setup();
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await expectSafeFailure(
        service.attempt({ pin: "000000", serverNow: start }),
      );
    }
    expect(state.profile.status).toBe("LOCKED");
    expect(state.profile.lockedUntil?.getTime()).toBe(
      start.getTime() + 15 * 60 * 1_000,
    );
  });

  it("cannot evade the fifth failure with concurrent requests", async () => {
    const { state, service } = await setup({ failedPinAttempts: 4 });
    const results = await Promise.allSettled([
      service.attempt({ pin: "000000", serverNow: start }),
      service.attempt({ pin: "000000", serverNow: start }),
    ]);
    expect(results.every(({ status }) => status === "rejected")).toBe(true);
    expect(state.profile.status).toBe("LOCKED");
    expect(state.profile.failedPinAttempts).toBeGreaterThanOrEqual(5);
  });

  it("does not verify hashes while the profile is locked", async () => {
    const verifyHash = vi.fn(() => Promise.resolve(true));
    const { service } = await setup(
      {
        status: "LOCKED",
        failedPinAttempts: 5,
        lockedUntil: new Date(start.getTime() + 15 * 60 * 1_000),
      },
      verifyHash,
    );
    await expectSafeFailure(
      service.attempt({ pin: "123456", serverNow: start }),
    );
    expect(verifyHash).not.toHaveBeenCalled();
  });

  it("uses server time and ignores a manipulated device clock", async () => {
    const { service } = await setup({
      status: "LOCKED",
      failedPinAttempts: 5,
      lockedUntil: new Date(start.getTime() + 15 * 60 * 1_000),
    });
    await expectSafeFailure(
      service.attempt({
        pin: "123456",
        serverNow: start,
        deviceNow: new Date(start.getTime() + 24 * 60 * 60 * 1_000),
      }),
    );
  });

  it("allows a new attempt after 15 minutes", async () => {
    const { service } = await setup({
      status: "LOCKED",
      failedPinAttempts: 5,
      lockedUntil: new Date(start.getTime() + 15 * 60 * 1_000),
    });
    await expect(
      service.attempt({
        pin: "123456",
        serverNow: new Date(start.getTime() + 15 * 60 * 1_000 + 1),
      }),
    ).resolves.toEqual({ authenticated: true });
  });

  it("resets failures after a correct PIN", async () => {
    const { state, service } = await setup({ failedPinAttempts: 3 });
    await service.attempt({ pin: "123456", serverNow: start });
    expect(state.profile.failedPinAttempts).toBe(0);
    expect(state.profile.lockedUntil).toBeNull();
  });

  it.each([
    { status: "REVOKED" as const, membershipStatus: "ACTIVE" as const },
    { status: "ACTIVE" as const, membershipStatus: "DISABLED" as const },
  ])("rejects revoked profile or disabled Membership %#", async (overrides) => {
    const { service } = await setup(overrides);
    await expectSafeFailure(
      service.attempt({ pin: "123456", serverNow: start }),
    );
  });

  it("returns the same anti-enumeration error for every hidden cause", async () => {
    const errors: unknown[] = [];
    for (const overrides of [
      { status: "REVOKED" as const },
      { membershipStatus: "DISABLED" as const },
      {
        failedPinAttempts: 5,
        status: "LOCKED" as const,
        lockedUntil: new Date(start.getTime() + 1),
      },
    ]) {
      const { service } = await setup(overrides);
      try {
        await service.attempt({ pin: "000000", serverNow: start });
      } catch (error) {
        errors.push(error);
      }
    }
    expect(errors).toHaveLength(3);
    expect(errors.map((error) => JSON.stringify(error))).toEqual([
      JSON.stringify(errors[0]),
      JSON.stringify(errors[0]),
      JSON.stringify(errors[0]),
    ]);
    expect(JSON.stringify(errors)).not.toMatch(
      /pin|profile|device|membership/iu,
    );
  });

  it("audits lockout without including the PIN", async () => {
    const { state, service } = await setup({ failedPinAttempts: 4 });
    await expectSafeFailure(
      service.attempt({ pin: "000000", serverNow: start }),
    );
    expect(state.audits).toEqual([
      expect.objectContaining({ action: "PIN_PROFILE_LOCKED" }),
    ]);
    expect(JSON.stringify(state.audits)).not.toContain("000000");
  });
});
