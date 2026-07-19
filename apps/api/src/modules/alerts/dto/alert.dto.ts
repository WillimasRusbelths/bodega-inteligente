import { strictRecord, text, uuid } from "../../catalog/dto/validation.js";
import type { AlertListQuery } from "../repositories/alert.repository.js";

export function parseAlertListQuery(
  value: Record<string, unknown>,
): AlertListQuery {
  const limit = value["limit"] === undefined ? 50 : Number(value["limit"]);
  if (!Number.isInteger(limit) || limit < 1 || limit > 100)
    throw new Error("The request is invalid.");
  const type = value["type"];
  const status = value["status"];
  if (
    type !== undefined &&
    (typeof type !== "string" ||
      !["LOW_STOCK", "EXPIRING_SOON", "EXPIRED"].includes(type))
  )
    throw new Error("The request is invalid.");
  if (
    status !== undefined &&
    (typeof status !== "string" || !["ACTIVE", "RESOLVED"].includes(status))
  )
    throw new Error("The request is invalid.");
  return {
    limit,
    ...(type === undefined
      ? {}
      : { type: type as Exclude<AlertListQuery["type"], undefined> }),
    ...(status === undefined
      ? {}
      : { status: status as Exclude<AlertListQuery["status"], undefined> }),
    ...(value["categoryId"] === undefined
      ? {}
      : { categoryId: uuid(value["categoryId"]) }),
    ...(value["cursor"] === undefined
      ? {}
      : { cursor: text(value["cursor"], 1, 512) }),
  } satisfies AlertListQuery;
}

export interface AlertResolveDto {
  readonly status: "RESOLVED";
  readonly reason?: string;
}

export function parseAlertResolveDto(value: unknown): AlertResolveDto {
  const body = strictRecord(value, ["status", "reason"]);
  if (body["status"] !== "RESOLVED") throw new Error("The request is invalid.");
  return {
    status: "RESOLVED",
    ...(body["reason"] === undefined
      ? {}
      : { reason: text(body["reason"], 1, 240) }),
  };
}
