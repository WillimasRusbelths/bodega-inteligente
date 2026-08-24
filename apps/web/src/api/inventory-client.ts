import type { WebApiClient } from "./client.js";

export type ProductStatus = "ACTIVE" | "INACTIVE";
export type LotStatus = "AVAILABLE" | "DEPLETED" | "EXPIRED" | "INACTIVE";
export type InventoryMovementType =
  | "RECEIPT"
  | "POSITIVE_ADJUSTMENT"
  | "NEGATIVE_ADJUSTMENT"
  | "WASTE"
  | "SALE_OUT";
export type InventoryAlertType = "LOW_STOCK" | "EXPIRING_SOON" | "EXPIRED";
export type InventoryAlertStatus = "ACTIVE" | "RESOLVED";
export type InventoryWebRole = "owner_admin" | "inventory_manager" | "seller";

export interface Category {
  readonly id: string;
  readonly name: string;
  readonly status?: "ACTIVE" | "INACTIVE";
  readonly version?: number;
}

export interface UnitOfMeasure {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly quantityScale: number;
  readonly status?: "ACTIVE" | "INACTIVE";
  readonly version?: number;
}

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

export interface LotOperational {
  readonly id: string;
  readonly tenantId: string;
  readonly productId: string;
  readonly expiresAt: string;
  readonly initialQuantity: number;
  readonly availableQuantity: number;
  readonly status: LotStatus;
  readonly version: number;
  readonly receivedAt?: string;
}

export interface Lot extends LotOperational {
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

export interface FefoSuggestion {
  readonly lotId: string;
  readonly expiresAt: string;
  readonly availableQuantity: number;
  readonly suggestedQuantity: number;
}

export interface FefoResult {
  readonly productId: string;
  readonly requestedQuantity: number;
  readonly canFulfill: boolean;
  readonly items: readonly FefoSuggestion[];
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

export interface Page<T> {
  readonly items: readonly T[];
  readonly nextCursor: string | null;
}

/** Authoritative reads needed by the operational dashboard aggregate. */
export interface OperationalInventoryResources {
  readonly products: Page<Product>;
  readonly lots: Page<Lot>;
  readonly balances: Page<InventoryBalance>;
  readonly movements: Page<InventoryMovement>;
  readonly alerts: Page<InventoryAlert>;
  readonly fefo: FefoResult | null;
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
  readonly lowStock?: boolean;
  readonly stockState?: "IN_STOCK" | "LOW_STOCK" | "OUT_OF_STOCK";
  readonly cursor?: string;
  readonly limit?: number;
}

export interface InventoryListQuery {
  readonly productId?: string;
  readonly lotId?: string;
  readonly type?: InventoryMovementType;
  readonly lowStock?: boolean;
  readonly cursor?: string;
  readonly limit?: number;
}

export interface AlertListQuery {
  readonly type?: InventoryAlertType;
  readonly status?: InventoryAlertStatus;
  readonly categoryId?: string;
  readonly cursor?: string;
  readonly limit?: number;
}

export interface ProductCreateInput {
  readonly name: string;
  readonly sku?: string;
  readonly barcode?: string;
  readonly categoryId?: string;
  readonly unitOfMeasureId: string;
  readonly minimumStock?: number;
  readonly expiryAlertDays?: number;
}

export interface ProductUpdateInput {
  readonly name?: string;
  readonly sku?: string | null;
  readonly barcode?: string | null;
  readonly categoryId?: string | null;
  readonly unitOfMeasureId?: string;
  readonly minimumStock?: number;
  readonly expiryAlertDays?: number;
  readonly status?: ProductStatus;
}

export interface LotCreateInput {
  readonly receivedAt: string;
  readonly expiresAt: string;
  readonly initialQuantity: number;
  readonly unitCost: number;
  readonly reason?: string;
}

export interface MovementCreateInput {
  readonly productId: string;
  readonly lotId: string;
  readonly type: Exclude<InventoryMovementType, "RECEIPT" | "SALE_OUT">;
  readonly quantity: number;
  readonly reason: string;
  readonly allowExpiredManualAdjustment?: boolean;
}

type QueryValue = string | number | boolean | undefined;
function queryString(values: object): string {
  const params = new URLSearchParams();
  const entries = Object.entries(values as Record<string, QueryValue>);
  for (const [key, value] of entries) {
    if (value !== undefined) params.set(key, String(value));
  }
  const serialized = params.toString();
  return serialized.length === 0 ? "" : `?${serialized}`;
}

function page<T>(value: unknown): Page<T> {
  if (value === null || typeof value !== "object") {
    throw new Error("INVALID_API_RESPONSE");
  }
  const candidate = value as Record<string, unknown>;
  const items = candidate["items"];
  const cursor = candidate["nextCursor"];
  if (
    !Array.isArray(items) ||
    !(typeof cursor === "string" || cursor === null)
  ) {
    throw new Error("INVALID_API_RESPONSE");
  }
  return { items: items as T[], nextCursor: cursor };
}

function data<T>(value: unknown): T {
  if (value === null || typeof value !== "object")
    throw new Error("INVALID_API_RESPONSE");
  const candidate = value as Record<string, unknown>;
  return ("data" in candidate ? candidate["data"] : value) as T;
}

/** REST-only client for inventory surfaces. TenantContext is supplied by WebApiClient. */
export class InventoryWebApi {
  public constructor(private readonly client: WebApiClient) {}

