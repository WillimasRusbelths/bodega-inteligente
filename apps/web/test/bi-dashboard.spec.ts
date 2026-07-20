import { describe, expect, it, vi } from "vitest";
import type { WebApiClient } from "../src/api/client.js";
import { InventoryBiApi } from "../src/features/bi/inventory-bi-client.js";
import {
  InventoryBiDashboardController,
  renderInventoryBiDashboard,
} from "../src/features/bi/inventory-bi-dashboard.js";

function fakeApi() {
  const request = vi.fn();
  return {
    api: new InventoryBiApi({ request } as unknown as WebApiClient),
    request,
  };
}

const summary = {
  totalProducts: 1,
  totalStockAvailable: 4,
  lowStockProducts: 1,
  productsExpiringSoon: 1,
  productsExpired: 0,
  activeAlerts: 1,
  inventoryValuation: 14,
};

describe("inventory BI dashboard", () => {
  it("loads all projections through tenant-scoped REST paths", async () => {
    const { api, request } = fakeApi();
    request.mockResolvedValue({ data: summary });
    const controller = new InventoryBiDashboardController(api, "owner_admin");
    await controller.load();
    expect(request).toHaveBeenCalledTimes(5);
    expect(request).toHaveBeenCalledWith(
      expect.objectContaining({
        path: "/tenants/current/bi/inventory-summary",
        tenantScoped: true,
      }),
    );
    expect(request).toHaveBeenCalledWith(
      expect.objectContaining({
        path: "/tenants/current/bi/stock-by-category",
        tenantScoped: true,
      }),
    );
  });

  it("keeps seller dashboard free of valuation fields", () => {
    const html = renderInventoryBiDashboard({
      role: "seller",
      status: "READY",
      summary,
      stockByCategory: [
        {
          categoryId: "c",
          categoryName: "Lácteos",
          stockAvailable: 4,
          lowStockProducts: 1,
        },
      ],
      expirationRisk: [
        {
          lotId: "l",
          productId: "p",
          productName: "Leche",
          categoryName: "Lácteos",
          expiresAt: "2026-01-05",
          availableQuantity: 4,
          riskState: "EXPIRING_SOON",
        },
      ],
      movementSummary: [],
      alertsSummary: [],
    });
    expect(html).toContain("Lácteos");
    expect(html).not.toContain("14");
    expect(html).not.toContain("valuation");
  });

  it("renders a safe error state", () => {
    const html = renderInventoryBiDashboard({
      role: "seller",
      status: "ERROR",
      stockByCategory: [],
      expirationRisk: [],
      movementSummary: [],
      alertsSummary: [],
      error: "No se pudo cargar el resumen BI de inventario.",
    });
    expect(html).toContain('role="alert"');
    expect(html).not.toContain("unitCost");
  });
});
