import { describe, expect, it } from "vitest";
import { errorCatalog } from "../../../src/common/errors/error-catalog.js";

describe("inventory safe error catalog", () => {
  it("keeps inventory failures safe and non-enumerating", () => {
    expect(errorCatalog.STOCK_INSUFFICIENT.status).toBe(409);
    expect(errorCatalog.LOT_EXPIRED.status).toBe(409);
    expect(errorCatalog.IDEMPOTENCY_CONFLICT.status).toBe(409);
    expect(errorCatalog.INVENTORY_NOT_FOUND.status).toBe(404);
    for (const entry of [
      errorCatalog.STOCK_INSUFFICIENT,
      errorCatalog.LOT_EXPIRED,
      errorCatalog.IDEMPOTENCY_CONFLICT,
      errorCatalog.INVENTORY_NOT_FOUND,
    ]) {
      expect(entry.message).not.toMatch(/tenantId|unitCost|secret|token/iu);
    }
  });
});
