export function toUtcIso(value: Date): string {
  if (Number.isNaN(value.getTime())) {
    throw new Error("A valid date is required.");
  }
  return value.toISOString();
}

export function parseUtcIso(value: string): Date {
  if (!value.endsWith("Z")) {
    throw new Error("UTC timestamps must end with Z.");
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error("Invalid UTC timestamp.");
  }
  return parsed;
}
