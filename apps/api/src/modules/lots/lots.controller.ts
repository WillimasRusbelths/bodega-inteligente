import { requireIdempotencyKey } from "../catalog/dto/validation.js";
import type { TenantContext } from "../access/context/tenant-context.js";
import {
  parseLotCreateDto,
  parseLotListQuery,
  parseLotStatusDto,
} from "./dto/index.js";
import type { LotReceiptService } from "./services/lot-receipt.service.js";
import { LotMutationError } from "./services/lot-receipt.service.js";
import { HttpExceptionFilter } from "../../common/errors/http-exception.filter.js";
import type { ErrorCode } from "../../common/errors/error-catalog.js";

const filter = new HttpExceptionFilter();

export const lotsContract = Object.freeze({
  serializeError(error: unknown): unknown {
    let code: ErrorCode = "VALIDATION_ERROR";
    if (error instanceof LotMutationError)
      code = error.code === "CONFLICT" ? "STALE_STATE" : error.code;
    return filter.catch(error, code).body;
  },
});

export class LotsController {
  public constructor(private readonly service: LotReceiptService) {}
  public listProductLots(
    context: TenantContext,
    productId: string,
    query: Record<string, unknown>,
  ): Promise<unknown> {
    return this.service.listProductLots(
      context,
      productId,
      parseLotListQuery(query),
    );
  }
  public async createLotReceipt(
    context: TenantContext,
    productId: string,
    body: unknown,
    idempotencyKey: string | undefined,
  ): Promise<unknown> {
    return {
      data: await this.service.createReceipt(
        context,
        productId,
        parseLotCreateDto(body),
        requireIdempotencyKey(idempotencyKey),
      ),
    };
  }
  public listTenantLots(
    context: TenantContext,
    query: Record<string, unknown>,
  ): Promise<unknown> {
    return this.service.listLots(context, parseLotListQuery(query));
  }
  public async getLot(context: TenantContext, lotId: string): Promise<unknown> {
    return { data: await this.service.getLot(context, lotId) };
  }
  public async setLotStatus(
    context: TenantContext,
    lotId: string,
    ifMatch: string | undefined,
    body: unknown,
  ): Promise<unknown> {
    const dto = parseLotStatusDto(body);
    const match = ifMatch?.match(/^"([1-9][0-9]*)"$/u);
    if (match?.[1] === undefined) throw new Error("The request is invalid.");
    return {
      data: await this.service.changeStatus(
        context,
        lotId,
        dto.status,
        Number.parseInt(match[1], 10),
      ),
    };
  }
}
