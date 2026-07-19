import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";
import {
  serializeLot,
  serializeBalance,
} from "../../src/modules/lots/dto/lot-response.dto.js";

describe("inventory cost privacy [T044, T049, FR-006, FR-036]", () => {
  it("keeps costs out of seller projections while allowing admin projections", () => {
    const lot = {
      id: "00000000-0000-4000-8000-000000000001",
      tenantId: "00000000-0000-4000-8000-000000000002",
      productId: "00000000-0000-4000-8000-000000000003",
      receivedAt: new Date("2026-01-01T00:00:00Z"),
      expiresAt: new Date("2027-01-01T00:00:00Z"),
      initialQuantity: new Prisma.Decimal(10),
      availableQuantity: new Prisma.Decimal(10),
      unitCost: new Prisma.Decimal(4.5),
      status: "AVAILABLE" as const,
      version: 1,
      createdBy: "00000000-0000-4000-8000-000000000004",
      createdAt: new Date("2026-01-01T00:00:00Z"),
      updatedAt: new Date("2026-01-01T00:00:00Z"),
    };
    expect(serializeLot(lot, false)).not.toHaveProperty("unitCost");
    expect(serializeLot(lot, true)).toHaveProperty("unitCost", 4.5);
    const balance = {
      tenantId: lot.tenantId,
      productId: lot.productId,
      lotId: lot.id,
      availableQuantity: new Prisma.Decimal(10),
    };
    expect(serializeBalance(balance)).not.toHaveProperty("unitCost");
    expect(serializeBalance(balance, new Prisma.Decimal(4.5))).toHaveProperty(
      "unitCost",
      4.5,
    );
  });
});
