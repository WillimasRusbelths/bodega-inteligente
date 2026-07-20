import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath = resolve(
  process.cwd(),
  "prisma/migrations/0004_inventory_datamart/migration.sql",
);

describe("inventory DataMart SQL contract", () => {
  const sql = readFileSync(migrationPath, "utf8");

  it("creates the analytical schema and required dimensions and facts", () => {
    for (const expected of [
      "CREATE SCHEMA IF NOT EXISTS dw",
      "dw.dim_tenant",
      "dw.dim_product",
      "dw.dim_category",
      "dw.dim_unit",
      "dw.dim_date",
      "dw.fact_inventory_movement",
      "dw.fact_stock_snapshot",
      "dw.fact_expiration_risk",
      "dw.fact_inventory_alert",
    ]) {
      expect(sql).toContain(expected);
    }
  });

  it("stays inside inventory scope", () => {
    expect(sql).not.toMatch(/sales|customers|ocr/iu);
  });
});
