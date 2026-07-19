import { catalogStatus, strictRecord, text } from "./validation.js";

export interface CategoryCreateDto {
  readonly name: string;
}
export interface CategoryUpdateDto {
  readonly name?: string;
}
export interface CatalogStatusDto {
  readonly status: "ACTIVE" | "INACTIVE";
}

export function parseCategoryCreateDto(value: unknown): CategoryCreateDto {
  const body = strictRecord(value, ["name"]);
  return { name: text(body["name"], 1, 120) };
}

export function parseCategoryUpdateDto(value: unknown): CategoryUpdateDto {
  const body = strictRecord(value, ["name"]);
  if (Object.keys(body).length === 0)
    throw new Error("The request is invalid.");
  return {
    ...(body["name"] === undefined ? {} : { name: text(body["name"], 1, 120) }),
  };
}

export function parseCatalogStatusDto(value: unknown): CatalogStatusDto {
  const body = strictRecord(value, ["status"]);
  return { status: catalogStatus(body["status"]) };
}
