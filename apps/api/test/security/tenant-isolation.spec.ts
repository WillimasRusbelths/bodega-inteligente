import { describe, expect, it } from "vitest";
import {
  TenantPermissionError,
  TenantResourceNotFoundError,
} from "../../src/modules/access/guards/authorization-errors.js";
import { TenantGuardChain } from "../../src/modules/access/guards/tenant-guard-chain.js";
import type { TenantGuardInput } from "../../src/modules/access/guards/guard-types.js";
import {
  createTenantContextHarness,
  type TenantContext,
} from "../../src/modules/access/context/tenant-context.js";
import {
  createTenantIsolationHarness,
  type TenantIsolationResourceAdapter,
} from "./tenant-isolation.harness.js";
import { TENANT_ISOLATION_MATRIX } from "./tenant-isolation.matrix.js";

const tenantIds = {
  A: "00000000-0000-4000-8000-000000000001",
  B: "00000000-0000-4000-8000-000000000002",
} as const;
const sourceId = "00000000-0000-4000-8000-000000000801";
const foreignId = "00000000-0000-4000-8000-000000000802";
const missingId = "00000000-0000-4000-8000-000000000899";

interface SyntheticRecord {
  readonly id: string;
  readonly tenantId: string;
  value: string;
}

interface IsolationState {
  readonly records: Map<string, SyntheticRecord>;
  readonly writes: number;
  readonly denials: Array<Record<string, string>>;
}

function contextFor(tenant: "A" | "B"): TenantContext {
  return createTenantContextHarness({
    sessionId: `session-${tenant}`,
    userId: `user-${tenant}`,
    tenantId: tenantIds[tenant],
    membershipId: `membership-${tenant}`,
    contextVersion: 1,
    roles: ["owner_admin"],
    permissions: ["access.audit.read", "access.roles.manage"],
  });
}

function notFound(): never {
  throw new TenantResourceNotFoundError();
}

function permissionDenied(): never {
  throw new TenantPermissionError();
}

function recordDenial(
  state: IsolationState,
  name: string,
  context: TenantContext,
  kind: "NOT_FOUND" | "FORBIDDEN",
): never {
  state.denials.push({
    action: "TENANT_ACCESS_DENIED",
    result: "DENIED",
    resource: name,
    code:
      kind === "FORBIDDEN" ? "INSUFFICIENT_PERMISSION" : "RESOURCE_NOT_FOUND",
    tenantId: context.tenantId,
  });
  return kind === "FORBIDDEN" ? permissionDenied() : notFound();
}

function adapter(
  name: string,
  state: IsolationState,
): TenantIsolationResourceAdapter<TenantContext> {
  return {
    name,
    seed(tenantId) {
      const id = tenantId === tenantIds.A ? sourceId : foreignId;
      state.records.set(`${name}:${id}`, {
        id,
        tenantId,
        value: `${name}-${tenantId}`,
      });
    },
    async read(context, id) {
      await Promise.resolve();
      const record = state.records.get(`${name}:${id}`);
      if (record === undefined || record.tenantId !== context.tenantId)
        return recordDenial(state, name, context, "NOT_FOUND");
      return record;
    },
    async list(context, input) {
      await Promise.resolve();
      const attackVector =
        input !== null && typeof input === "object" && "attackVector" in input
          ? (input as { readonly attackVector?: string }).attackVector
          : undefined;
      if (attackVector !== undefined && attackVector !== "missingId") return [];
      return [...state.records.values()].filter(
        (record) =>
          record.tenantId === context.tenantId && record.id === sourceId,
      );
    },
    async modify(context, id) {
      await Promise.resolve();
      const record = state.records.get(`${name}:${id}`);
      if (record === undefined || record.tenantId !== context.tenantId)
        return recordDenial(state, name, context, "NOT_FOUND");
      state.records.set(`${name}:${id}`, {
        ...record,
        value: `${record.value}-updated`,
      });
      (state as { writes: number }).writes += 1;
      return { updated: true };
    },
    async admin(context, id) {
      await Promise.resolve();
      const record = state.records.get(`${name}:${id}`);
      if (record === undefined || record.tenantId !== context.tenantId)
        return recordDenial(state, name, context, "FORBIDDEN");
      state.records.set(`${name}:${id}`, {
        ...record,
        value: `${record.value}-admin`,
      });
      (state as { writes: number }).writes += 1;
      return { updated: true };
    },
    async nestedRead(context, parentId, childId) {
      await Promise.resolve();
      const parent = state.records.get(`${name}:${parentId}`);
      const child = state.records.get(`${name}:${childId}`);
      if (
        parent === undefined ||
        child === undefined ||
        parent.tenantId !== context.tenantId ||
        child.tenantId !== context.tenantId
      ) {
        return recordDenial(state, name, context, "NOT_FOUND");
      }
      return child;
    },
    async nestedWrite(context, parentId, childId) {
      await Promise.resolve();
      const parent = state.records.get(`${name}:${parentId}`);
      const child = state.records.get(`${name}:${childId}`);
      if (
        parent === undefined ||
        child === undefined ||
        parent.tenantId !== context.tenantId ||
        child.tenantId !== context.tenantId
      ) {
        return recordDenial(state, name, context, "NOT_FOUND");
      }
      (state as { writes: number }).writes += 1;
      return { updated: true };
    },
    assertNoLeakage(result, tenantId) {
      const serialized = JSON.stringify(result);
      expect(serialized).not.toContain(tenantIds[tenantId === "A" ? "B" : "A"]);
    },
  };
}

