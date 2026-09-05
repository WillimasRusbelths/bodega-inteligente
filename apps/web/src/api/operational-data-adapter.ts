/**
 * Common product projection for operational surfaces.  `availableStock` is
 * accepted only when supplied by the backend response; this adapter never
 * derives it from lots, balances, or a client snapshot.
 */
export interface OperationalProduct {
  readonly id: string;
  readonly name: string;
  readonly sku: string | null;
  readonly barcode: string | null;
  readonly status: string;
  readonly salePrice: number;
  readonly availableStock: number;
}

type UnknownRecord = Readonly<Record<string, unknown>>;

export interface OperationalDataProjectionContext {
  readonly role: string;
  readonly capabilities?: readonly string[];
}

function isRecord(value: unknown): value is UnknownRecord {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function canViewInventoryFinancials(
  context: OperationalDataProjectionContext,
): boolean {
  if (context.role === "seller") return false;
  return (
    context.capabilities === undefined ||
    context.capabilities.includes("inventory.lots.read")
  );
}

function isRestrictedFinancialField(field: string): boolean {
  const normalized = field.replace(/[^a-z0-9]/giu, "").toLowerCase();
  return [
    "cost",
    "costo",
    "valuation",
    "valorizacion",
    "estimatedloss",
    "perdidaestimada",
    "purchase",
    "compra",
  ].some((fragment) => normalized.includes(fragment));
}

function withoutRestrictedFinancialData(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => withoutRestrictedFinancialData(item));
  }
  if (!isRecord(value)) return value;
  return Object.fromEntries(
    Object.entries(value)
      .filter(([field]) => !isRestrictedFinancialField(field))
      .map(([field, nested]) => [
        field,
        withoutRestrictedFinancialData(nested),
      ]),
  );
}

/**
 * Removes cost, valuation, estimated-loss and purchase-derived fields before
 * unprivileged operational data reaches presentation code.
 */
export function projectOperationalDataForContext<T>(
  input: T,
  context: OperationalDataProjectionContext,
): T {
  if (canViewInventoryFinancials(context)) return input;
  return withoutRestrictedFinancialData(input) as T;
}

/**
 * Unwraps ordinary `{ data }` responses while preserving the dual products
 * contract, whose `items` and `data` projections are both authoritative.
 */
export function unwrapApiData<T>(input: unknown): T {
  if (isRecord(input) && Array.isArray(input["items"]) && "data" in input) {
    return input as T;
  }
  if (isRecord(input) && "data" in input) return input["data"] as T;
  return input as T;
}

function productItems(input: unknown): readonly unknown[] {
  if (Array.isArray(input)) return input;
  if (!isRecord(input)) throw new Error("INVALID_OPERATIONAL_DATA");
  if (Array.isArray(input["data"])) return input["data"];
  if (Array.isArray(input["items"])) return input["items"];
  throw new Error("INVALID_OPERATIONAL_DATA");
}

function requiredString(product: UnknownRecord, field: string): string {
  const value = product[field];
  if (typeof value !== "string") throw new Error("INVALID_OPERATIONAL_DATA");
  return value;
}

function nullableString(product: UnknownRecord, field: string): string | null {
  const value = product[field];
  if (value === null || typeof value === "string") return value;
  throw new Error("INVALID_OPERATIONAL_DATA");
}

function requiredNumber(product: UnknownRecord, field: string): number {
  const value = product[field];
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error("INVALID_OPERATIONAL_DATA");
  }
  return value;
}

function normalizeProduct(value: unknown): OperationalProduct {
  if (!isRecord(value)) throw new Error("INVALID_OPERATIONAL_DATA");
  return {
    id: requiredString(value, "id"),
    name: requiredString(value, "name"),
    sku: nullableString(value, "sku"),
    barcode: nullableString(value, "barcode"),
    status: requiredString(value, "status"),
    salePrice: requiredNumber(value, "salePrice"),
    availableStock: requiredNumber(value, "availableStock"),
  };
}

export function normalizeOperationalProducts(
  input: unknown,
): readonly OperationalProduct[] {
  return productItems(input).map(normalizeProduct);
}
