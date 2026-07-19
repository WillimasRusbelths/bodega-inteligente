import {
  canManageInventory,
  operationalBalance,
  type InventoryBalance,
  type InventoryListQuery,
  type InventoryMovement,
  type InventoryWebApi,
  type InventoryWebRole,
  type FefoResult,
  type MovementCreateInput,
  type Page,
} from "../../api/inventory-client.js";

export type InventoryState<T> =
  | { readonly status: "IDLE" }
  | { readonly status: "LOADING" }
  | {
      readonly status: "READY";
      readonly items: readonly T[];
      readonly nextCursor: string | null;
    }
  | { readonly status: "EMPTY" }
  | { readonly status: "ERROR"; readonly message: string };

export class InventoryViewController {
  #balances: InventoryState<
    Omit<InventoryBalance, "unitCost"> & { readonly unitCost?: never }
  > = { status: "IDLE" };
  #movements: InventoryState<InventoryMovement> = { status: "IDLE" };
  #fefo: {
    readonly status: "IDLE" | "LOADING" | "READY" | "ERROR";
    readonly result?: FefoResult;
    readonly message?: string;
  } = { status: "IDLE" };
  public constructor(
    private readonly api: InventoryWebApi,
    private readonly role: InventoryWebRole,
  ) {}

  public get balances(): InventoryState<
    Omit<InventoryBalance, "unitCost"> & { readonly unitCost?: never }
  > {
    return this.#balances;
  }
  public get movements(): InventoryState<InventoryMovement> {
    return this.#movements;
  }
  public get fefo(): {
    readonly status: "IDLE" | "LOADING" | "READY" | "ERROR";
    readonly result?: FefoResult;
    readonly message?: string;
  } {
    return this.#fefo;
  }

  public async loadBalances(query: InventoryListQuery = {}): Promise<void> {
    this.#balances = { status: "LOADING" };
    try {
      const result: Page<InventoryBalance> = await this.api.listBalances(query);
      this.#balances =
        result.items.length === 0
          ? { status: "EMPTY" }
          : {
              status: "READY",
              items: result.items.map((item) =>
                operationalBalance(item, this.role),
              ),
              nextCursor: result.nextCursor,
            };
    } catch {
      this.#balances = {
        status: "ERROR",
        message: "No se pudo cargar el stock disponible.",
      };
    }
  }

  public async loadMovements(query: InventoryListQuery = {}): Promise<void> {
    this.#movements = { status: "LOADING" };
    try {
      const result = await this.api.listMovements(query);
      this.#movements =
        result.items.length === 0
          ? { status: "EMPTY" }
          : {
              status: "READY",
              items: result.items,
              nextCursor: result.nextCursor,
            };
    } catch {
      this.#movements = {
        status: "ERROR",
        message: "No se pudo cargar el kardex.",
      };
    }
  }

  public async adjust(
    input: MovementCreateInput,
    idempotencyKey: string,
  ): Promise<InventoryMovement> {
    if (!canManageInventory(this.role)) throw new Error("FORBIDDEN");
    if (input.quantity <= 0) throw new Error("INVALID_QUANTITY");
    return this.api.createMovement(input, idempotencyKey);
  }

  public async suggestFefo(
    productId: string,
    quantity: number,
  ): Promise<FefoResult> {
    if (quantity <= 0) throw new Error("INVALID_QUANTITY");
    this.#fefo = { status: "LOADING" };
    try {
      const result = await this.api.suggestFefo(productId, quantity);
      this.#fefo = { status: "READY", result };
      return result;
    } catch {
      this.#fefo = {
        status: "ERROR",
        message: "No se pudo calcular la sugerencia FEFO.",
      };
      throw new Error("FEFO_UNAVAILABLE");
    }
  }
}
