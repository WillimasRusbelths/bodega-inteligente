import { describe, expect, it } from "vitest";
import { assertSafeEnvironment } from "../../src/config/environment.guard.js";

const safeTestEnvironment = {
  nodeEnvironment: "test",
  appEnvironment: "test",
  databaseEnvironment: "test",
  secretsEnvironment: "test",
  databaseUrl: "postgresql://test:test@localhost:5432/bodegia_test",
} as const;

describe("environment guard", () => {
  it("accepts an isolated test environment", () => {
    expect(() => assertSafeEnvironment(safeTestEnvironment)).not.toThrow();
  });

  it.each([
    "appEnvironment",
    "databaseEnvironment",
    "secretsEnvironment",
  ] as const)("rejects production in tests through %s", (field) => {
    expect(() =>
      assertSafeEnvironment({ ...safeTestEnvironment, [field]: "production" }),
    ).toThrow();
  });

  it("rejects mixed environment URLs and secrets", () => {
    expect(() =>
      assertSafeEnvironment({
        ...safeTestEnvironment,
        secretsEnvironment: "staging",
      }),
    ).toThrow();
  });

  it("rejects production-looking database credentials in tests", () => {
    expect(() =>
      assertSafeEnvironment({
        ...safeTestEnvironment,
        databaseUrl: "postgresql://prod-user:secret@prod-db.example/bodegia",
      }),
    ).toThrow();
  });

  it("fails safely when required configuration is absent", () => {
    const { databaseUrl: _omitted, ...incomplete } = safeTestEnvironment;
    expect(_omitted).toBe(safeTestEnvironment.databaseUrl);
    expect(() => assertSafeEnvironment(incomplete)).toThrow();
  });
});
