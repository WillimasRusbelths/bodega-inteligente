import { describe, expect, it, vi } from "vitest";
import type { MobileApiClient } from "../src/api/client.js";
import {
  MobileInventoryApi,
  operationalBalance,
  operationalLot,
  type InventoryAlert,
  type Lot,
  type Product,
} from "../src/api/inventory-client.js";
import {
  MobileInventoryAlerts,
  MobileProductInventory,
  renderMobileInventorySummary,
} from "../src/features/inventory/product-inventory.js";

const tenantId = "00000000-0000-4000-8000-000000000001";
const product: Product = {
  id: "00000000-0000-4000-8000-000000000101",
  tenantId,
  name: "Arroz sintético",
  sku: "AR-01",
  barcode: "750000000001",
  category: { id: "00000000-0000-4000-8000-000000000201", name: "Granos" },
  unitOfMeasure: {
    id: "00000000-0000-4000-8000-000000000301",
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
  id: "00000000-0000-4000-8000-000000000401",
  tenantId,
  productId: product.id,
  expiresAt: "2027-01-01",
  initialQuantity: 10,
  availableQuantity: 8,
  status: "AVAILABLE",
  version: 1,
  unitCost: 4.25,
};
const alert: InventoryAlert = {
  id: "00000000-0000-4000-8000-000000000501",
  tenantId,
  productId: product.id,
  lotId: lot.id,
  type: "LOW_STOCK",
  status: "ACTIVE",
  observedValue: 2,
  thresholdValue: 3,
  triggeredAt: "2026-07-19T10:00:00.000Z",
  resolvedAt: null,
};

function fakeApi(): {
  readonly api: MobileInventoryApi;
  readonly request: ReturnType<typeof vi.fn>;
} {
  const request = vi.fn();
  const client = { request } as unknown as MobileApiClient;
  return { api: new MobileInventoryApi(client, () => tenantId), request };
}

describe("mobile inventory surfaces [T039, T067, T068, T073-T075]", () => {
  it("searches products through the active tenant and loads detail", async () => {
    const { api, request } = fakeApi();
    request
      .mockResolvedValueOnce({ items: [product], nextCursor: null })
      .mockResolvedValueOnce({ data: product });
    const screen = new MobileProductInventory(api, "seller");
    await screen.search({ q: "AR-01" });
    await screen.loadDetail(product.id);
    expect(screen.products).toMatchObject({
      status: "READY",
      items: [product],
    });
    expect(screen.detail).toMatchObject({ status: "READY" });
    expect(request.mock.calls[0]?.[0]).toMatchObject({
      path: "/tenants/current/products?q=AR-01",
    });
    expect(request.mock.calls[0]?.[0]).not.toHaveProperty("body.tenantId");
  });

  it("loads lot stock and removes unitCost from seller projections", async () => {
    const { api, request } = fakeApi();
    request.mockResolvedValue({ items: [lot], nextCursor: null });
    const seller = new MobileProductInventory(api, "seller");
    await seller.loadLots(product.id);
    expect(seller.lots).toMatchObject({ status: "READY" });
    if (seller.lots.status === "READY")
      expect(seller.lots.items[0]).not.toHaveProperty("unitCost");
    expect(operationalLot(lot, "inventory_manager")).toHaveProperty(
      "unitCost",
      4.25,
    );
    expect(
      operationalBalance(
        {
          tenantId,
          productId: product.id,
          lotId: lot.id,
          availableQuantity: 8,
          unitCost: 4.25,
        },
        "seller",
      ),
    ).not.toHaveProperty("unitCost");
  });

  it("allows receipt only to authorized roles and rejects invalid quantity", async () => {
    const { api, request } = fakeApi();
    request.mockResolvedValue({ data: lot });
    const seller = new MobileProductInventory(api, "seller");
    await expect(
      seller.receiveLot(
        product.id,
        {
          receivedAt: "2026-07-19T10:00:00.000Z",
          expiresAt: lot.expiresAt,
          initialQuantity: 1,
        },
        "key",
      ),
    ).rejects.toThrow("FORBIDDEN");
    const manager = new MobileProductInventory(api, "inventory_manager");
    await expect(
      manager.receiveLot(
        product.id,
        {
          receivedAt: "2026-07-19T10:00:00.000Z",
          expiresAt: lot.expiresAt,
          initialQuantity: 0,
        },
        "key",
      ),
    ).rejects.toThrow("INVALID_QUANTITY");
    await expect(
      manager.receiveLot(
        product.id,
        {
          receivedAt: "2026-07-19T10:00:00.000Z",
          expiresAt: lot.expiresAt,
          initialQuantity: 2,
        },
        "key",
      ),
    ).resolves.toMatchObject({ id: lot.id });
  });

  it("supports low-stock lookup and FEFO recommendation without executing a sale", async () => {
    const { api, request } = fakeApi();
    request
      .mockResolvedValueOnce({ items: [], nextCursor: null })
      .mockResolvedValueOnce({
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
    const screen = new MobileProductInventory(api, "seller");
    await expect(screen.stock({ lowStock: true })).resolves.toMatchObject({
      status: "EMPTY",
    });
    await expect(screen.suggestFefo(product.id, 2)).resolves.toMatchObject({
      canFulfill: true,
    });
    const stockRequest = request.mock.calls[0]?.[0] as
      | { readonly path?: string }
      | undefined;
    const fefoRequest = request.mock.calls[1]?.[0] as
      | { readonly path?: string }
      | undefined;
    expect(stockRequest?.path).toContain("lowStock=true");
    expect(fefoRequest?.path).toContain("/fefo/suggestions");
  });

  it("lists, details and resolves alerts according to role", async () => {
    const { api, request } = fakeApi();
    request
      .mockResolvedValueOnce({ items: [alert], nextCursor: null })
      .mockResolvedValueOnce({ data: { ...alert, status: "RESOLVED" } });
    const seller = new MobileInventoryAlerts(api, "seller");
    await seller.load({ type: "LOW_STOCK" });
    expect(seller.detail(alert.id)).toEqual(alert);
    await expect(
      seller.resolve(alert.id, "No autorizado", "key"),
    ).rejects.toThrow("FORBIDDEN");
    const manager = new MobileInventoryAlerts(api, "inventory_manager");
    await expect(
      manager.resolve(alert.id, "Revisado", "key"),
    ).resolves.toMatchObject({ status: "RESOLVED" });
  });

  it("exposes safe loading, empty and error states and requires active tenant", async () => {
    const { api } = fakeApi();
    const screen = new MobileProductInventory(api, "seller");
    expect(screen.products).toEqual({ status: "IDLE" });
    vi.spyOn(api, "listProducts").mockRejectedValue(new Error("internal"));
    await screen.search();
    expect(screen.products).toMatchObject({ status: "ERROR" });
    expect(
      renderMobileInventorySummary({
        products: screen.products,
        stock: { status: "EMPTY" },
        alerts: { status: "LOADING" },
      }),
    ).toContain("loading");
    const inactiveTenant = new MobileInventoryApi(
      {} as unknown as MobileApiClient,
      () => null,
    );
    await expect(inactiveTenant.listProducts()).rejects.toThrow(
      "ACTIVE_TENANT_REQUIRED",
    );
  });
});
