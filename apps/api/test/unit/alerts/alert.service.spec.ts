import { describe, expect, it } from "vitest";
import { evaluateAlertConditions } from "../../../src/modules/alerts/services/alert.service.js";

describe("alert rules [T057]", () => {
  it("evaluates low stock, expiring soon and expired conditions", () => {
    const conditions = evaluateAlertConditions({
      totalStock: 2,
      minimumStock: 5,
      expiryAlertDays: 7,
      today: "2026-07-19",
      lots: [
        {
          id: "soon",
          expiresAt: new Date("2026-07-22T00:00:00.000Z"),
          availableQuantity: 2,
        },
        {
          id: "expired",
          expiresAt: new Date("2026-07-01T00:00:00.000Z"),
          availableQuantity: 1,
        },
        {
          id: "empty",
          expiresAt: new Date("2026-07-20T00:00:00.000Z"),
          availableQuantity: 0,
        },
      ],
    });
    expect(conditions.map((condition) => condition.type)).toEqual([
      "LOW_STOCK",
      "EXPIRING_SOON",
      "EXPIRED",
    ]);
  });

  it("does not trigger low stock at or above the configured threshold", () => {
    expect(
      evaluateAlertConditions({
        totalStock: 5,
        minimumStock: 5,
        expiryAlertDays: 0,
        today: "2026-07-19",
        lots: [],
      }),
    ).toHaveLength(0);
  });
});
