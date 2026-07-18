import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";

interface PinProfile {
  id: string;
  status: "PENDING_PIN" | "ACTIVE" | "LOCKED" | "REVOKED";
  pinHash?: string;
  pinSaltVersion?: string;
  pinPepperVersion?: string;
}

interface PinState {
  logs: unknown[];
  audits: unknown[];
  errors: unknown[];
}

interface PinService {
  validate(pin: string): void;
  setup(pin: string, profile: PinProfile, state: PinState): Promise<void>;
  verify(pin: string, profile: PinProfile): Promise<boolean>;
}

interface PinModule {
  createPinService(options: {
    currentPepperVersion: string;
    peppers: ReadonlyMap<string, Uint8Array>;
  }): PinService;
}

const pinServicePath = resolve(
  process.cwd(),
  "apps/api/src/modules/auth/services/pin.service.ts",
);
const argonConfigPath = resolve(
  process.cwd(),
  "apps/api/src/modules/auth/crypto/argon2.config.ts",
);

async function loadModule(): Promise<PinModule> {
  if (!existsSync(pinServicePath) || !existsSync(argonConfigPath)) {
    throw new Error(
      "[T044] pin.service.ts and Argon2id configuration are required by T041.",
    );
  }
  const module = (await import(
    pathToFileURL(pinServicePath).href
  )) as Partial<PinModule>;
  if (module.createPinService === undefined) {
    throw new Error("[T044] createPinService export is required by T041.");
  }
  return { createPinService: module.createPinService };
}

const peppers = new Map<string, Uint8Array>([
  ["pepper-v1", Buffer.from("synthetic-pin-pepper-version-one")],
  ["pepper-v2", Buffer.from("synthetic-pin-pepper-version-two")],
]);

async function service(version = "pepper-v2"): Promise<PinService> {
  return (await loadModule()).createPinService({
    currentPepperVersion: version,
    peppers,
  });
}

function pendingProfile(id: string): PinProfile {
  return { id, status: "PENDING_PIN" };
}

function emptyState(): PinState {
  return { logs: [], audits: [], errors: [] };
}

describe("PIN hashing security [T041; HU-002; FR-034, FR-036]", () => {
  it("accepts exactly six digits", async () => {
    const pinService = await service();
    expect(() => pinService.validate("123456")).not.toThrow();
  });

  it.each(["12345", "1234567", "12a456", "123 456", " 123456", "123456 "])(
    "rejects invalid PIN %j",
    async (pin) => {
      const pinService = await service();
      expect(() => pinService.validate(pin)).toThrow();
    },
  );

  it("stores an Argon2id encoded hash", async () => {
    const profile = pendingProfile("profile-a");
    await (await service()).setup("123456", profile, emptyState());
    expect(profile.pinHash).toMatch(/^\$argon2id\$/u);
  });

  it("uses an individual random salt for each profile", async () => {
    const pinService = await service();
    const first = pendingProfile("profile-a");
    const second = pendingProfile("profile-b");
    await pinService.setup("123456", first, emptyState());
    await pinService.setup("123456", second, emptyState());
    expect(first.pinHash).not.toBe(second.pinHash);
  });

  it("persists only the hash and version identifiers, never the pepper", async () => {
    const profile = pendingProfile("profile-a");
    await (await service()).setup("123456", profile, emptyState());
    expect(profile.pinPepperVersion).toBe("pepper-v2");
    expect(profile.pinSaltVersion).toBeTypeOf("string");
    expect(JSON.stringify(profile)).not.toContain("synthetic-pin-pepper");
  });

  it("uses the current pepper version for new hashes", async () => {
    const profile = pendingProfile("profile-a");
    await (await service("pepper-v2")).setup("123456", profile, emptyState());
    expect(profile.pinPepperVersion).toBe("pepper-v2");
  });

  it("verifies a live hash made with a previous pepper version", async () => {
    const profile = pendingProfile("profile-a");
    await (await service("pepper-v1")).setup("123456", profile, emptyState());
    expect(await (await service("pepper-v2")).verify("123456", profile)).toBe(
      true,
    );
  });

  it("fails closed for an unknown pepper version", async () => {
    const profile = pendingProfile("profile-a");
    await (await service()).setup("123456", profile, emptyState());
    profile.pinPepperVersion = "unknown-version";
    expect(await (await service()).verify("123456", profile)).toBe(false);
  });

  it("never persists or emits the raw PIN", async () => {
    const pin = "123456";
    const profile = pendingProfile("profile-a");
    const state = emptyState();
    await (await service()).setup(pin, profile, state);
    expect(JSON.stringify({ profile, state })).not.toContain(pin);
  });

  it("verifies correct PIN and rejects an incorrect PIN", async () => {
    const profile = pendingProfile("profile-a");
    const pinService = await service();
    await pinService.setup("123456", profile, emptyState());
    expect(await pinService.verify("123456", profile)).toBe(true);
    expect(await pinService.verify("654321", profile)).toBe(false);
  });

  it("does not make the PIN recoverable from its hash", async () => {
    const profile = pendingProfile("profile-a");
    await (await service()).setup("123456", profile, emptyState());
    expect(profile.pinHash).not.toContain("123456");
    expect(profile.pinHash).not.toMatch(/^\d{6}$/u);
  });

  it("allows initial setup only from PENDING_PIN", async () => {
    for (const status of ["ACTIVE", "LOCKED", "REVOKED"] as const) {
      const profile: PinProfile = { id: `profile-${status}`, status };
      await expect(
        (await service()).setup("123456", profile, emptyState()),
      ).rejects.toBeDefined();
    }
  });

  it("moves a profile to ACTIVE after successful setup", async () => {
    const profile = pendingProfile("profile-a");
    await (await service()).setup("123456", profile, emptyState());
    expect(profile.status).toBe("ACTIVE");
  });
});
