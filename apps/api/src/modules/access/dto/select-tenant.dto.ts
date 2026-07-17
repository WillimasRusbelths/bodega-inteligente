import { isUuid } from "../../../common/validation/uuid.js";
import { strictRecord } from "../../activation/dto/validation.js";

export interface SelectTenantDto {
  readonly membershipId: string;
}

export function parseSelectTenantDto(value: unknown): SelectTenantDto {
  const record = strictRecord(value, ["membershipId"]);
  const membershipId = record["membershipId"];
  if (typeof membershipId !== "string" || !isUuid(membershipId)) {
    throw new Error("The request is invalid.");
  }
  return { membershipId };
}
