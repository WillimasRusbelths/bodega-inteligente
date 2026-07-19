import {
  nonNegativeInteger,
  nonNegativeNumber,
  productStatus,
  strictRecord,
  text,
  optionalText,
  uuid,
} from "./validation.js";

export interface ProductCreateDto {
  readonly name: string;
  readonly sku?: string;
  readonly barcode?: string;
  readonly categoryId?: string;
  readonly unitOfMeasureId: string;
  readonly minimumStock?: number;
  readonly expiryAlertDays?: number;
}
export interface ProductUpdateDto {
  readonly name?: string;
  readonly sku?: string | null;
  readonly barcode?: string | null;
  readonly categoryId?: string | null;
  readonly unitOfMeasureId?: string;
  readonly minimumStock?: number;
  readonly expiryAlertDays?: number;
  readonly status?: "ACTIVE" | "INACTIVE";
}

export function parseProductCreateDto(value: unknown): ProductCreateDto {
  const body = strictRecord(value, [
    "name",
    "sku",
    "barcode",
    "categoryId",
    "unitOfMeasureId",
    "minimumStock",
    "expiryAlertDays",
  ]);
  return {
    name: text(body["name"], 1, 160),
    ...(body["sku"] === undefined ? {} : { sku: text(body["sku"], 1, 80) }),
    ...(body["barcode"] === undefined
      ? {}
      : { barcode: text(body["barcode"], 1, 80) }),
    ...(body["categoryId"] === undefined
      ? {}
      : { categoryId: uuid(body["categoryId"]) }),
    unitOfMeasureId: uuid(body["unitOfMeasureId"]),
    ...(body["minimumStock"] === undefined
      ? {}
      : { minimumStock: nonNegativeNumber(body["minimumStock"]) }),
    ...(body["expiryAlertDays"] === undefined
      ? {}
      : { expiryAlertDays: nonNegativeInteger(body["expiryAlertDays"]) }),
  };
}

export function parseProductUpdateDto(value: unknown): ProductUpdateDto {
  const body = strictRecord(value, [
    "name",
    "sku",
    "barcode",
    "categoryId",
    "unitOfMeasureId",
    "minimumStock",
    "expiryAlertDays",
    "status",
  ]);
  if (Object.keys(body).length === 0)
    throw new Error("The request is invalid.");
  return {
    ...(body["name"] === undefined ? {} : { name: text(body["name"], 1, 160) }),
    ...(body["sku"] === undefined
      ? {}
      : { sku: optionalText(body["sku"], 1, 80) }),
    ...(body["barcode"] === undefined
      ? {}
      : { barcode: optionalText(body["barcode"], 1, 80) }),
    ...(body["categoryId"] === undefined
      ? {}
      : {
          categoryId:
            body["categoryId"] === null ? null : uuid(body["categoryId"]),
        }),
    ...(body["unitOfMeasureId"] === undefined
      ? {}
      : { unitOfMeasureId: uuid(body["unitOfMeasureId"]) }),
    ...(body["minimumStock"] === undefined
      ? {}
      : { minimumStock: nonNegativeNumber(body["minimumStock"]) }),
    ...(body["expiryAlertDays"] === undefined
      ? {}
      : { expiryAlertDays: nonNegativeInteger(body["expiryAlertDays"]) }),
    ...(body["status"] === undefined
      ? {}
      : { status: productStatus(body["status"]) }),
  };
}

export interface ProductListQuery {
  readonly q?: string;
  readonly categoryId?: string;
  readonly status?: "ACTIVE" | "INACTIVE";
  readonly cursor?: string;
  readonly limit: number;
}
export function parseProductListQuery(
  value: Record<string, string | undefined>,
): ProductListQuery {
  const limitValue = value["limit"] === undefined ? 50 : Number(value["limit"]);
  if (!Number.isInteger(limitValue) || limitValue < 1 || limitValue > 100)
    throw new Error("The request is invalid.");
  return {
    limit: limitValue,
    ...(value["q"] === undefined ? {} : { q: text(value["q"], 1, 120) }),
    ...(value["categoryId"] === undefined
      ? {}
      : { categoryId: uuid(value["categoryId"]) }),
    ...(value["status"] === undefined
      ? {}
      : { status: productStatus(value["status"]) }),
    ...(value["cursor"] === undefined
      ? {}
      : { cursor: text(value["cursor"], 1, 512) }),
  };
}
