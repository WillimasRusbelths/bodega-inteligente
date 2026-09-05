import { afterEach, describe, expect, it, vi } from "vitest";
import { SafeWebApiError } from "../src/api/client.js";
import {
  bindFormSubmission,
  captureSafeFormInputs,
} from "../src/demo/browser.js";
import { OperationalDashboardController } from "../src/features/dashboard/operational-dashboard-controller.js";

afterEach(() => vi.unstubAllGlobals());

describe("recoverable web forms [T050]", () => {
  it("captures only safe sale/settings fields, never credentials", () => {
    const querySelector = vi.fn((selector: string) =>
      selector.includes('name="quantity"') ? { value: "7" } : null,
    );
    expect(
      captureSafeFormInputs({ querySelector } as unknown as ParentNode),
    ).toEqual({ "quick-sale-form:quantity": "7" });
    expect(querySelector.mock.calls.flat().join(" ")).not.toMatch(
      /pin|token|password|unitCost/,
    );
  });
  it.each(["venta", "configuracion"])(
    "preserves %s inputs, prevents double submit and focuses a safe error",
    async () => {
      const button = { disabled: false };
      const fields = {
        productId: "p",
        quantity: "3",
        unitPrice: "8.5",
        name: "Bodega editada",
      };
      const form = {
        addEventListener: vi.fn(),
        querySelector: () => button,
        setAttribute: vi.fn(),
        removeAttribute: vi.fn(),
        fields,
      };
      const result = { textContent: "", setAttribute: vi.fn(), focus: vi.fn() };
      let reject!: (error: unknown) => void;
      const action = vi.fn(
        () =>
          new Promise<string>((_resolve, rejectPromise) => {
            reject = rejectPromise;
          }),
      );
      const handler = bindFormSubmission(
        form as unknown as HTMLFormElement,
        result as unknown as HTMLElement,
        action,
      );
      const event = { preventDefault: vi.fn() };
      const pending = handler(event);
      await handler(event);
      expect(action).toHaveBeenCalledTimes(1);
      expect(button.disabled).toBe(true);
      reject(
        new SafeWebApiError({
          status: 409,
          code: "STALE_STATE",
          correlationId: "form-corr",
        }),
      );
      await pending;
      expect(form.fields).toEqual(fields);
      expect(result.textContent).toContain("form-corr");
      expect(result.focus).toHaveBeenCalledOnce();
      expect(button.disabled).toBe(false);
      action.mockResolvedValueOnce("Guardado confirmado.");
      await handler(event);
      expect(result.textContent).toContain("confirmado");
      expect(action).toHaveBeenCalledTimes(2);
    },
  );

  it("publishes confirmation before GET completion and preserves success through stale recovery", async () => {
    let finish!: (value: string[]) => void;
    const products = vi
      .fn()
      .mockResolvedValueOnce(["old"])
      .mockImplementationOnce(
        () =>
          new Promise<string[]>((resolve) => {
            finish = resolve;
          }),
      );
    const alerts = vi
      .fn()
      .mockResolvedValueOnce([])
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce([]);
    const controller = new OperationalDashboardController({ products, alerts });
    const observed: string[] = [];
    controller.subscribe((state) => {
      observed.push(state?.sale.status ?? "cleared");
    });
    await controller.load({
      sessionId: "s",
      tenantId: "t",
      membershipId: "m",
      capabilities: ["sales.write"],
    });
    const create = vi.fn(() =>
      Promise.resolve({ id: "sale", saleNumber: "V-1" }),
    );
    const pending = controller.submitSale({ idempotencyKey: "key", create });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(observed).toContain("submitting");
    expect(observed).toContain("succeeded");
    expect(controller.snapshot()?.sale.status).toBe("succeeded");
    finish(["backend-new"]);
    await pending;
    const staleAlerts = controller.snapshot()?.resources.alerts;
    expect(staleAlerts?.status).toBe("stale");
    expect(
      staleAlerts?.status === "stale" && typeof staleAlerts.receivedAt,
    ).toBe("string");
    await controller.retryResources(["alerts"]);
    expect(create).toHaveBeenCalledOnce();
    expect(products).toHaveBeenCalledTimes(2);
    expect(controller.snapshot()?.sale.status).toBe("succeeded");
  });
});
