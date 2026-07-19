import {
  canManageInventory,
  operationalLot,
  type InventoryWebApi,
  type InventoryWebRole,
  type Lot,
  type LotCreateInput,
  type LotListQuery,
  type LotOperational,
  type Page,
} from "../../api/inventory-client.js";

export type LotsState =
  | { readonly status: "IDLE" }
  | { readonly status: "LOADING" }
  | {
      readonly status: "READY";
      readonly items: readonly LotOperational[];
      readonly nextCursor: string | null;
    }
  | { readonly status: "EMPTY" }
  | { readonly status: "ERROR"; readonly message: string };

export class LotsViewController {
  #state: LotsState = { status: "IDLE" };
  public constructor(
    private readonly api: InventoryWebApi,
    private readonly role: InventoryWebRole,
  ) {}

  public get state(): LotsState {
    return this.#state;
  }

  public async load(query: LotListQuery = {}): Promise<void> {
    this.#state = { status: "LOADING" };
    try {
      const result: Page<Lot> = await this.api.listLots(query);
      this.#state =
        result.items.length === 0
          ? { status: "EMPTY" }
          : {
              status: "READY",
              items: result.items.map((lot) => operationalLot(lot, this.role)),
              nextCursor: result.nextCursor,
            };
    } catch {
      this.#state = {
        status: "ERROR",
        message: "No se pudieron cargar los lotes.",
      };
    }
  }

  public async loadForProduct(
    productId: string,
    includeExpired = false,
  ): Promise<void> {
    this.#state = { status: "LOADING" };
    try {
      const result = await this.api.listProductLots(productId, {
        includeExpired,
      });
      this.#state =
        result.items.length === 0
          ? { status: "EMPTY" }
          : {
              status: "READY",
              items: result.items.map((lot) => operationalLot(lot, this.role)),
              nextCursor: result.nextCursor,
            };
    } catch {
      this.#state = {
        status: "ERROR",
        message: "No se pudieron cargar los lotes del producto.",
      };
    }
  }

  public async receive(
    productId: string,
    input: LotCreateInput,
    idempotencyKey: string,
  ): Promise<LotOperational> {
    if (!canManageInventory(this.role)) throw new Error("FORBIDDEN");
    const lot = await this.api.createLot(productId, input, idempotencyKey);
    return operationalLot(lot, this.role);
  }
}
