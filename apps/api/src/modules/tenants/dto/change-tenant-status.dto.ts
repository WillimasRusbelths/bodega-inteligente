import type { TenantStatus } from "@prisma/client";

export interface ChangeTenantStatusDto {
  readonly status: TenantStatus;
  readonly reason: string;
}

export function parseChangeTenantStatusDto(
  value: unknown,
): ChangeTenantStatusDto {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("The request is invalid.");
  }
  const body = value as Record<string, unknown>;
  if (
    Object.keys(body).some((key) => !["status", "reason"].includes(key)) ||
    (body["status"] !== "ACTIVE" && body["status"] !== "DISABLED") ||
    typeof body["reason"] !== "string" ||
    body["reason"].trim().length < 3 ||
    body["reason"].trim().length > 500
  ) {
    throw new Error("The request is invalid.");
  }
  return { status: body["status"], reason: body["reason"].trim() };
}
