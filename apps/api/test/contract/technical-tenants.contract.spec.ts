import { existsSync, readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

interface TechnicalTenantContract {
  validateCreateRequest(
    body: unknown,
    idempotencyKey: string | undefined,
  ): unknown;
  serializeBootstrap(value: unknown): unknown;
  serializeError(value: unknown): unknown;
}

const controllerPath = resolve(
  process.cwd(),
  "apps/api/src/modules/tenants/technical-tenants.controller.ts",
);

async function loadContract(): Promise<TechnicalTenantContract> {
  if (!existsSync(controllerPath)) {
    throw new Error(
      "[T027-T030] technical tenant controller and DTO validation are required for this contract suite.",
    );
  }
  const module = (await import(pathToFileURL(controllerPath).href)) as {
    technicalTenantContract?: TechnicalTenantContract;
  };
  if (module.technicalTenantContract === undefined) {
    throw new Error(
      "[T030] technicalTenantContract export is required by the contract suite.",
    );
  }
  return module.technicalTenantContract;
}

const validRequest = {
  tenantName: "Synthetic Tenant Contract",
  owner: { displayName: "Synthetic Owner Contract", phone: "+51900000001" },
};

function asRecord(value: unknown): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Expected an object response.");
  }
  return value as Record<string, unknown>;
}

describe("createTenantWithFirstOwner contract [T024; HU-001; FR-001..FR-004, FR-023]", () => {
  it("matches the approved OpenAPI operation and schemas", () => {
    const openapi = readFileSync(
      resolve(
        process.cwd(),
        "specs/001-multi-tenant-access/contracts/openapi.yaml",
      ),
      "utf8",
    );
    expect(openapi).toContain("operationId: createTenantWithFirstOwner");
    expect(openapi).toContain("#/components/schemas/CreateTenantRequest");
    expect(openapi).toContain("#/components/schemas/TenantBootstrap");
    expect(openapi).toContain("#/components/parameters/IdempotencyKey");
  });

  it("accepts a valid tenant and first-owner request", async () => {
    const contract = await loadContract();
    expect(() =>
      contract.validateCreateRequest(validRequest, "synthetic-key-0001"),
    ).not.toThrow();
  });

  it.each([{}, { tenantName: "Synthetic" }, { owner: validRequest.owner }])(
    "rejects missing required fields %#",
    async (body) => {
      const contract = await loadContract();
      expect(() =>
        contract.validateCreateRequest(body, "synthetic-key-0001"),
      ).toThrow();
    },
  );

  it("requires an Idempotency-Key between 16 and 128 characters", async () => {
    const contract = await loadContract();
    for (const key of [undefined, "short", "x".repeat(129)]) {
      expect(() => contract.validateCreateRequest(validRequest, key)).toThrow();
    }
  });

  it("rejects unknown or unauthorized request fields", async () => {
    const contract = await loadContract();
    const body = {
      ...validRequest,
      sales: [],
      tenantId: "00000000-0000-4000-8000-000000000001",
    };
    expect(() =>
      contract.validateCreateRequest(body, "synthetic-key-0001"),
    ).toThrow();
  });

  it("serializes an ACTIVE tenant and identifies the first owner membership", async () => {
    const response = (await loadContract()).serializeBootstrap({
      tenant: {
        id: "00000000-0000-4000-8000-000000000001",
        name: "Synthetic",
        status: "ACTIVE",
        version: 1,
      },
      firstOwner: {
        id: "00000000-0000-4000-8000-000000000002",
        userId: "00000000-0000-4000-8000-000000000003",
        roles: ["owner_admin"],
      },
    });
    const record = asRecord(response);
    expect(asRecord(record["tenant"])["status"]).toBe("ACTIVE");
    expect(typeof asRecord(record["firstOwner"])["userId"]).toBe("string");
  });

  it("does not serialize commercial or secret fields in the technical response", async () => {
    const serialized = JSON.stringify(
      (await loadContract()).serializeBootstrap({
        ...validRequest,
        sales: [1],
        costs: [2],
        pin: "123456",
      }),
    );
    expect(serialized).not.toMatch(/sales|costs|123456/iu);
  });

  it("returns safe errors with code, generic message and correlationId", async () => {
    const error = asRecord(
      (await loadContract()).serializeError(
        new Error("phone +51900000001 already exists"),
      ),
    );
    expect(typeof error["code"]).toBe("string");
    expect(typeof error["message"]).toBe("string");
    expect(typeof error["correlationId"]).toBe("string");
    expect(JSON.stringify(error)).not.toContain("+51900000001");
  });
});
