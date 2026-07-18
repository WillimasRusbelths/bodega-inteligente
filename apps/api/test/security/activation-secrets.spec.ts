import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";

interface SecretState {
  challenges: Array<Record<string, unknown>>;
  aliases: Array<Record<string, unknown>>;
  logs: unknown[];
  audits: unknown[];
}

interface IssuedSecrets {
  qrSecret: string;
  manualCode: string;
  expiresAt: Date;
}

interface ActivationSecretService {
  issue(now: Date, state: SecretState): Promise<IssuedSecrets>;
  replay(state: SecretState): Promise<Record<string, unknown>>;
  verifyQr(secret: string, state: SecretState, now: Date): Promise<boolean>;
  verifyManual(code: string, state: SecretState, now: Date): Promise<boolean>;
}

const servicePath = resolve(
  process.cwd(),
  "apps/api/src/modules/activation/services/issue-activation.service.ts",
);

async function loadService(
  state: SecretState,
): Promise<ActivationSecretService> {
  if (!existsSync(servicePath)) {
    throw new Error("[T038] issue-activation.service.ts is required by T032.");
  }
  const module = (await import(pathToFileURL(servicePath).href)) as {
    createActivationSecretService?: (
      state: SecretState,
    ) => ActivationSecretService;
  };
  if (module.createActivationSecretService === undefined) {
    throw new Error(
      "[T038] createActivationSecretService export is required by T032.",
    );
  }
  return module.createActivationSecretService(state);
}

function state(): SecretState {
  return { challenges: [], aliases: [], logs: [], audits: [] };
}

function decodeBase64Url(value: string): Buffer {
  expect(value).toMatch(/^[A-Za-z0-9_-]+$/u);
  expect(value).not.toContain("=");
  return Buffer.from(value, "base64url");
}

describe("activation secret security [T032; HU-002; FR-027, FR-031]", () => {
  it("generates an opaque base64url QR secret with at least 128 bits", async () => {
    const store = state();
    const issued = await (await loadService(store)).issue(new Date(), store);
    expect(decodeBase64Url(issued.qrSecret).byteLength).toBeGreaterThanOrEqual(
      16,
    );
  });

  it("generates an independent manual alias of exactly eight digits", async () => {
    const store = state();
    const issued = await (await loadService(store)).issue(new Date(), store);
    expect(issued.manualCode).toMatch(/^\d{8}$/u);
    expect(issued.manualCode).not.toBe(issued.qrSecret);
    expect(issued.qrSecret).not.toContain(issued.manualCode);
  });

  it("produces independent QR secrets and manual aliases across issues", async () => {
    const store = state();
    const service = await loadService(store);
    const first = await service.issue(new Date(), store);
    const second = await service.issue(new Date(), store);
    expect(first.qrSecret).not.toBe(second.qrSecret);
    expect(first.manualCode).not.toBe(second.manualCode);
  });

  it("persists only hashes and never raw credentials", async () => {
    const store = state();
    const issued = await (await loadService(store)).issue(new Date(), store);
    const persisted = JSON.stringify({
      challenges: store.challenges,
      aliases: store.aliases,
    });
    expect(persisted).toMatch(/qrSecretHash/iu);
    expect(persisted).toMatch(/codeHash/iu);
    expect(persisted).not.toContain(issued.qrSecret);
    expect(persisted).not.toContain(issued.manualCode);
  });

  it("does not expose raw credentials on replay", async () => {
    const store = state();
    const service = await loadService(store);
    const issued = await service.issue(new Date(), store);
    const replay = JSON.stringify(await service.replay(store));
    expect(replay).not.toContain(issued.qrSecret);
    expect(replay).not.toContain(issued.manualCode);
  });

  it("keeps raw values out of logs and AuditEvent", async () => {
    const store = state();
    const issued = await (await loadService(store)).issue(new Date(), store);
    const telemetry = JSON.stringify({
      logs: store.logs,
      audits: store.audits,
    });
    expect(telemetry).not.toContain(issued.qrSecret);
    expect(telemetry).not.toContain(issued.manualCode);
  });

  it("verifies valid hashes and rejects near-matches", async () => {
    const store = state();
    const service = await loadService(store);
    const issued = await service.issue(new Date(), store);
    expect(await service.verifyQr(issued.qrSecret, store, new Date())).toBe(
      true,
    );
    expect(
      await service.verifyQr(`${issued.qrSecret}x`, store, new Date()),
    ).toBe(false);
    expect(
      await service.verifyManual(issued.manualCode, store, new Date()),
    ).toBe(true);
    expect(await service.verifyManual("00000000", store, new Date())).toBe(
      false,
    );
  });

  it("expires both credentials after the approved 15-minute TTL", async () => {
    const store = state();
    const now = new Date("2026-01-01T00:00:00.000Z");
    const service = await loadService(store);
    const issued = await service.issue(now, store);
    expect(issued.expiresAt.getTime() - now.getTime()).toBe(15 * 60 * 1_000);
    const expired = new Date(now.getTime() + 15 * 60 * 1_000 + 1);
    expect(await service.verifyQr(issued.qrSecret, store, expired)).toBe(false);
    expect(await service.verifyManual(issued.manualCode, store, expired)).toBe(
      false,
    );
  });
});
