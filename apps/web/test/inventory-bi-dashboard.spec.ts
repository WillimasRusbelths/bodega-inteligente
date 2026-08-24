import { describe, expect, it } from "vitest";
import type { InventoryBiApi } from "../src/features/bi/inventory-bi-client.js";
import { InventoryBiDashboardController } from "../src/features/bi/inventory-bi-dashboard.js";

describe("inventory BI dashboard acquisition [T024]", () => {
  it("keeps fulfilled BI resources available when another existing read fails", async () => {
    const api = {
      inventorySummary: async () => ({ totalProducts: 1, totalStockAvailable: 4, lowStockProducts: 0, productsExpiringSoon: 0, productsExpired: 0, activeAlerts: 0 }),
      stockByCategory: async () => [{ categoryId: null, categoryName: "General", stockAvailable: 4, lowStockProducts: 0 }],
      expirationRisk: async () => { throw new Error("offline"); },
      movementSummary: async () => [],
      alertsSummary: async () => [],
    } as unknown as InventoryBiApi;
    const controller = new InventoryBiDashboardController(api, "owner_admin");
    await controller.load();
    expect(controller.state.status).toBe("READY");
    expect(controller.state.resources?.summary.status).toBe("READY");
    expect(controller.state.resources?.expirationRisk).toEqual({ status: "ERROR", message: "No se pudo cargar el resumen BI de inventario." });
    expect(controller.state.stockByCategory).toHaveLength(1);
  });
});
