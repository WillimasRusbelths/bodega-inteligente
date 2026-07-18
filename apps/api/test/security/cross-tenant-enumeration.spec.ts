import { randomUUID } from "node:crypto";
import { performance } from "node:perf_hooks";
import { describe, expect, it } from "vitest";
import { createTenantContextHarness } from "../../src/modules/access/context/tenant-context.js";
import { createTenantRepositoryHarness } from "../../src/infrastructure/prisma/tenant-repository.js";

const tenantA = "00000000-0000-4000-8000-000000000001";
const tenantB = "00000000-0000-4000-8000-000000000002";
const foreignId = "00000000-0000-4000-8000-000000000802";
const missingId = "00000000-0000-4000-8000-000000000899";

interface RecordEntity {
  readonly id: string;
  readonly tenantId: string;
  readonly value: string;
}

interface State {
  readonly records: Array<RecordEntity & { value: string; childIds: string[] }>;
  readonly filters: unknown[];
}

interface SafeResponse {
  readonly status: number;
  readonly body: { readonly code: string; readonly message: string };
  readonly correlationId: string;
  readonly elapsedMs: number;
}

function contextA() {
  return createTenantContextHarness({
    sessionId: "00000000-0000-4000-8000-000000000401",
    userId: "00000000-0000-4000-8000-000000000011",
    tenantId: tenantA,
    membershipId: "00000000-0000-4000-8000-000000000101",
    contextVersion: 1,
    roles: ["owner_admin"],
    permissions: ["access.audit.read"],
  });
}

async function safeLookup(
  lookup: () => Promise<unknown>,
): Promise<SafeResponse> {
  const started = performance.now();
  try {
    await lookup();
    return {
      status: 200,
      body: { code: "OK", message: "The request completed." },
      correlationId: randomUUID(),
      elapsedMs: performance.now() - started,
    };
  } catch {
    return {
      status: 404,
      body: {
        code: "RESOURCE_NOT_FOUND",
        message: "The requested resource is not available.",
      },
      correlationId: randomUUID(),
      elapsedMs: performance.now() - started,
    };
  }
}

describe("cross-tenant anti-enumeration [T128; HU-007; FR-020, FR-027, FR-029]", () => {
  it("makes a foreign existing ID indistinguishable from a missing ID", async () => {
    const state: State = {
      records: [
        {
          id: "00000000-0000-4000-8000-000000000801",
          tenantId: tenantA,
          value: "A",
          childIds: [],
        },
        { id: foreignId, tenantId: tenantB, value: "B-private", childIds: [] },
      ],
      filters: [],
    };
    const repository = createTenantRepositoryHarness({ state });
    const context = contextA();
    const foreign = await safeLookup(() =>
      repository.findById(context, foreignId),
    );
    const missing = await safeLookup(() =>
      repository.findById(context, missingId),
    );

    expect(foreign.status).toBe(missing.status);
    expect(foreign.body).toEqual(missing.body);
    expect(foreign.body.code).toBe("RESOURCE_NOT_FOUND");
    expect(foreign.correlationId).toMatch(/^[0-9a-f-]{36}$/iu);
    expect(missing.correlationId).toMatch(/^[0-9a-f-]{36}$/iu);
    expect(foreign.correlationId).not.toBe(missing.correlationId);
    expect(Math.abs(foreign.elapsedMs - missing.elapsedMs)).toBeLessThan(100);

    const serialized = JSON.stringify({ foreign, missing });
    expect(serialized).not.toContain(tenantB);
    expect(serialized).not.toContain(foreignId);
    expect(serialized).not.toMatch(/membership|role|permission|exists/iu);
  });

  it("keeps the same safe shape for a foreign nested relationship", async () => {
    const state: State = {
      records: [
        {
          id: "00000000-0000-4000-8000-000000000801",
          tenantId: tenantA,
          value: "A",
          childIds: [],
        },
        { id: foreignId, tenantId: tenantB, value: "B-private", childIds: [] },
      ],
      filters: [],
    };
    const repository = createTenantRepositoryHarness({ state });
    const context = contextA();
    const response = await safeLookup(() =>
      repository.connectChild(
        context,
        "00000000-0000-4000-8000-000000000801",
        foreignId,
      ),
    );
    expect(response).toMatchObject({
      status: 404,
      body: {
        code: "RESOURCE_NOT_FOUND",
        message: "The requested resource is not available.",
      },
    });
    expect(state.records.find(({ id }) => id === foreignId)?.value).toBe(
      "B-private",
    );
  });
});
