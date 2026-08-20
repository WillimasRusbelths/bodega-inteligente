import { existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { describe, expect, it, vi } from "vitest";
import { SafeWebApiError, type WebApiClient } from "../src/api/client.js";

interface SalesClient {
  listSales(): Promise<readonly unknown[]>;
  createSale(
    input: { readonly items: readonly unknown[] },
    idempotencyKey: string,
  ): Promise<unknown>;
}

interface SalesClientModule {
  readonly SalesWebApi: new (client: WebApiClient) => SalesClient;
}

async function loadSalesClient(): Promise<SalesClientModule> {
  const modulePath = fileURLToPath(
    new URL("../src/api/sales-client.ts", import.meta.url),
  );
  if (!existsSync(modulePath)) {
    throw new Error("[T021] sales-client is required by T017.");
  }
  const module = (await import(pathToFileURL(modulePath).href)) as Partial<SalesClientModule>;
  if (module.SalesWebApi === undefined) {
    throw new Error("[T021] SalesWebApi export is required by T017.");
  }
  return { SalesWebApi: module.SalesWebApi };
}

describe("sales client [T017]", () => {
  it("uses the existing tenant-scoped GET and one POST without automatically retrying a failed mutation", async () => {
    const { SalesWebApi } = await loadSalesClient();
    const request = vi.fn();
    const client = new SalesWebApi({ request } as unknown as WebApiClient);
    const input = {
      items: [
        {
          productId: "00000000-0000-4000-8000-000000000301",
          quantity: 1,
          unitPrice: 5.5,
        },
      ],
    };

    request.mockResolvedValueOnce({ data: [] });
    await expect(client.listSales()).resolves.toEqual([]);
    expect(request).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "GET",
        path: "/tenants/current/sales",
        authenticated: true,
        tenantScoped: true,
      }),
    );

    const failure = new SafeWebApiError({
      status: 503,
      code: "REQUEST_FAILED",
      correlationId: "00000000-0000-4000-8000-000000000902",
    });
    request.mockRejectedValueOnce(failure);
    await expect(client.createSale(input, "sale-key-1")).rejects.toBe(failure);
    expect(request).toHaveBeenCalledTimes(2);
    expect(request).toHaveBeenLastCalledWith(
      expect.objectContaining({
        method: "POST",
        path: "/tenants/current/sales",
        authenticated: true,
        tenantScoped: true,
        headers: { "Idempotency-Key": "sale-key-1" },
        body: input,
      }),
    );
  });
});
