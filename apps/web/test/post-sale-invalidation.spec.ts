import { describe, expect, it } from "vitest";

type PostSaleInvalidationGroup =
  | "catalog-stock"
  | "inventory-detail"
  | "alerts"
  | "sales"
  | "indicators";

type PostSaleResource =
  | "products"
  | "lots"
  | "balances"
  | "movements"
  | "alerts"
  | "sales"
  | "indicators";

type PostSaleInvalidationGraph = Readonly<
  Record<PostSaleInvalidationGroup, readonly PostSaleResource[]>
>;

interface PostSaleInvalidationModule {
  readonly POST_SALE_INVALIDATION_GRAPH: PostSaleInvalidationGraph;
}

async function loadPostSaleInvalidationGraph(): Promise<PostSaleInvalidationGraph> {
  const module = (await import(
    "../src/features/dashboard/operational-dashboard-controller.js"
  )) as Partial<PostSaleInvalidationModule>;
  if (module.POST_SALE_INVALIDATION_GRAPH === undefined) {
    throw new Error("POST_SALE_INVALIDATION_GRAPH_NOT_IMPLEMENTED");
  }
  return module.POST_SALE_INVALIDATION_GRAPH;
}

describe("post-sale invalidation graph [T028]", () => {
  it("invalidates every authoritative surface exactly once after a confirmed sale", async () => {
    const graph = await loadPostSaleInvalidationGraph();

    expect(graph).toEqual({
      "catalog-stock": ["products"],
      "inventory-detail": ["lots", "balances", "movements"],
      alerts: ["alerts"],
      sales: ["sales"],
      indicators: ["indicators"],
    });

    const invalidatedResources = Object.values(graph).flat();
    expect(new Set(invalidatedResources).size).toBe(
      invalidatedResources.length,
    );
  });
});
