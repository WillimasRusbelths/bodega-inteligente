import { describe, expect, it, vi } from "vitest";
import { SafeWebApiError } from "../src/api/client.js";
import { OperationalDashboardController } from "../src/features/dashboard/operational-dashboard-controller.js";
import type { WebSessionContext } from "../src/features/dashboard/operational-dashboard-state.js";

const context: WebSessionContext = {
  sessionId: "session-a",
  tenantId: "tenant-a",
  membershipId: "membership-a",
  capabilities: ["inventory.products.read", "sales.write"],
};

describe("web stabilization sale recovery integration [T061]", () => {
  it("confirms one sale, refreshes all GET resources, marks only the failure stale and retries only that GET", async () => {
    let alertRead = 0;
    const stable = <T>(before: T, after: T) => {
      let read = 0;
      return vi.fn(() => Promise.resolve(++read === 1 ? before : after));
    };
    const alerts = vi.fn(() => {
      alertRead += 1;
      if (alertRead === 2)
        return Promise.reject(
          new SafeWebApiError({
            status: 503,
            code: "READ_FAILED",
            correlationId: "corr-alerts",
          }),
        );
      return Promise.resolve(
        alertRead === 1 ? [{ id: "alert-before" }] : [{ id: "alert-after" }],
      );
    });
    const loaders = {
      products: stable(
        [{ id: "product-a", availableStock: 18 }],
        [{ id: "product-a", availableStock: 17 }],
      ),
      lots: stable([{ id: "lot-before" }], [{ id: "lot-after" }]),
      balances: stable([{ id: "balance-before" }], [{ id: "balance-after" }]),
      movements: stable(
        [{ id: "movement-before" }],
        [{ id: "movement-after" }],
      ),
      alerts,
      sales: stable([], [{ id: "sale-a" }]),
      indicators: stable(
        { totalStockAvailable: 135 },
        { totalStockAvailable: 134 },
      ),
    };
    const postSale = vi.fn(() =>
      Promise.resolve({ id: "sale-a", saleNumber: "V-001" }),
    );
    const controller = new OperationalDashboardController(loaders);
    await controller.load(context);
    const partial = await controller.submitSale({
      idempotencyKey: "sale-key-a",
      create: postSale,
    });
    expect(postSale).toHaveBeenCalledTimes(1);
    expect(partial?.sale.status).toBe("succeeded");
    expect(partial?.resources.alerts).toEqual(
      expect.objectContaining({
        status: "stale",
        correlationId: "corr-alerts",
        data: [{ id: "alert-before" }],
      }),
    );
    for (const [name, loader] of Object.entries(loaders)) {
      expect(loader, name).toHaveBeenCalledTimes(2);
    }
    const recovered = await controller.retryStale();
    expect(postSale).toHaveBeenCalledTimes(1);
    expect(alerts).toHaveBeenCalledTimes(3);
    expect(recovered?.resources.alerts).toEqual(
      expect.objectContaining({
        status: "ready",
        data: [{ id: "alert-after" }],
      }),
    );
    for (const [name, loader] of Object.entries(loaders)) {
      expect(loader, name).toHaveBeenCalledTimes(name === "alerts" ? 3 : 2);
    }
  });
});
