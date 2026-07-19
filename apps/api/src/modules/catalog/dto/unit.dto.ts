import {
  catalogStatus,
  nonNegativeInteger,
  strictRecord,
  text,
} from "./validation.js";

export interface UnitCreateDto {
  readonly code: string;
  readonly name: string;
  readonly quantityScale: number;
}
export interface UnitUpdateDto {
  readonly code?: string;
  readonly name?: string;
  readonly quantityScale?: number;
}

export function parseUnitCreateDto(value: unknown): UnitCreateDto {
  const body = strictRecord(value, ["code", "name", "quantityScale"]);
  return {
    code: text(body["code"], 1, 40),
    name: text(body["name"], 1, 120),
    quantityScale: nonNegativeInteger(body["quantityScale"], 6),
  };
}

export function parseUnitUpdateDto(value: unknown): UnitUpdateDto {
  const body = strictRecord(value, ["code", "name", "quantityScale"]);
  if (Object.keys(body).length === 0)
    throw new Error("The request is invalid.");
  return {
    ...(body["code"] === undefined ? {} : { code: text(body["code"], 1, 40) }),
    ...(body["name"] === undefined ? {} : { name: text(body["name"], 1, 120) }),
    ...(body["quantityScale"] === undefined
      ? {}
      : { quantityScale: nonNegativeInteger(body["quantityScale"], 6) }),
  };
}

export { catalogStatus };
