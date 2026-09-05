import { describe, expect, it, vi } from "vitest";
import { SafeWebApiError, WebApiClient } from "../src/api/client.js";
import { OperationalDashboardController } from "../src/features/dashboard/operational-dashboard-controller.js";

const context = {
  sessionId: "s",
  tenantId: "a",
  membershipId: "m",
  capabilities: ["inventory.products.read"],
};

describe("safe web errors [T049]", () => {
  it.each([403, 404])(
    "removes previously readable data when refresh returns %s",
    async (status) => {
      const products = vi
        .fn()
        .mockResolvedValueOnce(["previous-private"])
        .mockRejectedValueOnce(
          new SafeWebApiError({
            status,
            code: "NOT_AVAILABLE",
            correlationId: "denied",
          }),
        );
      const controller = new OperationalDashboardController({ products });
      await controller.load(context);
      await controller.submitSale({
        idempotencyKey: "sale",
        create: () => Promise.resolve({ id: "sale" }),
      });
      expect(controller.snapshot()?.resources.products).toMatchObject({
        status: "error",
        correlationId: "denied",
      });
      expect(JSON.stringify(controller.snapshot()?.resources)).not.toContain(
        "previous-private",
      );
    },
  );

  it("forwards an in-flight abort and retains header correlation on a non-JSON failure", async () => {
    let signal: AbortSignal | null | undefined;
    const fetchImplementation = vi.fn(
      (_url: string | URL | Request, init?: RequestInit) => {
        signal = init?.signal;
        return new Promise<Response>((_resolve, reject) =>
          signal?.addEventListener("abort", () =>
            reject(new DOMException("cancelled", "AbortError")),
          ),
        );
      },
    );
    const client = new WebApiClient({
      baseUrl: "http://localhost:3000",
      accessToken: () => null,
      activeTenantId: () => "a",
      fetchImplementation,
    });
    const abort = new AbortController();
    const pending = client.request({
      method: "GET",
      path: "/products",
      signal: abort.signal,
    });
    abort.abort();
    await expect(pending).rejects.toMatchObject({ name: "AbortError" });
    expect(signal?.aborted).toBe(true);
    fetchImplementation.mockImplementationOnce(() =>
      Promise.resolve(
        new Response("internal stack", {
          status: 503,
          headers: { "x-correlation-id": "header-corr" },
        }),
      ),
    );
    await expect(
      client.request({ method: "GET", path: "/products" }),
    ).rejects.toMatchObject({
      status: 503,
      code: "REQUEST_FAILED",
      correlationId: "header-corr",
    });
  });
  it.each([403, 404, 503])(
    "preserves HTTP %s metadata without exposing backend details",
    async (status) => {
      const fetchImplementation = vi.fn(() =>
        Promise.resolve(
          new Response(
            JSON.stringify({
              error: {
                code: "RESOURCE_NOT_FOUND",
                correlationId: "corr-safe",
                message: "SELECT secret FROM costs",
                stack: "private-stack",
              },
            }),
            { status },
          ),
        ),
      );
      const client = new WebApiClient({
        baseUrl: "http://localhost:3000",
        accessToken: () => "token",
        activeTenantId: () => "a",
        fetchImplementation,
      });
      const error = await client
        .request({ method: "GET", path: "/protected" })
        .catch((reason: unknown) => reason);
      expect(error).toBeInstanceOf(SafeWebApiError);
      expect(error).toMatchObject({
        status,
        code: "RESOURCE_NOT_FOUND",
        correlationId: "corr-safe",
      });
      expect(JSON.stringify(error)).not.toMatch(/SELECT|secret|private-stack/);
    },
  );

  it("aborts already-cancelled requests without calling fetch", async () => {
    const fetchImplementation = vi.fn();
    const client = new WebApiClient({
      baseUrl: "http://localhost:3000",
      accessToken: () => "token",
      activeTenantId: () => "a",
      fetchImplementation,
    });
    const abort = new AbortController();
    abort.abort();
    await expect(
      client.request({
        method: "GET",
        path: "/protected",
        signal: abort.signal,
      }),
    ).rejects.toMatchObject({ name: "AbortError" });
    expect(fetchImplementation).not.toHaveBeenCalled();
  });

  it("clears all operational data immediately on 401 while another read is pending", async () => {
    let rejectRead!: (reason: unknown) => void;
    let finishOther!: (value: string[]) => void;
    const products = vi
      .fn()
      .mockResolvedValueOnce(["private-a"])
      .mockImplementationOnce(
        () =>
          new Promise((_resolve, reject) => {
            rejectRead = reject;
          }),
      );
    const alerts = vi
      .fn()
      .mockResolvedValueOnce([])
      .mockImplementationOnce(
        () =>
          new Promise<string[]>((resolve) => {
            finishOther = resolve;
          }),
      );
    const controller = new OperationalDashboardController({ products, alerts });
    await controller.load(context);
    const pending = controller.load(context);
    rejectRead(
      new SafeWebApiError({
        status: 401,
        code: "SESSION_INVALID",
        correlationId: "expired",
      }),
    );
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(controller.snapshot()).toBeNull();
    finishOther(["late-private"]);
    expect(await pending).toBeNull();
    expect(controller.snapshot()).toBeNull();
  });
});
