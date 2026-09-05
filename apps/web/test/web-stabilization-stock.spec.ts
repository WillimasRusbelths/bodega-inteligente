import { describe, expect, it, vi } from "vitest";
import {
  renderBodegiaDashboard,
  type OperationalDashboardData,
  type QuickSaleRecord,
} from "../src/demo/mvp-demo.js";
import { WebApiClient } from "../src/api/client.js";
import { InventoryWebApi } from "../src/api/inventory-client.js";
import { normalizeOperationalProducts } from "../src/api/operational-data-adapter.js";
import { InventoryBiApi } from "../src/features/bi/inventory-bi-client.js";
import { OperationalDashboardController } from "../src/features/dashboard/operational-dashboard-controller.js";
import type { ResourceState } from "../src/features/dashboard/operational-dashboard-state.js";
import { resolveCapabilityContext } from "../src/features/navigation/capability-context.js";

const lecheEvaporada = {
  id: "00000000-0000-4000-8000-000000000301",
  name: "Leche evaporada",
  sku: "LAC-LEC-001",
  barcode: "7750001000011",
  status: "ACTIVE" as const,
  salePrice: 5.5,
};

function requestUrl(input: RequestInfo | URL): string {
  if (typeof input === "string") return input;
  return input instanceof URL ? input.href : input.url;
}

function backendCycle(availableStock: number, totalStockAvailable: number) {
  const products = [
    { ...lecheEvaporada, availableStock },
    {
      ...lecheEvaporada,
      id: "other-product",
      name: "Otro producto",
      sku: "OTHER",
      availableStock: 117,
    },
  ];
  return {
    products: {
      data: products,
      items: products.map((product) => ({
        ...product,
        tenantId: "tenant-a",
        category: { id: "category-a", name: "Lacteos" },
        unitOfMeasure: {
          id: "unit-a",
          code: "UND",
          name: "Unidad",
          quantityScale: 0,
        },
        minimumStock: 3,
        expiryAlertDays: 10,
        version: 1,
      })),
      nextCursor: null,
    },
    summary: {
      totalProducts: 2,
      totalStockAvailable,
      lowStockProducts: 0,
      productsExpiringSoon: 0,
      productsExpired: 0,
      activeAlerts: 0,
    },
  };
}

