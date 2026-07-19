import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  parseAlertListQuery,
  parseAlertResolveDto,
} from "../../src/modules/alerts/dto/alert.dto.js";
import { parseFefoSuggestionQuery } from "../../src/modules/inventory/dto/fefo.dto.js";

const contract = readFileSync(
  "specs/002-product-inventory-lots/contracts/openapi.yaml",
  "utf8",
);

describe("FEFO and alert contracts [T056, T064]", () => {
  it("exposes only the approved FEFO and alert operations", () => {
    expect(contract).toContain("operationId: suggestFefoLots");
    expect(contract).toContain("operationId: listInventoryAlerts");
    expect(contract).toContain("operationId: resolveInventoryAlert");
    expect(contract).toContain("/tenants/current/alerts/{alertId}/resolve:");
    expect(contract).not.toContain("operationId: createSale");
  });

  it("strictly validates FEFO and alert inputs", () => {
    expect(
      parseFefoSuggestionQuery({
        productId: "00000000-0000-4000-8000-000000007001",
        quantity: 3,
      }),
    ).toMatchObject({ quantity: 3 });
    expect(
      parseAlertListQuery({ type: "EXPIRED", status: "ACTIVE", limit: 10 }),
    ).toMatchObject({ type: "EXPIRED" });
    expect(
      parseAlertResolveDto({ status: "RESOLVED", reason: "Revisada" }),
    ).toMatchObject({ status: "RESOLVED" });
    expect(() => parseAlertResolveDto({ status: "ACTIVE" })).toThrow();
  });
});
