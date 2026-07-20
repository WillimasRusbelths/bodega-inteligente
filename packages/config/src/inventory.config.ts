export interface InventoryConfig {
  readonly quantityScale: number;
  readonly currencyScale: number;
  readonly currencyCode: string;
  readonly defaultMinimumStock: number;
  readonly defaultExpirationWarningDays: number;
}

export const defaultInventoryConfig: InventoryConfig = Object.freeze({
  quantityScale: 3,
  currencyScale: 2,
  currencyCode: "PEN",
  defaultMinimumStock: 0,
  defaultExpirationWarningDays: 0,
});

export function parseInventoryConfig(
  environment: Readonly<Record<string, string | undefined>>,
): InventoryConfig {
  const positiveInteger = (name: string, fallback: number): number => {
    const value = environment[name];
    if (value === undefined || value.trim() === "") return fallback;
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed < 0 || parsed > 6)
      throw new Error(`${name} must be an integer from 0 to 6.`);
    return parsed;
  };
  const nonNegative = (name: string, fallback: number): number => {
    const value = environment[name];
    if (value === undefined || value.trim() === "") return fallback;
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 0) throw new Error(`${name} must be non-negative.`);
    return parsed;
  };
  const currencyCode =
    environment["INVENTORY_CURRENCY"]?.trim() || defaultInventoryConfig.currencyCode;
  if (!/^[A-Z]{3}$/u.test(currencyCode))
    throw new Error("INVENTORY_CURRENCY must be ISO-4217 uppercase.");
  return Object.freeze({
    quantityScale: positiveInteger(
      "INVENTORY_QUANTITY_SCALE",
      defaultInventoryConfig.quantityScale,
    ),
    currencyScale: positiveInteger(
      "INVENTORY_CURRENCY_SCALE",
      defaultInventoryConfig.currencyScale,
    ),
    currencyCode,
    defaultMinimumStock: nonNegative(
      "INVENTORY_MINIMUM_STOCK",
      defaultInventoryConfig.defaultMinimumStock,
    ),
    defaultExpirationWarningDays: nonNegative(
      "INVENTORY_EXPIRY_WARNING_DAYS",
      defaultInventoryConfig.defaultExpirationWarningDays,
    ),
  });
}
