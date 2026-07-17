import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";
import {
  createTenantContextHarness,
  type TenantContext,
} from "../../src/modules/access/context/tenant-context.js";

interface AuditPrivacyEvent {
  readonly id: string;
  readonly tenantId: string;
  readonly action: string;
  readonly result: "SUCCEEDED" | "DENIED" | "FAILED";
  readonly occurredAt: string;
  readonly before?: unknown;
  readonly after?: unknown;
}

interface AuditPrivacyHarness {
  list(
    context: TenantContext | undefined,
    query?: Record<string, unknown>,
  ): Promise<{
    items: readonly Record<string, unknown>[];
    nextCursor: string | null;
  }>;
  find(
    context: TenantContext,
    eventId: string,
  ): Promise<Readonly<Record<string, unknown>>>;
}

interface AuditControllerModule {
  createAuditPrivacyHarness(options: {
    events: readonly AuditPrivacyEvent[];
  }): AuditPrivacyHarness;
}

const controllerPath = resolve(
  process.cwd(),
  "apps/api/src/modules/audit/audit.controller.ts",
);

async function loadModule(): Promise<AuditControllerModule> {
  try {
    const module = (await import(
      pathToFileURL(controllerPath).href
    )) as Partial<AuditControllerModule>;
    if (module.createAuditPrivacyHarness === undefined) {
      throw new Error("missing audit privacy harness");
    }
    return module as AuditControllerModule;
  } catch {
    throw new Error(
      "[T077-T079] Tenant-scoped sanitized audit queries are not implemented.",
    );
  }
}

const tenantA = "00000000-0000-4000-8000-000000000001";
const tenantB = "00000000-0000-4000-8000-000000000002";
const eventA = "00000000-0000-4000-8000-000000000801";
const eventB = "00000000-0000-4000-8000-000000000802";

function context(
  tenantId: string,
  permissions: readonly string[] = ["access.audit.read"],
): TenantContext {
  return createTenantContextHarness({
    sessionId: "00000000-0000-4000-8000-000000000701",
    userId: "00000000-0000-4000-8000-000000000011",
    tenantId,
    membershipId: "00000000-0000-4000-8000-000000000101",
    contextVersion: 1,
    roles: ["owner_admin"],
    permissions,
  });
}

function events(): readonly AuditPrivacyEvent[] {
  return [
    {
      id: eventA,
      tenantId: tenantA,
      action: "MEMBERSHIP_CREATED",
      result: "SUCCEEDED",
      occurredAt: "2026-01-01T00:00:02.000Z",
      before: { phone: "+51987654321", pinHash: "internal-pin-hash" },
      after: {
        nested: [{ manualCode: "12345678", qrSecret: "opaque-secret" }],
        accessToken: "raw-access",
        refreshToken: "raw-refresh",
        pepper: "pepper-secret",
        hmacKey: "hmac-secret",
        biometricTemplate: "biometric-template",
        inventory: { margin: 0.42, price: 99 },
      },
    },
    {
      id: eventB,
      tenantId: tenantB,
      action: "MEMBERSHIP_DISABLED",
      result: "SUCCEEDED",
      occurredAt: "2026-01-01T00:00:01.000Z",
      after: { membershipId: "membership-b" },
    },
  ];
}

async function setup() {
  const module = await loadModule();
  return module.createAuditPrivacyHarness({ events: events() });
}

async function capture(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  throw new Error("Expected operation to fail.");
}

describe("audit privacy and isolation [T076; HU-008; FR-024, FR-026, FR-027]", () => {
  it("requires an authorized TenantContext", async () => {
    const harness = await setup();
    await expect(harness.list(undefined)).rejects.toMatchObject({
      code: "AUDIT_NOT_FOUND",
    });
  });

  it("allows an owner to list only the current tenant", async () => {
    const harness = await setup();
    const page = await harness.list(context(tenantA));
    expect(page.items.map(({ id }) => id)).toEqual([eventA]);
    expect(JSON.stringify(page)).not.toContain(tenantB);
  });

  it("rejects non-owners and callers without the audit permission", async () => {
    const harness = await setup();
    const seller = createTenantContextHarness({
      sessionId: "session-a",
      userId: "user-a",
      tenantId: tenantA,
      membershipId: "membership-a",
      contextVersion: 1,
      roles: ["seller"],
      permissions: [],
    });
    await expect(harness.list(seller)).rejects.toMatchObject({
      code: "AUDIT_NOT_FOUND",
    });
  });

  it("returns equivalent errors for foreign and missing event identifiers", async () => {
    const harness = await setup();
    const foreign = await capture(harness.find(context(tenantA), eventB));
    const missing = await capture(
      harness.find(context(tenantA), "00000000-0000-4000-8000-000000000899"),
    );
    expect(JSON.stringify(foreign)).toBe(JSON.stringify(missing));
    expect(foreign).toMatchObject({ code: "AUDIT_NOT_FOUND" });
  });

  it("recursively removes secrets, raw E.164 and unnecessary commercial data", async () => {
    const harness = await setup();
    const page = await harness.list(context(tenantA));
    const serialized = JSON.stringify(page);
    expect(serialized).not.toMatch(
      /\+51987654321|internal-pin-hash|12345678|opaque-secret|raw-access|raw-refresh|pepper-secret|hmac-secret|biometric-template/iu,
    );
    expect(serialized).not.toMatch(/inventory|margin|price/iu);
    expect(serialized).toContain("[REDACTED]");
  });

  it("does not accept a client-selected tenant scope or unknown filters", async () => {
    const harness = await setup();
    await expect(
      harness.list(context(tenantA), { tenantId: tenantB }),
    ).rejects.toMatchObject({ code: "AUDIT_INVALID_QUERY" });
    await expect(
      harness.list(context(tenantA), { unexpected: "value" }),
    ).rejects.toMatchObject({ code: "AUDIT_INVALID_QUERY" });
  });

  it("keeps cursor pagination tenant-safe, stable and bounded", async () => {
    const harness = await setup();
    const first = await harness.list(context(tenantA), { limit: 1 });
    expect(first.items).toHaveLength(1);
    expect(first.nextCursor).toBeNull();
    await expect(
      harness.list(context(tenantA), { limit: 501 }),
    ).rejects.toMatchObject({ code: "AUDIT_INVALID_QUERY" });
  });
});
