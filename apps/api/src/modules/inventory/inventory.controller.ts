import type { TenantContext } from "../access/context/tenant-context.js";
import {
  parseBalanceListQuery,
  parseFefoSuggestionQuery,
  parseMovementCreateDto,
  parseMovementListQuery,
} from "./dto/index.js";
import type { InventoryBalanceService } from "./services/inventory-balance.service.js";
import type { InventoryMovementService } from "./services/inventory-movement.service.js";
import type { FefoService } from "./services/fefo.service.js";
import { InventoryMutationError } from "./services/inventory-movement.service.js";
import { requireIdempotencyKey } from "../catalog/dto/validation.js";
import { HttpExceptionFilter } from "../../common/errors/http-exception.filter.js";
import type { ErrorCode } from "../../common/errors/error-catalog.js";

const filter = new HttpExceptionFilter();

export const inventoryContract = Object.freeze({
  serializeError(error: unknown): unknown {
    let code: ErrorCode = "VALIDATION_ERROR";
    if (error instanceof InventoryMutationError)
      code = error.code === "CONFLICT" ? "STALE_STATE" : error.code;
    return filter.catch(error, code).body;
  },
});

export class InventoryController {
  public constructor(
    private readonly movements: InventoryMovementService,
    private readonly balances: InventoryBalanceService,
    private readonly fefo?: FefoService,
  ) {}
  public listBalances(
    context: TenantContext,
    query: Record<string, unknown>,
  ): Promise<unknown> {
    return this.balances.list(context, parseBalanceListQuery(query));
  }
  public listMovements(
    context: TenantContext,
    query: Record<string, unknown>,
  ): Promise<unknown> {
    return this.movements.list(context, parseMovementListQuery(query));
  }
  public async createMovement(
    context: TenantContext,
    body: unknown,
    idempotencyKey: string | undefined,
  ): Promise<unknown> {
    return {
      data: await this.movements.create(
        context,
        parseMovementCreateDto(body),
        requireIdempotencyKey(idempotencyKey),
      ),
    };
  }

  public suggestFefo(
    context: TenantContext,
    query: Record<string, unknown>,
  ): Promise<unknown> {
    if (this.fefo === undefined)
      throw new Error("FEFO service is not configured.");
    const dto = parseFefoSuggestionQuery(query);
    return this.fefo.suggest(context, dto.productId, dto.quantity);
  }
}
