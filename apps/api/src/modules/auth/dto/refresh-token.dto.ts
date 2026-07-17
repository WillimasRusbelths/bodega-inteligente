import {
  requiredString,
  strictRecord,
} from "../../activation/dto/validation.js";

export interface RefreshTokenDto {
  readonly refreshToken: string;
}

export function parseRefreshTokenDto(value: unknown): RefreshTokenDto {
  const record = strictRecord(value, ["refreshToken"]);
  return {
    refreshToken: requiredString(record["refreshToken"], 32, 4_096),
  };
}
