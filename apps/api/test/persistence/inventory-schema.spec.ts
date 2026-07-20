import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const schema = readFileSync(
  resolve(process.cwd(), "prisma/schema.prisma"),
  "utf8",
);
const migration = readFileSync(
  resolve(
    process.cwd(),
    "prisma/migrations/0002_product_inventory_lots/migration.sql",
  ),
  "utf8",
);

describe("inventory persistence contract", () => {
  it("contains tenant-scoped operational models", () => {
    for (const model of [
      "ProductCategory",
      "UnitOfMeasure",
      "Product",
      "Lot",
      "InventoryMovement",
      "InventoryBalance",
    ]) {
      expect(schema).toContain(`model ${model}`);
    }
    expect(schema).toMatch(/tenantId\s+String\s+@db\.Uuid/u);
  });

  it("defines composite tenant relationships and non-negative safeguards", () => {
    expect(migration).toMatch(/tenantId.*NOT NULL/isu);
    expect(migration).toMatch(/UNIQUE.*tenantId/isu);
    expect(migration).toMatch(/FOREIGN KEY.*tenantId/isu);
    expect(migration).toMatch(
      /CHECK.*quantity|CHECK.*balance|CHECK.*available/isu,
    );
  });

  it("does not introduce a shared inventory ownership path", () => {
    expect(migration).not.toMatch(/shared[_ ]tenant|TENANT_SHARED/iu);
  });
});
