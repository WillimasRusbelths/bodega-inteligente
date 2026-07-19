import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseMovementCreateDto } from "../../src/modules/inventory/dto/movement.dto.js";
import { serializeMovement } from "../../src/modules/lots/dto/lot-response.dto.js";

const contract = readFileSync(
  "specs/002-product-inventory-lots/contracts/openapi.yaml",
  "utf8",
);

describe("inventory contract [T048-T049]", () => {
  it("exposes the approved stock and movement operations", () => {
    expect(contract).toContain("operationId: listInventoryBalances");
    expect(contract).toContain("operationId: listInventoryMovements");
    expect(contract).toContain("operationId: createInventoryMovement");
    expect(contract).not.toContain("operationId: createSale");
  });

  it("accepts strict movement input without tenantId", () => {
    expect(
      parseMovementCreateDto({
        productId: "00000000-0000-4000-8000-000000006001",
        lotId: "00000000-0000-4000-8000-000000006002",
        type: "WASTE",
        quantity: 1,
        reason: "Merma documentada",
      }),
    ).toMatchObject({ type: "WASTE", quantity: 1 });
    expect(() =>
      parseMovementCreateDto({
        productId: "00000000-0000-4000-8000-000000006001",
        lotId: "00000000-0000-4000-8000-000000006002",
        type: "RECEIPT",
        quantity: 0,
        reason: "Inválido",
      }),
    ).toThrow();
    expect(() =>
      parseMovementCreateDto({
        productId: "00000000-0000-4000-8000-000000006001",
        lotId: "00000000-0000-4000-8000-000000006002",
        type: "RECEIPT",
        quantity: 1,
        reason: "No tenant en body",
        tenantId: "00000000-0000-4000-8000-000000006099",
      }),
    ).toThrow();
  });

  it("serializes operational movements without cost fields", () => {
    const result = serializeMovement({
      id: "00000000-0000-4000-8000-000000006003",
      tenantId: "00000000-0000-4000-8000-000000006004",
      productId: "00000000-0000-4000-8000-000000006001",
      lotId: "00000000-0000-4000-8000-000000006002",
      type: "RECEIPT",
      quantity: { toString: () => "2" },
      quantityDelta: { toString: () => "2" },
      balanceBefore: { toString: () => "0" },
      balanceAfter: { toString: () => "2" },
      reason: "Ingreso",
      actorId: "00000000-0000-4000-8000-000000006005",
      createdAt: new Date("2026-07-01T00:00:00.000Z"),
    });
    expect(result).not.toHaveProperty("unitCost");
    expect(result).toMatchObject({ quantity: 2, balanceAfter: 2 });
  });
});
