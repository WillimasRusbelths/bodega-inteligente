import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const contractPath = resolve(
  process.cwd(),
  "specs/002-product-inventory-lots/contracts/openapi.yaml",
);

const extractOpenApiPaths = (yaml: string): string[] =>
  Array.from(yaml.matchAll(/^ {2}(\/[^:\n]+):$/gmu), (match) => match[1] ?? "");

describe("002 OpenAPI contract conformance", () => {
  const contract = readFileSync(contractPath, "utf8");
  const pathKeys = extractOpenApiPaths(contract);
  const allowedBiPaths = [
    "/tenants/current/bi/inventory-summary",
    "/tenants/current/bi/stock-by-category",
    "/tenants/current/bi/expiration-risk",
    "/tenants/current/bi/movement-summary",
    "/tenants/current/bi/alerts-summary",
  ];

  it("declares every MVP operation family", () => {
    for (const operationId of [
      "listCategories",
      "createCategory",
      "listUnits",
      "createUnit",
      "listProducts",
      "createProduct",
      "createLotReceipt",
      "listTenantLots",
      "listInventoryBalances",
      "listInventoryMovements",
      "suggestFefoLots",
      "listInventoryAlerts",
      "resolveInventoryAlert",
      "getInventorySummary",
      "getStockByCategory",
      "getExpirationRisk",
      "getMovementSummary",
      "getAlertsSummary",
    ]) {
      expect(contract).toContain(`operationId: ${operationId}`);
    }
  });

  it("keeps tenant-scoped paths and forbids out-of-scope route markers", () => {
    expect(pathKeys).toContain("/tenants/current/products");
    expect(pathKeys).toContain("/tenants/current/lots");
    expect(pathKeys).toContain("/tenants/current/alerts/{alertId}/resolve");
    for (const forbidden of [
      "/sales",
      "/customers",
      "/ocr",
      "/offline",
      "/pairing",
      "/promotions",
      "/ai",
      "/replenishment",
    ]) {
      expect(pathKeys.some((path) => path.startsWith(forbidden))).toBe(false);
    }
  });

  it("allows BI only through the approved tenant-scoped inventory routes", () => {
    const biPaths = pathKeys.filter((path) => path.includes("/bi"));

    expect([...biPaths].sort()).toEqual([...allowedBiPaths].sort());
    expect(pathKeys).not.toContain("/bi");
    expect(pathKeys).not.toContain("/api/bi");
    expect(pathKeys).not.toContain("/tenants/{tenantId}/bi");
    for (const biPath of biPaths) {
      expect(biPath.startsWith("/tenants/current/bi/")).toBe(true);
    }
  });

  it("defines partial product updates and role-specific projections", () => {
    expect(contract).toContain("ProductUpdateRequest:");
    expect(contract).toContain("LotOperationalResponse:");
    expect(contract).toContain("LotAdminResponse:");
    expect(contract).toContain("InventoryBalanceOperational:");
    expect(contract).toContain("InventoryBalanceAdmin:");
  });
});