  public listCategories(
    query: { readonly cursor?: string; readonly limit?: number } = {},
  ): Promise<Page<Category>> {
    return this.client
      .request<unknown>({
        method: "GET",
        path: `/tenants/current/categories${queryString(query)}`,
        authenticated: true,
        tenantScoped: true,
      })
      .then(page<Category>);
  }
  public createCategory(
    input: { readonly name: string },
    idempotencyKey: string,
  ): Promise<Category> {
    return this.client
      .request<unknown>({
        method: "POST",
        path: "/tenants/current/categories",
        authenticated: true,
        tenantScoped: true,
        headers: { "Idempotency-Key": idempotencyKey },
        body: input,
      })
      .then(data<Category>);
  }
  public updateCategory(
    id: string,
    input: { readonly name?: string },
    ifMatch: string,
  ): Promise<Category> {
    return this.client
      .request<unknown>({
        method: "PATCH",
        path: `/tenants/current/categories/${encodeURIComponent(id)}`,
        authenticated: true,
        tenantScoped: true,
        headers: { "If-Match": ifMatch },
        body: input,
      })
      .then(data<Category>);
  }
  public setCategoryStatus(
    id: string,
    status: "ACTIVE" | "INACTIVE",
    ifMatch: string,
  ): Promise<Category> {
    return this.client
      .request<unknown>({
        method: "PATCH",
        path: `/tenants/current/categories/${encodeURIComponent(id)}/status`,
        authenticated: true,
        tenantScoped: true,
        headers: { "If-Match": ifMatch },
        body: { status },
      })
      .then(data<Category>);
  }
  public listUnits(
    query: { readonly cursor?: string; readonly limit?: number } = {},
  ): Promise<Page<UnitOfMeasure>> {
    return this.client
      .request<unknown>({
        method: "GET",
        path: `/tenants/current/units${queryString(query)}`,
        authenticated: true,
        tenantScoped: true,
      })
      .then(page<UnitOfMeasure>);
  }
  public createUnit(
    input: {
      readonly code: string;
      readonly name: string;
      readonly quantityScale: number;
    },
    idempotencyKey: string,
  ): Promise<UnitOfMeasure> {
    return this.client
      .request<unknown>({
        method: "POST",
        path: "/tenants/current/units",
        authenticated: true,
        tenantScoped: true,
        headers: { "Idempotency-Key": idempotencyKey },
        body: input,
      })
      .then(data<UnitOfMeasure>);
  }
  public updateUnit(
    id: string,
    input: {
      readonly code?: string;
      readonly name?: string;
      readonly quantityScale?: number;
    },
    ifMatch: string,
  ): Promise<UnitOfMeasure> {
    return this.client
      .request<unknown>({
        method: "PATCH",
        path: `/tenants/current/units/${encodeURIComponent(id)}`,
        authenticated: true,
        tenantScoped: true,
        headers: { "If-Match": ifMatch },
        body: input,
      })
      .then(data<UnitOfMeasure>);
  }
  public setUnitStatus(
    id: string,
    status: "ACTIVE" | "INACTIVE",
    ifMatch: string,
  ): Promise<UnitOfMeasure> {
    return this.client
      .request<unknown>({
        method: "PATCH",
        path: `/tenants/current/units/${encodeURIComponent(id)}/status`,
        authenticated: true,
        tenantScoped: true,
        headers: { "If-Match": ifMatch },
        body: { status },
      })
      .then(data<UnitOfMeasure>);
  }
  public listProducts(query: ProductListQuery = {}): Promise<Page<Product>> {
    return this.client
      .request<unknown>({
        method: "GET",
        path: `/tenants/current/products${queryString(query)}`,
        authenticated: true,
        tenantScoped: true,
      })
      .then(page<Product>);
  }
  public createProduct(
    input: ProductCreateInput,
    idempotencyKey: string,
  ): Promise<Product> {
    return this.client
      .request<unknown>({
        method: "POST",
        path: "/tenants/current/products",
        authenticated: true,
        tenantScoped: true,
        headers: { "Idempotency-Key": idempotencyKey },
        body: input,
      })
      .then(data<Product>);
  }
  public getProduct(id: string): Promise<Product> {
    return this.client
      .request<unknown>({
        method: "GET",
        path: `/tenants/current/products/${encodeURIComponent(id)}`,
        authenticated: true,
        tenantScoped: true,
      })
      .then(data<Product>);
  }
  public updateProduct(
    id: string,
    input: ProductUpdateInput,
    ifMatch: string,
    idempotencyKey?: string,
  ): Promise<Product> {
    return this.client
      .request<unknown>({
        method: "PATCH",
        path: `/tenants/current/products/${encodeURIComponent(id)}`,
        authenticated: true,
        tenantScoped: true,
        headers: {
          "If-Match": ifMatch,
          ...(idempotencyKey === undefined
            ? {}
            : { "Idempotency-Key": idempotencyKey }),
        },
        body: input,
      })
      .then(data<Product>);
  }
  public listProductLots(
    productId: string,
    query: {
      readonly includeExpired?: boolean;
      readonly cursor?: string;
      readonly limit?: number;
    } = {},
  ): Promise<Page<Lot>> {
    return this.client
      .request<unknown>({
        method: "GET",
        path: `/tenants/current/products/${encodeURIComponent(productId)}/lots${queryString(query)}`,
        authenticated: true,
        tenantScoped: true,
      })
      .then(page<Lot>);
  }
  public createLot(
    productId: string,
    input: LotCreateInput,
    idempotencyKey: string,
  ): Promise<Lot> {
    return this.client
      .request<unknown>({
        method: "POST",
        path: `/tenants/current/products/${encodeURIComponent(productId)}/lots`,
        authenticated: true,
        tenantScoped: true,
        headers: { "Idempotency-Key": idempotencyKey },
        body: input,
      })
      .then(data<Lot>);
  }
  public listLots(query: LotListQuery = {}): Promise<Page<Lot>> {
    return this.client
      .request<unknown>({
        method: "GET",
        path: `/tenants/current/lots${queryString(query)}`,
        authenticated: true,
        tenantScoped: true,
      })
      .then(page<Lot>);
  }
  public getLot(id: string): Promise<Lot> {
    return this.client
      .request<unknown>({
        method: "GET",
        path: `/tenants/current/lots/${encodeURIComponent(id)}`,
        authenticated: true,
        tenantScoped: true,
      })
      .then(data<Lot>);
  }
  public listBalances(
    query: InventoryListQuery = {},
  ): Promise<Page<InventoryBalance>> {
    return this.client
      .request<unknown>({
        method: "GET",
        path: `/tenants/current/inventory/balances${queryString(query)}`,
        authenticated: true,
        tenantScoped: true,
      })
      .then(page<InventoryBalance>);
  }
  public listMovements(
    query: InventoryListQuery = {},
  ): Promise<Page<InventoryMovement>> {
    return this.client
      .request<unknown>({
        method: "GET",
        path: `/tenants/current/inventory/movements${queryString(query)}`,
        authenticated: true,
        tenantScoped: true,
      })
      .then(page<InventoryMovement>);
  }
  public createMovement(
    input: MovementCreateInput,
    idempotencyKey: string,
  ): Promise<InventoryMovement> {
    return this.client
      .request<unknown>({
        method: "POST",
        path: "/tenants/current/inventory/movements",
        authenticated: true,
        tenantScoped: true,
        headers: { "Idempotency-Key": idempotencyKey },
        body: input,
      })
      .then(data<InventoryMovement>);
  }
  public suggestFefo(productId: string, quantity: number): Promise<FefoResult> {
    return this.client.request<FefoResult>({
      method: "GET",
      path: `/tenants/current/inventory/fefo/suggestions${queryString({ productId, quantity })}`,
      authenticated: true,
      tenantScoped: true,
    });
  }
  public listAlerts(query: AlertListQuery = {}): Promise<Page<InventoryAlert>> {
    return this.client
      .request<unknown>({
        method: "GET",
        path: `/tenants/current/inventory/alerts${queryString(query)}`,
        authenticated: true,
        tenantScoped: true,
      })
      .then(page<InventoryAlert>);
  }

