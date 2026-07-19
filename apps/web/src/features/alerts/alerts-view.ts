import {
  canManageInventory,
  type AlertListQuery,
  type InventoryAlert,
  type InventoryWebApi,
  type InventoryWebRole,
} from "../../api/inventory-client.js";

export type AlertsState =
  | { readonly status: "IDLE" }
  | { readonly status: "LOADING" }
  | {
      readonly status: "READY";
      readonly items: readonly InventoryAlert[];
      readonly nextCursor: string | null;
    }
  | { readonly status: "EMPTY" }
  | { readonly status: "ERROR"; readonly message: string };

export class AlertsViewController {
  #state: AlertsState = { status: "IDLE" };
  public constructor(
    private readonly api: InventoryWebApi,
    private readonly role: InventoryWebRole,
  ) {}

  public get state(): AlertsState {
    return this.#state;
  }

  public async load(query: AlertListQuery = {}): Promise<void> {
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

  public async resolve(
    alertId: string,
    reason: string,
    idempotencyKey: string,
  ): Promise<InventoryAlert> {
    if (!canManageInventory(this.role)) throw new Error("FORBIDDEN");
    const result = await this.api.resolveAlert(alertId, reason, idempotencyKey);
    await this.load();
    return result;
  }
}