async function controlledDashboard() {
  // Separate backend responses, not a UI subtraction or a production snapshot.
  const before = backendCycle(18, 135);
  const after = backendCycle(17, 134);
  let confirmed = false;
  const sale: QuickSaleRecord = {
    id: "sale-a",
    saleNumber: "V-001",
    status: "CONFIRMED",
    subtotal: 5.5,
    total: 5.5,
    currency: "PEN",
    createdAt: "2026-09-04T00:00:00Z",
    items: [],
  };
  const transport = vi.fn<typeof fetch>((input, init) => {
    const path = new URL(requestUrl(input)).pathname;
    if (init?.method === "POST" && path.endsWith("/sales")) {
      confirmed = true;
      return Promise.resolve(Response.json({ data: sale }));
    }
    const cycle = confirmed ? after : before;
    let body: unknown;
    if (path.endsWith("/products")) body = cycle.products;
    else if (path.endsWith("/sales")) body = { data: confirmed ? [sale] : [] };
    else if (path.endsWith("/inventory-summary"))
      body = { data: cycle.summary };
    else if (path.includes("/bi/")) body = { data: [] };
    else body = { items: [], nextCursor: null };
    return Promise.resolve(Response.json(body));
  });
  const client = new WebApiClient({
    baseUrl: "http://localhost:3000",
    accessToken: () => "session-a",
    activeTenantId: () => "tenant-a",
    fetchImplementation: transport,
  });
  const inventory = new InventoryWebApi(client);
  const bi = new InventoryBiApi(client);
  const controller = new OperationalDashboardController({
    products: async () => {
      const response = await client.request<typeof before.products>({
        method: "GET",
        path: "/tenants/current/products",
        authenticated: true,
        tenantScoped: true,
      });
      return {
        items: response.items,
        data: normalizeOperationalProducts(response),
      };
    },
    lots: () => inventory.listLots().then((page) => page.items),
    balances: () => inventory.listBalances().then((page) => page.items),
    movements: () => inventory.listMovements().then((page) => page.items),
    alerts: () => inventory.listAlerts().then((page) => page.items),
    sales: () =>
      client
        .request<{
          data: readonly QuickSaleRecord[];
        }>({
          method: "GET",
          path: "/tenants/current/sales",
          authenticated: true,
          tenantScoped: true,
        })
        .then((response) => response.data),
    indicators: async (): Promise<OperationalDashboardData["bi"]> => {
      const [
        summary,
        stockByCategory,
        expirationRisk,
        movementSummary,
        alertsSummary,
      ] = await Promise.all([
        bi.inventorySummary(),
        bi.stockByCategory(),
        bi.expirationRisk(),
        bi.movementSummary(),
        bi.alertsSummary(),
      ]);
      return {
        summary,
        stockByCategory,
        expirationRisk,
        movementSummary,
        alertsSummary,
      };
    },
  });
  await controller.load({
    sessionId: "session-a",
    tenantId: "tenant-a",
    membershipId: "membership-a",
    capabilities: resolveCapabilityContext({ demoRole: "owner_admin" })
      .capabilities,
  });
  function value<T>(resource: ResourceState<T>, empty: T): T {
    return resource.status === "ready" || resource.status === "stale"
      ? resource.data
      : empty;
  }
  return {
    sell: () =>
      controller.submitSale({
        idempotencyKey: "sale-key-a",
        create: () =>
          client
            .request<{ data: QuickSaleRecord }>({
              method: "POST",
              path: "/tenants/current/sales",
              authenticated: true,
              tenantScoped: true,
              body: {
                items: [
                  { productId: lecheEvaporada.id, quantity: 1, unitPrice: 5.5 },
                ],
              },
            })
            .then((response) => response.data),
      }),
    transport,
    render: () => {
      const state = controller.snapshot();
      if (state === null) throw new Error("MISSING_CONTEXT");
      const resources = state.resources;
      if (
        resources.products.status !== "ready" ||
        resources.indicators.status !== "ready"
      )
        throw new Error("MISSING_BACKEND_READ");
      return renderBodegiaDashboard(
        "owner_admin",
        undefined,
        {
          products: resources.products.data.data,
          sales: value(resources.sales, []),
        },
        {
          role: "owner_admin",
          products: resources.products.data.items,
          lots: value(resources.lots, []),
          balances: value(resources.balances, []),
          movements: value(resources.movements, []),
          alerts: value(resources.alerts, []),
          fefo: {
            productId: "",
            requestedQuantity: 0,
            canFulfill: false,
            items: [],
          },
          bi: resources.indicators.data,
        },
        state,
      );
    },
  };
}

function section(html: string, id: string): string {
  const start = html.indexOf(`<section id="${id}"`);
  const end = html.indexOf("</section>", start);
  if (start < 0 || end < 0) throw new Error(`SECTION_NOT_FOUND:${id}`);
  return html.slice(start, end);
}

function stockReadings(html: string): {
  readonly quickSale: number;
  readonly operation: number;
  readonly executiveIndicator: number;
  readonly biIndicator: number;
} {
  const quickSale = /data-stock="(\d+)"/u.exec(section(html, "ventas"));
  const operation =
    /Leche evaporada<\/strong><small>LAC-LEC-001<\/small><\/td><td>Lacteos<\/td><td>(\d+)<\/td>/u.exec(
      section(html, "oltp"),
    );
  const executive =
    /<span>Stock disponible<\/span><strong>(\d+)<\/strong>/u.exec(
      section(html, "inicio"),
    );
  const bi = /<span>Stock disponible<\/span><strong>(\d+)<\/strong>/u.exec(
    section(html, "bi"),
  );
  if (
    quickSale === null ||
    operation === null ||
    executive === null ||
    bi === null
  )
    throw new Error("AUTHORITATIVE_STOCK_NOT_RENDERED");
  return {
    quickSale: Number(quickSale[1]),
    operation: Number(operation[1]),
    executiveIndicator: Number(executive[1]),
    biIndicator: Number(bi[1]),
  };
}

describe("web stabilization authoritative stock [T010]", () => {
  it("keeps quick sales, operation and indicators coherent before and after a confirmed sale", async () => {
    const dashboard = await controlledDashboard();
    const beforeSale = stockReadings(dashboard.render());
    expect(beforeSale).toEqual({
      quickSale: 18,
      operation: 18,
      executiveIndicator: 135,
      biIndicator: 135,
    });

    await dashboard.sell();
    const afterSale = stockReadings(dashboard.render());
    expect(afterSale).toEqual({
      quickSale: 17,
      operation: 17,
      executiveIndicator: 134,
      biIndicator: 134,
    });
    expect(
      dashboard.transport.mock.calls.filter(
        ([, init]) => init?.method === "POST",
      ),
    ).toHaveLength(1);
  });
});
