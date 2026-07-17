import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";

interface HarnessAuditEvent {
  readonly action: string;
  readonly tenantId: string;
  readonly correlationId: string;
  readonly result: "SUCCEEDED" | "DENIED" | "FAILED";
  readonly before: unknown;
  readonly after: unknown;
}

interface AuditTransactionState {
  changes: string[];
  events: HarnessAuditEvent[];
}

interface AuditTransactionHarness {
  execute(input: {
    operation: string;
    tenantId: string;
    correlationId: string;
    before?: unknown;
    after?: unknown;
    failOperation?: boolean;
    failAudit?: boolean;
  }): Promise<void>;
}

interface AuditTransactionModule {
  MVP_AUDITED_OPERATIONS: readonly string[];
  createAuditedTransactionHarness(options: {
    state: AuditTransactionState;
  }): AuditTransactionHarness;
}

const integrationPath = resolve(
  process.cwd(),
  "apps/api/src/modules/audit/mvp-audit.integration.ts",
);

async function loadModule(): Promise<AuditTransactionModule> {
  try {
    const module = (await import(
      pathToFileURL(integrationPath).href
    )) as Partial<AuditTransactionModule>;
    if (
      module.MVP_AUDITED_OPERATIONS === undefined ||
      module.createAuditedTransactionHarness === undefined
    ) {
      throw new Error("missing audit integration exports");
    }
    return module as AuditTransactionModule;
  } catch {
    throw new Error(
      "[T077-T078] The centralized transactional audit integration is not implemented.",
    );
  }
}

const tenantA = "00000000-0000-4000-8000-000000000001";
const correlationId = "00000000-0000-4000-8000-000000000901";

async function setup() {
  const state: AuditTransactionState = { changes: [], events: [] };
  const module = await loadModule();
  return {
    module,
    state,
    harness: module.createAuditedTransactionHarness({ state }),
  };
}

describe("transactional MVP audit [T074; HU-008; FR-023..FR-025; SC-004]", () => {
  it("declares every sensitive MVP operation as audited", async () => {
    const { module } = await setup();
    expect(module.MVP_AUDITED_OPERATIONS).toEqual(
      expect.arrayContaining([
        "TENANT_BOOTSTRAPPED",
        "IDENTITY_CHANGED",
        "MEMBERSHIP_CREATED",
        "ACTIVATION_ISSUED",
        "ACTIVATION_CONSUMED",
        "PIN_DEVICE_CONFIGURED",
        "SESSION_STARTED",
        "SESSION_REFRESHED",
        "SESSION_ENDED",
        "ACTIVE_TENANT_CHANGED",
        "MEMBERSHIP_ROLES_CHANGED",
        "MEMBERSHIP_DISABLED",
        "MEMBERSHIP_REACTIVATED",
        "TENANT_ACCESS_DENIED",
      ]),
    );
  });

  it("commits the sensitive change and exactly one event together", async () => {
    const { state, harness } = await setup();
    await harness.execute({
      operation: "MEMBERSHIP_CREATED",
      tenantId: tenantA,
      correlationId,
      after: { membershipId: "membership-a" },
    });
    expect(state.changes).toEqual(["MEMBERSHIP_CREATED"]);
    expect(state.events).toHaveLength(1);
    expect(state.events[0]).toMatchObject({
      action: "MEMBERSHIP_CREATED",
      tenantId: tenantA,
      correlationId,
      result: "SUCCEEDED",
    });
  });

  it("rolls back the main change when inserting AuditEvent fails", async () => {
    const { state, harness } = await setup();
    await expect(
      harness.execute({
        operation: "TENANT_BOOTSTRAPPED",
        tenantId: tenantA,
        correlationId,
        failAudit: true,
      }),
    ).rejects.toThrow("AuditEvent");
    expect(state).toEqual({ changes: [], events: [] });
  });

  it("does not write a false event when the main operation fails", async () => {
    const { state, harness } = await setup();
    await expect(
      harness.execute({
        operation: "ACTIVATION_CONSUMED",
        tenantId: tenantA,
        correlationId,
        failOperation: true,
      }),
    ).rejects.toThrow("operation");
    expect(state).toEqual({ changes: [], events: [] });
  });

  it("never leaves a partial result and only records confirmed changes", async () => {
    const { state, harness } = await setup();
    await harness.execute({
      operation: "SESSION_ENDED",
      tenantId: tenantA,
      correlationId,
    });
    await expect(
      harness.execute({
        operation: "MEMBERSHIP_DISABLED",
        tenantId: tenantA,
        correlationId,
        failAudit: true,
      }),
    ).rejects.toThrow();
    expect(state.changes).toEqual(["SESSION_ENDED"]);
    expect(state.events.map(({ action }) => action)).toEqual(["SESSION_ENDED"]);
  });

  it("recursively sanitizes snapshots and preserves the correlation id", async () => {
    const { state, harness } = await setup();
    await harness.execute({
      operation: "PIN_DEVICE_CONFIGURED",
      tenantId: tenantA,
      correlationId,
      before: { phone: "+51987654321", nested: [{ pin: "123456" }] },
      after: {
        accessToken: "raw-access",
        refreshToken: "raw-refresh",
        qrSecret: "raw-qr",
      },
    });
    const serialized = JSON.stringify(state.events);
    expect(serialized).not.toMatch(
      /\+51987654321|123456|raw-access|raw-refresh|raw-qr/u,
    );
    expect(state.events[0]?.correlationId).toBe(correlationId);
    expect(serialized).toContain("[REDACTED]");
  });
});
