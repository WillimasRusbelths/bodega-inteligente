import { isUuid } from "../../../common/validation/uuid.js";

export function strictRecord(
  value: unknown,
  allowed: readonly string[],
): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value))
    throw new Error("The request is invalid.");
  const record = value as Record<string, unknown>;
  if (Object.keys(record).some((key) => !allowed.includes(key)))
    throw new Error("The request is invalid.");
  return record;
}

export function text(value: unknown, min: number, max: number): string {
  if (typeof value !== "string") throw new Error("The request is invalid.");
  const normalized = value.trim();
  if (normalized.length < min || normalized.length > max)
    throw new Error("The request is invalid.");
  return normalized;
}

export function optionalText(
  value: unknown,
  min: number,
  max: number,
): string | null {
  if (value === null) return null;
  return text(value, min, max);
}

export function uuid(value: unknown): string {
  if (typeof value !== "string" || !isUuid(value))
    throw new Error("The request is invalid.");
  return value;
}

export function nonNegativeNumber(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0)
    throw new Error("The request is invalid.");
  return value;
}

export function nonNegativeInteger(
  value: unknown,
  maximum = Number.MAX_SAFE_INTEGER,
): number {
  if (
    !Number.isInteger(value) ||
    (value as number) < 0 ||
    (value as number) > maximum
  )
    throw new Error("The request is invalid.");
  return value as number;
}

export function catalogStatus(value: unknown): "ACTIVE" | "INACTIVE" {
  if (value !== "ACTIVE" && value !== "INACTIVE")
    throw new Error("The request is invalid.");
  return value;
}

export function productStatus(value: unknown): "ACTIVE" | "INACTIVE" {
  return catalogStatus(value);
}

export function requireIdempotencyKey(value: string | undefined): string {
  if (
    value === undefined ||
    value.trim().length < 16 ||
    value.trim().length > 128
  )
    throw new Error("The request is invalid.");
  return value.trim();
}
