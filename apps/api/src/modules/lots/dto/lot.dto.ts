import {
  nonNegativeNumber,
  strictRecord,
  text,
  uuid,
} from "../../catalog/dto/validation.js";

export interface LotCreateDto {
  readonly receivedAt: Date;
  readonly expiresAt: Date;
  readonly initialQuantity: number;
  readonly unitCost: number;
  readonly reason?: string;
}

export function parseDateTime(value: unknown): Date {
  if (typeof value !== "string") throw new Error("The request is invalid.");
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error("The request is invalid.");
  return date;
}

export function parseDate(value: unknown): Date {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/u.test(value))
    throw new Error("The request is invalid.");
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value)
    throw new Error("The request is invalid.");
  return date;
}

export function parseLotCreateDto(value: unknown): LotCreateDto {
  const body = strictRecord(value, [
    "receivedAt",
    "expiresAt",
    "initialQuantity",
    "unitCost",
    "reason",
  ]);
  const initialQuantity = nonNegativeNumber(body["initialQuantity"]);
  if (initialQuantity <= 0) throw new Error("The request is invalid.");
  return {
    receivedAt: parseDateTime(body["receivedAt"]),
    expiresAt: parseDate(body["expiresAt"]),
    initialQuantity,
    unitCost: nonNegativeNumber(body["unitCost"]),
    ...(body["reason"] === undefined
      ? {}
      : { reason: text(body["reason"], 1, 240) }),
  };
}

export type LotStatus = "AVAILABLE" | "DEPLETED" | "EXPIRED" | "INACTIVE";
export type ExpirationState = "ACTIVE" | "EXPIRING_SOON" | "EXPIRED";

export interface LotListQuery {
  readonly productId?: string;
  readonly categoryId?: string;
  readonly status?: LotStatus;
  readonly expiresBefore?: Date;
  readonly expiresAfter?: Date;
  readonly expirationState?: ExpirationState;
  readonly cursor?: string;
  readonly limit: number;
  readonly includeExpired?: boolean;
}

export function parseLotListQuery(
  value: Record<string, unknown>,
): LotListQuery {
  const allowed = new Set([
    "productId",
    "categoryId",
    "status",
    "expiresBefore",
    "expiresAfter",
    "expirationState",
    "cursor",
    "limit",
    "includeExpired",
  ]);
  if (Object.keys(value).some((key) => !allowed.has(key)))
    throw new Error("The request is invalid.");
  const rawLimit = value["limit"] === undefined ? 50 : Number(value["limit"]);
  if (!Number.isInteger(rawLimit) || rawLimit < 1 || rawLimit > 100)
    throw new Error("The request is invalid.");
  const status = value["status"];
  if (
    status !== undefined &&
    (typeof status !== "string" ||
      !["AVAILABLE", "DEPLETED", "EXPIRED", "INACTIVE"].includes(status))
  )
    throw new Error("The request is invalid.");
  const expirationState = value["expirationState"];
  if (
    expirationState !== undefined &&
    (typeof expirationState !== "string" ||
      !["ACTIVE", "EXPIRING_SOON", "EXPIRED"].includes(expirationState))
  )
    throw new Error("The request is invalid.");
  const includeExpired =
    value["includeExpired"] === undefined
      ? undefined
      : value["includeExpired"] === true || value["includeExpired"] === "true";
  if (
    value["includeExpired"] !== undefined &&
    typeof value["includeExpired"] !== "boolean" &&
    value["includeExpired"] !== "true" &&
    value["includeExpired"] !== "false"
  )
    throw new Error("The request is invalid.");
  return {
    limit: rawLimit,
    ...(value["productId"] === undefined
      ? {}
      : { productId: uuid(value["productId"]) }),
    ...(value["categoryId"] === undefined
      ? {}
      : { categoryId: uuid(value["categoryId"]) }),
    ...(status === undefined ? {} : { status: status as LotStatus }),
    ...(value["expiresBefore"] === undefined
      ? {}
      : { expiresBefore: parseDate(value["expiresBefore"]) }),
    ...(value["expiresAfter"] === undefined
      ? {}
      : { expiresAfter: parseDate(value["expiresAfter"]) }),
    ...(expirationState === undefined
      ? {}
      : { expirationState: expirationState as ExpirationState }),
    ...(value["cursor"] === undefined
      ? {}
      : { cursor: text(value["cursor"], 1, 512) }),
    ...(includeExpired === undefined ? {} : { includeExpired }),
  };
}

export interface LotStatusDto {
  readonly status: LotStatus;
}
export function parseLotStatusDto(value: unknown): LotStatusDto {
  const body = strictRecord(value, ["status"]);
  const status = body["status"];
  if (
    !["AVAILABLE", "DEPLETED", "EXPIRED", "INACTIVE"].includes(String(status))
  )
    throw new Error("The request is invalid.");
  return { status: status as LotStatus };
}
