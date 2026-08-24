import { describe, expect, it, vi } from "vitest";
import type { WebSessionContext } from "../src/features/dashboard/operational-dashboard-state.js";

interface ProductStock {
  readonly id: string;
  readonly availableStock: number;
}

type ResourceKey =
  | "products"
  | "lots"
  | "balances"
  | "movements"
  | "alerts"
  | "sales"
  | "indicators";

type TestLoader = ReturnType<
  typeof vi.fn<
    (input: {
      readonly context: WebSessionContext;
      readonly signal: AbortSignal;
    }) => Promise<unknown>
  >
>;

type TestLoaders = Readonly<Record<ResourceKey, TestLoader>>;

interface TestResourceState {
  readonly status: string;
  readonly data?: unknown;
}

interface TestDashboardState {
  readonly resources: Readonly<Record<ResourceKey, TestResourceState>>;
}

interface PostSaleController {
  load(context: WebSessionContext): Promise<TestDashboardState | null>;
  submitSale(input: {
    readonly idempotencyKey: string;
    readonly create: () => Promise<unknown>;
  }): Promise<TestDashboardState | null>;
}

interface ControllerModule {
  readonly OperationalDashboardController: new (
    loaders: TestLoaders,
  ) => PostSaleController;
}

const context: WebSessionContext = {
  sessionId: "session-owner",
  tenantId: "tenant-a",
  membershipId: "membership-owner",
  capabilities: ["inventory.products.read", "sales.write"],
};
const productId = "00000000-0000-4000-8000-000000000301";

function sequentialLoader(first: unknown, second: unknown): TestLoader {
  let call = 0;
  return vi.fn(async () => {
    call += 1;
    return call === 1 ? first : second;
  });
}

function loadersFor(
  productsBefore: readonly ProductStock[],
  productsAfter: readonly ProductStock[],
): TestLoaders {
  return {
    products: sequentialLoader(productsBefore, productsAfter),
    lots: sequentialLoader([{ id: "lot-before" }], [{ id: "lot-after" }]),
    balances: sequentialLoader(
      [{ id: "balance-before" }],
      [{ id: "balance-after" }],
    ),
    movements: sequentialLoader(
      [{ id: "movement-before" }],
      [{ id: "movement-after" }],
    ),
    alerts: sequentialLoader([], []),
    sales: sequentialLoader([], [{ id: "sale-1" }]),
    indicators: sequentialLoader(
      { availableStock: productsBefore[0]?.availableStock ?? 0 },
      { availableStock: productsAfter[0]?.availableStock ?? 0 },
    ),
  };
}

async function createController(
  loaders: TestLoaders,
): Promise<PostSaleController> {
  const module = (await import(
    "../src/features/dashboard/operational-dashboard-controller.js"
  )) as unknown as Partial<ControllerModule>;
  if (module.OperationalDashboardController === undefined) {
    throw new Error("OPERATIONAL_DASHBOARD_CONTROLLER_NOT_IMPLEMENTED");
  }
  const controller = new module.OperationalDashboardController(loaders);
  if (typeof controller.submitSale !== "function") {
    throw new Error("AUTHORITATIVE_POST_SALE_READ_NOT_IMPLEMENTED");
  }
  return controller;
}

async function synchronize(
  productsBefore: readonly ProductStock[],
  productsAfter: readonly ProductStock[],
): Promise<TestDashboardState> {
  const controller = await createController(
    loadersFor(productsBefore, productsAfter),
  );
  await controller.load(context);
  const state = await controller.submitSale({
    idempotencyKey: "sale-key-stock",
    create: vi.fn(async () => ({
      id: "sale-1",
      items: [{ productId, quantity: 1 }],
    })),
  });
  if (state === null) throw new Error("POST_SALE_STATE_NOT_AVAILABLE");
  return state;
}

describe("authoritative stock after concurrency and lifecycle changes [T031]", () => {
  it("uses the next backend balance when a concurrent operation changes more than the local sale", async () => {
    const state = await synchronize(
      [{ id: productId, availableStock: 18 }],
      [{ id: productId, availableStock: 9 }],
    );

    expect(state.resources.products).toEqual(
      expect.objectContaining({
        status: "ready",
        data: [{ id: productId, availableStock: 9 }],
      }),
    );
  });

  it("accepts an authoritative zero instead of retaining the previous positive stock", async () => {
    const state = await synchronize(
      [{ id: productId, availableStock: 2 }],
      [{ id: productId, availableStock: 0 }],
    );

    expect(state.resources.products).toEqual(
      expect.objectContaining({
        status: "ready",
        data: [{ id: productId, availableStock: 0 }],
      }),
    );
  });

  it("discards the previous positive stock when the backend omits a deactivated product", async () => {
    const state = await synchronize([{ id: productId, availableStock: 5 }], []);

    expect(state.resources.products.status).toBe("empty");
    expect("data" in state.resources.products).toBe(false);
  });
});