  /** Reads existing inventory resources only; it does not derive stock locally. */
  public async loadOperationalResources(
    fefo?: { readonly productId: string; readonly quantity: number },
  ): Promise<OperationalInventoryResources> {
    const [products, lots, balances, movements, alerts] = await Promise.all([
      this.listProducts(),
      this.listLots(),
      this.listBalances(),
      this.listMovements(),
      this.listAlerts(),
    ]);
    return {
      products, lots, balances, movements, alerts,
      fefo: fefo === undefined ? null : await this.suggestFefo(fefo.productId, fefo.quantity),
    };
  }
  public resolveAlert(
    id: string,
    reason: string,
    idempotencyKey: string,
  ): Promise<InventoryAlert> {
    return this.client
      .request<unknown>({
        method: "PATCH",
        path: `/tenants/current/alerts/${encodeURIComponent(id)}/resolve`,
        authenticated: true,
        tenantScoped: true,
        headers: { "Idempotency-Key": idempotencyKey },
        body: { status: "RESOLVED", reason },
      })
      .then(data<InventoryAlert>);
  }
}

export function canManageInventory(role: InventoryWebRole): boolean {
  return role === "owner_admin" || role === "inventory_manager";
}

export function canViewCosts(role: InventoryWebRole): boolean {
  return role !== "seller";
}

/** Defensive projection: seller never receives cost fields in a rendered view. */
export function operationalLot(
  lot: Lot,
  role: InventoryWebRole,
): LotOperational {
  if (canViewCosts(role)) return lot;
  const { unitCost: _unitCost, ...operational } = lot;
  void _unitCost;
  return operational;
}

export function operationalBalance(
  balance: InventoryBalance,
  role: InventoryWebRole,
): Omit<InventoryBalance, "unitCost"> & { readonly unitCost?: never } {
  if (canViewCosts(role))
    return balance as Omit<InventoryBalance, "unitCost"> & {
      readonly unitCost?: never;
    };
  const { unitCost: _unitCost, ...operational } = balance;
  void _unitCost;
  return operational;
}
