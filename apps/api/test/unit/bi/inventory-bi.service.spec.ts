import { describe, expect, it } from "vitest";
import {
  aggregateInventoryBi,
  type InventoryBiDataset,
} from "../../../src/modules/bi/inventory-bi.service.js";

const tenantA = "00000000-0000-4000-8000-000000000001";
const tenantB = "00000000-0000-4000-8000-000000000002";
const dataset: InventoryBiDataset = {
  products: [
    {
      tenantId: tenantA,
      id: "product-a",
      name: "Leche demo",
      categoryId: "category-a",
      categoryName: "Lácteos",
      minimumStock: 10,
      expiryAlertDays: 14,
    },
    {
      tenantId: tenantB,
      id: "product-b",
      name: "Producto B",
      categoryId: "category-b",
      categoryName: "B",
      minimumStock: 1,
      expiryAlertDays: 10,
    },
  ],
  lots: [
    {
      tenantId: tenantA,
      id: "lot-a",
      productId: "product-a",
      productName: "Leche demo",
      categoryName: "Lácteos",
      expiresAt: "2026-01-05",
      availableQuantity: 4,
      unitCost: 3.5,
      status: "AVAILABLE",
    },
    {
      tenantId: tenantB,
      id: "lot-b",
      productId: "product-b",
      productName: "Producto B",
      categoryName: "B",
      expiresAt: "2026-01-02",
      availableQuantity: 20,
      unitCost: 99,
      status: "AVAILABLE",
    },
  ],
  movements: [
    {
      tenantId: tenantA,
      type: "RECEIPT",
      quantity: 4,
      createdAt: "2026-01-01T00:00:00Z",
    },
    {
      tenantId: tenantA,
      type: "WASTE",
      quantity: 1,
      createdAt: "2026-01-01T00:00:00Z",
    },
    {
      tenantId: tenantB,
      type: "RECEIPT",
      quantity: 20,
      createdAt: "2026-01-01T00:00:00Z",
    },
  ],
  alerts: [
    {
      tenantId: tenantA,
      type: "LOW_STOCK",
      status: "ACTIVE",
      productId: "product-a",
      productName: "Leche demo",
      lotId: null,
      triggeredAt: "2026-01-01T00:00:00Z",
    },
    {
      tenantId: tenantB,
      type: "EXPIRED",
      status: "ACTIVE",
      productId: "product-b",
      productName: "Producto B",
      lotId: "lot-b",
      triggeredAt: "2026-01-01T00:00:00Z",
    },
  ],
};

describe("inventory BI projection", () => {
  it("aggregates operational indicators for the authorized tenant", () => {
    const result = aggregateInventoryBi(dataset, tenantA, "inventory_manager");
    expect(result.summary).toMatchObject({
      totalProducts: 1,
      totalStockAvailable: 4,
      lowStockProducts: 1,
      activeAlerts: 1,
      inventoryValuation: 14,
    });
    expect(result.stockByCategory[0]).toMatchObject({
      categoryName: "Lácteos",
      stockAvailable: 4,
    });
    expect(result.expirationRisk[0]).toMatchObject({
      riskState: "EXPIRING_SOON",
      estimatedLoss: 14,
    });
  });

  it("does not expose costs or valuation to seller", () => {
    const result = aggregateInventoryBi(dataset, tenantA, "seller");
    expect(result.summary).not.toHaveProperty("inventoryValuation");
    expect(result.stockByCategory[0]).not.toHaveProperty("inventoryValuation");
    expect(result.expirationRisk[0]).not.toHaveProperty("estimatedLoss");
  });

  it("filters every OLAP projection by tenant", () => {
    const result = aggregateInventoryBi(dataset, tenantA, "owner_admin");
    expect(result.summary.totalProducts).toBe(1);
    expect(result.summary.totalStockAvailable).toBe(4);
    expect(result.movementSummary).toHaveLength(2);
    expect(
      result.expirationRisk.every((row) => row.productId === "product-a"),
    ).toBe(true);
    expect(JSON.stringify(result)).not.toContain("Producto B");
  });
});
