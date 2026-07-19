import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { serializeProduct } from "../../src/modules/catalog/dto/product-response.dto.js";

describe("catalog response privacy [T023, T029, FR-006, FR-036]", () => {
  it("does not expose cost fields in the operational product projection", () => {
    const response = serializeProduct({
      id: "00000000-0000-4000-8000-000000000001",
      tenantId: "00000000-0000-4000-8000-000000000002",
      name: "Synthetic product",
      normalizedName: "synthetic product",
      sku: null,
      barcode: null,
      categoryId: null,
      unitOfMeasureId: "00000000-0000-4000-8000-000000000003",
      minimumStock: new Prisma.Decimal(0),
      expiryAlertDays: 0,
      status: "ACTIVE",
      version: 1,
      createdAt: new Date("2026-01-01T00:00:00Z"),
      updatedAt: new Date("2026-01-01T00:00:00Z"),
      deactivatedAt: null,
    });
    const serialized = JSON.stringify(response);
    expect(serialized).not.toMatch(/unitCost|cost|margin|price/iu);
    expect(response).toHaveProperty("name", "Synthetic product");
  });
});
