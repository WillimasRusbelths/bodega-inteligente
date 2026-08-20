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

function isRecord(value: unknown): value is UnknownRecord {
  return value !== null && typeof value === "object" && !Array.isArray(value);
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
