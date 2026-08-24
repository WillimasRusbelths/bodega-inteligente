import { describe, expect, it, vi } from "vitest";
import { SafeWebApiError } from "../src/api/client.js";
import type { WebSessionContext } from "../src/features/dashboard/operational-dashboard-state.js";

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

interface TestDashboardState {
  readonly resources: Readonly<
    Record<
      ResourceKey,
      {
        readonly status: string;
        readonly data?: unknown;
        readonly correlationId?: string | null;
      }
    >
  >;
  readonly sale: { readonly status: string; readonly sale?: unknown };
}

interface PostSaleController {
  load(context: WebSessionContext): Promise<TestDashboardState | null>;
  submitSale(input: {
    readonly idempotencyKey: string;
    readonly create: () => Promise<unknown>;
  }): Promise<TestDashboardState | null>;
  retryStale(): Promise<TestDashboardState | null>;
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

function stableLoader(value: unknown): TestLoader {
  return vi.fn(async () => value);
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
  if (
    typeof controller.submitSale !== "function" ||
    typeof controller.retryStale !== "function"
  ) {
    throw new Error("POST_SALE_PARTIAL_RECOVERY_NOT_IMPLEMENTED");
  }
  return controller;
}

describe("post-sale partial failure recovery [T030]", () => {
  it("keeps the sale confirmed, marks only rejected reads stale and retries only their GET", async () => {
    const correlationId = "00000000-0000-4000-8000-000000000930";
    const alertsBefore = [{ id: "alert-before" }];
    const alertsAfter = [{ id: "alert-after" }];
    const refreshFailure = new SafeWebApiError({
      status: 503,
      code: "REQUEST_FAILED",
      correlationId,
    });
    const alerts: TestLoader = vi.fn();
    alerts
      .mockResolvedValueOnce(alertsBefore)
      .mockRejectedValueOnce(refreshFailure)
      .mockResolvedValueOnce(alertsAfter);
    const loaders: TestLoaders = {
      products: stableLoader([{ id: "product-1", availableStock: 7 }]),
      lots: stableLoader([{ id: "lot-1" }]),
      balances: stableLoader([{ id: "balance-1" }]),
      movements: stableLoader([{ id: "movement-1" }]),
      alerts,
      sales: stableLoader([{ id: "sale-1" }]),
      indicators: stableLoader({ availableStock: 7 }),
    };
    const confirmedSale = { id: "sale-1", saleNumber: "V-0001" };
    const createSale = vi.fn(async () => confirmedSale);
    const controller = await createController(loaders);

    await controller.load(context);
    const partiallySynchronized = await controller.submitSale({
      idempotencyKey: "sale-key-partial",
      create: createSale,
    });

    expect(createSale).toHaveBeenCalledTimes(1);
    expect(partiallySynchronized?.sale).toEqual(
      expect.objectContaining({ status: "succeeded", sale: confirmedSale }),
    );
    expect(partiallySynchronized?.resources.alerts).toEqual(
      expect.objectContaining({
        status: "stale",
        data: alertsBefore,
        correlationId,
      }),
    );
    for (const key of Object.keys(loaders) as ResourceKey[]) {
      if (key !== "alerts") {
        expect(partiallySynchronized?.resources[key].status).toBe("ready");
      }
    }

    const recovered = await controller.retryStale();

    expect(createSale).toHaveBeenCalledTimes(1);
    expect(alerts).toHaveBeenCalledTimes(3);
    for (const key of Object.keys(loaders) as ResourceKey[]) {
      if (key !== "alerts") expect(loaders[key]).toHaveBeenCalledTimes(2);
    }
    expect(recovered?.resources.alerts).toEqual(
      expect.objectContaining({ status: "ready", data: alertsAfter }),
    );
    expect(recovered?.sale).toEqual(
      expect.objectContaining({ status: "succeeded", sale: confirmedSale }),
    );
  });
});
