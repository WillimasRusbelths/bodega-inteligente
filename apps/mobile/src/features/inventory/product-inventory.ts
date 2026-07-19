import {
  canManageInventory,
  operationalBalance,
  operationalLot,
  type FefoResult,
  type InventoryBalance,
  type InventoryAlert,
  type Lot,
  type LotListQuery,
  type MobileInventoryApi,
  type MobileRole,
  type Product,
  type ProductListQuery,
} from "../../api/inventory-client.js";

export type MobileCollectionState<T> =
  | { readonly status: "IDLE" }
  | { readonly status: "LOADING" }
  | {
      readonly status: "READY";
      readonly items: readonly T[];
      readonly nextCursor: string | null;
    }
  | { readonly status: "EMPTY" }
  | { readonly status: "ERROR"; readonly message: string };

/** Mobile-first read model for quick product lookup and detail. */
export class MobileProductInventory {
  #products: MobileCollectionState<Product> = { status: "IDLE" };
  #detail: MobileCollectionState<Product> = { status: "IDLE" };
  #lots: MobileCollectionState<Lot> = { status: "IDLE" };
  #role: MobileRole;

  public constructor(
    private readonly api: MobileInventoryApi,
    role: MobileRole,
  ) {
    this.#role = role;
  }

  public get products(): MobileCollectionState<Product> {
    return this.#products;
  }
  public get detail(): MobileCollectionState<Product> {
    return this.#detail;
  }
  public get lots(): MobileCollectionState<
    Omit<Lot, "unitCost"> & { readonly unitCost?: never }
  > {
    if (this.#lots.status !== "READY") return this.#lots;
    return {
      ...this.#lots,
      items: this.#lots.items.map((lot) => operationalLot(lot, this.#role)),
    };
  }

  public async search(query: ProductListQuery = {}): Promise<void> {
    this.#products = { status: "LOADING" };
    try {
      const result = await this.api.listProducts(query);
      this.#products =
        result.items.length === 0
          ? { status: "EMPTY" }
          : {
              status: "READY",
              items: result.items,
              nextCursor: result.nextCursor,
            };
    } catch {
      this.#products = {
        status: "ERROR",
        message: "No se pudieron cargar los productos.",
      };
    }
  }

  public async loadDetail(productId: string): Promise<void> {
    this.#detail = { status: "LOADING" };
    try {
      const result = await this.api.getProduct(productId);
      this.#detail = { status: "READY", items: [result], nextCursor: null };
    } catch {
      this.#detail = {
        status: "ERROR",
        message: "No se pudo cargar el producto.",
      };
    }
  }

  public async loadLots(
    productId: string,
    query: LotListQuery = {},
  ): Promise<void> {
    this.#lots = { status: "LOADING" };
    try {
      const result = await this.api.listProductLots(productId, query);
      this.#lots =
        result.items.length === 0
          ? { status: "EMPTY" }
          : {
              status: "READY",
              items: result.items,
              nextCursor: result.nextCursor,
            };
    } catch {
      this.#lots = {
        status: "ERROR",
        message: "No se pudieron cargar los lotes.",
      };
    }
  }

  public async receiveLot(
    productId: string,
    input: Parameters<MobileInventoryApi["createLot"]>[1],
    idempotencyKey: string,
  ): Promise<Lot> {
    if (!canManageInventory(this.#role)) throw new Error("FORBIDDEN");
    if (input.initialQuantity <= 0) throw new Error("INVALID_QUANTITY");
    const lot = await this.api.createLot(productId, input, idempotencyKey);
    return operationalLot(lot, this.#role);
  }

  public async stock(
    query: { readonly productId?: string; readonly lowStock?: boolean } = {},
  ): Promise<
    MobileCollectionState<
      Omit<InventoryBalance, "unitCost"> & { readonly unitCost?: never }
    >
  > {
    try {
      const result = await this.api.listBalances(query);
      return result.items.length === 0
        ? { status: "EMPTY" }
        : {
            status: "READY",
            items: result.items.map((item) =>
              operationalBalance(item, this.#role),
            ),
            nextCursor: result.nextCursor,
          };
    } catch {
      return {
        status: "ERROR",
        message: "No se pudo cargar el stock disponible.",
      };
    }
  }

  public async suggestFefo(
    productId: string,
    quantity: number,
  ): Promise<FefoResult> {
    if (quantity <= 0) throw new Error("INVALID_QUANTITY");
    return this.api.suggestFefo(productId, quantity);
  }
}

/** State model for alert list/detail and role-gated resolution. */
export class MobileInventoryAlerts {
  #state: MobileCollectionState<InventoryAlert> = { status: "IDLE" };
  public constructor(
    private readonly api: MobileInventoryApi,
    private readonly role: MobileRole,
  ) {}

  public get state(): MobileCollectionState<InventoryAlert> {
    return this.#state;
  }

  public async load(
    query: Parameters<MobileInventoryApi["listAlerts"]>[0] = {},
  ): Promise<void> {
    this.#state = { status: "LOADING" };
    try {
      const result = await this.api.listAlerts(query);
      this.#state =
        result.items.length === 0
          ? { status: "EMPTY" }
          : {
              status: "READY",
              items: result.items,
              nextCursor: result.nextCursor,
            };
    } catch {
      this.#state = {
        status: "ERROR",
        message: "No se pudieron cargar las alertas.",
      };
    }
  }

  public detail(alertId: string): InventoryAlert | null {
    if (this.#state.status !== "READY") return null;
    return this.#state.items.find((alert) => alert.id === alertId) ?? null;
  }

  public async resolve(
    alertId: string,
    reason: string,
    idempotencyKey: string,
  ): Promise<InventoryAlert> {
    if (!canManageInventory(this.role)) throw new Error("FORBIDDEN");
    return this.api.resolveAlert(alertId, reason, idempotencyKey);
  }
}

export function renderMobileInventorySummary(input: {
  readonly products: MobileCollectionState<Product>;
  readonly stock: MobileCollectionState<InventoryBalance>;
  readonly alerts: MobileCollectionState<InventoryAlert>;
}): string {
  return JSON.stringify({
    productStatus: input.products.status,
    stockStatus: input.stock.status,
    alertStatus: input.alerts.status,
    accessibility: [
      "product-search",
      "stock-summary",
      "alert-list",
      "loading",
      "empty",
      "error",
    ],
  });
}
