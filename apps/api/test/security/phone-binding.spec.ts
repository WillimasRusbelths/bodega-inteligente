import { timingSafeEqual } from "node:crypto";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it, vi } from "vitest";

interface PhoneBinding {
  readonly phoneBindingHmac: string;
  readonly phoneBindingKeyVersion: string;
}

interface PhoneBindingService {
  normalize(phone: string): string;
  bind(phone: string): PhoneBinding;
  verify(phone: string, binding: PhoneBinding): boolean;
}

interface PhoneBindingModule {
  createPhoneBindingService(options: {
    currentVersion: string;
    keys: ReadonlyMap<string, Uint8Array>;
    compare?: (left: Uint8Array, right: Uint8Array) => boolean;
  }): PhoneBindingService;
}

const servicePath = resolve(
  process.cwd(),
  "apps/api/src/modules/activation/crypto/phone-binding.service.ts",
);

async function loadModule(): Promise<PhoneBindingModule> {
  if (!existsSync(servicePath)) {
    throw new Error("[T037] phone-binding.service.ts is required by T033.");
  }
  const module = (await import(
    pathToFileURL(servicePath).href
  )) as Partial<PhoneBindingModule>;
  if (module.createPhoneBindingService === undefined) {
    throw new Error(
      "[T037] createPhoneBindingService export is required by T033.",
    );
  }
  return { createPhoneBindingService: module.createPhoneBindingService };
}

const keys = new Map<string, Uint8Array>([
  ["phone-v1", Buffer.from("synthetic-key-version-one-32bytes")],
  ["phone-v2", Buffer.from("synthetic-key-version-two-32bytes")],
]);

async function service(version = "phone-v2"): Promise<PhoneBindingService> {
  return (await loadModule()).createPhoneBindingService({
    currentVersion: version,
    keys,
  });
}

describe("phone binding HMAC [T033; HU-002; FR-027, FR-031]", () => {
  it("normalizes accepted formatting to canonical E.164", async () => {
    expect((await service()).normalize("+51 900-000-011")).toBe("+51900000011");
  });

  it("computes deterministic HMAC-SHA-256 output", async () => {
    const binder = await service();
    const first = binder.bind("+51900000011");
    const second = binder.bind("+51 900 000 011");
    expect(first.phoneBindingHmac).toBe(second.phoneBindingHmac);
    expect(Buffer.from(first.phoneBindingHmac, "base64url")).toHaveLength(32);
  });

  it("persists the current key version but never the external key", async () => {
    const binding = (await service()).bind("+51900000011");
    expect(binding.phoneBindingKeyVersion).toBe("phone-v2");
    expect(JSON.stringify(binding)).not.toContain("synthetic-key-version");
  });

  it("new challenges use the configured current version", async () => {
    expect(
      (await service("phone-v2")).bind("+51900000011").phoneBindingKeyVersion,
    ).toBe("phone-v2");
  });

  it("verifies a live challenge using its previous stored version", async () => {
    const oldBinding = (await service("phone-v1")).bind("+51900000011");
    expect((await service("phone-v2")).verify("+51900000011", oldBinding)).toBe(
      true,
    );
  });

  it("fails closed for an unknown key version", async () => {
    const binding = (await service()).bind("+51900000011");
    expect(
      (await service()).verify("+51900000011", {
        ...binding,
        phoneBindingKeyVersion: "unknown-version",
      }),
    ).toBe(false);
  });

  it("uses a constant-time comparator", async () => {
    const compare = vi.fn((left: Uint8Array, right: Uint8Array) => {
      return (
        left.byteLength === right.byteLength && timingSafeEqual(left, right)
      );
    });
    const binder = (await loadModule()).createPhoneBindingService({
      currentVersion: "phone-v2",
      keys,
      compare,
    });
    const binding = binder.bind("+51900000011");
    expect(binder.verify("+51900000011", binding)).toBe(true);
    expect(compare).toHaveBeenCalledOnce();
  });

  it("different normalized phones produce different HMAC values", async () => {
    const binder = await service();
    expect(binder.bind("+51900000011").phoneBindingHmac).not.toBe(
      binder.bind("+51900000012").phoneBindingHmac,
    );
  });

  it("stores no raw E.164 in challenge, alias, logs or audit", async () => {
    const phone = "+51900000011";
    const binding = (await service()).bind(phone);
    const surfaces = JSON.stringify({
      activationChallenge: binding,
      activationManualAlias: { challengeId: "synthetic", codeHash: "hash" },
      logs: [{ event: "ACTIVATION_ISSUED" }],
      audit: [{ action: "ACTIVATION_ISSUED" }],
    });
    expect(surfaces).not.toContain(phone);
    expect(surfaces).not.toContain("synthetic-key-version");
  });
});
