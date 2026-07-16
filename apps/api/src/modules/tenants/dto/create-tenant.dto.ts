import { normalizeE164 } from "../../../common/validation/e164.js";

export interface CreateTenantDto {
  readonly tenantName: string;
  readonly owner: {
    readonly displayName: string;
    readonly phone: string;
  };
}

function asStrictRecord(
  value: unknown,
  allowedKeys: readonly string[],
): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("The request is invalid.");
  }
  const record = value as Record<string, unknown>;
  if (Object.keys(record).some((key) => !allowedKeys.includes(key))) {
    throw new Error("The request is invalid.");
  }
  return record;
}

function boundedString(
  value: unknown,
  minimum: number,
  maximum: number,
): string {
  if (typeof value !== "string") throw new Error("The request is invalid.");
  const normalized = value.trim();
  if (normalized.length < minimum || normalized.length > maximum) {
    throw new Error("The request is invalid.");
  }
  return normalized;
}

export function parseCreateTenantDto(value: unknown): CreateTenantDto {
  const body = asStrictRecord(value, ["tenantName", "owner"]);
  const owner = asStrictRecord(body["owner"], ["displayName", "phone"]);
  return {
    tenantName: boundedString(body["tenantName"], 1, 160),
    owner: {
      displayName: boundedString(owner["displayName"], 1, 120),
      phone: normalizeE164(boundedString(owner["phone"], 8, 16)),
    },
  };
}

export function parseIdempotencyKey(value: string | undefined): string {
  if (value === undefined || value.length < 16 || value.length > 128) {
    throw new Error("The request is invalid.");
  }
  return value;
}
