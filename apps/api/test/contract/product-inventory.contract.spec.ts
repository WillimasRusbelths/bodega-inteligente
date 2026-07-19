import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { catalogContract } from "../../src/modules/catalog/catalog.controller.js";

const openapiPath = resolve(
  process.cwd(),
  "specs/002-product-inventory-lots/contracts/openapi.yaml",
);

describe("catalog contract [T011, T026, T028, T029]", () => {
  it("declares the approved category, unit and product operationIds", () => {
    const openapi = readFileSync(openapiPath, "utf8");
    for (const operation of [
      "listCategories",
      "createCategory",
      "updateCategory",
      "setCategoryStatus",
      "listUnits",
      "createUnit",
      "updateUnit",
      "setUnitStatus",
      "listProducts",
      "createProduct",
      "getProduct",
      "updateProduct",
    ])
      expect(openapi).toContain(`operationId: ${operation}`);
  });

  it("rejects tenantId and unknown fields at every write boundary", () => {
    expect(() =>
      catalogContract.validateCategoryCreate({
        name: "Synthetic",
        tenantId: "00000000-0000-4000-8000-000000000001",
      }),
    ).toThrow();
    expect(() =>
      catalogContract.validateUnitCreate({
        code: "UN",
        name: "Unidad",
        quantityScale: 0,
        tenantId: "00000000-0000-4000-8000-000000000001",
      }),
    ).toThrow();
    expect(() =>
      catalogContract.validateProductCreate({
        name: "Synthetic",
        unitOfMeasureId: "00000000-0000-4000-8000-000000000001",
        unknown: true,
      }),
    ).toThrow();
  });

  it("keeps ProductUpdateRequest partial and validates If-Match separately", () => {
    expect(
      catalogContract.validateProductUpdate({ name: "Solo nombre" }),
    ).toEqual({ name: "Solo nombre" });
    expect(catalogContract.validateProductUpdate({ minimumStock: 3 })).toEqual({
      minimumStock: 3,
    });
    expect(() => catalogContract.validateProductUpdate({})).toThrow();
  });

  it("requires Idempotency-Key length for creates and status uses the approved enum", () => {
    expect(() => catalogContract.validateIdempotencyKey(undefined)).toThrow();
    expect(catalogContract.validateIdempotencyKey("catalog-key-000001")).toBe(
      "catalog-key-000001",
    );
    expect(catalogContract.validateStatus({ status: "ACTIVE" })).toEqual({
      status: "ACTIVE",
    });
    expect(() =>
      catalogContract.validateStatus({ status: "DISABLED" }),
    ).toThrow();
  });
});
