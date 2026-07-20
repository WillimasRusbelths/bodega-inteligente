import { describe, expect, it } from "vitest";
import { parseInventoryConfig } from "./inventory.config.js";

describe("inventory configuration [T003]", () => {
  it("uses deterministic tenant-safe defaults", () => {
    expect(parseInventoryConfig({})).toMatchObject({
      quantityScale: 3,
      currencyScale: 2,
      currencyCode: "PEN",
      defaultMinimumStock: 0,
      defaultExpirationWarningDays: 0,
    });
  });

  it("rejects invalid precision and currency values", () => {
    expect(() => parseInventoryConfig({ INVENTORY_QUANTITY_SCALE: "7" })).toThrow();
    expect(() => parseInventoryConfig({ INVENTORY_CURRENCY: "sol" })).toThrow();
  });
});
