import { describe, expect, it } from "vitest";
import {
  calculateMovementDelta,
  InventoryMutationError,
} from "../../../src/modules/inventory/services/inventory-movement.service.js";

describe("inventory movement deltas", () => {
  it("maps receipts and positive adjustments to additions", () => {
    expect(calculateMovementDelta("RECEIPT", 4)).toBe(4);
    expect(calculateMovementDelta("POSITIVE_ADJUSTMENT", 2.5)).toBe(2.5);
  });

  it("maps negative adjustments and waste to subtractions", () => {
    expect(calculateMovementDelta("NEGATIVE_ADJUSTMENT", 4)).toBe(-4);
    expect(calculateMovementDelta("WASTE", 1.25)).toBe(-1.25);
  });

  it("rejects zero, negative and non-finite quantities", () => {
    for (const quantity of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => calculateMovementDelta("RECEIPT", quantity)).toThrow(
        InventoryMutationError,
      );
    }
  });
});
