export const errorCatalog = {
  VALIDATION_ERROR: { status: 400, message: "The request is invalid." },
  AUTHENTICATION_FAILED: {
    status: 400,
    message: "Authentication could not be completed.",
  },
  SESSION_INVALID: {
    status: 401,
    message: "The session is invalid or expired.",
  },
  INSUFFICIENT_PERMISSION: {
    status: 403,
    message: "The operation is not allowed.",
  },
  RESOURCE_NOT_FOUND: {
    status: 404,
    message: "The requested resource is not available.",
  },
  STALE_STATE: {
    status: 409,
    message: "The resource changed. Reload and try again.",
  },
  STOCK_INSUFFICIENT: {
    status: 409,
    message: "The available stock is insufficient.",
  },
  LAST_ACTIVE_OWNER: {
    status: 409,
    message: "The last active owner cannot be removed.",
  },
  ACTIVATION_ALREADY_USED: {
    status: 409,
    message: "The activation is no longer available.",
  },
  PROFILE_LOCKED: {
    status: 423,
    message: "The profile is temporarily locked.",
  },
  TOO_MANY_REQUESTS: {
    status: 429,
    message: "Too many requests. Try again later.",
  },
  INTERNAL_ERROR: {
    status: 500,
    message: "The operation could not be completed.",
  },
} as const;

export type ErrorCode = keyof typeof errorCatalog;

export interface SafeErrorResponse {
  readonly code: ErrorCode;
  readonly message: string;
  readonly correlationId: string;
}
