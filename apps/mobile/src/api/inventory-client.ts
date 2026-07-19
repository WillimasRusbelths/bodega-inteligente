import type { MobileApiClient } from "./client.js";

export type ProductStatus = "ACTIVE" | "INACTIVE";
export type LotStatus = "AVAILABLE" | "DEPLETED" | "EXPIRED" | "INACTIVE";
export type InventoryAlertType = "LOW_STOCK" | "EXPIRING_SOON" | "EXPIRED";
export type InventoryAlertStatus = "ACTIVE" | "RESOLVED";
export type InventoryMovementType =
  | "RECEIPT"
  | "POSITIVE_ADJUSTMENT"
  | "NEGATIVE_ADJUSTMENT"
  | "WASTE"
  | "SALE_OUT";
export type MobileRole = "owner_admin" | "inventory_manager" | "seller";

export interface Product {
  readonly id: string;
  readonly tenantId: string;
  readonly name: string;
  readonly sku: string | null;
  readonly barcode: string | null;
  readonly category: { readonly id: string; readonly name: string } | null;
  readonly unitOfMeasure: {
    readonly id: string;
    readonly code: string;
    readonly name: string;
    readonly quantityScale: number;
  };
  readonly status: ProductStatus;
  readonly minimumStock: number;
  readonly expiryAlertDays: number;
  readonly availableStock?: number;
  readonly version: number;
}

export interface Lot {
  readonly id: string;
  readonly tenantId: string;
  readonly productId: string;
  readonly expiresAt: string;
  readonly initialQuantity: number;
  readonly availableQuantity: number;
  readonly status: LotStatus;
  readonly version: number;
  readonly receivedAt?: string;
  readonly unitCost?: number;
}

export interface InventoryBalance {
  readonly tenantId: string;
  readonly productId: string;
  readonly lotId: string;
  readonly availableQuantity: number;
  readonly unitCost?: number;
}

export interface InventoryMovement {
  readonly id: string;
  readonly tenantId: string;
  readonly productId: string;
  readonly lotId: string;
  readonly type: InventoryMovementType;
  readonly quantity: number;
  readonly quantityDelta: number;
  readonly balanceBefore: number;
  readonly balanceAfter: number;
  readonly reason: string;
  readonly actorId: string;
  readonly createdAt: string;
}

export interface InventoryAlert {
  readonly id: string;
  readonly tenantId: string;
  readonly productId: string;
  readonly lotId: string | null;
  readonly type: InventoryAlertType;
  readonly status: InventoryAlertStatus;
  readonly observedValue: number;
  readonly thresholdValue: number;
  readonly triggeredAt: string;
  readonly resolvedAt: string | null;
}

export interface FefoResult {
  readonly productId: string;
  readonly requestedQuantity: number;
  readonly canFulfill: boolean;
  readonly items: readonly {
    readonly lotId: string;
    readonly expiresAt: string;
    readonly availableQuantity: number;
    readonly suggestedQuantity: number;
  }[];
}

export interface Page<T> {
  readonly items: readonly T[];
  readonly nextCursor: string | null;
}

export interface ProductListQuery {
  readonly q?: string;
  readonly categoryId?: string;
  readonly status?: ProductStatus;
  readonly lowStock?: boolean;
  readonly cursor?: string;
  readonly limit?: number;
}

export interface LotListQuery {
  readonly productId?: string;
  readonly categoryId?: string;
  readonly status?: LotStatus;
  readonly expiresBefore?: string;
  readonly expiresAfter?: string;
  readonly expirationState?: "ACTIVE" | "EXPIRING_SOON" | "EXPIRED";
  readonly stockState?: "IN_STOCK" | "LOW_STOCK" | "OUT_OF_STOCK";
  readonly cursor?: string;
  readonly limit?: number;
}

export interface AlertListQuery {
  readonly type?: InventoryAlertType;
  readonly status?: InventoryAlertStatus;
  readonly cursor?: string;
  readonly limit?: number;
}

export interface LotReceiptInput {
  readonly receivedAt: string;
  readonly expiresAt: string;
  readonly initialQuantity: number;
  readonly unitCost?: number;
  readonly reason?: string;
}

type QueryValue = string | number | boolean | undefined;
function queryString(values: object): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(
    values as Record<string, QueryValue>,
  )) {
    if (value !== undefined) params.set(key, String(value));
  }
  const serialized = params.toString();
  return serialized.length === 0 ? "" : `?${serialized}`;
}

function page<T>(value: unknown): Page<T> {
  if (value === null || typeof value !== "object")
    throw new Error("INVALID_API_RESPONSE");
  const record = value as Record<string, unknown>;
  if (
    !Array.isArray(record["items"]) ||
    !(typeof record["nextCursor"] === "string" || record["nextCursor"] === null)
  )
    throw new Error("INVALID_API_RESPONSE");
  return { items: record["items"] as T[], nextCursor: record["nextCursor"] };
}

