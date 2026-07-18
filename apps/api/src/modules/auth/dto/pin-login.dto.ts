import { normalizeE164 } from "../../../common/validation/e164.js";
import {
  requiredString,
  strictRecord,
} from "../../activation/dto/validation.js";

const pinPattern = /^\d{6}$/u;

export interface PinLoginDto {
  readonly phone: string;
  readonly pin: string;
  readonly deviceCredential: string;
}

export function parsePinLoginDto(value: unknown): PinLoginDto {
  const record = strictRecord(value, ["phone", "pin", "deviceCredential"]);
  const pin = requiredString(record["pin"], 6, 6);
  if (!pinPattern.test(pin)) throw new Error("The request is invalid.");
  let phone: string;
  try {
    phone = normalizeE164(requiredString(record["phone"], 9, 16));
  } catch {
    throw new Error("The request is invalid.");
  }
  return {
    phone,
    pin,
    deviceCredential: requiredString(record["deviceCredential"], 16, 4_096),
  };
}
