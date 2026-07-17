import {
  requiredString,
  strictRecord,
} from "../../activation/dto/validation.js";

export interface RevokeDeviceDto {
  readonly reason: string;
}

export function parseRevokeDeviceDto(value: unknown): RevokeDeviceDto {
  const record = strictRecord(value, ["reason"]);
  return { reason: requiredString(record["reason"], 3, 500) };
}