function data<T>(value: unknown): T {
  if (value === null || typeof value !== "object")
    throw new Error("INVALID_API_RESPONSE");
  const record = value as Record<string, unknown>;
  return ("data" in record ? record["data"] : value) as T;
}

/** REST-only inventory client. The active tenant is asserted before every request. */
export class MobileInventoryApi {
  public constructor(
    private readonly client: MobileApiClient,
    private readonly activeTenantId: () => string | null,
  ) {}

  public listProducts(query: ProductListQuery = {}): Promise<Page<Product>> {
    return this.request<unknown>({
      method: "GET",
      path: `/tenants/current/products${queryString(query)}`,
      authenticated: true,
    }).then(page<Product>);
  }
  public getProduct(id: string): Promise<Product> {
    return this.request<unknown>({
      method: "GET",
      path: `/tenants/current/products/${encodeURIComponent(id)}`,
      authenticated: true,
    }).then(data<Product>);
  }
  public listProductLots(
    productId: string,
    query: {
      readonly includeExpired?: boolean;
      readonly cursor?: string;
      readonly limit?: number;
    } = {},
  ): Promise<Page<Lot>> {
    return this.request<unknown>({
      method: "GET",
      path: `/tenants/current/products/${encodeURIComponent(productId)}/lots${queryString(query)}`,
      authenticated: true,
    }).then(page<Lot>);
  }
  public createLot(
    productId: string,
    input: LotReceiptInput,
    idempotencyKey: string,
  ): Promise<Lot> {
    return this.request<unknown>({
      method: "POST",
      path: `/tenants/current/products/${encodeURIComponent(productId)}/lots`,
      authenticated: true,
      headers: { "Idempotency-Key": idempotencyKey },
      body: input,
    }).then(data<Lot>);
  }
  public listBalances(
    query: {
      readonly productId?: string;
      readonly lowStock?: boolean;
      readonly cursor?: string;
      readonly limit?: number;
    } = {},
  ): Promise<Page<InventoryBalance>> {
    return this.request<unknown>({
      method: "GET",
      path: `/tenants/current/inventory/balances${queryString(query)}`,
      authenticated: true,
    }).then(page<InventoryBalance>);
  }
  public listAlerts(query: AlertListQuery = {}): Promise<Page<InventoryAlert>> {
    return this.request<unknown>({
      method: "GET",
      path: `/tenants/current/inventory/alerts${queryString(query)}`,
      authenticated: true,
    }).then(page<InventoryAlert>);
  }
  public resolveAlert(
    id: string,
    reason: string,
    idempotencyKey: string,
  ): Promise<InventoryAlert> {
    return this.request<unknown>({
      method: "PATCH",
      path: `/tenants/current/alerts/${encodeURIComponent(id)}/resolve`,
      authenticated: true,
      headers: { "Idempotency-Key": idempotencyKey },
      body: { status: "RESOLVED", reason },
    }).then(data<InventoryAlert>);
  }
  public suggestFefo(productId: string, quantity: number): Promise<FefoResult> {
    return this.request<FefoResult>({
      method: "GET",
      path: `/tenants/current/inventory/fefo/suggestions${queryString({ productId, quantity })}`,
      authenticated: true,
    });
  }

  private request<TResponse, TBody = unknown>(request: {
    readonly method: "GET" | "POST" | "PATCH";
    readonly path: string;
    readonly authenticated: boolean;
    readonly headers?: Readonly<Record<string, string>>;
    readonly body?: TBody;
  }): Promise<TResponse> {
    if (this.activeTenantId() === null)
      return Promise.reject(new Error("ACTIVE_TENANT_REQUIRED"));
    return this.client.request<TResponse, TBody>(request);
  }
}

export function canManageInventory(role: MobileRole): boolean {
  return role === "owner_admin" || role === "inventory_manager";
}

export function operationalLot(
  lot: Lot,
  role: MobileRole,
): Omit<Lot, "unitCost"> & { readonly unitCost?: never } {
  if (role !== "seller")
    return lot as Omit<Lot, "unitCost"> & { readonly unitCost?: never };
  const { unitCost: _unitCost, ...operational } = lot;
  void _unitCost;
  return operational;
}

export function operationalBalance(
  balance: InventoryBalance,
  role: MobileRole,
): Omit<InventoryBalance, "unitCost"> & { readonly unitCost?: never } {
  if (role !== "seller")
    return balance as Omit<InventoryBalance, "unitCost"> & {
      readonly unitCost?: never;
    };
  const { unitCost: _unitCost, ...operational } = balance;
  void _unitCost;
  return operational;
}
