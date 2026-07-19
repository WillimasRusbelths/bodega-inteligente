import {
  nonNegativeNumber,
  strictRecord,
  uuid,
} from "../../catalog/dto/validation.js";

export interface FefoSuggestionQuery {
  readonly productId: string;
  readonly quantity: number;
}

export function parseFefoSuggestionQuery(
  value: Record<string, unknown>,
): FefoSuggestionQuery {
  const productId = uuid(value["productId"]);
  const quantity = nonNegativeNumber(value["quantity"]);
  if (quantity <= 0) throw new Error("The request is invalid.");
  for (const key of Object.keys(value)) {
    if (key !== "productId" && key !== "quantity")
      throw new Error("The request is invalid.");
  }
  return { productId, quantity };
}

export function parseFefoManualAdjustment(value: unknown): {
  readonly allowExpired: boolean;
  readonly reason: string;
} {
  const body = strictRecord(value, ["allowExpired", "reason"]);
  if (body["allowExpired"] !== true) throw new Error("The request is invalid.");
  const reason = body["reason"];
  if (typeof reason !== "string" || reason.trim().length === 0)
    throw new Error("The request is invalid.");
  return { allowExpired: true, reason: reason.trim().slice(0, 240) };
}
