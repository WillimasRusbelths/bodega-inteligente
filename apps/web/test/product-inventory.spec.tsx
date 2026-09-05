import { describe, expect, it, vi } from "vitest";
import type { WebApiClient } from "../src/api/client.js";
import {
  InventoryWebApi,
  operationalLot,
  type Lot,
  type Product,
} from "../src/api/inventory-client.js";
import { AlertsViewController } from "../src/features/alerts/alerts-view.js";
import { InventoryViewController } from "../src/features/inventory/inventory-view.js";
import { LotsViewController } from "../src/features/lots/lots-view.js";
import { ProductCatalogController } from "../src/features/products/product-catalog.js";
import { renderInventoryDashboard } from "../src/features/inventory-dashboard.js";

const product: Product = {
  id: "00000000-0000-4000-8000-000000000101",
  tenantId: "00000000-0000-4000-8000-000000000001",
  name: "Arroz sintético",
  sku: "AR-01",
  barcode: null,
  category: null,
  unitOfMeasure: {
    id: "00000000-0000-4000-8000-000000000201",
    code: "KG",
    name: "Kilogramo",
    quantityScale: 3,
  },
  status: "ACTIVE",
  minimumStock: 3,
  expiryAlertDays: 10,
  availableStock: 8,
  version: 1,
};

const lot: Lot = {
  id: "00000000-0000-4000-8000-000000000301",
  tenantId: product.tenantId,
  productId: product.id,
  expiresAt: "2027-01-01",
  initialQuantity: 10,
  availableQuantity: 8,
  status: "AVAILABLE",
  version: 1,
  unitCost: 4.25,
};

function fakeApi() {
  const request =
    vi.fn<(input: { readonly path: string }) => Promise<unknown>>();
  const client = { request } as unknown as WebApiClient;
  return { api: new InventoryWebApi(client), request };
}

describe("web inventory surfaces [T066, T068]", () => {
  it("uses tenant-scoped REST paths and never sends tenantId in form payloads", async () => {
    const { api, request } = fakeApi();
    request.mockResolvedValue({ items: [product], nextCursor: null });
    await api.listProducts({ q: "arroz", status: "ACTIVE" });
    expect(request).toHaveBeenCalledWith(
      expect.objectContaining({
        path: "/tenants/current/products?q=arroz&status=ACTIVE",
        tenantScoped: true,
      }),
    );
    request.mockResolvedValue({ data: product });
    await api.createProduct(
      { name: product.name, unitOfMeasureId: product.unitOfMeasure.id },
      "idempotency",
    );
    expect(request.mock.calls[1]?.[0]).not.toHaveProperty("body.tenantId");
  });

  it("loads rich inventory resources from existing tenant-scoped routes without deriving stock", async () => {
    const { api, request } = fakeApi();
    request.mockResolvedValue({ items: [], nextCursor: null });
    const resources = await api.loadOperationalResources();
    expect(resources).toEqual({
      products: { items: [], nextCursor: null },
      lots: { items: [], nextCursor: null },
      balances: { items: [], nextCursor: null },
      movements: { items: [], nextCursor: null },
      alerts: { items: [], nextCursor: null },
      fefo: null,
    });
    expect(request.mock.calls.map(([call]) => call.path)).toEqual([
      "/tenants/current/products",
      "/tenants/current/lots",
      "/tenants/current/inventory/balances",
      "/tenants/current/inventory/movements",
      "/tenants/current/inventory/alerts",
    ]);
  });

  it("keeps seller projections free of costs for lots and balances", () => {
    expect(operationalLot(lot, "seller")).not.toHaveProperty("unitCost");
    expect(operationalLot(lot, "inventory_manager")).toHaveProperty(
      "unitCost",
      4.25,
    );
  });

  it("provides loading, empty and safe error states for every inventory surface", async () => {
    const { api } = fakeApi();
    const catalog = new ProductCatalogController(api, "inventory_manager");
    const lots = new LotsViewController(api, "seller");
    const inventory = new InventoryViewController(api, "seller");
    const alerts = new AlertsViewController(api, "seller");
    expect(catalog.state.products.status).toBe("IDLE");
    expect(lots.state.status).toBe("IDLE");
    expect(inventory.balances.status).toBe("IDLE");
    expect(alerts.state.status).toBe("IDLE");
    vi.spyOn(api, "listProducts").mockRejectedValue(new Error("internal"));
    await catalog.loadProducts();
    expect(catalog.state.products).toEqual({
      status: "ERROR",
      message: "No se pudieron cargar los productos.",
    });
  });

  it("blocks seller mutations before reaching the API", async () => {
    const { api } = fakeApi();
    const catalog = new ProductCatalogController(api, "seller");
    await expect(
      catalog.createProduct({ name: "X", unitOfMeasureId: "u" }, "key"),
    ).rejects.toThrow("FORBIDDEN");
    const inventory = new InventoryViewController(api, "seller");
    await expect(
      inventory.adjust(
        {
          productId: "p",
          lotId: "l",
          type: "NEGATIVE_ADJUSTMENT",
          quantity: 1,
          reason: "r",
        },
        "key",
      ),
    ).rejects.toThrow("FORBIDDEN");
  });

  it("renders accessible sections and operational fields without cost columns", () => {
    const html = renderInventoryDashboard({
      role: "seller",
      products: [product],
      lots: [operationalLot(lot, "seller")],
      balances: [],
      alerts: [],
    });
    expect(html).toContain('aria-labelledby="inventory-title"');
    expect(html).toContain('data-testid="product-filters"');
    expect(html).toContain("Arroz sintético");
    expect(html).not.toContain("unitCost");
    expect(html).toContain('data-testid="stock-empty"');
    expect(html).toContain('data-testid="alerts-empty"');
    expect(html).toContain('data-testid="fefo-empty"');
  });

  it("calls FEFO and exposes an operational recommendation", async () => {
    const { api } = fakeApi();
    vi.spyOn(api, "suggestFefo").mockResolvedValue({
      productId: product.id,
      requestedQuantity: 2,
      canFulfill: true,
      items: [
        {
          lotId: lot.id,
          expiresAt: lot.expiresAt,
          availableQuantity: 8,
          suggestedQuantity: 2,
        },
      ],
    });
    const inventory = new InventoryViewController(api, "seller");
    const result = await inventory.suggestFefo(product.id, 2);
    expect(result.items[0]?.lotId).toBe(lot.id);
    expect(inventory.fefo.status).toBe("READY");
  });
});
