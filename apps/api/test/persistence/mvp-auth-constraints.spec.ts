import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const schemaPath = resolve(process.cwd(), "prisma/schema.prisma");

function loadSchema(): string {
  if (!existsSync(schemaPath)) {
    throw new Error(
      "[T019-T022] prisma/schema.prisma is required to satisfy the persistence constraints.",
    );
  }
  return readFileSync(schemaPath, "utf8");
}

function model(schema: string, name: string): string {
  const match = new RegExp(
    `model\\s+${name}\\s+\\{([\\s\\S]*?)\\n\\}`,
    "u",
  ).exec(schema);
  if (match?.[1] === undefined)
    throw new Error(`Expected Prisma model ${name}.`);
  return match[1];
}

function expectFields(contents: string, fields: readonly string[]): void {
  for (const field of fields)
    expect(contents).toMatch(new RegExp(`\\b${field}\\s+`, "u"));
}

describe("MVP auth persistence constraints [T018; FR-005, FR-031, FR-035, FR-039]", () => {
  it("stores only a unique QR secret hash on ActivationChallenge", () => {
    const challenge = model(loadSchema(), "ActivationChallenge");
    expect(challenge).toMatch(/\bqrSecretHash\s+(String|Bytes)\s+@unique/u);
    expect(challenge).not.toMatch(/\bqrSecret\s+/u);
  });

  it("makes a manual alias unique per challenge and by code hash", () => {
    const alias = model(loadSchema(), "ActivationManualAlias");
    expect(alias).toMatch(/\bchallengeId\s+String\s+@unique/u);
    expect(alias).toMatch(/\bcodeHash\s+(String|Bytes)\s+@unique/u);
    expect(alias).not.toMatch(/\b(manualCode|code)\s+/u);
  });

  it("provides server timestamps and fixed attempts for the 15-minute activation TTL", () => {
    const challenge = model(loadSchema(), "ActivationChallenge");
    expectFields(challenge, [
      "createdAt",
      "expiresAt",
      "maxAttempts",
      "failedAttempts",
    ]);
    expect(challenge).toMatch(/\bmaxAttempts\s+Int\s+@default\(5\)/u);
    expect(model(loadSchema(), "ActivationManualAlias")).toMatch(
      /\bexpiresAt\s+DateTime\b/u,
    );
  });

  it("supports exactly one terminal consumption of a challenge", () => {
    const challenge = model(loadSchema(), "ActivationChallenge");
    expectFields(challenge, [
      "status",
      "consumedAt",
      "consumedByDeviceProfileId",
      "revokedAt",
    ]);
    const states = loadSchema();
    for (const state of ["ISSUED", "CONSUMED", "EXPIRED", "REVOKED"]) {
      expect(states).toMatch(new RegExp(`\\b${state}\\b`, "u"));
    }
  });

  it("stores PIN only as hash and approved version metadata", () => {
    const profile = model(loadSchema(), "DeviceProfile");
    expectFields(profile, ["pinHash", "pinSaltVersion", "pinPepperVersion"]);
    expect(profile).not.toMatch(/\bpin\s+/iu);
  });

  it("stores refresh credentials only through a unique token hash", () => {
    const refresh = model(loadSchema(), "RefreshCredential");
    expect(refresh).toMatch(/\btokenHash\s+(String|Bytes)\s+@unique/u);
    expect(refresh).not.toMatch(/\b(refreshToken|token)\s+/u);
  });

  it("models refresh rotation, replacement, reuse detection and revocation", () => {
    expectFields(model(loadSchema(), "RefreshCredential"), [
      "sessionId",
      "familyId",
      "rotatedAt",
      "replacedById",
      "revokedAt",
      "reuseDetectedAt",
    ]);
  });

  it("scopes idempotency by actor, tenant, operation and hashed key", () => {
    const record = model(loadSchema(), "IdempotencyRecord");
    expectFields(record, [
      "scopeActorId",
      "tenantId",
      "operation",
      "idempotencyKeyHash",
      "requestHash",
    ]);
    expect(record).toMatch(
      /@@unique\(\s*\[\s*scopeActorId\s*,\s*tenantId\s*,\s*operation\s*,\s*idempotencyKeyHash\s*\]/u,
    );
    expect(record).not.toMatch(/\bidempotencyKey\s+/u);
  });

  it("binds ActivationChallenge to Membership within the same tenant", () => {
    const challenge = model(loadSchema(), "ActivationChallenge");
    expectFields(challenge, ["tenantId", "membershipId"]);
    expect(challenge).toMatch(
      /@relation\([^)]*fields:\s*\[\s*tenantId\s*,\s*membershipId\s*\][^)]*references:\s*\[\s*tenantId\s*,\s*id\s*\]/u,
    );
  });

  it("contains no raw activation, PIN, or refresh credential columns", () => {
    const schema = loadSchema();
    for (const forbidden of ["qrSecret", "manualCode", "pin", "refreshToken"]) {
      expect(schema).not.toMatch(new RegExp(`^\\s*${forbidden}\\s+`, "gmu"));
    }
  });
});
