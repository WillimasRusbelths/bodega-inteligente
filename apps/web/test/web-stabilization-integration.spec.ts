import { describe, expect, it, vi } from "vitest";
import { WebApiClient } from "../src/api/client.js";
import { InventoryWebApi, type Product } from "../src/api/inventory-client.js";
import { normalizeOperationalProducts } from "../src/api/operational-data-adapter.js";
import { InventoryBiApi } from "../src/features/bi/inventory-bi-client.js";
import { OperationalDashboardController } from "../src/features/dashboard/operational-dashboard-controller.js";
import { resolveCapabilityContext } from "../src/features/navigation/capability-context.js";
import { renderBodegiaDashboard } from "../src/demo/mvp-demo.js";

const product = {
  id: "product-a",
  name: "Leche integrada",
  sku: "LEC-I",
  barcode: null,
  status: "ACTIVE" as const,
  salePrice: 5.5,
  availableStock: 18,
};

function requestUrl(input: RequestInfo | URL): string {
  if (typeof input === "string") return input;
  return input instanceof URL ? input.href : input.url;
}

describe("web stabilization initial integration [T060]", () => {
  it("uses REST clients, normalization, aggregate state and real render projections without demo fixtures", async () => {
    const operationalProduct: Product = {
      ...product,
      tenantId: "tenant-a",
      category: { id: "category-a", name: "Lacteos" },
      unitOfMeasure: {
        id: "unit-a",
        code: "UND",
        name: "Unidad",
        quantityScale: 0,
      },
      minimumStock: 2,
      expiryAlertDays: 10,
      version: 1,
    };
    const fetchImplementation = vi.fn<typeof fetch>((input) => {
      const path = new URL(requestUrl(input)).pathname;
      const body = path.endsWith("/products")
        ? { items: [operationalProduct], data: [product], nextCursor: null }
        : path.endsWith("/inventory-summary")
          ? {
              data: {
                totalProducts: 1,
                totalStockAvailable: 18,
                lowStockProducts: 0,
                productsExpiringSoon: 0,
                productsExpired: 0,
                activeAlerts: 0,
              },
            }
          : path.includes("/bi/") || path.endsWith("/sales")
            ? { data: [] }
            : { items: [], nextCursor: null };
      return Promise.resolve(Response.json(body));
    });
    const client = new WebApiClient({
      baseUrl: "http://localhost:3000",
      accessToken: () => "session-a",
      activeTenantId: () => "tenant-a",
      fetchImplementation,
    });
    const inventory = new InventoryWebApi(client);
    const bi = new InventoryBiApi(client);
    const controller = new OperationalDashboardController({
      products: () =>
        client
          .request<{
            items: readonly Product[];
            data: unknown;
          }>({
            method: "GET",
            path: "/tenants/current/products",
            authenticated: true,
            tenantScoped: true,
          })
          .then((response) => ({
            items: response.items,
            data: normalizeOperationalProducts(response),
          })),
      lots: () => inventory.listLots().then((page) => page.items),
      balances: () => inventory.listBalances().then((page) => page.items),
      movements: () => inventory.listMovements().then((page) => page.items),
      alerts: () => inventory.listAlerts().then((page) => page.items),
      sales: () =>
        client
          .request<{
            data: readonly [];
          }>({
            method: "GET",
            path: "/tenants/current/sales",
            authenticated: true,
            tenantScoped: true,
          })
          .then((response) => response.data),
      indicators: async () => ({
        summary: await bi.inventorySummary(),
        stockByCategory: await bi.stockByCategory(),
        expirationRisk: await bi.expirationRisk(),
        movementSummary: await bi.movementSummary(),
        alertsSummary: await bi.alertsSummary(),
      }),
    });
    const state = await controller.load({
      sessionId: "session-a",
      tenantId: "tenant-a",
      membershipId: "membership-a",
      capabilities: resolveCapabilityContext({ demoRole: "owner_admin" })
        .capabilities,
    });
    if (
      state?.resources.products.status !== "ready" ||
      state.resources.indicators.status !== "ready"
    )
      throw new Error("INITIAL_AGGREGATE_NOT_READY");
    const html = renderBodegiaDashboard(
      "owner_admin",
      undefined,
      { products: state.resources.products.data.data, sales: [] },
      {
        role: "owner_admin",
        products: state.resources.products.data.items,
        lots: [],
        balances: [],
        movements: [],
        alerts: [],
        fefo: {
          productId: "",
          requestedQuantity: 0,
          canFulfill: false,
          items: [],
        },
        bi: state.resources.indicators.data,
      },
      state,
    );
    expect(html.match(/data-stock="18"/gu)).toHaveLength(1);
    expect(html).toMatch(
      /Leche integrada<\/strong><small>LEC-I<\/small><\/td><td>Lacteos<\/td><td>18<\/td>/u,
    );
    expect(
      html.match(/<span>Stock disponible<\/span><strong>18<\/strong>/gu),
    ).toHaveLength(2);
    expect(
      fetchImplementation.mock.calls.every(([input]) =>
        requestUrl(input).startsWith("http://localhost:3000/tenants/current/"),
      ),
    ).toBe(true);
    expect(html).not.toContain("Arroz Costeño 5kg");
  });
});
