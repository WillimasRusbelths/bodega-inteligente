import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const contractPath = resolve(
  process.cwd(),
  "specs/002-product-inventory-lots/contracts/openapi.yaml",
);

describe("002 OpenAPI contract conformance", () => {
  const contract = readFileSync(contractPath, "utf8");

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
    ]) {
      expect(contract).toContain(`operationId: ${operationId}`);
    }
  });

  it("keeps tenant-scoped paths and forbids out-of-scope route markers", () => {
    expect(contract).toContain("/tenants/current/products");
    expect(contract).toContain("/tenants/current/lots");
    expect(contract).toContain("/tenants/current/alerts/{alertId}/resolve");
    for (const forbidden of [
      "/sales",
      "/customers",
      "/ocr",
      "/bi",
      "/offline",
      "/pairing",
    ]) {
      expect(contract).not.toContain(forbidden);
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
