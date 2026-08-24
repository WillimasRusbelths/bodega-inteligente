import { describe, expect, it, vi } from "vitest";
import type { WebSessionContext } from "../src/features/dashboard/operational-dashboard-state.js";

interface ProductStock {
  readonly id: string;
  readonly availableStock: number;
}

interface EntityReference {
  readonly id: string;
}

interface ConfirmedSale extends EntityReference {
  readonly saleNumber: string;
  readonly items: readonly {
    readonly productId: string;
    readonly quantity: number;
  }[];
}

interface PostSaleResources {
  readonly products: readonly ProductStock[];
  readonly lots: readonly EntityReference[];
  readonly balances: readonly EntityReference[];
  readonly movements: readonly EntityReference[];
  readonly alerts: readonly EntityReference[];
  readonly sales: readonly ConfirmedSale[];
  readonly indicators: { readonly availableStock: number };
}

type TestLoader<T> = ReturnType<
  typeof vi.fn<
    (input: {
      readonly context: WebSessionContext;
      readonly signal: AbortSignal;
    }) => Promise<T>
  >
>;

type TestLoaders = {
  readonly [K in keyof PostSaleResources]: TestLoader<PostSaleResources[K]>;
};

interface TestDashboardState {
  readonly resources: {
    readonly [K in keyof PostSaleResources]: {
      readonly status: string;
      readonly data?: PostSaleResources[K];
    };
  };
  readonly sale: { readonly status: string; readonly sale?: ConfirmedSale };
}

interface PostSaleController {
  load(context: WebSessionContext): Promise<TestDashboardState | null>;
  submitSale(input: {
    readonly idempotencyKey: string;
    readonly create: () => Promise<ConfirmedSale>;
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

function sequentialLoader<T>(first: T, second: T): TestLoader<T> {
  let call = 0;
  return vi.fn(async () => {
    call += 1;
    return call === 1 ? first : second;
  });
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
    throw new Error("POST_SALE_SYNCHRONIZATION_NOT_IMPLEMENTED");
  }
  return controller;
}

describe("post-sale authoritative synchronization [T029]", () => {
  it("posts exactly once and refreshes every affected GET without subtracting stock locally", async () => {
    const productId = "00000000-0000-4000-8000-000000000301";
    const confirmedSale: ConfirmedSale = {
      id: "sale-1",
      saleNumber: "V-0001",
      items: [{ productId, quantity: 1 }],
    };
    const loaders: TestLoaders = {
      products: sequentialLoader(
        [{ id: productId, availableStock: 18 }],
        [{ id: productId, availableStock: 11 }],
      ),
      lots: sequentialLoader([{ id: "lot-before" }], [{ id: "lot-after" }]),
      balances: sequentialLoader(
        [{ id: "balance-before" }],
        [{ id: "balance-after" }],
      ),
      movements: sequentialLoader(
        [{ id: "movement-before" }],
        [{ id: "movement-after" }],
      ),
      alerts: sequentialLoader(
        [{ id: "alert-before" }],
        [{ id: "alert-after" }],
      ),
      sales: sequentialLoader([], [confirmedSale]),
      indicators: sequentialLoader(
        { availableStock: 18 },
        { availableStock: 11 },
      ),
    };
    const createSale = vi.fn(async () => confirmedSale);
    const controller = await createController(loaders);

    await controller.load(context);
    const synchronized = await controller.submitSale({
      idempotencyKey: "sale-key-1",
      create: createSale,
    });

    expect(createSale).toHaveBeenCalledTimes(1);
    for (const loader of Object.values(loaders)) {
      expect(loader).toHaveBeenCalledTimes(2);
    }
    expect(synchronized?.sale).toEqual(
      expect.objectContaining({ status: "succeeded", sale: confirmedSale }),
    );
    expect(synchronized?.resources.products).toEqual(
      expect.objectContaining({
        status: "ready",
        data: [{ id: productId, availableStock: 11 }],
      }),
    );
    expect(synchronized?.resources.indicators).toEqual(
      expect.objectContaining({
        status: "ready",
        data: { availableStock: 11 },
      }),
    );
    expect(synchronized?.resources.sales).toEqual(
      expect.objectContaining({ status: "ready", data: [confirmedSale] }),
    );
  });
});
