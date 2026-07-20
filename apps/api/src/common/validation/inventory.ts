export class InventoryValidationError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "InventoryValidationError";
  }
}

export function validateQuantity(value: number, scale = 3): number {
  if (!Number.isFinite(value) || value <= 0)
    throw new InventoryValidationError("Quantity must be greater than zero.");
  const factor = 10 ** scale;
  if (Math.round(value * factor) !== value * factor)
    throw new InventoryValidationError("Quantity precision is invalid.");
  return value;
}

export function validateNonNegativeAmount(value: number, scale = 2): number {
  if (!Number.isFinite(value) || value < 0)
    throw new InventoryValidationError("Amount must be non-negative.");
  const factor = 10 ** scale;
  if (Math.round(value * factor) !== value * factor)
    throw new InventoryValidationError("Amount precision is invalid.");
  return value;
}

export function validateExpiryDate(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(value))
    throw new InventoryValidationError("Expiry date must use YYYY-MM-DD.");
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== value
  )
    throw new InventoryValidationError("Expiry date is invalid.");
  return value;
}

export function validateSearchCode(value: string, field = "code"): string {
  const normalized = value.trim();
  if (
    normalized.length === 0 ||
    normalized.length > 80 ||
    !/^[\p{L}\p{N}._-]+$/u.test(normalized)
  )
    throw new InventoryValidationError(`${field} is invalid.`);
  return normalized;
}

export function validatePage(limit: number | undefined): number | undefined {
  if (limit === undefined) return undefined;
  if (!Number.isInteger(limit) || limit < 1 || limit > 100)
    throw new InventoryValidationError("Limit must be between 1 and 100.");
  return limit;
}

export function validateIdempotencyKey(value: string): string {
  const normalized = value.trim();
  if (normalized.length < 8 || normalized.length > 128)
    throw new InventoryValidationError("Idempotency key is invalid.");
  return normalized;
}
