import { normalizeE164 } from "../../../common/validation/e164.js";
import { requiredString, strictRecord } from "./validation.js";

const roles = new Set(["owner_admin", "seller", "inventory_manager"]);

export interface CreateMembershipDto {
  readonly displayName: string;
  readonly phone: string;
  readonly roles: readonly string[];
}

export function parseCreateMembershipDto(value: unknown): CreateMembershipDto {
  const body = strictRecord(value, ["displayName", "phone", "roles"]);
  if (
    !Array.isArray(body["roles"]) ||
    body["roles"].length === 0 ||
    new Set(body["roles"]).size !== body["roles"].length ||
    body["roles"].some((role) => typeof role !== "string" || !roles.has(role))
  ) {
    throw new Error("The request is invalid.");
  }
  return {
    displayName: requiredString(body["displayName"], 1, 120),
    phone: normalizeE164(requiredString(body["phone"], 8, 16)),
    roles: body["roles"] as string[],
  };
}
