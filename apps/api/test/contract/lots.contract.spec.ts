import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  parseLotCreateDto,
  parseLotListQuery,
} from "../../src/modules/lots/dto/lot.dto.js";
import { parseMovementCreateDto } from "../../src/modules/inventory/dto/movement.dto.js";

describe("lots and inventory contract [T033, T037, T048]", () => {
  it("declares lot, movement and balance operationIds without sales endpoints", () => {
    const openapi = readFileSync(
      resolve(
        process.cwd(),
        "specs/002-product-inventory-lots/contracts/openapi.yaml",
      ),
      "utf8",
    );
    for (const operation of [
      "listProductLots",
      "createLotReceipt",
      "listTenantLots",
      "getLot",
      "listInventoryBalances",
      "listInventoryMovements",
      "createInventoryMovement",
    ])
      expect(openapi).toContain(`operationId: ${operation}`);
    expect(openapi).not.toMatch(/operationId:\s+.*sale/iu);
  });
  it("rejects tenantId, zero quantities and unknown fields", () => {
    expect(() =>
      parseLotCreateDto({
        receivedAt: "2026-01-01T00:00:00Z",
        expiresAt: "2027-01-01",
        initialQuantity: 1,
        unitCost: 2,
        tenantId: "00000000-0000-4000-8000-000000000001",
      }),
    ).toThrow();
    expect(() =>
      parseLotCreateDto({
        receivedAt: "2026-01-01T00:00:00Z",
        expiresAt: "2027-01-01",
        initialQuantity: 0,
        unitCost: 2,
      }),
    ).toThrow();
    expect(() =>
      parseMovementCreateDto({
        productId: "00000000-0000-4000-8000-000000000001",
        lotId: "00000000-0000-4000-8000-000000000002",
        type: "WASTE",
        quantity: 1,
        reason: "ok",
        tenantId: "00000000-0000-4000-8000-000000000001",
      }),
    ).toThrow();
  });
  it("supports tenant-wide lot filters and operational/admin projections", () => {
    expect(
      parseLotListQuery({
        productId: "00000000-0000-4000-8000-000000000001",
        categoryId: "00000000-0000-4000-8000-000000000002",
        status: "AVAILABLE",
        expiresBefore: "2027-01-01",
        expiresAfter: "2026-01-01",
        expirationState: "ACTIVE",
        cursor: "cursor",
        limit: "20",
      }),
    ).toMatchObject({
      limit: 20,
      status: "AVAILABLE",
      expirationState: "ACTIVE",
    });
  });
});
