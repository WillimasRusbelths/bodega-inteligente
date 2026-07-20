import { describe, expect, it } from "vitest";
import {
  validateExpiryDate,
  validateIdempotencyKey,
  validateNonNegativeAmount,
  validatePage,
  validateQuantity,
  validateSearchCode,
} from "./inventory.js";

describe("inventory shared validation [T005, T012]", () => {
  it("validates quantities, costs, dates, codes, pagination and idempotency", () => {
    expect(validateQuantity(1.125, 3)).toBe(1.125);
    expect(validateNonNegativeAmount(4.25, 2)).toBe(4.25);
    expect(validateExpiryDate("2027-01-01")).toBe("2027-01-01");
    expect(validateSearchCode(" SKU-1 ", "sku")).toBe("SKU-1");
    expect(validatePage(50)).toBe(50);
    expect(validateIdempotencyKey("synthetic-key")).toBe("synthetic-key");
  });

  it("rejects zero, negative, excessive precision and malformed values", () => {
    expect(() => validateQuantity(0)).toThrow();
    expect(() => validateNonNegativeAmount(-1)).toThrow();
    expect(() => validateQuantity(1.0001, 3)).toThrow();
    expect(() => validateExpiryDate("2027-02-30")).toThrow();
    expect(() => validateSearchCode("bad value", "sku")).toThrow();
    expect(() => validatePage(101)).toThrow();
    expect(() => validateIdempotencyKey("short")).toThrow();
  });
});
