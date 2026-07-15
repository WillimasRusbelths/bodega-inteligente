import { randomUUID } from "node:crypto";
import {
  errorCatalog,
  type ErrorCode,
  type SafeErrorResponse,
} from "./error-catalog.js";

export interface FilteredHttpError {
  readonly status: number;
  readonly body: SafeErrorResponse;
}

export class HttpExceptionFilter {
  public catch(
    _error: unknown,
    requestedCode: ErrorCode = "INTERNAL_ERROR",
  ): FilteredHttpError {
    const definition = errorCatalog[requestedCode];
    return {
      status: definition.status,
      body: {
        code: requestedCode,
        message: definition.message,
        correlationId: randomUUID(),
      },
    };
  }

  public notFound(_error: unknown): FilteredHttpError {
    return this.catch(_error, "RESOURCE_NOT_FOUND");
  }
}
