import type { WebApiClient } from "./client.js";
import {
  normalizeOperationalProducts,
  type OperationalProduct,
} from "./operational-data-adapter.js";

export interface SaleLineInput {
  readonly productId: string;
  readonly quantity: number;
  readonly unitPrice: number;
}

export interface SaleCreateInput {
  readonly items: readonly SaleLineInput[];
}

export interface SaleItem {
  readonly id: string;
  readonly productId: string;
  readonly productName: string;
  readonly lotId: string | null;
  readonly expiresAt: string | null;
  readonly quantity: number;
  readonly unitPrice: number;
  readonly lineTotal: number;
}

export interface SaleRecord {
  readonly id: string;
  readonly saleNumber: string;
  readonly status: string;
  readonly subtotal: number;
  readonly total: number;
  readonly currency: string;
  readonly createdAt: string;
  readonly items: readonly SaleItem[];
}

type ApiEnvelope<T> = { readonly data: T } | T;

function responseData<T>(response: ApiEnvelope<T>): T {
  if (response !== null && typeof response === "object" && "data" in response) {
    return (response as { readonly data: T }).data;
  }
  return response;
}

/** A thin, retry-free wrapper around the established tenant-scoped sales API. */
export class SalesWebApi {
  readonly #client: WebApiClient;

  public constructor(client: WebApiClient) {
    this.#client = client;
  }

  public async listSales(): Promise<readonly SaleRecord[]> {
    const response = await this.#client.request<
      ApiEnvelope<readonly SaleRecord[]>
    >({
      method: "GET",
      path: "/tenants/current/sales",
      authenticated: true,
      tenantScoped: true,
    });
    return responseData(response);
  }

  /** Product summaries share the operational projection used by quick sales. */
  public async listProducts(): Promise<readonly OperationalProduct[]> {
    const response = await this.#client.request<unknown>({
      method: "GET",
      path: "/tenants/current/products",
      authenticated: true,
      tenantScoped: true,
    });
    return normalizeOperationalProducts(response);
  }

  public async createSale(
    input: SaleCreateInput,
    idempotencyKey: string,
  ): Promise<SaleRecord> {
    const response = await this.#client.request<
      ApiEnvelope<SaleRecord>,
      SaleCreateInput
    >({
      method: "POST",
      path: "/tenants/current/sales",
      authenticated: true,
      tenantScoped: true,
      headers: { "Idempotency-Key": idempotencyKey },
      body: input,
    });
    return responseData(response);
  }
}
