export class TenantSessionInvalidError extends Error {
  public readonly code = "SESSION_INVALID" as const;

  public constructor() {
    super("The session is invalid or expired.");
    this.name = "TenantSessionInvalidError";
  }
}

export class TenantResourceNotFoundError extends Error {
  public readonly code = "RESOURCE_NOT_FOUND" as const;

  public constructor() {
    super("The requested resource is not available.");
    this.name = "NotFoundError";
  }
}

export class TenantPermissionError extends Error {
  public readonly code = "INSUFFICIENT_PERMISSION" as const;

  public constructor() {
    super("The operation is not allowed.");
    this.name = "TenantPermissionError";
  }
}
