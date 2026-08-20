import { describe, expect, it } from "vitest";
import type { Product } from "../src/api/inventory-client.js";
import { renderInventoryDashboard } from "../src/features/inventory-dashboard.js";

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

function inventoryHtml(input: { readonly loading?: boolean; readonly error?: string; readonly products?: readonly Product[] }): string {
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
