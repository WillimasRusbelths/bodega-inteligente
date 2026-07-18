export function strictRecord(
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

export function requiredString(
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
