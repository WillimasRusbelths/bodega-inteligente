import {
  nonNegativeNumber,
  strictRecord,
  text,
  uuid,
} from "../../catalog/dto/validation.js";

export type InventoryMovementType =
  | "RECEIPT"
  | "POSITIVE_ADJUSTMENT"
  | "NEGATIVE_ADJUSTMENT"
  | "WASTE"
  | "SALE_OUT";
export interface MovementCreateDto {
  readonly productId: string;
  readonly lotId: string;
  readonly type: InventoryMovementType;
  readonly quantity: number;
  readonly reason: string;
  readonly allowExpiredManualAdjustment?: boolean;
}

export function parseMovementCreateDto(value: unknown): MovementCreateDto {
  const body = strictRecord(value, [
    "productId",
    "lotId",
    "type",
    "quantity",
    "reason",
    "allowExpiredManualAdjustment",
  ]);
  const type = body["type"];
  if (
    typeof type !== "string" ||
    ![
      "RECEIPT",
      "POSITIVE_ADJUSTMENT",
      "NEGATIVE_ADJUSTMENT",
      "WASTE",
      "SALE_OUT",
    ].includes(type)
  )
    throw new Error("The request is invalid.");
  const quantity = nonNegativeNumber(body["quantity"]);
  if (quantity <= 0) throw new Error("The request is invalid.");
  return {
    productId: uuid(body["productId"]),
    lotId: uuid(body["lotId"]),
    type: type as InventoryMovementType,
    quantity,
    reason: text(body["reason"], 1, 240),
    allowExpiredManualAdjustment: body["allowExpiredManualAdjustment"] === true,
  };
}

export interface MovementListQuery {
  readonly productId?: string;
  readonly lotId?: string;
  readonly type?: InventoryMovementType;
  readonly cursor?: string;
  readonly limit: number;
}
export function parseMovementListQuery(
  value: Record<string, unknown>,
): MovementListQuery {
  const rawLimit = value["limit"] === undefined ? 50 : Number(value["limit"]);
  if (!Number.isInteger(rawLimit) || rawLimit < 1 || rawLimit > 100)
    throw new Error("The request is invalid.");
  const type = value["type"];
  if (
    type !== undefined &&
    (typeof type !== "string" ||
      ![
        "RECEIPT",
        "POSITIVE_ADJUSTMENT",
        "NEGATIVE_ADJUSTMENT",
        "WASTE",
        "SALE_OUT",
      ].includes(type))
  )
    throw new Error("The request is invalid.");
  return {
    limit: rawLimit,
    ...(value["productId"] === undefined
      ? {}
      : { productId: uuid(value["productId"]) }),
    ...(value["lotId"] === undefined ? {} : { lotId: uuid(value["lotId"]) }),
    ...(type === undefined ? {} : { type: type as InventoryMovementType }),
    ...(value["cursor"] === undefined
      ? {}
      : { cursor: text(value["cursor"], 1, 512) }),
  };
}

export interface BalanceListQuery {
  readonly productId?: string;
  readonly limit: number;
}
export function parseBalanceListQuery(
  value: Record<string, unknown>,
): BalanceListQuery {
  const rawLimit = value["limit"] === undefined ? 50 : Number(value["limit"]);
  if (!Number.isInteger(rawLimit) || rawLimit < 1 || rawLimit > 100)
    throw new Error("The request is invalid.");
  return {
    limit: rawLimit,
    ...(value["productId"] === undefined
      ? {}
      : { productId: uuid(value["productId"]) }),
  };
}
