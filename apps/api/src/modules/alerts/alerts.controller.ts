import type { TenantContext } from "../access/context/tenant-context.js";
import { requireIdempotencyKey } from "../catalog/dto/validation.js";
import { parseAlertListQuery, parseAlertResolveDto } from "./dto/alert.dto.js";
import { AlertMutationError } from "./services/alert.service.js";
import type { AlertService } from "./services/alert.service.js";
import { HttpExceptionFilter } from "../../common/errors/http-exception.filter.js";
import type { ErrorCode } from "../../common/errors/error-catalog.js";

const filter = new HttpExceptionFilter();

export const alertsContract = Object.freeze({
  serializeError(error: unknown): unknown {
    let code: ErrorCode = "VALIDATION_ERROR";
    if (error instanceof AlertMutationError)
      code = error.code === "CONFLICT" ? "STALE_STATE" : error.code;
    return filter.catch(error, code).body;
  },
});

export class AlertsController {
  public constructor(private readonly service: AlertService) {}

  public list(
    context: TenantContext,
    query: Record<string, unknown>,
  ): Promise<unknown> {
    return this.service.list(context, parseAlertListQuery(query));
  }

  public async resolve(
    context: TenantContext,
    alertId: string,
    body: unknown,
    idempotencyKey: string | undefined,
  ): Promise<unknown> {
    const dto = parseAlertResolveDto(body);
    return {
      data: await this.service.resolve(
        context,
        alertId,
        dto.reason,
        requireIdempotencyKey(idempotencyKey),
      ),
    };
  }
}
