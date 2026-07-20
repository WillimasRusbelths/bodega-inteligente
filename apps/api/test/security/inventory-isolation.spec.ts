import { describe, expect, it } from "vitest";
import { INVENTORY_TENANT_ISOLATION_MATRIX } from "./inventory-tenant-isolation.matrix.js";

describe("inventory A/B isolation matrix [T009, T077]", () => {
  it("covers every inventory resource and attack vector in both directions", () => {
    expect(
      new Set(INVENTORY_TENANT_ISOLATION_MATRIX.map((item) => item.resource)),
    ).toEqual(
      new Set([
        "Category",
        "UnitOfMeasure",
        "Product",
        "Lot",
        "InventoryBalance",
        "InventoryMovement",
        "Fefo",
        "InventoryAlert",
      ]),
    );
    for (const vector of [
      "pathParam",
      "bodyParam",
      "queryParam",
      "cursor",
      "foreignId",
      "nestedRelation",
    ] as const)
      expect(
        INVENTORY_TENANT_ISOLATION_MATRIX.some(
          (item) => item.attackVector === vector,
        ),
      ).toBe(true);
    expect(
      INVENTORY_TENANT_ISOLATION_MATRIX.some(
        (item) => item.sourceTenant === "A" && item.targetTenant === "B",
      ),
    ).toBe(true);
    expect(
      INVENTORY_TENANT_ISOLATION_MATRIX.some(
        (item) => item.sourceTenant === "B" && item.targetTenant === "A",
      ),
    ).toBe(true);
  });
});
