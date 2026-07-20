import { describe, expect, it } from "vitest";
import {
  parseCategoryCreateDto,
  parseCatalogStatusDto,
} from "../../../src/modules/catalog/dto/category.dto.js";
import { parseUnitCreateDto } from "../../../src/modules/catalog/dto/unit.dto.js";
import {
  parseProductCreateDto,
  parseProductUpdateDto,
} from "../../../src/modules/catalog/dto/product.dto.js";

const unitId = "00000000-0000-4000-8000-000000000101";

describe("catalog product/category/unit validation", () => {
  it("normalizes text and preserves tenant-scoped create fields", () => {
    expect(parseCategoryCreateDto({ name: "  Abarrotes  " })).toEqual({
      name: "Abarrotes",
    });
    expect(
      parseUnitCreateDto({
        code: " KG ",
        name: " Kilogramo ",
        quantityScale: 3,
      }),
    ).toEqual({ code: "KG", name: "Kilogramo", quantityScale: 3 });
    expect(
      parseProductCreateDto({ name: " Arroz ", unitOfMeasureId: unitId }),
    ).toEqual({ name: "Arroz", unitOfMeasureId: unitId });
  });

  it("accepts only approved lifecycle states and partial updates", () => {
    expect(parseCatalogStatusDto({ status: "ACTIVE" })).toEqual({
      status: "ACTIVE",
    });
    expect(parseCatalogStatusDto({ status: "INACTIVE" })).toEqual({
      status: "INACTIVE",
    });
    expect(parseProductUpdateDto({ minimumStock: 2 })).toEqual({
      minimumStock: 2,
    });
    expect(() => parseCatalogStatusDto({ status: "DISABLED" })).toThrow();
    expect(() => parseProductUpdateDto({})).toThrow();
  });

  it("rejects tenant injection and unknown fields at the DTO boundary", () => {
    expect(() =>
      parseCategoryCreateDto({ name: "A", tenantId: "tenant-b" }),
    ).toThrow();
    expect(() =>
      parseProductCreateDto({
        name: "A",
        unitOfMeasureId: unitId,
        extra: true,
      }),
    ).toThrow();
  });
});
