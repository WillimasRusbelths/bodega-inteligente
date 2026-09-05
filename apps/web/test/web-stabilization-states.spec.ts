import { describe, expect, it } from "vitest";
import type { Product } from "../src/api/inventory-client.js";
import { renderInventoryDashboard } from "../src/features/inventory-dashboard.js";
import { resourceState } from "../src/features/dashboard/operational-dashboard-state.js";
import { renderSurfaceState } from "../src/features/dashboard/surface-state-view.js";
import { OperationalDashboardController } from "../src/features/dashboard/operational-dashboard-controller.js";
import { vi } from "vitest";
import { renderBodegiaDashboard } from "../src/demo/mvp-demo.js";
import { renderInventoryBiDashboard } from "../src/features/bi/inventory-bi-dashboard.js";

const product: Product = {
  id: "00000000-0000-4000-8000-000000000101",
  tenantId: "00000000-0000-4000-8000-000000000001",
  name: "Arroz vigente",
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

function inventoryHtml(input: {
  readonly loading?: boolean;
  readonly error?: string;
  readonly products?: readonly Product[];
}): string {
  return renderInventoryDashboard({
    role: "owner_admin",
    ...(input.loading === undefined ? {} : { loading: input.loading }),
    ...(input.error === undefined ? {} : { error: input.error }),
    products: input.products ?? [],
    lots: [],
    balances: [],
    alerts: [],
  });
}

describe("web stabilization surface states [T013]", () => {
  it("keeps loading, ready, empty and error mutually distinguishable without presenting the prior stock as current", () => {
    const loading = inventoryHtml({ loading: true, products: [product] });
    const ready = inventoryHtml({ products: [product] });
    const empty = inventoryHtml({ products: [] });
    const error = inventoryHtml({
      error: "No se pudo cargar el stock disponible.",
      products: [product],
    });

    expect({
      loading: {
        identifiesLoading: loading.includes('data-testid="inventory-loading"'),
        presentsPriorProductAsCurrent: loading.includes(product.name),
      },
      ready: ready.includes(product.name),
      empty: empty.includes('data-testid="products-empty"'),
      error: {
        identifiesError: error.includes('data-testid="inventory-error"'),
        presentsPriorProductAsCurrent: error.includes(product.name),
      },
    }).toEqual({
      loading: {
        identifiesLoading: true,
        presentsPriorProductAsCurrent: false,
      },
      ready: true,
      empty: true,
      error: {
        identifiesError: true,
        presentsPriorProductAsCurrent: false,
      },
    });
  });

  it("marks a failed refresh stale and offers a correlation-aware GET retry", () => {
    const failedRefresh = inventoryHtml({
      error: "No se pudo cargar el stock disponible.",
      products: [product],
    });

    expect({
      marksDataStale: /desactualizado|stale/iu.test(failedRefresh),
      identifiesCorrelation: /correlationId|correlation id/iu.test(
        failedRefresh,
      ),
      offersRetry: /reintentar/iu.test(failedRefresh),
    }).toEqual({
      marksDataStale: true,
      identifiesCorrelation: true,
      offersRetry: true,
    });
  });
});

describe("resource surface contract [T048]", () => {
  it("identifies a successful empty catalog without offering a zero-stock sale", () => {
    const idle = resourceState.idle();
    const html = renderBodegiaDashboard(
      "owner_admin",
      undefined,
      { products: [], sales: [] },
      undefined,
      {
        sale: { status: "idle" },
        resources: {
          products: resourceState.ready(
            { items: [], data: [] },
            "2026-09-04",
            1,
          ),
          sales: idle,
          lots: idle,
          balances: idle,
          movements: idle,
          alerts: idle,
          indicators: idle,
        },
      },
    );
    expect(html).toContain('data-resource="products" data-state="empty"');
    expect(html).toContain("No hay productos");
    expect(html).not.toContain('id="quick-sale-stock"');
  });
  it("does not cancel another resource recovery or repeat its pending GET", async () => {
    let finish!: (value: string[]) => void;
    const products = vi
      .fn()
      .mockRejectedValueOnce(new Error("offline"))
      .mockImplementationOnce(
        () =>
          new Promise<string[]>((resolve) => {
            finish = resolve;
          }),
      );
    const alerts = vi
      .fn()
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce([]);
    const controller = new OperationalDashboardController({ products, alerts });
    await controller.load({
      sessionId: "s",
      tenantId: "t",
      membershipId: "m",
      capabilities: [],
    });
    const pending = controller.retryResources(["products"]);
    await controller.retryResources(["products", "alerts"]);
    expect(products).toHaveBeenCalledTimes(2);
    expect(alerts).toHaveBeenCalledOnce();
    finish(["current"]);
    await pending;
    await controller.retryResources(["alerts"]);
    expect(controller.snapshot()?.resources.products).toMatchObject({
      status: "ready",
      data: ["current"],
    });
    expect(alerts).toHaveBeenCalledTimes(2);
  });
  it("uses product/lot stock and financial labels consistently [T054]", () => {
    const html = renderBodegiaDashboard("owner_admin");
    expect(html).toContain("Stock de producto");
    expect(html).toContain("Stock por lote");
    expect(html).toContain("Costo unitario");
    expect(html).toContain("Valorizacion");
    const inventory = inventoryHtml({ products: [product] });
    expect(inventory).toContain("Stock de producto");
    expect(inventory).toContain("Stock por lote");
  });
  it("does not turn loading resources into confirmed zero metrics in the connected shell", () => {
    const loading = resourceState.loading(1);
    const html = renderBodegiaDashboard(
      "owner_admin",
      undefined,
      undefined,
      undefined,
      {
        sale: { status: "idle" },
        resources: {
          products: loading,
          lots: loading,
          balances: loading,
          movements: loading,
          alerts: loading,
          sales: loading,
          indicators: loading,
        },
      },
    );
    expect(html).toContain('data-state="loading"');
    expect(html).not.toContain('class="metric-card');
    expect(html).not.toContain('id="quick-sale-stock"');
    expect(html.match(/id="inicio"/g)).toHaveLength(1);
    expect(html.match(/id="bi"/g)).toHaveLength(1);
  });

  it("renders independent BI errors safely without inventing summary zeroes", () => {
    const html = renderInventoryBiDashboard({
      role: "owner_admin",
      status: "READY",
      stockByCategory: [
        {
          categoryId: null,
          categoryName: "Categoria vigente",
          stockAvailable: 8,
          lowStockProducts: 0,
        },
      ],
      expirationRisk: [],
      movementSummary: [],
      alertsSummary: [],
      resources: {
        summary: {
          status: "ERROR",
          message: "SQL confidential",
          correlationId: "bi-corr",
        },
        stockByCategory: { status: "READY", data: [] },
        expirationRisk: { status: "EMPTY", data: [] },
        movementSummary: { status: "LOADING" },
        alertsSummary: { status: "EMPTY", data: [] },
      },
    });
    expect(html).toContain("Categoria vigente");
    expect(html).toContain("bi-corr");
    expect(html).not.toContain("SQL confidential");
    expect(html).not.toContain('data-testid="bi-kpis"');
    expect(html).toContain('data-state="loading"');
  });
  it("renders current, empty and loading independently without leaking previous content or raw errors", () => {
    const render = (state: ReturnType<typeof resourceState.ready<string[]>>) =>
      renderSurfaceState({
        resource: "products",
        label: "Productos",
        state,
        renderContent: () => "<b>contenido-vigente</b>",
        canRetry: true,
      });
    expect(render(resourceState.loading(1))).not.toContain("contenido-vigente");
    expect(render(resourceState.loading(1))).toContain('data-state="loading"');
    expect(render(resourceState.empty("2026-09-04", 1))).toContain(
      "No hay productos",
    );
    expect(render(resourceState.ready(["p"], "2026-09-04", 1))).toContain(
      "contenido-vigente",
    );
    const failed = render(
      resourceState.error("SQL private unitCost 99", "corr-1", 2),
    );
    expect(failed).toContain("corr-1");
    expect(failed).toContain('data-retry-resource="products"');
    expect(failed).not.toMatch(/SQL|unitCost|99|contenido-vigente/);
  });

  it("labels retained stale data with provenance and only offers authorized recovery", () => {
    const state = {
      ...resourceState.stale([product], "GET_FAILED", "corr-stale", 2),
      receivedAt: "2026-09-04T10:00:00Z",
    };
    const input = {
      resource: "products",
      label: "Productos",
      state,
      renderContent: () => product.name,
    };
    const html = renderSurfaceState({ ...input, canRetry: true });
    expect(html).toContain('data-state="stale"');
    expect(html).toContain("desactualizados");
    expect(html).toContain("2026-09-04T10:00:00Z");
    expect(html).toContain(product.name);
    expect(renderSurfaceState({ ...input, canRetry: false })).not.toContain(
      "data-retry-resource",
    );
  });

  it("recovers only a failed initial GET and preserves healthy data without a sale", async () => {
    const products = vi.fn().mockResolvedValue([product]);
    const alerts = vi
      .fn()
      .mockRejectedValueOnce(new Error("private"))
      .mockResolvedValueOnce(["alert"]);
    const controller = new OperationalDashboardController({ products, alerts });
    await controller.load({
      sessionId: "s",
      tenantId: "a",
      membershipId: "m",
      capabilities: ["inventory.products.read", "inventory.alerts.read"],
    });
    const healthy = controller.snapshot()?.resources.products;
    await controller.retryResources(["alerts"]);
    expect(products).toHaveBeenCalledTimes(1);
    expect(alerts).toHaveBeenCalledTimes(2);
    expect(controller.snapshot()?.resources.products).toEqual(healthy);
    expect(controller.snapshot()?.resources.alerts.status).toBe("ready");
    expect(controller.snapshot()?.sale.status).toBe("idle");
  });
});
