import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";

interface TechnicalTenantServiceModule {
  buildTechnicalTenantSummary(value: unknown): unknown;
}

const servicePath = resolve(
  process.cwd(),
  "apps/api/src/modules/tenants/services/technical-tenant.service.ts",
);

async function loadSummaryBuilder(): Promise<
  TechnicalTenantServiceModule["buildTechnicalTenantSummary"]
> {
  if (!existsSync(servicePath)) {
    throw new Error(
      "[T029] technical tenant summary service is required for this privacy suite.",
    );
  }
  const module = (await import(
    pathToFileURL(servicePath).href
  )) as Partial<TechnicalTenantServiceModule>;
  if (module.buildTechnicalTenantSummary === undefined) {
    throw new Error(
      "[T029] buildTechnicalTenantSummary export is required by the privacy suite.",
    );
  }
  return module.buildTechnicalTenantSummary;
}

const source = {
  id: "00000000-0000-4000-8000-000000000001",
  name: "Synthetic Tenant A",
  status: "ACTIVE",
  createdAt: "2026-01-01T00:00:00.000Z",
  memberCount: 3,
  serviceStatus: "CONFIGURED",
  sales: [{ total: 100 }],
  clients: [{ name: "Synthetic Client" }],
  costs: [10],
  margins: [20],
  inventory: [{ quantity: 5 }],
  products: [{ sku: "SYNTHETIC" }],
  lots: ["A"],
  prices: [1],
  commercialData: { private: true },
  pin: "123456",
  phone: "+51900000001",
  accessToken: "raw-access",
  refreshToken: "raw-refresh",
  qrSecret: "raw-secret",
};

describe("technical tenant summary privacy [T026; HU-001; FR-004; SC-009]", () => {
  it("returns only the approved technical allowlist", async () => {
    const summary = (await loadSummaryBuilder())(source);
    expect(Object.keys(summary as object).sort()).toEqual(
      ["id", "name", "status", "memberCount", "serviceStatus"].sort(),
    );
  });

  it.each([
    "sales",
    "clients",
    "costs",
    "margins",
    "inventory",
    "products",
    "lots",
    "prices",
    "commercialData",
    "pin",
    "phone",
    "accessToken",
    "refreshToken",
    "qrSecret",
  ])("excludes %s recursively", async (forbidden) => {
    const serialized = JSON.stringify((await loadSummaryBuilder())(source));
    expect(serialized.toLowerCase()).not.toContain(forbidden.toLowerCase());
  });
});