describe("Tenant A/B isolation gate [T126-T127; HU-007; FR-018..FR-020, FR-029]", () => {
  it("covers every required resource, vector and both attack directions", () => {
    const resources = new Set(
      TENANT_ISOLATION_MATRIX.map(({ resource }) => resource),
    );
    expect(resources).toEqual(
      new Set([
        "Membership",
        "Device",
        "DeviceProfile",
        "Session",
        "ActivationChallenge",
        "AuditEvent",
        "TenantContext",
        "TenantAdmin",
      ]),
    );
    expect(
      TENANT_ISOLATION_MATRIX.some(
        ({ sourceTenant, targetTenant }) =>
          sourceTenant === "A" && targetTenant === "B",
      ),
    ).toBe(true);
    expect(
      TENANT_ISOLATION_MATRIX.some(({ sourceTenant }) => sourceTenant === "B"),
    ).toBe(true);
    for (const vector of [
      "pathParam",
      "bodyParam",
      "queryParam",
      "cursor",
      "nestedRelation",
      "tenantContext",
    ] as const) {
      expect(
        TENANT_ISOLATION_MATRIX.some(
          ({ attackVector }) => attackVector === vector,
        ),
      ).toBe(true);
    }
  });

  it("rejects cross-tenant reads, writes, administration and nested relations without mutation", async () => {
    const states = new Map<string, IsolationState>();
    const harness = createTenantIsolationHarness<TenantContext>();
    for (const resource of [
      "Membership",
      "Device",
      "DeviceProfile",
      "Session",
      "ActivationChallenge",
      "AuditEvent",
      "TenantContext",
      "TenantAdmin",
    ] as const) {
      const state: IsolationState = {
        records: new Map(),
        writes: 0,
        denials: [],
      };
      states.set(resource, state);
      harness.register(adapter(resource, state));
    }
    await harness.seedAll([tenantIds.A, tenantIds.B]);
    const foreignSnapshots = new Map(
      [...states.entries()].map(([resource, state]) => [
        resource,
        state.records.get(`${resource}:${foreignId}`)?.value,
      ]),
    );
    const cases = TENANT_ISOLATION_MATRIX.filter(
      (testCase) =>
        testCase.sourceTenant === "A" &&
        testCase.targetTenant === "B" &&
        testCase.attackVector !== "tenantContext",
    );
    expect(cases.length).toBeGreaterThan(0);
    for (const testCase of cases) {
      const outcome = await harness.runCase({
        testCase,
        contextFor,
        ids: { sourceId, foreignId, missingId, childId: foreignId },
      });
      if (testCase.expected === "NO_DATA") {
        expect(outcome).toMatchObject({ kind: "success", value: [] });
      } else {
        expect(outcome.kind).toBe("error");
        if (outcome.kind === "error") {
          expect(outcome.error.code).toBe(testCase.expectedCode);
          expect(outcome.error.message).not.toMatch(
            /tenant|membership|exists|foreign/iu,
          );
        }
      }
    }
    for (const [resource, state] of states.entries()) {
      expect(state.records.get(`${resource}:${foreignId}`)?.value).toBe(
        foreignSnapshots.get(resource),
      );
      expect(state.denials.length).toBeGreaterThan(0);
      expect(JSON.stringify(state.denials)).not.toContain(foreignId);
    }
  });

  it("rejects a requested Tenant B context while authenticated in Tenant A", () => {
    const input: TenantGuardInput = {
      claims: {
        sessionId: "session-A",
        userId: "user-A",
        tenantId: tenantIds.A,
        membershipId: "membership-A",
        authVersion: 1,
        contextVersion: 1,
      },
      requestedTenantId: tenantIds.B,
      requiredPermission: "access.audit.read",
      identity: { id: "user-A", status: "ACTIVE", authVersion: 1 },
      session: {
        id: "session-A",
        userId: "user-A",
        tenantId: tenantIds.A,
        membershipId: "membership-A",
        contextVersion: 1,
        revokedAt: null,
      },
      membership: {
        id: "membership-A",
        userId: "user-A",
        tenantId: tenantIds.A,
        status: "ACTIVE",
        roles: ["owner_admin"],
        permissions: ["access.audit.read"],
      },
      tenant: { id: tenantIds.A, status: "ACTIVE" },
    };
    try {
      new TenantGuardChain().authorize(input);
      throw new Error("Cross-tenant context unexpectedly authorized.");
    } catch (error) {
      expect(error).toMatchObject({ code: "RESOURCE_NOT_FOUND" });
      expect(JSON.stringify(error)).not.toContain(tenantIds.B);
    }
  });
});
